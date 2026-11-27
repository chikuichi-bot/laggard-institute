#!/usr/bin/env bash
# 私設プレビュー用: basePath=/preview-apps-intro で静的ビルドし、
# www/preview-apps-intro/ に上げる束だけを作る（本番 lagado2026 には触れない）
set -euo pipefail
cd "$(dirname "$0")/.."

# shellcheck source=scripts/lolipop-skip-lib.sh
source "$(dirname "$0")/lolipop-skip-lib.sh"

PREVIEW_BASE="/preview-apps-intro"
OUT_ROOT="preview-apps-intro-bundle"
ASSET_DIR="preview-apps-intro"

SKIP_MOVE=(
  "app/api"
  "app/admin"
  "app/antiques"
  "app/city"
  "app/sea"
  "app/amappola"
)

restore_skipped() {
  restore_skip_list "${SKIP_MOVE[@]}" || true
}

if ! heal_lolipop_skips 0; then
  echo "✗ skip 退避の衝突を解消してから再実行: bash scripts/restore-lolipop-skip.sh" >&2
  exit 1
fi

trap restore_skipped EXIT

echo "→ 静的ホスティング非対応ルートを一時退避"
for path in "${SKIP_MOVE[@]}"; do
  stash_path_for_export "$path"
done

echo "→ 私設プレビュービルド basePath=${PREVIEW_BASE}"
LOLIPOP_EXPORT=1 LOLIPOP_BASE_PATH="$PREVIEW_BASE" npm run build

restore_skipped
trap - EXIT

rm -rf "$OUT_ROOT"
mkdir -p "$OUT_ROOT/$ASSET_DIR"

# out/ は basePath 付きなので out/preview-apps-intro/ になる
if [[ -d "out${PREVIEW_BASE}" ]]; then
  SRC="out${PREVIEW_BASE}"
elif [[ -d "out" ]]; then
  SRC="out"
else
  echo "エラー: out が見つかりません" >&2
  exit 1
fi

cp -R "$SRC/apps" "$OUT_ROOT/$ASSET_DIR/apps"
cp -R "$SRC/_next" "$OUT_ROOT/$ASSET_DIR/_next"

mkdir -p "$OUT_ROOT/$ASSET_DIR/icons"
for name in \
  omikuji-bunko.png \
  literary-fragments.png \
  wasure-memo.png \
  wazukana-byo.png \
  tsuitara-memo.png \
  4s-camera.png \
  abomon-game.png \
  sorakara.png \
  past-today.png
do
  if [[ -f "public/icons/$name" ]]; then
    cp "public/icons/$name" "$OUT_ROOT/$ASSET_DIR/icons/$name"
  fi
done

if [[ -f "public/favicon.ico" ]]; then
  cp "public/favicon.ico" "$OUT_ROOT/$ASSET_DIR/favicon.ico"
fi

# ルート誘導
cat > "$OUT_ROOT/$ASSET_DIR/index.html" <<EOF
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <meta http-equiv="refresh" content="0; url=${PREVIEW_BASE}/apps/" />
  <title>preview-apps-intro</title>
  <link rel="canonical" href="${PREVIEW_BASE}/apps/" />
</head>
<body>
  <p><a href="${PREVIEW_BASE}/apps/">アプリ一覧へ</a></p>
</body>
</html>
EOF

echo "→ 完了: $OUT_ROOT/$ASSET_DIR/"
du -sh "$OUT_ROOT" "$OUT_ROOT/$ASSET_DIR" 2>/dev/null || true
find "$OUT_ROOT/$ASSET_DIR/apps" -name index.html | sort
