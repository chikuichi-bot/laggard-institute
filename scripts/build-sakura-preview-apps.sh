#!/usr/bin/env bash
# 私設プレビュー用: basePath=/preview-apps-intro で静的ビルドし、
# www/preview-apps-intro/ に上げる束だけを作る（本番 lagado2026 には触れない）
#
# 含む: apps 紹介 · 街で見つけたモノ · 海で見つけたモノ
# 含まない: antiques · amappola · api/admin（本番公開面・認証付き本番とは別）
set -euo pipefail
cd "$(dirname "$0")/.."

# shellcheck source=scripts/lolipop-skip-lib.sh
source "$(dirname "$0")/lolipop-skip-lib.sh"

PREVIEW_BASE="/preview-apps-intro"
OUT_ROOT="preview-apps-intro-bundle"
ASSET_DIR="preview-apps-intro"

# city / sea は私設プレビューに載せる（SKIP しない）
SKIP_MOVE=(
  "app/api"
  "app/admin"
  "app/antiques"
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

echo "→ 私設プレビュービルド basePath=${PREVIEW_BASE}（apps + city + sea）"
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

copy_tree() {
  local name="$1"
  if [[ -d "$SRC/$name" ]]; then
    cp -R "$SRC/$name" "$OUT_ROOT/$ASSET_DIR/$name"
  else
    echo "警告: $SRC/$name がありません" >&2
  fi
}

copy_tree "_next"
copy_tree "apps"
copy_tree "city"
copy_tree "sea"

# ルート HTML（あれば）
if [[ -f "$SRC/index.html" ]]; then
  cp "$SRC/index.html" "$OUT_ROOT/$ASSET_DIR/index.html"
fi
if [[ -d "$SRC/news" ]]; then
  cp -R "$SRC/news" "$OUT_ROOT/$ASSET_DIR/news"
fi
if [[ -d "$SRC/map" ]]; then
  cp -R "$SRC/map" "$OUT_ROOT/$ASSET_DIR/map"
fi
if [[ -d "$SRC/contact" ]]; then
  cp -R "$SRC/contact" "$OUT_ROOT/$ASSET_DIR/contact"
fi

# public/apps の画面ギャラリーが export に載っていなければ補完
if [[ -d public/apps ]]; then
  for slug_dir in public/apps/*; do
    [[ -d "$slug_dir" ]] || continue
    slug="$(basename "$slug_dir")"
    mkdir -p "$OUT_ROOT/$ASSET_DIR/apps/$slug"
    cp -R "$slug_dir"/. "$OUT_ROOT/$ASSET_DIR/apps/$slug"/
  done
fi

# 街・海の画像（カタログが参照する uploads）
mkdir -p "$OUT_ROOT/$ASSET_DIR/uploads"
if [[ -d public/uploads/city ]]; then
  echo "→ uploads/city を同梱"
  cp -R public/uploads/city "$OUT_ROOT/$ASSET_DIR/uploads/city"
fi
if [[ -d public/uploads/sea ]]; then
  echo "→ uploads/sea を同梱"
  cp -R public/uploads/sea "$OUT_ROOT/$ASSET_DIR/uploads/sea"
fi

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

# ルート誘導（ビルド済み index が無い／上書きしたい場合の案内）
if [[ ! -f "$OUT_ROOT/$ASSET_DIR/index.html" ]]; then
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
  <p><a href="${PREVIEW_BASE}/city/">街で見つけたモノ</a></p>
  <p><a href="${PREVIEW_BASE}/sea/">海で見つけたモノ</a></p>
</body>
</html>
EOF
fi

cat > "$OUT_ROOT/README-UPLOAD.txt" <<EOF
私設プレビュー（apps + 街 + 海）

【上げ先】
  さくら www/preview-apps-intro/ のみ
  （www/index.html · www/lagado2026/ は触らない）

【公開】
  Basic 認証（preview）付きのため、他の人には見えない

【URL】
  https://lagado.jp/preview-apps-intro/apps/
  https://lagado.jp/preview-apps-intro/city/
  https://lagado.jp/preview-apps-intro/sea/
EOF

echo "→ 完了: $OUT_ROOT/$ASSET_DIR/"
du -sh "$OUT_ROOT" "$OUT_ROOT/$ASSET_DIR" 2>/dev/null || true
echo "  apps:" 
find "$OUT_ROOT/$ASSET_DIR/apps" -name index.html 2>/dev/null | wc -l
echo "  city:" 
find "$OUT_ROOT/$ASSET_DIR/city" -name index.html 2>/dev/null | wc -l
echo "  sea:" 
find "$OUT_ROOT/$ASSET_DIR/sea" -name index.html 2>/dev/null | wc -l
