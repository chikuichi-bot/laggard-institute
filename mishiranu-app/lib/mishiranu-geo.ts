import type { Spot, StationSeed } from "@/data/mishiranu-stations";
import coordinatesJson from "@/data/mishiranu-coordinates.json";

type LatLng = { lat: number; lng: number };

type CoordinatesFile = {
  stations: Record<string, LatLng & { source?: string; name?: string }>;
  spots: Record<string, LatLng & { source?: string; name?: string }>;
};

// Next (esModuleInterop) and plain Node JSON require both work.
const coordinates = (
  (coordinatesJson as { default?: CoordinatesFile }).default ?? coordinatesJson
) as CoordinatesFile;

/**
 * Hand-entered fallbacks only used until `scripts/geocode-coordinates.mjs`
 * fills `data/mishiranu-coordinates.json`. Prefer the JSON for every pin.
 */
export const STATION_LL: Record<string, LatLng> = {
  demachiyanagi: { lat: 35.0305, lng: 135.7729 },
  chushojima: { lat: 34.9267, lng: 135.7594 },
  "iwashimizu-hachimangu": { lat: 34.8796, lng: 135.6998 },
  oyamazaki: { lat: 34.8917, lng: 135.6794 },
  biei: { lat: 43.5884, lng: 142.466 },
  kanita: { lat: 41.037, lng: 140.643 },
  ashio: { lat: 36.633, lng: 139.442 },
  sawara: { lat: 35.891, lng: 140.496 },
  manazuru: { lat: 35.157, lng: 139.138 },
  hamakanaya: { lat: 35.155, lng: 139.826 },
  nagatoro: { lat: 36.094, lng: 139.112 },
  katsunuma: { lat: 35.671, lng: 138.729 },
  kobuchizawa: { lat: 35.863, lng: 138.317 },
  obasute: { lat: 36.508, lng: 138.093 },
  shimosuwa: { lat: 36.004, lng: 138.111 },
  yui: { lat: 35.098, lng: 138.556 },
  nebukawa: { lat: 35.202, lng: 139.139 },
  amarube: { lat: 35.652, lng: 134.548 },
  onomichi: { lat: 34.404, lng: 133.193 },
  misumi: { lat: 32.617, lng: 130.463 },
  usuki: { lat: 33.126, lng: 131.805 },
  hitoyoshi: { lat: 32.211, lng: 130.755 },
  tsukazaki: { lat: 35.263, lng: 140.148 },
  tamatsukuri: { lat: 35.421, lng: 132.896 },
};

const EARTH_KM = 6371;

/**
 * Coarsen WGS84 coords before any network call (~1.1 km at the equator).
 * Precise GPS stays in the browser for curated nearest-station matching;
 * the nearby API and Gemini only ever see these rounded values.
 */
export function fuzzLatLngForExternal(
  lat: number,
  lng: number,
): { lat: number; lng: number } {
  const round2 = (n: number) => Math.round(n * 100) / 100;
  return { lat: round2(lat), lng: round2(lng) };
}

export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export type NearestStationHit = {
  station: StationSeed;
  km: number;
};

/** Nearest curated station to a WGS84 point. */
export function findNearestStation(
  lat: number,
  lng: number,
  stations: StationSeed[],
): NearestStationHit | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || stations.length === 0) {
    return null;
  }
  const here = { lat, lng };
  let best: NearestStationHit | null = null;
  for (const station of stations) {
    const km = haversineKm(here, stationLatLng(station));
    if (!best || km < best.km) best = { station, km };
  }
  return best;
}

/** Snapshot of curated spot pins (from mishiranu-coordinates.json). */
export const SPOT_LL: Record<string, LatLng> = Object.fromEntries(
  Object.entries(coordinates.spots).map(([id, v]) => [id, { lat: v.lat, lng: v.lng }]),
);

function fromCoordinatesStation(id: string): LatLng | undefined {
  const hit = coordinates.stations[id];
  return hit ? { lat: hit.lat, lng: hit.lng } : undefined;
}

function fromCoordinatesSpot(id: string): LatLng | undefined {
  const hit = coordinates.spots[id];
  return hit ? { lat: hit.lat, lng: hit.lng } : undefined;
}

export function stationLatLng(station: StationSeed): LatLng {
  const curated = fromCoordinatesStation(station.id);
  if (curated) return curated;
  if (
    typeof station.lat === "number" &&
    typeof station.lng === "number" &&
    Number.isFinite(station.lat) &&
    Number.isFinite(station.lng)
  ) {
    return { lat: station.lat, lng: station.lng };
  }
  const fallback = STATION_LL[station.id];
  if (fallback) return fallback;
  throw new Error(`駅座標がありません: ${station.id}`);
}

/**
 * Real WGS84 only. Never invent pins from relative x/y — that caused map drift.
 * Unresolved spots must be added to data/mishiranu-coordinates.json.
 */
export function spotLatLng(station: StationSeed, spot: Spot): LatLng {
  const curated = fromCoordinatesSpot(spot.id);
  if (curated) return curated;
  if (
    typeof spot.lat === "number" &&
    typeof spot.lng === "number" &&
    Number.isFinite(spot.lat) &&
    Number.isFinite(spot.lng)
  ) {
    return { lat: spot.lat, lng: spot.lng };
  }
  throw new Error(
    `スポット座標がありません: ${spot.id}（${spot.name} @ ${station.name}）。scripts/geocode-coordinates.mjs を実行するか、data/mishiranu-coordinates.json に lat/lng を追加してください。`,
  );
}
