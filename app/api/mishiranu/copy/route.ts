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

export async function POST(request: Request) {
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
