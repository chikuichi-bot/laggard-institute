import type { CatalogItem, ItemCategory } from "./types";

export type LatestEntry = {
  category: ItemCategory;
  item: CatalogItem;
};

const HOME_RECENT_KEY = "laggard-home-recent-images";
const HOME_RECENT_MAX = 16;

export function collectPhotoCandidates(
  antiques: CatalogItem[],
  city: CatalogItem[],
  sea: CatalogItem[],
): LatestEntry[] {
  return [
    ...antiques
      .filter((item) => item.images[0])
      .map((item) => ({ category: "antiques" as const, item })),
    ...city
      .filter((item) => item.images[0])
      .map((item) => ({ category: "city" as const, item })),
    ...sea
      .filter((item) => item.images[0])
      .map((item) => ({ category: "sea" as const, item })),
  ];
}

function dedupeCandidates(candidates: LatestEntry[]): LatestEntry[] {
  const seenIds = new Set<string>();
  const seenImages = new Set<string>();

  return candidates.filter(({ item }) => {
    const src = item.images[0];
    if (!src || seenIds.has(item.id) || seenImages.has(src)) return false;
    seenIds.add(item.id);
    seenImages.add(src);
    return true;
  });
}

function shuffleInPlace<T>(items: T[]): void {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
}

function pickUniqueEntries(pool: LatestEntry[], limit: number): LatestEntry[] {
  const shuffled = pool.slice();
  shuffleInPlace(shuffled);

  const picked: LatestEntry[] = [];
  const seenIds = new Set<string>();
  const seenImages = new Set<string>();

  for (const entry of shuffled) {
    if (picked.length >= limit) break;
    const src = entry.item.images[0];
    if (!src || seenIds.has(entry.item.id) || seenImages.has(src)) continue;
    seenIds.add(entry.item.id);
    seenImages.add(src);
    picked.push(entry);
  }

  return picked;
}

function readRecentHomeImages(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(HOME_RECENT_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function rememberHomeImages(srcs: string[]) {
  if (typeof window === "undefined" || srcs.length === 0) return;
  const merged = [...srcs, ...readRecentHomeImages()].filter(
    (src, index, all) => src && all.indexOf(src) === index,
  );
  sessionStorage.setItem(HOME_RECENT_KEY, JSON.stringify(merged.slice(0, HOME_RECENT_MAX)));
}

/** 同時表示・直近表示と被らないよう、写真付き記録をランダムに選ぶ */
export function pickHomePhotos(candidates: LatestEntry[], limit = 2): LatestEntry[] {
  const unique = dedupeCandidates(candidates);
  if (unique.length === 0) return [];

  const recent = new Set(readRecentHomeImages());
  let pool = unique.filter(({ item }) => !recent.has(item.images[0]!));

  if (pool.length < limit) {
    pool = unique;
  }

  const picked = pickUniqueEntries(pool, limit);
  rememberHomeImages(picked.map(({ item }) => item.images[0]!));
  return picked;
}

export function getLatestUpload(
  antiques: CatalogItem[],
  city: CatalogItem[],
  sea: CatalogItem[],
): LatestEntry | null {
  const candidates = dedupeCandidates(collectPhotoCandidates(antiques, city, sea));
  if (candidates.length === 0) return null;

  candidates.sort(
    (a, b) => new Date(b.item.createdAt).getTime() - new Date(a.item.createdAt).getTime(),
  );

  return candidates[0];
}

/** @deprecated pickHomePhotos を利用 */
export function getRandomHomePhotos(
  antiques: CatalogItem[],
  city: CatalogItem[],
  sea: CatalogItem[],
  limit = 2,
): LatestEntry[] {
  return pickUniqueEntries(dedupeCandidates(collectPhotoCandidates(antiques, city, sea)), limit);
}
