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

function pickRandomEntryFromList(
  entries: LatestEntry[],
  usedIds: Set<string>,
  usedImages: Set<string>,
): LatestEntry | null {
  const shuffled = entries.slice();
  shuffleInPlace(shuffled);

  for (const entry of shuffled) {
    const src = entry.item.images[0];
    if (!src || usedIds.has(entry.item.id) || usedImages.has(src)) continue;
    usedIds.add(entry.item.id);
    usedImages.add(src);
    return entry;
  }

  return null;
}

const HOME_PHOTO_CATEGORIES: ItemCategory[] = ["antiques", "city", "sea"];

function groupEntriesByCategory(entries: LatestEntry[]) {
  const groups = new Map<ItemCategory, LatestEntry[]>(
    HOME_PHOTO_CATEGORIES.map((category) => [category, []]),
  );

  for (const entry of entries) {
    groups.get(entry.category)?.push(entry);
  }

  return groups;
}

/** 古道具・街・海を等しく扱い、カテゴリ単位でランダムに選ぶ */
function pickBalancedHomeEntries(pool: LatestEntry[], limit: number): LatestEntry[] {
  if (pool.length === 0 || limit <= 0) return [];

  const grouped = groupEntriesByCategory(pool);
  const availableCategories = HOME_PHOTO_CATEGORIES.filter(
    (category) => (grouped.get(category)?.length ?? 0) > 0,
  );
  if (availableCategories.length === 0) return [];

  const picked: LatestEntry[] = [];
  const usedIds = new Set<string>();
  const usedImages = new Set<string>();

  if (limit >= 2 && availableCategories.length >= 2) {
    const categoryOrder = availableCategories.slice();
    shuffleInPlace(categoryOrder);

    for (const category of categoryOrder.slice(0, Math.min(limit, categoryOrder.length))) {
      const entry = pickRandomEntryFromList(grouped.get(category) ?? [], usedIds, usedImages);
      if (entry) picked.push(entry);
    }
  } else {
    while (picked.length < limit) {
      const categoriesWithItems = availableCategories.filter((category) =>
        (grouped.get(category) ?? []).some((entry) => {
          const src = entry.item.images[0];
          return src && !usedIds.has(entry.item.id) && !usedImages.has(src);
        }),
      );
      if (categoriesWithItems.length === 0) break;

      shuffleInPlace(categoriesWithItems);
      const entry = pickRandomEntryFromList(
        grouped.get(categoriesWithItems[0]!) ?? [],
        usedIds,
        usedImages,
      );
      if (!entry) break;
      picked.push(entry);
    }
  }

  if (picked.length < limit) {
    const remaining = pool.filter((entry) => {
      const src = entry.item.images[0];
      return src && !usedIds.has(entry.item.id) && !usedImages.has(src);
    });
    shuffleInPlace(remaining);

    for (const entry of remaining) {
      if (picked.length >= limit) break;
      const src = entry.item.images[0]!;
      usedIds.add(entry.item.id);
      usedImages.add(src);
      picked.push(entry);
    }
  }

  return picked;
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
export function pickHomePhotos(
  candidates: LatestEntry[],
  limit = 2,
  options?: { excludeSrcs?: string[] },
): LatestEntry[] {
  const unique = dedupeCandidates(candidates);
  if (unique.length === 0) return [];

  const exclude = new Set(options?.excludeSrcs ?? []);
  const recent = new Set(readRecentHomeImages());
  let pool = unique.filter(({ item }) => {
    const src = item.images[0];
    return src && !recent.has(src) && !exclude.has(src);
  });

  if (pool.length < limit) {
    pool = unique.filter(({ item }) => !exclude.has(item.images[0]!));
  }

  if (pool.length < limit) {
    pool = unique;
  }

  const picked = pickBalancedHomeEntries(pool, limit);
  rememberHomeImages(picked.map(({ item }) => item.images[0]!));
  return picked;
}

function buildReplacementPool(
  candidates: LatestEntry[],
  current: LatestEntry[],
  slotIndex: number,
  options?: { excludeSrcs?: string[] },
) {
  const unique = dedupeCandidates(candidates);
  if (unique.length === 0) return [];

  const slot = ((slotIndex % current.length) + current.length) % current.length;
  const exclude = new Set(options?.excludeSrcs ?? []);
  const currentSrcs = new Set(
    current.map((entry) => entry.item.images[0]!).filter(Boolean),
  );
  const recent = new Set(readRecentHomeImages());

  let pool = unique.filter(({ item }) => {
    const src = item.images[0];
    return src && !currentSrcs.has(src) && !exclude.has(src) && !recent.has(src);
  });

  if (pool.length === 0) {
    pool = unique.filter(({ item }) => {
      const src = item.images[0];
      return src && !currentSrcs.has(src) && !exclude.has(src);
    });
  }

  if (pool.length === 0) {
    pool = unique.filter(({ item }) => !currentSrcs.has(item.images[0]!));
  }

  const otherEntries = current.filter((_, index) => index !== slot);
  const otherCategories = new Set(otherEntries.map((entry) => entry.category));
  if (otherCategories.size > 0) {
    const diversified = pool.filter((entry) => !otherCategories.has(entry.category));
    if (diversified.length > 0) pool = diversified;
  }

  return pool;
}

/** 表示中の写真のうち、指定した位置だけ差し替える */
export function replaceHomePhotoSlot(
  candidates: LatestEntry[],
  current: LatestEntry[],
  slotIndex: number,
  options?: { excludeSrcs?: string[] },
): LatestEntry[] {
  if (current.length === 0) return current;

  const slot = ((slotIndex % current.length) + current.length) % current.length;
  const pool = buildReplacementPool(candidates, current, slot, options);
  const replacement = pickBalancedHomeEntries(pool, 1)[0];
  if (!replacement) return current;

  const next = [...current];
  next[slot] = replacement;
  rememberHomeImages([replacement.item.images[0]!]);
  return next;
}

/** 左右どちらかをランダムに差し替える */
export function replaceRandomHomePhotoSlot(
  candidates: LatestEntry[],
  current: LatestEntry[],
  options?: { excludeSrcs?: string[] },
): LatestEntry[] {
  if (current.length === 0) return current;
  const slot = Math.floor(Math.random() * current.length);
  return replaceHomePhotoSlot(candidates, current, slot, options);
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
  return pickBalancedHomeEntries(
    dedupeCandidates(collectPhotoCandidates(antiques, city, sea)),
    limit,
  );
}
