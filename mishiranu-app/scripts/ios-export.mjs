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
  // Capacitor opens webDir/index.html — jump straight into the lab (no Publish host).
  fs.writeFileSync(
    path.join(webDir, "index.html"),
    `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"/>
<meta http-equiv="refresh" content="0;url=lab/mishiranu-eki/"/>
<title>見知らぬ駅</title>
<script>location.replace("lab/mishiranu-eki/");</script>
</head>
<body style="margin:0;background:#f5eedc;color:#1f1b17;font-family:serif;display:grid;place-items:center;min-height:100vh">
<p>見知らぬ駅</p>
</body>
</html>
`,
  );
  pruneExportNoise(webDir);
  console.log("Wrote static bundle → ios-web/ (Capacitor entry → lab/mishiranu-eki/)");
} finally {
  restore();
}

function pruneExportNoise(dir) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) {
      pruneExportNoise(full);
      continue;
    }
    if (name.startsWith("__next.") || name.endsWith(".txt")) {
      fs.rmSync(full, { force: true });
    }
  }
}
