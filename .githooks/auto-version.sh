#!/usr/bin/env bash
set -euo pipefail

# Auto-version: analyze conventional commits since last tag and bump accordingly.
# Bump rules:
#   major - any commit with "!" before ":" or BREAKING CHANGE footer
#   minor - any "feat" commit
#   patch - everything else (fix, refactor, chore, ...)
# First version: v0.0.1 (when no tags exist yet).
#
# Env:
#   BEFORE_GA_VERSIONING=1 - pre-GA mode; breaking changes are flattened to
#     minor so the version stays below 1.0.0 until general access.
#
# Usage: auto-version.sh [--dry-run]
# Outputs the new tag name on stdout (empty if nothing to do).

DRY_RUN=false
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=true
fi

# Only auto-version on main branch
current_branch=$(git branch --show-current 2>/dev/null || echo "")
if [[ "$current_branch" != "main" ]]; then
  exit 0
fi

# Find last version tag (vX.Y.Z pattern)
last_tag=$(git describe --tags --abbrev=0 --match 'v[0-9]*.[0-9]*.[0-9]*' 2>/dev/null || echo "")

if [[ -z "$last_tag" ]]; then
  new_tag="v0.0.1"
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
  repo_root=$(git rev-parse --show-toplevel 2>/dev/null || echo "")
  if [[ -n "$repo_root" ]]; then
    for env_file in "$repo_root/.env" "$repo_root/.env.local"; do
      [[ -f "$env_file" ]] || continue
      val=$(grep -E '^BEFORE_GA_VERSIONING=' "$env_file" | tail -1 | cut -d= -f2- | tr -d "\"'" || true)
      [[ -n "$val" ]] && export BEFORE_GA_VERSIONING="$val"
    done
  fi
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

# Parse current version
version="${last_tag#v}"
IFS='.' read -r major minor patch <<< "$version"

case "$bump" in
  major) major=$((major + 1)); minor=0; patch=0 ;;
  minor) minor=$((minor + 1)); patch=0 ;;
  patch) patch=$((patch + 1)) ;;
esac

new_tag="v${major}.${minor}.${patch}"

if [[ "$DRY_RUN" == "true" ]]; then
  echo "$new_tag"
  exit 0
fi

git tag -a "$new_tag" -m "Release $new_tag"
echo "$new_tag"
