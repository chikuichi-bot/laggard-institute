#!/usr/bin/env node
/**
 * Export the curated 見知らぬ駅 station data (TypeScript) into the JSON
 * bundled by the native iOS app. Run after editing mishiranu-app/data.
 *
 * Coordinates come only from data/mishiranu-coordinates.json (no x/y fake pins).
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
const coordsFile = path.join(webRoot, "data", "mishiranu-coordinates.json");

const require = createRequire(path.join(webRoot, "package.json"));
const ts = require("typescript");

function transpileTo(tmp, rel) {
  const src = fs.readFileSync(path.join(webRoot, rel), "utf8");
  return ts.transpileModule(src, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      resolveJsonModule: true,
      esModuleInterop: true,
    },
  }).outputText;
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mishiranu-export-"));
try {
  fs.mkdirSync(path.join(tmp, "data"), { recursive: true });
  fs.mkdirSync(path.join(tmp, "lib"), { recursive: true });
  fs.copyFileSync(coordsFile, path.join(tmp, "data/mishiranu-coordinates.json"));

  for (const [mod, rel] of Object.entries({
    "data/mishiranu-stations": "data/mishiranu-stations.ts",
    "data/mishiranu-station-readings": "data/mishiranu-station-readings.ts",
    "lib/mishiranu-area-depth": "lib/mishiranu-area-depth.ts",
  })) {
    const js = transpileTo(tmp, rel).replace(
      /require\("@\/(data|lib)\/([^"]+)"\)/g,
      (_m, dir, name) => `require(${JSON.stringify(path.join(tmp, dir, `${name}.js`))})`,
    );
    fs.writeFileSync(path.join(tmp, `${mod}.js`), js);
  }

  // Geo: load coordinates JSON directly (avoid TS .default interop issues under plain Node).
  const coordinates = JSON.parse(fs.readFileSync(coordsFile, "utf8"));
  const data = require(path.join(tmp, "data/mishiranu-stations.js"));
  const readings = require(path.join(tmp, "data/mishiranu-station-readings.js"));
  const depth = require(path.join(tmp, "lib/mishiranu-area-depth.js"));

  function stationLL(station) {
    const hit = coordinates.stations[station.id];
    if (hit) return { lat: hit.lat, lng: hit.lng };
    if (typeof station.lat === "number" && typeof station.lng === "number") {
      return { lat: station.lat, lng: station.lng };
    }
    throw new Error(`Missing station coordinates: ${station.id}. Run npm run geo:geocode`);
  }

  function spotLL(station, spot) {
    const hit = coordinates.spots[spot.id];
    if (hit) return { lat: hit.lat, lng: hit.lng };
    if (typeof spot.lat === "number" && typeof spot.lng === "number") {
      return { lat: spot.lat, lng: spot.lng };
    }
    throw new Error(
      `Missing spot coordinates: ${spot.id} (${spot.name} @ ${station.name}). Run npm run geo:geocode && node scripts/fill-unresolved-coordinates.mjs`,
    );
  }

  const round = (n) => Math.round(n * 1e6) / 1e6;

  const stations = data.STATIONS.map((raw) => {
    const station = depth.withAreaDepth(raw);
    const center = stationLL(station);
    return {
      id: station.id,
      name: station.name,
      nameReading: readings.stationNameReading(station) ?? null,
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
        const ll = spotLL(station, spot);
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

  // Coverage guard: every spot must have a real coordinate entry.
  const missing = [];
  for (const st of data.STATIONS) {
    if (!coordinates.stations[st.id]) missing.push(`station:${st.id}`);
    for (const sp of st.spots) {
      if (!coordinates.spots[sp.id]) missing.push(`spot:${sp.id}`);
    }
  }
  if (missing.length) {
    throw new Error(`Coordinates incomplete (${missing.length}): ${missing.slice(0, 8).join(", ")}`);
  }

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, `${JSON.stringify({ version: 1, stations }, null, 1)}\n`);
  const spotCount = stations.reduce((n, s) => n + s.spots.length, 0);
  console.log(`Wrote ${stations.length} stations / ${spotCount} spots → ${path.relative(process.cwd(), outFile)}`);
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
