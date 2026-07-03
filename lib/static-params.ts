import type { ItemCategory } from "./types";
import { readCatalog } from "./items";

export async function catalogStaticParams(category: ItemCategory) {
  const items = await readCatalog(category);
  return items.map((item) => ({ id: item.id }));
}
