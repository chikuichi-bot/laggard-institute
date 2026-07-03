import { CLICK_POST_FLAT_YEN } from "./shipping";
import type { CatalogItem } from "./types";

export const AMAPPOLA_PRODUCT_ID = "amappola-shishu";

/** 詩集本体の価格（送料別） */
export const AMAPPOLA_BOOK_YEN = 1000;

/** クリックポスト送料（全国一律） */
export const AMAPPOLA_SHIPPING_YEN = CLICK_POST_FLAT_YEN;

/** 購入合計の目安（本体＋クリックポスト） */
export const AMAPPOLA_TOTAL_YEN = AMAPPOLA_BOOK_YEN + AMAPPOLA_SHIPPING_YEN;

export const AMAPPOLA_META = "アマポーラ詩集 / 淡嶋健仁";

/** 横書きの説明文（淡島様「町で拾ったものです」・サイト初版・ChatGPT整理 2025-04-19） */
export const AMAPPOLA_DESCRIPTION = [
  "町で拾ったものです。",
  "アマポーラ詩集は、街や日常に落ちていた言葉や風景を、余計な説明をせず、そのまま残した詩集です。詩を書こうとして拾ったのではなく、ただ街を歩いていたら拾えたものだけを並べています。",
  "意味を届けるのではなく、そこにあったものを見るための本です。",
] as const;

/** @deprecated 縦書き用（互換） */
export const AMAPPOLA_INTRO_VERTICAL = AMAPPOLA_DESCRIPTION.join("");

const amappolaProduct: CatalogItem = {
  id: AMAPPOLA_PRODUCT_ID,
  title: "アマポーラ詩集",
  description:
    "町で拾ったもの。街や日常に落ちていた言葉や風景を、余計な説明をせず、そのまま残した詩集。",
  images: ["/uploads/amappola/cover.png"],
  createdAt: "2026-07-03T12:00:00.000Z",
  orientation: "landscape",
  price: AMAPPOLA_BOOK_YEN,
  priceLabel: "¥1,000",
  forSale: true,
  sold: false,
  shippingMethod: "click_post",
};

export function getAmappolaProduct(): CatalogItem {
  return amappolaProduct;
}

export function canPurchaseAmappola(): boolean {
  const product = getAmappolaProduct();
  return product.forSale === true && !product.sold;
}
