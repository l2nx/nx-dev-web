#!/usr/bin/env bash
# Usage: scripts/check-denylist.sh <file-or-dir>...
# Env: DOCS_DENYLIST (newline-separated ERE patterns of internal names that must never reach the public portal).
# Exit 0: clean. Exit 1: a match (file:line printed) or a broken guard.
set -euo pipefail

fail() {
  echo "::error::$*"
  exit 1
}

[ "$#" -gt 0 ] || fail "usage: scripts/check-denylist.sh <file-or-dir>..."
[ -n "${DOCS_DENYLIST:-}" ] || fail "DOCS_DENYLIST is empty or unset: the denylist guard cannot be skipped"

patterns_file=$(mktemp)
trap 'rm -f "$patterns_file"' EXIT
printf '%s\n' "$DOCS_DENYLIST" | tr -d '\r' | sed 's/^[[:space:]]*//; s/[[:space:]]*$//' | grep -v '^$' \
  >"$patterns_file" || true
[ -s "$patterns_file" ] || fail "DOCS_DENYLIST has no patterns"

# Only file:line or a count is printed: the matched text or a pattern would leak into public Actions logs.
rc=0
hit_files=$(grep -rlIiE -f "$patterns_file" -- "$@") || rc=$?
[ "$rc" -le 1 ] || fail "denylist grep failed (invalid pattern?)"
# File names become public URL slugs, so they pass the same denylist.
hit_names=$(find "$@" -type f | grep -ciE -f "$patterns_file" || true)
[ "$hit_names" -eq 0 ] || fail "denylist match in $hit_names file name(s)"
if [ -n "$hit_files" ]; then
  while IFS= read -r file; do
    grep -nIiE -f "$patterns_file" -- "$file" | cut -d: -f1 | while IFS= read -r line; do
      echo "::error file=${file},line=${line}::internal name in public portal content"
    done
  done <<<"$hit_files"
  exit 1
fi
