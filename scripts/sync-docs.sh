#!/usr/bin/env bash
# Usage: scripts/sync-docs.sh <section> <source-repo-dir> <version>
# Env: DOCS_DENYLIST (newline-separated ERE patterns), NPM_TOKEN (private @l2nx packages for the portal build).
set -euo pipefail

die() {
  echo "::error::$*"
  exit 1
}

[ "$#" -eq 3 ] || die "usage: scripts/sync-docs.sh <section> <source-repo-dir> <version>"
section=$1
version=$3
[ -n "$version" ] || die "version is required"
[ -d "$2" ] || die "source repo dir not found: $2"
source_dir=$(cd "$2" && pwd)

# Paths relative to the section root that the portal owns; the source must not ship them.
case "$section" in
  adapter) excludes=(changelog.mdx) ;;
  top) excludes=() ;;
  l2) excludes=() ;;
  *) die "unknown docs section: $section" ;;
esac

[ -n "${DOCS_DENYLIST:-}" ] || die "DOCS_DENYLIST is empty or unset: the denylist guard cannot be skipped"
[ -n "${NPM_TOKEN:-}" ] || die "NPM_TOKEN is empty or unset: the portal build needs the private @l2nx packages"

cd "$(dirname "${BASH_SOURCE[0]}")/.."

src_en=$source_dir/docs/public/en
src_ru=$source_dir/docs/public/ru
dst_en=src/content/docs/$section
dst_ru=src/content/docs/ru/$section
[ -d "$src_en" ] || die "missing $src_en"
[ -d "$src_ru" ] || die "missing $src_ru"

patterns_file=
npmrc_file=
check_image=
cleanup() {
  [ -z "$patterns_file" ] || rm -f "$patterns_file"
  [ -z "$npmrc_file" ] || rm -f "$npmrc_file"
  [ -z "$check_image" ] || docker image rm -f "$check_image" >/dev/null 2>&1 || true
}
trap cleanup EXIT

patterns_file=$(mktemp)
# Patterns pasted into the secrets UI often carry stray spaces; a trailing one would make a pattern miss.
printf '%s\n' "$DOCS_DENYLIST" | tr -d '\r' | sed 's/^[[:space:]]*//; s/[[:space:]]*$//' | grep -v '^$' \
  >"$patterns_file" || true
[ -s "$patterns_file" ] || die "DOCS_DENYLIST has no patterns"

# The runner is itself a container, so the build check uses the BuildKit secret instead of bind-mounting the tree.
npmrc_file=$(mktemp)
printf '@l2nx:registry=https://npm.pkg.github.com\n//npm.pkg.github.com/:_authToken=%s\n' "$NPM_TOKEN" >"$npmrc_file"

git config user.name "ci${GITHUB_REPOSITORY:+-$GITHUB_REPOSITORY}"
git config user.email ci@l2nx.invalid

src_sha=$(git -C "$source_dir" rev-parse HEAD)
sha_file=.docs-sources/$section

# Skips only a strictly older source (rollback, old tag); a source on another line (hotfix off main) is synced.
guard() {
  [ -f "$sha_file" ] || return 0
  local old_sha
  old_sha=$(<"$sha_file")
  [ "$old_sha" != "$src_sha" ] || return 0
  if ! git -C "$source_dir" cat-file -e "$old_sha^{commit}" 2>/dev/null; then
    # A re-pushed tag or a deleted branch leaves it unreachable; the release at hand is the newest one we know of.
    echo "::warning::last synced $old_sha is unknown to the source; syncing without the regress guard"
    return 0
  fi
  if git -C "$source_dir" merge-base --is-ancestor "$src_sha" "$old_sha"; then
    echo "::notice::skip: older source ($src_sha is an ancestor of the last synced $old_sha)"
    exit 0
  fi
}

is_excluded() {
  local rel=$1 ex
  for ex in "${excludes[@]}"; do
    [ "$rel" = "$ex" ] && return 0
  done
  return 1
}

mirror() {
  local src=$1 dst=$2 rel ex
  for ex in "${excludes[@]}"; do
    [ ! -e "$src/$ex" ] || die "$src/$ex is owned by the portal and must not be in the source"
  done
  mkdir -p "$dst"
  while IFS= read -r -d '' rel; do
    rel=${rel#./}
    is_excluded "$rel" || rm -f "$dst/$rel"
  done < <(cd "$dst" && find . -mindepth 1 ! -type d -print0)
  cp -R "$src/." "$dst/"
  find "$dst" -mindepth 1 -type d -empty -delete
}

# Only file:line or a count is printed: the matched text, a file name or a pattern would leak into public Actions logs.
denylist() {
  local rc=0 hit_files hit_names file
  hit_files=$(grep -rlIiE -f "$patterns_file" -- "$dst_en" "$dst_ru") || rc=$?
  [ "$rc" -le 1 ] || die "denylist grep failed (invalid pattern?)"
  # File names become public URL slugs, so they pass the same denylist.
  hit_names=$(find "$dst_en" "$dst_ru" -type f | grep -ciE -f "$patterns_file" || true)
  [ "$hit_names" -eq 0 ] || die "denylist match in $hit_names file name(s) of synced $section docs; rename them in the source repo"
  if [ -n "$hit_files" ]; then
    while IFS= read -r file; do
      grep -nIiE -f "$patterns_file" -- "$file" | cut -d: -f1 | while IFS= read -r line; do echo "$file:$line"; done
    done <<<"$hit_files"
    die "denylist match in synced $section docs; fix the pages in the source repo"
  fi
}

# Each attempt restarts from the current main and re-runs the guard: parallel syncs of one section serialize here,
# not through a concurrency group (it would cancel a pending run).
for i in 1 2 3 4 5; do
  git fetch -q origin main
  git reset -q --hard origin/main
  git clean -fdq -- src/content/docs .docs-sources
  guard
  mirror "$src_en" "$dst_en"
  mirror "$src_ru" "$dst_ru"
  denylist
  if [ -f "$sha_file" ] && [ -z "$(git status --porcelain -- "$dst_en" "$dst_ru")" ]; then
    # No sha-only commit (it would redeploy the portal); the first sync records the sha anyway, or the guard stays off.
    echo "::notice::docs of $section unchanged"
    exit 0
  fi
  check_image=dev-web-docs-check:$(date +%s)-$$-$RANDOM
  DOCKER_BUILDKIT=1 docker build --secret id=npmrc,src="$npmrc_file" --target builder -t "$check_image" . ||
    die "portal build failed with the synced $section docs"
  docker image rm -f "$check_image" >/dev/null 2>&1 || true
  check_image=
  mkdir -p .docs-sources
  echo "$src_sha" >"$sha_file"
  git add -A -- "$dst_en" "$dst_ru" "$sha_file"
  git commit -q -m "docs($section): sync $version"
  git push -q origin HEAD:main && exit 0
  echo "push attempt $i failed, retrying from the current main"
  sleep $((RANDOM % 10 + 5))
done
die "push of $section docs failed after 5 attempts"
