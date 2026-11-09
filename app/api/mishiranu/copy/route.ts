import { getStation, spotsForTime, TIME_OPTIONS } from "@/data/mishiranu-stations";
import {
  generateTourCopyWithGemini,
  seedCopy,
  type TourCopy,
} from "@/lib/mishiranu-copy";

export const runtime = "nodejs";

type Body = {
  stationId?: string;
  timeId?: string;
};

const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 20;
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
    return Response.json({ error: "rate_limited" }, { status: 429 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const station = body.stationId ? getStation(body.stationId) : undefined;
  if (!station) {
    return Response.json({ error: "unknown_station" }, { status: 404 });
  }

  const time =
    TIME_OPTIONS.find((t) => t.id === body.timeId) ?? TIME_OPTIONS[0];
  const spots = spotsForTime(station, time.index);
  const fallback: TourCopy = seedCopy(station);

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return Response.json(fallback);
  }

  try {
    const ai = await generateTourCopyWithGemini(
      station,
      spots,
      time.label,
      apiKey,
    );
    return Response.json(ai ?? fallback);
  } catch {
    return Response.json(fallback);
  }
}
