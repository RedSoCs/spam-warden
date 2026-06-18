#!/bin/bash
# Option 1: Parallel Versioning
# Bumps JS library version, aligns documentation with model version, and triggers release.
# Usage:
#   ./version.sh          → auto-bump JS patch version (e.g. 1.1.1 -> 1.1.2)
#   ./version.sh 1.2.0    → explicit JS version
set -e

# Make sure we are in the repository root
cd "$(dirname "$0")"

# 1. Load versions
if [ ! -f "model_version.txt" ]; then
  echo "Error: model_version.txt not found. Run lazy/build first."
  exit 1
fi
MODEL_VERSION=$(cat model_version.txt)
FEATURES_COUNT=$(cat model_features.txt || echo "unknown")

# Determine new JS version
if [ -z "$1" ]; then
  # Auto-bump patch version using npm
  CURRENT_JS=$(node -e "console.log(require('./package.json').version)")
  echo "Current JS Version: $CURRENT_JS"
  NEW_JS=$(npm version patch --no-git-tag-version)
  # Strip leading 'v' if npm version adds it
  NEW_JS="${NEW_JS#v}"
else
  NEW_JS="$1"
  # Strip leading 'v' for package.json alignment
  NEW_JS="${NEW_JS#v}"
  npm version "$NEW_JS" --no-git-tag-version --allow-same-version
fi

TAG_NAME="v$NEW_JS"

echo "========================================="
echo "  SpamWarden Version Synchronization"
echo "  JS Library: v$NEW_JS"
echo "  Model Engine: $MODEL_VERSION"
echo "  Model Features: $FEATURES_COUNT"
echo "========================================="

# 2. Check git status
if ! git diff --quiet; then
  echo "⚠️ Warning: You have uncommitted changes in your git workspace."
  echo "Please stash or commit them before running the release script."
  exit 1
fi

# 3. Update README.md (Parallel display)
echo "Updating README.md..."
node -e "
const fs = require('fs');
let readme = fs.readFileSync('README.md', 'utf8');
// Update JS Version line
readme = readme.replace(/- \*\*Version:\*\* .*/g, '- **Version:** $NEW_JS (Engine $MODEL_VERSION)');
// Update Vocabulary line in technical specs
readme = readme.replace(/\| \*\*Vocabulary\*\*    \| \d+,?\d* features/g, '| **Vocabulary**    | $FEATURES_COUNT features');
fs.writeFileSync('README.md', readme);
"

# 4. Update docs/index.html (Parallel display)
echo "Updating docs/index.html..."
node -e "
const fs = require('fs');
let html = fs.readFileSync('docs/index.html', 'utf8');
// Update Engine info badge
html = html.replace(/Engine: v\d+\.\d+(\.\d+)? \| \d+ Features/g, 'Engine: $MODEL_VERSION | $FEATURES_COUNT Features');
// Update Footer version
html = html.replace(/class=\"version-badge\">v\d+\.\d+(\.\d+)?<\/span>/g, 'class=\"version-badge\">$TAG_NAME</span>');
fs.writeFileSync('docs/index.html', html);
"

# 5. Run build
if [ -f "model.json" ]; then
  echo "Running build..."
  npm run build
else
  echo "ℹ Skipping build (model.json not found). Assuming dist/ is already updated."
fi

# 6. Run test suite
echo "Running tests..."
npm test

# 7. Trigger Git Release
chmod +x ./version_release.sh
./version_release.sh
