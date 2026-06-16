#!/bin/bash
# Bump version, rebuild, run tests, and create git tag for spam-warden
# Syncs with model version from model.json
# Usage:
#   ./version.sh          → run automated release flow (uses model version)
#   ./version.sh 1.0.4    → run automated release flow with explicit version

set -e

# Make sure we are in the repository root
cd "$(dirname "$0")"

# 1. Extract model version and features count
if [ ! -f "model.json" ]; then
  echo "Error: model.json not found."
  exit 1
fi

MODEL_VERSION=$(node -e "console.log(require('./model.json').version)")
FEATURES_COUNT=$(node -e "console.log(Object.keys(require('./model.json').vocabulary).length)")

# If version argument is provided, use it. Otherwise, use model version (removing 'v' prefix if present)
VERSION="${1:-$MODEL_VERSION}"
# Ensure VERSION does not have leading 'v' for package.json / npm version
VERSION="${VERSION#v}"

TAG_NAME="v$VERSION"

echo "========================================="
echo "  SpamWarden Automation Release Flow"
echo "  Target Version: $VERSION (Tag: $TAG_NAME)"
echo "  Model Features: $FEATURES_COUNT"
echo "========================================="

# 2. Check git status for uncommitted changes (excluding specific untracked demo/log files)
# Check for modified tracked files
if ! git diff --quiet; then
  echo "⚠️ Warning: You have uncommitted changes in your git workspace."
  echo "Please stash or commit them before running the release script."
  exit 1
fi

# 3. Update package.json and package-lock.json version
echo "Updating package.json & package-lock.json..."
npm version "$VERSION" --no-git-tag-version --allow-same-version

# 4. Update version in README.md
echo "Updating README.md..."
node -e "
const fs = require('fs');
let readme = fs.readFileSync('README.md', 'utf8');
readme = readme.replace(/- \*\*Version:\*\* \d+\.\d+\.\d+/g, '- **Version:** $VERSION');
fs.writeFileSync('README.md', readme);
"

# 5. Update version and feature count in docs/index.html
echo "Updating docs/index.html..."
node -e "
const fs = require('fs');
let html = fs.readFileSync('docs/index.html', 'utf8');
html = html.replace(/Engine: v\d+\.\d+\.\d+ \| \d+ Features/g, 'Engine: $TAG_NAME | $FEATURES_COUNT Features');
html = html.replace(/class=\"version-badge\">v\d+\.\d+\.\d+<\/span>/g, 'class=\"version-badge\">$TAG_NAME</span>');
fs.writeFileSync('docs/index.html', html);
"

# 6. Run build
echo "Running build..."
npm run build

# 7. Run test suite
echo "Running tests..."
npm test

# 8. Git Commit & Tag
echo "Staging files..."
git add package.json package-lock.json README.md docs/index.html docs/js/

# Check if there are changes to commit
if git diff --cached --quiet; then
  echo "No changes to commit. Version is already up to date."
else
  echo "Committing release changes..."
  git commit -m "release: bump version to $VERSION and align assets"
fi

# Delete tag if it already exists locally
if git rev-parse "$TAG_NAME" >/dev/null 2>&1; then
  echo "Removing existing local tag $TAG_NAME..."
  git tag -d "$TAG_NAME"
fi

echo "Creating git tag $TAG_NAME..."
git tag -a "$TAG_NAME" -m "Release $TAG_NAME (model v$MODEL_VERSION)"

echo ""
echo "========================================="
echo "  Success! Release $TAG_NAME prepared."
echo "========================================="
echo "To push the commits and the tag to GitHub, run:"
echo "  git push origin main --follow-tags"
echo "========================================="
