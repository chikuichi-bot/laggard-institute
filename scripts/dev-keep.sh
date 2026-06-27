#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

if lsof -i :3000 -sTCP:LISTEN -t >/dev/null 2>&1; then
  echo "開発サーバーはすでに起動しています (http://localhost:3000)"
  exit 0
fi

nohup npm run dev >> .dev-server.log 2>&1 &
echo $! > .dev-server.pid
echo "開発サーバーを起動しました (PID $(cat .dev-server.pid))"
echo "  Mac:     http://localhost:3000"
echo "  iPhone:  http://192.168.0.10:3000"
echo "  ログ:    .dev-server.log"
