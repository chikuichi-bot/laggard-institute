import { requireStationViewer } from "@/lib/mishiranu-device-auth";
import {
  allowViewerRequest,
  hasViewerHourlyBudget,
} from "@/lib/mishiranu-rate-limit";
import { requireJsonContentType } from "@/lib/mishiranu-request";
import type { UserAiConfig } from "@/lib/mishiranu-billing";
import {
  readCachedStation,
  writeCachedStation,
} from "@/lib/mishiranu-station-cache";
import { withVerifiedCenter } from "@/lib/mishiranu-station-center";
import {
  generateStationGuideWithGemini,
  generateStationGuideWithUserAi,
} from "@/lib/mishiranu-station-ai";
import { sealGuideIntegrity } from "@/lib/mishiranu-guide-integrity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Hosted apps may cut long Gemini+Search calls; keep headroom for the fast path + one retry. */
export const maxDuration = 120;

type Body = {
  name?: string;
  /** true なら共有キャッシュを読まず、ホスト生成で作り直して上書きする */
  forceRefresh?: boolean;
  /** @deprecated userAi を優先 */
  userApiKey?: string;
  /** 買い切りユーザーの自分の AI（端末から送る。サーバーに保存しない） */
  userAi?: {
    provider?: string;
    apiKey?: string;
    baseUrl?: string;
    model?: string;
  };
};

const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 3;

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

  // 後方互換: 旧クライアントの userApiKey のみ
  const legacy =
    typeof body.userApiKey === "string" ? body.userApiKey.trim() : "";
  if (legacy.length >= 8) {
    return { provider: "gemini", apiKey: legacy };
  }
  return null;
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

  const forceRefresh = body.forceRefresh === true;

  // 同じ駅は誰が引いても同じ。作る前に共有キャッシュを見る（BYOK も含めて全員）。
  // 設定の「案内を作り直す」だけ forceRefresh でここを飛ばす。
  if (!forceRefresh) {
    const cached = await readCachedStation(name);
    if (cached) {
      // 古いキャッシュの AI 駅中心がずれていたら、直して置き直す
      const fixed = await withVerifiedCenter(cached);
      if (fixed.moved) await writeCachedStation(name, fixed.station);
      // 古いキャッシュに配食・川の総称が残っていても、返す前に関所を通す
      return Response.json(
        { station: sealGuideIntegrity(fixed.station), source: "ai" },
        { headers: NO_STORE },
      );
    }
  }

  const userAi = parseUserAi(body);
  const usingByok = !!userAi;

  if (usingByok && userAi) {
    const viewerKey = `byok:${viewer.sub}`;
    try {
      const result = await generateStationGuideWithUserAi(
        name,
        userAi,
        viewerKey,
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

  // 収録シードは使わない。ホストの Gemini 解析。
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
    // 次の人のために置く。書けなくても案内は返す。
    // BYOK 側では書かない（相手のモデル次第で品質が揺れるため）。
    const fixed = await withVerifiedCenter(result.station);
    await writeCachedStation(name, fixed.station);
    return Response.json({ ...result, station: fixed.station }, { headers: NO_STORE });
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
