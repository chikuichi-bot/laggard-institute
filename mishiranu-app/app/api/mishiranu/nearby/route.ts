import { STATIONS } from "@/data/mishiranu-stations";
import { findNearestStation, fuzzLatLngForExternal } from "@/lib/mishiranu-geo";
import {
  allowViewerRequest,
  hasViewerHourlyBudget,
} from "@/lib/mishiranu-rate-limit";
import { requireJsonContentType } from "@/lib/mishiranu-request";
import { generateNearbyStationWithGemini } from "@/lib/mishiranu-station-ai";
import { requireIdentity } from "../../../../cursor/identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Body = {
  lat?: number;
  lng?: number;
};

const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 3;
const CURATED_RADIUS_KM = 3.5;
const NO_STORE = { "cache-control": "private, no-store" };

export async function POST(request: Request) {
  const identity = await requireIdentity(request);
  if (identity instanceof Response) return identity;

  const media = requireJsonContentType(request);
  if (media) return media;

  if (!allowViewerRequest(`nearby:${identity.sub}`, RATE_MAX, RATE_WINDOW_MS)) {
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

  const lat = typeof body.lat === "number" ? body.lat : Number.NaN;
  const lng = typeof body.lng === "number" ? body.lng : Number.NaN;
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return Response.json(
      { error: "invalid_coords", message: "位置情報が読めませんでした。" },
      { status: 400, headers: NO_STORE },
    );
  }

  // Clients should send already-coarsened coords. Re-fuzz defensively so
  // precise GPS never reaches Gemini even if an older client posts raw values.
  const coarse = fuzzLatLngForExternal(lat, lng);
  const nearest = findNearestStation(coarse.lat, coarse.lng, STATIONS);
  if (nearest && nearest.km <= CURATED_RADIUS_KM) {
    return Response.json(
      {
        station: nearest.station,
        source: "seed" as const,
        km: Math.round(nearest.km * 10) / 10,
      },
      { headers: NO_STORE },
    );
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    if (nearest) {
      return Response.json(
        {
          station: nearest.station,
          source: "seed" as const,
          km: Math.round(nearest.km * 10) / 10,
          note: "編集リスト外の最寄り特定には API キーが必要なため、近い編集駅を返しました。",
        },
        { headers: NO_STORE },
      );
    }
    return Response.json(
      {
        error: "no_api_key",
        message: "現在地の駅名特定に必要な設定がありません。駅名を入力してください。",
      },
      { status: 503, headers: NO_STORE },
    );
  }

  // Soft peek only — each Gemini HTTP call charges the hourly budget itself.
  if (!hasViewerHourlyBudget(identity.sub)) {
    return Response.json(
      {
        error: "rate_limited",
        message: "本日の案内回数の上限に近づきました。しばらくしてからどうぞ。",
      },
      { status: 429, headers: NO_STORE },
    );
  }

  try {
    const result = await generateNearbyStationWithGemini(
      coarse.lat,
      coarse.lng,
      apiKey,
      identity.sub,
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
    return Response.json(
      {
        ...result,
        km: nearest ? Math.round(nearest.km * 10) / 10 : undefined,
      },
      { headers: NO_STORE },
    );
  } catch {
    return Response.json(
      {
        error: "unexpected",
        message: "現在地の駅を探す途中でエラーが起きました。もう一度どうぞ。",
      },
      { status: 500, headers: NO_STORE },
    );
  }
}
