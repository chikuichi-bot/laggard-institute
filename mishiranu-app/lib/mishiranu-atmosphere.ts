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
  /**
   * 粋な寄り道: コース上でこのキーに当たる目的地の直前に、
   * この区間（経由スポット）を挟む。例: 相国寺→["同志社"]。
   */
  weaveBeforeKeys?: string[];
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
    // 正本ロック 35.030249, 135.769436。端を広げすぎると目印がずれる。
    path: [
      { lat: 35.03018, lng: 135.76978 },
      { lat: 35.030249, lng: 135.769436 },
      { lat: 35.03032, lng: 135.7691 },
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
      { lat: 35.03012, lng: 135.7697 },
      { lat: 35.030249, lng: 135.769436 },
      { lat: 35.0304, lng: 135.76915 },
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
  {
    id: "demachi-shokokuji-to-doshisha",
    name: "相国寺の境内から同志社へ",
    kind: "grounds",
    blurb:
      "同志社へ向かうとき、今出川の南回りより境内の木立を東西に通る。無駄な寄り道が土地らしい。",
    path: [
      { lat: 35.03305, lng: 135.7642 },
      { lat: 35.03325, lng: 135.7627 },
      { lat: 35.03255, lng: 135.76135 },
      { lat: 35.02971, lng: 135.76072 },
    ],
    relatedSpotNames: ["相国寺", "同志社大学", "同志社", "今出川"],
    walkMinutes: 10,
    weaveBeforeKeys: ["同志社"],
  },
];

/** お寺・神社・公園・城跡など、外周ではなく敷地内を歩きたい場所。 */
export function isGroundsExplorableName(name: string): boolean {
  const n = name.trim();
  if (n.length < 2) return false;
  if (/本店|食堂|茶屋|カフェ|喫茶|旅館|ホテル|弁当/.test(n)) return false;
  if (/城跡|城址|史跡/.test(n)) return true;
  if (/公園|庭園|御苑|植物園/.test(n)) return true;
  if (/神社|神宮|大社|天満宮/.test(n)) return true;
  if (/寺$|院$|寺院|仁王門/.test(n)) return true;
  if (/境内|参道/.test(n)) return true;
  return false;
}

function groundsRadiusMeters(name: string, walkMinutes: number): number {
  let base = 62;
  if (/城跡|城址|公園|御苑/.test(name)) base = 95;
  else if (/庭園|植物園/.test(name)) base = 80;
  else if (/神社|神宮/.test(name)) base = 70;
  const fromWalk = Math.max(4, Math.min(18, walkMinutes)) * 5.5;
  return Math.min(140, Math.max(base, fromWalk));
}

/** ピン周辺の敷地内一周（北東入口寄りから時計回り）。 */
export function groundsLoopPath(
  center: { lat: number; lng: number },
  radiusMeters: number,
  count = 7,
): Array<{ lat: number; lng: number }> {
  const n = Math.max(5, Math.min(10, count));
  const cosLat = Math.max(Math.cos((center.lat * Math.PI) / 180), 0.2);
  return Array.from({ length: n }, (_, i) => {
    const ang = -Math.PI / 4 + (i * 2 * Math.PI) / n;
    const rLat = radiusMeters * (0.92 + 0.08 * Math.cos(ang * 2));
    const rLng = radiusMeters * 1.12;
    return {
      lat: center.lat + (rLat * Math.cos(ang)) / 111_320,
      lng: center.lng + (rLng * Math.sin(ang)) / (111_320 * cosLat),
    };
  });
}

export function groundsCorridorForSpot(spot: Spot): AtmosphereCorridor | null {
  if (!isGroundsExplorableName(spot.name)) return null;
  if (spot.lat == null || spot.lng == null) return null;
  if (spot.lat === 0 && spot.lng === 0) return null;
  const walk = spot.walkMinutes ?? 8;
  const radius = groundsRadiusMeters(spot.name, walk);
  return {
    id: `grounds-${spot.id}`,
    name: `${spot.name}の敷地内`,
    kind: "grounds",
    blurb: `外周の車道ではなく、${spot.name}の敷地・園内を通って歩く。`,
    path: groundsLoopPath({ lat: spot.lat, lng: spot.lng }, radius),
    relatedSpotNames: [spot.name],
    walkMinutes: Math.max(5, Math.min(16, walk || 8)),
  };
}

export function groundsCorridorsForSpots(spots: Spot[]): AtmosphereCorridor[] {
  const out: AtmosphereCorridor[] = [];
  const seen = new Set<string>();
  for (const spot of spots) {
    if (seen.has(spot.name)) continue;
    const c = groundsCorridorForSpot(spot);
    if (!c) continue;
    seen.add(spot.name);
    out.push(c);
    if (out.length >= 6) break;
  }
  return out;
}

/** 元田中正本: 歩き方文の「疏水分線の水路沿い」（OSM relation/9491923）。 */
const MOTOTANAKA: AtmosphereCorridor[] = [
  {
    id: "mototanaka-sosui-bunsen",
    name: "琵琶湖疏水分線の水路沿い",
    kind: "riverside",
    blurb:
      "駅の東側を南北に走る疏水分線。点ではなく、水路沿いの小道を一本通る空気。",
    path: [
      { lat: 35.029045, lng: 135.788465 },
      { lat: 35.029907, lng: 135.788278 },
      { lat: 35.030842, lng: 135.788178 },
      { lat: 35.031703, lng: 135.788239 },
      { lat: 35.032533, lng: 135.788832 },
      { lat: 35.033438, lng: 135.788856 },
    ],
    relatedSpotNames: ["琵琶湖疏水分線", "疏水分線", "疏水", "水路"],
    walkMinutes: 10,
  },
];

export function isAtmosphereSpot(spot: Spot): boolean {
  const n = spot.name;
  if (/商店街|商店会|市場/.test(n)) return true;
  if (/街並み|町並み|鯖街道/.test(n)) return true;
  if (/通り|川端|河川敷|デルタ|三角州/.test(n)) return true;
  if (/疏水|疎水|水路/.test(n)) return true;
  if (isGroundsExplorableName(n)) return true;
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
  if (!["arcade", "streetscape", "riverside", "road", "grounds"].includes(kind)) {
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
  if (kind === "grounds" && !isGroundsExplorableName(name)) {
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
      ? path.slice(0, kind === "grounds" ? 10 : 6)
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
  const weaveRaw = Array.isArray(raw.weaveBeforeKeys)
    ? raw.weaveBeforeKeys
    : [];
  const weaveBeforeKeys = weaveRaw
    .filter((s): s is string => typeof s === "string" && s.trim().length >= 2)
    .map((s) => s.trim())
    .slice(0, 4);
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
    ...(weaveBeforeKeys.length ? { weaveBeforeKeys } : {}),
  };
}

export function corridorsForStation(station: StationSeed): AtmosphereCorridor[] {
  const bare = bareName(station.name);
  const isDemachi = bare.includes("出町柳") || station.name.includes("出町柳");
  const isMototanaka = bare.includes("元田中") || station.name.includes("元田中");
  const list: AtmosphereCorridor[] = isDemachi
    ? [...DEMACHI]
    : isMototanaka
      ? [...MOTOTANAKA]
      : [];
  const names = new Set(list.map((c) => c.name));

  // API／正本の区間（出町・元田中正本のあとに足す）
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
    if (isGroundsExplorableName(spot.name)) {
      // grounds は下で専用ループを足す
      continue;
    }
    const kind = /商店街/.test(spot.name)
      ? "arcade"
      : /デルタ|川|疏水|疎水|水路/.test(spot.name)
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

  for (const grounds of groundsCorridorsForSpots(station.spots ?? [])) {
    const tip = grounds.relatedSpotNames[0] ?? grounds.name;
    const already = list.some(
      (c) =>
        c.kind === "grounds" &&
        (c.relatedSpotNames.some(
          (k) => k.length >= 2 && (tip.includes(k) || k.includes(tip)),
        ) ||
          c.name.includes(tip) ||
          tip.includes(c.name)),
    );
    if (already || names.has(grounds.name)) continue;
    list.push(grounds);
    names.add(grounds.name);
  }

  // 空白駅: 名所・商店街が無くても名もなき微地形を芯にする（最大3）
  if (!isDemachi && !isMototanaka && list.length < 2) {
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
