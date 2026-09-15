#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

# shellcheck source=scripts/lolipop-skip-lib.sh
source "$(dirname "$0")/lolipop-skip-lib.sh"

LOLIPOP_MINIMAL="${LOLIPOP_MINIMAL:-0}"
LOLIPOP_APPS_ONLY="${LOLIPOP_APPS_ONLY:-0}"
DEPLOY_DIR="lolipop"
ASSET_DIR="lagado2026"

if [[ "$LOLIPOP_APPS_ONLY" == "1" ]]; then
  SKIP_MOVE=(
    "app/api"
    "app/admin"
    "app/antiques"
    "app/city"
    "app/sea"
    "app/amappola"
  )
elif [[ "$LOLIPOP_MINIMAL" == "1" ]]; then
  SKIP_MOVE=(
    "app/api"
    "app/admin"
    "app/antiques"
    "app/city"
    "app/sea"
    "app/apps"
    "app/amappola"
  )
else
  SKIP_MOVE=(
    "app/api"
    "app/admin"
    "app/antiques/[id]/purchase"
    "app/antiques/[id]/inquiry"
  )
fi

restore_skipped() {
  # Prefer safe restore (diff before clobber). Do not rm -rf divergent trees.
  restore_skip_list "${SKIP_MOVE[@]}" || true
}

# Heal any leftover skips from a previous interrupted build before we stash again.
if ! heal_lolipop_skips 0; then
  echo "✗ skip 退避の衝突を解消してから再実行してください: bash scripts/restore-lolipop-skip.sh" >&2
  exit 1
fi

trap restore_skipped EXIT

echo "→ 静的ホスティング非対応ルートを一時退避"
for path in "${SKIP_MOVE[@]}"; do
  stash_path_for_export "$path"
done

if [[ "$LOLIPOP_APPS_ONLY" == "1" ]]; then
  echo "→ Lolipop アプリページ差し替え用（カタログは除外）"
elif [[ "$LOLIPOP_MINIMAL" == "1" ]]; then
  echo "→ Lolipop ミニマル（トップ=index.html / 他=lagado2026/）"
else
  echo "→ Lolipop カタログ一式（トップ=index.html / 他=lagado2026/）"
fi

LOLIPOP_EXPORT=1 LOLIPOP_MINIMAL="$LOLIPOP_MINIMAL" npm run build

restore_skipped
trap - EXIT

cat > out/.htaccess <<'EOF'
DirectoryIndex index.html
Options -Indexes
EOF

if [[ "$LOLIPOP_APPS_ONLY" == "1" ]]; then
  echo "→ apps専用: 動画・カタログ画像を除外"
  rm -rf out/videos out/uploads
elif [[ "$LOLIPOP_MINIMAL" == "1" ]]; then
  echo "→ ミニマル: 動画・画像を除外"
  rm -rf out/videos out/uploads out/icons
fi

bash scripts/package-lolipop-deploy.sh "$DEPLOY_DIR"

if [[ "$LOLIPOP_APPS_ONLY" == "1" ]]; then
  bash scripts/package-lolipop-apps.sh "$DEPLOY_DIR"
elif [[ "$LOLIPOP_MINIMAL" != "1" ]]; then
  bash scripts/verify-lagado.sh "$DEPLOY_DIR/$ASSET_DIR"
fi

echo ""
if [[ "$LOLIPOP_APPS_ONLY" == "1" ]]; then
  echo "完了: lolipop-apps/lagado2026/ を public_html/lagado2026/ に上書き"
  echo "  URL: https://lagado.jp/lagado2026/apps/"
  echo "  ローカル: $(pwd)/lolipop-apps/"
else
  echo "完了: lolipop/ の中身を public_html/ にそのまま上げる"
  echo "  public_html/index.html          ← トップ"
  echo "  public_html/lagado2026/         ← 営業日・地図・連絡・_next 等"
  echo "  URL: https://（ドメイン）/"
  echo "       https://（ドメイン）/lagado2026/news/ など"
  echo "  ローカル: $(pwd)/lolipop/"
fi
echo ""
