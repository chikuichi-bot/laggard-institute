/** 設定 · 表示（文字の大きさ / 地図の詳細） */

export type TextSizePref = "system" | "large" | "xlarge";
export type MapDetailPref = "clean" | "rich";

const TEXT_KEY = "mishiranu.textSize";
const MAP_KEY = "mishiranu.mapDetail";

export const TEXT_SIZE_PREFS: TextSizePref[] = ["system", "large", "xlarge"];
export const MAP_DETAIL_PREFS: MapDetailPref[] = ["clean", "rich"];

export function textSizeLabel(pref: TextSizePref): string {
  switch (pref) {
    case "system":
      return "標準";
    case "large":
      return "やや大きい";
    case "xlarge":
      return "大きい";
  }
}

export function mapDetailLabel(pref: MapDetailPref): string {
  switch (pref) {
    case "clean":
      return "すっきり";
    case "rich":
      return "くわしく";
  }
}

export function nextTextSize(pref: TextSizePref): TextSizePref {
  const i = TEXT_SIZE_PREFS.indexOf(pref);
  return TEXT_SIZE_PREFS[(i + 1) % TEXT_SIZE_PREFS.length] ?? "system";
}

export function nextMapDetail(pref: MapDetailPref): MapDetailPref {
  const i = MAP_DETAIL_PREFS.indexOf(pref);
  return MAP_DETAIL_PREFS[(i + 1) % MAP_DETAIL_PREFS.length] ?? "clean";
}

function canStore(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function loadTextSize(): TextSizePref {
  if (!canStore()) return "system";
  const raw = window.localStorage.getItem(TEXT_KEY);
  if (raw === "large" || raw === "xlarge" || raw === "system") return raw;
  return "system";
}

export function saveTextSize(pref: TextSizePref) {
  if (!canStore()) return;
  window.localStorage.setItem(TEXT_KEY, pref);
}

export function loadMapDetail(): MapDetailPref {
  if (!canStore()) return "clean";
  const raw = window.localStorage.getItem(MAP_KEY);
  if (raw === "rich" || raw === "clean") return raw;
  return "clean";
}

export function saveMapDetail(pref: MapDetailPref) {
  if (!canStore()) return;
  window.localStorage.setItem(MAP_KEY, pref);
}
