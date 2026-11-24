/**
 * 元田中: landmark-locks をさくらの案内キャッシュへ反映。
 * 使い切り: npx tsx scripts/_seal-mototanaka-cache.ts
 *
 * writeCachedStation は spots<3 で黙ってスキップするので、ここは put.php を直接叩く。
 */
import {
  cacheKey,
  readCachedStation,
} from "../lib/mishiranu-station-cache";
import { sealMapCoordinates } from "../lib/mishiranu-map-trust";
import type { Spot, StationSeed } from "../data/mishiranu-stations";

const alleyTip: Spot = {
  id: "mototanaka-satonomae-alley",
  name: "田中里ノ前通の路地",
  genre: "history",
  guide: "tip",
  mealTier: "casual",
  mealTimes: [],
  soloOk: true,
  budgetYen: "—",
  hours: "終日",
  blurb: "駅西の住宅街。歩き方文どおり、細い路地を縫って鎮守へ向かう。",
  detail: "",
  walkMinutes: 3,
  x: 0.4,
  y: 0.5,
  majorWorthy: false,
  secretWorthy: true,
  coordTrust: "unverified",
};

async function putStation(rawName: string, station: StationSeed): Promise<void> {
  const base = process.env.MISHIRANU_CACHE_URL?.replace(/\/+$/, "");
  const secret = process.env.MISHIRANU_CACHE_TOKEN?.trim();
  if (!base || !secret) throw new Error("cache env missing");
  const entry = {
    schema: "v1",
    savedAt: Date.now(),
    station,
  };
  const body = JSON.stringify({ key: cacheKey(rawName), entry });
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
  console.log("put", res.status, text.slice(0, 200));
  if (!res.ok) throw new Error(`put failed ${res.status}`);
}

async function main() {
  const name = "元田中";
  const st = await readCachedStation(name);
  if (!st) {
    console.error("no cache for", name);
    process.exit(1);
  }
  console.log("before:");
  for (const s of st.spots) {
    console.log(" ", s.name, s.lat, s.lng, s.coordTrust);
  }
  const deduped: StationSeed = {
    ...st,
    spots: st.spots.filter((s, i, arr) => {
      if (s.name === "元田中駅") return false;
      const first = arr.findIndex((x) => x.name === s.name);
      // 疏水は lock を優先
      if (s.name.includes("疏水")) {
        const lockIdx = arr.findIndex(
          (x) => x.name.includes("疏水") && x.coordTrust === "lock",
        );
        if (lockIdx >= 0) return i === lockIdx;
      }
      return first === i;
    }),
  };
  const sealed = sealMapCoordinates(deduped);
  sealed.spots = sealed.spots.map((s) =>
    s.name.includes("疏水")
      ? { ...s, guide: "sight" as const, genre: "nature" as const }
      : s,
  );
  if (!sealed.spots.some((s) => s.name.includes("里ノ前"))) {
    sealed.spots = [...sealed.spots, alleyTip];
  }
  console.log("after:");
  for (const s of sealed.spots) {
    console.log(" ", s.name, s.lat, s.lng, s.coordTrust, s.guide);
  }
  await putStation(name, sealed);
  // CDN / 静的の反映待ち
  await new Promise((r) => setTimeout(r, 1500));
  const again = await readCachedStation(name);
  console.log("reread", again ? "ok" : "FAIL", "n=", again?.spots.length);
  for (const s of again?.spots ?? []) {
    console.log(" ", s.name, s.lat, s.lng, s.coordTrust);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
