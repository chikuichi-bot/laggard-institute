#!/usr/bin/env node
/**
 * Second pass for spots that are not exact OSM POIs:
 * 1) Nominatim on landmark tokens extracted from the name
 * 2) Otherwise place by walkMinutes + editorial x/y bearing from the
 *    corrected station center (never the old absolute fake grid).
 *
 *   node mishiranu-app/scripts/fill-unresolved-coordinates.mjs
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, "..");
const coordsFile = path.join(webRoot, "data", "mishiranu-coordinates.json");
const UA = "mishiranu-eki-geocoder/1.0 (laggard-institute; fill pass)";

const require = createRequire(path.join(webRoot, "package.json"));
const ts = require("typescript");

function loadStations() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mishiranu-fill-"));
  const src = fs.readFileSync(path.join(webRoot, "data/mishiranu-stations.ts"), "utf8");
  const js = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  fs.writeFileSync(path.join(tmp, "stations.js"), js);
  return require(path.join(tmp, "stations.js")).STATIONS;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
function round6(n) {
  return Math.round(n * 1e6) / 1e6;
}
function haversineKm(a, b) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}
function normalizeName(s) {
  return String(s)
    .normalize("NFKC")
    .replace(/[（(].*?[）)]/g, "")
    .replace(/[\s　・･/／「」『』]/g, "")
    .toLowerCase();
}
function scoreName(query, candidate) {
  const q = normalizeName(query);
  const c = normalizeName(candidate);
  if (!q || !c) return 0;
  if (q === c) return 100;
  if (c.includes(q) || q.includes(c)) return 82;
  let best = 0;
  for (let i = 0; i < q.length; i++) {
    for (let j = i + 2; j <= q.length; j++) {
      if (c.includes(q.slice(i, j))) best = Math.max(best, j - i);
    }
  }
  return Math.min(70, (best / Math.max(q.length, 1)) * 70);
}

function landmarkTokens(name) {
  const cleaned = name
    .replace(/[（(].*?[）)]/g, " ")
    .replace(/(あたり|周辺|付近|方面|入口|入り口|の角|の端|へ向かう|への|まわり|っぽい影|の記憶)/g, " ")
    .replace(/[・･/／]/g, " ");
  const parts = cleaned
    .split(/[\s　のとやへ]+/)
    .map((p) => p.trim())
    .filter((p) => p.length >= 2)
    .filter((p) => !/^(小さな|古い|短い|駅前|ホーム|待合|線路|川辺|海岸|坂|丘|寺|猫|温泉|葡萄|石|木陰)$/.test(p));
  // Prefer longer tokens first
  const uniq = [...new Set(parts)].sort((a, b) => b.length - a.length);
  return uniq.slice(0, 4);
}

function isStationAdjacent(name) {
  return /ホーム|駅前|駅舎|待合|駅名標|踏切|入場券|車止め|終点/.test(name);
}

async function nominatim(query, viewbox) {
  const params = new URLSearchParams({
    q: query,
    format: "json",
    limit: "6",
    countrycodes: "jp",
    viewbox,
    bounded: "1",
  });
  await sleep(1100);
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: { "User-Agent": UA, Accept: "application/json" },
  });
  if (!res.ok) return [];
  return res.json();
}

function viewboxAround(center, km) {
  const dLat = km / 111;
  const dLng = km / (111 * Math.cos((center.lat * Math.PI) / 180));
  return `${center.lng - dLng},${center.lat + dLat},${center.lng + dLng},${center.lat - dLat}`;
}

function walkBearingPin(stationCenter, spot) {
  const x = typeof spot.x === "number" ? spot.x : 0.5;
  const y = typeof spot.y === "number" ? spot.y : 0.5;
  // Same axes as the old relative map: +x east, +y south on screen → south is down
  const east = x - 0.5;
  const north = 0.52 - y;
  const angle = Math.atan2(east, north); // 0 = north, π/2 = east
  const walk = Math.max(1, spot.walkMinutes || 8);
  // Slightly inside the stated walk time so pins sit in the described pocket
  const distKm = Math.min((walk / 60) * 4.0 * 0.85, 2.8);
  const dLat = (distKm / 111) * Math.cos(angle);
  const dLng = (distKm / (111 * Math.cos((stationCenter.lat * Math.PI) / 180))) * Math.sin(angle);
  return {
    lat: round6(stationCenter.lat + dLat),
    lng: round6(stationCenter.lng + dLng),
    source: isStationAdjacent(spot.name) ? "station-adjacent" : "walk-bearing",
    km: round6(distKm),
    note: "Bearing from editorial x/y; distance from walkMinutes around corrected station",
  };
}

async function main() {
  const coords = JSON.parse(fs.readFileSync(coordsFile, "utf8"));
  const stations = loadStations();
  const byId = Object.fromEntries(stations.map((s) => [s.id, s]));
  const unresolved = [...(coords.unresolved || [])];
  const still = [];

  console.log(`Filling ${unresolved.length} unresolved spots…`);
  for (const item of unresolved) {
    if (item.type !== "spot") {
      still.push(item);
      continue;
    }
    const station = byId[item.stationId];
    const center = coords.stations[item.stationId];
    const spot = station?.spots.find((s) => s.id === item.id);
    if (!station || !center || !spot) {
      still.push(item);
      continue;
    }

    const maxKm = Math.max(...(station.radiiKm || [2]), 2) * 1.4;
    const vb = viewboxAround(center, maxKm);
    let hit = null;

    for (const token of landmarkTokens(spot.name)) {
      const results = await nominatim(`${token} ${station.prefecture}`, vb);
      const ranked = results
        .map((h) => {
          const lat = Number(h.lat);
          const lng = Number(h.lon);
          const km = haversineKm(center, { lat, lng });
          if (km > maxKm) return null;
          const score = Math.max(
            scoreName(token, h.name || ""),
            scoreName(token, h.display_name || ""),
          );
          if (score < 55) return null;
          return { lat, lng, name: h.name || h.display_name, km, score, token };
        })
        .filter(Boolean)
        .sort((a, b) => b.score - a.score);
      if (ranked[0]) {
        hit = {
          lat: round6(ranked[0].lat),
          lng: round6(ranked[0].lng),
          source: "nominatim-token",
          name: ranked[0].name,
          query: ranked[0].token,
          km: round6(ranked[0].km),
        };
        break;
      }
    }

    if (!hit) hit = walkBearingPin(center, spot);
    coords.spots[spot.id] = hit;
    console.log(
      `  ✓ ${station.name} / ${spot.name} → ${hit.lat},${hit.lng} (${hit.source}${hit.km != null ? `, ${hit.km}km` : ""})`,
    );
  }

  // Drop resolved from unresolved list
  coords.unresolved = still.filter((u) => u.type === "station");
  coords.updatedAt = new Date().toISOString();

  // Coverage check
  let missing = 0;
  for (const station of stations) {
    if (!coords.stations[station.id]) {
      missing++;
      console.error(`missing station ${station.id}`);
    }
    for (const spot of station.spots) {
      if (!coords.spots[spot.id]) {
        missing++;
        console.error(`missing spot ${spot.id}`);
      }
    }
  }

  fs.writeFileSync(coordsFile, `${JSON.stringify(coords, null, 2)}\n`);
  console.log(
    `\nStations ${Object.keys(coords.stations).length}, spots ${Object.keys(coords.spots).length}, still unresolved ${coords.unresolved.length}, missing ${missing}`,
  );
  if (missing) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
