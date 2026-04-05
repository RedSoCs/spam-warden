#!/bin/bash
# Bump version and create git tag for spam-warden
# Syncs with model version from model.json
# Usage:
#   ./version.sh          → show current version
#   ./version.sh v0.70    → set explicit version (must match model)

set -e
cd "$(dirname "$0")"

if [ ! -f "model.json" ]; then
  echo "Error: model.json not found. Run: cp ../spam-labeler/extension/model.json ."
  exit 1
fi

# Extract model version
MODEL_VERSION=$(node -e "console.log(require('./model.json').version)")
TAG_NAME="$MODEL_VERSION"

if [ $# -eq 0 ]; then
  CURRENT_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "none")
  echo "Current tag:  $CURRENT_TAG"
  echo "Model version: $MODEL_VERSION"
  echo ""
  echo "Usage:"
  echo "  ./version.sh          → show current version"
  echo "  ./version.sh v0.70    → create tag for specific version"
  exit 0
fi

TAG_NAME="$1"

# Ensure it starts with 'v'
if [[ "$TAG_NAME" != v* ]]; then
  TAG_NAME="v$TAG_NAME"
fi

# Create git tag
git tag -a "$TAG_NAME" -m "Release $TAG_NAME (model from spam-labeler)"

echo ""
echo "Created tag: $TAG_NAME"
echo ""
echo "Push with: git push origin main --tags"
