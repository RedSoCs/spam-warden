/**
 * SpamWarden.js — Client-side spam detection engine
 * Trained model from spam-labeler (Bernoulli NB, v0.68)
 * Zero dependencies. Pure vanilla JS.
 */

// ── Model Data (auto-injected by build.js) ─────────────────────────
const modelData = MODEL_DATA_PLACEHOLDER;

// ── SpamWarden Module ──────────────────────────────────────────────

const SpamWarden = {
  // Store the vocab internally
  _vocab: modelData.vocabulary,
  _classLogPrior: modelData.class_log_prior,
  _featureLogProb: modelData.feature_log_prob,
  _classes: modelData.classes,
  _version: modelData.version,
  _nFeatures: Object.keys(modelData.vocabulary).length,
  _absentLogProb: null,

  /**
   * Initialize: precompute absent-feature log probabilities.
   * Call once before using spamcheck().
   */
  init: function () {
    if (this._absentLogProb !== null) return;

    this._absentLogProb = [];
    const nClasses = this._classes.length;

    for (let c = 0; c < nClasses; c++) {
      this._absentLogProb[c] = new Float64Array(this._nFeatures);
      for (let j = 0; j < this._nFeatures; j++) {
        const p = Math.exp(this._featureLogProb[c][j]);
        this._absentLogProb[c][j] = Math.log(Math.max(1.0 - p, 1e-300));
      }
    }

    console.log(`[SpamWarden] Model ${this._version} loaded: ${Object.keys(this._vocab).length} features`);
  },

  /**
   * Vectorize text into feature indices (matches spam-labeler export_model.rs).
   * 1. Whitespace tokens (lowercased)
   * 2. Character trigrams
   * 3. Character quadgrams
   */
  _transform: function (text) {
    const features = new Uint8Array(this._nFeatures);
    const t = text.toLowerCase();

    // Whitespace tokens
    const tokens = t.split(/\s+/);
    for (let i = 0; i < tokens.length; i++) {
      const cleaned = tokens[i].replace(/\s/g, '');
      if (cleaned.length > 0 && cleaned in this._vocab) {
        features[this._vocab[cleaned]] = 1;
      }
    }

    // Trigrams
    const n = t.length;
    for (let i = 0; i <= n - 3; i++) {
      const trigram = t.substring(i, i + 3);
      if (trigram in this._vocab) {
        features[this._vocab[trigram]] = 1;
      }
    }

    // Quadgrams
    for (let i = 0; i <= n - 4; i++) {
      const quadgram = t.substring(i, i + 4);
      if (quadgram in this._vocab) {
        features[this._vocab[quadgram]] = 1;
      }
    }

    return features;
  },

  /**
   * Main detection function.
   * @param {string} input - The text to analyze.
   * @returns {{ isSpam: boolean, prob: number, reason?: string, version: string }}
   */
  spamcheck: function (input) {
    if (!input || typeof input !== 'string') {
      return { isSpam: false, prob: 0, version: this._version };
    }

    // Hard rules — auto-flag as spam
    const currencySymbols = ['$', '€', '£', '฿', '¥', '₹', '₽', '₿', '₮', '₩', '₱', '₫'];
    for (let i = 0; i < currencySymbols.length; i++) {
      if (input.indexOf(currencySymbols[i]) !== -1) {
        return { isSpam: true, prob: 1.0, reason: 'currency_symbol', version: this._version };
      }
    }

    const spamLinks = ['line.me', '@line', 'lin.ee', 'bit.ly', 'shorturl', 'tinyurl', 'liff.line'];
    const lower = input.toLowerCase();
    for (let i = 0; i < spamLinks.length; i++) {
      if (lower.indexOf(spamLinks[i]) !== -1) {
        return { isSpam: true, prob: 0.95, reason: 'spam_link', version: this._version };
      }
    }

    // Initialize if not done
    this.init();

    // Bernoulli NB prediction
    const features = this._transform(input);
    const nClasses = this._classes.length;
    const scores = new Float64Array(nClasses);

    for (let c = 0; c < nClasses; c++) {
      let s = this._classLogPrior[c];
      for (let j = 0; j < features.length; j++) {
        if (features[j] === 1) {
          s += this._featureLogProb[c][j];
        } else {
          s += this._absentLogProb[c][j];
        }
      }
      scores[c] = s;
    }

    // Softmax
    const maxScore = Math.max(scores[0], scores[1]);
    const exp0 = Math.exp(scores[0] - maxScore);
    const exp1 = Math.exp(scores[1] - maxScore);
    const sum = exp0 + exp1;
    const spamProb = sum > 0 ? exp1 / sum : 0.5;

    return {
      isSpam: scores[1] > scores[0],
      prob: spamProb,
      version: this._version,
    };
  },
};

// ── Global Exposure ─────────────────────────────────────────────────

if (typeof window !== 'undefined') {
  window.spamwarden = SpamWarden;
}

// ── Module Exports ──────────────────────────────────────────────────

if (typeof module !== 'undefined' && module.exports) {
  module.exports = SpamWarden;
}

if (typeof define === 'function' && define.amd) {
  define(function () { return SpamWarden; });
}
