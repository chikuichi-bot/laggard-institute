#!/usr/bin/env node
/**
 * 土地文 · Gemini Web 半自動（課金はアプリの Hydrogen のみ · API は使わない）
 *
 * Usage:
 *   npm run land:gemini:list
 *   npm run land:gemini:next
 *   npm run land:gemini -- --pack L
 *   npm run land:gemini -- --pack M1 --no-open
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const LAND = join(ROOT, "docs/land-stock");
const MASS = join(LAND, "PROMPT-batch-mass.md");
const GEMINI_URL = "https://gemini.google.com/app";
const STATE_DIR = join(LAND, ".gemini-web");
const LAST_PACK = join(STATE_DIR, "last-pack.txt");

function parseArgs(argv) {
  let list = false;
  let next = false;
  let noOpen = false;
  let noPaste = false;
  let pack;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--list") list = true;
    else if (a === "--next") next = true;
    else if (a === "--no-open") noOpen = true;
    else if (a === "--no-paste") noPaste = true;
    else if (a === "--pack") pack = argv[++i];
    else if (a === "--help" || a === "-h") {
      console.log(`land-prose-gemini-web

  --list          未取込パック一覧
  --next          次の未取込をコピー＋Gemini起動＋Cmd+V
  --pack <ID>     指定パック（例: L / M1 / J5）
  --no-open       ブラウザは開かない（コピーだけ）
  --no-paste      開くだけ（Cmd+V しない）
`);
      process.exit(0);
    }
  }
  return { list, next, noOpen, noPaste, pack };
}

function resolvePromptPath(fileRel) {
  const cleaned = fileRel.replace(/^`|`$/g, "").trim();
  const candidates = [
    join(LAND, cleaned),
    join(LAND, "prompts", cleaned.replace(/^prompts\//, "")),
    join(LAND, cleaned.replace(/^prompts\//, "")),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  throw new Error(`プロンプトファイルなし: ${fileRel}`);
}

function loadPacks() {
  const text = readFileSync(MASS, "utf8");
  const packs = [];
  for (const line of text.split("\n")) {
    const m = line.match(
      /^\|\s*([A-Z0-9]+)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*`([^`]+)`\s*\|\s*`([^`]+)`\s*\|/,
    );
    if (!m) continue;
    const id = m[1];
    const title = m[2].trim();
    const count = m[3].trim();
    const fileRel = m[4].trim();
    const mdTarget = m[5].trim();
    const done = /取込済/.test(count);
    let fileAbs;
    try {
      fileAbs = resolvePromptPath(fileRel);
    } catch {
      continue;
    }
    packs.push({ id, title, count, fileRel, mdTarget, done, fileAbs });
  }
  return packs;
}

function extractPasteBlock(promptPath) {
  const text = readFileSync(promptPath, "utf8");
  const m = text.match(/```\n([\s\S]*?)\n```/);
  if (!m) throw new Error(`コードブロックが見つかりません: ${promptPath}`);
  return m[1].trim() + "\n";
}

function copyToClipboard(text) {
  execFileSync("pbcopy", { input: text, encoding: "utf8" });
}

function openGemini() {
  execFileSync("open", [GEMINI_URL]);
}

/** 開いたあと入力欄へ Cmd+V（送信はしない · モデル確認のため） */
function pasteIntoGemini(delaySec = 2.5) {
  const script = `
set waitSec to ${Number(delaySec)}
delay waitSec
set browserName to ""
tell application "System Events"
  set procs to name of every process whose background only is false
end tell
if procs contains "Safari" then
  set browserName to "Safari"
else if procs contains "Google Chrome" then
  set browserName to "Google Chrome"
else if procs contains "Arc" then
  set browserName to "Arc"
else if procs contains "Microsoft Edge" then
  set browserName to "Microsoft Edge"
end if
if browserName is "" then
  return "no-browser"
end if
tell application browserName to activate
delay 0.5
tell application "System Events"
  tell process browserName
    set frontmost to true
    delay 0.3
    keystroke "v" using command down
  end tell
end tell
return "pasted:" & browserName
`;
  try {
    const out = execFileSync("osascript", ["-e", script], {
      encoding: "utf8",
      timeout: 20_000,
    }).trim();
    return out;
  } catch (err) {
    return `paste-failed:${err?.message ?? err}`;
  }
}

function printHowTo(p) {
  console.log("");
  console.log("—— Gemini Web 半自動 ——");
  console.log(`パック: ${p.id} · ${p.title}（${p.count}）`);
  console.log(`プロンプト: ${p.fileRel}`);
  console.log(`取込先: ${p.mdTarget}`);
  console.log("");
  console.log("1. クリップボードへコピー");
  console.log("2. Gemini を開く → 少し待って Cmd+V を自動送信");
  console.log("3. 【新規チャット】・モデルは Hydrogen 高");
  console.log("4. 入力欄に入っていれば送信（入っていなければ欄をクリックして Cmd+V）");
  console.log(
    `5. 全部返ってきたら Cursor に貼る（先頭に「${p.id}です」と書くと分かりやすい）`,
  );
  console.log("6. こちらで配線のみ（spots しない · 運用B）");
  console.log("");
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const packs = loadPacks();
  if (!packs.length) {
    console.error("PROMPT-batch-mass.md からパックを読めませんでした");
    process.exit(1);
  }

  if (opts.list) {
    const pending = packs.filter((p) => !p.done);
    const done = packs.filter((p) => p.done);
    console.log(
      `未取込 ${pending.length} / 全 ${packs.length}（取込済 ${done.length}）`,
    );
    console.log("");
    for (const p of pending) {
      console.log(`  ${p.id.padEnd(4)} ${p.title} · ${p.count}`);
    }
    if (pending[0]) {
      console.log("");
      console.log(`次: npm run land:gemini -- --pack ${pending[0].id}`);
    }
    return;
  }

  let target;
  if (opts.pack) {
    const id = opts.pack.toUpperCase();
    target = packs.find((p) => p.id.toUpperCase() === id);
    if (!target) {
      console.error(`不明なパック: ${opts.pack}`);
      process.exit(1);
    }
  } else {
    target = packs.find((p) => !p.done);
    if (!target) {
      console.log("未取込パックはありません（全部取込済）");
      return;
    }
  }

  const body = extractPasteBlock(target.fileAbs);
  copyToClipboard(body);
  mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(LAST_PACK, `${target.id}\n${target.fileAbs}\n`, "utf8");

  printHowTo(target);
  console.log(`コピー済 · ${body.length.toLocaleString()} 文字`);

  if (!opts.noOpen) {
    openGemini();
    console.log(`起動: ${GEMINI_URL}`);
    if (!opts.noPaste) {
      console.log("貼付待ち…（約2.5秒）");
      const pasteResult = pasteIntoGemini(2.5);
      console.log(`貼付: ${pasteResult}`);
      if (String(pasteResult).startsWith("paste-failed")) {
        console.log(
          "※ アクセシビリティ許可が無いと Cmd+V できません。システム設定 → プライバシーとセキュリティ → アクセシビリティ で Terminal/Cursor を許可してください。",
        );
      }
    }
  } else {
    console.log("（--no-open · ブラウザは開いていません）");
  }
}

main();
