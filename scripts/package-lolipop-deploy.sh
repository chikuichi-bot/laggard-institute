#!/usr/bin/env bash
# out/ を public_html 用に分割: index.html は直下、他は lagado2026/
set -euo pipefail
cd "$(dirname "$0")/.."

DEPLOY_DIR="${1:-lolipop}"
ASSET_DIR="lagado2026"

rm -rf "$DEPLOY_DIR"
mkdir -p "$DEPLOY_DIR/$ASSET_DIR"
cp -R out/* "$DEPLOY_DIR/$ASSET_DIR/"
# トップはドメイン直下。/lagado2026/ でも開けるようコピーを残す
# （以前は rm していたため、認証後の /lagado2026/ が index 欠落で壊れていた）
cp "$DEPLOY_DIR/$ASSET_DIR/index.html" "$DEPLOY_DIR/index.html"
# ルート /favicon.ico（ブラウザが直読みする）
if [[ -f "$DEPLOY_DIR/$ASSET_DIR/favicon.ico" ]]; then
  cp "$DEPLOY_DIR/$ASSET_DIR/favicon.ico" "$DEPLOY_DIR/favicon.ico"
fi

cat > "$DEPLOY_DIR/.htaccess" <<'EOF'
DirectoryIndex index.html
Options -Indexes
EOF

echo "→ 配置: $DEPLOY_DIR/index.html + favicon.ico + $DEPLOY_DIR/$ASSET_DIR/（index.html 両方）"
du -sh "$DEPLOY_DIR" "$DEPLOY_DIR/$ASSET_DIR" 2>/dev/null || true
