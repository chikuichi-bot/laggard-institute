import type { Spot, StationSeed } from "@/data/mishiranu-stations";

/** 駅の歴史文から、降りた瞬間・歩く途中に渡す「一片」を拾う（iOS StationLore と同じ）。 */

export function loreSentences(text?: string): string[] {
  if (!text) return [];
  const out: string[] = [];
  let current = "";
  for (const ch of text) {
    if (ch === "\n") continue;
    current += ch;
    if ("。！？".includes(ch)) {
      const s = current.trim();
      if (s.length >= 8) out.push(s);
      current = "";
    }
  }
  const rest = current.trim();
  if (rest.length >= 8) out.push(rest);
  return out;
}

export function arrivalFragment(
  station: StationSeed,
  date = new Date(),
): { title: string; line: string } | null {
  const notes = (station.historyNotes ?? []).filter((n) => n.body);
  if (!notes.length) {
    const line = loreSentences(station.areaAbout)[0];
    return line ? { title: "この土地のこと", line } : null;
  }
  const day = Math.floor(date.getTime() / 86_400_000);
  let seed = day;
  for (const ch of station.id) seed += ch.codePointAt(0) ?? 0;
  const note = notes[seed % notes.length]!;
  const line = loreSentences(note.body)[0];
  return line ? { title: note.title, line } : null;
}

function nameKeys(name: string): string[] {
  const trimmed = name.trim();
  const keys = [trimmed];
  for (const part of trimmed.split(/[（）()「」\s　・/]/u)) {
    const p = part.trim();
    if (p.length >= 3) keys.push(p);
  }
  for (const suffix of ["本店", "駅前店", "店"]) {
    if (trimmed.endsWith(suffix)) {
      const core = trimmed.slice(0, -suffix.length);
      if (core.length >= 3) keys.push(core);
    }
  }
  return [...new Set(keys)];
}

/** その場所の名前が出てくる、土地の記憶の一文。なければ null（無理に埋めない）。 */
export function spotTrace(spot: Spot, station: StationSeed): string | null {
  const pool = [
    ...(station.historyNotes ?? []).flatMap((n) => loreSentences(n.body)),
    ...loreSentences(station.areaAbout),
    ...loreSentences(station.stationIntro),
    ...(station.sightseeingNotes ?? []).flatMap((n) => loreSentences(n.body)),
  ];
  for (const key of nameKeys(spot.name)) {
    const hit = pool.find((s) => s.includes(key) && !spot.blurb.includes(s));
    if (hit) return hit;
  }
  return null;
}
