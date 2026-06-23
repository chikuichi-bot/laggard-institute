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
