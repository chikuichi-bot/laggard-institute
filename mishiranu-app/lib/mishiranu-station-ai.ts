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
  '  "line": "路線名",',
  '  "prefecture": "都道府県（都府県を含む短い表記可）",',
  '  "region": "北海道|東北|関東|中部|近畿|中国|四国|九州",',
  '  "mood": "story|empty",',
  '  "lat": 駅の緯度(number),',
  '  "lng": 駅の経度(number),',
  '  "stationIntro": "3〜5文の駅紹介（観光案内の導入）",',
  '  "areaAbout": "いまの界隈の様子。2段落（空行区切り）で厚めに",',
  '  "walkGuide": "徒歩圏の回り方を3〜5文",',
  '  "tourTitle": "28字以内",',
  '  "catchCopy": "40字以内",',
  '  "emptyHeadline": "emptyのときだけ20字以内",',
  '  "emptyBody": "emptyのときだけ80字以内",',
  '  "bikeRental": { "available": boolean, "summary": "一文" },',
  '  "historyNotes": [{ "title": "短い見出し", "body": "2〜4文の歴史メモ" }]（3〜5件）,',
  '  "sightseeingNotes": [{ "title": "短い見出し", "body": "観光の見どころ・回り方メモ" }]（2〜4件）,',
  '  "spots": [',
  "    {",
  '      "name": "場所名",',
  '      "genre": "history|gourmet|nature|odd",',
  '      "guide": "meal|souvenir|sight|rest|tip",',
  '      "mealTier": "casual|upscale（mealのみ）",',
  '      "mealTimes": ["morning|lunch|dinner"]（mealのみ・1つ以上）,',
  '      "hours": "何時から何時まで。例 10:00〜18:00（火曜定休）。屋外は終日（屋外）",',
  '      "blurb": "1〜2文",',
  '      "detail": "補足の見どころ・注意を1〜2文（任意）",',
  '      "walkMinutes": 1〜40の整数,',
  '      "lat": 緯度,',
  '      "lng": 経度,',
  '      "secretWorthy": boolean',
  "    }",
  "  ]",
  "}",
  "",
  "制約:",
  "- 日本の実在の鉄道駅でなければ { \"error\": \"not_a_station\", \"message\": \"理由\" } を返す。",
  "- spots は 6〜10件。story のとき guide の meal/souvenir/sight/rest/tip をそれぞれ1件以上。",
  "- empty（本当に何も薄い駅）は meal/souvenir を無理に作らず、sight/rest/tip 中心。",
  "- hours はわかる範囲で具体的な開始〜終了。不明なら「要確認（目安 …）」と書く。",
  "- 駅から徒歩圏のみ。有名すぎる遠方スポットは避ける。",
  "- lat/lng はおおよその実座標でよい。",
  "- areaAbout / historyNotes / sightseeingNotes / walkGuide は情報量を多めに。薄い一言で終わらせない。",
].join("\n");

function buildStationPrompt(rawName: string): string {
  const name = rawName.replace(/駅$/u, "").trim() || rawName.trim();
  return [
    "あなたは日本の駅の徒歩圏を案内する編集者です。",
    "Google検索の結果を優先し、実在する駅・店・名所だけを使ってください。",
    "観光ガイドの煽りやランキング口調は禁止。Lagadoらしい静かで詩的な日本語。",
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
    `現在地の緯度経度: ${lat.toFixed(5)}, ${lng.toFixed(5)}`,
    "この地点から最も近い実在の鉄道駅（新幹線停車駅より、最寄りの在来線・私鉄駅を優先）を特定し、その駅名で徒歩圏案内を返す。",
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
    if (!spot.guide) spot.guide = "meal";
  }

  return spot;
}

function parseBike(raw: unknown): BikeRentalInfo | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const summary = asString(o.summary);
  if (!summary) return undefined;
  return {
    available: o.available === true,
    summary,
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
    .slice(0, 12);

  if (spots.length === 0) {
    return {
      error: "empty_spots",
      message: "案内スポットを作れませんでした。別の駅名で試してください。",
    };
  }

  const lat = asNumber(parsed.lat, 35.0);
  const lng = asNumber(parsed.lng, 135.0);

  const historyNotes = Array.isArray(parsed.historyNotes)
    ? parsed.historyNotes
        .map((n) => {
          if (!n || typeof n !== "object") return null;
          const o = n as Record<string, unknown>;
          const title = asString(o.title);
          const body = asString(o.body);
          if (!title || !body) return null;
          return { title, body };
        })
        .filter((n): n is { title: string; body: string } => !!n)
        .slice(0, 6)
    : undefined;
  const sightseeingNotes = Array.isArray(parsed.sightseeingNotes)
    ? parsed.sightseeingNotes
        .map((n) => {
          if (!n || typeof n !== "object") return null;
          const o = n as Record<string, unknown>;
          const title = asString(o.title);
          const body = asString(o.body);
          if (!title || !body) return null;
          return { title, body };
        })
        .filter((n): n is { title: string; body: string } => !!n)
        .slice(0, 5)
    : undefined;

  const station: StationSeed = {
    id: slugifyStationName(name),
    name,
    line: asString(parsed.line, "路線情報は要確認"),
    prefecture: asString(parsed.prefecture, "日本"),
    region,
    mood,
    radiiKm: [1.0, 2.2, 3.0],
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

const GEMINI_FAST_MS = 18_000;
const GEMINI_GROUNDED_MS = 28_000;

async function callGeminiGenerate(
  apiKey: string,
  body: Record<string, unknown>,
  timeoutMs: number,
): Promise<GeminiCallResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${GEMINI_URL}?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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

/**
 * Prefer a fast JSON-only call (fits published-app budgets).
 * Fall back once to Google Search grounding if the fast path is empty/malformed.
 */
async function generateFromPrompt(
  prompt: string,
  fallbackName: string,
  apiKey: string,
): Promise<AiStationResult | { error: string; message: string }> {
  const contents = [{ role: "user", parts: [{ text: prompt }] }];

  const fast = await callGeminiGenerate(
    apiKey,
    {
      contents,
      generationConfig: {
        temperature: 0.45,
        maxOutputTokens: 2800,
        responseMimeType: "application/json",
      },
    },
    GEMINI_FAST_MS,
  );

  if (fast.ok) {
    const parsed = stationFromGeminiText(fast.text, fallbackName);
    if (!("error" in parsed) || parsed.error === "not_a_station") {
      return parsed;
    }
  } else if (fast.error === "gemini_http") {
    // Auth / quota issues won't improve with a second call.
    return { error: fast.error, message: fast.message };
  }

  const grounded = await callGeminiGenerate(
    apiKey,
    {
      contents,
      tools: [{ google_search: {} }],
      generationConfig: {
        temperature: 0.5,
        maxOutputTokens: 3200,
      },
    },
    GEMINI_GROUNDED_MS,
  );

  if (!grounded.ok) {
    if (fast.ok) return stationFromGeminiText(fast.text, fallbackName);
    return { error: grounded.error, message: grounded.message };
  }
  return stationFromGeminiText(grounded.text, fallbackName);
}

export async function generateStationGuideWithGemini(
  rawName: string,
  apiKey: string,
): Promise<AiStationResult | { error: string; message: string }> {
  return generateFromPrompt(buildStationPrompt(rawName), rawName, apiKey);
}

export async function generateNearbyStationWithGemini(
  lat: number,
  lng: number,
  apiKey: string,
): Promise<AiStationResult | { error: string; message: string }> {
  return generateFromPrompt(
    buildNearbyPrompt(lat, lng),
    `現在地(${lat.toFixed(3)},${lng.toFixed(3)})`,
    apiKey,
  );
}
