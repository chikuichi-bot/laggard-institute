/**
 * 粋な寄り道（相国寺→同志社型）。
 * 最短ナビを勝たせず、土地らしい経由をコースと道なりに載せる。
 * 出町固有ではなく、検索生成のどの駅でも使う。
 */
import type { Spot, StationSeed } from "@/data/mishiranu-stations";
import {
  corridorsForStation,
  type AtmosphereCorridor,
} from "@/lib/mishiranu-atmosphere";
import { haversineKm, stationLatLng } from "@/lib/mishiranu-geo";

export type PreferredDetour = {
  id: string;
  name: string;
  beforeKeys: string[];
  blurb: string;
  lat: number;
  lng: number;
  path: Array<{ lat: number; lng: number }>;
  walkMinutes: number;
};

function bare(name: string): string {
  return name.replace(/駅$/u, "").trim();
}

function nameHit(hay: string, needle: string): boolean {
  const a = hay.trim();
  const b = needle.trim();
  if (a.length < 2 || b.length < 2) return false;
  return a.includes(b) || b.includes(a);
}

function spotMatchesKeys(spot: Spot, keys: string[]): boolean {
  return keys.some((k) => nameHit(spot.name, k));
}

/** 「Xの境内からYへ」型の名前から beforeKeys を推定。 */
export function inferWeaveBeforeKeys(
  name: string,
  related: string[],
): string[] {
  const fromTo = name.match(
    /(?:から|より)\s*(.+?)(?:へ|まで|へ向か|方面)/u,
  );
  if (fromTo?.[1]) {
    const key = fromTo[1].replace(/大学|神社|寺|駅$/u, "").trim();
    if (key.length >= 2) return [key];
  }
  // related の後半を目的地候補（経由名と違うもの）
  const viaHints = [name, ...related.slice(0, 1)];
  const dests = related.filter(
    (r) => r.length >= 2 && !viaHints.some((v) => nameHit(v, r)),
  );
  return dests.slice(0, 3);
}

/** 区間名から寄り道スポット名を取り出す（「相国寺の境内から同志社へ」→「相国寺」）。 */
export function viaNameFromCorridor(corridor: AtmosphereCorridor): string {
  const m = corridor.name.match(
    /^(.+?)(?:の境内|の中|沿い|を通|経由|から)/u,
  );
  if (m?.[1] && m[1].length >= 2 && m[1].length <= 20) return m[1].trim();
  const first = corridor.relatedSpotNames.find((r) => {
    const before = inferWeaveBeforeKeys(corridor.name, corridor.relatedSpotNames);
    return !before.some((k) => nameHit(r, k));
  });
  if (first) return first;
  return corridor.name.length <= 16 ? corridor.name : corridor.name.slice(0, 12);
}

export function detourFromCorridor(
  corridor: AtmosphereCorridor,
): PreferredDetour | null {
  const beforeKeys =
    (corridor.weaveBeforeKeys?.length
      ? corridor.weaveBeforeKeys
      : inferWeaveBeforeKeys(corridor.name, corridor.relatedSpotNames)
    ).filter((k) => k.length >= 2);
  if (!beforeKeys.length) return null;
  // 名もなき微地形だけの区間は「目的地の前に挟む寄り道」にしない
  if (
    /線路沿い|用水の低い|畑に変わる|名もなき|擁壁/.test(corridor.name) &&
    !(corridor.weaveBeforeKeys?.length)
  ) {
    return null;
  }
  const mid =
    corridor.path[Math.floor(corridor.path.length / 2)] ?? corridor.path[0];
  if (!mid) return null;
  const name = viaNameFromCorridor(corridor);
  // 経由名が目的地キーと同じなら無効
  if (beforeKeys.some((k) => nameHit(name, k))) return null;
  return {
    id: corridor.id || `detour-${name}`,
    name,
    beforeKeys,
    blurb: corridor.blurb,
    lat: mid.lat,
    lng: mid.lng,
    path: corridor.path,
    walkMinutes: corridor.walkMinutes || 8,
  };
}

export function parsePreferredDetours(
  raw: unknown,
  station: StationSeed,
  limit = 3,
): PreferredDetour[] {
  if (!Array.isArray(raw)) return [];
  const origin = stationLatLng(station);
  const out: PreferredDetour[] = [];
  const names = new Set<string>();
  for (const [i, item] of raw.entries()) {
    if (out.length >= limit) break;
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const name = String(o.name ?? "").trim();
    if (name.length < 2 || name.length > 24) continue;
    if (/城下町|観光スポット|名所めぐり/.test(name)) continue;
    const beforeKeys = (
      Array.isArray(o.beforeKeys)
        ? o.beforeKeys
        : Array.isArray(o.weaveBeforeKeys)
          ? o.weaveBeforeKeys
          : []
    )
      .map((k) => String(k).trim())
      .filter((k) => k.length >= 2)
      .slice(0, 4);
    if (!beforeKeys.length) continue;
    if (beforeKeys.some((k) => nameHit(name, k))) continue;
    const lat = Number(o.lat);
    const lng = Number(o.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (haversineKm(origin, { lat, lng }) > 1.8) continue;
    const pathRaw = Array.isArray(o.path) ? o.path : [];
    const path = pathRaw
      .map((p) => {
        if (!p || typeof p !== "object") return null;
        const c = p as Record<string, unknown>;
        const plat = Number(c.lat);
        const plng = Number(c.lng);
        if (!Number.isFinite(plat) || !Number.isFinite(plng)) return null;
        return { lat: plat, lng: plng };
      })
      .filter((p): p is { lat: number; lng: number } => !!p)
      .slice(0, 6);
    const finalPath =
      path.length >= 2
        ? path
        : [
            { lat: lat + 0.00035, lng: lng + 0.0002 },
            { lat, lng },
            { lat: lat - 0.00025, lng: lng - 0.00035 },
          ];
    if (names.has(name)) continue;
    names.add(name);
    out.push({
      id:
        typeof o.id === "string" && o.id.trim()
          ? o.id.trim()
          : `preferred-${bare(station.name)}-${i + 1}`,
      name,
      beforeKeys,
      blurb:
        String(o.blurb ?? "").trim() ||
        `${name}を通る寄り道。最短より、土地らしい。`,
      lat,
      lng,
      path: finalPath,
      walkMinutes: Math.max(
        4,
        Math.min(18, Math.round(Number(o.walkMinutes) || 8)),
      ),
    });
  }
  return out;
}

export function corridorFromPreferredDetour(
  d: PreferredDetour,
): AtmosphereCorridor {
  return {
    id: d.id,
    name: `${d.name}から${d.beforeKeys[0] ?? "目的地"}へ`,
    kind: /寺|神社|廟|院/.test(d.name)
      ? "streetscape"
      : /川|河|用水|デルタ|堤/.test(d.name)
        ? "riverside"
        : /商店街|市場|アーケード/.test(d.name)
          ? "arcade"
          : "road",
    blurb: d.blurb,
    path: d.path,
    relatedSpotNames: [d.name, ...d.beforeKeys],
    walkMinutes: d.walkMinutes,
    weaveBeforeKeys: d.beforeKeys,
  };
}

/** corridors ∪ preferredDetours から、コースに織り込む寄り道一覧。 */
export function collectPreferredDetours(
  station: StationSeed,
): PreferredDetour[] {
  const fromField = parsePreferredDetours(
    (station as StationSeed & { preferredDetours?: unknown }).preferredDetours,
    station,
  );
  const fromCorridors = corridorsForStation(station)
    .map(detourFromCorridor)
    .filter((d): d is PreferredDetour => !!d);

  const out: PreferredDetour[] = [];
  const seen = new Set<string>();
  for (const d of [...fromField, ...fromCorridors]) {
    const key = `${d.name}|${d.beforeKeys.join(",")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(d);
    if (out.length >= 4) break;
  }
  return out;
}

function makeDetourSpot(d: PreferredDetour, station: StationSeed): Spot {
  const origin = stationLatLng(station);
  return {
    id: d.id.startsWith("preferred-") || d.id.includes("detour")
      ? d.id
      : `detour-${d.id}`,
    name: d.name,
    genre: /川|河|公園|デルタ|堤|坂/.test(d.name) ? "nature" : "history",
    guide: "sight",
    mealTier: "casual",
    mealTimes: [],
    soloOk: true,
    budgetYen: "—",
    hours: "終日（屋外・境内は現地の案内に従う）",
    blurb: d.blurb,
    detail: "最短より、土地らしい寄り道として通る。",
    walkMinutes: d.walkMinutes,
    secretWorthy: false,
    majorWorthy: true,
    lat: d.lat,
    lng: d.lng,
    x: Math.min(0.92, Math.max(0.08, 0.5 + (d.lng - origin.lng) * 80)),
    y: Math.min(0.92, Math.max(0.08, 0.5 - (d.lat - origin.lat) * 80)),
    coordTrust: "lock",
  };
}

/**
 * 目的地の直前に粋な寄り道を挟む（無いときは作る／あるときは並べ替え）。
 * 出町の相国寺→同志社も含む汎用版。
 */
export function weavePreferredDetours(
  spots: Spot[],
  station: StationSeed,
): Spot[] {
  let out = [...spots];
  for (const d of collectPreferredDetours(station)) {
    const destIdx = out.findIndex((s) => spotMatchesKeys(s, d.beforeKeys));
    if (destIdx < 0) continue;

    const existingIdx = out.findIndex((s) => nameHit(s.name, d.name));
    if (existingIdx >= 0) {
      if (existingIdx === destIdx - 1) continue;
      const [via] = out.splice(existingIdx, 1);
      let newDest = out.findIndex((s) => spotMatchesKeys(s, d.beforeKeys));
      if (newDest < 0) {
        newDest = Math.max(0, Math.min(out.length, destIdx));
      }
      out.splice(newDest, 0, via!);
      continue;
    }

    const via = makeDetourSpot(d, station);
    out.splice(destIdx, 0, via);
  }
  return out;
}

/**
 * preferredDetours を corridors にマージし、spots にも顔として足す。
 * finalize / seal 用。
 */
export function sealPreferredDetours(station: StationSeed): StationSeed {
  const detours = collectPreferredDetours(station);
  if (!detours.length) return station;

  const corridorNames = new Set((station.corridors ?? []).map((c) => c.name));
  const extraCorridors = detours
    .map(corridorFromPreferredDetour)
    .filter((c) => !corridorNames.has(c.name));

  const spotNames = station.spots.map((s) => s.name);
  const extraSpots = detours
    .filter((d) => !spotNames.some((n) => nameHit(n, d.name)))
    .map((d) => makeDetourSpot(d, station));

  const corridors = [...extraCorridors, ...(station.corridors ?? [])].slice(
    0,
    5,
  );

  // preferredDetours は corridors に織り込たのでフィールドは落とさず残してもよいが、
  // StationSeed 公式型外なのでレスポンス肥大を避けて落とす
  const { preferredDetours: _drop, ...rest } = station as StationSeed & {
    preferredDetours?: unknown;
  };
  void _drop;

  return {
    ...rest,
    corridors,
    spots: [...extraSpots, ...station.spots],
  };
}
