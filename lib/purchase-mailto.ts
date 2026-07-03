import { CONTACT_EMAIL } from "./constants";
import { formatPriceLabel } from "./price";
import { paymentMethodLabel, type PaymentMethodId } from "./payment-methods";
import { calculateShipping, purchaseTotalYen } from "./shipping";
import type { CatalogItem } from "./types";

export type PurchaseFormData = {
  name: string;
  email: string;
  phone: string;
  address: string;
  message: string;
  paymentMethod: PaymentMethodId;
};

export function buildPurchaseMailto(item: CatalogItem, data: PurchaseFormData) {
  const shipping = calculateShipping(data.address, item);
  const productYen = item.price ?? 0;
  const totalYen = purchaseTotalYen(productYen, shipping.yen);

  const subject = encodeURIComponent(`購入希望：${item.title}`);
  const body = encodeURIComponent(
    [
      "以下の内容で購入を希望します。",
      "",
      `品名：${item.title}`,
      `商品ID：${item.id}`,
      item.priceLabel ? `商品代金：${item.priceLabel}` : productYen ? `商品代金：${formatPriceLabel(productYen)}` : "",
      shipping.included
        ? `送料：込み（${shipping.label}）`
        : `送料：${formatPriceLabel(shipping.yen)}（${shipping.label}）`,
      `合計：${formatPriceLabel(totalYen)}`,
      `お支払い方法：${paymentMethodLabel(data.paymentMethod)}`,
      "",
      `お名前：${data.name}`,
      `メール：${data.email}`,
      `電話：${data.phone}`,
      `ご住所（発送先）：${data.address}`,
      "",
      data.message ? `連絡事項：\n${data.message}` : "",
      "",
      data.paymentMethod === "bank_transfer"
        ? "銀行振込でのお支払いを希望します。振込先は購入ページに記載の口座へ、合計金額をお願いいたします。"
        : "クレジットカード決済のご案内をお待ちしています。",
    ]
      .filter(Boolean)
      .join("\n"),
  );

  return `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;
}

export function canPurchaseItem(item: CatalogItem) {
  return item.forSale === true && !item.sold;
}
