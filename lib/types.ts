export type ItemCategory = "antiques" | "city" | "sea";

export type CatalogItem = {
  id: string;
  title: string;
  description: string;
  location?: string;
  foundAt?: string;
  images: string[];
  createdAt: string;
  orientation?: "portrait" | "landscape" | "square";
  /** 古道具のみ */
  price?: number;
  priceLabel?: string;
  forSale?: boolean;
  sold?: boolean;
  /** 古道具の種別（茶碗 など） */
  kind?: string;
  /** 送料加算（未設定時は standard） */
  shippingSize?: "small" | "standard" | "large";
  /** ゆうパック / クリックポスト（未設定時はゆうパック） */
  shippingMethod?: "yupack" | "click_post";
  /** true のとき価格に送料を含み、決済時に送料行を出さない */
  shippingIncluded?: boolean;
};

export type CreateItemPayload = {
  category: ItemCategory;
  title: string;
  description: string;
  location?: string;
  foundAt?: string;
  price?: number;
  priceLabel?: string;
  forSale?: boolean;
};
