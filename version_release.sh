#!/bin/bash
# Automates staging, committing, tagging, and pushing for SpamWarden releases
# This script is called by version.sh after content synchronization
set -e

# 1. Load version info from tracking files
if [ ! -f "model_version.txt" ]; then
  echo "Error: model_version.txt not found. Run lazy/build first."
  exit 1
fi

# Get JS version from package.json
JS_VERSION=$(node -e "console.log(require('./package.json').version)")
MODEL_VERSION=$(cat model_version.txt)
TAG_NAME="v$JS_VERSION"

echo "========================================="
echo "  SpamWarden Git Release: $TAG_NAME"
echo "  Embedded Model: $MODEL_VERSION"
echo "========================================="

# 2. Stage updated files
echo "Staging files..."
git add package.json package-lock.json README.md docs/index.html docs/js/ model_version.txt model_features.txt

# 3. Commit
if git diff --cached --quiet; then
  echo "ℹ No changes to commit. Version files are already up to date."
else
  echo "Committing release changes..."
  git commit -m "release: $TAG_NAME (embedded model $MODEL_VERSION)"
fi

# 4. Tagging
if git rev-parse "$TAG_NAME" >/dev/null 2>&1; then
  echo "Removing existing local tag $TAG_NAME..."
  git tag -d "$TAG_NAME"
fi

echo "Creating git tag $TAG_NAME..."
git tag -a "$TAG_NAME" -m "Release $TAG_NAME (model $MODEL_VERSION)"

# 5. Push to Remote
echo "Pushing to origin main with tags..."
git push origin main --follow-tags

echo "========================================="
echo "  🎉 Release $TAG_NAME pushed successfully!"
echo "========================================="
