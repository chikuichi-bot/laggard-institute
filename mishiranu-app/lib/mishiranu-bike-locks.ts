/**
 * レンタサイクル正本（CLEW / HELLO の駅名付きポート）。
 * 推測・近所・別駅・支店は載せない。正本: data/bike-rental-locks.json
 */
import bikeRentalLocks from "@/data/bike-rental-locks.json";
import type { BikeRentalInfo, BikeRentalPlace } from "@/data/mishiranu-stations";

type BikeLock = {
  station: string;
  kind?: string;
  name: string;
  walkMinutes: number;
  note?: string;
  summary?: string;
};

function bare(name: string): string {
  return name.replace(/駅$/u, "").trim();
}

function isClew(name: string): boolean {
  return /CLEW|クルー|CREW/i.test(name);
}

function isHello(name: string): boolean {
  return /HELLO|ハロー/.test(name);
}

export function bikeLocksForStation(stationName: string): BikeLock[] {
  const b = bare(stationName);
  return (bikeRentalLocks.locks as BikeLock[]).filter(
    (lock) => b.includes(lock.station) || stationName.includes(lock.station),
  );
}

/** 正本ロックを優先して bikeRental を確定する。 */
export function applyBikeRentalLocks(
  stationName: string,
  current?: BikeRentalInfo | null,
): BikeRentalInfo {
  const locks = bikeLocksForStation(stationName);
  const lockedPlaces: BikeRentalPlace[] = locks.map((lock) => ({
    kind: lock.kind === "local" ? "local" : "app",
    name: lock.name,
    walkMinutes: lock.walkMinutes,
    note: lock.note,
  }));

  let places = [...(current?.places ?? [])].filter((p) => {
    // 他駅の CLEW 正本名が混ざっていたら落とす
    for (const lock of bikeRentalLocks.locks as BikeLock[]) {
      if (
        (p.name === lock.name || p.name.includes(lock.station)) &&
        !(
          bare(stationName).includes(lock.station) ||
          stationName.includes(lock.station)
        )
      ) {
        return false;
      }
    }
    return true;
  });

  // 正本を必ず入れる（同系統 CLEW / HELLO は正本名に寄せる。確認済みの local 店は残す）
  if (lockedPlaces.length) {
    places = places.filter((p) => !isClew(p.name) && !isHello(p.name));
    places.push(...lockedPlaces);
  }

  const seen = new Set<string>();
  places = places
    .sort((a, b) => (a.walkMinutes ?? 99) - (b.walkMinutes ?? 99))
    .filter((p) => {
      const key = isClew(p.name)
        ? `clew:${bare(stationName)}`
        : isHello(p.name)
          ? "hello"
          : p.name;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  const available = places.length > 0;
  const summary = available
    ? (locks[0]?.summary ??
      (current?.summary &&
      current.summary.length >= 12 &&
      !/未確認|使えることがあります|えむじか/.test(current.summary)
        ? current.summary
        : `この駅で確認できた貸出は次のとおりです（${places.map((p) => p.name).join("、")}）。`))
    : "この駅で確認できたレンタサイクルは、いまのところありません。観光案内所や駅掲示も見てください。";

  return {
    available,
    summary,
    places: available ? places : undefined,
  };
}

export function listBikeLockStationNames(): string[] {
  return [...new Set((bikeRentalLocks.locks as BikeLock[]).map((l) => l.station))];
}
