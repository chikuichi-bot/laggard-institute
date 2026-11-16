/**
 * 出町柳観光地図から「地図の地紋だけ」を抜き出した座標。
 * 写真吹き出し・店名・看板は除き、川・道・橋・駅・森・街区の骨格のみ。
 * viewBox 0 0 160 168 / 北が上。観光地図の切り取りに近い枠。
 */

export const VIEW = { w: 160, h: 168 };

/** 賀茂川（北西）— 葵橋付近から合流へ */
export const RIVER_WEST =
  "M52 4 C50 28, 52 48, 56 64 C60 76, 64 84, 70 90";

/** 高野川（北東）— 河合橋付近から合流へ */
export const RIVER_EAST =
  "M148 20 C128 34, 108 50, 90 68 C82 76, 76 84, 70 90";

/** 鴨川（南）— 出町橋〜賀茂大橋〜今出川以南 */
export const RIVER_SOUTH =
  "M70 90 C72 108, 74 126, 76 144 C77 154, 78 160, 80 168";

export const RIVERS = `${RIVER_WEST} ${RIVER_EAST} ${RIVER_SOUTH}`;

/** 三角州 */
export const DELTA = "M64 86 L78 90 L70 102 Z";

/** 下鴨・糺の森（Yのあいだ上部） */
export const FOREST = "M56 2 L78 6 L92 28 L88 68 L70 86 L58 58 L54 28 Z";

/** 出町柳駅（合流東岸） */
export const STATION = { x: 92, y: 82, size: 7 };

/** 駅前広場の気配 */
export const PLAZA: [number, number, number, number] = [86, 74, 18, 14];

/** 今出川通（下寄り・東西） */
export const ROAD_IMADEGAWA = "M2 132 H158";

/** 河原町通（西） */
export const ROAD_KAWARAMACHI = "M34 4 V164";

/** 東大路（東） */
export const ROAD_HIGASHIOJI = "M142 4 V164";

/** 川端通（東岸沿い） */
export const ROAD_KAWABATA = "M88 98 V164";

/** 西の横道（桝形〜今出川付近の東西） */
export const ROAD_WEST_H = [
  "M6 36 H48",
  "M6 58 H50",
  "M6 82 H52",
  "M6 108 H54",
];

/** 東の横道 */
export const ROAD_EAST_H = [
  "M100 40 H140",
  "M98 62 H144",
  "M96 88 H146",
  "M100 112 H148",
];

/** 西の縦道 */
export const ROAD_WEST_V = ["M18 8 V128", "M46 8 V128"];

/** 東の縦道 */
export const ROAD_EAST_V = ["M108 8 V128", "M128 8 V160"];

export const ALL_ROADS = [
  ROAD_IMADEGAWA,
  ROAD_KAWARAMACHI,
  ROAD_HIGASHIOJI,
  ROAD_KAWABATA,
  ...ROAD_WEST_H,
  ...ROAD_EAST_H,
  ...ROAD_WEST_V,
  ...ROAD_EAST_V,
];

/** 葵橋・河合橋・出町橋・賀茂大橋 */
export const BRIDGES = [
  "M44 48 L66 52",
  "M108 56 L128 52",
  "M56 96 L86 100",
  "M58 128 L90 132",
];

/** 叡山（北東→駅） */
export const RAIL_EIZAN = "M94 80 C112 60, 130 40, 150 24";

/** 京阪（駅南〜東岸） */
export const RAIL_KEIHAN = "M96 88 C98 112, 100 136, 102 164";

/** 街区（吹き出しの下の地紋） */
export const BLOCKS: Array<[number, number, number, number]> = [
  [6, 12, 16, 10],
  [8, 40, 14, 10],
  [6, 64, 16, 10],
  [8, 90, 14, 10],
  [20, 20, 12, 12],
  [22, 70, 12, 12],
  [112, 14, 16, 10],
  [116, 36, 14, 10],
  [118, 58, 14, 12],
  [104, 100, 14, 10],
  [120, 108, 16, 12],
  [122, 136, 14, 10],
  [8, 140, 18, 12],
  [48, 140, 12, 10],
];

export const HATCH = [
  "M44 8 L58 64",
  "M50 4 L62 66",
  "M56 10 L66 68",
  "M144 24 L98 70",
  "M136 20 L92 68",
  "M128 28 L88 72",
  "M64 94 L74 150",
  "M70 92 L80 148",
  "M76 96 L86 152",
];
