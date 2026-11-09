import { getStation, spotsForTime, TIME_OPTIONS } from "@/data/mishiranu-stations";
import {
  generateTourCopyWithGemini,
  seedCopy,
  type TourCopy,
} from "@/lib/mishiranu-copy";
import { allowViewerRequest } from "@/lib/mishiranu-rate-limit";
import { requireIdentity } from "../../../../cursor/identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  stationId?: string;
  timeId?: string;
};

const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 20;

const NO_STORE = { "cache-control": "private, no-store" };

export async function POST(request: Request) {
  const identity = await requireIdentity(request);
  if (identity instanceof Response) return identity;

  if (!allowViewerRequest(`copy:${identity.sub}`, RATE_MAX, RATE_WINDOW_MS)) {
    return Response.json(
      { error: "rate_limited" },
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

  const station = body.stationId ? getStation(body.stationId) : undefined;
  if (!station) {
    return Response.json(
      { error: "unknown_station" },
      { status: 404, headers: NO_STORE },
    );
  }

  const time =
    TIME_OPTIONS.find((t) => t.id === body.timeId) ?? TIME_OPTIONS[0];
  const spots = spotsForTime(station, time.index);
  const fallback: TourCopy = seedCopy(station);

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return Response.json(fallback, { headers: NO_STORE });
  }

  try {
    const ai = await generateTourCopyWithGemini(
      station,
      spots,
      time.label,
      apiKey,
    );
    return Response.json(ai ?? fallback, { headers: NO_STORE });
  } catch {
    return Response.json(fallback, { headers: NO_STORE });
  }
}
