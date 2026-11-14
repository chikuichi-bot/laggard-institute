/**
 * 収録土地文がある駅の spots 寄り Search バッチ。
 * 土地文は触らず、さくら共有キャッシュへ書く（MONETIZATION 分散バッチ）。
 *
 *   npx tsx --env-file=.env.local scripts/batch-land-spots.ts --dry-run
 *   npx tsx --env-file=.env.local scripts/batch-land-spots.ts
 *   npx tsx --env-file=.env.local scripts/batch-land-spots.ts --line eizan --limit 3
 *   npx tsx --env-file=.env.local scripts/batch-land-spots.ts --force
 */
import {
  isRichLandDepth,
  listLandStockSpotBatchTargets,
  lookupAreaDepthByName,
} from "../lib/mishiranu-area-depth";
import { generateStationGuideWithGemini } from "../lib/mishiranu-station-ai";
import {
  cacheConfigured,
  readCachedStation,
  writeCachedStation,
} from "../lib/mishiranu-station-cache";

type Line = "eizan" | "keihan" | "randen" | "hankyu" | "sagano" | "karasuma";

function parseArgs(argv: string[]) {
  let dryRun = false;
  let force = false;
  let limit = Infinity;
  let delayMs = 2_500;
  let line: Line | undefined;
  let only: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") dryRun = true;
    else if (a === "--force") force = true;
    else if (a === "--limit") limit = Number(argv[++i]);
    else if (a === "--delay") delayMs = Number(argv[++i]);
    else if (a === "--line") line = argv[++i] as Line;
    else if (a === "--only") only = argv[++i];
  }
  return { dryRun, force, limit, delayMs, line, only };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

const MIN_SPOTS = 3;
const MAX_ATTEMPTS = 3;

async function generateOnce(name: string, apiKey: string, viewerSub: string) {
  const result = await generateStationGuideWithGemini(name, apiKey, viewerSub);
  if ("error" in result) return result;
  if ((result.station.spots?.length ?? 0) < MIN_SPOTS) {
    return {
      error: "empty_spots",
      message: `spots ${result.station.spots.length} < ${MIN_SPOTS}`,
    } as const;
  }
  return result;
}

function isTransientError(error: string): boolean {
  return error === "gemini_http" || error === "network" || error === "empty_spots";
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!opts.dryRun && !apiKey) {
    console.error("GEMINI_API_KEY がありません（.env.local）");
    process.exit(1);
  }
  if (!cacheConfigured()) {
    console.warn(
      "警告: MISHIRANU_CACHE_URL 未設定 — 生成してもさくらへ書けません",
    );
  }

  let targets = listLandStockSpotBatchTargets({ line: opts.line });
  if (opts.only) {
    targets = targets.filter((t) => t.name === opts.only);
  }

  const richOk: { line: Line; name: string }[] = [];
  const richSkip: string[] = [];
  for (const t of targets) {
    if (isRichLandDepth(lookupAreaDepthByName(t.name))) richOk.push(t);
    else richSkip.push(t.name);
  }
  if (richSkip.length) {
    console.warn("isRichLandDepth 未満（除外）:", richSkip.join(", "));
  }

  const planned = richOk.slice(0, opts.limit);
  console.log(
    `対象 ${planned.length} 駅 · dryRun=${opts.dryRun} force=${opts.force} delay=${opts.delayMs}ms`,
  );

  let cached = 0;
  let generated = 0;
  let failed = 0;
  let skipped = 0;

  for (let i = 0; i < planned.length; i++) {
    const { line, name } = planned[i]!;
    const label = `[${i + 1}/${planned.length}] ${line} ${name}`;
    let existing = await readCachedStation(name);
    if (!existing && !opts.force) {
      // さくらの一時ミスを避けるため、MISS は一度だけ再読
      await sleep(500);
      existing = await readCachedStation(name);
    }
    if (existing && !opts.force) {
      cached++;
      console.log(`${label} · cache hit spots=${existing.spots.length}`);
      continue;
    }

    if (opts.dryRun) {
      skipped++;
      console.log(
        `${label} · would generate${existing ? " (force overwrite)" : ""}`,
      );
      continue;
    }

    process.stdout.write(`${label} · generating… `);
    try {
      let result = await generateOnce(
        name,
        apiKey!,
        `batch-land-spots:${line}`,
      );
      for (let attempt = 2; attempt <= MAX_ATTEMPTS; attempt++) {
        if (!("error" in result)) break;
        if (!isTransientError(result.error)) break;
        const backoff =
          result.error === "gemini_http" || result.error === "network"
            ? 15_000 * (attempt - 1)
            : Math.max(opts.delayMs, 4_000);
        process.stdout.write(`retry${attempt}… `);
        await sleep(backoff);
        result = await generateOnce(
          name,
          apiKey!,
          `batch-land-spots:${line}:r${attempt}`,
        );
      }
      if ("error" in result) {
        failed++;
        console.log(`FAIL ${result.error}: ${result.message}`);
      } else {
        await writeCachedStation(name, result.station);
        let cachedOk = await readCachedStation(name);
        if (!cachedOk) {
          await sleep(2_000);
          await writeCachedStation(name, result.station);
          cachedOk = await readCachedStation(name);
        }
        if (!cachedOk) {
          failed++;
          console.log(
            `FAIL cache_write spots=${result.station.spots.length} (さくら未反映)`,
          );
        } else {
          generated++;
          console.log(
            `ok spots=${result.station.spots.length} line=${result.station.line}`,
          );
        }
      }
    } catch (e) {
      failed++;
      console.log(`FAIL ${e instanceof Error ? e.message : String(e)}`);
    }

    if (i < planned.length - 1) await sleep(opts.delayMs);
  }

  console.log(
    `\n完了: generated=${generated} cache_hit=${cached} dry_skip=${skipped} failed=${failed}`,
  );
  if (failed > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
