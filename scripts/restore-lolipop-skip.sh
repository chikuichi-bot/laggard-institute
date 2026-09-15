#!/usr/bin/env bash
# Restore any leftover .lolipop-skip-* dirs to their canonical app paths.
# Safe: never overwrites a divergent canonical tree (diff first).
#
# Usage:
#   bash scripts/restore-lolipop-skip.sh
#   bash scripts/restore-lolipop-skip.sh --quiet
set -euo pipefail
cd "$(dirname "$0")/.."

# shellcheck source=scripts/lolipop-skip-lib.sh
source "$(dirname "$0")/lolipop-skip-lib.sh"

QUIET=0
if [[ "${1:-}" == "--quiet" ]]; then
  QUIET=1
fi

if heal_lolipop_skips "$QUIET"; then
  [[ "$QUIET" == "1" ]] || echo "完了: skip 退避は正規パスへ戻った（または元々なし）"
  exit 0
fi

echo "失敗: 差分衝突がある skip があります。上の CONFLICT を解消してから再実行。" >&2
exit 1
