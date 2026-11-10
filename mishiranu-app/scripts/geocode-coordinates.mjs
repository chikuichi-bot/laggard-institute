#!/usr/bin/env node
/**
 * Resolve WGS84 coordinates for every curated station and spot via OpenStreetMap.
 * Writes data/mishiranu-coordinates.json — the single source of truth for map pins.
 *
 * Stations: Overpass railway=station (not bus stops / bike rentals).
 * Spots: Overpass named features near the station, then Nominatim in a viewbox.
 * Never invent pins from relative x/y.
 *
 *   node mishiranu-app/scripts/geocode-coordinates.mjs
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, "..");
const outFile = path.join(webRoot, "data", "mishiranu-coordinates.json");
const UA = "mishiranu-eki-geocoder/1.0 (laggard-institute; local curation)";

const require = createRequire(path.join(webRoot, "package.json"));
const ts = require("typescript");

/** Hand-verified pins. Never overwritten by auto geocode. */
const MANUAL = {
  stations: {
    demachiyanagi: {
      lat: 35.0305,
      lng: 135.7729,
      source: "manual",
      name: "出町柳駅",
      note: "Keihan/Eizan platforms north of Imadegawa",
    },
  },
  spots: {
    "demachi-1": { lat: 35.0297, lng: 135.7717, source: "manual", name: "鴨川デルタ" },
    "demachi-2": { lat: 35.03029, lng: 135.76886, source: "manual", name: "出町枡形商店街" },
    "demachi-3": { lat: 35.03011, lng: 135.76963, source: "manual", name: "出町ふたば" },
    "demachi-3b": { lat: 35.03015, lng: 135.7697, source: "manual", name: "出町ふたばの豆餅（土産）" },
    "demachi-4": { lat: 35.03027, lng: 135.77268, source: "manual", name: "叡山電鉄のホーム端" },
    "demachi-5": { lat: 35.0302, lng: 135.76903, source: "manual", name: "出町座" },
    "demachi-5b": { lat: 35.0289, lng: 135.7804, source: "manual", name: "進々堂 百万遍店" },
    "demachi-5c": { lat: 35.0303, lng: 135.7692, source: "manual", name: "満寿形屋" },
    "demachi-5d": { lat: 35.0282, lng: 135.7726, source: "manual", name: "手打大山そば 響" },
    "demachi-5e": { lat: 35.0391, lng: 135.7729, source: "manual", name: "下鴨茶寮" },
    "demachi-5f": { lat: 35.02955, lng: 135.7729, source: "manual", name: "COYOTE Roastery" },
    "demachi-beans": { lat: 35.0322, lng: 135.7782, source: "manual", name: "WEEKENDERS COFFEE" },
    "demachi-10": { lat: 35.03005, lng: 135.77155, source: "manual", name: "鴨川デルタの川端" },
    "demachi-6": { lat: 35.03205, lng: 135.77045, source: "manual", name: "下鴨神社へ向かう並木の入口" },
    "demachi-9": { lat: 35.0389, lng: 135.7728, source: "manual", name: "下鴨神社・糺の森" },
    "demachi-7": { lat: 35.029, lng: 135.7687, source: "manual", name: "河原町今出川あたりの角" },
    "demachi-8": { lat: 35.03028, lng: 135.7694, source: "manual", name: "枡形の紙もの・雑貨" },
    "demachi-11": { lat: 35.03025, lng: 135.7705, source: "manual", name: "駅前のレンタサイクル" },
  },
};

/** OSM station name when it differs from our display name. */
const STATION_OSM_NAME = {
  ashio: "通洞",
  katsunuma: "勝沼ぶどう郷",
  tamatsukuri: "玉造温泉",
  "iwashimizu-hachimangu": "石清水八幡宮",
  amarube: "餘部",
};

function loadStations() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mishiranu-geocode-"));
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
    .replace(/(あたり|周辺|付近|入口|入り口|方面|へ向かう|の角|の端|へ)/g, "")
    .replace(/[\s　・･/／「」『』\-ー]/g, "")
    .replace(/駅$/g, "")
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

function maxKmForWalk(walkMinutes, radiiKm) {
  const fromWalk = Math.max(0.4, (walkMinutes / 60) * 4.5 * 1.9);
  const fromRadius = Math.max(...(radiiKm?.length ? radiiKm : [2]), 1.5) * 1.3;
  return Math.max(fromWalk, fromRadius);
}

async function fetchJson(url, init = {}, retries = 5) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, {
        ...init,
        headers: { "User-Agent": UA, Accept: "application/json", ...(init.headers || {}) },
      });
      if (res.status === 429 || res.status >= 500) {
        await sleep(2000 * (i + 1));
        continue;
      }
      if (!res.ok) throw new Error(`${res.status} ${url}`);
      return res.json();
    } catch (err) {
      if (i === retries - 1) throw err;
      await sleep(2000 * (i + 1));
    }
  }
  throw new Error(`failed: ${url}`);
}

async function overpass(query) {
  await sleep(1000);
  return fetchJson("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `data=${encodeURIComponent(query)}`,
  });
}

async function nominatim(query, { viewbox, bounded = false } = {}) {
  const params = new URLSearchParams({
    q: query,
    format: "json",
    limit: "8",
    countrycodes: "jp",
  });
  if (viewbox) {
    params.set("viewbox", viewbox);
    if (bounded) params.set("bounded", "1");
  }
  await sleep(1100);
  return fetchJson(`https://nominatim.openstreetmap.org/search?${params}`);
}

function viewboxAround(center, km) {
  const dLat = km / 111;
  const dLng = km / (111 * Math.cos((center.lat * Math.PI) / 180));
  return `${center.lng - dLng},${center.lat + dLat},${center.lng + dLng},${center.lat - dLat}`;
}

async function fetchRailwayStations(names) {
  // One Overpass call for all curated railway stations in Japan.
  const alt = names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const query = `
[out:json][timeout:90];
(
  node["railway"="station"]["name"~"${alt}"](24,122,46,146);
  node["railway"="halt"]["name"~"${alt}"](24,122,46,146);
);
out;
`;
  const data = await overpass(query);
  return (data.elements || [])
    .map((el) => ({
      lat: el.lat,
      lng: el.lon,
      name: el.tags?.name,
      tags: el.tags || {},
    }))
    .filter((el) => Number.isFinite(el.lat) && Number.isFinite(el.lng) && el.name);
}

function pickRailwayStation(station, railwayNodes) {
  const want = STATION_OSM_NAME[station.id] || station.name;
  const ranked = railwayNodes
    .map((n) => {
      const nameScore = scoreName(want, n.name);
      if (nameScore < 80) return null;
      // Prefer exact name match
      return { ...n, score: nameScore + (normalizeName(n.name) === normalizeName(want) ? 20 : 0) };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);
  // Disambiguate same-name stations by prefecture hint via seed proximity if multiple
  if (ranked.length <= 1) return ranked[0] || null;
  // Prefer nodes whose name equals exactly
  const exact = ranked.filter((n) => normalizeName(n.name) === normalizeName(want));
  const pool = exact.length ? exact : ranked;
  if (pool.length === 1) return pool[0];
  // If we have a previous seed, pick nearest to it
  const seed = station.lat && station.lng ? { lat: station.lat, lng: station.lng } : null;
  if (seed) {
    return pool
      .map((n) => ({ ...n, km: haversineKm(seed, n) }))
      .sort((a, b) => a.km - b.km)[0];
  }
  return pool[0];
}

async function overpassNamedNear(center, km) {
  const dLat = km / 111;
  const dLng = km / (111 * Math.cos((center.lat * Math.PI) / 180));
  const south = center.lat - dLat;
  const north = center.lat + dLat;
  const west = center.lng - dLng;
  const east = center.lng + dLng;
  const query = `
[out:json][timeout:60];
(
  node["name"]["amenity"](${south},${west},${north},${east});
  node["name"]["tourism"](${south},${west},${north},${east});
  node["name"]["shop"](${south},${west},${north},${east});
  node["name"]["leisure"](${south},${west},${north},${east});
  node["name"]["historic"](${south},${west},${north},${east});
  node["name"]["railway"](${south},${west},${north},${east});
  node["name"]["natural"](${south},${west},${north},${east});
  way["name"]["amenity"](${south},${west},${north},${east});
  way["name"]["tourism"](${south},${west},${north},${east});
  way["name"]["shop"](${south},${west},${north},${east});
  way["name"]["leisure"](${south},${west},${north},${east});
  way["name"]["historic"](${south},${west},${north},${east});
  way["name"]["highway"="pedestrian"](${south},${west},${north},${east});
  way["name"]["landuse"](${south},${west},${north},${east});
);
out center tags;
`;
  const data = await overpass(query);
  return (data.elements || [])
    .map((el) => {
      const lat = el.lat ?? el.center?.lat;
      const lng = el.lon ?? el.center?.lon;
      const name = el.tags?.name;
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || !name) return null;
      return { lat, lng, name, tags: el.tags };
    })
    .filter(Boolean);
}

function pickFromNearby(spot, stationCenter, nearby, maxKm) {
  return nearby
    .map((n) => {
      const km = haversineKm(stationCenter, n);
      if (km > maxKm) return null;
      const nameScore = scoreName(spot.name, n.name);
      if (nameScore < 48) return null;
      return { ...n, km, score: nameScore + Math.max(0, 18 - km * 3) };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)[0] || null;
}

async function geocodeSpot(spot, station, stationCenter, nearby) {
  const maxKm = maxKmForWalk(spot.walkMinutes ?? 30, station.radiiKm);
  const local = pickFromNearby(spot, stationCenter, nearby, maxKm);
  if (local && local.score >= 72) {
    return {
      lat: round6(local.lat),
      lng: round6(local.lng),
      source: "overpass",
      name: local.name,
      km: round6(local.km),
    };
  }

  const vb = viewboxAround(stationCenter, maxKm);
  for (const q of [`${spot.name} ${station.prefecture}`, `${spot.name} ${station.name}`, spot.name]) {
    const hits = await nominatim(q, { viewbox: vb, bounded: true });
    const ranked = hits
      .map((h) => {
        const lat = Number(h.lat);
        const lng = Number(h.lon);
        const km = haversineKm(stationCenter, { lat, lng });
        if (km > maxKm) return null;
        // Reject pure bus_stop / bicycle_rental for place names unless that's all we have
        const nameScore = Math.max(
          scoreName(spot.name, h.name || ""),
          scoreName(spot.name, h.display_name || ""),
        );
        if (nameScore < 48) return null;
        const typePenalty = /bus_stop|bicycle_rental/.test(`${h.class}/${h.type}`) ? -8 : 0;
        return {
          lat,
          lng,
          name: h.name || h.display_name,
          km,
          score: nameScore + Math.max(0, 18 - km * 3) + typePenalty,
          query: q,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score);
    if (ranked[0] && ranked[0].score >= 58) {
      return {
        lat: round6(ranked[0].lat),
        lng: round6(ranked[0].lng),
        source: "nominatim",
        name: ranked[0].name,
        query: ranked[0].query,
        km: round6(ranked[0].km),
      };
    }
  }

  if (local && local.score >= 55) {
    return {
      lat: round6(local.lat),
      lng: round6(local.lng),
      source: "overpass-weak",
      name: local.name,
      km: round6(local.km),
    };
  }
  return null;
}

async function main() {
  const stations = loadStations();
  const next = {
    version: 1,
    updatedAt: new Date().toISOString(),
    stations: { ...MANUAL.stations },
    spots: { ...MANUAL.spots },
    unresolved: [],
  };

  const osmNames = stations.map((s) => STATION_OSM_NAME[s.id] || s.name);
  console.log("Fetching railway=station nodes from Overpass…");
  const railwayNodes = await fetchRailwayStations(osmNames);
  console.log(`  ${railwayNodes.length} candidate nodes`);

  for (const station of stations) {
    if (next.stations[station.id]?.source === "manual") {
      console.log(`  = ${station.name} (manual)`);
      continue;
    }
    const hit = pickRailwayStation(station, railwayNodes);
    if (hit) {
      next.stations[station.id] = {
        lat: round6(hit.lat),
        lng: round6(hit.lng),
        source: "overpass-railway",
        name: hit.name,
      };
      console.log(`  ✓ ${station.name} → ${hit.lat},${hit.lng} (${hit.name})`);
    } else {
      // Nominatim railway-only fallback
      const hits = await nominatim(`${STATION_OSM_NAME[station.id] || station.name}駅`);
      const railway = hits
        .filter((h) => h.class === "railway" && (h.type === "station" || h.type === "halt"))
        .map((h) => ({
          lat: Number(h.lat),
          lng: Number(h.lon),
          name: h.name,
          score: scoreName(station.name, h.name || h.display_name || ""),
        }))
        .filter((h) => h.score >= 80)
        .sort((a, b) => b.score - a.score);
      if (railway[0]) {
        next.stations[station.id] = {
          lat: round6(railway[0].lat),
          lng: round6(railway[0].lng),
          source: "nominatim-railway",
          name: railway[0].name,
        };
        console.log(`  ✓ ${station.name} → ${railway[0].lat},${railway[0].lng} (nominatim railway)`);
      } else {
        next.unresolved.push({ type: "station", id: station.id, name: station.name });
        console.log(`  ✗ ${station.name}`);
      }
    }
  }

  for (const station of stations) {
    const center = next.stations[station.id];
    if (!center) continue;
    const radius = Math.max(...(station.radiiKm || [2]), 2.2) * 1.35;
    console.log(`Nearby features for ${station.name} (~${radius.toFixed(1)} km)…`);
    let nearby = [];
    try {
      nearby = await overpassNamedNear(center, radius);
      console.log(`  ${nearby.length} named amenities/tourism/shops…`);
    } catch (err) {
      console.warn(`  overpass nearby failed: ${err.message}`);
    }

    for (const spot of station.spots) {
      if (next.spots[spot.id]?.source === "manual") continue;
      const hit = await geocodeSpot(spot, station, center, nearby);
      if (hit) {
        next.spots[spot.id] = hit;
        console.log(`  ✓ ${spot.name} → ${hit.lat},${hit.lng} (${hit.source}${hit.km != null ? `, ${hit.km}km` : ""})`);
      } else {
        next.unresolved.push({
          type: "spot",
          id: spot.id,
          name: spot.name,
          stationId: station.id,
          stationName: station.name,
          walkMinutes: spot.walkMinutes,
        });
        console.log(`  ✗ ${spot.name}`);
      }
    }
  }

  fs.writeFileSync(outFile, `${JSON.stringify(next, null, 2)}\n`);
  console.log(
    `\nWrote ${Object.keys(next.stations).length} stations / ${Object.keys(next.spots).length} spots, unresolved ${next.unresolved.length}`,
  );
  for (const u of next.unresolved) {
    console.log(`  unresolved: ${u.type} ${u.id} ${u.name}`);
  }
  if (next.unresolved.some((u) => u.type === "station")) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
