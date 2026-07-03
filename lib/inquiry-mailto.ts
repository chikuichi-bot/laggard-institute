import { CONTACT_EMAIL } from "./constants";
import type { CatalogItem } from "./types";

export type InquiryFormData = {
  name: string;
  email: string;
  phone: string;
  message: string;
};

export function buildInquiryMailto(item: CatalogItem, data: InquiryFormData) {
  const subject = encodeURIComponent(`購入のお問い合わせ：${item.title}`);
  const body = encodeURIComponent(
    [
      "以下の内容でお問い合わせします。",
      "",
      `品名：${item.title}`,
      `商品ID：${item.id}`,
      item.priceLabel ? `価格：${item.priceLabel}` : "",
      "",
      `お名前：${data.name}`,
      data.email ? `メール：${data.email}` : "",
      data.phone ? `電話：${data.phone}` : "",
      "",
      data.message ? `お問い合わせ内容：\n${data.message}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
  );

  return `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;
}
