/**
 * 初めて駅を降りた人が通る「メジャーな普通のところ」だけを残す。
 * 近所の無名な寺・小社は、社寺というだけで顔にしない。
 */

const FAME_TOKENS = [
  "大社",
  "神宮",
  "八幡",
  "天満宮",
  "東照宮",
  "稲荷大社",
  "別雷",
  "御祖",
  "春日",
  "明治神宮",
  "平安神宮",
  "熱田",
  "住吉大社",
  "太宰府",
  "鶴岡",
  "浅草寺",
  "清水寺",
  "金閣",
  "銀閣",
  "東大寺",
  "興福寺",
  "法隆寺",
  "中尊寺",
  "平等院",
  "厳島",
  "出雲大社",
  "善光寺",
  "永平寺",
  "金剛峯",
  "総本山",
  "大本山",
  "国宝",
  "世界遺産",
  "飛行神社",
  "石清水",
  "下鴨",
  "上賀茂",
  "賀茂",
];

const ORDINARY_FACE_RE =
  /デルタ|三角州|合流|河原|河川敷|商店街|市場|朝市|港|桟橋|灯台|城|城跡|公園|橋|並木|参道/;

export function bareStationName(name: string): string {
  return name.replace(/駅$/, "").trim();
}

export function isWorshipName(name: string): boolean {
  if (/茶屋|茶房|食堂|本店$|店$/.test(name)) return false;
  return /寺$|神社$|神宮$|大社$|寺院$|神社/.test(name);
}

export function isGuidebookWorship(
  name: string,
  stationName?: string,
): boolean {
  if (!isWorshipName(name)) return false;
  if (FAME_TOKENS.some((t) => name.includes(t))) return true;
  if (stationName) {
    const bare = bareStationName(stationName);
    if (bare.length >= 2 && name.includes(bare)) return true;
  }
  return false;
}

export function isNeighborhoodWorship(
  name: string,
  stationName?: string,
): boolean {
  if (!isWorshipName(name)) return false;
  return !isGuidebookWorship(name, stationName);
}

export function isOrdinaryPublicFace(name: string): boolean {
  return ORDINARY_FACE_RE.test(name);
}

export function filterFirstVisitSpots<T extends { name: string }>(
  spots: T[],
  stationName: string,
): T[] {
  return spots.filter(
    (s) => !isNeighborhoodWorship(s.name, stationName),
  );
}
