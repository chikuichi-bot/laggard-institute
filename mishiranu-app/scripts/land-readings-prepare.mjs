#!/usr/bin/env node
/**
 * 完成土地文 → 音読み（読み辞書）用プロンプト。
 *
 * 取るもの:
 *   1. sightseeingNotes[].title（寄るところ）
 *   2. *_LAND_DEPTH_BY_NAME の日本語キー（駅名）
 *
 * Usage:
 *   npm run land:readings:prepare
 *   npm run land:readings:prepare -- --pack 1
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const LIB = join(ROOT, "lib");
const OUT_DIR = join(ROOT, "docs/land-stock/readings");
const LEXICON_TSV = join(OUT_DIR, "speech-lexicon.tsv");
const EXISTING_TS = join(LIB, "mishiranu-speech-speakable.ts");
const EXISTING_SWIFT = join(
  ROOT,
  "../mishiranu-ios/MishiranuEki/Core/SpeechSpeakable.swift",
);

const PER_PACK = 50;

function parseArgs(argv) {
  let pack;
  let limit = Infinity;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--pack") pack = Number(argv[++i]);
    else if (argv[i] === "--limit") limit = Number(argv[++i]);
  }
  return { pack, limit };
}

function loadExistingLexicon() {
  const known = new Map();
  if (existsSync(LEXICON_TSV)) {
    for (const line of readFileSync(LEXICON_TSV, "utf8").split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const [kanji, kana] = t.split("\t");
      if (kanji && kana) known.set(kanji, kana);
    }
  }
  for (const path of [EXISTING_TS, EXISTING_SWIFT]) {
    if (!existsSync(path)) continue;
    const text = readFileSync(path, "utf8");
    for (const m of text.matchAll(/[\[(]"([^"]+)",\s*"([^"]+)"[\])]/g)) {
      known.set(m[1], m[2]);
    }
  }
  return known;
}

function extractArrayAfter(text, key) {
  const marker = `${key}:`;
  const out = [];
  let from = 0;
  while (true) {
    const idx = text.indexOf(marker, from);
    if (idx < 0) break;
    const bracket = text.indexOf("[", idx + marker.length);
    if (bracket < 0) break;
    let depth = 0;
    let end = -1;
    for (let i = bracket; i < text.length; i++) {
      const ch = text[i];
      if (ch === "[") depth++;
      else if (ch === "]") {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    if (end < 0) break;
    out.push(text.slice(bracket + 1, end));
    from = end + 1;
  }
  return out;
}

function cleanPlaceName(raw) {
  let s = String(raw || "").trim();
  s = s.replace(/^["'`]+|["'`]+$/g, "");
  const full = s;
  s = s.replace(/（[^）]*）/gu, "").replace(/\([^)]*\)/gu, "").trim();
  if (s.length < 2 || s.length > 24) return null;
  if (!/[一-龥]/u.test(s)) return null;
  if (/[、。]/.test(s)) return null;
  if (/\d{3,4}年/.test(full)) return null;
  if (
    /(交わる|開業|延伸|改称|変遷|由来する|担う|控えた|重なる|作る|受け継ぐ|食い違う|迫る|開けた|向かう)/u.test(
      full,
    )
  ) {
    return null;
  }
  return s;
}

function collectNames() {
  const names = new Set();
  const files = readdirSync(LIB).filter(
    (f) => f.endsWith("-land-depth.ts") || f === "mishiranu-area-depth.ts",
  );
  for (const f of files) {
    const text = readFileSync(join(LIB, f), "utf8");
    for (const body of extractArrayAfter(text, "sightseeingNotes")) {
      for (const m of body.matchAll(/title:\s*"([^"]+)"/g)) {
        const n = cleanPlaceName(m[1]);
        if (n) names.add(n);
      }
    }
    for (const m of text.matchAll(/_BY_NAME[^=]*=\s*\{/g)) {
      const start = m.index + m[0].length;
      let depth = 1;
      let end = -1;
      for (let i = start; i < text.length; i++) {
        if (text[i] === "{") depth++;
        else if (text[i] === "}") {
          depth--;
          if (depth === 0) {
            end = i;
            break;
          }
        }
      }
      if (end < 0) continue;
      const block = text.slice(start, end);
      for (const km of block.matchAll(/"([^"]+)"\s*:/g)) {
        const n = cleanPlaceName(km[1]);
        if (n) names.add(n);
      }
    }
  }
  return [...names].sort((a, b) => b.length - a.length || a.localeCompare(b, "ja"));
}

function renderPrompt(packId, names) {
  const list = names.map((n) => `- ${n}`).join("\n");
  return `# 音読みパック Y${packId}

音声ガイド用。画面の漢字は変えず、発話辞書だけ増やす。

## このまま Gemini に貼る

\`\`\`
見知らぬ駅アプリの音声ガイド用に、次の固有名の正しい読み（ひらがな）を書いてください。

【出力形式】（1行1語・タブ区切り）
漢字名\tひらがな

【守ること】
- 駅名・社寺・橋・通り・地名の慣用読み
- 解説文は書かない。TSV行だけ
- 不明な語は出さない

【対象】
${list}
\`\`\`
`;
}

function main() {
  const { pack, limit } = parseArgs(process.argv.slice(2));
  mkdirSync(OUT_DIR, { recursive: true });
  for (const f of readdirSync(OUT_DIR)) {
    if (/^PROMPT-Y\d+\.md$/.test(f)) unlinkSync(join(OUT_DIR, f));
  }
  const known = loadExistingLexicon();
  const all = collectNames();
  const missing = all.filter((n) => !known.has(n)).slice(0, limit);
  console.log(
    `駅名+寄るところ ${all.length} · 既知 ${known.size} · 未収録 ${missing.length}`,
  );
  if (!missing.length) {
    console.log("未収録なし。");
    return;
  }
  const packs = [];
  for (let i = 0; i < missing.length; i += PER_PACK) {
    packs.push(missing.slice(i, i + PER_PACK));
  }
  const indexLines = [
    "# 音読み（完成土地文 → 発話辞書）",
    "",
    `生成: ${new Date().toISOString().slice(0, 10)} · 未収録 ${missing.length}語 · ${packs.length}パック`,
    "",
    "対象: sightseeing 正式名 + 駅名キーのみ。",
    "表示は漢字のまま。xVoice 直前だけ置換。",
    "",
    "## 貼り方",
    "",
    "1. `PROMPT-Y*.md` を Gemini（Argon 高）へ",
    "2. 返ってきた TSV を `docs/land-stock/readings/raw/Y1.tsv` に保存",
    "3. `npm run land:readings:merge`",
    "",
    "| 回 | 語数 | ファイル |",
    "|----|------|----------|",
  ];
  packs.forEach((names, idx) => {
    const id = idx + 1;
    if (pack && pack !== id) return;
    writeFileSync(join(OUT_DIR, `PROMPT-Y${id}.md`), renderPrompt(id, names), "utf8");
    indexLines.push(`| Y${id} | ${names.length} | \`PROMPT-Y${id}.md\` |`);
    console.log(`wrote PROMPT-Y${id}.md (${names.length})`);
  });
  writeFileSync(join(OUT_DIR, "pending-names.txt"), missing.join("\n") + "\n", "utf8");
  writeFileSync(join(OUT_DIR, "README.md"), indexLines.join("\n") + "\n", "utf8");
}

main();
