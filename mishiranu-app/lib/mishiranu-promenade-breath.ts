import type { Spot, StationSeed } from "@/data/mishiranu-stations";
import {
  corridorsForStation,
  type AtmosphereCorridor,
} from "@/lib/mishiranu-atmosphere";

/**
 * TTS 用「散歩の呼吸」一筆書き。
 * 駅を出て → 空気の区間 → 折れる → 同じ駅へ帰る。
 * 店・名所は道の途中の短い後段。
 */
export function promenadeBreathScript(
  station: StationSeed,
  opts?: {
    corridors?: AtmosphereCorridor[] | null;
    midSpots?: Spot[] | null;
  },
): string {
  const bare = station.name.replace(/駅$/u, "").trim() || station.name;
  const corridors =
    opts?.corridors && opts.corridors.length > 0
      ? opts.corridors
      : corridorsForStation(station).slice(0, 3);

  const parts: string[] = [];
  parts.push(`私は、${bare}の改札を出る。`);

  if (corridors[0]) {
    parts.push(
      `まず、${corridors[0].name}を通る。${trimSentence(corridors[0].blurb)}`,
    );
  } else if (station.walkGuide?.trim()) {
    const first = firstSentences(station.walkGuide, 2);
    if (first) parts.push(first);
  } else {
    parts.push("名前のない道の空気を、足の裏で確かめながら歩き出す。");
  }

  if (corridors[1]) {
    parts.push(
      `途中で、${corridors[1].name}へ折れる。${trimSentence(corridors[1].blurb)}`,
    );
  } else if (corridors[0] && station.walkGuide?.trim()) {
    const rest = firstSentences(station.walkGuide, 1);
    if (rest && !parts.join("").includes(rest.slice(0, 12))) {
      parts.push(`道の向きが少し変わる。${rest}`);
    }
  }

  const mid = pickMidSpots(opts?.midSpots ?? station.spots ?? [], corridors);
  if (mid.length) {
    const names = mid.map((s) => s.name).join("、");
    parts.push(`道の途中で、${names}が目に入る。立ち止まるのは、ほんの一瞬でよい。`);
  }

  if (corridors[2] && corridors.length >= 3) {
    parts.push(
      `${corridors[2].name}の気配を残して、私は向きを駅へ戻す。`,
    );
  }

  parts.push(
    "また、同じ駅へ帰る。歩いたぶんだけ、さっきまでの名前は、私の散歩道になっていく。",
  );

  return parts
    .map((p) => p.trim())
    .filter(Boolean)
    .join("\n\n");
}

function trimSentence(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function firstSentences(text: string, max: number): string {
  const lines: string[] = [];
  let cur = "";
  for (const ch of text.replace(/\s+/g, " ").trim()) {
    cur += ch;
    if ("。！？".includes(ch)) {
      const t = cur.trim();
      if (t) lines.push(t);
      cur = "";
      if (lines.length >= max) break;
    }
  }
  if (lines.length < max) {
    const rest = cur.trim();
    if (rest) lines.push(rest);
  }
  return lines.slice(0, max).join("");
}

function pickMidSpots(
  spots: Spot[],
  corridors: AtmosphereCorridor[],
): Spot[] {
  const corridorKeys = new Set(
    corridors.flatMap((c) => [c.name, ...c.relatedSpotNames]),
  );
  return spots
    .filter((s) => {
      const g = s.guide ?? "";
      if (g === "meal" || g === "souvenir") return false;
      if (corridorKeys.has(s.name)) return false;
      if (corridors.some((c) => s.name.includes(c.name) || c.name.includes(s.name))) {
        return false;
      }
      return g === "sight" || g === "rest" || g === "tip" || !!s.majorWorthy;
    })
    .slice(0, 2);
}
