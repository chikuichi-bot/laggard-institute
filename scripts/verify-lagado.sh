#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

LAGADO="${1:-lagado}"

if [[ ! -d "$LAGADO" ]]; then
  echo "エラー: $LAGADO がありません。先に npm run build:lolipop を実行してください。"
  exit 1
fi

python3 << PY
import json
from pathlib import Path

lagado = Path("$LAGADO")
with open("data/sea.json") as f:
    sea = json.load(f)

missing = []
wakasa = []
for item in sea:
    is_wakasa = "若狭" in (item.get("location") or "") or "wakasa" in item["id"]
    for img in item.get("images", []):
        rel = img.lstrip("/")
        path = lagado / rel
        if not path.exists():
            missing.append((item["id"], str(path)))
        elif is_wakasa:
            wakasa.append((item["id"], f"/lagado/{rel}"))

print(f"lagado サイズ: ", end="")
PY

du -sh "$LAGADO" "$LAGADO/uploads" "$LAGADO/uploads/sea" 2>/dev/null || true

python3 << 'PY'
import json
from pathlib import Path

lagado = Path("lagado")
with open("data/sea.json") as f:
    sea = json.load(f)

missing = []
wakasa_urls = []
for item in sea:
    is_wakasa = "若狭" in (item.get("location") or "") or "wakasa" in item["id"]
    for img in item.get("images", []):
        rel = img.lstrip("/")
        path = lagado / rel
        if not path.exists():
            missing.append((item["id"], rel))
        elif is_wakasa:
            wakasa_urls.append(f"/lagado/{rel}")

sea_dirs = len(list((lagado / "uploads/sea").iterdir())) if (lagado / "uploads/sea").exists() else 0
print(f"\nsea.json: {len(sea)} 件 / lagado/uploads/sea/: {sea_dirs} フォルダ")
print(f"欠けている画像: {len(missing)} 件")

if missing:
    print("\n--- 欠損一覧（先頭20件）---")
    for item_id, rel in missing[:20]:
        print(f"  {item_id} → {rel}")
    if len(missing) > 20:
        print(f"  ... 他 {len(missing) - 20} 件")

check_file = lagado / "upload-check.html"
lines = [
    "<!DOCTYPE html>",
    '<html lang="ja"><head><meta charset="utf-8">',
    "<title>lagado 画像チェック</title>",
    "<style>body{font-family:sans-serif;max-width:720px;margin:2rem auto}",
    "img{max-width:120px;vertical-align:middle;margin:4px}",
    ".ok{color:green}.ng{color:red}</style></head><body>",
    "<h1>若狭湾 漂着物 — 画像チェック</h1>",
    "<p>アップロード後、このページを開いてください。<br>",
    "<code>https://（ドメイン）/lagado/upload-check.html</code></p>",
    "<ul>",
]
for item in sea:
    if "wakasa" not in item["id"] or item["id"] == "sea-wakasa-bay-stone":
        continue
    for img in item.get("images", []):
        url = f"/lagado/{img.lstrip('/')}"
        lines.append(
            f'<li data-src="{url}"><img src="{url}" alt=""> '
            f'<span class="status">読込中…</span> <code>{url}</code></li>'
        )
lines += [
    "</ul>",
    "<script>",
    "document.querySelectorAll('li[data-src]').forEach(li=>{",
    "  const img=li.querySelector('img'), s=li.querySelector('.status');",
    "  const ok=()=>{s.textContent='OK';s.className='status ok';};",
    "  const ng=()=>{s.textContent='NG（404）';s.className='status ng';};",
    "  if(img.complete&&img.naturalWidth) ok();",
    "  else { img.onload=ok; img.onerror=ng; }",
    "});",
    "</script></body></html>",
]
check_file.write_text("\n".join(lines) + "\n", encoding="utf-8")
print(f"\n診断ページ: {check_file}")
print("若狭湾のテスト URL（ブラウザで直接開く）:")
for url in wakasa_urls[:3]:
    print(f"  https://（ドメイン）{url}")
PY
