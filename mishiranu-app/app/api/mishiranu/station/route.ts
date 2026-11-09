import { STATIONS } from "@/data/mishiranu-stations";
import { allowViewerRequest } from "@/lib/mishiranu-rate-limit";
import { generateStationGuideWithGemini } from "@/lib/mishiranu-station-ai";
import { requireIdentity } from "../../../../cursor/identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Hosted apps may cut long Gemini+Search calls; keep headroom for the fast path + one retry. */
export const maxDuration = 60;

type Body = {
  name?: string;
};

const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 8;

const NO_STORE = { "cache-control": "private, no-store" };

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
  const identity = await requireIdentity(request);
  if (identity instanceof Response) return identity;

  if (!allowViewerRequest(`station:${identity.sub}`, RATE_MAX, RATE_WINDOW_MS)) {
    return Response.json(
      {
        error: "rate_limited",
        message: "いま混み合っています。少し待ってから、もう一度どうぞ。",
      },
      { status: 429, headers: NO_STORE },
    );
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return Response.json(
      { error: "invalid_json" },
      { status: 400, headers: NO_STORE },
    );
  }

  const name = typeof body.name === "string" ? normalizeName(body.name) : "";
  if (!name || name.length > 40) {
    return Response.json(
      { error: "invalid_name" },
      { status: 400, headers: NO_STORE },
    );
  }

  const curated = findCuratedByName(name);
  if (curated) {
    return Response.json(
      { station: curated, source: "seed" as const },
      { headers: NO_STORE },
    );
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return Response.json(
      {
        error: "no_api_key",
        message:
          "GEMINI_API_KEY が未設定のため、編集リスト外の駅はまだ案内できません。",
      },
      { status: 503, headers: NO_STORE },
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
      return Response.json(result, { status, headers: NO_STORE });
    }
    return Response.json(result, { headers: NO_STORE });
  } catch {
    return Response.json(
      {
        error: "unexpected",
        message: "案内の生成中にエラーが起きました。もう一度どうぞ。",
      },
      { status: 500, headers: NO_STORE },
    );
  }
}
