import { readCatalog, writeCatalog } from "./items";
import type { ItemCategory } from "./types";

/** 決済完了後に商品を売約済みにする（Webhook 用・冪等） */
export async function markItemSold(category: ItemCategory, id: string) {
  const catalog = await readCatalog(category);
  const index = catalog.findIndex((entry) => entry.id === id);
  if (index < 0) return false;

  const item = catalog[index];
  if (item.sold) return true;

  catalog[index] = { ...item, sold: true };
  await writeCatalog(category, catalog);
  return true;
}
