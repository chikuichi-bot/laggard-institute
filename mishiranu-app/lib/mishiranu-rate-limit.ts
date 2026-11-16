/**
 * Rate limits for paid Gemini routes.
 * Keys must come from verified identity.sub — never from client-supplied IPs.
 *
 * Viewer + process budgets are persisted to a small JSON file under the OS
 * temp dir so a process restart cannot wipe the counters and reopen unbounded
 * Gemini spend. Limits stay conservative; Maps are size-capped.
 */

import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

type Bucket = {
  hits: number[];
  touchedAt: number;
};

type PersistedState = {
  version: 1;
  buckets: Record<string, Bucket>;
  globalPaidHits: number[];
};

const buckets = new Map<string, Bucket>();

const EVICT_EVERY_MS = 60_000;
const KEEP_IDLE_MS = 10 * 60_000;
const MAX_BUCKET_KEYS = 2_000;
let lastEvictAt = 0;
let loaded = false;
let dirty = false;
let lastPersistAt = 0;
const PERSIST_EVERY_MS = 1_500;

/** Process-wide paid Gemini call budget (all viewers). */
const GLOBAL_PAID_WINDOW_MS = 60_000;
const GLOBAL_PAID_MAX = 24;
const globalPaidHits: number[] = [];
let inFlightPaid = 0;
const GLOBAL_IN_FLIGHT_MAX = 4;

function storePath(): string {
  const base = process.env.MISHIRANU_RATE_LIMIT_DIR?.trim() || tmpdir();
  return join(base, "mishiranu-eki", "rate-limit-v1.json");
}

function pruneHits(hits: number[], now: number, windowMs: number): number[] {
  return hits.filter((t) => now - t < windowMs);
}

function ensureLoaded() {
  if (loaded) return;
  loaded = true;
  try {
    const raw = readFileSync(storePath(), "utf8");
    const parsed = JSON.parse(raw) as PersistedState;
    if (parsed?.version !== 1 || !parsed.buckets) return;
    const now = Date.now();
    for (const [key, bucket] of Object.entries(parsed.buckets)) {
      if (!bucket || !Array.isArray(bucket.hits)) continue;
      const hits = pruneHits(bucket.hits, now, 60 * 60_000);
      if (hits.length === 0) continue;
      buckets.set(key, {
        hits,
        touchedAt: typeof bucket.touchedAt === "number" ? bucket.touchedAt : now,
      });
      if (buckets.size >= MAX_BUCKET_KEYS) break;
    }
    if (Array.isArray(parsed.globalPaidHits)) {
      globalPaidHits.length = 0;
      globalPaidHits.push(
        ...pruneHits(parsed.globalPaidHits, now, GLOBAL_PAID_WINDOW_MS),
      );
    }
  } catch {
    // Missing or corrupt store → start empty (fail closed only via live caps).
  }
}

function markDirty() {
  dirty = true;
  const now = Date.now();
  if (now - lastPersistAt >= PERSIST_EVERY_MS) {
    persistNow();
  }
}

function persistNow() {
  if (!dirty) return;
  dirty = false;
  lastPersistAt = Date.now();
  const path = storePath();
  const state: PersistedState = {
    version: 1,
    buckets: Object.fromEntries(buckets.entries()),
    globalPaidHits: [...globalPaidHits],
  };
  try {
    mkdirSync(dirname(path), { recursive: true });
    const tmp = `${path}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(state), "utf8");
    renameSync(tmp, path);
  } catch {
    dirty = true;
  }
}

function evictStale(now: number) {
  if (now - lastEvictAt < EVICT_EVERY_MS) return;
  lastEvictAt = now;
  let removed = false;
  for (const [key, bucket] of buckets) {
    if (now - bucket.touchedAt > KEEP_IDLE_MS) {
      buckets.delete(key);
      removed = true;
    }
  }
  // Hard cap: drop oldest touched keys first.
  if (buckets.size > MAX_BUCKET_KEYS) {
    const ranked = [...buckets.entries()].sort(
      (a, b) => a[1].touchedAt - b[1].touchedAt,
    );
    const overflow = buckets.size - MAX_BUCKET_KEYS;
    for (let i = 0; i < overflow; i += 1) {
      const key = ranked[i]?.[0];
      if (key) buckets.delete(key);
    }
    removed = true;
  }
  if (removed) markDirty();
}

/** Returns true when the request is allowed. */
export function allowViewerRequest(
  viewerKey: string,
  maxHits: number,
  windowMs: number,
): boolean {
  ensureLoaded();
  const now = Date.now();
  evictStale(now);

  const prev = buckets.get(viewerKey);
  const recent = pruneHits(prev?.hits ?? [], now, windowMs);
  if (recent.length >= maxHits) {
    buckets.set(viewerKey, { hits: recent, touchedAt: now });
    markDirty();
    return false;
  }
  recent.push(now);
  buckets.set(viewerKey, { hits: recent, touchedAt: now });
  markDirty();
  return true;
}

/** Max paid Gemini HTTP calls per viewer per rolling hour. */
export const VIEWER_HOURLY_PAID_MAX = 40;

/**
 * Peek whether the viewer still has hourly paid-call budget (does not charge).
 */
export function hasViewerHourlyBudget(
  viewerSub: string,
  maxHits = VIEWER_HOURLY_PAID_MAX,
  windowMs = 60 * 60_000,
): boolean {
  ensureLoaded();
  const now = Date.now();
  const prev = buckets.get(`hourly:${viewerSub}`);
  const recent = pruneHits(prev?.hits ?? [], now, windowMs);
  return recent.length < maxHits;
}

/**
 * Charge one unit of the viewer's hourly paid-call budget.
 * Returns false when the budget is already exhausted.
 */
export function consumeViewerHourlyBudget(
  viewerSub: string,
  maxHits = VIEWER_HOURLY_PAID_MAX,
  windowMs = 60 * 60_000,
): boolean {
  return allowViewerRequest(`hourly:${viewerSub}`, maxHits, windowMs);
}

/** @deprecated Use hasViewerHourlyBudget / consume via beginPaidAiCall. */
export function allowViewerHourlyBudget(
  viewerSub: string,
  maxHits = VIEWER_HOURLY_PAID_MAX,
  windowMs = 60 * 60_000,
): boolean {
  return hasViewerHourlyBudget(viewerSub, maxHits, windowMs);
}

/** 買い切り BYOK（viewerSub が byok: で始まる）はホスト側の Gemini 予算を使わない。 */
export function isByokViewer(viewerSub: string): boolean {
  return viewerSub.startsWith("byok:");
}

/**
 * Gate before any paid Gemini HTTP call.
 * Charges both the process-wide budget and one unit of the viewer's hourly
 * paid-call budget (so a route that makes 3 Gemini calls costs 3, not 1).
 * Returns a release() that must be called in finally.
 * BYOK（ユーザー自身の API キー）はホスト予算を消費しない。
 */
export function beginPaidAiCall(
  viewerSub: string,
): { ok: true; release: () => void } | { ok: false } {
  ensureLoaded();

  if (isByokViewer(viewerSub)) {
    return { ok: true, release: () => {} };
  }

  const now = Date.now();
  const recent = pruneHits(globalPaidHits, now, GLOBAL_PAID_WINDOW_MS);
  globalPaidHits.length = 0;
  globalPaidHits.push(...recent);

  if (
    globalPaidHits.length >= GLOBAL_PAID_MAX ||
    inFlightPaid >= GLOBAL_IN_FLIGHT_MAX
  ) {
    markDirty();
    return { ok: false };
  }

  if (!consumeViewerHourlyBudget(viewerSub)) {
    markDirty();
    return { ok: false };
  }

  globalPaidHits.push(now);
  inFlightPaid += 1;
  markDirty();
  let released = false;
  return {
    ok: true,
    release: () => {
      if (released) return;
      released = true;
      inFlightPaid = Math.max(0, inFlightPaid - 1);
      // Persist after release so a crash mid-call still counted the attempt.
      markDirty();
      persistNow();
    },
  };
}

/** Flush pending counters (tests / graceful shutdown). */
export function flushRateLimitStore(): void {
  ensureLoaded();
  persistNow();
}
