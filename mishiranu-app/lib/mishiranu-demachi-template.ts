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

/**
 * 見知らぬ駅の魅力の核（2026-11-13 淡島様）。
 * 最短ナビではなく、土地らしい無駄な寄り道。
 * 例: 同志社へは相国寺の中を通る。駅前で買ってデルタで食べる。
 */
export const DETOUR_CHARM = {
  oneLiner: "最短より、土地らしい無駄な寄り道。",
  principle:
    "このアプリの魅力は無駄さにある。ナビの最短を勝たせない。境内・川辺・商店街の一本など、少し遠回りでも土地の顔を通る道を選ぶ。",
  /** Lagado横断: 万人受けより、探していた人へのドンピシャ。 */
  forWhom:
    "誰でも少し便利、ではない。無駄な寄り道や土地の顔を探していた人にドンピシャな案内にする。尖りを万人向けに丸めない。",
} as const;

/** 生成・コース・空気の道に共通で載せる思想。 */
export const DETOUR_CHARM_PROMPT = [
  "【無駄な寄り道・いちばんの魅力】",
  DETOUR_CHARM.oneLiner,
  DETOUR_CHARM.principle,
  DETOUR_CHARM.forWhom,
  "- walkGuide / コース: 目的地へ『通ってよい寄り道』があれば最短よりそちら（例: 寺の境内、川辺、商店街の一本）。",
  "- 『効率よく』『すぐ着く』『寄り道せず』は禁止口調。無駄を肯定する。",
  "- 何もない駅では、名もなき坂・用水・線路沿いの細道そのものが寄り道になる。埋め草の名所で埋めない。",
  "- 出町の見本: 同志社へは相国寺の中を通る。食べ物は駅前で買って鴨川デルタで食べる。",
  "- 【粋な寄り道 preferredDetours・全駅】名所・大学・神社など大きな目的地へ向かうとき、その手前に通れる土地らしい経由（境内・川辺・商店街・坂の一本）があれば preferredDetours に 1〜3 件。name=経由の正式名、beforeKeys=[目的地のキーワード]、path=経由を通る実座標3点前後、blurb=なぜ最短よりこちらか。無い駅は []。出町以外に相国寺・同志社をコピーしない。捏造の『城下町』禁止。",
].join("\n");

/**
 * 出町柳並みの精度バー（どの駅の検索生成にも適用）。
 * 役割の雛形とは別：出口・通過順・定番食べ方・迷わない具体。
 */
export const PRECISION_BAR_PROMPT = [
  "【精度バー・出町柳並み（全駅）】",
  "検索で作る案内も、出町柳正本と同じ具体さにする。抽象の雰囲気文で埋めない。",
  "1. 通過順: walkGuide は実際に通る順（Aを通ってBへ）。『Bへ。その足でA』の逆転禁止。",
  "2. 距離の嘘禁止: 『改札のすぐ外＝商店街』など、出口・橋・徒歩分を調べてから書く。不確かなら出口番号を捏造しない（『駅を出て西へ徒歩数分』型）。",
  "3. 寄るところ（sightseeingNotes）: title は正式な場所名だけ（方角見出し禁止）。body は『正式名です。改札から方角・徒歩□分。着いたら何がある』。気配・空気・色が先は禁止。",
  "4. 定番の食べ方: その駅で『買ってどこで食べるか』が検索・現地知識で分かれば walkGuide に1文（例: 駅前で買って川辺・公園で）。分からなければ無理に書かない。『リズムが崩れにくい』だけの抽象は禁止。",
  "5. Google検索で出口名・商店街の位置・名物の食べ方を確かめてから書く。出町の固有名を他駅にコピーしない。",
].join("\n");

export const DEMACHI_TEMPLATE_PROMPT = [
  "【出町柳雛形・いちばん重要】",
  "出町柳に長く住む編集者が、初めて出町柳に来た人へ勧めるルートがアプリの正解見本です。",
  "見本の役割・構成・精度・無駄な寄り道だけ借りる。出町柳以外の駅では、出町の固有地名を絶対に使わない。",
  DETOUR_CHARM_PROMPT,
  PRECISION_BAR_PROMPT,
  "【生成の順番】まず土地の文章（stationIntro / areaAbout / walkGuide / historyNotes / sightseeingNotes / firstVisitFaces）。",
  "地図と案内の場所（spots）は、その土地の文章に書いた正式名称から起こす。文章に無い店・名所を先にリストしない。",
  "出町柳ショートの役割例（この駅名のときだけこの固有名）:",
  "- landform ← 鴨川デルタ（地形）",
  "- landmark ← 下鴨神社（名所）",
  "- town ← 枡形商店街（町場）",
  "二ノ瀬・貴船口・中書島など他駅では、その駅の実在名で同じ役割を選ぶ。揃う役割だけでよい。",
  "禁止の取り違え: 二ノ瀬・八瀬比叡山口なのに鴨川デルタ・枡形商店街・下鴨神社を出す（出町のコピー）。",
  "八瀬比叡山口の例: landform←音羽川、landmark←ケーブル八瀬駅、town←八瀬もみじの小径。",
  "役割の定義:",
  "- landform: その駅の地形・水・港・橋・渓流・用水・田畑の道など骨格",
  "- landmark: その駅名と結びつく名所・名社寺（近所の無名寺は不可）",
  "- town: その駅前の商店街・門前・いまの生活の通り（店・町場が本当に無ければ出さない）",
  "firstVisitFaces は 1〜3 件。実在する役割だけ。3役割すべてを無理に埋めない。",
  "店も町場もない駅: landform（川・用水・坂・田畑の道・橋）と神社・公園だけでよい。欠落自体を肯定する。",
  "入れない: 別邸・二番手・穴場だけ・他駅の名所・1.5km超のチェーン店で枠埋め。",
  "ロングは揃った役割に、同じ駅の徒歩圏の先だけを足す。",
].join("\n");
