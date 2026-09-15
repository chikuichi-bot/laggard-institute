#!/usr/bin/env bash
# アプリページをいつでも FTP できるように、パッケージを作り直して Finder を開く
set -euo pipefail
cd "$(dirname "$0")/.."

npm run build:lolipop:apps

OUT_DIR="$(pwd)/lolipop-apps"
open "$OUT_DIR"

echo ""
echo "アップロード準備完了"
echo "  フォルダ: $OUT_DIR"
echo "  上げ先: public_html/lagado2026/"
echo "  公開URL: https://lagado.jp/lagado2026/apps/"
echo "  手順: $OUT_DIR/README-UPLOAD.txt"
