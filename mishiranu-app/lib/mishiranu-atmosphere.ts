import type { Spot, StationSeed } from "@/data/mishiranu-stations";
import { haversineKm, stationLatLng } from "@/lib/mishiranu-geo";
import anchorsFile from "@/data/land-present-anchors.json";

export type AtmosphereCorridor = {
  id: string;
  name: string;
  kind: string;
  blurb: string;
  path: Array<{ lat: number; lng: number }>;
  relatedSpotNames: string[];
  walkMinutes: number;
};

export const ATMOSPHERE_PREF_KEY = "mishiranu.atmosphereFirst";

export function loadAtmosphereFirst(): boolean {
  if (typeof window === "undefined") return true;
  const raw = window.localStorage.getItem(ATMOSPHERE_PREF_KEY);
  if (raw === null) return true;
  return raw === "1";
}

export function saveAtmosphereFirst(on: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ATMOSPHERE_PREF_KEY, on ? "1" : "0");
}

function bareName(name: string): string {
  return name.replace(/駅$/u, "").trim();
}

const DEMACHI: AtmosphereCorridor[] = [
  {
    id: "demachi-masugata-arcade",
    name: "枡形商店街",
    kind: "arcade",
    blurb:
      "短いアーケードを一本通り抜ける。店の点ではなく、道幅と人の密度そのものが土地の顔。",
    path: [
      { lat: 35.02995, lng: 135.77015 },
      { lat: 35.03025, lng: 135.76944 },
      { lat: 35.03048, lng: 135.76895 },
    ],
    relatedSpotNames: ["枡形商店街", "桝形商店街", "枡形", "ふたば", "満寿形"],
    walkMinutes: 4,
  },
  {
    id: "demachi-sabakaido-approach",
    name: "鯖街道の着き口まわり",
    kind: "streetscape",
    blurb:
      "若狭から塩鯖が都へ入る最後の町場だった記憶が、枡形の名と細い道に残る。名所の点ではなく、曲がり角ごとの気配を歩く。",
    path: [
      { lat: 35.03005, lng: 135.7698 },
      { lat: 35.03055, lng: 135.7691 },
      { lat: 35.031, lng: 135.7687 },
    ],
    relatedSpotNames: ["枡形", "鯖街道", "若狭街道", "町場"],
    walkMinutes: 6,
  },
  {
    id: "demachi-delta-bank",
    name: "鴨川デルタの川辺",
    kind: "riverside",
    blurb:
      "二つの川が一つになる三角の縁。水音と空の広がりが、駅名のラベルを薄くする。",
    path: [
      { lat: 35.0304, lng: 135.7712 },
      { lat: 35.03012, lng: 135.77174 },
      { lat: 35.0297, lng: 135.7721 },
    ],
    relatedSpotNames: ["鴨川デルタ", "デルタ", "河川敷", "三角州", "鴨川"],
    walkMinutes: 5,
  },
];

export function isAtmosphereSpot(spot: Spot): boolean {
  const n = spot.name;
  if (/商店街|商店会|市場/.test(n)) return true;
  if (/街並み|町並み|鯖街道/.test(n)) return true;
  if (/通り|川端|河川敷|デルタ|三角州/.test(n)) return true;
  return false;
}

function related(spot: Spot, corridor: AtmosphereCorridor): boolean {
  if (spot.name.includes(corridor.name) || corridor.name.includes(spot.name)) {
    return true;
  }
  return corridor.relatedSpotNames.some(
    (key) => key.length >= 2 && (spot.name.includes(key) || key.includes(spot.name)),
  );
}

function shortPath(
  station: StationSeed,
  mid: { lat: number; lng: number },
  meters: number,
): Array<{ lat: number; lng: number }> {
  const origin = stationLatLng(station);
  const dLat = mid.lat - origin.lat;
  const dLng = mid.lng - origin.lng;
  const dist = Math.max(haversineKm(origin, mid), 0.05);
  const scale = meters / 1000 / dist;
  return [
    { lat: mid.lat - dLat * scale * 0.45, lng: mid.lng - dLng * scale * 0.45 },
    mid,
    { lat: mid.lat + dLat * scale, lng: mid.lng + dLng * scale },
  ];
}

function deriveFromAnchors(station: StationSeed): AtmosphereCorridor[] {
  const bare = bareName(station.name);
  const rows = (anchorsFile as { stations: Array<{ station: string; anchors: Array<{
    name: string;
    kind: string;
    present: string;
    aliases?: string[];
    walkMinutes?: number;
    lat?: number;
    lng?: number;
  }> }> }).stations;
  const row = rows.find((r) => {
    const key = bareName(r.station);
    return bare === key || bare.includes(key) || key.includes(bare);
  });
  if (!row) return [];
  return row.anchors.flatMap((anchor) => {
    if (!["arcade", "road", "river"].includes(anchor.kind)) return [];
    if (anchor.lat == null || anchor.lng == null) return [];
    const kind =
      anchor.kind === "arcade"
        ? "arcade"
        : anchor.kind === "river"
          ? "riverside"
          : "road";
    return [
      {
        id: `anchor-${bare}-${anchor.name}`,
        name: anchor.name,
        kind,
        blurb: anchor.present,
        path: shortPath(station, { lat: anchor.lat, lng: anchor.lng }, kind === "arcade" ? 90 : 120),
        relatedSpotNames: [anchor.name, ...(anchor.aliases ?? [])],
        walkMinutes: anchor.walkMinutes ?? 5,
      },
    ];
  });
}

export function corridorsForStation(station: StationSeed): AtmosphereCorridor[] {
  const bare = bareName(station.name);
  const list: AtmosphereCorridor[] =
    bare.includes("出町柳") || station.name.includes("出町柳")
      ? [...DEMACHI]
      : [];
  const names = new Set(list.map((c) => c.name));
  for (const derived of deriveFromAnchors(station)) {
    if (!names.has(derived.name)) {
      list.push(derived);
      names.add(derived.name);
    }
  }
  for (const spot of station.spots ?? []) {
    if (!isAtmosphereSpot(spot) || spot.lat == null || spot.lng == null) continue;
    if (names.has(spot.name)) continue;
    const kind = /商店街/.test(spot.name)
      ? "arcade"
      : /デルタ|川/.test(spot.name)
        ? "riverside"
        : /街並|町並|鯖街道/.test(spot.name)
          ? "streetscape"
          : "road";
    list.push({
      id: `spot-${spot.id}`,
      name: spot.name,
      kind,
      blurb: spot.blurb ?? "",
      path: shortPath(station, { lat: spot.lat, lng: spot.lng }, 100),
      relatedSpotNames: [spot.name],
      walkMinutes: Math.max(3, Math.min(12, spot.walkMinutes ?? 5)),
    });
    names.add(spot.name);
  }
  return list;
}

export function corridorsMatching(
  station: StationSeed,
  spots: Spot[],
  preferAtmosphere: boolean,
): AtmosphereCorridor[] {
  const all = corridorsForStation(station);
  if (!preferAtmosphere) {
    return all.filter((c) => spots.some((s) => related(s, c)));
  }
  const matched = all.filter((c) => spots.some((s) => related(s, c)));
  if (matched.length) return matched;
  return all.slice(0, 3);
}

export function prioritizeAtmosphereSpots(
  spots: Spot[],
  corridors: AtmosphereCorridor[],
  preferAtmosphere: boolean,
): Spot[] {
  if (!preferAtmosphere || !spots.length) return spots;
  return spots
    .map((spot, offset) => ({ spot, offset, score: scoreSpot(spot, corridors) }))
    .sort((a, b) => b.score - a.score || a.offset - b.offset)
    .map((x) => x.spot);
}

function scoreSpot(spot: Spot, corridors: AtmosphereCorridor[]): number {
  let score = 0;
  if (isAtmosphereSpot(spot)) score += 4;
  const guide = spot.guide ?? "";
  if (guide === "meal" || guide === "souvenir") score -= 2;
  if (corridors.some((c) => related(spot, c))) score += 5;
  return score;
}
