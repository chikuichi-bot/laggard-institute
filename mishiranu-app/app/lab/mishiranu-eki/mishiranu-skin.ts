export type MishiranuSkin = "board" | "topo";

export const MISHIRANU_SKINS: Array<{
  id: MishiranuSkin;
  code: string;
  label: string;
  blurb: string;
}> = [
  {
    id: "board",
    code: "A",
    label: "ホームの時刻表",
    blurb: "暗い電光掲示。到着の情報板。",
  },
  {
    id: "topo",
    code: "C",
    label: "ポケット地形図",
    blurb: "折り畳み地図。歩くための帳面。",
  },
];

const STORAGE_KEY = "mishiranu.skin";

export function loadMishiranuSkin(): MishiranuSkin {
  if (typeof window === "undefined") return "board";
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === "board" || raw === "topo") return raw;
  return "board";
}

export function saveMishiranuSkin(skin: MishiranuSkin) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, skin);
}
