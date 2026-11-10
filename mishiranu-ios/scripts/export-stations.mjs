#!/usr/bin/env node
/**
 * Export the curated 見知らぬ駅 station data (TypeScript) into the JSON
 * bundled by the native iOS app. Run after editing mishiranu-app/data.
 *
 *   node mishiranu-ios/scripts/export-stations.mjs
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const iosRoot = path.resolve(here, "..");
const webRoot = path.resolve(iosRoot, "..", "mishiranu-app");
const outFile = path.join(iosRoot, "MishiranuEki", "Resources", "stations.json");

const require = createRequire(path.join(webRoot, "package.json"));
const ts = require("typescript");

const sources = {
  "data/mishiranu-stations": "data/mishiranu-stations.ts",
  "lib/mishiranu-area-depth": "lib/mishiranu-area-depth.ts",
  "lib/mishiranu-geo": "lib/mishiranu-geo.ts",
};

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mishiranu-export-"));
try {
  for (const [mod, rel] of Object.entries(sources)) {
    const src = fs.readFileSync(path.join(webRoot, rel), "utf8");
    const js = ts.transpileModule(src, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
      },
    }).outputText.replace(/require\("@\/(data|lib)\/([^"]+)"\)/g, (_m, dir, name) =>
      `require(${JSON.stringify(path.join(tmp, dir, `${name}.js`))})`,
    );
    const dest = path.join(tmp, `${mod}.js`);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, js);
  }

  const data = require(path.join(tmp, "data/mishiranu-stations.js"));
  const depth = require(path.join(tmp, "lib/mishiranu-area-depth.js"));
  const geo = require(path.join(tmp, "lib/mishiranu-geo.js"));

  const round = (n) => Math.round(n * 1e6) / 1e6;

  const stations = data.STATIONS.map((raw) => {
    const station = depth.withAreaDepth(raw);
    const center = geo.stationLatLng(station);
    return {
      id: station.id,
      name: station.name,
      line: station.line,
      prefecture: station.prefecture,
      region: station.region,
      mood: station.mood,
      radiiKm: station.radiiKm,
      stationIntro: station.stationIntro,
      areaAbout: station.areaAbout,
      walkGuide: station.walkGuide,
      historyNotes: station.historyNotes ?? [],
      sightseeingNotes: station.sightseeingNotes ?? [],
      bikeRental: data.bikeRentalFor(station),
      tourTitle: station.tourTitle,
      catchCopy: station.catchCopy,
      emptyCopy: station.emptyCopy,
      lat: round(center.lat),
      lng: round(center.lng),
      spots: station.spots.map((spot) => {
        const ll = geo.spotLatLng(station, spot);
        return {
          id: spot.id,
          name: spot.name,
          genre: spot.genre,
          guide: data.spotGuide(spot),
          mealTier: data.mealTierFor(spot),
          mealTimes: data.mealTimesFor(spot),
          soloOk: data.soloOkFor(spot),
          budgetYen: data.budgetYenFor(spot),
          hours: data.hoursFor(spot),
          blurb: spot.blurb,
          detail: spot.detail,
          walkMinutes: spot.walkMinutes,
          secretWorthy: Boolean(spot.secretWorthy),
          lat: round(ll.lat),
          lng: round(ll.lng),
        };
      }),
    };
  });

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, `${JSON.stringify({ version: 1, stations }, null, 1)}\n`);
  const spotCount = stations.reduce((n, s) => n + s.spots.length, 0);
  console.log(`Wrote ${stations.length} stations / ${spotCount} spots → ${path.relative(process.cwd(), outFile)}`);
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
