/**
 * SpamWarden.js — Client-side spam detection engine
 * Trained model from spam-labeler (Bernoulli NB)
 * Zero dependencies. Pure vanilla JS.
 */
const modelData = MODEL_DATA_PLACEHOLDER;

const SpamWarden = {
  _vocab: modelData.vocabulary,
  _classLogPrior: modelData.class_log_prior,
  _featureLogProb: modelData.feature_log_prob,
  _classes: modelData.classes,
  _version: modelData.version,
  _nFeatures: Object.keys(modelData.vocabulary).length,
  _absentLogProb: null,

  // ── 1. Telemetry Configuration ─────────────────────────────────────
  _config: {
    siteToken: null,
    endpoint: "https://api.redsocs.com/report/spam",
    autoReport: false,
    onSpam: null, // Optional callback function
  },

  /**
   * Configure the warden for telemetry and auto-binding.
   * @param {Object} options - { siteToken, endpoint, autoReport, formId, inputId, onSpam }
   */
  configure: function(options) {
    if (options.siteToken) this._config.siteToken = options.siteToken;
    if (options.endpoint) this._config.endpoint = options.endpoint;
    if (options.autoReport !== undefined)
      this._config.autoReport = options.autoReport;
    if (typeof options.onSpam === "function")
      this._config.onSpam = options.onSpam;

    // ── Auto-Bind DOM Logic ──
    if (options.formId && options.inputId) {
      const bindForm = () => {
        const form = document.getElementById(options.formId);
        const input = document.getElementById(options.inputId);

        if (form && input) {
          form.addEventListener("submit", (e) => {
            const result = this.spamcheck(input.value);

            if (result.isSpam) {
              e.preventDefault(); // Instantly block submission

              if (this._config.onSpam) {
                this._config.onSpam(result);
              } else {
                alert("Submission Blocked: Spam detected.");
                console.warn(
                  "[SpamWarden] Blocked malicious submission. Reason:",
                  result.reason || "model_flagged",
                );
              }
            }
          });
        } else {
          console.error(
            `[SpamWarden] Could not find form '${options.formId}' or input '${options.inputId}'`,
          );
        }
      };

      // Ensure DOM is ready before trying to attach listeners
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", bindForm);
      } else {
        bindForm();
      }
    }
  },

  // ── 2. Internal Reporting Method ──────────────────────────────────
  _report: function(input, result, actorId) {
    if (
      !this._config.autoReport ||
      !this._config.siteToken ||
      typeof fetch === "undefined"
    )
      return;

    const payload = {
      site_token: this._config.siteToken,
      actor_id: actorId || "anonymous",
      trigger_rule: result.reason || "naive_bayes_model",
      content_snippet: input ? input.substring(0, 500) : "",
      client_timestamp: Math.floor(Date.now() / 1000),
    };

    fetch(this._config.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true, // Ensures the request finishes if page unloads
    }).catch(() => {
      // Fail silently to protect host site UX
    });
  },

  // ── Core Model Math (Restored v1 Accuracy) ────────────────────────
  init: function() {
    if (this._absentLogProb !== null) return;

    this._absentLogProb = [];
    const nClasses = this._classes.length;

    for (let c = 0; c < nClasses; c++) {
      this._absentLogProb[c] = new Float64Array(this._nFeatures);
      for (let j = 0; j < this._nFeatures; j++) {
        const p = Math.exp(this._featureLogProb[c][j]);
        // log(1-p) with floor for safety
        this._absentLogProb[c][j] = Math.log(Math.max(1.0 - p, 1e-300));
      }
    }

    console.log(`[SpamWarden] Model ${this._version} loaded: ${this._nFeatures} features`);
  },

  /**
   * Vectorize text into feature indices (Critical for Thai trigrams/quadgrams).
   */
  _transform: function(text) {
    const features = new Uint8Array(this._nFeatures);
    const t = text.toLowerCase();

    // 1. Whitespace tokens
    const tokens = t.split(/\s+/);
    for (let i = 0; i < tokens.length; i++) {
      const cleaned = tokens[i].replace(/\s/g, '');
      if (cleaned.length > 0 && cleaned in this._vocab) {
        features[this._vocab[cleaned]] = 1;
      }
    }

    // 2. Trigrams
    const n = t.length;
    for (let i = 0; i <= n - 3; i++) {
      const trigram = t.substring(i, i + 3);
      if (trigram in this._vocab) {
        features[this._vocab[trigram]] = 1;
      }
    }

    // 3. Quadgrams
    for (let i = 0; i <= n - 4; i++) {
      const quadgram = t.substring(i, i + 4);
      if (quadgram in this._vocab) {
        features[this._vocab[quadgram]] = 1;
      }
    }

    return features;
  },

  // ── 3. Main Detection & Routing ───────────────────────────────────
  spamcheck: function(input, actorId) {
    if (!input || typeof input !== "string") {
      return { isSpam: false, prob: 0, version: this._version };
    }

    // Hard rules — auto-flag as spam
    const currencySymbols = ["$", "€", "£", "฿", "¥", "₹", "₽", "₿", "₮", "₩", "₱", "₫"];
    for (let i = 0; i < currencySymbols.length; i++) {
      if (input.indexOf(currencySymbols[i]) !== -1) {
        const result = {
          isSpam: true,
          prob: 1.0,
          reason: "currency_symbol",
          version: this._version,
        };
        if (this._config.autoReport) this._report(input, result, actorId);
        return result;
      }
    }

    const spamLinks = ["line.me", "@line", "lin.ee", "bit.ly", "shorturl", "tinyurl", "liff.line"];
    const lower = input.toLowerCase();
    for (let i = 0; i < spamLinks.length; i++) {
      if (lower.indexOf(spamLinks[i]) !== -1) {
        const result = {
          isSpam: true,
          prob: 0.95,
          reason: "spam_link",
          version: this._version,
        };
        if (this._config.autoReport) this._report(input, result, actorId);
        return result;
      }
    }

    this.init();
    const features = this._transform(input);
    const nClasses = this._classes.length;
    const scores = new Float64Array(nClasses);

    for (let c = 0; c < nClasses; c++) {
      let s = this._classLogPrior[c];
      for (let j = 0; j < this._nFeatures; j++) {
        if (features[j] === 1) {
          s += this._featureLogProb[c][j];
        } else {
          s += this._absentLogProb[c][j];
        }
      }
      scores[c] = s;
    }

    // Softmax for probability
    const maxScore = Math.max(scores[0], scores[1]);
    const exp0 = Math.exp(scores[0] - maxScore);
    const exp1 = Math.exp(scores[1] - maxScore);
    const sum = exp0 + exp1;
    const spamProb = sum > 0 ? exp1 / sum : 0.5;
    const isSpam = scores[1] > scores[0];

    const result = { isSpam: isSpam, prob: spamProb, version: this._version };

    // Fire telemetry on ML match
    if (isSpam && this._config.autoReport) {
      this._report(input, result, actorId);
    }

    return result;
  },

  isSpam: function(text) {
    return this.spamcheck(text).isSpam;
  },

  get version() {
    return this._version;
  },
};

// ── Global & Module Exposure ────────────────────────────────────────

if (typeof window !== 'undefined') {
  window.spamwarden = SpamWarden;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = SpamWarden;
}

if (typeof define === 'function' && define.amd) {
  define(function () { return SpamWarden; });
}

// ── 4. Auto-Initialization via Pipe-Delimited Base64 ────────────────
if (typeof document !== "undefined" && document.currentScript) {
  const src = document.currentScript.src;

  if (src.indexOf("?client=") !== -1) {
    try {
      const queryStr = src.split("?")[1];
      const params = new URLSearchParams(queryStr);
      const base64Config = params.get("client");

      if (base64Config) {
        const decodedString = atob(base64Config);
        const parts = decodedString.split("|");

        if (parts.length >= 3) {
          SpamWarden.configure({
            siteToken: parts[0],
            formId: parts[1],
            inputId: parts[2],
            autoReport: true,
          });
        }
      }
    } catch (e) {
      console.error("[SpamWarden] Failed to parse client configuration string.");
    }
  }
}
