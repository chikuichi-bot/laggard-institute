import { requireStationViewer } from "@/lib/mishiranu-device-auth";
import {
  allowViewerRequest,
  hasViewerHourlyBudget,
} from "@/lib/mishiranu-rate-limit";
import { requireJsonContentType } from "@/lib/mishiranu-request";
import { generateStationGuideWithGemini } from "@/lib/mishiranu-station-ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Hosted apps may cut long Gemini+Search calls; keep headroom for the fast path + one retry. */
export const maxDuration = 120;

type Body = {
  name?: string;
};

const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 3;

const NO_STORE = { "cache-control": "private, no-store" };

function normalizeName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

export async function POST(request: Request) {
  const viewer = await requireStationViewer(request);
  if (viewer instanceof Response) return viewer;

  const media = requireJsonContentType(request);
  if (media) return media;

  if (!allowViewerRequest(`station:${viewer.sub}`, RATE_MAX, RATE_WINDOW_MS)) {
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

  // 収録シードは使わない。毎回 Gemini 解析。
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return Response.json(
      {
        error: "no_api_key",
        message:
          "GEMINI_API_KEY が未設定のため、まだその駅の案内をつくれません。",
      },
      { status: 503, headers: NO_STORE },
    );
  }

  // Soft peek only — each Gemini HTTP call charges the hourly budget itself.
  if (!hasViewerHourlyBudget(viewer.sub)) {
    return Response.json(
      {
        error: "rate_limited",
        message: "本日の案内回数の上限に近づきました。しばらくしてからどうぞ。",
      },
      { status: 429, headers: NO_STORE },
    );
  }

  try {
    const result = await generateStationGuideWithGemini(
      name,
      apiKey,
      viewer.sub,
    );
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
