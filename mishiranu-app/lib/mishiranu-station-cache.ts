/**
 * 駅案内の共有キャッシュ（さくらのレンタルサーバ）。
 *
 * 同じ駅は誰が引いても中身が同じなので、一度作ったら置いておいて配る。
 * Gemini の検索グラウンディングはリクエスト単位の課金なので、
 * ここで当たるぶんがそのまま費用の削減になる。
 *
 * 読みは静的 JSON への GET（PHP を通さない）。
 * 書きだけ put.php に POST する。共有サーバで Node は動かないが、これなら足りる。
 *
 * 設定（未設定ならキャッシュ無しで従来どおり動く）:
 *   MISHIRANU_CACHE_URL   例 https://example.sakura.ne.jp/mishiranu-cache
 *   MISHIRANU_CACHE_TOKEN put.php と同じ合言葉
 */
import { createHash } from "node:crypto";
import type { StationSeed } from "@/data/mishiranu-stations";

/** 案内の作り方を変えたら上げる。古い版は読まれなくなる。 */
const CACHE_SCHEMA = "v1";

/** 店は閉まる（えむじか 2026-01）。古い案内は作り直す。 */
const MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;

const READ_TIMEOUT_MS = 2_500;
const WRITE_TIMEOUT_MS = 5_000;
const MAX_BYTES = 512 * 1024;

type CacheEntry = {
  schema: string;
  savedAt: number;
  station: StationSeed;
};

function baseUrl(): string | null {
  const raw = process.env.MISHIRANU_CACHE_URL?.trim();
  if (!raw) return null;
  if (!/^https:\/\//i.test(raw)) return null;
  return raw.replace(/\/+$/, "");
}

function token(): string | null {
  const raw = process.env.MISHIRANU_CACHE_TOKEN?.trim();
  return raw && raw.length >= 16 ? raw : null;
}

/** 「出町柳駅」「 出町柳 」を同じ鍵にする。ファイル名は16進だけ。 */
export function cacheKey(rawName: string): string {
  const normalized = rawName
    .normalize("NFKC")
    .replace(/\s+/gu, "")
    .replace(/駅$/u, "")
    .toLowerCase();
  return createHash("sha256").update(normalized).digest("hex");
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  ms: number,
): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** 当たれば駅案内、無ければ null。失敗は常に null（生成に進む）。 */
export async function readCachedStation(
  rawName: string,
): Promise<StationSeed | null> {
  const base = baseUrl();
  if (!base) return null;

  const url = `${base}/${CACHE_SCHEMA}/${cacheKey(rawName)}.json`;
  const response = await fetchWithTimeout(
    url,
    { cache: "no-store" },
    READ_TIMEOUT_MS,
  );
  if (!response?.ok) return null;

  const length = Number(response.headers.get("content-length") ?? 0);
  if (length > MAX_BYTES) return null;

  let entry: CacheEntry;
  try {
    entry = (await response.json()) as CacheEntry;
  } catch {
    return null;
  }

  if (entry?.schema !== CACHE_SCHEMA) return null;
  if (typeof entry.savedAt !== "number") return null;
  if (Date.now() - entry.savedAt > MAX_AGE_MS) return null;

  const station = entry.station;
  if (!station?.name || !Array.isArray(station.spots)) return null;
  if (station.spots.length < 3) return null;
  return station;
}

/** 生成できた案内を置く。失敗しても呼び出し側は気にしない。 */
export async function writeCachedStation(
  rawName: string,
  station: StationSeed,
): Promise<void> {
  const base = baseUrl();
  const secret = token();
  if (!base || !secret) return;
  if (!station?.name || (station.spots?.length ?? 0) < 3) return;

  const entry: CacheEntry = {
    schema: CACHE_SCHEMA,
    savedAt: Date.now(),
    station,
  };
  const body = JSON.stringify({ key: cacheKey(rawName), entry });
  if (body.length > MAX_BYTES) return;

  await fetchWithTimeout(
    `${base}/put.php`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-mishiranu-cache-token": secret,
      },
      body,
    },
    WRITE_TIMEOUT_MS,
  );
}
