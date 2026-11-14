import { requireStationViewer } from "@/lib/mishiranu-device-auth";
import type { UserAiConfig } from "@/lib/mishiranu-billing";
import {
  allowViewerRequest,
  hasViewerHourlyBudget,
} from "@/lib/mishiranu-rate-limit";
import { requireJsonContentType } from "@/lib/mishiranu-request";
import { readCachedStation } from "@/lib/mishiranu-station-cache";
import {
  lookupStoryNotesForName,
  lookupStoryNotesWithUserAi,
} from "@/lib/mishiranu-station-ai";
import {
  ensureStoryPeekWalkInvite,
  storyNotesForName,
} from "@/lib/mishiranu-story-notes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** 物語だけなので本案内より短くてよい。 */
export const maxDuration = 60;

type Body = {
  name?: string;
  userAi?: {
    provider?: string;
    apiKey?: string;
    baseUrl?: string;
    model?: string;
  };
  userApiKey?: string;
};

const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 6;
const NO_STORE = { "cache-control": "private, no-store" };

function normalizeName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

function parseUserAi(body: Body): UserAiConfig | null {
  const raw = body.userAi;
  if (raw && typeof raw === "object") {
    const apiKey = typeof raw.apiKey === "string" ? raw.apiKey.trim() : "";
    if (apiKey.length < 8) return null;
    const provider = raw.provider === "openai" ? "openai" : "gemini";
    if (provider === "openai") {
      const baseUrl =
        typeof raw.baseUrl === "string" && raw.baseUrl.trim()
          ? raw.baseUrl.trim().replace(/\/$/, "")
          : "https://api.openai.com/v1";
      if (!/^https?:\/\//i.test(baseUrl)) return null;
      const model =
        typeof raw.model === "string" && raw.model.trim()
          ? raw.model.trim()
          : "gpt-4o-mini";
      return { provider: "openai", apiKey, baseUrl, model };
    }
    return { provider: "gemini", apiKey };
  }
  const legacy =
    typeof body.userApiKey === "string" ? body.userApiKey.trim() : "";
  if (legacy.length >= 8) {
    return { provider: "gemini", apiKey: legacy };
  }
  return null;
}

/**
 * コイン不要。物語のゆかりだけ返す。
 * 正本 → 共有キャッシュの storyNotes → grounded 検索。
 */
export async function POST(request: Request) {
  const viewer = await requireStationViewer(request);
  if (viewer instanceof Response) return viewer;

  const media = requireJsonContentType(request);
  if (media) return media;

  if (!allowViewerRequest(`story:${viewer.sub}`, RATE_MAX, RATE_WINDOW_MS)) {
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

  const canon = storyNotesForName(name);
  if (canon?.length) {
    return Response.json(
      {
        storyNotes: ensureStoryPeekWalkInvite(canon),
        source: "canon",
      },
      { headers: NO_STORE },
    );
  }

  const cached = await readCachedStation(name);
  if (cached?.storyNotes?.length) {
    return Response.json(
      {
        storyNotes: ensureStoryPeekWalkInvite(cached.storyNotes),
        source: "cache",
      },
      { headers: NO_STORE },
    );
  }

  const userAi = parseUserAi(body);
  if (userAi) {
    try {
      const result = await lookupStoryNotesWithUserAi(
        name,
        userAi,
        `byok:${viewer.sub}`,
        cached
          ? {
              prefecture: cached.prefecture,
              line: cached.line,
              lat: cached.lat,
              lng: cached.lng,
            }
          : undefined,
      );
      if (!result.ok) {
        return Response.json(result, {
          status: result.error === "gemini_http" ? 502 : 422,
          headers: NO_STORE,
        });
      }
      return Response.json(
        {
          storyNotes: ensureStoryPeekWalkInvite(result.storyNotes),
          source: "byok",
        },
        { headers: NO_STORE },
      );
    } catch {
      return Response.json(
        {
          error: "unexpected",
          message: "物語の調べ中にエラーが起きました。もう一度どうぞ。",
        },
        { status: 500, headers: NO_STORE },
      );
    }
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return Response.json(
      {
        error: "no_api_key",
        message: "物語を調べる設定がまだありません。しばらくしてからどうぞ。",
      },
      { status: 503, headers: NO_STORE },
    );
  }

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
    const result = await lookupStoryNotesForName(
      name,
      apiKey,
      viewer.sub,
      cached
        ? {
            prefecture: cached.prefecture,
            line: cached.line,
            lat: cached.lat,
            lng: cached.lng,
          }
        : undefined,
    );
    if (!result.ok) {
      return Response.json(result, {
        status: result.error === "gemini_http" ? 502 : 422,
        headers: NO_STORE,
      });
    }
    return Response.json(
      {
        storyNotes: ensureStoryPeekWalkInvite(result.storyNotes),
        source: "ai",
      },
      { headers: NO_STORE },
    );
  } catch {
    return Response.json(
      {
        error: "unexpected",
        message: "物語の調べ中にエラーが起きました。もう一度どうぞ。",
      },
      { status: 500, headers: NO_STORE },
    );
  }
}
