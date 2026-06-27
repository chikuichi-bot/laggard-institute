import type { ItemCategory } from "./types";

export function isItemCategory(value: string): value is ItemCategory {
  return value === "antiques" || value === "city" || value === "sea";
}

export function categoryLabel(category: ItemCategory) {
  switch (category) {
    case "antiques":
      return "古道具";
    case "city":
      return "街で見つけたモノ";
    case "sea":
      return "海で見つけたモノ";
  }
}

export function categoryBasePath(category: ItemCategory) {
  return `/${category}`;
}

export function isPhotoOnlyCategory(category: ItemCategory) {
  return category === "city" || category === "sea";
}

export function catalogDisplayTitle(
  item: { title: string; location?: string },
  category: ItemCategory,
) {
  if (isPhotoOnlyCategory(category)) {
    return item.location?.trim() || item.title;
  }
  return item.title;
}
