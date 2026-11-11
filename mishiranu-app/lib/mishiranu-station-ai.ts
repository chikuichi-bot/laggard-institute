import type {
  BikeRentalInfo,
  GuideKind,
  MealTier,
  MealTime,
  Spot,
  SpotGenre,
  StationMood,
  StationSeed,
} from "@/data/mishiranu-stations";
import { GUIDE_ORDER, REGIONS } from "@/data/mishiranu-stations";
import { fuzzLatLngForExternal } from "@/lib/mishiranu-geo";
import { beginPaidAiCall } from "@/lib/mishiranu-rate-limit";
import landmarkLocks from "@/data/landmark-locks.json";
import { withAreaDepth } from "@/lib/mishiranu-area-depth";
import { sealMapCoordinates } from "@/lib/mishiranu-map-trust";
import {
  filterFirstVisitSpots,
  isGuidebookWorship,
  isNeighborhoodWorship,
  isOrdinaryPublicFace,
} from "@/lib/mishiranu-first-visit-faces";
import {
  DEMACHI_TEMPLATE_PROMPT,
  isForeignDemachiPlace,
  type FirstVisitFace,
  type FirstVisitRole,
} from "@/lib/mishiranu-demachi-template";
import {
  ensureLandPresentAnchors,
  landAnchorPromptBlock,
} from "@/lib/mishiranu-land-anchors";
import {
  LAND_PROSE_ROLE_RULES,
  refineLandProse,
} from "@/lib/mishiranu-land-prose";
import { ensureLandMentions } from "@/lib/mishiranu-lore";

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent";

/** 土地の顔（majorWorthy）。名所・景色と名物店の合計。 */
const MAJOR_FACE_TOTAL = 5;
const MAJOR_SIGHT_TARGET = 3;
const MAJOR_FOOD_TARGET = 2;

const REGION_SET = new Set<string>(REGIONS);
const GUIDE_SET = new Set<GuideKind>(GUIDE_ORDER);
const GENRE_SET = new Set<SpotGenre>(["history", "gourmet", "nature", "odd"]);
const MEAL_TIER_SET = new Set<MealTier>(["casual", "upscale"]);
const MEAL_TIME_SET = new Set<MealTime>(["morning", "lunch", "dinner"]);

export type AiStationResult = {
  station: StationSeed;
  source: "ai";
};

function extractJsonObject(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1].trim() : trimmed;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function slugifyStationName(name: string): string {
  const base = name
    .trim()
    .replace(/駅$/u, "")
    .replace(/\s+/g, "")
    .slice(0, 24);
  const ascii = base.replace(/[^\w\u3040-\u30ff\u3400-\u9fff-]/gu, "");
  const stamp = Date.now().toString(36).slice(-4);
  return `ai-${ascii || "station"}-${stamp}`;
}

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v.trim() : fallback;
}

function asNumber(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

const STATION_SCHEMA_BLOCK = [
  "スキーマ:",
  "{",
  '  "name": "駅名（駅を付けない）",',
  '  "nameReading": "駅名のひらがな読み（例: でまちやなぎ）",',
  '  "line": "路線名",',
  '  "prefecture": "都道府県（都府県を含む短い表記可）",',
  '  "region": "北海道|東北|関東|中部|近畿|中国|四国|九州",',
  '  "mood": "story|empty",',
  '  "lat": 駅の緯度(number),',
  '  "lng": 駅の経度(number),',
  '  "stationIntro": "観光案内の導入。必ず5〜8文・合計220字以上。地名の由来・路線の接続・駅前の空気・いまの人の流れ・半日と1時間の両方の見え方を含める",',
  '  "areaAbout": "界隈の説明。必ず空行区切りの2段落。各段落4文以上・合計360字以上。1段落目＝地形と由来、2段落目＝いまの姿（生活・通学・店の気配）。近くに大学・キャンパス・学生街があれば正式名称で必ず触れる",',
  '  "walkGuide": "徒歩圏の回り方。必ず5〜7文・160字以上。出方・方角・時間があるとき／短いときの分岐。大学・キャンパスが近いならその方角も書く",',
  '  "tourTitle": "28字以内",',
  '  "catchCopy": "40字以内",',
  '  "emptyHeadline": "emptyのときだけ20字以内",',
  '  "emptyBody": "emptyのときだけ80字以内",',
  '  "bikeRental": { "available": boolean, "summary": "2〜3文。地元店とアプリ型の両方に触れる", "places": [ { "kind": "local|app", "name": "実在サービス・店の正式名", "walkMinutes": 5, "note": "使い方1文" } ] },',
  "- bikeRental.places の name は総称禁止（「駅前のレンタサイクル店」不可）。CLEW/クルー、HELLO CYCLING、えむじか など実在名。",
  "- 例（出町柳）: CLEW（クルー）京阪出町柳駅前（app）、レンタサイクルえむじか 出町柳店（local）。",
  '  "historyNotes": [{ "title": "短い見出し", "body": "土地メモ。各3〜5文・80字以上" }]（必ず6〜8件。歴史だけでなくいまの姿も。地名由来・産業/信仰・交通に加え、近くの大学・学校・学生街・いまの生活があれば正式名称で1件以上）,',
  '  "firstVisitFaces": [',
  '    { "role": "landform", "name": "正式名", "where": "位置", "why": "なぜ土地の骨格か1文", "present": "いまどう見えるか1文", "walkMinutes": 5, "lat": 0, "lng": 0 },',
  '    { "role": "landmark", "name": "正式名", "where": "位置", "why": "なぜ名所か1文", "present": "いまどう見えるか1文", "walkMinutes": 10, "lat": 0, "lng": 0 },',
  '    { "role": "town", "name": "正式名", "where": "位置", "why": "なぜ町場の顔か1文", "present": "いまどう見えるか1文", "walkMinutes": 5, "lat": 0, "lng": 0 }',
  "  ]（必須・ちょうど3件。出町柳雛形の役割どおり。ショートコースの正本）,",
  '  "sightseeingNotes": [{ "title": "見出し", "body": "観光メモ。各2〜4文" }]（必ず6〜7件。先頭3件は firstVisitFaces と同名・同順。続けて実用メモを3〜4件: 短い滞在の回り方・食べる休む・季節や注意・駅からの帰り方。別邸・二番手の名所だけで埋めない）',
  "}",
  "",
  "制約（この段階は土地の文章だけ。spots 配列は出さない）:",
  "- 日本の実在の鉄道駅でなければ { \"error\": \"not_a_station\", \"message\": \"理由\" } を返す。",
  "- 【出町柳雛形】役割の構成だけ借りる。固有名は出町柳のときだけ出町の名前。",
  "- firstVisitFaces 必須: landform / landmark / town を1件ずつ。本文にも同じ正式名称を書く。",
  "- 【固有名の取り違え禁止】入力駅が出町柳以外なら、鴨川デルタ・下鴨神社・枡形商店街・出町ふたば・同志社大学・京都大学を本文に入れない。",
  "- empty（本当に何も薄い駅）でも areaAbout と historyNotes は厚く書く。",
  "- 歴史だけで終わらせない。いまの姿も書く。",
  "- 駅の徒歩圏に大学があれば正式名称で触れる（遠い大学は寄せない）。",
  "- 出町柳の川名（必須）: 上流は賀茂川と高野川。合流点から南は鴨川。",
  "- いちばん重要: stationIntro / areaAbout / historyNotes を短くしない。",
  "- 禁止: 1文だけの areaAbout、2件以下の historyNotes、抽象語だけの紹介。",
  "- spots は書かない（次の段階で土地文から起こす）。",
].join("\n");

const PLACES_FROM_LAND_SCHEMA = [
  "スキーマ:",
  "{",
  '  "spots": [',
  "    {",
  '      "name": "土地の文章に出た正式名称、またはその土地の実在店名",',
  '      "genre": "history|gourmet|nature|odd",',
  '      "guide": "meal|souvenir|sight|rest|tip",',
  '      "mealTier": "casual|upscale（mealのみ）",',
  '      "mealTimes": ["morning|lunch|dinner"]（mealのみ）,',
  '      "soloOk": true|false（mealのみ）,',
  '      "budgetYen": "例 〜¥1,200",',
  '      "hours": "営業時間。屋外は終日（屋外）",',
  '      "blurb": "3〜4文",',
  '      "detail": "3〜4文",',
  '      "walkMinutes": 1〜40,',
  '      "lat": 緯度,',
  '      "lng": 経度,',
  '      "secretWorthy": boolean,',
  '      "majorWorthy": boolean',
  "    }",
  "  ]",
  "}",
  "",
  "制約:",
  "- 【最重要】spots の名所・地形・町場は、渡した土地の文章に登場する正式名称を先に全部起こす。",
  "- 文章に無い名所を先にリストしない。食事・土産は文章の生活感に合う実在店を足してよい。",
  "- spots は 14〜20件。meal 6〜8、souvenir 4〜6、sight 3以上、rest/tip 各2以上。",
  "- firstVisitFaces の3点は majorWorthy true。名所3＋名物店2で major はちょうど5。",
  "- meal/souvenir は駅から徒歩18分以内の実在店のみ。総称名禁止。",
  "- 出町柳以外で鴨川デルタ・下鴨・枡形・ふたば等を出さない。",
  "- lat/lng は本物。駅へ寄せない。徒歩25分超は出さない。",
].join("\n");

function buildStationPrompt(rawName: string): string {
  const name = rawName.replace(/駅$/u, "").trim() || rawName.trim();
  return [
    "あなたは日本の駅の徒歩圏を案内する編集者です。",
    "Google検索の結果を優先し、実在する駅・名所だけを使ってください。",
    "観光ガイドの煽りやランキング口調は禁止。Lagadoらしい静かで詩的な日本語。",
    "【この段階】土地の文章だけを厚く書く。地図・案内の spots はまだ書かない。",
    "出力は JSON オブジェクトのみ（前後の説明文なし）。",
    "",
    DEMACHI_TEMPLATE_PROMPT,
    "",
    `入力された駅名: ${name}`,
    "",
    landAnchorPromptBlock(name),
    "",
    LAND_PROSE_ROLE_RULES,
    "",
    STATION_SCHEMA_BLOCK,
  ].join("\n");
}

function buildPlacesFromLandPrompt(station: StationSeed): string {
  const faces = (station.firstVisitFaces ?? [])
    .map((f) => `${f.role}:${f.name}`)
    .join("、");
  const hist = (station.historyNotes ?? [])
    .slice(0, 8)
    .map((n) => `【${n.title}】${n.body}`)
    .join("\n");
  const sight = (station.sightseeingNotes ?? [])
    .slice(0, 7)
    .map((n) => `【${n.title}】${n.body}`)
    .join("\n");
  return [
    "あなたは日本の駅の徒歩圏を案内する編集者です。",
    "【順番】土地の文章はすでにできている。その文章に書いた正式名称から、地図と案内の場所（spots）を起こす。",
    "観光ランキング口調は禁止。Lagadoらしい静かで具体的な日本語。",
    "出力は JSON のみ。",
    "",
    `駅名: ${station.name}（${station.prefecture} · ${station.line}）`,
    `駅座標: ${station.lat}, ${station.lng}`,
    `firstVisitFaces: ${faces || "（なし）"}`,
    "",
    "—— 土地の文章（正本）——",
    `stationIntro: ${station.stationIntro ?? ""}`,
    `areaAbout: ${station.areaAbout ?? ""}`,
    `walkGuide: ${station.walkGuide ?? ""}`,
    "historyNotes:",
    hist || "（なし）",
    "sightseeingNotes:",
    sight || "（なし）",
    "",
    landAnchorPromptBlock(station.name),
    "",
    PLACES_FROM_LAND_SCHEMA,
  ].join("\n");
}

function buildNearbyPrompt(lat: number, lng: number): string {
  return [
    "あなたは日本の駅の徒歩圏を案内する編集者です。",
    "Google検索の結果を優先し、実在する駅・名所だけを使ってください。",
    "観光ガイドの煽りやランキング口調は禁止。Lagadoらしい静かで詩的な日本語。",
    "【この段階】最寄り駅を特定し、土地の文章だけを厚く書く。spots は書かない。",
    "出力は JSON オブジェクトのみ（前後の説明文なし）。",
    "",
    DEMACHI_TEMPLATE_PROMPT,
    "",
    // Coarsened coords only (~1 km). Do not ask the model for finer precision.
    `現在地（おおよそ）: 緯度 ${lat.toFixed(2)}, 経度 ${lng.toFixed(2)}`,
    "座標は約1km単位に丸めてあります。この付近で最も近い実在の鉄道駅（新幹線停車駅より、最寄りの在来線・私鉄駅を優先）を特定し、その駅名で土地文を返す。",
    "特定した駅に近い大学・キャンパスがあるなら、総称ではなく正式名称（例: 京都大学、同志社大学）を土地文に書く。",
    "",
    LAND_PROSE_ROLE_RULES,
    "",
    STATION_SCHEMA_BLOCK,
  ].join("\n");
}

function parseSpot(raw: unknown, index: number): Spot | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const name = asString(o.name);
  const blurb = asString(o.blurb);
  if (!name || !blurb) return null;

  const genreRaw = asString(o.genre, "odd") as SpotGenre;
  const genre = GENRE_SET.has(genreRaw) ? genreRaw : "odd";
  const guideRaw = asString(o.guide) as GuideKind;
  const guide = GUIDE_SET.has(guideRaw) ? guideRaw : undefined;

  const walkMinutes = clamp(Math.round(asNumber(o.walkMinutes, 10)), 1, 45);
  const x = clamp(0.2 + (index % 5) * 0.12, 0.12, 0.88);
  const y = clamp(0.25 + Math.floor(index / 5) * 0.18, 0.18, 0.82);

  const spot: Spot = {
    id: `ai-spot-${index + 1}`,
    name,
    genre,
    guide,
    hours: asString(o.hours) || undefined,
    blurb,
    detail: asString(o.detail) || undefined,
    x,
    y,
    walkMinutes,
    secretWorthy: o.secretWorthy === true,
    majorWorthy: o.majorWorthy === true,
  };

  if (typeof o.lat === "number" && typeof o.lng === "number") {
    spot.lat = o.lat;
    spot.lng = o.lng;
  }

  if (guide === "meal" || (!guide && genre === "gourmet")) {
    const tier = asString(o.mealTier, "casual") as MealTier;
    spot.mealTier = MEAL_TIER_SET.has(tier) ? tier : "casual";
    const timesRaw = Array.isArray(o.mealTimes) ? o.mealTimes : ["lunch"];
    const times = timesRaw
      .map((t) => asString(t) as MealTime)
      .filter((t): t is MealTime => MEAL_TIME_SET.has(t));
    spot.mealTimes = times.length > 0 ? times : ["lunch"];
    if (typeof o.soloOk === "boolean") {
      spot.soloOk = o.soloOk;
    } else {
      spot.soloOk = spot.mealTier !== "upscale";
    }
    const budget = asString(o.budgetYen);
    spot.budgetYen =
      budget || (spot.mealTier === "upscale" ? "¥3,000〜" : "〜¥1,500");
    if (!spot.guide) spot.guide = "meal";
  }

  return spot;
}

function parseBike(raw: unknown): BikeRentalInfo | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const summary = asString(o.summary);
  if (!summary) return undefined;
  const placesRaw = Array.isArray(o.places) ? o.places : [];
  const places = placesRaw
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const p = row as Record<string, unknown>;
      const name = asString(p.name);
      if (!name) return null;
      const kindRaw = asString(p.kind);
      const kind =
        kindRaw === "app" || kindRaw === "local"
          ? kindRaw
          : /シェア|アプリ|HELLO|ドコモ|CLEW|クルー|CREW|Clew/i.test(name)
            ? ("app" as const)
            : ("local" as const);
      const walk =
        typeof p.walkMinutes === "number" && Number.isFinite(p.walkMinutes)
          ? Math.round(p.walkMinutes)
          : undefined;
      const note = asString(p.note) || undefined;
      return { name, kind, walkMinutes: walk, note };
    })
    .filter((p): p is NonNullable<typeof p> => !!p)
    .slice(0, 6);
  return {
    available: o.available === true,
    summary,
    places: places.length > 0 ? places : undefined,
  };
}

export function parseAiStationPayload(
  parsed: Record<string, unknown>,
  requestedName: string,
): StationSeed | { error: string; message: string } {
  if (asString(parsed.error) === "not_a_station") {
    return {
      error: "not_a_station",
      message:
        asString(parsed.message) ||
        "鉄道の駅として確認できませんでした。別の駅名で試してください。",
    };
  }

  const name =
    asString(parsed.name).replace(/駅$/u, "") ||
    requestedName.replace(/駅$/u, "").trim() ||
    requestedName.trim();
  if (!name) {
    return { error: "invalid", message: "駅名が空です。" };
  }

  const regionRaw = asString(parsed.region, "関東");
  const region = (
    REGION_SET.has(regionRaw) ? regionRaw : "関東"
  ) as StationSeed["region"];
  const mood: StationMood = parsed.mood === "empty" ? "empty" : "story";

  const spotsRaw = Array.isArray(parsed.spots) ? parsed.spots : [];
  const spots = spotsRaw
    .map((s, i) => parseSpot(s, i))
    .filter((s): s is Spot => !!s)
    .slice(0, 22);

  const facesPreview = parseFirstVisitFaces(parsed.firstVisitFaces);
  // 土地文先出し: spots は後段で土地文から起こす。faces があれば空でも進む。
  if (spots.length === 0 && !(facesPreview && facesPreview.length >= 2)) {
    const hasLand =
      asString(parsed.areaAbout).length >= 80 ||
      asString(parsed.stationIntro).length >= 80 ||
      (parseNoteList(parsed.historyNotes, 3)?.length ?? 0) >= 2;
    if (!hasLand) {
      return {
        error: "empty_spots",
        message: "案内スポットを作れませんでした。別の駅名で試してください。",
      };
    }
  }

  const lat = asNumber(parsed.lat, 35.0);
  const lng = asNumber(parsed.lng, 135.0);

  const historyNotes = parseNoteList(parsed.historyNotes, 9);
  const sightseeingNotes = parseNoteList(parsed.sightseeingNotes, 8);
  const firstVisitFaces = parseFirstVisitFaces(parsed.firstVisitFaces);

  let station: StationSeed = {
    id: slugifyStationName(name),
    name,
    nameReading: asString(parsed.nameReading) || undefined,
    line: asString(parsed.line, "路線情報は要確認"),
    prefecture: asString(parsed.prefecture, "日本"),
    region,
    mood,
    radiiKm: [0.9, 1.0, 1.2],
    stationIntro: asString(parsed.stationIntro) || undefined,
    areaAbout: asString(parsed.areaAbout) || undefined,
    walkGuide: asString(parsed.walkGuide) || undefined,
    historyNotes: historyNotes && historyNotes.length > 0 ? historyNotes : undefined,
    sightseeingNotes:
      sightseeingNotes && sightseeingNotes.length > 0
        ? sightseeingNotes
        : undefined,
    bikeRental: parseBike(parsed.bikeRental),
    tourTitle:
      asString(parsed.tourTitle).slice(0, 28) ||
      `${name}の徒歩圏を、ゆるく歩く`,
    catchCopy:
      asString(parsed.catchCopy).slice(0, 40) ||
      "降りた場所から、予定のない寄り道を。",
    spots,
    lat,
    lng,
    source: "ai",
    firstVisitFaces,
  };

  if (mood === "empty") {
    station.emptyCopy = {
      headline:
        asString(parsed.emptyHeadline).slice(0, 20) || "余白を、そのまま座る",
      body:
        asString(parsed.emptyBody).slice(0, 80) ||
        "観光リストは短くていい。駅の静けさそのものが案内です。",
    };
  }

  station = applyFirstVisitFaces(station);
  // 出町雛形の固有名が他駅へ漏れたときの最後の門
  station = {
    ...station,
    spots: station.spots.filter(
      (s) => !isForeignDemachiPlace(s.name, station.name),
    ),
    sightseeingNotes: (station.sightseeingNotes ?? []).filter(
      (n) => !isForeignDemachiPlace(n.title, station.name),
    ),
    firstVisitFaces: (station.firstVisitFaces ?? []).filter(
      (f) => !isForeignDemachiPlace(f.name, station.name),
    ),
  };
  return station;
}

type GeminiCallResult =
  | { ok: true; text: string }
  | { ok: false; error: string; message: string };

const GEMINI_FAST_MS = 22_000;
const GEMINI_GROUNDED_MS = 32_000;
const GEMINI_EXPAND_MS = 28_000;

function isNarrativeThin(station: StationSeed): boolean {
  // spots は土地文のあとに起こすので、薄さ判定に入れない。
  const intro = (station.stationIntro ?? "").length;
  const about = (station.areaAbout ?? "").length;
  const walk = (station.walkGuide ?? "").length;
  const notes = station.historyNotes ?? [];
  const histChars = notes.reduce((n, h) => n + h.body.length, 0);
  const sight = station.sightseeingNotes ?? [];
  return (
    intro < 240 ||
    about < 380 ||
    walk < 160 ||
    notes.length < 6 ||
    histChars < 560 ||
    sight.length < 5
  );
}

function parseNoteList(
  raw: unknown,
  limit: number,
): Array<{ title: string; body: string }> | undefined {
  if (!Array.isArray(raw)) return undefined;
  const notes = raw
    .map((n) => {
      if (!n || typeof n !== "object") return null;
      const o = n as Record<string, unknown>;
      const title = asString(o.title);
      const body = asString(o.body);
      if (!title || !body) return null;
      return { title, body };
    })
    .filter((n): n is { title: string; body: string } => !!n)
    .slice(0, limit);
  return notes.length > 0 ? notes : undefined;
}

const ROLE_SET = new Set<FirstVisitRole>(["landform", "landmark", "town"]);

function parseFirstVisitFaces(raw: unknown): FirstVisitFace[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const faces: FirstVisitFace[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const roleRaw = asString(o.role) as FirstVisitRole;
    const name = asString(o.name);
    if (!ROLE_SET.has(roleRaw) || !name) continue;
    const lat = asNumber(o.lat, Number.NaN);
    const lng = asNumber(o.lng, Number.NaN);
    faces.push({
      role: roleRaw,
      name,
      where: asString(o.where) || undefined,
      why: asString(o.why) || undefined,
      present: asString(o.present) || undefined,
      walkMinutes: asNumber(o.walkMinutes, 8) || 8,
      ...(Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : {}),
    });
  }
  // 役割ごとに先頭1件だけ（出町雛形の3点）
  const byRole = new Map<FirstVisitRole, FirstVisitFace>();
  for (const face of faces) {
    if (!byRole.has(face.role)) byRole.set(face.role, face);
  }
  const ordered = (["landform", "landmark", "town"] as FirstVisitRole[])
    .map((r) => byRole.get(r))
    .filter((f): f is FirstVisitFace => !!f);
  return ordered.length >= 2 ? ordered : undefined;
}

/** firstVisitFaces を観光メモ・スポットへ降ろす（知らない駅も出町と同じ型）。 */
function applyFirstVisitFaces(station: StationSeed): StationSeed {
  const faces = (station.firstVisitFaces ?? []).filter(
    (f) => !isForeignDemachiPlace(f.name, station.name),
  );
  if (!faces.length) return station;

  const faceNotes = faces.map((f) => ({
    title: f.name === "下鴨神社" ? "下鴨神社と糺の森" : f.name,
    body: [f.why, f.present].filter(Boolean).join("") || `${f.name}。この駅の土地の顔。`,
  }));
  // 雛形3点のあとに、AIが書いた実用メモを足す（上書きで消さない）
  const extras = (station.sightseeingNotes ?? []).filter((n) => {
    if (isForeignDemachiPlace(n.title, station.name)) return false;
    return !faceNotes.some(
      (f) =>
        n.title.includes(f.title) ||
        f.title.includes(n.title) ||
        faces.some((face) => n.title.includes(face.name)),
    );
  });
  const sightseeingNotes = [...faceNotes, ...extras].slice(0, 7);

  let spots = [...(station.spots ?? [])];
  for (const face of faces) {
    const idx = spots.findIndex(
      (s) => s.name.includes(face.name) || face.name.includes(s.name),
    );
    if (idx >= 0) {
      const cur = spots[idx]!;
      spots[idx] = {
        ...cur,
        name: cur.name.includes(face.name) ? cur.name : face.name,
        majorWorthy: true,
        guide: cur.guide ?? "sight",
        lat: face.lat ?? cur.lat,
        lng: face.lng ?? cur.lng,
        walkMinutes: face.walkMinutes ?? cur.walkMinutes,
        coordTrust:
          face.lat != null && face.lng != null
            ? ("lock" as const)
            : cur.coordTrust,
      };
      continue;
    }
    if (face.lat == null || face.lng == null) continue;
    spots.push({
      id: `face-${face.role}-${face.name.replace(/\s+/g, "").slice(0, 24)}`,
      name: face.name,
      genre: face.role === "landform" ? "nature" : "history",
      guide: "sight",
      mealTier: "casual",
      mealTimes: [],
      soloOk: true,
      budgetYen: "—",
      hours: "終日（屋外）",
      blurb: [face.why, face.present].filter(Boolean).join(" "),
      detail: face.where,
      walkMinutes: face.walkMinutes ?? 8,
      x: 0.45,
      y: 0.4,
      majorWorthy: true,
      secretWorthy: false,
      lat: face.lat,
      lng: face.lng,
      coordTrust: "lock",
    });
  }

  return { ...station, sightseeingNotes, spots };
}

function buildNarrativeExpandPrompt(station: StationSeed): string {
  return [
    "あなたは日本の駅の徒歩圏を案内する編集者です。",
    "実在の歴史・地名由来・産業・信仰・交通の変遷に加え、いまの生活・通学・店の気配も書いて、薄い紹介文を厚く書き直してください。",
    "近くに大学・キャンパス・学生街があれば正式名称で触れる（例: 出町柳なら京都大学・同志社大学）。",
    "観光ガイドの煽りやランキング口調は禁止。Lagadoらしい静かで詩的な日本語。",
    "出力は JSON オブジェクトのみ。",
    "",
    `駅名: ${station.name}`,
    `路線: ${station.line}`,
    `都道府県: ${station.prefecture}`,
    `既存の短い紹介: ${station.stationIntro ?? "(なし)"}`,
    `既存の短いエリア文: ${station.areaAbout ?? "(なし)"}`,
    "",
    landAnchorPromptBlock(station.name),
    "",
    LAND_PROSE_ROLE_RULES,
    "",
    "スキーマ:",
    "{",
    '  "stationIntro": "5〜8文・220字以上。いまの人の流れも含める",',
    '  "areaAbout": "空行区切り2段落・合計360字以上。1段落目＝由来、2段落目＝いまの姿。大学があれば正式名称を出す",',
    '  "walkGuide": "5〜7文・160字以上。大学が近いなら正式名称と方角",',
    '  "bikeRentalSummary": "2〜3文",',
    '  "historyNotes": [{ "title": "...", "body": "3〜5文" }]（6〜8件。歴史といまの半々くらい。必須の大学名は各1件）,',
    '  "sightseeingNotes": [{ "title": "...", "body": "2〜4文" }]（6〜7件。先頭は土地の顔3点、続きは実用メモ）',
    "}",
    "",
    "短い一文で終わらせないこと。読者が歴史といまの姿の両方を知れる分量にする。必須の具体名は省略しない。",
  ].join("\n");
}

function countGuide(station: StationSeed, guide: GuideKind): number {
  return station.spots.filter((s) => s.guide === guide).length;
}

function isShopThin(station: StationSeed): boolean {
  // ご飯・土産は件数不足なら必ず補完。文言が短くても件数優先で足す。
  return (
    countGuide(station, "meal") < MIN_MEAL_SPOTS ||
    countGuide(station, "souvenir") < MIN_SOUVENIR_SPOTS
  );
}

function buildShopExpandPrompt(station: StationSeed): string {
  const meals = station.spots
    .filter((s) => s.guide === "meal")
    .map((s) => s.name)
    .join("、");
  const souvenirs = station.spots
    .filter((s) => s.guide === "souvenir")
    .map((s) => s.name)
    .join("、");
  return [
    "あなたは日本の駅の徒歩圏を案内する編集者です。",
    "Google検索で実在を確認できる店だけを使い、ご飯屋とお土産屋を厚く補完してください。",
    "観光ランキング口調は禁止。Lagadoらしい静かで具体的な日本語。",
    "出力は JSON のみ。",
    "",
    `駅名: ${station.name}（${station.prefecture} · ${station.line}）`,
    `駅座標の目安: ${station.lat}, ${station.lng}`,
    `既存のご飯: ${meals || "（なし）"}`,
    `既存のお土産: ${souvenirs || "（なし）"}`,
    "",
    "スキーマ:",
    "{",
    '  "spots": [',
    "    {",
    '      "name": "実在店の正式名称",',
    '      "guide": "meal|souvenir",',
    '      "genre": "gourmet|odd",',
    '      "mealTier": "casual|upscale（mealのみ）",',
    '      "mealTimes": ["morning|lunch|dinner"]（mealのみ）,',
    '      "soloOk": true|false（mealのみ）,',
    '      "budgetYen": "例 〜¥1,200",',
    '      "hours": "営業時間",',
    '      "blurb": "3〜4文",',
    '      "detail": "3〜4文",',
    '      "walkMinutes": 1〜18,',
    '      "lat": number,',
    '      "lng": number',
    "    }",
    "  ]",
    "}",
    "",
    "制約:",
    `- いま meal ${countGuide(station, "meal")}件 / souvenir ${countGuide(station, "souvenir")}件。meal は合計少なくとも6件、souvenir は合計少なくとも4件になるまで追加する。`,
    "- 可能なら meal 7〜8件・souvenir 5件まで足す。既存と同名は出さない。名物菓子は souvenir 側。",
    "- meal は土地の定番めし優先: 地元パン屋・おにぎり・商店街の食堂・うどん・そば・定食。多目的カフェ・コワーキング・知る感じる系は足さない。",
    "- 返す spots 配列には「追加する店だけ」を入れる（既存の再掲は不要）。",
    "- meal / souvenir は駅から徒歩18分以内（約1.3km）だけ。遠い店・別エリアの店は入れない。座標を駅へ寄せない。",
    "- ことばのはおと・今出川〜丸太町の鴨川沿いなど、堀川・御所寄りの店を出町柳に足さない。",
    "- 閉店・確認できない店は出さない。",
    "- blurb と detail は各3文以上。短い一行は禁止。",
  ].join("\n");
}

async function expandShopSpots(
  station: StationSeed,
  apiKey: string,
  viewerSub: string,
): Promise<StationSeed> {
  if (!isShopThin(station)) return station;

  const expanded = await callGeminiGenerate(
    apiKey,
    viewerSub,
    {
      contents: [
        {
          role: "user",
          parts: [{ text: buildShopExpandPrompt(station) }],
        },
      ],
      tools: [{ google_search: {} }],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 4096,
      },
    },
    GEMINI_EXPAND_MS,
  );
  if (!expanded.ok) return station;
  const parsed = extractJsonObject(expanded.text);
  if (!parsed || !Array.isArray(parsed.spots)) return station;

  const existingNames = new Set(
    station.spots.map((s) => s.name.replace(/\s+/g, "")),
  );
  const extras = parsed.spots
    .map((raw, i) => parseSpot(raw, station.spots.length + i))
    .filter((s): s is Spot => {
      if (!s) return false;
      if (s.guide !== "meal" && s.guide !== "souvenir") return false;
      const key = s.name.replace(/\s+/g, "");
      if (existingNames.has(key)) return false;
      existingNames.add(key);
      return true;
    });

  if (extras.length === 0) return station;
  return {
    ...station,
    spots: [...station.spots, ...extras].slice(0, 22),
  };
}

const MIN_REST_SPOTS = 3;

function isSitDownCafeName(name: string): boolean {
  if (/多目的|つながる|知る、感じる|コワーキング|レンタルスペース|シェアキッチン/.test(name)) {
    return false;
  }
  if (/食堂|定食|レストラン|ラーメン|うどん|そば|寿司|すし|焼肉|居酒屋/.test(name)) {
    return false;
  }
  return /喫茶|純喫茶|茶房|カフェ|珈琲|コーヒー/.test(name);
}

function buildRestExpandPrompt(station: StationSeed): string {
  const rests = station.spots
    .filter((s) => s.guide === "rest")
    .map((s) => s.name)
    .join("、");
  const names = station.spots.map((s) => s.name).join("、");
  return [
    "あなたは日本の駅の徒歩圏を案内する編集者です。",
    "Google検索で実在を確認し、「休むところ」だけを足してください。店名の固定リストは使わない。この駅の徒歩圏から自分で選ぶ。",
    "出力は JSON のみ。",
    "",
    `駅名: ${station.name}（${station.prefecture} · ${station.line}）`,
    `駅座標の目安: ${station.lat}, ${station.lng}`,
    `既存の休むところ: ${rests || "（なし）"}`,
    `既に案内にある名前（再掲禁止）: ${names || "（なし）"}`,
    "",
    "スキーマ:",
    '{ "spots": [ { "name", "guide":"rest", "genre":"nature|town|gourmet", "blurb", "detail", "walkMinutes", "lat", "lng", "hours" } ] }',
    "",
    "制約:",
    `- rest が合計${MIN_REST_SPOTS}件以上になるまで追加する。返すのは追加分だけ。`,
    "- 腰を下ろせる景色を1件以上（川の合流、三角州、公園、橋のたもと、並木）。固有名詞にする。",
    "- 長居できる喫茶・カフェ・茶房を1件以上（guide は rest）。定食屋・食堂は入れない（それらはご飯）。",
    "- 寺・神社そのものは入れない（観光）。",
    "- 駅から徒歩18分以内。座標を駅へ寄せない。確認できない場所は出さない。",
    "- blurb と detail は各3文以上。そこでどう休むかを書く。",
  ].join("\n");
}

function hasSitDownCafeRest(station: StationSeed): boolean {
  return station.spots.some((s) => s.guide === "rest" && isSitDownCafeName(s.name));
}

async function expandRestSpots(
  station: StationSeed,
  apiKey: string,
  viewerSub: string,
): Promise<StationSeed> {
  if (countGuide(station, "rest") >= MIN_REST_SPOTS && hasSitDownCafeRest(station)) {
    return station;
  }
  const expanded = await callGeminiGenerate(
    apiKey,
    viewerSub,
    {
      contents: [
        { role: "user", parts: [{ text: buildRestExpandPrompt(station) }] },
      ],
      tools: [{ google_search: {} }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 3072 },
    },
    GEMINI_EXPAND_MS,
  );
  if (!expanded.ok) return station;
  const parsed = extractJsonObject(expanded.text);
  if (!parsed || !Array.isArray(parsed.spots)) return station;
  const existingNames = new Set(station.spots.map((s) => s.name.replace(/\s+/g, "")));
  const extras = parsed.spots
    .map((raw, i) => parseSpot(raw, station.spots.length + i))
    .filter((s): s is Spot => {
      if (!s || s.guide !== "rest") return false;
      const key = s.name.replace(/\s+/g, "");
      if (existingNames.has(key)) return false;
      existingNames.add(key);
      return true;
    });
  if (extras.length === 0) return station;
  return { ...station, spots: [...station.spots, ...extras] };
}

async function expandStationNarrative(
  station: StationSeed,
  apiKey: string,
  viewerSub: string,
): Promise<StationSeed> {
  if (!isNarrativeThin(station)) return station;

  const expanded = await callGeminiGenerate(
    apiKey,
    viewerSub,
    {
      contents: [
        {
          role: "user",
          parts: [{ text: buildNarrativeExpandPrompt(station) }],
        },
      ],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 6144,
        responseMimeType: "application/json",
      },
    },
    GEMINI_EXPAND_MS,
  );
  if (!expanded.ok) return station;

  const parsed = extractJsonObject(expanded.text);
  if (!parsed) return station;

  const historyNotes =
    parseNoteList(parsed.historyNotes, 9) ?? station.historyNotes;
  const sightseeingNotes =
    parseNoteList(parsed.sightseeingNotes, 8) ?? station.sightseeingNotes;
  const stationIntro = asString(parsed.stationIntro) || station.stationIntro;
  const areaAbout = asString(parsed.areaAbout) || station.areaAbout;
  const walkGuide = asString(parsed.walkGuide) || station.walkGuide;
  const bikeSummary = asString(parsed.bikeRentalSummary);

  return {
    ...station,
    stationIntro:
      (stationIntro?.length ?? 0) >= (station.stationIntro?.length ?? 0)
        ? stationIntro
        : station.stationIntro,
    areaAbout:
      (areaAbout?.length ?? 0) >= (station.areaAbout?.length ?? 0)
        ? areaAbout
        : station.areaAbout,
    walkGuide:
      (walkGuide?.length ?? 0) >= (station.walkGuide?.length ?? 0)
        ? walkGuide
        : station.walkGuide,
    historyNotes:
      (historyNotes?.length ?? 0) >= (station.historyNotes?.length ?? 0)
        ? historyNotes
        : station.historyNotes,
    sightseeingNotes:
      (sightseeingNotes?.length ?? 0) >= (station.sightseeingNotes?.length ?? 0)
        ? sightseeingNotes
        : station.sightseeingNotes,
    bikeRental: station.bikeRental
      ? {
          ...station.bikeRental,
          summary:
            bikeSummary.length > station.bikeRental.summary.length
              ? bikeSummary
              : station.bikeRental.summary,
        }
      : bikeSummary
        ? { available: true, summary: bikeSummary }
        : station.bikeRental,
  };
}

async function callGeminiGenerate(
  apiKey: string,
  viewerSub: string,
  body: Record<string, unknown>,
  timeoutMs: number,
): Promise<GeminiCallResult> {
  const paid = beginPaidAiCall(viewerSub);
  if (!paid.ok) {
    return {
      ok: false,
      error: "gemini_http",
      message: "いま混み合っています。少し待ってから、もう一度どうぞ。",
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(GEMINI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return {
        ok: false,
        error: "gemini_http",
        message: `Gemini への接続に失敗しました（${res.status}）。${detail.slice(0, 120)}`,
      };
    }
    const data = (await res.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };
    const text = data.candidates?.[0]?.content?.parts
      ?.map((p) => p.text ?? "")
      .join("")
      .trim();
    if (!text) {
      return {
        ok: false,
        error: "empty_response",
        message: "Gemini から案内が返りませんでした。もう一度どうぞ。",
      };
    }
    return { ok: true, text };
  } catch (err) {
    const aborted =
      err instanceof Error &&
      (err.name === "AbortError" || /aborted/i.test(err.message));
    return {
      ok: false,
      error: aborted ? "timeout" : "network",
      message: aborted
        ? "案内の生成が時間切れになりました。もう一度どうぞ。"
        : "Gemini への通信に失敗しました。もう一度どうぞ。",
    };
  } finally {
    clearTimeout(timer);
    paid.release();
  }
}

function stationFromGeminiText(
  text: string,
  rawName: string,
): AiStationResult | { error: string; message: string } {
  const parsed = extractJsonObject(text);
  if (!parsed) {
    return {
      error: "bad_json",
      message: "案内の形式を読めませんでした。もう一度どうぞ。",
    };
  }
  const stationOrErr = parseAiStationPayload(parsed, rawName);
  if ("error" in stationOrErr) return stationOrErr;
  return { station: stationOrErr, source: "ai" };
}

const WALK_RADIUS_KM = 2.0;
/** ご飯・土産は駅前の空気が残る狭い圏（徒歩おおよそ18分）。丸太町までは広げない */
const SHOP_WALK_RADIUS_KM = 1.35;
const SHOP_MAX_WALK_MINUTES = 18;

function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const toR = (d: number) => (d * Math.PI) / 180;
  const dLat = toR(b.lat - a.lat);
  const dLng = toR(b.lng - a.lng);
  const lat1 = toR(a.lat);
  const lat2 = toR(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

const MIN_MEAL_SPOTS = 6;
const MIN_SOUVENIR_SPOTS = 4;

function isShopGuide(s: Spot): boolean {
  return s.guide === "meal" || s.guide === "souvenir";
}

function shopWithinStationArea(
  center: { lat: number; lng: number },
  s: Spot,
): boolean {
  if (s.walkMinutes > SHOP_MAX_WALK_MINUTES) return false;
  if (typeof s.lat !== "number" || typeof s.lng !== "number") return true;
  const km = haversineKm(center, { lat: s.lat, lng: s.lng });
  // 座標はAI推定でズレやすいので、徒歩分が近ければやや広めまで許容
  return km <= SHOP_WALK_RADIUS_KM || km <= 1.6;
}

/** AI が駅の外の有名店を載せた／遠い座標のまま残したものを落とす。遠い店は件数のためにも戻さない。 */
function filterFarSpots(station: StationSeed): StationSeed {
  if (
    typeof station.lat !== "number" ||
    typeof station.lng !== "number" ||
    !Number.isFinite(station.lat) ||
    !Number.isFinite(station.lng)
  ) {
    return station;
  }
  const center = { lat: station.lat, lng: station.lng };
  const spots = station.spots.filter((s) => {
    if (typeof s.lat !== "number" || typeof s.lng !== "number") return true;
    const km = haversineKm(center, { lat: s.lat, lng: s.lng });
    if (isShopGuide(s)) return shopWithinStationArea(center, s);
    return km <= WALK_RADIUS_KM;
  });
  if (spots.length === station.spots.length) return station;
  return { ...station, spots: spots.length > 0 ? spots : station.spots.slice(0, 1) };
}

/** 遠距離フィルタ後、圏内の候補だけでご飯・土産の下限を満たす */
function ensureShopGuideFloor(
  station: StationSeed,
  original: StationSeed,
): StationSeed {
  if (
    typeof station.lat !== "number" ||
    typeof station.lng !== "number" ||
    !Number.isFinite(station.lat) ||
    !Number.isFinite(station.lng)
  ) {
    return station;
  }
  const center = { lat: station.lat, lng: station.lng };
  const ids = new Set(station.spots.map((s) => s.id));
  const next = [...station.spots];
  const need = (guide: "meal" | "souvenir", min: number) => {
    let n = next.filter((s) => s.guide === guide).length;
    if (n >= min) return;
    const pool = original.spots
      .filter(
        (s) =>
          s.guide === guide &&
          !ids.has(s.id) &&
          shopWithinStationArea(center, s),
      )
      .sort((a, b) => a.walkMinutes - b.walkMinutes);
    for (const s of pool) {
      if (n >= min) break;
      next.push(s);
      ids.add(s.id);
      n += 1;
    }
  };
  need("meal", MIN_MEAL_SPOTS);
  need("souvenir", MIN_SOUVENIR_SPOTS);
  if (next.length === station.spots.length) return station;
  return { ...station, spots: next };
}

function countMajor(station: StationSeed): number {
  return station.spots.filter((s) => s.majorWorthy).length;
}

function applyMajorNames(
  station: StationSeed,
  names: string[],
): StationSeed {
  const wanted = names
    .map((n) => n.trim())
    .filter(Boolean)
    .slice(0, 3);
  if (wanted.length === 0) return station;
  const matchedIds = new Set<string>();
  for (const want of wanted) {
    const hit =
      station.spots.find((s) => s.name === want) ||
      station.spots.find(
        (s) => s.name.includes(want) || want.includes(s.name),
      );
    if (hit) matchedIds.add(hit.id);
  }
  if (matchedIds.size === 0) return station;
  return {
    ...station,
    spots: station.spots.map((s) => ({
      ...s,
      majorWorthy: matchedIds.has(s.id),
      // 定番と穴場は重ねない
      secretWorthy: matchedIds.has(s.id) ? false : s.secretWorthy,
    })),
  };
}

/** AI が major を付け損ねたときのヒューリスティック（名所・近い・有名店っぽさ） */
function promoteMajorHeuristic(station: StationSeed): StationSeed {
  if (countMajor(station) === MAJOR_FACE_TOTAL) return station;
  const scored = station.spots.map((s) => {
    let score = 0;
    if (s.majorWorthy) score += 100;
    if (s.guide === "sight") score += 42;
    if (s.guide === "souvenir") score += 28;
    if (s.guide === "meal") score += 22;
    if (s.guide === "rest") score += 8;
    if (isNeighborhoodWorship(s.name, station.name)) score -= 80;
    else if (
      isGuidebookWorship(s.name, station.name) ||
      isOrdinaryPublicFace(s.name) ||
      /城|宮|本店|老舗|陵/.test(s.name)
    ) {
      score += 24;
    }
    score += Math.max(0, 22 - s.walkMinutes);
    if (s.secretWorthy) score -= 35;
    return { s, score };
  });
  scored.sort((a, b) => b.score - a.score || a.s.walkMinutes - b.s.walkMinutes);
  const picked: Spot[] = [];
  const isFood = (g?: string) => g === "meal" || g === "souvenir";
  for (const row of scored) {
    if (picked.length >= MAJOR_SIGHT_TARGET) break;
    if (isFood(row.s.guide)) continue;
    if (!picked.some((p) => p.id === row.s.id)) picked.push(row.s);
  }
  for (const row of scored) {
    if (picked.filter((p) => isFood(p.guide)).length >= MAJOR_FOOD_TARGET) break;
    if (!isFood(row.s.guide)) continue;
    if (!picked.some((p) => p.id === row.s.id)) picked.push(row.s);
  }
  for (const row of scored) {
    if (picked.length >= MAJOR_FACE_TOTAL) break;
    if (!picked.some((p) => p.id === row.s.id)) picked.push(row.s);
  }
  const ids = new Set(picked.slice(0, MAJOR_FACE_TOTAL).map((p) => p.id));
  return {
    ...station,
    spots: station.spots.map((s) => ({
      ...s,
      majorWorthy: ids.has(s.id),
      secretWorthy: ids.has(s.id) ? false : s.secretWorthy,
    })),
  };
}

/**
 * どの駅でも「ガイドブック級のメジャーどころ」を必ず足す。
 * - landmarks: 一番有名な名所・景色（合計5の名所側）
 * - omiyage: 手土産になる名物菓子・名産（名物側）
 */
/** 出町柳のレンタは CLEW（クルー）とえむじかを正式名で残す。総称行は落とす。 */
function sealDemachiBikeRentals(station: StationSeed): StationSeed {
  if (!/出町柳/.test(station.name)) return station;
  const must = [
    {
      kind: "app" as const,
      name: "CLEW（クルー）京阪出町柳駅前",
      walkMinutes: 1,
      note: "京阪7番出口付近のポート。アプリ登録のあとQRで解錠。",
    },
    {
      kind: "local" as const,
      name: "レンタサイクルえむじか 出町柳店",
      walkMinutes: 2,
      note: "駅すぐの店頭貸出。半日〜長期向き。",
    },
  ];
  const generics = /駅前のレンタ|枡形・駅前のレンタ|周辺のレンタ|貸自転車$/;
  let places = [...(station.bikeRental?.places ?? [])].filter(
    (p) => !generics.test(p.name),
  );
  for (const m of must) {
    if (
      !places.some(
        (p) =>
          p.name.includes("CLEW") ||
          p.name.includes("クルー") ||
          p.name.includes("えむじか") ||
          p.name === m.name,
      ) ||
      (m.name.includes("CLEW") &&
        !places.some((p) => /CLEW|クルー|CREW/i.test(p.name))) ||
      (m.name.includes("えむじか") &&
        !places.some((p) => p.name.includes("えむじか")))
    ) {
      // 系統ごとに不足分だけ足す
    }
  }
  if (!places.some((p) => /CLEW|クルー|CREW/i.test(p.name))) {
    places.push(must[0]!);
  }
  if (!places.some((p) => p.name.includes("えむじか"))) {
    places.push(must[1]!);
  }
  // 重複整理
  const seen = new Set<string>();
  places = places.filter((p) => {
    const key = /CLEW|クルー|CREW/i.test(p.name)
      ? "clew"
      : p.name.includes("えむじか")
        ? "emusica"
        : p.name;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return {
    ...station,
    bikeRental: {
      available: true,
      summary:
        "駅すぐには CLEW（クルー）のポートと、店頭貸出のえむじかがあります。短い移動はアプリ、半日たっぷりなら店頭が向きます。",
      places,
    },
  };
}

/**
 * ご飯タブ用: 土地の定番めし（パン・おにぎり・商店街食堂など）を確保。
 * 近い無名カフェで埋めない。
 */
async function ensureStapleMealEntries(
  station: StationSeed,
  apiKey: string,
  viewerSub: string,
): Promise<StationSeed> {
  const catalog = station.spots
    .filter((s) => s.guide === "meal")
    .map((s) => `- ${s.name}（徒歩${s.walkMinutes}分）`)
    .join("\n");
  const prompt = [
    "あなたは日本の駅の徒歩圏案内の編集者です。Google検索で実在を確認してください。",
    "どの駅でも同じ基準で「定番めし」を出してください。穴場カフェ優先は禁止。",
    "",
    "必ず返すもの:",
    "stapleMeals ちょうど3〜4件 … その駅名と結びついて、地元・旅人が『ここで食べる』と言う定番。",
    "名前は必ず正式屋号。「業態だけ」（例: おにぎり屋）禁止。「屋号＋業態」（例: お米自慢 おにぎり屋さん）にする。",
    "優先ジャンル: 地元パン屋、おにぎり、商店街の食堂、うどん、そば、定食、昔からの一軒。",
    "禁止: 多目的カフェ、コワーキング併設、知る・感じる系の屋号、土地と結びつかない新しいカフェ、曖昧な業態名のみ。",
    "",
    "例:",
    "- 出町柳: 進々堂 京大北門前, お米自慢 おにぎり屋さん, 満寿形屋",
    "- 出町柳のおにぎりは『お米自慢 おにぎり屋さん』のみ。おにぎり利次郎など他店は出さない。メジャー人気店だけ。",
    "- 鎌倉: 小町通りの定番めし（実在店名）",
    "- 宇治: 抹茶・甘味の定番とは別に、腹ごしらえの定番食堂・麺があれば入れる",
    "",
    "一覧にあれば正式名を使い、無ければ実在の定番を新たに出す。",
    "guide は必ず meal。出力は JSON のみ:",
    "{",
    '  "stapleMeals": [ { "name", "guide":"meal", "genre":"gourmet", "mealTier":"casual", "mealTimes":["morning"|"lunch"|"dinner"], "soloOk":true, "budgetYen", "blurb", "detail", "walkMinutes", "lat", "lng", "hours" } ]',
    "}",
    "3〜4件。確認できない店は無理に埋めない。",
    "",
    `駅: ${station.name}（${station.prefecture} · ${station.line}）`,
    `駅座標目安: ${station.lat}, ${station.lng}`,
    "いまのご飯一覧（参考）:",
    catalog || "（なし）",
  ].join("\n");

  const result = await callGeminiGenerate(
    apiKey,
    viewerSub,
    {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      tools: [{ google_search: {} }],
      generationConfig: { temperature: 0.25, maxOutputTokens: 3072 },
    },
    GEMINI_EXPAND_MS,
  );
  if (!result.ok) return station;
  const parsed = extractJsonObject(result.text);
  if (!parsed) return station;
  const rawMeals = Array.isArray(parsed.stapleMeals)
    ? parsed.stapleMeals
    : Array.isArray(parsed.meals)
      ? parsed.meals
      : [];
  if (rawMeals.length === 0) return station;

  let next = station;
  let addIndex = next.spots.length;
  for (const raw of rawMeals.slice(0, 4)) {
    const forced =
      raw && typeof raw === "object"
        ? { ...(raw as Record<string, unknown>), guide: "meal" }
        : raw;
    const parsedSpot = parseSpot(forced, addIndex++);
    if (!parsedSpot) continue;
    const soft =
      /多目的|つながる|知る、感じる|コワーキング|レンタルスペース/.test(
        `${parsedSpot.name}${parsedSpot.blurb ?? ""}`,
      );
    if (soft) continue;
    const existing =
      next.spots.find((s) => s.name === parsedSpot.name) ||
      next.spots.find(
        (s) =>
          s.name.includes(parsedSpot.name) || parsedSpot.name.includes(s.name),
      );
    if (existing) {
      next = {
        ...next,
        spots: next.spots.map((s) =>
          s.id === existing.id
            ? {
                ...s,
                guide: "meal",
                blurb: s.blurb || parsedSpot.blurb,
                detail: s.detail || parsedSpot.detail,
                walkMinutes: Math.min(s.walkMinutes, parsedSpot.walkMinutes),
                lat: parsedSpot.lat ?? s.lat,
                lng: parsedSpot.lng ?? s.lng,
                hours: parsedSpot.hours || s.hours,
              }
            : s,
        ),
      };
    } else {
      next = {
        ...next,
        spots: [
          ...next.spots,
          {
            ...parsedSpot,
            id: `ai-staple-meal-${addIndex}`,
            guide: "meal",
            majorWorthy: false,
            secretWorthy: false,
          },
        ],
      };
    }
  }
  return next;
}

async function ensureMajorSpotEntries(
  station: StationSeed,
  apiKey: string,
  viewerSub: string,
): Promise<StationSeed> {
  const catalog = station.spots
    .map((s) => `- ${s.name}（${s.guide ?? "?"} / 徒歩${s.walkMinutes}分）`)
    .join("\n");
  const prompt = [
    "あなたは日本の駅の徒歩圏案内の編集者です。Google検索で実在を確認してください。",
    "どの駅でも同じ基準で「メジャーどころ」を出してください。穴場・マニア向けは禁止。",
    "",
    "必ず返すもの:",
    "1) landmarks ちょうど3件 … その駅でいちばん有名な観光名所・景色（名社寺・川の合流・橋・商店街・城・市場の顔など）。近所の無名な寺・脇社・小さな祠・マイナー店は禁止。",
    "2) omiyage ちょうど2件 … 手土産になる名物（菓子・銘菓・土地の顔になる甘いお土産を優先）。一般の漬物屋・鰹節屋・雑貨より、ガイドブックに載る名物菓子を優先。",
    "",
    "例:",
    "- 出町柳: landmarks=下鴨神社（賀茂御祖神社）, 鴨川デルタ / omiyage=出町ふたば, 加茂みたらし茶屋",
    "- 鎌倉: landmarks=鶴岡八幡宮, 小町大路まわりの顔になる名所 / omiyage=鳩サブレーで有名な店, 他の銘菓",
    "- 宇治: landmarks=平等院, 宇治橋まわりの顔 / omiyage=抹茶菓子の名店",
    "",
    "一覧にあれば正式名を使い、無ければ実在の定番を新たに出す。",
    "landmarks の guide は sight。omiyage の guide は必ず souvenir（meal にしない）。",
    "出力は JSON のみ:",
    "{",
    '  "landmarks": [ { "name", "guide":"sight", "genre", "blurb", "detail", "walkMinutes", "lat", "lng", "hours" } ],',
    '  "omiyage": [ { "name", "guide":"souvenir", "genre":"gourmet", "blurb", "detail", "walkMinutes", "lat", "lng", "hours", "budgetYen" } ]',
    "}",
    "landmarks は2件、omiyage は2件。足りない場合は無理に埋めず実在だけ。",
    "",
    `駅: ${station.name}（${station.prefecture} · ${station.line}）`,
    `駅座標目安: ${station.lat}, ${station.lng}`,
    "いまの一覧（参考・不足なら追加してよい）:",
    catalog || "（なし）",
  ].join("\n");

  const result = await callGeminiGenerate(
    apiKey,
    viewerSub,
    {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      tools: [{ google_search: {} }],
      generationConfig: { temperature: 0.25, maxOutputTokens: 4096 },
    },
    GEMINI_EXPAND_MS,
  );

  if (!result.ok) return promoteMajorHeuristic(station);
  const parsed = extractJsonObject(result.text);
  if (!parsed) return promoteMajorHeuristic(station);

  const rawLandmarks = Array.isArray(parsed.landmarks)
    ? parsed.landmarks
    : Array.isArray(parsed.spots)
      ? parsed.spots.slice(0, 2)
      : [];
  const rawOmiyage = Array.isArray(parsed.omiyage) ? parsed.omiyage : [];

  if (rawLandmarks.length === 0 && rawOmiyage.length === 0) {
    return promoteMajorHeuristic(station);
  }

  let next: StationSeed = {
    ...station,
    spots: station.spots.map((s) => ({ ...s, majorWorthy: false })),
  };
  const majorIds: string[] = [];
  let addIndex = next.spots.length;

  const upsertIcon = (
    raw: unknown,
    opts: { forceGuide?: GuideKind; idPrefix: string; asMajor: boolean },
  ) => {
    const forced =
      raw && typeof raw === "object"
        ? { ...(raw as Record<string, unknown>), guide: opts.forceGuide ?? (raw as Record<string, unknown>).guide }
        : raw;
    const parsedSpot = parseSpot(forced, addIndex++);
    if (!parsedSpot) return;
    const spot: Spot = {
      ...parsedSpot,
      guide: opts.forceGuide ?? parsedSpot.guide,
      secretWorthy: false,
    };
    const existing =
      next.spots.find((s) => s.name === spot.name) ||
      next.spots.find(
        (s) => s.name.includes(spot.name) || spot.name.includes(s.name),
      );
    if (existing) {
      next = {
        ...next,
        spots: next.spots.map((s) =>
          s.id === existing.id
            ? {
                ...s,
                guide: opts.forceGuide ?? s.guide,
                majorWorthy: opts.asMajor || s.majorWorthy,
                secretWorthy: false,
                blurb: s.blurb || spot.blurb,
                detail: s.detail || spot.detail,
                walkMinutes: Math.min(s.walkMinutes, spot.walkMinutes),
                lat: spot.lat ?? s.lat,
                lng: spot.lng ?? s.lng,
              }
            : s,
        ),
      };
      if (opts.asMajor) majorIds.push(existing.id);
    } else {
      const added: Spot = {
        ...spot,
        id: `${opts.idPrefix}-${addIndex}`,
        majorWorthy: opts.asMajor,
      };
      next = { ...next, spots: [...next.spots, added] };
      if (opts.asMajor) majorIds.push(added.id);
    }
  };

  // 名所・景色 + 名物 = 合計5の材料
  for (let i = 0; i < Math.min(MAJOR_SIGHT_TARGET, rawLandmarks.length); i++) {
    upsertIcon(rawLandmarks[i], {
      forceGuide: "sight",
      idPrefix: "ai-landmark",
      asMajor: true,
    });
  }
  for (let i = 0; i < Math.min(MAJOR_FOOD_TARGET, rawOmiyage.length); i++) {
    upsertIcon(rawOmiyage[i], {
      forceGuide: "souvenir",
      idPrefix: "ai-omiyage",
      asMajor: true,
    });
  }

  if (majorIds.length >= 2) {
    const idSet = new Set(majorIds.slice(0, MAJOR_FACE_TOTAL));
    next = {
      ...next,
      spots: next.spots.map((s) => ({
        ...s,
        majorWorthy: idSet.has(s.id),
        secretWorthy: idSet.has(s.id) ? false : s.secretWorthy,
      })),
    };
    return sealIconicMajors(next);
  }

  return sealIconicMajors(promoteMajorHeuristic(next));
}

const ICONIC_SHOP_RE =
  /ふたば|みたらし|だんご|団子|最中|羊羹|カステラ|たい焼|人形焼|もみじ饅頭|赤福|治一郎|千鳥屋|亀屋|老舗/;

/**
 * メジャーに「一般土産」が入り名物店が外れたとき、名物店を押し込む。
 * 例: 出町柳で野呂本店が major になり出町ふたばが落ちる、を防ぐ。
 */
function sealIconicMajors(station: StationSeed): StationSeed {
  let working = station;
  // 出町柳は豆餅のふたばをスポット自体として必ず持たせる
  if (
    /出町柳/.test(working.name) &&
    !working.spots.some((s) => s.name.includes("ふたば"))
  ) {
    working = {
      ...working,
      spots: [
        ...working.spots,
        {
          id: "ai-major-futaba",
          name: "出町ふたば",
          genre: "gourmet",
          guide: "souvenir",
          mealTier: "casual",
          mealTimes: ["morning", "lunch"],
          soloOk: true,
          budgetYen: "〜¥800",
          hours: "8:30〜17:30（売切次第終了・火曜定休の場合あり）",
          blurb:
            "出町の顔といえば豆餅。並んでも買う人が絶えない甘味で、駅からの帰りに手土産にもなる。",
          detail:
            "河合橋のたもと近く。朝から昼にかけて行列ができやすいので、歩きの序盤か終盤に寄せるとよい。",
          x: 0.45,
          y: 0.4,
          walkMinutes: 3,
          majorWorthy: true,
          secretWorthy: false,
          lat: 35.03011,
          lng: 135.76963,
        },
      ],
    };
  }

  const bare = working.name.replace(/駅$/u, "").trim();
  const shops = working.spots.filter(
    (s) => s.guide === "meal" || s.guide === "souvenir",
  );
  const iconic =
    shops.find((s) => ICONIC_SHOP_RE.test(`${s.name}${s.blurb ?? ""}`)) ||
    shops.find(
      (s) => bare.length >= 2 && s.name.includes(bare) && s.guide === "meal",
    ) ||
    shops.find(
      (s) =>
        bare.length >= 2 &&
        s.name.includes(bare) &&
        (s.guide === "souvenir" || s.guide === "meal"),
    ) ||
    null;

  // 出町柳は豆餅のふたばを欠かさない
  const demachiFutaba = /出町柳/.test(working.name)
    ? working.spots.find((s) => s.name.includes("ふたば"))
    : null;
  const must = demachiFutaba || iconic;
  if (!must) return working;
  station = working; // continue with enriched station

  const majors = station.spots.filter((s) => s.majorWorthy);
  if (majors.some((m) => m.id === must.id)) {
    // 余分な一般土産 major を外し、合計5件に整える
    return trimMajorsToLimit(station, must.id);
  }

  const drop =
    majors.find(
      (m) =>
        (m.guide === "souvenir" || m.guide === "meal") &&
        m.id !== must.id &&
        !ICONIC_SHOP_RE.test(m.name) &&
        !/神社|寺|デルタ|城|宮/.test(m.name),
    ) ||
    majors.find(
      (m) =>
        m.guide === "souvenir" &&
        m.id !== must.id &&
        !ICONIC_SHOP_RE.test(m.name),
    ) ||
    majors
      .filter((m) => !/神社|寺|デルタ|城|宮/.test(m.name))
      .sort((a, b) => b.walkMinutes - a.walkMinutes)[0] ||
    null;

  const nextIds = new Set(
    majors.filter((m) => !drop || m.id !== drop.id).map((m) => m.id),
  );
  nextIds.add(must.id);
  while (nextIds.size > MAJOR_FACE_TOTAL) {
    const removable = [...nextIds].find((id) => id !== must.id);
    if (!removable) break;
    nextIds.delete(removable);
  }

  return {
    ...station,
    spots: station.spots.map((s) => ({
      ...s,
      majorWorthy: nextIds.has(s.id),
      secretWorthy: nextIds.has(s.id) ? false : s.secretWorthy,
    })),
  };
}

function trimMajorsToLimit(
  station: StationSeed,
  keepShopId: string,
): StationSeed {
  const majors = station.spots.filter((s) => s.majorWorthy);
  if (
    majors.length <= MAJOR_FACE_TOTAL &&
    majors.some((m) => m.id === keepShopId)
  ) {
    return station;
  }
  const keep: Spot[] = [];
  const shop = majors.find((m) => m.id === keepShopId);
  if (shop) keep.push(shop);
  for (const m of majors
    .filter((m) => /神社|寺|デルタ|城|宮/.test(m.name))
    .sort((a, b) => a.walkMinutes - b.walkMinutes)) {
    if (keep.length >= MAJOR_FACE_TOTAL) break;
    if (!keep.some((k) => k.id === m.id)) keep.push(m);
  }
  for (const m of majors.sort((a, b) => a.walkMinutes - b.walkMinutes)) {
    if (keep.length >= MAJOR_FACE_TOTAL) break;
    if (!keep.some((k) => k.id === m.id)) keep.push(m);
  }
  const ids = new Set(keep.slice(0, MAJOR_FACE_TOTAL).map((k) => k.id));
  return {
    ...station,
    spots: station.spots.map((s) => ({
      ...s,
      majorWorthy: ids.has(s.id),
      secretWorthy: ids.has(s.id) ? false : s.secretWorthy,
    })),
  };
}

/** 土地文に書いた名前から地図・案内の spots を起こす。 */
async function expandPlacesFromLand(
  station: StationSeed,
  apiKey: string,
  viewerSub: string,
): Promise<StationSeed> {
  if ((station.spots?.length ?? 0) >= 12) return station;

  const expanded = await callGeminiGenerate(
    apiKey,
    viewerSub,
    {
      contents: [
        {
          role: "user",
          parts: [{ text: buildPlacesFromLandPrompt(station) }],
        },
      ],
      tools: [{ google_search: {} }],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 8192,
      },
    },
    GEMINI_GROUNDED_MS,
  );
  if (!expanded.ok) {
    // グラウンディング失敗時は JSON 専用でもう一度
    const fast = await callGeminiGenerate(
      apiKey,
      viewerSub,
      {
        contents: [
          {
            role: "user",
            parts: [{ text: buildPlacesFromLandPrompt(station) }],
          },
        ],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 8192,
          responseMimeType: "application/json",
        },
      },
      GEMINI_FAST_MS,
    );
    if (!fast.ok) return station;
    return mergePlacesFromLandText(station, fast.text);
  }
  return mergePlacesFromLandText(station, expanded.text);
}

function mergePlacesFromLandText(
  station: StationSeed,
  text: string,
): StationSeed {
  const parsed = extractJsonObject(text);
  if (!parsed || !Array.isArray(parsed.spots)) return station;
  const extras = parsed.spots
    .map((raw, i) => parseSpot(raw, (station.spots?.length ?? 0) + i))
    .filter((s): s is Spot => !!s)
    .filter((s) => !isForeignDemachiPlace(s.name, station.name));
  if (!extras.length) return station;

  const existing = [...(station.spots ?? [])];
  const names = new Set(existing.map((s) => s.name));
  for (const spot of extras) {
    if (names.has(spot.name)) continue;
    names.add(spot.name);
    existing.push(spot);
  }
  return { ...station, spots: existing.slice(0, 22) };
}

async function finalizeAiStation(
  result: AiStationResult | { error: string; message: string },
  apiKey: string,
  viewerSub: string,
): Promise<AiStationResult | { error: string; message: string }> {
  if ("error" in result) return result;

  // 1) 土地の文章を厚くする（正本）
  let station = await expandStationNarrative(
    result.station,
    apiKey,
    viewerSub,
  );
  // 収録ノート（二ノ瀬・出町など）があれば土地文を正本で上書き
  station = withAreaDepth(station);
  station = refineLandProse(ensureLandPresentAnchors(station));

  // 2) 土地文に出た名前から場所を起こす（地図・案内の正本）
  station = ensureLandMentions(station);
  station = await expandPlacesFromLand(station, apiKey, viewerSub);
  if ((station.spots?.length ?? 0) < 3) {
    return {
      error: "empty_spots",
      message: "案内スポットを作れませんでした。別の駅名で試してください。",
    };
  }

  // 3) ご飯・土産など実用の店を足す（土地文の生活感に沿う）
  station = await expandShopSpots(station, apiKey, viewerSub);
  const shopsBeforeFar = station;
  station = filterFarSpots(station);
  station = ensureShopGuideFloor(station, shopsBeforeFar);
  if (isShopThin(station)) {
    station = await expandShopSpots(station, apiKey, viewerSub);
    const beforeFar2 = station;
    station = filterFarSpots(station);
    station = ensureShopGuideFloor(station, beforeFar2);
  }
  station = await ensureStapleMealEntries(station, apiKey, viewerSub);
  station = sealDemachiBikeRentals(station);
  station = await ensureMajorSpotEntries(station, apiKey, viewerSub);
  station = sealIconicMajors(station);
  station = balanceMajorsSightseeing(station);
  station = normalizeEdibleSouvenirs(station);
  if (countGuide(station, "meal") < MIN_MEAL_SPOTS) {
    station = await expandShopSpots(station, apiKey, viewerSub);
    const beforeFar3 = station;
    station = filterFarSpots(station);
    station = ensureShopGuideFloor(station, beforeFar3);
    station = normalizeEdibleSouvenirs(station);
    if (countGuide(station, "meal") < MIN_MEAL_SPOTS) {
      station = ensureShopGuideFloor(station, beforeFar3);
    }
  }
  station = reclassifyWorshipPlaces(station);
  station = {
    ...station,
    spots: filterFirstVisitSpots(station.spots, station.name),
  };
  station = await expandRestSpots(station, apiKey, viewerSub);
  station = snapLandmarkCoordinates(station);
  station = balanceMajorsSightseeing(station);
  // 土地文をもう一度アンカー仕訳（名所名を落とさない）
  station = refineLandProse(ensureLandPresentAnchors(station));
  station = snapLandmarkCoordinates(station);
  return { station, source: "ai" };
}

/** 正本は data/landmark-locks.json（住所 + OSM／Apple 店舗ノード）。AI 仮座標は捨てる。 */
type LandmarkLock = {
  station: string;
  kind: string;
  keywords: string[];
  canonical?: string;
  lat: number;
  lng: number;
  walkMinutes: number;
};

function lockMatches(name: string, lock: LandmarkLock): boolean {
  if (lock.kind === "river") {
    const river =
      /デルタ|河川敷|三角州/.test(name) || (/鴨川/.test(name) && /川端|川沿い/.test(name));
    return river && !/カフェ|茶房|ふたば/.test(name) && !name.endsWith("店");
  }
  return lock.keywords.some((k) => name.includes(k));
}

function isLockedSpot(name: string, stationName: string): boolean {
  return (landmarkLocks.locks as LandmarkLock[]).some(
    (p) => stationName.includes(p.station) && lockMatches(name, p),
  );
}

/**
 * 座標の正本: ロック → 駅直上の未確定仮ピン座標は捨てる（スポットは案内用に残す）。
 * 地図に出るのは lock / Apple のみ（sealMapCoordinates + mapTrustedSpots）。
 */
function snapLandmarkCoordinates(station: StationSeed): StationSeed {
  return sealMapCoordinates(station);
}

const EDIBLE_OMIYAGE_RE =
  /ふたば|みたらし|だんご|団子|豆餅|阿闍梨|最中|羊羹|もみじ饅頭|赤福|サブレ|カステラ|饅頭|もなか|最中|大福|羊羹|銘菓/;

function isWorshipPlaceName(name: string): boolean {
  if (/茶屋|茶房|食堂|本店|店$/.test(name)) return false;
  return /(寺|神社|神宮|大社|寺院)$/.test(name);
}

/** 寺社がお土産・ご飯に入っていたら観光へ戻す */
function reclassifyWorshipPlaces(station: StationSeed): StationSeed {
  const spots = station.spots.map((s) => {
    if ((s.guide === "souvenir" || s.guide === "meal") && isWorshipPlaceName(s.name)) {
      return { ...s, guide: "sight" as const };
    }
    return s;
  });
  return { ...station, spots };
}

function isEdibleOmiyage(spot: Spot): boolean {
  // 店名だけ。blurb の「銘菓」「饅頭」まで拾うと定食屋が土産に化け、ご飯が3件前後に減る
  return EDIBLE_OMIYAGE_RE.test(spot.name);
}

/** 名物菓子・銘菓を souvenir に寄せる（どの駅でも）。喫茶は休むところへ。 */
function normalizeEdibleSouvenirs(station: StationSeed): StationSeed {
  const spots: Spot[] = station.spots.map((s) => {
    if (isSitDownCafeName(s.name) && (s.guide === "meal" || s.guide === "tip")) {
      return { ...s, guide: "rest" as const, genre: "nature", majorWorthy: false };
    }
    // 銘菓だけ souvenir へ。majorWorthy の定食・食堂は meal のまま（ご飯や最低5件を守る）
    if (s.guide === "meal" && isEdibleOmiyage(s)) {
      return { ...s, guide: "souvenir" as const };
    }
    return s;
  });
  return { ...station, spots };
}

function landmarkFameScore(spot: Spot, stationName?: string): number {
  const n = spot.name;
  const blob = `${n}${spot.blurb ?? ""}`;
  let score = 0;
  if (spot.majorWorthy) score += 40;
  if (spot.guide === "sight") score += 8;
  if (isGuidebookWorship(n, stationName)) score += 55;
  if (/デルタ|三角州/.test(n)) score += 70;
  if (isOrdinaryPublicFace(n) || /合流/.test(n)) score += 45;
  if (/城|金閣|清水|浅草/.test(n)) score += 35;
  if (/世界遺産/.test(blob)) score += 20;
  if (/城跡|復元|参道|楼門/.test(n)) score -= 20;
  if (isNeighborhoodWorship(n, stationName)) score -= 80;
  if (/幸神社|境内社|摂社/.test(n)) score -= 60;
  score += Math.max(0, 8 - spot.walkMinutes * 0.2);
  return score;
}

function sealDemachiMustFaces(station: StationSeed): StationSeed {
  if (!/出町柳/.test(station.name)) return station;
  let spots = [...station.spots];
  if (!spots.some((s) => /デルタ|三角州/.test(s.name))) {
    spots.push({
      id: "lock-demachi-delta",
      name: "鴨川デルタ",
      genre: "history",
      guide: "rest",
      blurb: "鴨川と高野川の合流。飛び石が並び、多くの人が川辺で憩う町の顔。",
      detail: "鴨川と高野川の合流（鴨川デルタ）",
      walkMinutes: 3,
      x: 0.42,
      y: 0.55,
      majorWorthy: true,
      secretWorthy: false,
      lat: 35.0301227,
      lng: 135.7717415,
    });
  } else {
    spots = spots.map((s) => {
      if (!/デルタ|三角州/.test(s.name)) return s;
      return {
        ...s,
        name: s.name.includes("鴨川") ? s.name : "鴨川デルタ",
        majorWorthy: true,
        walkMinutes: Math.min(s.walkMinutes, 5),
        lat: 35.0301227,
        lng: 135.7717415,
      };
    });
  }
  if (!spots.some((s) => /下鴨|賀茂御祖/.test(s.name))) {
    spots.push({
      id: "ai-major-shimogamo",
      name: "下鴨神社（賀茂御祖神社）",
      genre: "history",
      guide: "sight",
      blurb: "世界遺産の社。糺の森を抜けて本殿へ。出町柳の顔になる名所。",
      detail: "駅から北東へ。デルタを経由すると道がわかりやすい。",
      hours: "6:30〜17:00（季節により変動）",
      walkMinutes: 12,
      x: 0.55,
      y: 0.35,
      majorWorthy: true,
      secretWorthy: false,
      lat: 35.0387,
      lng: 135.7727,
    });
  }
  return { ...station, spots };
}

/** major を観光2＋名物1に整える（ベタな名所優先。小社で埋めない） */
function balanceMajorsSightseeing(station: StationSeed): StationSeed {
  let working = sealDemachiMustFaces(station);

  working = {
    ...working,
    spots: filterFirstVisitSpots(working.spots, working.name),
  };

  const majors = working.spots.filter((s) => s.majorWorthy);
  const isFood = (s: Spot) => s.guide === "meal" || s.guide === "souvenir";
  const isSightish = (s: Spot) =>
    s.guide === "sight" ||
    s.guide === "rest" ||
    isGuidebookWorship(s.name, working.name) ||
    isOrdinaryPublicFace(s.name) ||
    /城|宮|デルタ/.test(s.name);

  const landmarkPool = [...majors, ...working.spots]
    .filter(isSightish)
    .filter((s) => !isNeighborhoodWorship(s.name, working.name))
    .filter((s) => !/幸神社/.test(s.name))
    .reduce<Spot[]>((acc, s) => {
      if (!acc.some((x) => x.id === s.id)) acc.push(s);
      return acc;
    }, [])
    .sort(
      (a, b) =>
        landmarkFameScore(b, working.name) - landmarkFameScore(a, working.name),
    );

  const foodMajors = majors.filter(isFood);
  const iconicFood =
    working.spots.find((s) => s.name.includes("ふたば")) ||
    foodMajors.find((s) => ICONIC_SHOP_RE.test(`${s.name}${s.blurb ?? ""}`)) ||
    foodMajors[0] ||
    null;

  // 出町柳は鴨川デルタ＋下鴨を名所枠に優先。合計5（名所3＋名物2目安）
  const keep: Spot[] = [];
  const isSoftCafe = (s: Spot) =>
    /多目的|つながる|知る、感じる|コワーキング|レンタルスペース/.test(
      `${s.name}${s.blurb ?? ""}`,
    );
  if (/出町柳/.test(working.name)) {
    const delta = landmarkPool.find((s) => /デルタ|三角州/.test(s.name));
    const shrine = landmarkPool.find((s) => /下鴨|賀茂御祖/.test(s.name));
    if (delta) keep.push(delta);
    if (shrine && !keep.some((k) => k.id === shrine.id)) keep.push(shrine);
  }
  for (const s of landmarkPool) {
    if (keep.length >= MAJOR_SIGHT_TARGET) break;
    if (isSoftCafe(s)) continue;
    if (/城跡|復元|参道|楼門/.test(s.name)) continue;
    if (!keep.some((k) => k.id === s.id)) keep.push(s);
  }
  for (const s of landmarkPool) {
    if (keep.length >= MAJOR_SIGHT_TARGET) break;
    if (isSoftCafe(s)) continue;
    if (!keep.some((k) => k.id === s.id)) keep.push(s);
  }
  const foodPool = [
    ...(iconicFood ? [iconicFood] : []),
    ...foodMajors,
    ...working.spots.filter(isFood),
  ].filter((s, i, arr) => arr.findIndex((x) => x.id === s.id) === i);
  let foodAdded = 0;
  for (const food of foodPool) {
    if (foodAdded >= MAJOR_FOOD_TARGET || keep.length >= MAJOR_FACE_TOTAL) break;
    if (isSoftCafe(food)) continue;
    if (!keep.some((k) => k.id === food.id)) {
      keep.push(food);
      foodAdded += 1;
    }
  }
  for (const s of landmarkPool) {
    if (keep.length >= MAJOR_FACE_TOTAL) break;
    if (isSoftCafe(s)) continue;
    if (!keep.some((k) => k.id === s.id)) keep.push(s);
  }

  const ids = new Set(keep.slice(0, MAJOR_FACE_TOTAL).map((k) => k.id));
  if (ids.size === 0) return working;
  return {
    ...working,
    spots: working.spots.map((s) => ({
      ...s,
      majorWorthy: ids.has(s.id),
      secretWorthy: ids.has(s.id) ? false : s.secretWorthy,
    })),
  };
}

async function generateFromPrompt(
  prompt: string,
  fallbackName: string,
  apiKey: string,
  viewerSub: string,
): Promise<AiStationResult | { error: string; message: string }> {
  const contents = [{ role: "user", parts: [{ text: prompt }] }];

  // 実在店・名所の精度を上げるため、Google検索グラウンディングを先に使う。
  const grounded = await callGeminiGenerate(
    apiKey,
    viewerSub,
    {
      contents,
      tools: [{ google_search: {} }],
      generationConfig: {
        temperature: 0.45,
        maxOutputTokens: 8192,
      },
    },
    GEMINI_GROUNDED_MS,
  );

  if (grounded.ok) {
    const parsed = stationFromGeminiText(grounded.text, fallbackName);
    if (!("error" in parsed)) {
      return finalizeAiStation(parsed, apiKey, viewerSub);
    }
    if (parsed.error === "not_a_station") return parsed;
  } else if (grounded.error === "gemini_http") {
    return { error: grounded.error, message: grounded.message };
  }

  // グラウンディングが空／壊れたときだけ、JSON専用の速い経路へ。
  const fast = await callGeminiGenerate(
    apiKey,
    viewerSub,
    {
      contents,
      generationConfig: {
        temperature: 0.45,
        maxOutputTokens: 8192,
        responseMimeType: "application/json",
      },
    },
    GEMINI_FAST_MS,
  );

  if (!fast.ok) {
    return grounded.ok
      ? finalizeAiStation(
          stationFromGeminiText(grounded.text, fallbackName),
          apiKey,
          viewerSub,
        )
      : { error: fast.error, message: fast.message };
  }
  return finalizeAiStation(
    stationFromGeminiText(fast.text, fallbackName),
    apiKey,
    viewerSub,
  );
}

export async function generateStationGuideWithGemini(
  rawName: string,
  apiKey: string,
  viewerSub: string,
): Promise<AiStationResult | { error: string; message: string }> {
  return generateFromPrompt(
    buildStationPrompt(rawName),
    rawName,
    apiKey,
    viewerSub,
  );
}

export async function generateNearbyStationWithGemini(
  lat: number,
  lng: number,
  apiKey: string,
  viewerSub: string,
): Promise<AiStationResult | { error: string; message: string }> {
  // Defensive: always send coarsened coords even if a caller forgot to fuzz.
  const coarse = fuzzLatLngForExternal(lat, lng);
  return generateFromPrompt(
    buildNearbyPrompt(coarse.lat, coarse.lng),
    `現在地(${coarse.lat.toFixed(2)},${coarse.lng.toFixed(2)})`,
    apiKey,
    viewerSub,
  );
}
