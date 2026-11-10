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
import {
  filterFirstVisitSpots,
  isGuidebookWorship,
  isNeighborhoodWorship,
  isOrdinaryPublicFace,
} from "@/lib/mishiranu-first-visit-faces";

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent";

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
  '  "stationIntro": "観光案内の導入。必ず5〜8文・合計220字以上。地名の由来・路線の接続・駅前の空気・半日と1時間の両方の見え方を含める",',
  '  "areaAbout": "界隈の説明。必ず空行区切りの2段落。各段落4文以上・合計360字以上。地形・歴史・いまの生活の匂いを混ぜる",',
  '  "walkGuide": "徒歩圏の回り方。必ず5〜7文・160字以上。出方・方角・時間があるとき／短いときの分岐を書く",',
  '  "tourTitle": "28字以内",',
  '  "catchCopy": "40字以内",',
  '  "emptyHeadline": "emptyのときだけ20字以内",',
  '  "emptyBody": "emptyのときだけ80字以内",',
  '  "bikeRental": { "available": boolean, "summary": "2〜3文。地元店とアプリ型の両方に触れる", "places": [ { "kind": "local|app", "name": "実在サービス・店の正式名", "walkMinutes": 5, "note": "使い方1文" } ] },',
  "- bikeRental.places の name は総称禁止（「駅前のレンタサイクル店」不可）。CLEW/クルー、HELLO CYCLING、えむじか など実在名。",
  "- 例（出町柳）: CLEW（クルー）京阪出町柳駅前（app）、レンタサイクルえむじか 出町柳店（local）。",
  '  "historyNotes": [{ "title": "短い見出し", "body": "歴史メモ。各3〜5文・80字以上" }]（必ず4〜6件。地名由来・産業/信仰・交通・災害や町の変遷など具体的に）,',
  '  "sightseeingNotes": [{ "title": "短い見出し", "body": "観光メモ。各2〜4文" }]（必ず3〜4件。まず見る/時間があるとき/食べる休む）,',
  '  "spots": [',
  "    {",
  '      "name": "場所名（meal/souvenir は実在店舗の正式名称）",',
  '      "genre": "history|gourmet|nature|odd",',
  '      "guide": "meal|souvenir|sight|rest|tip",',
  '      "mealTier": "casual|upscale（mealのみ）",',
  '      "mealTimes": ["morning|lunch|dinner"]（mealのみ・1つ以上）,',
  '      "soloOk": true|false（mealのみ。一人でも入りやすければ true。予約必須・個室・酒席向きは false）,',
  '      "budgetYen": "予算目安の短い表記。例 〜¥1,200 / ¥5,000〜（mealのみ）",',
  '      "hours": "何時から何時まで。例 10:00〜18:00（火曜定休）。屋外は終日（屋外）",',
  '      "blurb": "3〜4文。meal は店名・看板メニュー・味や席の気配。souvenir は店名・何が買えるか・誰への土産向き",',
  '      "detail": "3〜4文。行き方の目印、営業の注意、隣の寄り道との関係",',
  '      "walkMinutes": 1〜40の整数,',
  '      "lat": 緯度,',
  '      "lng": 経度,',
  '      "secretWorthy": boolean,',
  '      "majorWorthy": boolean（その駅の顔＝散歩中心でまず行く定番なら true。駅ごとにちょうど3件）',
  "    }",
  "  ]",
  "}",
  "",
  "制約:",
  "- 日本の実在の鉄道駅でなければ { \"error\": \"not_a_station\", \"message\": \"理由\" } を返す。",
  "- spots は 12〜18件。story のとき meal は必ず5〜7件（いずれも駅から徒歩18分以内）、souvenir は必ず3〜5件、sight/rest/tip は各2件以上。",
  "- sight は、初めて駅を降りた人が通るメジャーな普通のところだけ。川の合流・橋・商店街・港・市場・公園・ガイドブック級の名社寺。近所の無名な寺・小社は禁止。",
  "- sight に入れない例: 長徳寺・法性寺・西園寺のような、土地の顔ではない近所の寺。近いだけでは出さない。",
  "- rest は「腰を下ろして休む場所」を必ず2〜4件。内訳はAIが選ぶ。景色で座る場所（川の合流・三角州・公園・橋のたもと）を1件以上、長居できる喫茶を1件以上。食事目的の定食屋は meal のまま。寺社そのものは sight。",
  "- meal と souvenir の name は必ず実在する店・施設の正式名称（Google検索で確認できるものだけ）。",
  "- majorWorthy は駅ごとにちょうど3件だけ true。「初めてその駅に降りた人が必ず見るべき土地の顔」（ガイドブック1ページ目級）。",
  "- majorWorthy の内訳は必ず: 名所・景色・社寺 2件 + 名物店 1件。甘味屋を2件以上 major にしない。",
  "- majorWorthy の選び方: その駅名と結びついて誰もが挙げる場所。世界遺産・名社寺・川の合流・港・城・土地の銘菓を優先。",
  "- majorWorthy に入れない: 近所の無名カフェ、近所の無名な寺・小社、多目的スペース、コワーキング、知る・感じる系の屋号、近いだけの個人店。",
  "- 例（出町柳の考え方）: 下鴨神社・鴨川デルタ・出町ふたばが顔。長徳寺・法性寺・西園寺は出さない。みたらしをふたばと同時 major にしない。かぜのね等の近所カフェは major にしない。",
  "- 「近い」より「その土地の名前と結びついた有名どころ」。徒歩圏なら12〜15分の名社寺を、2分の無名寺・無名カフェより優先する。",
  "- secretWorthy は穴場向け。majorWorthy と同時 true にしない。",
  "- meal / souvenir は駅から徒歩18分以内（約1.3km）の店だけ。今出川・丸太町・銀閣寺エリアなど、駅名の土地ではない店は入れない。",
  "- meal は「その土地の定番めし」を先に入れる。優先: 地元パン屋・おにぎり・商店街の食堂・うどん・そば・定食。ジャンルを散らす。",
  "- meal に入れない優先順位の低いもの: 多目的カフェ、コワーキング併設、知る・感じる系の屋号、土地と結びつかない新しいカフェ。",
  "- 例（出町柳の考え方）: 進々堂・お米自慢 おにぎり屋さん・満寿形屋が定番。おにぎり利次郎・かぜのね等の二番手は出さない。メジャー人気店のみ。",
  "- souvenir は紙もの・菓子・珈琲豆・工芸など、物が買える店だけ。寺・神社・寺院は sight。souvenir に入れない。",
  "- 土地の名物菓子・手土産の甘味は guide を souvenir にする。meal だけに閉じない（どの駅でも同じ）。",
  "- souvenir には、その駅で一番有名な銘菓・甘い手土産を必ず1〜2件入れる。",
  "- 禁止の name: 「駅前の定食」「港寄りの食堂」「甘味・茶店まわり」「揚げもの屋台まわり」「駅前の景色」「町並みまわり」など総称・曖昧名。",
  "- meal の blurb/detail を短くしない。店名・料理・予算感・一人で入りやすさが伝わる分量。",
  "- souvenir の blurb/detail を短くしない。何が買えるか・包みの軽さ・駅からの帰りやすさ。",
  "- sight の blurb には地名と、そこで見る具体的な風景・建築・展示を入れる。",
  "- meal には必ず soloOk と budgetYen を入れる。一人席・カウンター・気軽な食堂は soloOk true。会席・要予約・酒席主体は false。",
  "- budgetYen は実際の一人あたり目安（税込ざっくり）。casual はだいたい 〜¥1,500、upscale は ¥3,000〜 を目安に具体化する。",
  "- 徒歩圏に焙煎所・珈琲専門店があり豆を売っているなら、souvenir（または tip）に1件入れ、name に店名、blurb に「豆が買える」と豆の特徴を書く。",
  "- コーヒー豆の店も総称禁止。実在のロースタリー／専門店名のみ。閉店済みの店は出さない。",
  "- Google検索で実在を確認できない店は出さない。わからないときは別の実在店に替える。",
  "- empty（本当に何も薄い駅）でも areaAbout と historyNotes は厚く書く（余白の歴史も含めてよい）。",
  "- hours はわかる範囲で具体的な開始〜終了。不明なら「要確認（目安 …）」と書く。夜に閉まる店（例 17:30終了）の mealTimes に dinner を付けない。",
  "- 駅から徒歩だいたい25分以内（約1.8km）の実在スポットだけ。それより遠い店・名所は絶対に入れない。",
  "- lat/lng は店・名所の本物の座標。駅の近くに適当に寄せない。わからない店は出さない。",
  "- 京都で有名でも、その駅の徒歩圏外なら出さない。座標を駅へ寄せて「近くに見せる」のは禁止。",
  "- 例の禁止: 「古書・茶房 ことばのはおと」は堀川・御所寄り。出町柳・下鴨の案内に入れない・デルタ座標に置かない。",
  "- 例の禁止: 「迷子」（喫茶・古本、浄土寺上南田町）は銀閣寺近く。出町柳の案内に入れない。座標を田中や今出川に寄せない。",
  "- 同様に、駅名と結びつきやすい有名店でも Google で「駅名＋店名＋徒歩」を確認し、届かない店は別の実在店に替える。",
  "- いちばん重要: stationIntro / areaAbout / historyNotes を短くしない。読者が歴史を知れる分量にする。",
  "- historyNotes の本文には、spots の sight と majorWorthy の場所を正式名称のまま登場させ、その場所で目で確かめられる痕跡（石碑・地名・川筋・社殿・古い看板など）を1文ずつ書く。歩く途中に、その一文だけを手渡すため。",
  "- 禁止: 1文だけの areaAbout、2件以下の historyNotes、抽象語だけの紹介。",
].join("\n");

function buildStationPrompt(rawName: string): string {
  const name = rawName.replace(/駅$/u, "").trim() || rawName.trim();
  return [
    "あなたは日本の駅の徒歩圏を案内する編集者です。",
    "Google検索の結果を優先し、実在する駅・店・名所だけを使ってください。",
    "観光ガイドの煽りやランキング口調は禁止。Lagadoらしい静かで詩的な日本語。",
    "薄い一覧ではなく、土地の厚み（地形・由来・生活の匂い・歩きの分岐）が伝わる分量で書いてください。",
    "出力は JSON オブジェクトのみ（前後の説明文なし）。",
    "",
    `入力された駅名: ${name}`,
    "",
    STATION_SCHEMA_BLOCK,
  ].join("\n");
}

function buildNearbyPrompt(lat: number, lng: number): string {
  return [
    "あなたは日本の駅の徒歩圏を案内する編集者です。",
    "Google検索の結果を優先し、実在する駅・店・名所だけを使ってください。",
    "観光ガイドの煽りやランキング口調は禁止。Lagadoらしい静かで詩的な日本語。",
    "出力は JSON オブジェクトのみ（前後の説明文なし）。",
    "",
    // Coarsened coords only (~1 km). Do not ask the model for finer precision.
    `現在地（おおよそ）: 緯度 ${lat.toFixed(2)}, 経度 ${lng.toFixed(2)}`,
    "座標は約1km単位に丸めてあります。この付近で最も近い実在の鉄道駅（新幹線停車駅より、最寄りの在来線・私鉄駅を優先）を特定し、その駅名で徒歩圏案内を返す。",
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
    .slice(0, 18);

  if (spots.length === 0) {
    return {
      error: "empty_spots",
      message: "案内スポットを作れませんでした。別の駅名で試してください。",
    };
  }

  const lat = asNumber(parsed.lat, 35.0);
  const lng = asNumber(parsed.lng, 135.0);

  const historyNotes = parseNoteList(parsed.historyNotes, 6);
  const sightseeingNotes = parseNoteList(parsed.sightseeingNotes, 5);

  const station: StationSeed = {
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

  return station;
}

type GeminiCallResult =
  | { ok: true; text: string }
  | { ok: false; error: string; message: string };

const GEMINI_FAST_MS = 22_000;
const GEMINI_GROUNDED_MS = 32_000;
const GEMINI_EXPAND_MS = 28_000;

function isNarrativeThin(station: StationSeed): boolean {
  const intro = (station.stationIntro ?? "").length;
  const about = (station.areaAbout ?? "").length;
  const walk = (station.walkGuide ?? "").length;
  const notes = station.historyNotes ?? [];
  const histChars = notes.reduce((n, h) => n + h.body.length, 0);
  const sight = station.sightseeingNotes ?? [];
  const spots = station.spots.length;
  return (
    intro < 200 ||
    about < 320 ||
    walk < 140 ||
    notes.length < 4 ||
    histChars < 480 ||
    sight.length < 3 ||
    spots < 10
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

function buildNarrativeExpandPrompt(station: StationSeed): string {
  return [
    "あなたは日本の駅の徒歩圏を案内する編集者です。",
    "実在の歴史・地名由来・産業・信仰・交通の変遷を優先し、薄い紹介文を厚く書き直してください。",
    "観光ガイドの煽りやランキング口調は禁止。Lagadoらしい静かで詩的な日本語。",
    "出力は JSON オブジェクトのみ。",
    "",
    `駅名: ${station.name}`,
    `路線: ${station.line}`,
    `都道府県: ${station.prefecture}`,
    `既存の短い紹介: ${station.stationIntro ?? "(なし)"}`,
    `既存の短いエリア文: ${station.areaAbout ?? "(なし)"}`,
    "",
    "スキーマ:",
    "{",
    '  "stationIntro": "4〜6文・160字以上",',
    '  "areaAbout": "空行区切り2段落・合計280字以上。歴史と現在",',
    '  "walkGuide": "4〜6文・120字以上",',
    '  "bikeRentalSummary": "2〜3文",',
    '  "historyNotes": [{ "title": "...", "body": "3〜5文" }]（4〜6件）,',
    '  "sightseeingNotes": [{ "title": "...", "body": "2〜4文" }]（3〜4件）',
    "}",
    "",
    "短い一文で終わらせないこと。読者が歴史を知れる分量にする。",
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
    `- いま meal ${countGuide(station, "meal")}件 / souvenir ${countGuide(station, "souvenir")}件。meal は合計少なくとも5件、souvenir は合計少なくとも3件になるまで追加する。`,
    "- 可能なら meal 6〜7件・souvenir 4件まで足す。既存と同名は出さない。名物菓子は souvenir 側。",
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
    spots: [...station.spots, ...extras].slice(0, 18),
  };
}

const MIN_REST_SPOTS = 2;

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
    "- 長居できる喫茶を1件以上。定食屋・食堂は入れない（それらはご飯）。",
    "- 寺・神社そのものは入れない（観光）。",
    "- 駅から徒歩18分以内。座標を駅へ寄せない。確認できない場所は出さない。",
    "- blurb と detail は各3文以上。そこでどう休むかを書く。",
  ].join("\n");
}

async function expandRestSpots(
  station: StationSeed,
  apiKey: string,
  viewerSub: string,
): Promise<StationSeed> {
  if (countGuide(station, "rest") >= MIN_REST_SPOTS) return station;
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
        maxOutputTokens: 4096,
        responseMimeType: "application/json",
      },
    },
    GEMINI_EXPAND_MS,
  );
  if (!expanded.ok) return station;

  const parsed = extractJsonObject(expanded.text);
  if (!parsed) return station;

  const historyNotes =
    parseNoteList(parsed.historyNotes, 6) ?? station.historyNotes;
  const sightseeingNotes =
    parseNoteList(parsed.sightseeingNotes, 5) ?? station.sightseeingNotes;
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

const MIN_MEAL_SPOTS = 5;
const MIN_SOUVENIR_SPOTS = 3;

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
  if (countMajor(station) === 3) return station;
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
  // ガイド種別を散らす: sight を優先しつつ meal/souvenir を1つは入れる
  const picked: Spot[] = [];
  const hasGuide = (g: string) => picked.some((p) => p.guide === g);
  for (const row of scored) {
    if (picked.length >= 3) break;
    if (picked.some((p) => p.id === row.s.id)) continue;
    if (picked.length === 2 && !hasGuide("sight") && row.s.guide !== "sight") {
      const sight = scored.find(
        (x) => x.s.guide === "sight" && !picked.some((p) => p.id === x.s.id),
      );
      if (sight) {
        picked.push(sight.s);
        continue;
      }
    }
    picked.push(row.s);
  }
  if (picked.length < 3) {
    for (const row of scored) {
      if (picked.length >= 3) break;
      if (!picked.some((p) => p.id === row.s.id)) picked.push(row.s);
    }
  }
  const ids = new Set(picked.slice(0, 3).map((p) => p.id));
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
 * - landmarks: 一番有名な名所・景色 2
 * - omiyage: 手土産になる名物菓子・名産 2（お土産タブ用。1件目は初心者コースの名物枠）
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
    "1) landmarks ちょうど2件 … その駅でいちばん有名な観光名所・景色（名社寺・川の合流・橋・商店街・城・市場の顔など）。近所の無名な寺・脇社・小さな祠・マイナー店は禁止。",
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

  // 名所2 + 名物土産の1件目 = 初心者コースのメジャー3
  for (let i = 0; i < Math.min(2, rawLandmarks.length); i++) {
    upsertIcon(rawLandmarks[i], {
      forceGuide: "sight",
      idPrefix: "ai-landmark",
      asMajor: true,
    });
  }
  for (let i = 0; i < Math.min(2, rawOmiyage.length); i++) {
    upsertIcon(rawOmiyage[i], {
      forceGuide: "souvenir",
      idPrefix: "ai-omiyage",
      asMajor: i === 0, // 1件目だけ major（名所2＋名物1）
    });
  }

  if (majorIds.length >= 2) {
    const idSet = new Set(majorIds.slice(0, 3));
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
    // 余分な一般土産 major を外し、必ず3件に整える
    return trimMajorsToThree(station, must.id);
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
  while (nextIds.size > 3) {
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

function trimMajorsToThree(
  station: StationSeed,
  keepShopId: string,
): StationSeed {
  const majors = station.spots.filter((s) => s.majorWorthy);
  if (majors.length <= 3 && majors.some((m) => m.id === keepShopId)) {
    return station;
  }
  const keep: Spot[] = [];
  const shop = majors.find((m) => m.id === keepShopId);
  if (shop) keep.push(shop);
  for (const m of majors
    .filter((m) => /神社|寺|デルタ|城|宮/.test(m.name))
    .sort((a, b) => a.walkMinutes - b.walkMinutes)) {
    if (keep.length >= 3) break;
    if (!keep.some((k) => k.id === m.id)) keep.push(m);
  }
  for (const m of majors.sort((a, b) => a.walkMinutes - b.walkMinutes)) {
    if (keep.length >= 3) break;
    if (!keep.some((k) => k.id === m.id)) keep.push(m);
  }
  const ids = new Set(keep.slice(0, 3).map((k) => k.id));
  return {
    ...station,
    spots: station.spots.map((s) => ({
      ...s,
      majorWorthy: ids.has(s.id),
      secretWorthy: ids.has(s.id) ? false : s.secretWorthy,
    })),
  };
}

async function finalizeAiStation(
  result: AiStationResult | { error: string; message: string },
  apiKey: string,
  viewerSub: string,
): Promise<AiStationResult | { error: string; message: string }> {
  if ("error" in result) return result;
  // 土地の文章 → ご飯・土産の店数、の順で厚くする
  let station = await expandStationNarrative(
    result.station,
    apiKey,
    viewerSub,
  );
  station = await expandShopSpots(station, apiKey, viewerSub);
  const shopsBeforeFar = station;
  station = filterFarSpots(station);
  station = ensureShopGuideFloor(station, shopsBeforeFar);
  // 遠い店を落としたあと薄ければ、徒歩圏の店だけもう一度足す
  if (isShopThin(station)) {
    station = await expandShopSpots(station, apiKey, viewerSub);
    const beforeFar2 = station;
    station = filterFarSpots(station);
    station = ensureShopGuideFloor(station, beforeFar2);
  }
  // 土地の定番めし（パン・おにぎり・食堂など）を先に確保
  station = await ensureStapleMealEntries(station, apiKey, viewerSub);
  station = sealDemachiBikeRentals(station);
  // 初心者コース用のメジャー3つを必ず用意（名所2＋名物1）
  station = await ensureMajorSpotEntries(station, apiKey, viewerSub);
  station = sealIconicMajors(station);
  station = balanceMajorsSightseeing(station);
  station = normalizeEdibleSouvenirs(station);
  // 銘菓を souvenir に寄せたあと meal が5件未満なら、ご飯屋を足す
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
  station = snapRiverLandmarks(station);
  station = balanceMajorsSightseeing(station);
  return { station, source: "ai" };
}

/** 正本は data/landmark-locks.json（住所 + OSM 店舗ノード）。手打ち緯度は使わない。 */
type LandmarkLock = {
  station: string;
  kind: string;
  keywords: string[];
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

function snapRiverLandmarks(station: StationSeed): StationSeed {
  const pins = (landmarkLocks.locks as LandmarkLock[]).filter((p) =>
    station.name.includes(p.station),
  );
  if (pins.length === 0) return station;
  const spots = station.spots.map((s) => {
    const hit = pins.find((p) => lockMatches(s.name, p));
    if (!hit) return s;
    return { ...s, lat: hit.lat, lng: hit.lng, walkMinutes: hit.walkMinutes };
  });
  return { ...station, spots };
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

/** 名物菓子・銘菓を souvenir に寄せる（どの駅でも） */
function normalizeEdibleSouvenirs(station: StationSeed): StationSeed {
  const spots: Spot[] = station.spots.map((s) => {
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
  if (isOrdinaryPublicFace(n) || /合流/.test(n)) score += 45;
  if (/城|金閣|清水|浅草/.test(n)) score += 35;
  if (/世界遺産|参道/.test(blob)) score += 20;
  if (isNeighborhoodWorship(n, stationName)) score -= 80;
  if (/幸神社|境内社|摂社/.test(n)) score -= 60;
  score += Math.max(0, 8 - spot.walkMinutes * 0.2);
  return score;
}

/** major を観光2＋名物1に整える（ベタな名所優先。小社で埋めない） */
function balanceMajorsSightseeing(station: StationSeed): StationSeed {
  let working = station;
  if (
    /出町柳/.test(working.name) &&
    !working.spots.some((s) => /下鴨|賀茂御祖/.test(s.name))
  ) {
    working = {
      ...working,
      spots: [
        ...working.spots,
        {
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
        },
      ],
    };
  }

  working = {
    ...working,
    spots: filterFirstVisitSpots(working.spots, working.name),
  };

  const majors = working.spots.filter((s) => s.majorWorthy);
  const isFood = (s: Spot) => s.guide === "meal" || s.guide === "souvenir";
  const isSightish = (s: Spot) =>
    s.guide === "sight" ||
    isGuidebookWorship(s.name, working.name) ||
    isOrdinaryPublicFace(s.name) ||
    /城|宮/.test(s.name);

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

  // 有名度で名所2 + 名物1（駅固有の固定ではなくスコアで土地の顔を決める）
  const keep: Spot[] = [];
  const isSoftCafe = (s: Spot) =>
    /多目的|つながる|知る、感じる|コワーキング|レンタルスペース/.test(
      `${s.name}${s.blurb ?? ""}`,
    );
  for (const s of landmarkPool) {
    if (keep.length >= 2) break;
    if (isSoftCafe(s)) continue;
    if (!keep.some((k) => k.id === s.id)) keep.push(s);
  }
  if (iconicFood && keep.length < 3 && !isSoftCafe(iconicFood)) keep.push(iconicFood);
  for (const s of landmarkPool) {
    if (keep.length >= 3) break;
    if (isSoftCafe(s)) continue;
    if (!keep.some((k) => k.id === s.id)) keep.push(s);
  }

  const ids = new Set(keep.slice(0, 3).map((k) => k.id));
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
