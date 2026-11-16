import type { Spot } from "@/data/mishiranu-stations";
import { haversineKm } from "@/lib/mishiranu-geo";

/** 地図は線を引かず、walkGuide（正本）と入り口点で最初の一歩を支える（仕様 C+E）。 */

export type EntranceHint = {
  label: string;
  lat: number;
  lng: number;
};

/** 地図下カード用。歩き方文の先頭 1〜2 文。 */
export function guideCardText(walkGuide?: string | null): string | null {
  const raw = (walkGuide ?? "").replace(/\n/g, "").trim();
  if (!raw) return null;
  const parts = raw
    .split(/[。．]/u)
    .map((s) => s.trim())
    .filter(Boolean);
  if (!parts.length) return null;
  let text = `${parts[0]}。`;
  if (parts.length >= 2 && text.length < 48) {
    text += `${parts[1]}。`;
  }
  if (text.length > 90) return `${text.slice(0, 88)}…`;
  return text;
}

function bareLandmark(name: string): string {
  return name.replace(/[（）()]/gu, "");
}

export function entranceLabel(guide: string): string | null {
  const g = guide.trim();
  if (!g) return null;
  const patterns: RegExp[] = [
    /([^、。]{0,12}踏切)/u,
    /([^、。]{0,14}鳥居)/u,
    /([^、。]{0,14}仁王門)/u,
    /([^、。]{0,12}総門)/u,
    /([^、。]{0,14}門前)/u,
    /([^、。]{0,12}大鳥居)/u,
    /([^、。]{0,16}橋)(?:を|の|へ|に|下)?/u,
    /(改札を出て[^、。]{2,20})/u,
    /([^、。]{2,14}通)(?:を|へ)/u,
  ];
  for (const re of patterns) {
    const m = g.match(re);
    if (!m?.[1]) continue;
    let label = m[1].trim();
    if (label.startsWith("改札を出て")) {
      label = label.slice("改札を出て".length).trim() || "改札の外";
    }
    if (label.length > 14) label = `${label.slice(0, 12)}…`;
    if (label) return label;
  }
  const first = g.split(/[。．、]/u)[0]?.trim();
  if (first && first.length >= 4) {
    return first.length <= 14 ? first : `${first.slice(0, 12)}…`;
  }
  return null;
}

export function entranceHint(opts: {
  stationLat: number;
  stationLng: number;
  walkGuide?: string | null;
  firstStop?: { lat: number; lng: number } | null;
  spots?: Spot[];
}): EntranceHint | null {
  const guide = (opts.walkGuide ?? "").trim();
  const first = opts.firstStop;
  if (!guide && !first) return null;

  const label = entranceLabel(guide) ?? "最初の手がかり";
  const head = guide.slice(0, 100);
  const spots = opts.spots ?? [];

  for (const spot of spots) {
    if (spot.lat == null || spot.lng == null) continue;
    if (spot.lat === 0 && spot.lng === 0) continue;
    const n = spot.name;
    if (n.length < 2) continue;
    if (!(head.includes(n) || head.includes(bareLandmark(n)))) continue;
    const dist = haversineKm(
      { lat: opts.stationLat, lng: opts.stationLng },
      { lat: spot.lat, lng: spot.lng },
    );
    if (dist <= 0.55) {
      return {
        label: n.length <= 12 ? n : label,
        lat: spot.lat,
        lng: spot.lng,
      };
    }
  }

  if (!first || (first.lat === 0 && first.lng === 0)) return null;
  const fullKm = haversineKm(
    { lat: opts.stationLat, lng: opts.stationLng },
    first,
  );
  if (fullKm <= 0.04) return null;
  const targetKm = Math.min(0.18, Math.max(0.11, fullKm * 0.35));
  const t = Math.min(0.85, targetKm / fullKm);
  return {
    label,
    lat: opts.stationLat + (first.lat - opts.stationLat) * t,
    lng: opts.stationLng + (first.lng - opts.stationLng) * t,
  };
}
