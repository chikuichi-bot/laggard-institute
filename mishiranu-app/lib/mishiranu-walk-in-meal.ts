/**
 * 歩いて入れるご飯屋さんではないもの（配食・宅食の事業所など）を落とす。
 * 実地: ライフデリは高齢者配食で店内飲食不可。
 */

const BRANDS = [
  "ライフデリ",
  "LIFE DELI",
  "ワタミの宅食",
  "まごころ弁当",
  "おまかせさん",
  "ベネッセのお弁当",
  "コスモス配食",
] as const;

const MARKERS = [
  "配食",
  "宅食",
  "宅配弁当",
  "高齢者配食",
  "配食サービス",
  "訪問弁当",
] as const;

export function isNonWalkInMeal(parts: {
  name?: string;
  blurb?: string;
  detail?: string;
}): boolean {
  const name = (parts.name ?? "").trim();
  const blob = `${name}\n${parts.blurb ?? ""}\n${parts.detail ?? ""}`;
  const upper = blob.toUpperCase();
  if (BRANDS.some((b) => blob.includes(b) || upper.includes(b.toUpperCase()))) {
    return true;
  }
  if (MARKERS.some((m) => blob.includes(m))) return true;
  // 「デリ」単体は誤爆しやすいので、ライフデリ以外はブランド表に寄せる
  return false;
}
