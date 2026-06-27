import { CONTACT_EMAIL } from "./constants";
import { paymentMethodLabel, type PaymentMethodId } from "./payment-methods";
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
  const subject = encodeURIComponent(`購入希望：${item.title}`);
  const body = encodeURIComponent(
    [
      "以下の内容で購入を希望します。",
      "",
      `品名：${item.title}`,
      `商品ID：${item.id}`,
      item.priceLabel ? `価格：${item.priceLabel}` : "",
      `お支払い方法：${paymentMethodLabel(data.paymentMethod)}`,
      "",
      `お名前：${data.name}`,
      `メール：${data.email}`,
      data.phone ? `電話：${data.phone}` : "",
      data.address ? `ご住所：${data.address}` : "",
      "",
      data.message ? `連絡事項：\n${data.message}` : "",
      "",
      data.paymentMethod === "bank_transfer"
        ? "銀行振込でのお支払いを希望します。振込先は購入ページに記載の口座へお願いいたします。"
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
