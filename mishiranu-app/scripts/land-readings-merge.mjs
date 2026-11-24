#!/usr/bin/env node
/**
 * Gemini が返した「漢字\tひらがな」を speech lexicon に合流し、
 * Web TS / iOS Swift の辞書を同期する。
 *
 * Usage:
 *   node scripts/land-readings-merge.mjs path/to/raw.tsv
 *   node scripts/land-readings-merge.mjs --stdin   # 標準入力
 *   # または docs/land-stock/readings/raw/*.tsv を全部取り込む
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const OUT_DIR = join(ROOT, "docs/land-stock/readings");
const RAW_DIR = join(OUT_DIR, "raw");
const LEXICON_TSV = join(OUT_DIR, "speech-lexicon.tsv");
const TS_PATH = join(ROOT, "lib/mishiranu-speech-speakable.ts");
const SWIFT_PATH = join(
  ROOT,
  "../mishiranu-ios/MishiranuEki/Core/SpeechSpeakable.swift",
);

function parseTsv(text) {
  const pairs = [];
  for (const line of text.split("\n")) {
    let t = line.trim();
    if (!t || t.startsWith("#") || t.startsWith("```")) continue;
    t = t.replace(/^\s*[-*]\s*/, "");
    // allow 「漢字: ひらがな」 too
    let kanji;
    let kana;
    if (t.includes("\t")) {
      [kanji, kana] = t.split("\t");
    } else if (t.includes(":")) {
      const i = t.indexOf(":");
      kanji = t.slice(0, i);
      kana = t.slice(i + 1);
    } else if (t.includes("：")) {
      const i = t.indexOf("：");
      kanji = t.slice(0, i);
      kana = t.slice(i + 1);
    } else {
      continue;
    }
    kanji = (kanji || "").trim();
    kana = (kana || "").trim().replace(/\s+/g, "");
    if (!kanji || !kana) continue;
    if (!/^[\u3040-\u309Fー]+$/u.test(kana)) continue;
    if (kanji.length < 2) continue;
    pairs.push([kanji, kana]);
  }
  return pairs;
}

function loadTsvMap(path) {
  const map = new Map();
  if (!existsSync(path)) return map;
  for (const [k, v] of parseTsv(readFileSync(path, "utf8"))) map.set(k, v);
  return map;
}

function writeTsv(path, map) {
  const lines = ["# mishiranu speech lexicon · 漢字\tひらがな", ""];
  const keys = [...map.keys()].sort(
    (a, b) => b.length - a.length || a.localeCompare(b, "ja"),
  );
  for (const k of keys) lines.push(`${k}\t${map.get(k)}`);
  writeFileSync(path, lines.join("\n") + "\n", "utf8");
}

function syncTypeScript(map) {
  let text = readFileSync(TS_PATH, "utf8");
  const entries = [...map.entries()]
    .sort((a, b) => b[0].length - a[0].length || a[0].localeCompare(b[0], "ja"))
    .map(([k, v]) => `  ["${k}", "${v}"],`)
    .join("\n");
  const next = text.replace(
    /const LEXICON_RAW: Array<\[string, string\]> = \[[\s\S]*?\];/,
    `const LEXICON_RAW: Array<[string, string]> = [\n${entries}\n];`,
  );
  if (next === text) {
    console.warn("TS LEXICON_RAW 変化なし（スキップ）");
  } else {
    writeFileSync(TS_PATH, next, "utf8");
  }
}

function syncSwift(map) {
  if (!existsSync(SWIFT_PATH)) {
    console.warn("Swift SpeechSpeakable なし — スキップ");
    return;
  }
  let text = readFileSync(SWIFT_PATH, "utf8");
  const entries = [...map.entries()]
    .sort((a, b) => b[0].length - a[0].length || a[0].localeCompare(b[0], "ja"))
    .map(([k, v]) => `            ("${k}", "${v}"),`)
    .join("\n");
  // normalizePunctuation 内の pairs ではなく、lexicon クロージャ内だけを置換する
  const next = text.replace(
    /private static let lexicon: \[\(String, String\)\] = \{\n\s*let pairs: \[\(String, String\)\] = \[[\s\S]*?\]\n\s*return pairs\.sorted/,
    `private static let lexicon: [(String, String)] = {\n        let pairs: [(String, String)] = [\n${entries}\n        ]\n        return pairs.sorted`,
  );
  if (next === text) {
    console.warn("Swift lexicon 変化なし（スキップ）");
  } else {
    writeFileSync(SWIFT_PATH, next, "utf8");
  }
}

async function readStdin() {
  const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
  const chunks = [];
  for await (const line of rl) chunks.push(line);
  return chunks.join("\n");
}

async function main() {
  mkdirSync(RAW_DIR, { recursive: true });
  const args = process.argv.slice(2);
  const map = loadTsvMap(LEXICON_TSV);
  // 既存コードの辞書を必ず土台にする（TSV が薄い／壊れていても消さない）
  if (existsSync(TS_PATH)) {
    const text = readFileSync(TS_PATH, "utf8");
    for (const m of text.matchAll(/\["([^"]+)",\s*"([^"]+)"\]/g)) {
      if (!map.has(m[1])) map.set(m[1], m[2]);
    }
  }
  if (existsSync(SWIFT_PATH)) {
    const text = readFileSync(SWIFT_PATH, "utf8");
    for (const m of text.matchAll(/\("([^"]+)",\s*"([^"]+)"\)/g)) {
      if (!map.has(m[1])) map.set(m[1], m[2]);
    }
  }

  let incoming = [];
  if (args.includes("--stdin")) {
    incoming = parseTsv(await readStdin());
  } else if (args[0] && !args[0].startsWith("-")) {
    incoming = parseTsv(readFileSync(resolve(args[0]), "utf8"));
  } else {
    const files = existsSync(RAW_DIR)
      ? readdirSync(RAW_DIR).filter((f) => f.endsWith(".tsv") || f.endsWith(".txt"))
      : [];
    for (const f of files) {
      incoming.push(...parseTsv(readFileSync(join(RAW_DIR, f), "utf8")));
    }
  }

  if (!incoming.length) {
    console.error(
      "取り込む行がありません。raw/*.tsv を置くか、ファイルパス / --stdin を指定してください。",
    );
    process.exit(1);
  }

  let added = 0;
  for (const [k, v] of incoming) {
    if (map.get(k) === v) continue;
    map.set(k, v);
    added++;
  }

  writeTsv(LEXICON_TSV, map);
  syncTypeScript(map);
  syncSwift(map);
  console.log(`合流 ${incoming.length}行 · 更新 ${added} · 辞書合計 ${map.size}`);
  console.log(`TSV ${LEXICON_TSV}`);
  console.log("Web/iOS lexicon を同期しました");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
