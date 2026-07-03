#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

# サーバー機能・決済フローは静的ホスティングでは動かないため除外
SKIP_MOVE=(
  "app/api"
  "app/admin"
  "app/antiques/[id]/purchase"
  "app/antiques/[id]/inquiry"
)

restore_skipped() {
  for path in "${SKIP_MOVE[@]}"; do
    local key
    key="$(echo "$path" | tr '/[]' '___')"
    if [[ -d ".lolipop-skip-$key" ]]; then
      rm -rf "$path"
      mv ".lolipop-skip-$key" "$path"
    fi
  done
}

trap restore_skipped EXIT

echo "→ 静的ホスティング非対応ルートを一時退避"
for path in "${SKIP_MOVE[@]}"; do
  key="$(echo "$path" | tr '/[]' '___')"
  if [[ -d "$path" ]]; then
    rm -rf ".lolipop-skip-$key"
    mv "$path" ".lolipop-skip-$key"
  fi
done

echo "→ Lolipop 用静的ビルド（/lagado）"
LOLIPOP_EXPORT=1 npm run build

restore_skipped
trap - EXIT

cat > out/.htaccess <<'EOF'
DirectoryIndex index.html
Options -Indexes
EOF

echo "→ lagado/ フォルダを作成"
rm -rf lagado
cp -R out lagado

bash scripts/verify-lagado.sh lagado

echo ""
echo "完了: lagado/ をそのまま Lolipop にアップロード"
echo "  ※ uploads/（約90MB）を忘れると写真だけ表示されません"
echo "  ローカル: $(pwd)/lagado/"
echo "  先:       public_html/ 直下（lagado フォルダごと）"
echo "  URL:      https://（ドメイン）/lagado/"
echo ""
echo "※ 仮公開: カタログ閲覧のみ（管理・購入 API なし）"
