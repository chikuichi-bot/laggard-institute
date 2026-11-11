/** トップ抽象地図の配置・サイズ（単純版） */

export type HeroMapLayout = {
  /** スロット左端からの位置（%） */
  leftPct: number;
  /** スロット上端からの位置（%） */
  topPct: number;
  /** 地図の幅（スロット幅に対する％） */
  widthPct: number;
};

export const HERO_MAP_LAYOUT_STORAGE = "mishiranu-hero-map-layout-v2";

export const HERO_MAP_LAYOUT: HeroMapLayout = {
  leftPct: 9,
  topPct: 33,
  widthPct: 73,
};

export function clampLayout(layout: HeroMapLayout): HeroMapLayout {
  return {
    leftPct: Math.min(70, Math.max(-10, Math.round(layout.leftPct))),
    topPct: Math.min(70, Math.max(-10, Math.round(layout.topPct))),
    widthPct: Math.min(100, Math.max(40, Math.round(layout.widthPct))),
  };
}
