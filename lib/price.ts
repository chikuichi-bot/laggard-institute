/** 文字列から円単位の金額を取り出す（¥8,800 / 8800 など） */
export function parseYenAmount(input: string): number | undefined {
  const digits = input.replace(/[^\d]/g, "");
  if (!digits) return undefined;
  const value = Number(digits);
  return value > 0 ? value : undefined;
}

export function formatPriceLabel(yen: number): string {
  return `¥${yen.toLocaleString("ja-JP")}`;
}

/** 管理フォームの価格入力から price / priceLabel を決める */
export function parsePriceFields(
  priceInput: string,
  priceLabelInput?: string,
): { price?: number; priceLabel?: string } {
  const fromPrice = parseYenAmount(priceInput);
  if (fromPrice) {
    return { price: fromPrice, priceLabel: formatPriceLabel(fromPrice) };
  }

  const label = priceLabelInput?.trim();
  const fromLabel = parseYenAmount(label ?? "");
  if (fromLabel) {
    return { price: fromLabel, priceLabel: label || formatPriceLabel(fromLabel) };
  }

  return {};
}
