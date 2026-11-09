import { STATIONS } from "@/data/mishiranu-stations";
import { findNearestStation } from "@/lib/mishiranu-geo";
import { generateNearbyStationWithGemini } from "@/lib/mishiranu-station-ai";

export const runtime = "nodejs";
export const maxDuration = 60;

type Body = {
  lat?: number;
  lng?: number;
};

const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 6;
const CURATED_RADIUS_KM = 3.5;
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

export async function POST(request: Request) {
  if (!allowRequest(clientKey(request))) {
    return Response.json(
      {
        error: "rate_limited",
        message: "いま混み合っています。少し待ってから、もう一度どうぞ。",
      },
      { status: 429 },
    );
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
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
      { status: 400 },
    );
  }

  const nearest = findNearestStation(lat, lng, STATIONS);
  if (nearest && nearest.km <= CURATED_RADIUS_KM) {
    return Response.json({
      station: nearest.station,
      source: "seed" as const,
      km: Math.round(nearest.km * 10) / 10,
    });
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    if (nearest) {
      return Response.json({
        station: nearest.station,
        source: "seed" as const,
        km: Math.round(nearest.km * 10) / 10,
        note: "編集リスト外の最寄り特定には API キーが必要なため、近い編集駅を返しました。",
      });
    }
    return Response.json(
      {
        error: "no_api_key",
        message: "現在地の駅名特定に必要な設定がありません。駅名を入力してください。",
      },
      { status: 503 },
    );
  }

  try {
    const result = await generateNearbyStationWithGemini(lat, lng, apiKey);
    if ("error" in result) {
      const status =
        result.error === "not_a_station"
          ? 404
          : result.error === "gemini_http"
            ? 502
            : 422;
      return Response.json(result, { status });
    }
    return Response.json({
      ...result,
      km: nearest ? Math.round(nearest.km * 10) / 10 : undefined,
    });
  } catch {
    return Response.json(
      {
        error: "unexpected",
        message: "現在地の駅を探す途中でエラーが起きました。もう一度どうぞ。",
      },
      { status: 500 },
    );
  }
}
