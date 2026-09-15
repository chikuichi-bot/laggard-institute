#!/usr/bin/env bash
# App icon quality gate for /apps (proposal 3).
# Flags: leftover .bak-old backups, and tracked icons that shrank sharply vs HEAD.
# Does NOT rewrite images - review only. Exit 1 when issues found.
#
# Usage:
#   bash scripts/check-app-icons.sh
#   npm run check:app-icons
set -euo pipefail
cd "$(dirname "$0")/.."

ICON_DIR="public/icons"
# Fail if working-tree size is below this fraction of HEAD (e.g. 0.6 = 40% drop).
SHRINK_RATIO="${ICON_SHRINK_RATIO:-0.6}"
ISSUES=0

echo "-> app icon quality gate [${ICON_DIR}]"

if [[ ! -d "${ICON_DIR}" ]]; then
  echo "  (${ICON_DIR} missing - skip)"
  exit 0
fi

shopt -s nullglob
bak_files=("${ICON_DIR}"/*.bak-old "${ICON_DIR}"/*.bak "${ICON_DIR}"/*~)
if ((${#bak_files[@]} > 0)); then
  for f in "${bak_files[@]}"; do
    echo "  x backup leftover: $f"
    ISSUES=1
  done
fi

for png in "${ICON_DIR}"/*.png; do
  [[ -f "$png" ]] || continue
  rel="${png#./}"
  if ! git cat-file -e "HEAD:$rel" 2>/dev/null; then
    # New untracked icon - size gate N/A vs HEAD
    continue
  fi
  head_bytes="$(git cat-file -s "HEAD:$rel")"
  work_bytes="$(wc -c < "$png" | tr -d ' ')"
  if [[ "$head_bytes" -le 0 ]]; then
    continue
  fi
  threshold="$(awk -v h="$head_bytes" -v r="$SHRINK_RATIO" 'BEGIN { printf "%d", h * r }')"
  if [[ "$work_bytes" -lt "$threshold" ]]; then
    pct="$(awk -v w="$work_bytes" -v h="$head_bytes" 'BEGIN { printf "%.0f", (w/h)*100 }')"
    echo "  x sharp size drop: $rel  (${work_bytes} <- HEAD ${head_bytes} · ${pct}% · threshold ${SHRINK_RATIO})"
    echo "      possible over-compression. Review visually; do not auto-revert without user OK."
    ISSUES=1
  fi
done

if [[ "$ISSUES" -ne 0 ]]; then
  echo ""
  echo "App icon quality gate FAILED. Review before commit / upload:apps."
  echo "(This script does not rewrite images.)"
  exit 1
fi

echo "  OK (no .bak-old, no sharp size drop vs HEAD)"
exit 0
