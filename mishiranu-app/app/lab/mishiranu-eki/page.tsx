import MishiranuApp from "./MishiranuApp";
import type { TimeOptionId } from "@/data/mishiranu-stations";

type SearchParams = Promise<{
  view?: string | string[];
  station?: string | string[];
  time?: string | string[];
  focus?: string | string[];
}>;

function one(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default async function MishiranuEkiPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const view = one(sp.view);
  const station = one(sp.station);
  const time = one(sp.time);
  const focusRaw = one(sp.focus);
  const initialStep =
    view === "pick" || view === "tour" || view === "hero" ? view : "hero";
  const initialTimeId =
    time === "1h" || time === "3h" || time === "half"
      ? (time as TimeOptionId)
      : "1h";
  const initialFocus = focusRaw
    ? focusRaw.split(",").map((f) => f.trim()).filter(Boolean)
    : undefined;

  return (
    <MishiranuApp
      initialStep={initialStep}
      initialStationId={station}
      initialTimeId={initialTimeId}
      initialFocus={initialFocus}
    />
  );
}
