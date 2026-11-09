import type { Spot, StationSeed } from "@/data/mishiranu-stations";

/** WGS84 station centers for the curated set */
export const STATION_LL: Record<string, { lat: number; lng: number }> = {
  demachiyanagi: { lat: 35.0292, lng: 135.772 },
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

/** Precise pins for 出町柳 (feel-test home station) */
export const SPOT_LL: Record<string, { lat: number; lng: number }> = {
  "demachi-1": { lat: 35.03055, lng: 135.77115 }, // 鴨川デルタ
  "demachi-2": { lat: 35.02855, lng: 135.77025 }, // 枡形商店街
  "demachi-3": { lat: 35.02885, lng: 135.77055 }, // 出町ふたば
  "demachi-3b": { lat: 35.0289, lng: 135.77065 }, // ふたば土産
  "demachi-4": { lat: 35.02935, lng: 135.77225 }, // 叡電ホーム
  "demachi-5": { lat: 35.02845, lng: 135.77005 }, // 出町座（枡形）
  "demachi-5b": { lat: 35.0289, lng: 135.7804 }, // 進々堂 百万遍
  "demachi-5c": { lat: 35.0284, lng: 135.77035 }, // 枡形の揚げもの
  "demachi-10": { lat: 35.0304, lng: 135.77105 }, // 鴨川デルタの川端（休む）
  "demachi-6": { lat: 35.03205, lng: 135.77045 }, // 下鴨並木入口
  "demachi-9": { lat: 35.0389, lng: 135.7728 }, // 下鴨神社・糺の森
  "demachi-7": { lat: 35.02705, lng: 135.76855 }, // 河原町今出川
  "demachi-8": { lat: 35.0287, lng: 135.77015 }, // 紙もの雑貨
  "demachi-11": { lat: 35.02875, lng: 135.77045 }, // 駅前レンタサイクル
};

export function stationLatLng(station: StationSeed): { lat: number; lng: number } {
  return STATION_LL[station.id] ?? { lat: 35.0, lng: 135.0 };
}

/** Map relative x/y (0–1) onto ~2.4km box around the station when no precise pin */
export function spotLatLng(
  station: StationSeed,
  spot: Spot,
): { lat: number; lng: number } {
  const precise = SPOT_LL[spot.id];
  if (precise) return precise;
  const center = stationLatLng(station);
  const spanDeg = 0.022; // ~2.4km
  const lng = center.lng + (spot.x - 0.5) * spanDeg;
  const lat = center.lat + (0.52 - spot.y) * spanDeg;
  return { lat, lng };
}
