import { promises as fs } from "fs";
import path from "path";
import { categoryBasePath, categoryLabel } from "./category";
import type { ItemCategory } from "./types";

export { categoryBasePath, categoryLabel };

const DATA_DIR = path.join(process.cwd(), "data");

export async function readCatalog(category: ItemCategory) {
  const filePath = path.join(DATA_DIR, `${category}.json`);
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as import("./types").CatalogItem[];
  } catch {
    return [];
  }
}

export async function writeCatalog(
  category: ItemCategory,
  items: import("./types").CatalogItem[],
) {
  const filePath = path.join(DATA_DIR, `${category}.json`);
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(items, null, 2) + "\n", "utf8");
}

export async function getItem(category: ItemCategory, id: string) {
  const items = await readCatalog(category);
  return items.find((item) => item.id === id) ?? null;
}

export function makeItemId(title: string) {
  const base = title
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\u3040-\u30ff\u4e00-\u9faf-]/g, "")
    .slice(0, 32);
  const suffix = Date.now().toString(36);
  return base ? `${base}-${suffix}` : `item-${suffix}`;
}

export function sortByFoundOrder(items: import("./types").CatalogItem[]) {
  return [...items].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}
