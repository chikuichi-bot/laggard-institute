export type NewsItem = {
  id: string;
  title: string;
  body: string;
  href?: string;
  createdAt: string;
};

export type NewsData = {
  updatedAt: string;
  items: NewsItem[];
};

export function sortNewsItems(items: NewsItem[]) {
  return [...items].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function makeNewsId(title: string) {
  const base = title
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\u3040-\u30ff\u4e00-\u9faf-]/g, "")
    .slice(0, 32);
  const suffix = Date.now().toString(36);
  return base ? `news-${base}-${suffix}` : `news-${suffix}`;
}

export function formatNewsDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}
