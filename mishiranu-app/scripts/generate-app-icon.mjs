/**
 * トップ採用の抽象地図（道網）からアプリアイコン PNG を作る。
 * 背景 #f8f5ee · 線 #2a241c · 駅の四角を目印に。
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const iosRoot = join(root, "..", "mishiranu-ios");

const PAPER = "#f8f5ee";
const INK = "#2a241c";

/** アイコン用に少し太め・中央寄りに構図 */
const SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" fill="${PAPER}"/>
  <g transform="translate(112 88) scale(5)">
    <!-- 川（岸） -->
    <path d="M52 4 C50 28, 52 48, 56 64 C60 76, 64 84, 70 90
             M148 20 C128 34, 108 50, 90 68 C82 76, 76 84, 70 90
             M70 90 C72 108, 74 126, 76 144 C77 154, 78 160, 80 168"
          fill="none" stroke="${INK}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"
          stroke-opacity="0.55"/>
    <!-- 道網 -->
    <g fill="none" stroke="${INK}" stroke-width="2.1" stroke-linecap="square" stroke-opacity="0.32">
      <path d="M2 132 H158"/>
      <path d="M34 4 V164"/>
      <path d="M142 4 V164"/>
      <path d="M88 98 V164"/>
      <path d="M6 36 H48"/>
      <path d="M6 58 H50"/>
      <path d="M6 82 H52"/>
      <path d="M6 108 H54"/>
      <path d="M100 40 H140"/>
      <path d="M98 62 H144"/>
      <path d="M96 88 H146"/>
      <path d="M100 112 H148"/>
      <path d="M18 8 V128"/>
      <path d="M46 8 V128"/>
      <path d="M108 8 V128"/>
      <path d="M128 8 V160"/>
    </g>
    <!-- 駅 -->
    <rect x="88.5" y="78.5" width="9" height="9" rx="1.2"
          fill="${PAPER}" stroke="${INK}" stroke-width="2.2"/>
  </g>
</svg>`;

async function writePng(path, size) {
  mkdirSync(dirname(path), { recursive: true });
  const buf = await sharp(Buffer.from(SVG)).resize(size, size).png().toBuffer();
  writeFileSync(path, buf);
  console.log("wrote", path, `${size}x${size}`);
}

const svgPath = join(root, "public/icons/mishiranu-map-icon.svg");
mkdirSync(dirname(svgPath), { recursive: true });
writeFileSync(svgPath, SVG);

await writePng(join(root, "public/icons/icon-512.png"), 512);
await writePng(join(root, "public/icons/icon-192.png"), 192);
await writePng(join(root, "public/icons/icon-180.png"), 180);
await writePng(join(root, "public/icons/apple-touch-icon.png"), 180);
await writePng(join(root, "public/icons/icon-1024.png"), 1024);

await writePng(
  join(iosRoot, "MishiranuEki/Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png"),
  1024,
);

// Capacitor 同梱がある場合も揃える
const capIcon = join(
  root,
  "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png",
);
await writePng(capIcon, 1024);
await writePng(join(root, "ios/App/App/public/icons/icon-512.png"), 512);
await writePng(join(root, "ios/App/App/public/icons/icon-192.png"), 192);
await writePng(join(root, "ios/App/App/public/icons/icon-180.png"), 180);
await writePng(join(root, "ios/App/App/public/icons/apple-touch-icon.png"), 180);
await writePng(join(root, "ios-web/icons/icon-512.png"), 512);
await writePng(join(root, "ios-web/icons/icon-192.png"), 192);
await writePng(join(root, "ios-web/icons/icon-180.png"), 180);
await writePng(join(root, "ios-web/icons/apple-touch-icon.png"), 180);

console.log("done");
