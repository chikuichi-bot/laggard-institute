import type { StationSeed, Spot } from "@/data/mishiranu-stations";

export type TourCopy = {
  tourTitle: string;
  catchCopy: string;
  emptyHeadline?: string;
  emptyBody?: string;
  source: "ai" | "seed";
};

export function seedCopy(station: StationSeed): TourCopy {
  return {
    tourTitle: station.tourTitle,
    catchCopy: station.catchCopy,
    emptyHeadline: station.emptyCopy?.headline,
    emptyBody: station.emptyCopy?.body,
    source: "seed",
  };
}

export function buildCopyPrompt(
  station: StationSeed,
  spots: Spot[],
  timeLabel: string,
): string {
  const spotLines = spots
    .map((s) => `- ${s.name}（${s.genre}）: ${s.blurb}`)
    .join("\n");

  return [
    "あなたは日本のローカル線の旅を愛する短いコピーライターです。",
    "観光ガイド口調や煽りは禁止。Lagadoらしい、静かで詩的な日本語。",
    "出力は必ず JSON のみ。キー: tourTitle, catchCopy" +
      (station.mood === "empty" ? ", emptyHeadline, emptyBody" : "") +
      "。",
    "",
    `駅: ${station.name}（${station.prefecture} / ${station.line}）`,
    `滞在: ${timeLabel}`,
    `ムード: ${station.mood === "empty" ? "何もないを肯定" : "寄り道の物語"}`,
    "スポット:",
    spotLines || "- （スポットなし）",
    "",
    "制約:",
    "- tourTitle は28字以内。駅のテーマを一文で命名。",
    "- catchCopy は40字以内。余韻のある一言。",
    station.mood === "empty"
      ? "- emptyHeadline は20字以内、emptyBody は80字以内。観光地の欠如をポジティブに。"
      : "- 有名観光地の列挙や「必見」「おすすめランキング」は禁止。",
  ].join("\n");
}

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

export async function generateTourCopyWithGemini(
  station: StationSeed,
  spots: Spot[],
  timeLabel: string,
  apiKey: string,
): Promise<TourCopy | null> {
  const prompt = buildCopyPrompt(station, spots, timeLabel);
  // おみくじ文庫の AI 解説と同じ系統（Gemini 3.1 Flash-Lite）
  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent";

  const res = await fetch(`${url}?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.9,
        maxOutputTokens: 400,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!res.ok) return null;

  const data = (await res.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };
  const text = data.candidates?.[0]?.content?.parts
    ?.map((p) => p.text ?? "")
    .join("")
    .trim();
  if (!text) return null;

  const parsed = extractJsonObject(text);
  if (!parsed) return null;

  const tourTitle =
    typeof parsed.tourTitle === "string" ? parsed.tourTitle.trim() : "";
  const catchCopy =
    typeof parsed.catchCopy === "string" ? parsed.catchCopy.trim() : "";
  if (!tourTitle || !catchCopy) return null;

  const emptyHeadline =
    typeof parsed.emptyHeadline === "string"
      ? parsed.emptyHeadline.trim()
      : station.emptyCopy?.headline;
  const emptyBody =
    typeof parsed.emptyBody === "string"
      ? parsed.emptyBody.trim()
      : station.emptyCopy?.body;

  return {
    tourTitle,
    catchCopy,
    emptyHeadline,
    emptyBody,
    source: "ai",
  };
}
