/**
 * Rate limits for paid Gemini routes.
 * Keys must come from verified identity.sub — never from client-supplied IPs.
 *
 * Limits are in-process only (each instance has its own Map). We therefore keep
 * them conservative and add a process-wide paid-call budget so a single hot
 * process cannot fan out unbounded Gemini traffic.
 */

type Bucket = {
  hits: number[];
  touchedAt: number;
};

const buckets = new Map<string, Bucket>();

const EVICT_EVERY_MS = 60_000;
const KEEP_IDLE_MS = 10 * 60_000;
let lastEvictAt = 0;

/** Process-wide paid Gemini call budget (all viewers). */
const GLOBAL_PAID_WINDOW_MS = 60_000;
const GLOBAL_PAID_MAX = 24;
const globalPaidHits: number[] = [];
let inFlightPaid = 0;
const GLOBAL_IN_FLIGHT_MAX = 4;

function evictStale(now: number) {
  if (now - lastEvictAt < EVICT_EVERY_MS) return;
  lastEvictAt = now;
  for (const [key, bucket] of buckets) {
    if (now - bucket.touchedAt > KEEP_IDLE_MS) {
      buckets.delete(key);
    }
  }
}

function pruneHits(hits: number[], now: number, windowMs: number): number[] {
  return hits.filter((t) => now - t < windowMs);
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
  const recent = pruneHits(prev?.hits ?? [], now, windowMs);
  if (recent.length >= maxHits) {
    buckets.set(viewerKey, { hits: recent, touchedAt: now });
    return false;
  }
  recent.push(now);
  buckets.set(viewerKey, { hits: recent, touchedAt: now });
  return true;
}

/**
 * Shared hourly budget for AI-generating routes (nearby/station/copy).
 * Separate from the short per-route window so a viewer cannot burn quota all day.
 */
export function allowViewerHourlyBudget(
  viewerSub: string,
  maxHits = 40,
  windowMs = 60 * 60_000,
): boolean {
  return allowViewerRequest(`hourly:${viewerSub}`, maxHits, windowMs);
}

/**
 * Process-wide gate before any paid Gemini HTTP call.
 * Returns a release() that must be called in finally.
 */
export function beginPaidAiCall():
  | { ok: true; release: () => void }
  | { ok: false } {
  const now = Date.now();
  const recent = pruneHits(globalPaidHits, now, GLOBAL_PAID_WINDOW_MS);
  globalPaidHits.length = 0;
  globalPaidHits.push(...recent);

  if (
    globalPaidHits.length >= GLOBAL_PAID_MAX ||
    inFlightPaid >= GLOBAL_IN_FLIGHT_MAX
  ) {
    return { ok: false };
  }

  globalPaidHits.push(now);
  inFlightPaid += 1;
  let released = false;
  return {
    ok: true,
    release: () => {
      if (released) return;
      released = true;
      inFlightPaid = Math.max(0, inFlightPaid - 1);
    },
  };
}
