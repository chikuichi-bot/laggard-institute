#!/usr/bin/env node
/**
 * Build a static web bundle into ios-web/ for Capacitor.
 * No Cursor Apps Publish. No remote server.url required.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "out");
const webDir = path.join(root, "ios-web");
const parked = path.join(root, ".ios-export-park");

const parkPaths = [
  "app/api",
  "app/apple-icon.tsx",
  "app/icon.tsx",
  // ImageResponse icons are not static-export friendly.
];

function run(cmd, args, env = {}) {
  const res = spawnSync(cmd, args, {
    cwd: root,
    env: { ...process.env, ...env },
    stdio: "inherit",
    shell: false,
  });
  if (res.status !== 0) {
    throw new Error(`${cmd} ${args.join(" ")} failed (${res.status})`);
  }
}

function park() {
  fs.rmSync(parked, { recursive: true, force: true });
  fs.mkdirSync(parked, { recursive: true });
  for (const rel of parkPaths) {
    const from = path.join(root, rel);
    if (!fs.existsSync(from)) continue;
    const to = path.join(parked, rel);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.renameSync(from, to);
    console.log(`parked ${rel}`);
  }
}

function restore() {
  if (!fs.existsSync(parked)) return;
  for (const rel of parkPaths) {
    const from = path.join(parked, rel);
    if (!fs.existsSync(from)) continue;
    const to = path.join(root, rel);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    if (fs.existsSync(to)) fs.rmSync(to, { recursive: true, force: true });
    fs.renameSync(from, to);
    console.log(`restored ${rel}`);
  }
  fs.rmSync(parked, { recursive: true, force: true });
}

function copyDir(src, dest) {
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(dest, { recursive: true });
  fs.cpSync(src, dest, { recursive: true });
}

try {
  park();
  fs.rmSync(outDir, { recursive: true, force: true });
  run("npx", ["next", "build"], { MISHIRANU_IOS_EXPORT: "1" });
  if (!fs.existsSync(outDir)) {
    throw new Error("next export produced no out/ directory");
  }
  copyDir(outDir, webDir);
  const lab = path.join(webDir, "lab", "mishiranu-eki", "index.html");
  if (!fs.existsSync(lab)) {
    throw new Error("missing lab/mishiranu-eki/index.html in export");
  }
  const home = path.join(webDir, "index.html");
  if (!fs.existsSync(home)) {
    throw new Error("missing index.html in export (Capacitor entry)");
  }
  // Sanity: home page must embed the app shell, not a redirect stub.
  const homeHtml = fs.readFileSync(home, "utf8");
  if (!homeHtml.includes("mishiranu-brand") || !homeHtml.includes("mishiranu-root")) {
    throw new Error(
      "ios-web/index.html is missing the 見知らぬ駅 shell — export is wrong",
    );
  }
  console.log("Wrote static bundle → ios-web/ (Capacitor opens / with 見知らぬ駅)");
} finally {
  restore();
}
