# SpamWarden Lazy Command Workflow (`lazy.js`)

This document specifies the exact step-by-step workflow that the `lazy.js` script must implement when collecting new dataset samples, retraining the model, and synchronizing tests.

---

## 📋 Step-by-Step Workflow Specification

### 1. Scan & Move New Dataset Samples
* Scan the user's `Downloads/` directory for any files matching the patterns:
  - `safe.*.txt` (clean/normal safe text lines)
  - `spam.*.txt` (spam/scam text lines)
* Move the discovered files into the sibling repository (`spam-labeler`):
  - Target: `../spam-labeler/data/spam-data-bucket/google search/raw/`
* Delete the files from the `Downloads/` folder upon successful copy to keep it clean.

### 2. Synchronize Test Benchmarks (`[tests sync]`)
* Locate the active benchmark test files inside the `tests/data/` directory (e.g., `tests/data/safe-[date].txt` and `tests/data/spam-[date].txt`).
* For each new dataset file imported:
  - **Concat** the safe text lines into `tests/data/safe-[date].txt`.
  - **Concat** the spam text lines into `tests/data/spam-[date].txt`.
* Re-zip the updated test files back into `tests/raw-data.zip` to ensure the new benchmarks are saved and versioned in the repository.

### 3. Trigger Sibling Retraining
* Change directory context to `../spam-labeler/`.
* Run `./retrain.sh` to trigger the Python-based Naive Bayes model training script on the expanded dataset.

### 4. Deploy Updated Model
* Decompress and copy the newly trained model:
  - Source: `../spam-labeler/extension/model.json.gz`
  - Destination: `spam-warden/model.json`

### 5. Build Distribution Bundles
* Run `npm run build` inside `spam-warden/` to bundle the new `model.json` weights.
* **[js sync]** Verify and output that the built files have been copied to `docs/js/`:
  - `dist/spamwarden.js` ➡️ `docs/js/spamwarden.js`
  - `dist/spamwarden.min.js` ➡️ `docs/js/spamwarden.min.js`

### 6. Run Line-by-Line Tests
* Run `npm test` (`node tests/test.js`) to test the updated JS library against the newly concatenated benchmarks.
