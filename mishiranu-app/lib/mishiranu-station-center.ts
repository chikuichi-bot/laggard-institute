/**
 * 駅中心の照合。AI の lat/lng は数百 m ずれる（藤森 約800m）ので、
 * OpenStreetMap の鉄道駅（railway=station）で上書きしてから返す・置く。
 *
 * Nominatim の利用規約: 1 秒 1 件以下・UA 必須。駅を新しく作るときと
 * 古いキャッシュを返すときだけ呼ぶので、この頻度に収まる。
 */
import type { StationSeed } from "@/data/mishiranu-stations";
import { haversineKm } from "@/lib/mishiranu-geo";

const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const UA = "MishiranuEki/1.0 (+https://lagado.jp/mishiranu-orikata/)";
const TIMEOUT_MS = 4_000;
/** 同名駅が全国にあるので、AI 中心からこれ以上遠い駅は別駅とみなす。 */
const MAX_JUMP_KM = 25;
/** これより近ければ直さない（駅舎の代表点の差）。 */
const SAME_KM = 0.05;

type NominatimHit = {
  category?: string;
  type?: string;
  name?: string;
  lat: string;
  lon: string;
};

/** 出町柳のように駅ノードが無く駅舎（building=train_station）だけの駅もある。バス停は除く。 */
function isRailStation(h: NominatimHit): boolean {
  if (h.category === "railway") return h.type === "station" || h.type === "halt";
  if (h.category === "building") return h.type === "train_station";
  return false;
}

function bare(name: string): string {
  return name.normalize("NFKC").replace(/\s+/gu, "").replace(/駅$/u, "");
}

async function searchStations(query: string): Promise<NominatimHit[]> {
  const url = `${NOMINATIM}?${new URLSearchParams({
    q: query,
    format: "jsonv2",
    countrycodes: "jp",
    limit: "10",
  })}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, "Accept-Language": "ja" },
      signal: controller.signal,
    });
    if (!res.ok) return [];
    const rows = (await res.json()) as NominatimHit[];
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

const memo = new Map<string, { lat: number; lng: number } | null>();

/** OSM で確かめた駅中心。見つからなければ null（AI 座標のまま）。 */
export async function verifiedStationCenter(
  station: Pick<StationSeed, "name" | "prefecture" | "lat" | "lng">,
): Promise<{ lat: number; lng: number } | null> {
  const want = bare(station.name);
  if (!want) return null;
  const key = `${want}|${station.prefecture ?? ""}`;
  if (memo.has(key)) return memo.get(key) ?? null;
  const found = await lookupCenter(station, want);
  memo.set(key, found);
  return found;
}

async function lookupCenter(
  station: Pick<StationSeed, "name" | "prefecture" | "lat" | "lng">,
  want: string,
): Promise<{ lat: number; lng: number } | null> {
  const queries = [
    station.prefecture ? `${want}駅 ${station.prefecture}` : "",
    `${want}駅`,
  ].filter(Boolean);

  const seed =
    typeof station.lat === "number" && typeof station.lng === "number"
      ? { lat: station.lat, lng: station.lng }
      : null;

  for (const query of queries) {
    const hits = (await searchStations(query))
      .filter((h) => isRailStation(h) && bare(h.name ?? "") === want)
      .map((h) => ({ lat: Number(h.lat), lng: Number(h.lon) }))
      .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
    if (hits.length === 0) continue;
    if (!seed) return hits[0];
    const nearest = hits
      .map((p) => ({ p, km: haversineKm(seed, p) }))
      .sort((a, b) => a.km - b.km)[0];
    if (nearest.km <= MAX_JUMP_KM) return nearest.p;
  }
  return null;
}

/** 駅中心だけ正本に直す。直したら true。スポットの座標はアプリ側で照合する。 */
export async function withVerifiedCenter(
  station: StationSeed,
): Promise<{ station: StationSeed; moved: boolean }> {
  const center = await verifiedStationCenter(station);
  if (!center) return { station, moved: false };
  if (
    typeof station.lat === "number" &&
    typeof station.lng === "number" &&
    haversineKm({ lat: station.lat, lng: station.lng }, center) < SAME_KM
  ) {
    return { station, moved: false };
  }
  return { station: { ...station, lat: center.lat, lng: center.lng }, moved: true };
}
