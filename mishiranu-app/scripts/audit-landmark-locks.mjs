#!/usr/bin/env node
/**
 * landmark-locks.json の各ロックが「その名前の実物」の上にあるかを OSM で検査する。
 *
 * 実物 = 同名の道（way）・橋・境内（閉じた面）・店ノード。ロック点からの最短距離を測り、
 * 面なら内側を 0m とする。名前検索の代表点（校舎・運動場・町名）に落ちたロックを見つける。
 *
 *   node scripts/audit-landmark-locks.mjs            # 一覧
 *   node scripts/audit-landmark-locks.mjs --json     # 機械向け
 *
 * 判定: ok ≤ 40m · near ≤ 120m · far > 120m · missing（600m 内に同名なし）
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const LOCKS = join(here, "..", "data", "landmark-locks.json");
const UA = "MishiranuEki/1.0 (+https://lagado.jp/mishiranu-orikata/)";
const RADIUS_M = 600;
const OK_M = 40;
const NEAR_M = 120;

const toRad = (d) => (d * Math.PI) / 180;
function meters(a, b) {
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** 点 p から線分 ab への距離（局所平面近似）。 */
function segmentMeters(p, a, b) {
  const kx = 111320 * Math.cos(toRad(p.lat));
  const ky = 110540;
  const ax = (a.lng - p.lng) * kx, ay = (a.lat - p.lat) * ky;
  const bx = (b.lng - p.lng) * kx, by = (b.lat - p.lat) * ky;
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2));
  return Math.hypot(ax + t * dx, ay + t * dy);
}

function insidePolygon(p, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a.lat > p.lat) !== (b.lat > p.lat) &&
        p.lng < ((b.lng - a.lng) * (p.lat - a.lat)) / (b.lat - a.lat) + a.lng) {
      inside = !inside;
    }
  }
  return inside;
}

function geometryMeters(p, el) {
  if (el.type === "node") return meters(p, { lat: el.lat, lng: el.lon });
  const rings = [...(el.rings ?? [])];
  if (el.type === "way" && el.geometry) rings.push(el.geometry);
  if (el.type === "relation" && el.members) {
    for (const m of el.members) if (m.geometry) rings.push(m.geometry);
  }
  let best = Infinity;
  for (const raw of rings) {
    const ring = raw.map((g) => ({ lat: g.lat, lng: g.lon }));
    const closed = ring.length > 3 &&
      ring[0].lat === ring.at(-1).lat && ring[0].lng === ring.at(-1).lng;
    if (closed && insidePolygon(p, ring)) return 0;
    for (let i = 1; i < ring.length; i++) best = Math.min(best, segmentMeters(p, ring[i - 1], ring[i]));
    if (ring.length === 1) best = Math.min(best, meters(p, ring[0]));
  }
  return best;
}

function namesFor(lock) {
  const raw = [lock.canonical, ...(lock.keywords ?? [])]
    .map((s) => String(s ?? "").trim())
    .filter((s) => s.length >= 2);
  // 「デルタ」「河川敷」のような総称は他の地物にも当たるので、正式名に近い長い名を使う。
  const generic = new Set(["デルタ", "河川敷", "三角州", "参道", "境内", "商店街", "川", "橋"]);
  return [...new Set(raw)].filter((s) => !generic.has(s));
}

const NOMINATIM = "https://nominatim.openstreetmap.org/search";

/** GeoJSON → Overpass 形の geometry（[{lat, lon}]）へ。 */
function ringsFromGeoJson(g) {
  if (!g) return [];
  const toRing = (coords) => coords.map(([lon, lat]) => ({ lat, lon }));
  switch (g.type) {
    case "Point": return [toRing([g.coordinates])];
    case "LineString": return [toRing(g.coordinates)];
    case "MultiLineString":
    case "Polygon": return g.coordinates.map(toRing);
    case "MultiPolygon": return g.coordinates.flat().map(toRing);
    default: return [];
  }
}

/**
 * 名前そのものが一致する地物だけ。住所の通り名が一致しただけの学校・銀行は除く
 * （直違橋通の検索で聖母学院が先頭に出た事故）。
 */
async function nominatimFeatures(p, names) {
  const dLat = RADIUS_M / 110540;
  const dLng = RADIUS_M / (111320 * Math.cos(toRad(p.lat)));
  const viewbox = [p.lng - dLng, p.lat + dLat, p.lng + dLng, p.lat - dLat].join(",");
  const out = [];
  for (const name of names) {
    const url = `${NOMINATIM}?${new URLSearchParams({
      q: name, format: "jsonv2", countrycodes: "jp", viewbox, bounded: "1",
      limit: "40", polygon_geojson: "1", namedetails: "1", dedupe: "0",
    })}`;
    const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "ja" } });
    await new Promise((r) => setTimeout(r, 1100));
    if (!res.ok) continue;
    for (const row of await res.json()) {
      const own = [row.name, row.namedetails?.name, row.namedetails?.["name:ja"]]
        .filter(Boolean).join(" ");
      if (!names.some((n) => own.includes(n))) continue;
      out.push({
        type: "way",
        id: `${row.osm_type}/${row.osm_id}`,
        tags: { name: row.name, [row.category]: row.type },
        geometry: null,
        rings: ringsFromGeoJson(row.geojson),
      });
    }
  }
  return out;
}

async function auditLock(lock) {
  const p = { lat: lock.lat, lng: lock.lng };
  const names = namesFor(lock);
  const elements = await nominatimFeatures(p, names);
  let best = null;
  for (const el of elements) {
    const name = el.tags?.name ?? "";
    const d = geometryMeters(p, el);
    if (!Number.isFinite(d)) continue;
    if (!best || d < best.meters) {
      best = {
        meters: Math.round(d),
        name,
        ref: String(el.id).includes("/") ? String(el.id) : `${el.type}/${el.id}`,
        kind: Object.entries(el.tags ?? {})
          .filter(([k]) => ["highway", "bridge", "amenity", "shop", "leisure", "tourism", "historic", "waterway", "natural", "man_made", "railway", "building"].includes(k))
          .map(([k, v]) => `${k}=${v}`)
          .join(","),
      };
    }
  }
  const verdict = !best ? "missing" : best.meters <= OK_M ? "ok" : best.meters <= NEAR_M ? "near" : "far";
  return { id: lock.id, station: lock.station, canonical: lock.canonical, verdict, best };
}

const asJson = process.argv.includes("--json");
const { locks } = JSON.parse(readFileSync(LOCKS, "utf8"));
const results = [];
for (const lock of locks) {
  try {
    results.push(await auditLock(lock));
  } catch (e) {
    results.push({ id: lock.id, station: lock.station, canonical: lock.canonical, verdict: "error", error: String(e) });
  }
  if (!asJson) process.stderr.write(`${results.length}/${locks.length}\r`);
}

if (asJson) {
  console.log(JSON.stringify(results, null, 2));
} else {
  for (const r of results) {
    const b = r.best;
    console.log(
      `${r.verdict.padEnd(7)} ${r.station}\t${r.canonical}\t` +
        (b ? `${b.meters}m → ${b.name} (${b.ref} ${b.kind})` : r.error ?? "同名の地物なし"),
    );
  }
  const bad = results.filter((r) => r.verdict !== "ok").length;
  console.log(`\n${results.length} 件中 ok 以外 ${bad} 件`);
}
