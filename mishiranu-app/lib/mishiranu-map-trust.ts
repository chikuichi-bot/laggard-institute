import type { Spot, StationSeed } from "@/data/mishiranu-stations";
import landmarkLocks from "@/data/landmark-locks.json";
import {
  isDemachiStationName,
  isForeignDemachiPlace,
  isOnDemachiPin,
} from "@/lib/mishiranu-demachi-template";
import { haversineKm } from "@/lib/mishiranu-geo";

type LandmarkLock = {
  station: string;
  kind: string;
  keywords: string[];
  canonical?: string;
  lat: number;
  lng: number;
  walkMinutes: number;
};

function lockMatches(name: string, lock: LandmarkLock): boolean {
  if (lock.kind === "river") {
    const river =
      /デルタ|河川敷|三角州/.test(name) ||
      (/鴨川/.test(name) && /川端|川沿い/.test(name));
    return river && !/カフェ|茶房|ふたば/.test(name) && !name.endsWith("店");
  }
  return lock.keywords.some((k) => name.includes(k));
}

export function isLockedSpotName(name: string, stationName: string): boolean {
  return (landmarkLocks.locks as LandmarkLock[]).some(
    (p) => stationName.includes(p.station) && lockMatches(name, p),
  );
}

function inferredTrust(spot: Spot): Spot["coordTrust"] {
  if (spot.coordTrust === "lock" || spot.coordTrust === "apple") {
    return spot.coordTrust;
  }
  if (spot.id?.startsWith("lock-")) return "lock";
  if (spot.id?.startsWith("apple-") || spot.id?.startsWith("reach-")) {
    return "apple";
  }
  return spot.coordTrust ?? "unverified";
}

/** 地図にピンを出してよいか。文章・案内には未確定も可。 */
export function allowsOnMap(spot: Spot, stationName: string): boolean {
  if (isForeignDemachiPlace(spot.name, stationName)) return false;
  if (
    !isDemachiStationName(stationName) &&
    typeof spot.lat === "number" &&
    typeof spot.lng === "number" &&
    isOnDemachiPin(spot.lat, spot.lng)
  ) {
    return false;
  }
  if (isLockedSpotName(spot.name, stationName)) return true;
  const trust = inferredTrust(spot);
  return trust === "lock" || trust === "apple";
}

export function mapTrustedSpots(spots: Spot[], stationName: string): Spot[] {
  return spots.filter(
    (s) =>
      allowsOnMap(s, stationName) &&
      typeof s.lat === "number" &&
      typeof s.lng === "number",
  );
}

/**
 * ロック座標を正本化。駅直近の未確定仮ピン座標は捨てる（スポット自体は案内用に残す）。
 * 足りないロックはスポットとして足す。
 */
export function sealMapCoordinates(station: StationSeed): StationSeed {
  const pins = (landmarkLocks.locks as LandmarkLock[]).filter((p) =>
    station.name.includes(p.station),
  );
  const center =
    station.lat != null && station.lng != null
      ? { lat: station.lat, lng: station.lng }
      : null;

  let spots: Spot[] = (station.spots ?? []).map((s) => {
    const hit = pins.find((p) => lockMatches(s.name, p));
    if (hit) {
      return {
        ...s,
        lat: hit.lat,
        lng: hit.lng,
        walkMinutes: hit.walkMinutes,
        coordTrust: "lock" as const,
      };
    }
    const trust = inferredTrust(s);
    if (
      trust === "unverified" &&
      center &&
      typeof s.lat === "number" &&
      typeof s.lng === "number"
    ) {
      const km = haversineKm(center, { lat: s.lat, lng: s.lng });
      if (km < 0.08) {
        const { lat: _lat, lng: _lng, ...rest } = s;
        return { ...rest, coordTrust: "unverified" as const };
      }
    }
    return { ...s, coordTrust: trust };
  });

  for (const lock of pins) {
    const label =
      lock.canonical ??
      lock.keywords.find((k) => k.length >= 3) ??
      lock.keywords[0];
    if (!label) continue;
    if (spots.some((s) => lockMatches(s.name, lock))) continue;
    const isSouvenir =
      lock.kind === "souvenir" ||
      lock.keywords.some((k) => /餅|菓子|土産|みたらし/.test(k));
    const isMeal = lock.kind === "meal";
    const isRiver = lock.kind === "river";
    spots = [
      ...spots,
      {
        id: `lock-${lock.kind}-${label}`,
        name: label,
        genre: isSouvenir || isMeal ? "gourmet" : isRiver ? "nature" : "history",
        guide: isMeal
          ? "meal"
          : isSouvenir
            ? "souvenir"
            : isRiver
              ? "rest"
              : "sight",
        mealTier: "casual",
        mealTimes: ["morning", "lunch"],
        soloOk: true,
        budgetYen: isMeal ? "〜¥1,500" : isSouvenir ? "〜¥1,000" : "—",
        blurb: isMeal
          ? `${label}。この駅の定番めし。`
          : isSouvenir
            ? `${label}。門前の手土産・名物。`
            : `${label}。この駅の土地の顔になる場所。`,
        walkMinutes: lock.walkMinutes,
        secretWorthy: false,
        majorWorthy: true,
        lat: lock.lat,
        lng: lock.lng,
        x: 0.5,
        y: 0.5,
        coordTrust: "lock",
      },
    ];
  }

  return { ...station, spots };
}
