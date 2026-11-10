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

type Temperature = "water" | "tide" | "shrine" | "food" | "castle" | "town";

function bareName(name: string): string {
  return name.endsWith("駅") ? name.slice(0, -1) : name;
}

function temperatureKind(station: StationSeed): Temperature {
  const blob = [
    station.name,
    station.catchCopy,
    station.areaAbout ?? "",
    station.stationIntro ?? "",
    ...station.spots.slice(0, 6).map((s) => s.name),
  ].join("");
  if (/デルタ|川|河|橋/.test(blob)) return "water";
  if (/港|海|潮|浜/.test(blob)) return "tide";
  if (/城/.test(blob)) return "castle";
  if (/神社|神宮|大社|寺/.test(blob)) return "shrine";
  if (/市場|食堂|パン/.test(blob)) return "food";
  return "town";
}

function temperatureTitle(kind: Temperature): string {
  switch (kind) {
    case "water":
      return "川の端";
    case "tide":
      return "潮の手前";
    case "shrine":
      return "社の前";
    case "food":
      return "食べもののほう";
    case "castle":
      return "城の影";
    default:
      return "町の入口";
  }
}

function temperatureClause(kind: Temperature): string {
  switch (kind) {
    case "water":
      return "川の音から入る";
    case "tide":
      return "潮のにおいから入る";
    case "shrine":
      return "社の静けさから入る";
    case "food":
      return "食べものから入る";
    case "castle":
      return "城の影から入る";
    default:
      return "町の通りから入る";
  }
}

/** 到着の最初の一文。型は同じでも、駅の言葉の温度で選ぶ。 */
export function arrivalFragment(
  station: StationSeed,
  date = new Date(),
): { title: string; line: string } | null {
  const bare = bareName(station.name);
  const face = station.spots.find(
    (s) =>
      (s.majorWorthy || s.guide === "sight") &&
      !s.id.startsWith("reach-") &&
      !/長徳寺|法性寺|西園寺/.test(s.name),
  )?.name;
  const day = Math.floor(date.getTime() / 86_400_000);
  let seed = day;
  for (const ch of station.id) seed += ch.codePointAt(0) ?? 0;
  const own = warmestSentence(station, face, bare, seed);
  const kind = temperatureKind(station);
  if (own) return { title: temperatureTitle(kind), line: own };
  const copy = station.catchCopy.trim();
  const clause = temperatureClause(kind);
  if (copy.length >= 8 && !copy.includes("予定のない寄り道")) {
    return { title: temperatureTitle(kind), line: `${bare}は、${clause}。${copy}` };
  }
  if (face) {
    return {
      title: temperatureTitle(kind),
      line: `${bare}は、${clause}。最初に向かうのは${face}。`,
    };
  }
  return { title: temperatureTitle(kind), line: `${bare}は、${clause}。` };
}

function warmestSentence(
  station: StationSeed,
  face: string | undefined,
  bare: string,
  seed: number,
): string | null {
  const pool = [
    ...loreSentences(station.catchCopy),
    ...(station.historyNotes ?? []).flatMap((n) => loreSentences(n.body)),
    ...loreSentences(station.areaAbout),
    ...loreSentences(station.stationIntro),
    ...(station.sightseeingNotes ?? []).flatMap((n) => loreSentences(n.body)),
  ];
  const scored = pool
    .map((line) => {
      let score = 0;
      if (face && line.includes(face)) score += 18;
      const key = face?.slice(0, 4) ?? "";
      if (key.length >= 2 && line.includes(key)) score += 10;
      if (line.includes(bare)) score += 8;
      if (/音|匂い|におい|光|風|川|湯|森|潮|石|雨|影|静/.test(line)) score += 16;
      if (/要確認|徒歩|あります|ご確認|案内します|おすすめ/.test(line)) score -= 24;
      return { line, score };
    })
    .filter((row) => row.score >= 12 && row.line.length >= 12 && row.line.length <= 80);
  if (!scored.length) return null;
  const best = Math.max(...scored.map((row) => row.score));
  const ties = scored.filter((row) => row.score === best).map((row) => row.line);
  return ties[seed % ties.length] ?? null;
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

/** 土地ページ本文を一塊にした検索用テキスト。 */
export function landCorpus(station: StationSeed): string {
  return [
    station.stationIntro,
    station.areaAbout,
    station.walkGuide,
    station.catchCopy,
    ...(station.historyNotes ?? []).flatMap((n) => [n.title, n.body]),
    ...(station.sightseeingNotes ?? []).flatMap((n) => [n.title, n.body]),
  ]
    .filter(Boolean)
    .join("\n");
}

/** 土地紹介で触れた場所／土地の顔。案内・歩く・地図の正本。 */
export function introducedVisitSpots(station: StationSeed): Spot[] {
  const corpus = landCorpus(station);
  const spots = station.spots ?? [];
  const picks: Spot[] = [];
  const seen = new Set<string>();
  for (const spot of spots) {
    if (spot.name.endsWith("駅")) continue;
    const key = spot.name.replace(/\s+/g, "");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const namedInLand = nameKeys(spot.name).some(
      (k) => k.length >= 2 && corpus.includes(k),
    );
    if (spot.majorWorthy || namedInLand) {
      picks.push(spot);
    }
  }
  if (picks.length === 0) {
    return spots.filter((s) => s.majorWorthy && !s.name.endsWith("駅"));
  }
  return picks.sort((a, b) => {
    if (a.majorWorthy !== b.majorWorthy) return a.majorWorthy ? -1 : 1;
    if (a.walkMinutes !== b.walkMinutes) return a.walkMinutes - b.walkMinutes;
    return a.name.localeCompare(b.name, "ja");
  });
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
