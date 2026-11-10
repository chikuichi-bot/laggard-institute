#!/usr/bin/env bash
# lagado/ 内の HTML で参照されていない uploads を削除（ミニマル公開用）
set -euo pipefail
cd "$(dirname "$0")/.."
LAGADO="${1:-lagado}"

python3 << PY
import re
from pathlib import Path

lagado = Path("$LAGADO")
uploads = lagado / "uploads"
if not uploads.is_dir():
    print("uploads なし — スキップ")
    raise SystemExit(0)

refs = set()
for html in lagado.rglob("*.html"):
    text = html.read_text(encoding="utf-8", errors="ignore")
    for m in re.finditer(r'/lagado/uploads/([^"\'\\s?#]+)', text):
        refs.add(m.group(1))
    for m in re.finditer(r'"/uploads/([^"\'\\s?#]+)', text):
        refs.add(m.group(1))

kept_files = 0
removed = 0
for category in list(uploads.iterdir()):
    if not category.is_dir():
        continue
    for item_dir in list(category.iterdir()):
        if not item_dir.is_dir():
            continue
        rel = f"{category.name}/{item_dir.name}"
        keep = any(r.startswith(rel + "/") for r in refs)
        if keep:
            kept_files += sum(1 for _ in item_dir.rglob("*") if _.is_file())
        else:
            import shutil
            shutil.rmtree(item_dir)
            removed += 1

print(f"参照パス: {len(refs)} 件")
print(f"削除したアイテムフォルダ: {removed}")
print(f"残った画像ファイル: {kept_files}")
PY

du -sh "$LAGADO" "$LAGADO/uploads" 2>/dev/null || true
