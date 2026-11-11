/**
 * 出町柳雛形 — 初めてその駅に降りた人へのショートコースの組み立て方。
 *
 * 淡島様（出町柳に20年）: 出町のルートが正解の見本。
 * 他駅は知らないので、出町と同じ**役割**の3点でコースを組む。
 * ※出町の固有地名を他駅にコピーしてはいけない。
 *
 * 出町の正本:
 * 1. landform … 鴨川デルタ（地形・水・土地の骨格）
 * 2. landmark … 下鴨神社（名所・信仰・土地の名前と結びつく顔）
 * 3. town     … 枡形商店街（町場・いまの生活の導線）
 */

export const DEMACHI_TEMPLATE_ROLES = [
  "landform",
  "landmark",
  "town",
] as const;

export type FirstVisitRole = (typeof DEMACHI_TEMPLATE_ROLES)[number];

export type FirstVisitFace = {
  role: FirstVisitRole;
  name: string;
  where?: string;
  why?: string;
  present?: string;
  walkMinutes?: number;
  lat?: number;
  lng?: number;
};

/** 出町柳専用の固有名。他駅のコース・観光・スポットに絶対に入れない。 */
export const DEMACHI_EXCLUSIVE_PLACE_RE =
  /鴨川デルタ|デルタ|三角州|河川敷|高野川|賀茂川|下鴨神社|賀茂御祖|糺の森|下鴨|枡形商店街|桝形商店街|出町枡形|出町桝形|枡形|桝形|出町ふたば|満寿形屋|加茂みたらし|百万遍|同志社大学|京都大学/;

export function isDemachiStationName(name: string): boolean {
  const bare = name.replace(/駅$/u, "").trim();
  return /出町柳/.test(bare) || bare === "出町";
}

export function isDemachiExclusivePlaceName(placeName: string): boolean {
  return DEMACHI_EXCLUSIVE_PLACE_RE.test(placeName);
}

/** 他駅に出町の固有名が混ざっていないか。 */
export function isForeignDemachiPlace(
  placeName: string,
  stationName: string,
): boolean {
  if (isDemachiStationName(stationName)) return false;
  return isDemachiExclusivePlaceName(placeName);
}

/** ショート候補が駅から遠すぎないか（出町座標の誤流用）。 */
export const FIRST_VISIT_MAX_KM = 3.2;

/** 出町柳の確定ピン。他駅コースにこの座標が混ざったら落とす。 */
export const DEMACHI_EXCLUSIVE_PINS: { lat: number; lng: number }[] = [
  { lat: 35.0301227, lng: 135.7717415 }, // 鴨川デルタ
  { lat: 35.030249, lng: 135.769436 }, // 枡形
  { lat: 35.0387, lng: 135.7727 }, // 下鴨
  { lat: 35.0301072, lng: 135.7696274 }, // ふたば
  { lat: 35.0272, lng: 135.7808 }, // 京大
  { lat: 35.029714, lng: 135.760715 }, // 同志社
];

export function isOnDemachiPin(lat: number, lng: number): boolean {
  return DEMACHI_EXCLUSIVE_PINS.some((pin) => {
    const dLat = ((lat - pin.lat) * Math.PI) / 180;
    const dLng = ((lng - pin.lng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((pin.lat * Math.PI) / 180) *
        Math.cos((lat * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    return 2 * 6371 * Math.asin(Math.sqrt(a)) < 0.45;
  });
}

/** 出町の顔の文だけ落とす。 */
export function stripExclusiveDemachiSentences(
  text: string | undefined,
): string | undefined {
  if (!text) return text;
  const parts = text.split("。");
  const kept = parts.filter((part) => {
    const t = part.trim();
    if (!t) return true;
    return !DEMACHI_EXCLUSIVE_PLACE_RE.test(t);
  });
  const joined = kept.join("。").trim();
  if (!joined) return undefined;
  if (text.endsWith("。") && !joined.endsWith("。")) return `${joined}。`;
  return joined;
}

export const DEMACHI_TEMPLATE_PROMPT = [
  "【出町柳雛形・いちばん重要】",
  "出町柳に長く住む編集者が、初めて出町柳に来た人へ勧めるルートがアプリの正解見本です。",
  "見本の役割・構成だけ借りる。出町柳以外の駅では、出町の固有地名を絶対に使わない。",
  "【生成の順番】まず土地の文章（stationIntro / areaAbout / walkGuide / historyNotes / sightseeingNotes / firstVisitFaces）。",
  "地図と案内の場所（spots）は、その土地の文章に書いた正式名称から起こす。文章に無い店・名所を先にリストしない。",
  "出町柳ショートの役割例（この駅名のときだけこの固有名）:",
  "- landform ← 鴨川デルタ（地形）",
  "- landmark ← 下鴨神社（名所）",
  "- town ← 枡形商店街（町場）",
  "二ノ瀬・貴船口・中書島など他駅では、その駅の実在名で同じ3役割を選ぶ。",
  "禁止の取り違え: 二ノ瀬・八瀬比叡山口なのに鴨川デルタ・枡形商店街・下鴨神社を出す（出町のコピー）。",
  "八瀬比叡山口の例: landform←音羽川、landmark←ケーブル八瀬駅、town←八瀬もみじの小径。",
  "役割の定義:",
  "- landform: その駅の地形・水・港・橋・渓流・市場の床など骨格",
  "- landmark: その駅名と結びつく名所・名社寺（近所の無名寺は不可）",
  "- town: その駅前の商店街・門前・いまの生活の通り",
  "firstVisitFaces は必ずこの3役割を1件ずつ。土地文と sightseeingNotes の先頭もこの3点。",
  "入れない: 別邸・二番手・穴場だけ・他駅の名所。",
  "ロングは雛形3点に、同じ駅の徒歩圏の先だけを足す。",
].join("\n");
