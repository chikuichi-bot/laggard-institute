/**
 * bike-rental-locks.json をさくらの案内キャッシュへ反映。
 * npx tsx --env-file=.env.local scripts/seal-bike-rentals.ts
 */
import {
  cacheKey,
  readCachedStation,
} from "../lib/mishiranu-station-cache";
import { applyBikeRentalLocks, listBikeLockStationNames } from "../lib/mishiranu-bike-locks";
import { sealMapCoordinates } from "../lib/mishiranu-map-trust";
import type { StationSeed } from "../data/mishiranu-stations";

async function putStation(rawName: string, station: StationSeed): Promise<void> {
  const base = process.env.MISHIRANU_CACHE_URL?.replace(/\/+$/, "");
  const secret = process.env.MISHIRANU_CACHE_TOKEN?.trim();
  if (!base || !secret) throw new Error("cache env missing");
  // writeCachedStation は spots<3 で黙ってスキップするので put.php 直叩き
  const body = JSON.stringify({
    key: cacheKey(rawName),
    entry: { schema: "v1", savedAt: Date.now(), station },
  });
  const res = await fetch(`${base}/put.php`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-mishiranu-cache-token": secret,
      "user-agent":
        "MishiranuEkiCache/1.0 (+https://lagado.jp/mishiranu-cache; compatible; Mozilla/5.0)",
    },
    body,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`put ${rawName} ${res.status} ${text}`);
  console.log("put", rawName, res.status);
}

async function main() {
  const names = listBikeLockStationNames();
  let ok = 0;
  let miss = 0;
  for (const name of names) {
    const st = await readCachedStation(name);
    if (!st) {
      console.log("MISS cache", name);
      miss++;
      continue;
    }
    const bike = applyBikeRentalLocks(name, st.bikeRental);
    const next = sealMapCoordinates({ ...st, bikeRental: bike });
    // spots が3未満だと次回 read が null になるので、足りなければ触らない
    if ((next.spots?.length ?? 0) < 3) {
      console.log("SKIP spots<3", name, next.spots?.length);
      continue;
    }
    await putStation(name, next);
    console.log(
      " ",
      bike.available
        ? (bike.places?.some((p) => /CLEW|クルー/i.test(p.name))
            ? "CLEW"
            : bike.places?.some((p) => /HELLO/i.test(p.name))
              ? "HELLO"
              : "ok")
        : "none",
      bike.places?.map((p) => p.name).join(" / ") ?? "",
    );
    ok++;
    await new Promise((r) => setTimeout(r, 400));
  }
  console.log(`done ok=${ok} miss=${miss} locks=${names.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
