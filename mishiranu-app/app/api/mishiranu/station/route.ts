import { STATIONS } from "@/data/mishiranu-stations";
import { generateStationGuideWithGemini } from "@/lib/mishiranu-station-ai";

export const runtime = "nodejs";

type Body = {
  name?: string;
};

const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 8;
const hits = new Map<string, number[]>();

function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip") || "unknown";
}

function allowRequest(key: string): boolean {
  const now = Date.now();
  const prev = hits.get(key) ?? [];
  const recent = prev.filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_MAX) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  return true;
}

function normalizeName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

function findCuratedByName(name: string) {
  const bare = name.replace(/駅$/u, "");
  return STATIONS.find(
    (s) => s.name === bare || s.name === name || `${s.name}駅` === name,
  );
}

export async function POST(request: Request) {
  if (!allowRequest(clientKey(request))) {
    return Response.json({ error: "rate_limited" }, { status: 429 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? normalizeName(body.name) : "";
  if (!name || name.length > 40) {
    return Response.json({ error: "invalid_name" }, { status: 400 });
  }

  const curated = findCuratedByName(name);
  if (curated) {
    return Response.json({ station: curated, source: "seed" as const });
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return Response.json(
      {
        error: "no_api_key",
        message:
          "GEMINI_API_KEY が未設定のため、編集リスト外の駅はまだ案内できません。",
      },
      { status: 503 },
    );
  }

  try {
    const result = await generateStationGuideWithGemini(name, apiKey);
    if ("error" in result) {
      const status =
        result.error === "not_a_station"
          ? 404
          : result.error === "gemini_http"
            ? 502
            : 422;
      return Response.json(result, { status });
    }
    return Response.json(result);
  } catch {
    return Response.json(
      {
        error: "unexpected",
        message: "案内の生成中にエラーが起きました。もう一度どうぞ。",
      },
      { status: 500 },
    );
  }
}
