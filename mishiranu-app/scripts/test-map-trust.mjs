#!/usr/bin/env node
/**
 * 出町柳ゴールデンテスト — 地図信頼性の再発防止。
 * 失敗したら exit 1（CI / 手元の npm run test:map-trust）。
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const locks = JSON.parse(
  readFileSync(join(root, "data/landmark-locks.json"), "utf8"),
).locks;

const demachi = locks.filter((l) => l.station === "出町柳");
const byId = Object.fromEntries(demachi.map((l) => [l.id, l]));

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exitCode = 1;
  } else {
    console.log("ok:", msg);
  }
}

// --- 必須ロックが揃っている ---
for (const id of [
  "demachi-delta",
  "demachi-kyoto-u",
  "demachi-doshisha",
  "demachi-shimogamo",
  "demachi-futaba",
  "demachi-masugataya",
  "demachi-masugata-arcade",
]) {
  assert(!!byId[id], `lock exists: ${id}`);
}

const arcade = byId["demachi-masugata-arcade"];
assert(
  arcade && arcade.keywords.some((k) => k.includes("枡形")),
  "masugata arcade lock keywords",
);

// --- デルタは合流付近（駅のすぐ北・川） ---
const delta = byId["demachi-delta"];
assert(
  delta &&
    Math.abs(delta.lat - 35.0301227) < 0.0002 &&
    Math.abs(delta.lng - 135.7717415) < 0.0002,
  "delta coords at Kamogawa confluence",
);

// --- 京大は吉田／百万遍側（東）。デルタや駅にいない ---
const kyu = byId["demachi-kyoto-u"];
assert(kyu && kyu.lng > 135.778, "kyoto-u is east of demachi (Yoshida)");
assert(kyu && Math.abs(kyu.lat - 35.0272) < 0.002, "kyoto-u lat near Yoshida");
assert(
  Math.hypot(kyu.lat - delta.lat, kyu.lng - delta.lng) > 0.005,
  "kyoto-u is not on the delta",
);

// --- 同志社は南西（今出川） ---
const dos = byId["demachi-doshisha"];
assert(dos && dos.lng < 135.765, "doshisha is west toward Imadegawa");

// --- 下鴨キーワードは本体だけ（楼門をロックしない） ---
const shrine = byId["demachi-shimogamo"];
assert(
  shrine.keywords.every((k) => !/楼門|参拝記念/.test(k)),
  "shimogamo lock has no satellite keywords",
);

// --- 信頼ルール（簡易）: lock id → 地図可、仮オフセットは不可 ---
function allowsOnMap(spot) {
  if (demachi.some((l) => l.keywords.some((k) => spot.name.includes(k)))) {
    return true;
  }
  if (spot.coordTrust === "lock" || spot.coordTrust === "apple") return true;
  if (
    String(spot.id || "").startsWith("lock-") ||
    String(spot.id || "").startsWith("apple-")
  ) {
    return true;
  }
  return false;
}

assert(
  allowsOnMap({ name: "鴨川デルタ", id: "lock-river-鴨川デルタ", coordTrust: "lock" }),
  "locked delta allowed on map",
);
assert(
  !allowsOnMap({
    name: "謎の大学",
    id: "land-謎の大学",
    coordTrust: "unverified",
    lat: 35.0305,
    lng: 135.772,
  }),
  "unverified fake pin not on map",
);

// --- 社寺畳み込み: 3件 → 核1件 ---
function worshipCore(name) {
  const re =
    /([一-龥々ぁ-んァ-ヶーA-Za-z0-9]{2,14}(?:神社|神宮|大社|寺院|寺))/g;
  let last = null;
  let m;
  while ((m = re.exec(name))) last = m[1];
  if (name.includes("下鴨") && last?.includes("賀茂御祖")) return "下鴨神社";
  return last;
}
function isSatellite(name) {
  return /楼門|参拝記念|手水|授与所/.test(name);
}
function collapse(names) {
  const groups = new Map();
  for (const name of names) {
    const core = worshipCore(name);
    if (!core) continue;
    const list = groups.get(core) ?? [];
    list.push(name);
    groups.set(core, list);
  }
  return [...groups.keys()];
}
const collapsed = collapse([
  "下鴨神社",
  "下鴨神社 楼門",
  "参拝記念 下鴨神社",
]);
assert(collapsed.length === 1 && collapsed[0] === "下鴨神社", "shimogamo collapses to 1");
assert(isSatellite("下鴨神社 楼門"), "romon is satellite");

// --- mustVisit 雛形（出町方式）: 各駅3点 ---
const anchors = JSON.parse(
  readFileSync(join(root, "data/land-present-anchors.json"), "utf8"),
);
const expectedTemplates = {
  出町柳: ["鴨川デルタ", "下鴨神社", "枡形商店街"],
  中書島: ["御香宮神社", "濠川", "寺田屋跡"],
  石清水八幡宮: ["石清水八幡宮", "飛行神社", "石清水八幡宮参道ケーブル"],
  藤森: ["藤森神社", "直違橋通", "墨染寺"],
  大山崎: ["離宮八幡宮", "アサヒビール大山崎山荘美術館", "天王山登山口"],
  宇治: ["平等院", "宇治橋", "通圓"],
};
for (const [station, names] of Object.entries(expectedTemplates)) {
  const row = anchors.stations.find((s) => s.station === station);
  const must = (row?.anchors ?? []).filter((a) => a.mustVisit === true);
  assert(
    must.map((a) => a.name).join(",") === names.join(","),
    `${station} short template`,
  );
  assert(
    must.every((a) => a.lat != null && a.lng != null),
    `${station} mustVisit has coords`,
  );
}
const masugata = anchors.stations
  .find((s) => s.station === "出町柳")
  ?.anchors.find((a) => a.name === "枡形商店街");
assert(
  masugata &&
    Math.abs(masugata.lat - arcade.lat) < 0.0001 &&
    Math.abs(masugata.lng - arcade.lng) < 0.0001,
  "masugata mustVisit coords match arcade lock",
);

if (process.exitCode) {
  console.error("\nmap-trust golden test FAILED");
  process.exit(1);
}
console.log("\nmap-trust golden test PASSED");
