/**
 * ブラウザに少しずつ溜まる「一度 Gemini が編集した駅」の正本（localStorage）。
 */
import {
  RETIRED_STATION_IDS,
  type StationSeed,
} from "@/data/mishiranu-stations";

const STORAGE_KEY = "mishiranu.stationLibrary.v1";
const RETIRED = new Set<string>(RETIRED_STATION_IDS);

type LibraryFile = {
  version: 1;
  savedAt: string;
  stations: StationSeed[];
};

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function loadStationLibrary(): StationSeed[] {
  if (!canUseStorage()) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LibraryFile;
    if (parsed?.version !== 1 || !Array.isArray(parsed.stations)) return [];
    const kept = parsed.stations.filter(
      (s): s is StationSeed =>
        !!s &&
        typeof s.id === "string" &&
        typeof s.name === "string" &&
        !RETIRED.has(s.id),
    );
    if (kept.length !== parsed.stations.length) {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            version: 1,
            savedAt: new Date().toISOString(),
            stations: kept,
          } satisfies LibraryFile),
        );
      } catch {
        /* ignore */
      }
    }
    return kept;
  } catch {
    return [];
  }
}

export function saveStationToLibrary(station: StationSeed): StationSeed[] {
  if (!canUseStorage()) return [];
  const next = upsert(loadStationLibrary(), {
    ...station,
    id: stableStationId(station.name, station.id),
    source: station.source ?? "ai",
  });
  const file: LibraryFile = {
    version: 1,
    savedAt: new Date().toISOString(),
    stations: next,
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(file));
  } catch {
    // quota 等は黙ってメモリ上の結果だけ返す
  }
  return next;
}

/** 調べた駅リストから外す。 */
export function removeStationFromLibrary(id: string): StationSeed[] {
  if (!canUseStorage()) return [];
  const next = loadStationLibrary().filter((s) => s.id !== id);
  const file: LibraryFile = {
    version: 1,
    savedAt: new Date().toISOString(),
    stations: next,
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(file));
  } catch {
    /* ignore */
  }
  return next;
}

/** 駅名で保存済みを探す。 */
export function findSavedStation(
  name: string,
  list: StationSeed[] = loadStationLibrary(),
): StationSeed | undefined {
  const bare = name.replace(/駅$/u, "").trim();
  if (!bare) return undefined;
  return list.find((s) => s.name.replace(/駅$/u, "") === bare);
}

/** 同じ駅名は毎回同じ id（時刻付き id をやめる）。 */
export function stableStationId(name: string, fallback?: string): string {
  const bare = name.replace(/駅$/u, "").trim();
  if (!bare) return fallback || `ai-unknown`;
  return `ai-${bare}`;
}

export function upsert(
  list: StationSeed[],
  station: StationSeed,
): StationSeed[] {
  const bare = station.name.replace(/駅$/u, "");
  const without = list.filter(
    (s) =>
      s.id !== station.id &&
      s.name !== station.name &&
      s.name.replace(/駅$/u, "") !== bare,
  );
  return [station, ...without];
}

/** シード＋保存済みを id でマージ（保存済みが優先）。 */
export function mergeCatalog(
  seeds: StationSeed[],
  saved: StationSeed[],
): StationSeed[] {
  const byId = new Map<string, StationSeed>();
  for (const s of seeds) byId.set(s.id, s);
  for (const s of saved) byId.set(s.id, s);
  // 名前重複は保存済みを優先
  const byName = new Map<string, StationSeed>();
  for (const s of byId.values()) {
    const key = s.name.replace(/駅$/u, "");
    const prev = byName.get(key);
    if (!prev || s.source === "ai" || saved.some((x) => x.id === s.id)) {
      byName.set(key, s);
    }
  }
  return Array.from(byName.values());
}
