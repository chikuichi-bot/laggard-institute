import {
  cacheConfigured,
  readCachedStation,
} from "../lib/mishiranu-station-cache";
import { listLandStockSpotBatchTargets } from "../lib/mishiranu-area-depth";

async function main() {
  console.log("configured", cacheConfigured());
  const targets = listLandStockSpotBatchTargets();
  let hit = 0;
  let miss = 0;
  for (const t of targets) {
    let c = await readCachedStation(t.name);
    if (!c) {
      await new Promise((r) => setTimeout(r, 400));
      c = await readCachedStation(t.name);
    }
    if (c) {
      hit++;
      console.log(`HIT ${t.line} ${t.name} spots=${c.spots.length}`);
    } else {
      miss++;
      console.log(`MISS ${t.line} ${t.name}`);
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  console.log(`\nHIT ${hit} / MISS ${miss} / total ${targets.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
