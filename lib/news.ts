import { promises as fs } from "fs";
import path from "path";
import type { NewsData } from "./news-types";

export type { NewsItem, NewsData } from "./news-types";
export { formatNewsDate, makeNewsId, sortNewsItems } from "./news-types";

const NEWS_PATH = path.join(process.cwd(), "data", "news.json");

const EMPTY_NEWS: NewsData = {
  updatedAt: new Date().toISOString(),
  items: [],
};

export async function readNews(): Promise<NewsData> {
  try {
    const raw = await fs.readFile(NEWS_PATH, "utf8");
    return JSON.parse(raw) as NewsData;
  } catch {
    return { ...EMPTY_NEWS };
  }
}

export async function writeNews(data: NewsData) {
  await fs.mkdir(path.dirname(NEWS_PATH), { recursive: true });
  await fs.writeFile(NEWS_PATH, JSON.stringify(data, null, 2) + "\n", "utf8");
}
