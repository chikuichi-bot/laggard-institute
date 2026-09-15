#!/usr/bin/env bash
# apps ページ差し替え用の薄いアップロード束を作る
# 前提: 先に build:lolipop（または LOLIPOP_APPS_ONLY=1）で lolipop/ ができていること
set -euo pipefail
cd "$(dirname "$0")/.."

SRC_DIR="${1:-lolipop}"
ASSET_DIR="lagado2026"
OUT_DIR="lolipop-apps"

if [[ ! -d "$SRC_DIR/$ASSET_DIR/apps" ]]; then
  echo "エラー: $SRC_DIR/$ASSET_DIR/apps がありません。先に npm run build:lolipop:apps を実行してください。" >&2
  exit 1
fi

rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR/$ASSET_DIR"

# Next の静的アセットは HTML とセットで必須
cp -R "$SRC_DIR/$ASSET_DIR/_next" "$OUT_DIR/$ASSET_DIR/_next"

# アプリページ本体
cp -R "$SRC_DIR/$ASSET_DIR/apps" "$OUT_DIR/$ASSET_DIR/apps"

# アイコン（アプリ一覧で使用）
if [[ -d "$SRC_DIR/$ASSET_DIR/icons" ]]; then
  mkdir -p "$OUT_DIR/$ASSET_DIR/icons"
  for name in \
    omikuji-bunko.png \
    literary-fragments.png \
    wasure-memo.png \
    wazukana-byo.png \
    tsuitara-memo.png \
    4s-camera.png \
    abomon-game.png
  do
    if [[ -f "$SRC_DIR/$ASSET_DIR/icons/$name" ]]; then
      cp "$SRC_DIR/$ASSET_DIR/icons/$name" "$OUT_DIR/$ASSET_DIR/icons/$name"
    fi
  done
fi

# favicon があれば
if [[ -f "$SRC_DIR/$ASSET_DIR/favicon.ico" ]]; then
  cp "$SRC_DIR/$ASSET_DIR/favicon.ico" "$OUT_DIR/$ASSET_DIR/favicon.ico"
fi

cat > "$OUT_DIR/README-UPLOAD.txt" <<EOF
アプリページだけ差し替えアップロード

【いますぐ用意する】
  プロジェクト直下で:
    npm run upload:apps
  → lolipop-apps/ を作り直し、Finder が開きます

【上げ先】
  FTP: public_html/lagado2026/

【このフォルダの中身をそのまま上書き】
  lagado2026/apps/
  lagado2026/_next/
  lagado2026/icons/   （7個のアイコン）
  lagado2026/favicon.ico （あれば）

【公開URL】
  https://lagado.jp/lagado2026/apps/

※ _next は必ず apps と一緒に上げてください（片方だけだと表示が壊れます）
※ 古道具・街・海の uploads は触らなくて大丈夫です
EOF

echo "→ 完了: $OUT_DIR/"
du -sh "$OUT_DIR" "$OUT_DIR/$ASSET_DIR" 2>/dev/null || true
echo "  公開予定: https://lagado.jp/lagado2026/apps/"
echo "  手順: $OUT_DIR/README-UPLOAD.txt"
