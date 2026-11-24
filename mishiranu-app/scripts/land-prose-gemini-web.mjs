#!/usr/bin/env node
/**
 * 土地文 · Gemini Web 半自動（API は使わない · Web UI で Neon 高を選ぶ）
 *
 * Usage:
 *   npm run land:gemini:list
 *   npm run land:gemini:next
 *   npm run land:gemini:until-limit
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
const RAW_DIR = join(STATE_DIR, "raw");

/** 土地文は品質優先 · Neon + 思考レベル高 */
const TARGET_MODEL = "Neon";
const TARGET_THINKING = "高";
/** Neon 高 · 1パックあたりの待ち上限（秒） */
const RESPONSE_TIMEOUT_SEC = 25 * 60;
/** いま操作中の Gemini タブ URL（他チャットに JS が刺さらないように固定） */
let pinnedGeminiTabUrl = "";

function parseArgs(argv) {
  let list = false;
  let next = false;
  let untilLimit = false;
  let noOpen = false;
  let noPaste = false;
  let noModel = false;
  let pack;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--list") list = true;
    else if (a === "--next") next = true;
    else if (a === "--until-limit") untilLimit = true;
    else if (a === "--no-open") noOpen = true;
    else if (a === "--no-paste") noPaste = true;
    else if (a === "--no-model") noModel = true;
    else if (a === "--pack") pack = argv[++i];
    else if (a === "--help" || a === "-h") {
      console.log(`land-prose-gemini-web

  --list          未取込パック一覧
  --next          次の未取込をコピー＋Gemini起動＋Neon高選択＋Cmd+V
  --until-limit   未取込を連続実行（新規チャット→Neon高→貼付→送信→保存）· 制限で停止
  --pack <ID>     指定パック（例: L / M1 / J5）
  --no-open       ブラウザは開かない（コピーだけ）
  --no-paste      開くだけ（Cmd+V しない）
  --no-model      モデル自動選択をしない
`);
      process.exit(0);
    }
  }
  return { list, next, untilLimit, noOpen, noPaste, noModel, pack };
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

/** Chrome 優先（Safari はサンドボックスで JS Apple Events が毎回手動になりやすい） */
function openGemini() {
  try {
    execFileSync("open", ["-a", "Google Chrome", GEMINI_URL]);
  } catch {
    execFileSync("open", [GEMINI_URL]);
  }
}

function detectBrowserAppleScript() {
  return `
set browserName to ""
tell application "System Events"
  set procs to name of every process whose background only is false
end tell
-- 自動化は Chrome 優先（AllowJavascriptAppleEvents 済みのことが多い）
if procs contains "Google Chrome" then
  set browserName to "Google Chrome"
else if procs contains "Microsoft Edge" then
  set browserName to "Microsoft Edge"
else if procs contains "Arc" then
  set browserName to "Arc"
else if procs contains "Safari" then
  set browserName to "Safari"
end if
return browserName
`;
}

/** 同期 JS（Safari do JavaScript は Promise を待たない） */
function modelStepJs(step) {
  const steps = {
    check: `(() => {
  const textOf = (el) => (el.innerText || el.textContent || "").replace(/\\s+/g, " ").trim();
  const visible = (el) => { if (!el) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const chip = [...document.querySelectorAll("button")].find((b) => {
    const t = textOf(b);
    return /(Neon|Argon|Hydrogen|Flash|Pro|Carbon)/.test(t) && visible(b) && b.getBoundingClientRect().bottom > innerHeight * 0.35 && t.length < 40;
  });
  if (!chip) return "no-model-chip";
  const t = textOf(chip);
  if (/Neon/.test(t) && /高/.test(t)) return "already-neon-high";
  if (/Argon/.test(t) && /高/.test(t)) return "already-argon-high";
  return "need-select:" + t.slice(0, 40);
})()`,
    openChip: `(() => {
  const textOf = (el) => (el.innerText || el.textContent || "").replace(/\\s+/g, " ").trim();
  const visible = (el) => { if (!el) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const byTest = document.querySelector('[data-test-id="bard-mode-menu-button"]');
  if (byTest && visible(byTest)) { byTest.click(); return "opened-chip"; }
  const chip = [...document.querySelectorAll("button")].find((b) => {
    const t = textOf(b);
    return /(Neon|Argon|Hydrogen|Flash|Pro|Carbon)/.test(t) && visible(b) && b.getBoundingClientRect().bottom > innerHeight * 0.35 && t.length < 40;
  });
  if (!chip) return "no-model-chip";
  chip.click();
  return "opened-chip";
})()`,
    pickArgon: `(() => {
  const textOf = (el) => (el.innerText || el.textContent || "").replace(/\\s+/g, " ").trim();
  const visible = (el) => { if (!el) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const nodes = [...document.querySelectorAll("button,[role=menuitem],[role=option],span,div")];
  const neon = nodes.find((n) => {
    const t = textOf(n);
    return visible(n) && t.length < 60 && (t.includes("Neon") || t.includes("4 Neon"));
  });
  if (neon) {
    const t = neon.closest('[role="menuitem"],[role="option"],button') || neon;
    t.click();
    return "picked-neon";
  }
  const argon = nodes.find((n) => {
    const t = textOf(n);
    return visible(n) && t.length < 60 && (t.includes("4 Argon") || t.includes("コードと分析"));
  });
  if (!argon) return "no-neon-or-argon-option";
  const t = argon.closest('[role="menuitem"],[role="option"],button') || argon;
  t.click();
  return "picked-argon-fallback";
})()`,
    openThinking: `(() => {
  const textOf = (el) => (el.innerText || el.textContent || "").replace(/\\s+/g, " ").trim();
  const visible = (el) => { if (!el) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const menus = [...document.querySelectorAll('[role="menuitem"]')].filter(visible);
  let think = menus.find((n) => textOf(n) === "思考レベル" || textOf(n) === "Thinking level" || textOf(n) === "Thinking Level");
  if (!think) {
    think = [...document.querySelectorAll("button,[role=menuitem],[role=option],span,div")].find((n) => {
      const t = textOf(n);
      return visible(n) && t.length < 20 && (t === "思考レベル" || /^Thinking/.test(t));
    });
  }
  if (!think) return "no-thinking-menu";
  (think.closest('[role="menuitem"],[role="option"],button') || think).click();
  return "opened-thinking";
})()`,
    pickHigh: `(() => {
  const textOf = (el) => (el.innerText || el.textContent || "").replace(/\\s+/g, " ").trim();
  const visible = (el) => { if (!el) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  // Gemini UI: role=menuitemradio の「高 徹底的に詳しく」
  const radios = [...document.querySelectorAll('[role="menuitemradio"], gem-menu-item')].filter(visible);
  let high =
    radios.find((n) => textOf(n).includes("徹底的に詳しく")) ||
    radios.find((n) => /^高\\b/.test(textOf(n)) || textOf(n).startsWith("高 "));
  if (!high) {
    const items = [...document.querySelectorAll('[role="menuitem"],[role="option"],button')].filter(visible);
    high =
      items.find((n) => /徹底的に詳しく/.test(textOf(n))) ||
      items.find((n) => {
        const t = textOf(n);
        return t.length < 40 && (/^高\\b/.test(t) || t === "高" || /\\bHigh\\b/.test(t));
      });
  }
  if (!high) return "no-high-option";
  high.click();
  return "picked-high";
})()`,
    chipText: `(() => {
  const textOf = (el) => (el.innerText || el.textContent || "").replace(/\\s+/g, " ").trim();
  const visible = (el) => { if (!el) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const chip = [...document.querySelectorAll("button")].find((b) => {
    const t = textOf(b);
    return /(Neon|Argon|Hydrogen|Flash|Pro|Carbon)/.test(t) && visible(b) && b.getBoundingClientRect().bottom > innerHeight * 0.35 && t.length < 40;
  });
  return chip ? textOf(chip) : "";
})()`,
  };
  return steps[step];
}

function pinActiveGeminiTabUrl(browserName = "Google Chrome") {
  const app =
    browserName === "Safari"
      ? "Safari"
      : browserName === "Arc"
        ? "Arc"
        : browserName === "Microsoft Edge"
          ? "Microsoft Edge"
          : "Google Chrome";
  try {
    if (app === "Safari") {
      pinnedGeminiTabUrl = execFileSync(
        "osascript",
        [
          "-e",
          `tell application "Safari"
  if (count of windows) is 0 then return ""
  return URL of current tab of front window as text
end tell`,
        ],
        { encoding: "utf8", timeout: 8_000, stdio: ["ignore", "pipe", "pipe"] },
      ).trim();
    } else {
      pinnedGeminiTabUrl = execFileSync(
        "osascript",
        [
          "-e",
          `tell application "${app}"
  if (count of windows) is 0 then return ""
  return URL of active tab of front window as text
end tell`,
        ],
        { encoding: "utf8", timeout: 8_000, stdio: ["ignore", "pipe", "pipe"] },
      ).trim();
    }
  } catch {
    pinnedGeminiTabUrl = "";
  }
  return pinnedGeminiTabUrl;
}

function runBrowserJs(browserName, js) {
  const escaped = js.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const pin = pinnedGeminiTabUrl;
  let script;
  if (browserName === "Safari") {
    script = `
tell application "Safari"
  activate
  if (count of windows) is 0 then return "no-window"
  set found to false
  set pinUrl to ${JSON.stringify(pin)}
  repeat with w in windows
    repeat with t in tabs of w
      try
        set u to URL of t as text
        if pinUrl is not "" and u is pinUrl then
          set current tab of w to t
          set index of w to 1
          set found to true
          exit repeat
        end if
      end try
    end repeat
    if found then exit repeat
  end repeat
  if found is false then
    repeat with w in windows
      repeat with t in tabs of w
        try
          if (URL of t as text) contains "gemini.google.com/app" then
            set current tab of w to t
            set index of w to 1
            set found to true
            exit repeat
          end if
        end try
      end repeat
      if found then exit repeat
    end repeat
  end if
  if found is false then
    set r to do JavaScript "${escaped}" in front document
    return r as text
  end if
  set r to do JavaScript "${escaped}" in current tab of front window
  return r as text
end tell
`;
  } else if (
    browserName === "Google Chrome" ||
    browserName === "Microsoft Edge" ||
    browserName === "Arc"
  ) {
    const app =
      browserName === "Arc"
        ? "Arc"
        : browserName === "Microsoft Edge"
          ? "Microsoft Edge"
          : "Google Chrome";
    script = `
tell application "${app}"
  activate
  if (count of windows) is 0 then return "no-window"
  set found to false
  set pinUrl to ${JSON.stringify(pin)}
  repeat with w in windows
    set i to 0
    repeat with t in tabs of w
      set i to i + 1
      try
        set u to URL of t as text
        if pinUrl is not "" and u is pinUrl then
          set active tab index of w to i
          set index of w to 1
          set found to true
          exit repeat
        end if
      end try
    end repeat
    if found then exit repeat
  end repeat
  if found is false then
    repeat with w in windows
      set i to 0
      repeat with t in tabs of w
        set i to i + 1
        try
          set u to URL of t as text
          if u contains "gemini.google.com/app" then
            set active tab index of w to i
            set index of w to 1
            set found to true
            exit repeat
          end if
        end try
      end repeat
      if found then exit repeat
    end repeat
  end if
  if found is false then return "no-gemini-tab"
  set r to execute active tab of front window javascript "${escaped}"
  return r as text
end tell
`;
  } else {
    return `unsupported-browser:${browserName}`;
  }
  try {
    return execFileSync("osascript", ["-e", script], {
      encoding: "utf8",
      timeout: 25_000,
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (err) {
    const msg = String(err?.stderr || err?.message || err);
    if (
      /JavaScript from Apple Events|Allow JavaScript|許可|not allowed|do JavaScript/i.test(
        msg,
      )
    ) {
      return "js-permission-needed";
    }
    return `js-failed:${msg.slice(0, 180)}`;
  }
}

function sleepSync(ms) {
  const sec = Math.max(0.1, ms / 1000);
  try {
    execFileSync("osascript", ["-e", `delay ${sec}`], { timeout: ms + 5000 });
  } catch {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
  }
}

function runSelectOnBrowser(browserName) {
  const check = runBrowserJs(browserName, modelStepJs("check"));
  if (check === "js-permission-needed") return `${browserName}:${check}`;
  if (check.startsWith("already-argon-high")) return `${browserName}:${check}`;
  if (check === "no-model-chip" || check.startsWith("js-failed")) {
    return `${browserName}:${check}`;
  }

  const results = [check];
  const chipBefore = runBrowserJs(browserName, modelStepJs("chipText"));
  results.push(`chip=${chipBefore}`);

  sleepSync(500);
  let r = runBrowserJs(browserName, modelStepJs("openChip"));
  results.push(`openChip=${r}`);
  if (r === "js-permission-needed" || r.startsWith("js-failed") || r === "no-model-chip") {
    return `${browserName}:${results.join("|")}`;
  }

  // まだ Argon でなければモデルを選ぶ（選ぶとメニューが閉じることがある）
  const needArgon = !/Neon/.test(chipBefore);
  if (needArgon) {
    sleepSync(700);
    r = runBrowserJs(browserName, modelStepJs("pickArgon"));
    results.push(`pickArgon=${r}`);
    sleepSync(700);
    r = runBrowserJs(browserName, modelStepJs("openChip"));
    results.push(`reopenChip=${r}`);
  }

  sleepSync(700);
  r = runBrowserJs(browserName, modelStepJs("openThinking"));
  results.push(`openThinking=${r}`);
  if (r === "opened-thinking") {
    sleepSync(700);
    r = runBrowserJs(browserName, modelStepJs("pickHigh"));
    results.push(`pickHigh=${r}`);
  }

  sleepSync(400);
  // メニューを閉じる
  runBrowserJs(
    browserName,
    `(() => { document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); return "esc"; })()`,
  );
  sleepSync(300);
  const finalCheck = runBrowserJs(browserName, modelStepJs("check"));
  results.push(`final=${finalCheck}`);
  return `${browserName}:${results.join("|")}`;
}

function selectArgonHigh(delaySec = 3.2) {
  const waitScript = `
delay ${Number(delaySec)}
${detectBrowserAppleScript()}
`;
  let browserName = "";
  try {
    browserName = execFileSync("osascript", ["-e", waitScript], {
      encoding: "utf8",
      timeout: 15_000,
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (err) {
    return `detect-failed:${err?.message ?? err}`;
  }
  if (!browserName) return "no-browser";

  let result = runSelectOnBrowser(browserName);
  // Safari 拒否時は Chrome へフォールバック（この Mac では Chrome 側が許可済み）
  if (
    result.includes("js-permission-needed") &&
    browserName === "Safari"
  ) {
    try {
      execFileSync("open", ["-a", "Google Chrome", GEMINI_URL]);
      sleepSync(2800);
      result = `safari-fallback→${runSelectOnBrowser("Google Chrome")}`;
    } catch (err) {
      result = `${result}|chrome-fallback-failed:${err?.message ?? err}`;
    }
  }
  return result;
}

function currentBrowserName() {
  try {
    return execFileSync("osascript", ["-e", detectBrowserAppleScript()], {
      encoding: "utf8",
      timeout: 8_000,
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch {
    return "";
  }
}

function geminiPageJs(js) {
  const browser = currentBrowserName() || "Google Chrome";
  return runBrowserJs(browser, js);
}

function newGeminiChat() {
  const browser = "Google Chrome";
  // 専用ウィンドウで Gemini のみ開く
  try {
    execFileSync("open", ["-na", "Google Chrome", "--args", "--new-window", GEMINI_URL]);
  } catch {
    openGemini();
  }
  sleepSync(3500);
  // 前面タブを Gemini に強制切替してからピン留め
  try {
    execFileSync(
      "osascript",
      [
        "-e",
        `tell application "Google Chrome"
  activate
  set found to false
  repeat with w in windows
    set i to 0
    repeat with t in tabs of w
      set i to i + 1
      try
        if (URL of t as text) starts with "https://gemini.google.com/" then
          set active tab index of w to i
          set index of w to 1
          set found to true
          exit repeat
        end if
      end try
    end repeat
    if found then exit repeat
  end repeat
  if found is false then
    tell front window to make new tab with properties {URL:"${GEMINI_URL}"}
    delay 2
  end if
end tell`,
      ],
      { timeout: 20_000, stdio: ["ignore", "pipe", "pipe"] },
    );
  } catch {
    /* ignore */
  }
  sleepSync(1500);
  pinActiveGeminiTabUrl(browser);
  if (!pinnedGeminiTabUrl.includes("gemini.google.com")) {
    // 最終手段: 既存の gemini タブを探してピン
    try {
      pinnedGeminiTabUrl = execFileSync(
        "osascript",
        [
          "-e",
          `tell application "Google Chrome"
  repeat with w in windows
    repeat with t in tabs of w
      try
        set u to URL of t as text
        if u starts with "https://gemini.google.com/" then return u
      end try
    end repeat
  end repeat
  return ""
end tell`,
        ],
        { encoding: "utf8", timeout: 8_000, stdio: ["ignore", "pipe", "pipe"] },
      ).trim();
    } catch {
      pinnedGeminiTabUrl = "";
    }
  }
  const r = geminiPageJs(`(() => {
  if (!location.href.includes("gemini.google.com")) return "wrong-host:" + location.href;
  const a = document.querySelector('a[aria-label="チャットを新規作成"]');
  if (a) { a.click(); return "clicked-new-chat"; }
  location.href = ${JSON.stringify(GEMINI_URL)};
  return "navigated-app";
})()`);
  sleepSync(2800);
  pinActiveGeminiTabUrl(browser);
  if (!pinnedGeminiTabUrl.includes("gemini.google.com")) {
    console.log(`※ ピン留め失敗: ${pinnedGeminiTabUrl || "(空)"}`);
  } else {
    console.log(`ピン留めタブ: ${pinnedGeminiTabUrl}`);
  }
  return r;
}

function focusComposer() {
  return geminiPageJs(`(() => {
  const box = document.querySelector('[aria-label="Gemini へのプロンプトを入力"],[role="textbox"]');
  if (!box) return "no-composer";
  box.focus();
  box.click();
  return "focused";
})()`);
}

/** 入力→送信を同一 JS で行う（再描画で消える前に送る） */
function fillAndSend(text) {
  const payload = JSON.stringify(text);
  return geminiPageJs(`(() => {
  const box = document.querySelector('[aria-label="Gemini へのプロンプトを入力"],[role="textbox"]');
  if (!box) return "no-composer";
  const text = ${payload};
  box.focus();
  box.click();
  try {
    document.execCommand("selectAll", false, null);
    document.execCommand("delete", false, null);
  } catch {}
  let method = "none";
  try {
    if (document.execCommand("insertText", false, text)) method = "insertText";
  } catch {}
  if (method === "none") {
    try {
      const dt = new DataTransfer();
      dt.setData("text/plain", text);
      box.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
      method = "pasteEvent";
    } catch {}
  }
  if ((box.innerText || box.textContent || "").trim().length < 40) {
    try {
      box.textContent = text;
      box.dispatchEvent(new InputEvent("beforeinput", { bubbles: true, data: text, inputType: "insertText" }));
      box.dispatchEvent(new InputEvent("input", { bubbles: true, data: text, inputType: "insertText" }));
      method = "textContent";
    } catch {}
  }
  const len = (box.innerText || box.textContent || "").trim().length;
  if (len < 40) return "fill-short:" + len + ":" + method;
  const btn = document.querySelector('button[aria-label="プロンプトを送信"]');
  if (btn && !btn.disabled) {
    btn.click();
    return "sent:" + len + ":" + method;
  }
  // Enter 相当
  box.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true }));
  return "enter:" + len + ":" + method;
})()`);
}

function composerLen() {
  const r = geminiPageJs(`(() => {
  const box = document.querySelector('[aria-label="Gemini へのプロンプトを入力"],[role="textbox"]');
  if (!box) return "0";
  return String((box.innerText || box.textContent || "").trim().length);
})()`);
  const n = Number(r);
  return Number.isFinite(n) ? n : 0;
}

function sendPrompt() {
  // 空のまま Enter しない
  if (composerLen() < 40) return "refuse-empty-composer";
  const clicked = geminiPageJs(`(() => {
  const btn = document.querySelector('button[aria-label="プロンプトを送信"]');
  if (btn && !btn.disabled) { btn.click(); return "clicked-send"; }
  return "no-send-btn";
})()`);
  if (clicked === "clicked-send") return clicked;
  try {
    execFileSync(
      "osascript",
      [
        "-e",
        `
${detectBrowserAppleScript()}
if browserName is "" then return "no-browser"
tell application browserName to activate
delay 0.2
tell application "System Events"
  key code 36
end tell
return "enter-send"
`,
      ],
      { encoding: "utf8", timeout: 8_000, stdio: ["ignore", "pipe", "pipe"] },
    );
    return "enter-send";
  } catch (err) {
    return `send-failed:${err?.message ?? err}`;
  }
}

function pageStatusJs() {
  return `(() => {
  const textOf = (el) => (el.innerText || el.textContent || "").replace(/\\s+/g, " ").trim();
  const body = textOf(document.body);
  const rate =
    /上限に達|利用上限|今日の上限|しばらくしてから|リクエストが多すぎ|rate limit|try again later|一時的に利用できません|混み合って|capacity|クォータ|しばらくお待ち/i.test(
      body,
    );
  const send = document.querySelector('button[aria-label="プロンプトを送信"]');
  const stop =
    document.querySelector('button[aria-label*="停止"]') ||
    document.querySelector('button[aria-label*="Stop"]') ||
    document.querySelector('button[aria-label*="生成を停止"]');
  const chipBtn = document.querySelector('[data-test-id="bard-mode-menu-button"],button[aria-label*="モード選択"]');
  const chip = chipBtn ? textOf(chipBtn) : "";
  // 応答本文: model-response を優先（形式不問の長さも見る）
  let best = "";
  let anyModel = "";
  const nodes = document.querySelectorAll(
    "model-response-content, model-response, message-content, response-container, assistant-messages-primary",
  );
  for (const n of nodes) {
    if (n.closest("side-navigation-v2, bard-sidenav, infinite-scroller")) continue;
    const s = textOf(n);
    if (!s || s.includes("【書く】") || s.length > 120000) continue;
    if (s.length > anyModel.length) anyModel = s;
    if (
      s.includes("stationIntro") &&
      s.includes("walkGuide") &&
      s.length > best.length
    ) {
      best = s;
    }
  }
  const use = best || anyModel;
  return JSON.stringify({
    rate,
    sending: !!(stop && !stop.disabled),
    canSend: !!(send && !send.disabled),
    chip,
    respLen: use.length,
    respHead: use.slice(0, 120),
    structured: best.length > 0,
  });
})()`;
}

function detectRateOrStatus() {
  const raw = geminiPageJs(pageStatusJs());
  try {
    return JSON.parse(raw);
  } catch {
    return { rate: /rate|上限|制限/i.test(raw), raw };
  }
}

function waitForResponse(timeoutSec = RESPONSE_TIMEOUT_SEC) {
  const started = Date.now();
  let lastLen = 0;
  let stable = 0;
  let sawGrowth = false;
  let sawSending = false;
  let lastSendingAt = 0;
  while ((Date.now() - started) / 1000 < timeoutSec) {
    sleepSync(4000);
    const st = detectRateOrStatus();
    if (st.rate) return { ok: false, reason: "rate-limit", status: st };
    if (!/Neon/i.test(st.chip || "") && st.chip) {
      // モデルが勝手に落ちた場合も制限扱いに近い
      if (/Flash|Hydrogen|Argon|自動/i.test(st.chip) && !/Neon/i.test(st.chip)) {
        return { ok: false, reason: "model-fallback:" + st.chip, status: st };
      }
    }
    const len = st.respLen || 0;
    const elapsed = Math.round((Date.now() - started) / 1000);
    if (st.sending) {
      sawSending = true;
      lastSendingAt = elapsed;
    }
    // 一度も生成が始まらず、90秒空振り → 貼付失敗扱い
    // Argon は思考が長いので、sending を一度でも見たら早期打ち切りしない
    if (
      elapsed >= 90 &&
      !sawSending &&
      !sawGrowth &&
      !st.sending &&
      len < 100
    ) {
      return { ok: false, reason: "no-response-started", status: st };
    }
    // 生成は見たが本文が取れないまま長い → キャプチャ方法の問題の可能性。もう少し待つ
    if (
      sawSending &&
      !sawGrowth &&
      !st.sending &&
      elapsed - lastSendingAt >= 180 &&
      len < 100
    ) {
      return { ok: false, reason: "response-not-captured", status: st };
    }
    if (len > lastLen + 40) {
      sawGrowth = true;
      lastLen = len;
      stable = 0;
    } else if (sawGrowth && len >= lastLen) {
      stable += 1;
    }
    // 送信中でなく、応答が伸びたあと 3 回連続で安定
    if (sawGrowth && !st.sending && stable >= 3 && len > 800) {
      return { ok: true, reason: "complete", status: st };
    }
    if (elapsed % 20 < 5) {
      console.log(
        `  …待機 ${elapsed}s · resp=${len} · sending=${!!st.sending} · chip=${st.chip || "?"}`,
      );
    }
  }
  return { ok: false, reason: "timeout", status: detectRateOrStatus() };
}

function isValidLandResponse(text, stationHints = []) {
  if (!text || text.length < 800) return false;
  if (text.includes("【書く】")) return false;
  if (/T A Pro|サイ・トゥオンブリー|おすすめ強力|Mac Studio/.test(text)) {
    return false;
  }
  // サイドバー履歴の羅列っぽいもの
  const titleHits = (
    text.match(/土地文作成|駅の土地文|全駅案内/g) || []
  ).length;
  if (titleHits >= 4) return false;
  if (!/stationIntro/.test(text) || !/walkGuide/.test(text)) return false;
  if (stationHints.length) {
    const hit = stationHints.filter((n) => n && text.includes(n)).length;
    if (hit < Math.min(2, stationHints.length)) return false;
  }
  return true;
}

function captureResponseText(stationHints = []) {
  const hintsJson = JSON.stringify(stationHints);
  const raw = geminiPageJs(`(() => {
  const textOf = (el) => (el.innerText || el.textContent || "").replace(/\\s+/g, " ").trim();
  const hints = ${hintsJson};
  const bad = (s) =>
    s.includes("【書く】") ||
    /T A Pro|サイ・トゥオンブリー|おすすめ強力|Mac Studio/.test(s) ||
    (s.match(/土地文作成|駅の土地文|全駅案内/g) || []).length >= 4;
  const good = (s) =>
    s.includes("stationIntro") &&
    s.includes("walkGuide") &&
    s.length >= 800 &&
    s.length < 120000 &&
    !bad(s) &&
    (hints.length === 0 || hints.filter((n) => n && s.includes(n)).length >= Math.min(2, hints.length));

  let best = "";
  const prefer = [
    ...document.querySelectorAll("model-response-content, model-response, message-content"),
    document.querySelector("assistant-messages-primary"),
  ].filter(Boolean);
  const roots = prefer.length ? prefer : [document.body];
  const walk = (root, depth = 0) => {
    if (!root || depth > 24) return;
    if (root.shadowRoot) walk(root.shadowRoot, depth + 1);
    const self = textOf(root);
    if (good(self) && self.length > best.length) best = self;
    for (const el of root.children || []) {
      if (el.closest && el.closest("side-navigation-v2, bard-sidenav, infinite-scroller")) {
        continue;
      }
      try {
        const s = textOf(el);
        if (good(s) && s.length > best.length) best = s;
      } catch {}
      walk(el, depth + 1);
    }
  };
  for (const r of roots) walk(r, 0);
  return best;
})()`);
  return raw;
}

function extractStationHints(promptPath) {
  try {
    const text = readFileSync(promptPath, "utf8");
    const m = text.match(/対象駅[^\n]*:\s*\n?([^\n]+)/);
    if (!m) return [];
    return m[1]
      .split(/[\/／、,]/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 2 && s.length < 20);
  } catch {
    return [];
  }
}

function saveRawPack(pack, text, meta = {}) {
  mkdirSync(RAW_DIR, { recursive: true });
  const path = join(RAW_DIR, `${pack.id}.txt`);
  const header = [
    `# pack ${pack.id} · ${pack.title}`,
    `# saved ${new Date().toISOString()}`,
    `# meta ${JSON.stringify(meta)}`,
    "",
  ].join("\n");
  writeFileSync(path, header + text + "\n", "utf8");
  return path;
}

function runUntilLimit(packs) {
  const pending = packs.filter((p) => !p.done);
  if (!pending.length) {
    console.log("未取込パックはありません");
    return;
  }
  mkdirSync(RAW_DIR, { recursive: true });
  console.log("");
  console.log("—— Gemini Web · Neon 制限まで連続 ——");
  console.log(`対象: ${pending.map((p) => p.id).join(", ")}（${pending.length}）`);
  console.log(`保存先: ${RAW_DIR}`);
  console.log("");

  openGemini();
  sleepSync(3000);

  for (const pack of pending) {
    console.log(`\n===== ${pack.id} · ${pack.title} =====`);
    const existing = join(RAW_DIR, `${pack.id}.txt`);
    if (existsSync(existing) && readFileSync(existing, "utf8").length > 800) {
      console.log(`スキップ（raw あり）: ${existing}`);
      continue;
    }

    const nc = newGeminiChat();
    console.log(`新規チャット: ${nc}`);
    const modelResult = selectArgonHigh(2.5);
    console.log(`モデル: ${modelResult}`);
    if (
      String(modelResult).includes("js-permission-needed") &&
      !String(modelResult).includes("already-argon-high")
    ) {
      console.log("JS 許可が必要です。停止します。");
      return;
    }

    const bodyRaw = extractPasteBlock(pack.fileAbs);
    const hintsEarly = extractStationHints(pack.fileAbs);
    // 駅リストを先頭に固定（Gemini が「リストが無い」と聞き返すのを防ぐ）
    const body =
      "【厳守】随筆・創作短編は禁止。指定の出力形式（駅名 / stationIntro / walkGuide / historyNotes / sightseeingNotes）だけを書く。\n" +
      (hintsEarly.length
        ? `【対象駅（この順で全部）】\n${hintsEarly.map((n, i) => `${i + 1}. ${n}`).join("\n")}\n\n`
        : "\n") +
      bodyRaw;
    copyToClipboard(body);
    writeFileSync(LAST_PACK, `${pack.id}\n${pack.fileAbs}\n`, "utf8");
    console.log(`コピー済 · ${body.length.toLocaleString()} 文字`);

    let sent = "";
    for (let attempt = 1; attempt <= 3; attempt++) {
      console.log(`入力+送信 試行 ${attempt}: ${focusComposer()}`);
      sleepSync(500);
      sent = fillAndSend(body);
      console.log(`  result: ${sent}`);
      if (/^(sent:|enter:)/.test(String(sent))) break;
      // Cmd+V フォールバック → すぐ送信ボタン
      pasteIntoGemini(0.5);
      sleepSync(700);
      const n = composerLen();
      console.log(`  after-cmdv len=${n}`);
      if (n >= 80) {
        sent = sendPrompt();
        console.log(`  send-after-cmdv: ${sent}`);
        if (sent === "clicked-send" || sent === "enter-send") break;
      }
    }
    if (!/^(sent:|enter:|clicked-send|enter-send)/.test(String(sent))) {
      console.log("※ 送信できませんでした。このパックをスキップします。");
      continue;
    }

    const hints = extractStationHints(pack.fileAbs);
    // 送信先チャットに対象駅が入っているか確認（別タブ誤爆の早期検知）
    // user-query の描画が遅れる／shadow 内にあることがあるので数回・広めに探す
    let hintHit = 0;
    let sentProbe = "";
    for (let probeTry = 1; probeTry <= 4; probeTry++) {
      sleepSync(probeTry === 1 ? 1500 : 900);
      sentProbe = geminiPageJs(`(() => {
  const hints = ${JSON.stringify(hints)};
  const t = (el) => (el.innerText || el.textContent || "").replace(/\\s+/g, " ").trim();
  const chunks = [];
  const walk = (root, depth = 0) => {
    if (!root || depth > 20) return;
    if (root.shadowRoot) walk(root.shadowRoot, depth + 1);
    try {
      const s = t(root);
      if (s && s.length > 40 && s.length < 20000) chunks.push(s);
    } catch {}
    for (const el of root.children || []) walk(el, depth + 1);
  };
  walk(document.body, 0);
  for (const sel of ["user-query-content", "user-query", "message-content"]) {
    for (const el of document.querySelectorAll(sel)) chunks.push(t(el));
  }
  const blob = chunks.join("\\n");
  const hit = hints.filter((h) => h && blob.includes(h)).length;
  const lastUser = [...document.querySelectorAll("user-query-content")].map((el) => t(el)).pop() || "";
  return JSON.stringify({ hit, last: (lastUser || blob).slice(0, 400), blobHasStrict: blob.includes("【厳守】") });
})()`);
      try {
        const parsed = JSON.parse(String(sentProbe));
        hintHit = Number(parsed.hit) || 0;
        sentProbe = parsed.last || sentProbe;
        console.log(
          `送信確認${probeTry}: 駅ヒント一致 ${hintHit}/${hints.length}` +
            (parsed.blobHasStrict ? " · 厳守あり" : ""),
        );
      } catch {
        hintHit = hints.filter((h) => String(sentProbe).includes(h)).length;
        console.log(`送信確認${probeTry}: 駅ヒント一致 ${hintHit}/${hints.length}`);
      }
      if (!hints.length || hintHit >= Math.min(2, hints.length)) break;
    }
    if (hints.length && hintHit < Math.min(2, hints.length)) {
      // enter 成功かつ本文長が近ければ、DOM 遅延の誤検知として続行
      const sentLen = Number(String(sent).match(/(?:enter|sent):(\d+)/)?.[1] || 0);
      if (sentLen >= Math.floor(body.length * 0.85)) {
        console.log(
          `※ 駅ヒント未検出だが送信長 ${sentLen}≈${body.length} のため続行（DOM遅延の可能性）`,
        );
        console.log(`  probe: ${String(sentProbe).slice(0, 180)}`);
      } else {
        console.log("※ 送信先が対象パックではない可能性。停止します。");
        console.log(`  probe: ${String(sentProbe).slice(0, 180)}`);
        return;
      }
    }
    console.log(
      `応答待ち（最大 ${RESPONSE_TIMEOUT_SEC / 60} 分）… ヒント駅: ${hints.join("/") || "—"}`,
    );
    const wait = waitForResponse(RESPONSE_TIMEOUT_SEC);
    console.log(`結果: ${wait.reason} · len=${wait.status?.respLen ?? "?"}`);

    if (wait.reason === "rate-limit" || String(wait.reason).startsWith("model-fallback")) {
      const partial = captureResponseText(hints);
      if (isValidLandResponse(partial, hints)) {
        const path = saveRawPack(pack, partial, { stop: wait.reason, status: wait.status });
        console.log(`部分保存: ${path}`);
      }
      console.log("");
      console.log("◆ Neon/モデル制限（またはモデル落ち）を検出したので停止します。");
      console.log("  制限が開けたら: npm run land:gemini:until-limit");
      return;
    }

    if (wait.reason === "no-response-started") {
      console.log("※ 送信後に生成が始まりませんでした。ゴミ保存はせず停止します。");
      return;
    }

    let text = captureResponseText(hints);
    if (!isValidLandResponse(text, hints)) {
      const rawLen = wait.status?.respLen ?? 0;
      const latest = String(wait.status?.respHead || text || "");
      const askingList =
        /対象駅|駅名リスト|リスト.*提示|ご提示|共有いただき/i.test(latest) ||
        /対象の駅名リスト/i.test(
          geminiPageJs(`(() => {
  const t = (el) => (el.innerText || el.textContent || "").replace(/\\s+/g, " ").trim();
  const mrs = [...document.querySelectorAll("model-response-content")];
  return mrs.length ? t(mrs[mrs.length - 1]).slice(0, 400) : "";
})()`),
        );
      if (askingList && hints.length) {
        const follow =
          `対象駅リスト（この順で全部・${hints.length}駅）:\n` +
          hints.map((n, i) => `${i + 1}. ${n}`).join("\n") +
          `\n\n出力形式は駅名 / stationIntro / walkGuide / historyNotes / sightseeingNotes のみ。随筆禁止。今すぐ全駅書いてください。\n`;
        console.log("※ 駅リスト確認が来たので追記送信します…");
        console.log(`  follow-up: ${fillAndSend(follow)}`);
        const wait2 = waitForResponse(RESPONSE_TIMEOUT_SEC);
        console.log(`結果2: ${wait2.reason} · len=${wait2.status?.respLen ?? "?"}`);
        if (wait2.reason === "rate-limit" || String(wait2.reason).startsWith("model-fallback")) {
          console.log("◆ Neon/モデル制限を検出したので停止します。");
          return;
        }
        text = captureResponseText(hints);
      }
    }
    if (!isValidLandResponse(text, hints)) {
      const rawLen = wait.status?.respLen ?? 0;
      console.log(
        `※ 形式が土地文ではありません（structured応答len=${text?.length ?? 0} · 画面応答len=${rawLen}）。保存せず停止。`,
      );
      return;
    }
    const path = saveRawPack(pack, text, { stop: wait.reason, status: wait.status });
    console.log(`保存: ${path}（${text.length.toLocaleString()} 文字）`);
    sleepSync(2500);
  }

  console.log("\n◆ 未取込パックをすべて送信・保存しました（制限には未到達）。");
  console.log("  次: Cursor に raw を渡して配線（運用B）");
}

/** 開いたあと入力欄へ Cmd+V（送信はしない · モデル確認のため） */
function pasteIntoGemini(delaySec = 0.6) {
  const script = `
set waitSec to ${Number(delaySec)}
delay waitSec
${detectBrowserAppleScript()}
if browserName is "" then
  return "no-browser"
end if
tell application browserName to activate
delay 0.4
tell application "System Events"
  tell process browserName
    set frontmost to true
    delay 0.2
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
  console.log(
    `2. Gemini を開く → ${TARGET_MODEL} ${TARGET_THINKING} を自動選択 → Cmd+V`,
  );
  console.log("3. 【新規チャット】推奨 · 自動選択が外れていれば手動で Neon 高");
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
      console.log(`連続: npm run land:gemini:until-limit`);
    }
    return;
  }

  if (opts.untilLimit) {
    runUntilLimit(packs);
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
    if (!opts.noModel) {
      console.log(`モデル選択待ち…（約3.2秒 · ${TARGET_MODEL} ${TARGET_THINKING}）`);
      const modelResult = selectArgonHigh(3.2);
      console.log(`モデル: ${modelResult}`);
      if (
        String(modelResult).includes("js-permission-needed") &&
        !String(modelResult).includes("already-argon-high") &&
        !String(modelResult).includes("picked-high")
      ) {
        console.log("");
        console.log("—— 初回だけ手動（約10秒）——");
        console.log(
          "Chrome: 表示 → 開発 / 管理 → 「Apple Events からの JavaScript を許可」をオン",
        );
        console.log("（確認ダイアログが出たら「許可」）");
        console.log(
          "オンにしたらもう一度: npm run land:gemini -- --pack " +
            (target?.id || "S1"),
        );
        console.log(
          "※ Gemini 公式URLにモデル指定は無いので、この許可が自動化の唯一の前提です",
        );
      } else if (
        String(modelResult).includes("no-model-chip") ||
        String(modelResult).includes("no-argon") ||
        String(modelResult).includes("js-failed")
      ) {
        console.log(
          "※ 自動選択に失敗しました。入力欄左のモデルから「Neon」→ 思考レベル「高」を手動で選んでください。",
        );
        console.log(
          "※ Gemini設定で「自動モデル選択」がONだと毎回リセットされやすいです。OFF推奨。",
        );
      }
    }
    if (!opts.noPaste) {
      console.log("貼付待ち…（約0.8秒）");
      const pasteResult = pasteIntoGemini(0.8);
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
