#!/usr/bin/env bash
# Usage: ./scripts/bump-version.sh [patch|minor|major]
# Bumps the version across all Pulse manifest files and prints the new version.

set -euo pipefail

BUMP="${1:-patch}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

FILES=(
  "$ROOT/plugins/pulse/.claude-plugin/plugin.json"
  "$ROOT/plugins/pulse/.codex-plugin/plugin.json"
  "$ROOT/.agents/plugins/marketplace.json"
)

# Read current version from first file
CURRENT=$(grep '"version"' "${FILES[0]}" | head -1 | sed 's/.*"\([0-9]*\.[0-9]*\.[0-9]*\)".*/\1/')

if [[ -z "$CURRENT" ]]; then
  echo "Error: could not read current version from ${FILES[0]}" >&2
  exit 1
fi

IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT"

case "$BUMP" in
  patch) PATCH=$((PATCH + 1)) ;;
  minor) MINOR=$((MINOR + 1)); PATCH=0 ;;
  major) MAJOR=$((MAJOR + 1)); MINOR=0; PATCH=0 ;;
  *)
    echo "Usage: $0 [patch|minor|major]" >&2
    exit 1
    ;;
esac

NEW="$MAJOR.$MINOR.$PATCH"

for FILE in "${FILES[@]}"; do
  if [[ ! -f "$FILE" ]]; then
    echo "Warning: $FILE not found, skipping" >&2
    continue
  fi
  sed -i '' "s/\"version\": \"$CURRENT\"/\"version\": \"$NEW\"/" "$FILE"
  echo "  updated: $FILE"
done

echo ""
echo "$CURRENT → $NEW"
