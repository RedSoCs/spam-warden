# SpamWarden.js

Lightweight, client-side JavaScript library for detecting spam and sentence hijacking in real-time. Trained on the model from [RedSocs/spam-labeler](https://github.com/RedSocs/spam-labeler), bundled for zero-dependency browser usage.

[![CI](https://github.com/RedSocs/spam-warden/actions/workflows/ci.yml/badge.svg)](https://github.com/RedSocs/spam-warden/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/%40_redsocs%2Fspam-warden.svg)](https://www.npmjs.com/package/@_redsocs/spam-warden)
[![Version](https://img.shields.io/github/v/tag/RedSocs/spam-warden?label=version&color=blue)](https://github.com/RedSocs/spam-warden/releases)

## Quick Start

### Install

```bash
# npm
npm install @_redsocs/spam-warden

# Or download from CDN / GitHub releases
```

### In the Browser

```html
<!-- Option 1: From RedSocs CDN -->
<script src="https://redsocs.com/js/spam-warden.js"></script>

<!-- Option 2: Self-hosted -->
<script src="dist/spamwarden.min.js"></script>

<script>
  const result = window.spamwarden.spamcheck("สมัครสมาชิกวันนี้ รับโบนัส ฟรี!");
  console.log(result.isSpam);   // true
  console.log(result.prob);     // 1.0
  console.log(result.version);  // "v0.68"
</script>
```

### As ES Module

```js
import SpamWarden from './dist/spamwarden.min.js';
SpamWarden.spamcheck("Welcome bonus! Deposit now");
```

### Quick Boolean Check

```js
if (spamwarden.isSpam(userInput)) {
  // block or flag
}
```

### In Node.js

```js
const spamwarden = require("./dist/spamwarden.min.js");
const r = spamwarden.spamcheck("Welcome bonus! Deposit now get 200% match");
console.log(r.isSpam); // true
```

## API

### `spamwarden.spamcheck(text) → object`

| Field | Type | Description |
|-------|------|-------------|
| `isSpam` | `boolean` | `true` if detected as spam |
| `prob` | `number` | Spam probability (0.0–1.0) |
| `reason` | `string?` | Present if hard-rule triggered: `"currency_symbol"` or `"spam_link"` |
| `version` | `string` | Model version (e.g., `"v0.68"`) |

### `spamwarden.isSpam(text) → boolean`

Convenience wrapper — returns only the boolean result.

### `spamwarden.version → string`

Current model version string.

## Build

```bash
# 1. Copy model from spam-labeler
cp ../spam-labeler/extension/model.json .

# 2. Build (bundles model into JS)
node build.js
# or: ./build.sh
```

Output:

| File | Size |
|------|------|
| `dist/spamwarden.js` | 3.5 MB (uncompressed) |
| `dist/spamwarden.min.js` | 61 KB (minified) |
| `dist/spamwarden.min.js` (gzipped) | **27 KB** |

### Optional: Better Minification

```bash
npm install terser
node build.js   # now uses terser instead of simple minification
```

## How It Works

```
User posts text
    ↓
spamwarden.spamcheck(text)
    ↓
Hard rules check (currency symbols, spam links)
    ↓
Vectorizer: whitespace tokens + trigrams + quadgrams
    ↓
Bernoulli Naive Bayes prediction (class 0 = safe, 1 = spam)
    ↓
Softmax → probability
    ↓
{ isSpam, prob, version }
```

### Model

| Property | Value |
|----------|-------|
| **Origin** | [RedSocs/spam-labeler](https://github.com/RedSocs/spam-labeler) (Rust, Bernoulli NB) |
| **Features** | ~63,000 tokens (whitespace + trigrams + quadgrams) |
| **Version** | v0.68 (680 training samples) |
| **Hard Rules** | Currency symbols (`$€£฿`) → auto-spam; Spam links (`line.me`, `@line`, `lin.ee`) → auto-spam |

### Train Your Own Model

The model in this repo was trained by [RedSocs/spam-labeler](https://github.com/RedSocs/spam-labeler). To customize for your own use case:

```bash
# 1. Clone the training repo
git clone https://github.com/RedSocs/spam-labeler.git

# 2. Add your own training data
cp your-spam.txt spam-labeler/data/spam.txt
cp your-safe.txt spam-labeler/data/safe.txt

# 3. Retrain and export
cd spam-labeler
cargo run --release --bin export_model
cp extension/model.json ../spam-warden/model.json

# 4. Rebuild SpamWarden
cd ../spam-warden
node build.js
```

See the [spam-labeler README](https://github.com/RedSocs/spam-labeler) for the full training pipeline.

## Privacy

All processing happens **in-memory in the browser**. No data is sent to any server.

## Related

- [**RedSocs/spam-labeler**](https://github.com/RedSocs/spam-labeler) — Rust-based training pipeline, TUI app, and Firefox extension for collecting and training the spam detection model.

## Project Structure

```
spam-warden/
├── src/
│   └── spamwarden.js    # Library source (MODEL_DATA_PLACEHOLDER)
├── dist/
│   ├── spamwarden.js    # Bundled (model inlined, ~3.5 MB)
│   └── spamwarden.min.js # Minified for production (~61 KB, 27 KB gzipped)
├── model.json           # Trained model from spam-labeler
├── build.js             # Node.js build script
├── build.sh             # Shell wrapper
├── SPEC.md              # Technical specification
└── README.md            # This file
```

## CI/CD & Releases

### Versioning

```bash
# Show current version
./version.sh

# Create release tag
./version.sh v0.70

# Push tag to trigger release
git push origin main --tags
```

### npm

```bash
# Build, then publish
npm run build
npm publish --access public
```

> **Note:** The package is published under the scoped name `@_redsocs/spam-warden`. Install with `npm install @_redsocs/spam-warden`.

### GitHub Actions

- **CI** — Runs on every push/PR: builds, smoke tests, uploads dist artifacts
- **Release** — Triggered by `v*` tags: packages dist, creates GitHub Release
