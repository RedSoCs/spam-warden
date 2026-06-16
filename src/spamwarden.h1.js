/**
 * SpamWarden.js — Client-side spam detection engine
 * Trained model from spam-labeler (Bernoulli NB)
 * Zero dependencies. Pure vanilla JS.
 */
const modelData = MODEL_DATA_PLACEHOLDER;
const filterData = FILTER_DATA_PLACEHOLDER;

const SpamWarden = {
  _vocab: modelData.vocabulary,
  _classLogPrior: modelData.class_log_prior,
  _featureLogProb: modelData.feature_log_prob,
  _classes: modelData.classes,
  _version: modelData.version,
  _nFeatures: Object.keys(modelData.vocabulary).length,
  _absentLogProb: null,
  _checkFilter: function(item) {
    if (!filterData || !Array.isArray(filterData)) return false;
    const lowerItem = item.toLowerCase();
    for (let i = 0; i < filterData.length; i++) {
      if (lowerItem === filterData[i].toLowerCase()) return true;
    }
    return false;
  },

  // ── 1. Telemetry & SIEM Configuration ─────────────────────────────
  _config: {
    siteToken: null,
    endpoint: null,
    siemEndpoint: null,
    autoReport: false,
    isTrusted: false,
    reportSD: false,
    payloadLimit: 250,
    customReporter: null,
    onSpam: null,
  },

  /**
   * Configure the warden for secondary SIEM/SOC reporting.
   * Note: DOM protection (formId/inputId) is handled automatically via the Digital Key.
   */
  configure: function(options) {
    if (options.endpoint !== undefined) this._config.endpoint = options.endpoint;
    if (options.siemEndpoint !== undefined) this._config.siemEndpoint = options.siemEndpoint;
    if (options.siteToken !== undefined) this._config.siteToken = options.siteToken;
    if (options.payloadLimit !== undefined) this._config.payloadLimit = parseInt(options.payloadLimit, 10) || 250;
    this._config.autoReport = !!options.autoReport;
    this._config.reportSD = !!options.reportSD;
    this._config.isTrusted = !!options.isTrusted;
    if (typeof options.onSpam === "function") this._config.onSpam = options.onSpam;
    if (typeof options.customReporter === "function") this._config.customReporter = options.customReporter;

    // Auto-Bind DOM if formId and inputId are passed manually (synced with README)
    if (options.formId && options.inputId) {
      this._bind(options.formId, options.inputId);
    }
  },

  /**
   * Add custom domains to the blacklist at runtime.
   * @param {string|string[]} domains - Domain(s) to block (e.g., "badsite.com")
   */
  addBlacklist: function(domains) {
    if (!domains) return;
    const arr = Array.isArray(domains) ? domains : [domains];
    for (let i = 0; i < arr.length; i++) {
      if (typeof arr[i] === "string" && arr[i].trim() !== "") {
        filterData.push(arr[i].trim().toLowerCase());
      }
    }
  },

  /**
   * Internal: Attaches protection to the DOM.

   * Only called via the Base64 configuration parser.
   */
  _bind: function(formId, inputId) {
    let hasPasted = false;

    const bindForm = () => {
      const form = document.getElementById(formId);
      const input = document.getElementById(inputId);
      if (form && input) {
        
        // Track paste events
        input.addEventListener("paste", () => {
          hasPasted = true;
        });

        form.addEventListener("submit", (e) => {
          const result = this.spamcheck(input.value);
          result.pasted = hasPasted; // Inject flag before reporting

          if (result.isSpam) {
            e.preventDefault();

            // Re-trigger report with the pasted flag since _finishCheck didn't know about it at generation
            if (this._config.autoReport) {
                this._report(input.value, result, hasPasted);
            }

            if (this._config.onSpam) { this._config.onSpam(result); } 
            else { alert("Submission Blocked: Spam detected."); }
          }
        });
      }
    };
    if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", bindForm); } 
    else { bindForm(); }
  },

  // ── 2. SIEM Internal Reporting & Actor Extraction ────────────────
  _defang: function(str) {
    if (!str) return "";
    return str.replace(/https?:\/\//gi, "h_tt_p://").replace(/\./g, "[.]").replace(/@/g, "[at]");
  },

  _sanitizeData: function(text) {
    if (!text) return { text: "", sd: false };
    let sd = false;
    
    const cardRegex = /(?:^|\s|\b)(\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4})(?:\s|\b|$)/g;
    const emailRegex = /(?:^|\s|\b)([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})(?:\s|\b|$)/g;
    const phoneRegex = /(?:^|\s|\b)(0[-\s]?[2-9](?:[-\s]?\d){7,8})(?:\s|\b|$)/g;

    const t1 = text.replace(cardRegex, " [CARD_MASKED] ");
    if (t1 !== text) sd = true;
    const t2 = t1.replace(emailRegex, " [EMAIL_MASKED] ");
    if (t2 !== t1) sd = true;
    const t3 = t2.replace(phoneRegex, " [PHONE_MASKED] ");
    if (t3 !== t2) sd = true;
    
    return { text: t3.trim(), sd: sd };
  },

  _report: function(input, result, pastedFlag = false) {
    if (!this._config.autoReport || !this._config.siteToken || !this._config.isTrusted) return;

    const actors = [];
    const lineMatches = input.match(/(?:^|\s)(@[A-Za-z0-9_]+)(?=\s|$)/g);
    if (lineMatches) {
        for (let i = 0; i < lineMatches.length; i++) {
            actors.push(this._defang(lineMatches[i].trim()));
        }
    }

    const urlRegex = /https?:\/\/[^\s"<>]+/g;
    const allLinks = input.match(urlRegex) || [];
    const permittedDomains = ['google.com', 'facebook.com', 'twitter.com', 'instagram.com', 'youtube.com', 'apple.com', 'microsoft.com'];

    for (let i = 0; i < allLinks.length; i++) {
        const link = allLinks[i];
        const lowerLink = link.toLowerCase();
        
        if (lowerLink.match(/\.[a-z0-9-]+\.th\b/) || lowerLink.endsWith('.th')) continue;

        let isPermitted = false;
        for (let j = 0; j < permittedDomains.length; j++) {
            if (lowerLink.indexOf(permittedDomains[j]) !== -1) { isPermitted = true; break; }
        }
        if (isPermitted) continue;
        actors.push(this._defang(link));
    }

    const tagMatches = input.match(/([ก-๙]+[A-Za-z0-9]{2,})/g);
    if (tagMatches) actors.push(...tagMatches);

    const brandMatches = input.match(/\b[A-Za-z]+[0-9]{2,}[A-Za-z0-9]*\b/gi);
    if (brandMatches) actors.push(...brandMatches);

    const uid = actors.filter((v, i, a) => a.indexOf(v) === i);
    
    const sanitizedFull = this._sanitizeData(input);

    let sampleRaw = "";
    const lines = input.split(/\r?\n/);
    const origReport = this._config.autoReport;
    this._config.autoReport = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const res = this.spamcheck(line);
      if (res.prob >= 0.99) {
        sampleRaw += (sampleRaw ? "<cr>" : "") + line;
        if (sampleRaw.length >= 250) break;
      }
    }
    this._config.autoReport = origReport;
    
    if (!sampleRaw) sampleRaw = input;

    const sanitizedSample = this._sanitizeData(sampleRaw);

    const payload = {
      url: typeof window !== "undefined" ? this._defang(window.location.href) : "node",
      rule: result.reason || "ML",
      prob: Math.round(result.prob * 100),
      text: this._defang(sanitizedSample.text).substring(0, this._config.payloadLimit),
      uid: uid,
      sd: sanitizedFull.sd,
      paste: !!pastedFlag
    };

    const destinations = [];
    if (this._config.endpoint) {
      if (Array.isArray(this._config.endpoint)) destinations.push(...this._config.endpoint);
      else destinations.push(this._config.endpoint);
    }
    if (this._config.siemEndpoint) {
      if (Array.isArray(this._config.siemEndpoint)) destinations.push(...this._config.siemEndpoint);
      else destinations.push(this._config.siemEndpoint);
    }
    for (let i = 0; i < destinations.length; i++) {
      this._send(destinations[i], payload);
    }
    if (this._config.customReporter) { try { this._config.customReporter(payload); } catch(e) {} }
  },

  _send: function(url, data) {
    if (!url) return;
    const finalUrl = url.indexOf("://") === -1 ? "https://" + url : url;
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      try {
        const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
        if (navigator.sendBeacon(finalUrl, blob)) return;
      } catch (e) {}
    }
    if (typeof fetch !== "undefined") {
      fetch(finalUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data), keepalive: true }).catch(() => {});
    }
  },

  // ── Core Model Math ──────────────────────────────────────────────
  init: function() {
    if (this._baseScore !== undefined) return;
    const nClasses = this._classes.length;
    this._baseScore = new Float64Array(nClasses);
    this._featureWeight = [];
    
    for (let c = 0; c < nClasses; c++) {
      this._featureWeight[c] = new Float64Array(this._nFeatures);
      let base = this._classLogPrior[c];
      
      for (let j = 0; j < this._nFeatures; j++) {
        const logP = this._featureLogProb[c][j];
        const p = Math.exp(logP);
        const logNotP = Math.log(Math.max(1.0 - p, 1e-300));
        
        base += logNotP;
        this._featureWeight[c][j] = logP - logNotP;
      }
      this._baseScore[c] = base;
    }
  },

  _transform: function(text) {
    const presentFeatures = new Set();
    const t = text.toLowerCase();
    
    // Split text into tokens by whitespace
    const tokens = t.split(/\s+/);
    
    for (let i = 0; i < tokens.length; i++) {
      let word = tokens[i].replace(/\s/g, '');
      if (word.length === 0) continue;

      // Unigram (Exact word match)
      if (word in this._vocab) { 
        presentFeatures.add(this._vocab[word]); 
      }

      // Noise Limiter: Prevent massive unbroken strings from diluting the ML score
      // Limit n-gram extraction to the first 30 characters of any single word
      if (word.length > 30) {
        word = word.substring(0, 30);
      }

      const n = word.length;
      
      // Trigrams
      for (let j = 0; j <= n - 3; j++) {
        const trigram = word.substring(j, j + 3);
        if (trigram in this._vocab) { presentFeatures.add(this._vocab[trigram]); }
      }
      
      // Quadgrams
      for (let j = 0; j <= n - 4; j++) {
        const quadgram = word.substring(j, j + 4);
        if (quadgram in this._vocab) { presentFeatures.add(this._vocab[quadgram]); }
      }
    }
    
    return Array.from(presentFeatures);
  },

  lightcheck: function(input) {
    if (!input || typeof input !== "string") { return { isSpam: false, prob: 0, version: this._version, reason: "safe" }; }
    
    // 1. Filter List (Domains) - Priority Check
    const tokens = input.toLowerCase().split(/[^\w\d\.@\-]+/);
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      if (t && this._checkFilter(t)) {
        return { isSpam: true, prob: 0.95, reason: "SL", version: this._version };
      }
    }

    // 2. Currency Symbols
    const currencySymbols = ["$", "€", "£", "฿", "¥", "₹", "₽", "₿", "₮", "₩", "₱", "₫"];
    for (let i = 0; i < currencySymbols.length; i++) {
      if (input.indexOf(currencySymbols[i]) !== -1) {
        return { isSpam: true, prob: 1.0, reason: "CS", version: this._version };
      }
    }
    
    return { isSpam: false, prob: 0, reason: "safe", version: this._version };
  },

  spamcheck: function(input) {
    if (!input || typeof input !== "string") { return { isSpam: false, prob: 0, version: this._version }; }
    
    // Perform light check first (Fast Fail)
    const lightResult = this.lightcheck(input);
    if (lightResult.isSpam) {
      return this._finishCheck(input, lightResult);
    }
    
    // Heavy ML processing
    this.init();
    const presentFeatures = this._transform(input);
    const nClasses = this._classes.length;
    const scores = new Float64Array(nClasses);
    for (let c = 0; c < nClasses; c++) {
      let s = this._baseScore[c];
      for (let k = 0; k < presentFeatures.length; k++) {
        s += this._featureWeight[c][presentFeatures[k]];
      }
      scores[c] = s;
    }
    const maxScore = Math.max(scores[0], scores[1]);
    const exp0 = Math.exp(scores[0] - maxScore);
    const exp1 = Math.exp(scores[1] - maxScore);
    const sum = exp0 + exp1;
    const spamProb = sum > 0 ? exp1 / sum : 0.5;
    const isSpam = scores[1] > scores[0];
    const result = { isSpam: isSpam, prob: spamProb, version: this._version };
    return this._finishCheck(input, result);
  },


  _finishCheck: function(input, result) {
    const hasSD = this._sanitizeData(input).sd;
    if (this._config.autoReport && (result.isSpam || (this._config.reportSD && hasSD))) {
      this._report(input, result);
    }
    return result;
  },

  isSpam: function(text) { return this.spamcheck(text).isSpam; },
  get version() { return this._version; },
};

if (typeof window !== 'undefined') { window.spamwarden = SpamWarden; }
if (typeof module !== 'undefined' && module.exports) { module.exports = SpamWarden; }
if (typeof define === 'function' && define.amd) { define(function () { return SpamWarden; }); }

if (typeof document !== "undefined" && document.currentScript) {
  const src = document.currentScript.src;
  if (src.indexOf("?client=") !== -1) {
    try {
      const queryStr = src.split("?")[1];
      const params = new URLSearchParams(queryStr);
      const base64ConfigRaw = params.get("client");
      if (base64ConfigRaw) {
        // Robustness: Handle '+' being converted to ' ' by URL parsers
        let base64Config = base64ConfigRaw.replace(/ /g, "+");
        // Add padding back if missing
        while (base64Config.length % 4 !== 0) base64Config += "=";

        const decodedString = atob(base64Config);
        const parts = decodedString.split("|");
        if (parts.length >= 3) {
          const formId = parts[0];
          const inputId = parts[1];
          const sdFlag = parts[2];
          const siemEndpointRaw = parts[3] || null;

          if (siemEndpointRaw) {
            SpamWarden._config.siemEndpoint = siemEndpointRaw.indexOf(",") !== -1 ? 
              siemEndpointRaw.split(",") : 
              siemEndpointRaw;
          }

          SpamWarden._config.reportSD = sdFlag === "1";
          SpamWarden._config.autoReport = true;
          SpamWarden._config.isTrusted = true;

          // Force DOM binding only through the key
          SpamWarden._bind(formId, inputId);
        }
      }
    } catch (e) { console.error("[SpamWarden] Failed to parse client configuration string."); }
  }
}
