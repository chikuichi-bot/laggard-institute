/**
 * Per-viewer rate limit for paid Gemini routes.
 * Keys must come from verified identity.sub — never from client-supplied IPs.
 */

type Bucket = {
  hits: number[];
  /** last touch, for eviction */
  touchedAt: number;
};

const buckets = new Map<string, Bucket>();

const EVICT_EVERY_MS = 60_000;
const KEEP_IDLE_MS = 10 * 60_000;
let lastEvictAt = 0;

function evictStale(now: number) {
  if (now - lastEvictAt < EVICT_EVERY_MS) return;
  lastEvictAt = now;
  for (const [key, bucket] of buckets) {
    if (now - bucket.touchedAt > KEEP_IDLE_MS) {
      buckets.delete(key);
    }
  }
}

/** Returns true when the request is allowed. */
export function allowViewerRequest(
  viewerKey: string,
  maxHits: number,
  windowMs: number,
): boolean {
  const now = Date.now();
  evictStale(now);

  const prev = buckets.get(viewerKey);
  const recent = (prev?.hits ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= maxHits) {
    buckets.set(viewerKey, { hits: recent, touchedAt: now });
    return false;
  }
  recent.push(now);
  buckets.set(viewerKey, { hits: recent, touchedAt: now });
  return true;
}
