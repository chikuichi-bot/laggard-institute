#!/usr/bin/env bash
# 見知らぬ駅の降り方 → さくら www/mishiranu-orikata/
# 秘密: .lolipop-private-auth/sakura-ftp.env （Git 外）
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/.lolipop-private-auth/sakura-ftp.env"
LOCAL="$ROOT/mishiranu-app/sakura/orikata"
REMOTE_DIR="mishiranu-orikata"
PUBLIC_URL="https://lagado.jp/mishiranu-orikata/"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "無いです: $ENV_FILE"
  echo "テンプレを作って SAKURA_FTP_PASS= にサーバパスワードを書いてください。"
  exit 1
fi

# shellcheck disable=SC1090
set -a
source "$ENV_FILE"
set +a

: "${SAKURA_FTP_HOST:?}"
: "${SAKURA_FTP_USER:?}"
: "${SAKURA_FTP_PASS:?SAKURA_FTP_PASS が空です。サーバパスワードを書いてください。}"
SAKURA_FTP_PORT="${SAKURA_FTP_PORT:-21}"
SAKURA_FTP_TLS="${SAKURA_FTP_TLS:-1}"

if [[ ! -f "$LOCAL/index.html" ]]; then
  echo "無いです: $LOCAL/index.html"
  exit 1
fi

python3 - "$LOCAL" "$REMOTE_DIR" <<'PY'
from __future__ import annotations
import os, ssl, sys
from pathlib import Path
from ftplib import FTP, FTP_TLS, error_perm

local = Path(sys.argv[1])
remote_name = sys.argv[2]
host = os.environ["SAKURA_FTP_HOST"]
user = os.environ["SAKURA_FTP_USER"]
passwd = os.environ["SAKURA_FTP_PASS"]
port = int(os.environ.get("SAKURA_FTP_PORT", "21"))
use_tls = os.environ.get("SAKURA_FTP_TLS", "1") != "0"

if use_tls:
    ctx = ssl.create_default_context()
    ftp: FTP = FTP_TLS(context=ctx)
else:
    ftp = FTP()

ftp.connect(host, port, timeout=60)
ftp.login(user, passwd)
if use_tls and isinstance(ftp, FTP_TLS):
    try:
        ftp.prot_p()
    except Exception:
        pass
ftp.set_pasv(True)

# cwd to www (sakura home often lands in /home/user)
for candidate in ("www", "/home/%s/www" % user, "."):
    try:
        ftp.cwd(candidate)
        break
    except error_perm:
        continue

def ensure(name: str) -> None:
    try:
        ftp.mkd(name)
    except error_perm:
        pass
    ftp.cwd(name)

ensure(remote_name)
ensure("story")
ftp.cwd("..")  # back to mishiranu-orikata

uploads = [("index.html", "index.html"), ("orikata.css", "orikata.css")]
for p in sorted((local / "story").iterdir()):
    if p.is_file():
        uploads.append((f"story/{p.name}", f"story/{p.name}"))

for rel, rpath in uploads:
    with open(local / rel, "rb") as f:
        ftp.storbinary(f"STOR {rpath}", f)
    print("uploaded", rel)

ftp.quit()
print("OK")
PY

echo ""
echo "公開URL: $PUBLIC_URL"
code="$(curl -s -o /dev/null -w '%{http_code}' "$PUBLIC_URL" || true)"
echo "HTTP $code"
if [[ "$code" != "200" ]]; then
  echo "まだ 200 ではありません。数秒待って再確認するか、パスを見てください。"
  exit 2
fi
