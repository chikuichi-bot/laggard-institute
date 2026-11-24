export type MishiranuSkin = "ma" | "board" | "topo";

export const MISHIRANU_SKINS: Array<{
  id: MishiranuSkin;
  code: string;
  label: string;
  blurb: string;
}> = [
  {
    id: "ma",
    code: "本",
    label: "文庫の紙",
    blurb: "トップと同じ余白。小説の紙。",
  },
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
const PICKED_KEY = "mishiranu.skin.picked";

function isSkin(raw: string | null): raw is MishiranuSkin {
  return raw === "ma" || raw === "board" || raw === "topo";
}

export function loadMishiranuSkin(): MishiranuSkin {
  if (typeof window === "undefined") return "ma";
  const raw = window.localStorage.getItem(STORAGE_KEY);
  const picked = window.localStorage.getItem(PICKED_KEY) === "1";
  // 旧既定の board は、トップ（文庫の余白）に寄せる
  if (raw === "board" && !picked) {
    window.localStorage.setItem(STORAGE_KEY, "ma");
    return "ma";
  }
  if (isSkin(raw)) return raw;
  return "ma";
}

export function saveMishiranuSkin(skin: MishiranuSkin) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, skin);
  window.localStorage.setItem(PICKED_KEY, "1");
}
