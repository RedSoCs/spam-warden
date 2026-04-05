# **Spec.md: SpamWarden.js**

This specification defines the technical requirements and architecture for **SpamWarden.js**, the client-side detection engine for the **RedSocs** project. It utilizes the pre-trained weights and vocabulary derived from the `spam-labeler` repository.

---

## **1. Project Overview**

- **Name:** SpamWarden.js
- **Purpose:** To provide a single-file, zero-latency JavaScript library for detecting spam and "sentence hijacking" within browser environments.
- **Scope:** Part of the **RCortex** monorepo.
- **Standard:** All documentation and code comments must be in English.

---

## **2. Technical Specifications**

### **2.1 Model Architecture**

- **Origin:** Trained via [RedSocs/spam-labeler](https://github.com/RedSocs/spam-labeler) (Rust, Bernoulli NB).
- **Reproducibility:** Developers can retrain the model with custom datasets using the spam-labeler repo, then swap `model.json` and rebuild.
- **Feature Extraction:** Whitespace tokens + character trigrams + character quadgrams.
- **Vocabulary Size:** 63,269 tokens including specialized Thai terminology.
- **Classes:** `0` = safe, `1` = spam (Lidstone smoothing α=0.1).

### **2.2 Resource Constraints**

| Metric            | Requirement | Actual |
| :---------------- | :---------- | :----- |
| **Model Size**    | Maximum 600 KB (uncompressed JSON) | 3.5 MB (full model, uncompressed) |
| **Transfer Size** | ~180 KB (Gzipped/Brotli) | **27 KB gzipped** |
| **Dependencies**  | Zero external runtime dependencies | ✅ Zero |
| **Execution**     | Purely client-side | ✅ In-browser, in-memory |

---

## **3. Public API (Global)**

The library must expose a single global object, `window.spamwarden`, to allow for "plug-and-play" integration into prototypes and extensions.

### **3.1 Methods**

#### `spamwarden.spamcheck(text: string): object`

- **Input:** A UTF-8 string of text to be analyzed.
- **Processing:**
  1.  Null/empty guard.
  2.  Hard rules check: currency symbols (`$€£฿`) → auto-spam (prob 1.0); spam links (`line.me`, `@line`, `lin.ee`) → auto-spam (prob 0.95).
  3.  Normalize input (lowercased).
  4.  Tokenize: whitespace tokens + character trigrams + character quadgrams.
  5.  Bernoulli NB prediction → softmax probability.
- **Output:**
  ```js
  {
    isSpam: true,        // boolean
    prob: 0.98,          // number 0.0–1.0
    reason: "currency_symbol",  // optional, present if hard-rule triggered
    version: "v0.68"     // model version string
  }
  ```

#### `spamwarden.isSpam(text: string): boolean`

- Convenience wrapper — returns only `true`/`false`.

#### `spamwarden.version: string`

- Current model version (e.g., `"v0.68"`).

---

## **4. Implementation Requirements**

### **4.1 Embedding Strategy**

- The `model.json` file is bundled into the `.js` source at build time.
- The model is trained by [RedSocs/spam-labeler](https://github.com/RedSocs/spam-labeler). To use a custom model:
  1. Clone `RedSocs/spam-labeler`
  2. Add your own training data to `data/spam.txt` and `data/safe.txt`
  3. Run `cargo run --release --bin export_model` to generate a new `model.json`
  4. Copy it to `spam-warden/model.json` and run `node build.js`
- `build.js` (Node.js) reads `model.json`, replaces `MODEL_DATA_PLACEHOLDER` in `src/spamwarden.js`, and outputs:
  - `dist/spamwarden.js` — full bundled (~3.5 MB)
  - `dist/spamwarden.min.js` — minified for production (~61 KB, **27 KB gzipped**)
- Optional: install `terser` (`npm install terser`) for better minification.

### **4.2 Performance**

- **Initialization:** Model loads and parses JSON in < 50ms. Precomputes `log(1 - exp(p))` for all features at load time.
- **Inference:** ~0.1–2ms per 100-character string on standard hardware (well under the 10ms target).
- **Precomputation:** Absent-feature log probabilities are cached at init, reducing per-prediction work to simple array lookups.

---

## **5. Security & Privacy**

- **Local Processing:** No user data is sent to external servers; all classification happens in-memory.
- **Hard Rules:** Currency symbols and spam links are flagged before ML inference — prevents false negatives on obvious spam patterns.
- **IIFE Wrapper:** The library is wrapped in an Immediately Invoked Function Expression to avoid polluting the global scope (only `window.spamwarden` is exposed).
- **CommonJS Support:** Also exports via `module.exports` for Node.js usage.

---

**Document Version:** 1.1.0 (implementation complete)
**Project:** RedSocs / RCortex
**Status:** Production Ready
**Model:** v0.68 (680 training samples, 63,269 features)
