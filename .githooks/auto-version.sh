#!/usr/bin/env bash
set -euo pipefail

# Auto-version: analyze conventional commits since the last tag, bump the
# SemVer, write the new version into the plugin + package manifests, commit
# that change, and tag the commit. Repo and plugin versions move together.
#
# Bump rules:
#   major - any commit with "!" before ":" or BREAKING CHANGE footer
#   minor - any "feat" commit
#   patch - everything else (fix, refactor, chore, ...)
#
# When no version tag exists yet, the current manifest version is adopted as
# the baseline: it is tagged as-is, with no bump and no commit.
#
# Env:
#   BEFORE_GA_VERSIONING=1 - pre-GA mode; breaking changes are flattened to
#     minor so the version stays below 1.0.0 until general access.
#
# Usage: auto-version.sh [--dry-run]
# Outputs the new tag name on stdout (empty if nothing to do). --dry-run only
# prints the next tag; it writes nothing, commits nothing, and tags nothing.

DRY_RUN=false
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=true
fi

repo_root=$(git rev-parse --show-toplevel 2>/dev/null || echo "")
if [[ -z "$repo_root" ]]; then
  echo "not a git repository" >&2
  exit 1
fi

PLUGIN_MANIFEST="$repo_root/.claude-plugin/plugin.json"
PACKAGE_MANIFEST="$repo_root/package.json"

# Read the version field from a JSON manifest (first "version": "..." match).
read_version() {
  sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' "$1" | head -1
}

# Write a new version into a JSON manifest in place (first match only).
write_version() {
  local file="$1" ver="$2"
  [[ -f "$file" ]] || return 0
  sed -i '0,/"version": *"[^"]*"/ s//"version": "'"$ver"'"/' "$file"
}

# Only auto-version on main branch
current_branch=$(git branch --show-current 2>/dev/null || echo "")
if [[ "$current_branch" != "main" ]]; then
  exit 0
fi

# Find last version tag (vX.Y.Z pattern)
last_tag=$(git describe --tags --abbrev=0 --match 'v[0-9]*.[0-9]*.[0-9]*' 2>/dev/null || echo "")

# No tags yet: adopt the manifest version as the baseline and tag it as-is.
if [[ -z "$last_tag" ]]; then
  base_ver=$(read_version "$PLUGIN_MANIFEST")
  [[ -n "$base_ver" ]] || base_ver="0.0.1"
  new_tag="v${base_ver}"
  if [[ "$DRY_RUN" == "true" ]]; then
    echo "$new_tag"
    exit 0
  fi
  git tag -a "$new_tag" -m "Release $new_tag"
  echo "$new_tag"
  exit 0
fi

# No new commits since last tag - nothing to do
commit_count=$(git rev-list "${last_tag}..HEAD" --count)
if [[ "$commit_count" -eq 0 ]]; then
  exit 0
fi

# Collect commit subjects and bodies separately
subjects=$(git log "${last_tag}..HEAD" --pretty=format:"%s" --no-merges)
bodies=$(git log "${last_tag}..HEAD" --pretty=format:"%b" --no-merges)

# Determine bump type (highest wins)
bump="patch"

# Pre-GA mode: flatten breaking changes to minor (no major bumps before 1.0.0).
# Enable with BEFORE_GA_VERSIONING=1 in the shell env or in repo-root .env /
# .env.local (.env.local wins). Shell env always wins over .env files.
if [[ -z "${BEFORE_GA_VERSIONING:-}" ]]; then
  for env_file in "$repo_root/.env" "$repo_root/.env.local"; do
    [[ -f "$env_file" ]] || continue
    val=$(grep -E '^BEFORE_GA_VERSIONING=' "$env_file" | tail -1 | cut -d= -f2- | tr -d "\"'" || true)
    [[ -n "$val" ]] && export BEFORE_GA_VERSIONING="$val"
  done
fi

before_ga="${BEFORE_GA_VERSIONING:-0}"
breaking_bump="major"
if [[ "$before_ga" == "1" ]]; then
  breaking_bump="minor"
fi

# Breaking change: "type(scope)!:" or "type!:" in subject
if echo "$subjects" | grep -qE '^[a-z]+(\([^)]+\))?!:'; then
  bump="$breaking_bump"
# Breaking change: "BREAKING CHANGE:" or "BREAKING-CHANGE:" footer in body
elif echo "$bodies" | grep -qE '^BREAKING[ -]CHANGE:'; then
  bump="$breaking_bump"
# Feature commit
elif echo "$subjects" | grep -qE '^feat(\([^)]+\))?:'; then
  bump="minor"
fi

# Parse current version from the last tag
version="${last_tag#v}"
IFS='.' read -r major minor patch <<<"$version"

case "$bump" in
  major)
    major=$((major + 1))
    minor=0
    patch=0
    ;;
  minor)
    minor=$((minor + 1))
    patch=0
    ;;
  patch) patch=$((patch + 1)) ;;
esac

new_tag="v${major}.${minor}.${patch}"
new_ver="${major}.${minor}.${patch}"

if [[ "$DRY_RUN" == "true" ]]; then
  echo "$new_tag"
  exit 0
fi

# Write the new version into the manifests, commit, and tag that commit so the
# repo tag and the plugin manifest always agree.
write_version "$PLUGIN_MANIFEST" "$new_ver"
write_version "$PACKAGE_MANIFEST" "$new_ver"
git add "$PLUGIN_MANIFEST" "$PACKAGE_MANIFEST"
git commit -m "chore(release): ${new_tag}"
git tag -a "$new_tag" -m "Release $new_tag"
echo "$new_tag"
