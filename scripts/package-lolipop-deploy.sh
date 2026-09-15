#!/usr/bin/env bash
# out/ を public_html 用に分割: index.html は直下、他は lagado2026/
set -euo pipefail
cd "$(dirname "$0")/.."

DEPLOY_DIR="${1:-lolipop}"
ASSET_DIR="lagado2026"

rm -rf "$DEPLOY_DIR"
mkdir -p "$DEPLOY_DIR/$ASSET_DIR"
cp -R out/* "$DEPLOY_DIR/$ASSET_DIR/"
cp "$DEPLOY_DIR/$ASSET_DIR/index.html" "$DEPLOY_DIR/index.html"
rm "$DEPLOY_DIR/$ASSET_DIR/index.html"

cat > "$DEPLOY_DIR/.htaccess" <<'EOF'
DirectoryIndex index.html
Options -Indexes
EOF

echo "→ 配置: $DEPLOY_DIR/index.html + $DEPLOY_DIR/$ASSET_DIR/"
du -sh "$DEPLOY_DIR" "$DEPLOY_DIR/$ASSET_DIR" 2>/dev/null || true
