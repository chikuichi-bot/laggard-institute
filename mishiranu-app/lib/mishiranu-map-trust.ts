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

type LatLng = { lat: number; lng: number };

/** 通常の Apple ピン上限（駅から）。iOS MapPinTrust と同じ。 */
export const APPLE_MAP_MAX_KM = 1.5;
/** 半日の reach- だけ少し広げる。 */
export const REACH_MAP_MAX_KM = 2.4;

/** 括弧の注釈を外した店名。ロック判定はここだけ。 */
export function placeTitle(name: string): string {
  return name.replace(/[（(][^）)]*[）)]/g, "").trim();
}

/** 生成メモが店名に混ざったもの（「※…以外」）。場所として扱わない。 */
export function isEditorialPlaceName(name: string): boolean {
  return name.includes("※") || name.includes("以外");
}

function lockMatches(name: string, lock: LandmarkLock): boolean {
  if (isEditorialPlaceName(name)) return false;
  const title = placeTitle(name);
  if (lock.kind === "river") {
    // 「鴨川公園」はデルタ正本（合流点）に吸わせない
    if (title.includes("公園")) return false;
    const river =
      /デルタ|河川敷|三角州/.test(title) ||
      (/鴨川/.test(title) && /川端|川沿い/.test(title));
    return river && !/カフェ|茶房|ふたば/.test(title) && !title.endsWith("店");
  }
  return lock.keywords.some((k) => title.includes(k));
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

function withinAppleMapGate(spot: Spot, center: LatLng): boolean {
  if (typeof spot.lat !== "number" || typeof spot.lng !== "number") {
    return false;
  }
  const km = haversineKm(center, { lat: spot.lat, lng: spot.lng });
  if (spot.id?.startsWith("reach-")) {
    return km <= REACH_MAP_MAX_KM;
  }
  return km <= APPLE_MAP_MAX_KM;
}

/** 地図にピンを出してよいか。文章・案内には未確定も可。 */
export function allowsOnMap(
  spot: Spot,
  stationName: string,
  center?: LatLng | null,
): boolean {
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
  if (trust === "lock") return true;
  if (trust === "apple") {
    // B: 駅中心が無い／徒歩圏外の Apple は地図に出さない
    if (!center) return false;
    return withinAppleMapGate(spot, center);
  }
  return false;
}

export function mapTrustedSpots(
  spots: Spot[],
  stationName: string,
  center?: LatLng | null,
): Spot[] {
  return spots.filter(
    (s) =>
      allowsOnMap(s, stationName, center) &&
      typeof s.lat === "number" &&
      typeof s.lng === "number",
  );
}

/**
 * ロック座標を正本化。駅直近の未確定仮ピン座標は捨てる（スポット自体は案内用に残す）。
 * 足りないロックはスポットとして足す。
 * Apple で徒歩圏外のものは trust を落として地図に出さない。
 */
export function sealMapCoordinates(station: StationSeed): StationSeed {
  const pins = (landmarkLocks.locks as LandmarkLock[]).filter((p) =>
    station.name.includes(p.station),
  );
  const center =
    station.lat != null && station.lng != null
      ? { lat: station.lat, lng: station.lng }
      : null;

  let spots: Spot[] = (station.spots ?? [])
    .filter((s) => !isEditorialPlaceName(s.name))
    .map((s) => {
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
      // B: 飛び地の Apple は案内用に残すが地図には出さない
      if (
        trust === "apple" &&
        center &&
        typeof s.lat === "number" &&
        typeof s.lng === "number" &&
        !withinAppleMapGate(s, center)
      ) {
        return { ...s, coordTrust: "unverified" as const };
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
