#!/usr/bin/env bash
# Shared helpers for .lolipop-skip-* ↔ canonical app path restore.
# Sourced by build-lolipop.sh and restore-lolipop-skip.sh.
# Never rm -rf a divergent canonical path.

path_to_skip_key() {
  echo "$1" | tr '/[]' '___'
}

skip_dir_for_path() {
  echo ".lolipop-skip-$(path_to_skip_key "$1")"
}

# All paths that build-lolipop.sh may move (any mode) + known orphans.
LOLIPOP_KNOWN_SKIP_PATHS=(
  "app/api"
  "app/admin"
  "app/antiques"
  "app/city"
  "app/sea"
  "app/apps"
  "app/amappola"
  "app/antiques/[id]/purchase"
  "app/antiques/[id]/inquiry"
  "app/amappola/purchase/success"
)

# Legacy skip dir names (suffix after .lolipop-skip-) → canonical path
# Older builds used non-encoded names for some routes.
LOLIPOP_LEGACY_SKIP_KEYS=(
  "amappola-purchase-success:app/amappola/purchase/success"
)

dirs_identical() {
  local a="$1"
  local b="$2"
  diff -rq "$a" "$b" >/dev/null 2>&1
}

# Safe restore: skip_dir → path. Returns 0 on success, 1 on conflict/error.
# Never deletes a non-identical canonical path.
safe_restore_skip() {
  local skip_dir="$1"
  local path="$2"
  local quiet="${3:-0}"

  if [[ ! -d "$skip_dir" ]]; then
    return 0
  fi

  if [[ ! -e "$path" ]]; then
    mkdir -p "$(dirname "$path")"
    mv "$skip_dir" "$path"
    [[ "$quiet" == "1" ]] || echo "  ✓ restored $skip_dir → $path"
    return 0
  fi

  if [[ -d "$path" ]] && dirs_identical "$skip_dir" "$path"; then
    rm -rf "$skip_dir"
    [[ "$quiet" == "1" ]] || echo "  ✓ identical; removed leftover $skip_dir"
    return 0
  fi

  echo "  ✗ CONFLICT: both exist and differ:" >&2
  echo "      skip: $skip_dir" >&2
  echo "      path: $path" >&2
  echo "    Compare with: diff -rq \"$skip_dir\" \"$path\"" >&2
  echo "    Refusing destructive overwrite." >&2
  return 1
}

# Restore every known / legacy skip leftover whose canonical path is missing
# or identical. Aborts (return 1) on content conflict.
heal_lolipop_skips() {
  local quiet="${1:-0}"
  local failed=0
  local path skip_dir key legacy

  [[ "$quiet" == "1" ]] || echo "→ Lolipop skip ヘルスチェック（未復元の退避を安全に戻す）"

  for path in "${LOLIPOP_KNOWN_SKIP_PATHS[@]}"; do
    skip_dir="$(skip_dir_for_path "$path")"
    if [[ -d "$skip_dir" ]]; then
      safe_restore_skip "$skip_dir" "$path" "$quiet" || failed=1
    fi
  done

  for legacy in "${LOLIPOP_LEGACY_SKIP_KEYS[@]}"; do
    key="${legacy%%:*}"
    path="${legacy#*:}"
    skip_dir=".lolipop-skip-$key"
    if [[ -d "$skip_dir" ]]; then
      # Prefer encoded name if both somehow exist — heal encoded first above.
      safe_restore_skip "$skip_dir" "$path" "$quiet" || failed=1
    fi
  done

  # Any remaining .lolipop-skip-* that we do not recognize
  local leftover
  for leftover in .lolipop-skip-*; do
    [[ -d "$leftover" ]] || continue
    echo "  ⚠ unrecognized skip leftover: $leftover (not auto-restored)" >&2
  done

  return "$failed"
}

# Before moving path → skip for export: ensure no orphaned skip would be clobbered.
prepare_skip_move() {
  local path="$1"
  local skip_dir
  skip_dir="$(skip_dir_for_path "$path")"

  if [[ -d "$skip_dir" && ! -e "$path" ]]; then
    safe_restore_skip "$skip_dir" "$path" 0 || return 1
  fi

  if [[ -d "$skip_dir" && -e "$path" ]]; then
    if dirs_identical "$skip_dir" "$path"; then
      rm -rf "$skip_dir"
    else
      echo "✗ Cannot stash $path: leftover $skip_dir differs from canonical path" >&2
      echo "  Resolve with: diff -rq \"$skip_dir\" \"$path\"" >&2
      return 1
    fi
  fi
  return 0
}

# Move canonical path aside for static export (only if it exists).
stash_path_for_export() {
  local path="$1"
  local skip_dir
  skip_dir="$(skip_dir_for_path "$path")"

  prepare_skip_move "$path" || return 1

  if [[ -d "$path" ]]; then
    mv "$path" "$skip_dir"
  fi
  return 0
}

# Restore paths listed in SKIP_MOVE after export (trap-safe).
restore_skip_list() {
  local path skip_dir
  local failed=0
  for path in "$@"; do
    skip_dir="$(skip_dir_for_path "$path")"
    if [[ -d "$skip_dir" ]]; then
      safe_restore_skip "$skip_dir" "$path" 0 || failed=1
    fi
  done
  return "$failed"
}
