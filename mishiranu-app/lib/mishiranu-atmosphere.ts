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

/** 観光地名の捏造っぽい名前（空白埋め禁止）。 */
export function isInventedTouristCorridorName(name: string): boolean {
  const n = name.trim();
  if (!n) return true;
  if (/城下町/.test(n)) return true;
  if (/観光案内|観光スポット|名所めぐり/.test(n)) return true;
  if (/^(商店街|市場)$/.test(n)) return true;
  return false;
}

/** 名もなき微地形の雛形（固有名所を付けない）。 */
const BLANK_MICRO: Array<{
  idSuffix: string;
  name: string;
  kind: string;
  blurb: string;
  bearingDeg: number;
  meters: number;
  walkMinutes: number;
}> = [
  {
    idSuffix: "rail-side",
    name: "線路沿いの細道",
    kind: "road",
    blurb:
      "何もないからこそ、線路と並ぶ細い道の傾斜と風の通り道だけを感じて駅へ戻る区間。",
    bearingDeg: 18,
    meters: 140,
    walkMinutes: 6,
  },
  {
    idSuffix: "ditch-low",
    name: "用水の低い道",
    kind: "road",
    blurb:
      "土地がわずかに低くなる用水沿い。名前のない高低差が、駅名のラベルを薄くする。",
    bearingDeg: 125,
    meters: 120,
    walkMinutes: 5,
  },
  {
    idSuffix: "field-edge",
    name: "畑に変わる境目",
    kind: "streetscape",
    blurb:
      "住宅の気配が途切れ、畑や空き地へ開く境目。用事のない角を曲がって、また駅へ帰る。",
    bearingDeg: 230,
    meters: 130,
    walkMinutes: 7,
  },
];

function offsetFromStation(
  station: StationSeed,
  bearingDeg: number,
  meters: number,
): { lat: number; lng: number } {
  const origin = stationLatLng(station);
  const rad = (bearingDeg * Math.PI) / 180;
  const dLat = (meters / 111_320) * Math.cos(rad);
  const dLng =
    (meters / (111_320 * Math.cos((origin.lat * Math.PI) / 180))) *
    Math.sin(rad);
  return { lat: origin.lat + dLat, lng: origin.lng + dLng };
}

/** 商店街も名所も無い駅向け。最大3本。 */
export function namelessBlankCorridors(
  station: StationSeed,
  count = 3,
): AtmosphereCorridor[] {
  const bare = bareName(station.name);
  return BLANK_MICRO.slice(0, Math.max(0, Math.min(3, count))).map((t) => {
    const mid = offsetFromStation(station, t.bearingDeg, t.meters * 0.55);
    return {
      id: `blank-${bare}-${t.idSuffix}`,
      name: t.name,
      kind: t.kind,
      blurb: t.blurb,
      path: shortPath(station, mid, t.meters),
      relatedSpotNames: [],
      walkMinutes: t.walkMinutes,
    };
  });
}

export function sanitizeCorridor(
  raw: Partial<AtmosphereCorridor> & {
    name?: string;
    path?: Array<{ lat?: number; lng?: number }>;
  },
  station: StationSeed,
  index: number,
): AtmosphereCorridor | null {
  const name = (raw.name ?? "").trim();
  if (!name || isInventedTouristCorridorName(name)) return null;
  let kind = (raw.kind ?? "road").trim() || "road";
  if (!["arcade", "streetscape", "riverside", "road"].includes(kind)) {
    kind = "road";
  }
  // 根拠の薄い arcade / riverside は road に落とす（空白駅の捏造防止）
  if (kind === "arcade" && !/商店街|商店会|市場|アーケード/.test(name)) {
    kind = "road";
  }
  if (
    kind === "riverside" &&
    !/川|用水|河|デルタ|堤|河原|川辺|川端/.test(name + (raw.blurb ?? ""))
  ) {
    kind = "road";
  }
  const bare = bareName(station.name);
  const pathRaw = Array.isArray(raw.path) ? raw.path : [];
  const path = pathRaw
    .map((p) => ({
      lat: typeof p.lat === "number" ? p.lat : NaN,
      lng: typeof p.lng === "number" ? p.lng : NaN,
    }))
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  const origin = stationLatLng(station);
  const finalPath =
    path.length >= 2
      ? path.slice(0, 6)
      : shortPath(
          station,
          path[0] ?? offsetFromStation(station, 40 + index * 70, 90),
          110,
        );
  // 駅から離れすぎ／ゼロ距離は捨ててフォールバック帯に
  const mid = finalPath[Math.floor(finalPath.length / 2)] ?? origin;
  const km = haversineKm(origin, mid);
  if (km > 1.6) {
    return null;
  }
  const blurb = (raw.blurb ?? "").trim() ||
    "名前のない道を通り、足元の傾斜と風だけを感じて駅へ戻る。";
  const related = Array.isArray(raw.relatedSpotNames)
    ? raw.relatedSpotNames.filter((s) => typeof s === "string" && s.length >= 2)
    : [];
  return {
    id:
      typeof raw.id === "string" && raw.id.trim()
        ? raw.id.trim()
        : `ai-${bare}-corridor-${index + 1}`,
    name,
    kind,
    blurb,
    path: finalPath,
    relatedSpotNames: related,
    walkMinutes: Math.max(
      3,
      Math.min(15, Math.round(Number(raw.walkMinutes) || 6)),
    ),
  };
}

export function corridorsForStation(station: StationSeed): AtmosphereCorridor[] {
  const bare = bareName(station.name);
  const isDemachi = bare.includes("出町柳") || station.name.includes("出町柳");
  const list: AtmosphereCorridor[] = isDemachi ? [...DEMACHI] : [];
  const names = new Set(list.map((c) => c.name));

  // API／正本の区間（出町正本のあとに足す）
  for (const [i, raw] of (station.corridors ?? []).entries()) {
    const c = sanitizeCorridor(raw, station, i);
    if (!c || names.has(c.name)) continue;
    list.push(c);
    names.add(c.name);
  }

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

  // 空白駅: 名所・商店街が無くても名もなき微地形を芯にする（最大3）
  if (!isDemachi && list.length < 2) {
    for (const blank of namelessBlankCorridors(station, 3)) {
      if (names.has(blank.name)) continue;
      list.push(blank);
      names.add(blank.name);
      if (list.length >= 3) break;
    }
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
