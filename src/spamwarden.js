// SpamWarden.js — Client-side spam detection engine
// Trained model from spam-labeler (Bernoulli NB, v0.68)
// Zero dependencies. Pure vanilla JS.

(function () {
  "use strict";

  // ── Embedded Model ──────────────────────────────────────────────
  // This block is auto-replaced by build.sh with the actual model.json content.
  // The variable MODEL_DATA must be a JS object with:
  //   { version, vocabulary, class_log_prior, feature_log_prob, classes }
  var MODEL_DATA = MODEL_DATA_PLACEHOLDER;

  // ── Bernoulli Naive Bayes Classifier ─────────────────────────────

  function BernoulliNB(data) {
    this.classLogPrior = data.class_log_prior;
    this.featureLogProb = data.feature_log_prob;
    this.classes = data.classes;
    this.vocab = data.vocabulary;
    this.version = data.version;
    this.nClasses = this.classes.length;
    this.nFeatures = Object.keys(this.vocab).length;

    // Precompute log(1 - exp(logProb)) for absent features
    // This avoids recomputing it on every prediction.
    this.absentLogProb = [];
    for (var c = 0; c < this.nClasses; c++) {
      this.absentLogProb[c] = new Float64Array(this.nFeatures);
      for (var j = 0; j < this.nFeatures; j++) {
        var p = Math.exp(this.featureLogProb[c][j]);
        this.absentLogProb[c][j] = Math.log(Math.max(1.0 - p, 1e-300));
      }
    }
  }

  // ── Vectorizer (matches spam-labeler export_model.rs) ────────────
  // 1. Whitespace tokens (lowercased)
  // 2. Trigrams (3 chars)
  // 3. Quadgrams (4 chars)

  BernoulliNB.prototype.transform = function (text) {
    var features = new Uint8Array(this.nFeatures);
    var t = text.toLowerCase();

    // Whitespace tokens
    var tokens = t.split(/\s+/);
    for (var i = 0; i < tokens.length; i++) {
      var cleaned = tokens[i].replace(/\s/g, "");
      if (cleaned.length > 0 && cleaned in this.vocab) {
        features[this.vocab[cleaned]] = 1;
      }
    }

    // Trigrams
    var chars = t.split("");
    var n = chars.length;
    for (var i = 0; i <= n - 3; i++) {
      var trigram = chars[i] + chars[i + 1] + chars[i + 2];
      if (trigram in this.vocab) {
        features[this.vocab[trigram]] = 1;
      }
    }

    // Quadgrams
    for (var i = 0; i <= n - 4; i++) {
      var quadgram = chars[i] + chars[i + 1] + chars[i + 2] + chars[i + 3];
      if (quadgram in this.vocab) {
        features[this.vocab[quadgram]] = 1;
      }
    }

    return features;
  };

  // ── Prediction ───────────────────────────────────────────────────
  // Returns { isSpam: boolean, prob: number, version: string }

  BernoulliNB.prototype.predict = function (text) {
    var features = this.transform(text);
    var scores = new Float64Array(this.nClasses);

    for (var c = 0; c < this.nClasses; c++) {
      var s = this.classLogPrior[c];
      for (var j = 0; j < this.nFeatures; j++) {
        if (features[j] === 1) {
          s += this.featureLogProb[c][j];
        } else {
          s += this.absentLogProb[c][j];
        }
      }
      scores[c] = s;
    }

    // Softmax to get probability
    var maxScore = Math.max(scores[0], scores[1]);
    var exp0 = Math.exp(scores[0] - maxScore);
    var exp1 = Math.exp(scores[1] - maxScore);
    var sum = exp0 + exp1;
    var spamProb = sum > 0 ? exp1 / sum : 0.5;

    // Class 1 = spam
    return {
      isSpam: scores[1] > scores[0],
      prob: spamProb,
      version: this.version,
    };
  };

  // ── Hard Rules (zero-false-negative guardrails) ──────────────────

  var CURRENCY_SYMBOLS = ["$", "€", "£", "฿", "¥", "₹", "₽", "₿", "₮", "₩", "₱", "₫"];
  var SPAM_LINK_PATTERNS = ["line.me", "@line", "lin.ee", "bit.ly", "shorturl", "tinyurl", "liff.line"];

  function hasCurrencySymbol(text) {
    for (var i = 0; i < CURRENCY_SYMBOLS.length; i++) {
      if (text.indexOf(CURRENCY_SYMBOLS[i]) !== -1) return true;
    }
    return false;
  }

  function hasSpamLink(text) {
    var lower = text.toLowerCase();
    for (var i = 0; i < SPAM_LINK_PATTERNS.length; i++) {
      if (lower.indexOf(SPAM_LINK_PATTERNS[i]) !== -1) return true;
    }
    return false;
  }

  // ── Public API ───────────────────────────────────────────────────

  var model = new BernoulliNB(MODEL_DATA);

  /**
   * Check if text is spam.
   * @param {string} text - UTF-8 string to analyze.
   * @returns {{ isSpam: boolean, prob: number, reason?: string, version: string }}
   */
  function spamcheck(text) {
    if (!text || typeof text !== "string") {
      return { isSpam: false, prob: 0, version: model.version };
    }

    // Hard rules — auto-flag as spam
    if (hasCurrencySymbol(text)) {
      return { isSpam: true, prob: 1.0, reason: "currency_symbol", version: model.version };
    }
    if (hasSpamLink(text)) {
      return { isSpam: true, prob: 0.95, reason: "spam_link", version: model.version };
    }

    return model.predict(text);
  }

  /**
   * Quick boolean-only check for conditional usage.
   * @param {string} text
   * @returns {boolean}
   */
  function spamcheckBool(text) {
    return spamcheck(text).isSpam;
  }

  // Expose on window (browser) or module (Node/CommonJS)
  var API = {
    spamcheck: spamcheck,
    isSpam: spamcheckBool,
    version: model.version,
  };

  if (typeof window !== "undefined") {
    window.spamwarden = API;
  }
  if (typeof module !== "undefined" && module.exports) {
    module.exports = API;
  }
})();
