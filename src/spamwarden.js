(function() {
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
    _filters: (filterData && Array.isArray(filterData)) ? filterData.map(codes => {
      return Array.isArray(codes) ? String.fromCharCode(...codes.map(c => c + 100)) : codes;
    }) : [],
    _checkFilter: function(item) {
      if (!this._filters || !Array.isArray(this._filters)) return false;
      const lowerItem = item.toLowerCase();
      for (let i = 0; i < this._filters.length; i++) {
        if (lowerItem === this._filters[i].toLowerCase()) return true;
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
          this._filters.push(arr[i].trim().toLowerCase());
        }
      }
    },

    /**
     * Internal: Attaches protection to the DOM.
     * Can accept a string ID or a direct Form Element.
     */
    _bind: function(target) {
      // Note: With the new document-level capturer, explicit binding is now
      // primarily used to "register" forms that might not match the auto-discovery heuristic.
      const form = (typeof target === "string") ? 
        (document.getElementById(target) || document.querySelector(`form[name="${target}"]`)) : 
        target;
      
      if (form && !form.hasAttribute('data-sw-protected')) {
        form.setAttribute('data-sw-protected', 'true');
      }
    },

    /**
     * Heuristic: Auto-discover forms on the page that have at least 2 text inputs.
     */
    _autoBind: function() {
      this._setupGlobalProtections();

      const scan = () => {
        const forms = Array.from(document.querySelectorAll('form:not([data-sw-protected])'));
        forms.forEach(form => {
          const inputs = Array.from(form.querySelectorAll('input[type="text"], input:not([type]), textarea'))
            .filter(el => {
              if (el.type === 'hidden' || el.type === 'password') return false;
              return el.offsetWidth > 0 || el.offsetHeight > 0;
            });
          
          if (inputs.length >= 2) {
            this._bind(form);
          }
        });
      };

      if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", scan); } 
      else { scan(); }
    },

    /**
     * Brutal DOM Protection: Intercepts bypass attempts via capturing listeners,
     * prototype monkey-patching, and MutationObservers.
     */
    _setupGlobalProtections: function() {
      if (this._globallyProtected) return;
      this._globallyProtected = true;

      const self = this;
      let hasPasted = false;

      // 1. Document-Level Capturing Interceptor
      // Catches submit events before they reach the form, even if cloned or replaced.
      document.addEventListener("submit", function(e) {
        const form = e.target;
        if (!form || form.tagName !== "FORM") return;
        if (!form.hasAttribute('data-sw-protected')) return;

        const inputs = Array.from(form.querySelectorAll('input[type="text"], input:not([type]), textarea'))
          .filter(el => el.type !== 'hidden' && el.type !== 'password');
        
        const combinedText = inputs
          .map(el => el.value)
          .filter(val => val.trim() !== '')
          .join('\n');

        const result = self.spamcheck(combinedText, { pasted: hasPasted });
        if (result.isSpam) {
          e.preventDefault();
          e.stopImmediatePropagation(); // Prevent other listeners from firing
          if (self._config.onSpam) { self._config.onSpam(result); } 
          else { alert("Submission Blocked: Spam detected."); }
        }
      }, true); // TRUE = Capturing Phase

      // Global paste tracker
      document.addEventListener("paste", function() {
        hasPasted = true;
      }, true);

      // 2. Prototype Monkey-Patching
      // Intercepts direct calls to document.forms[0].submit() which skip events.
      try {
        const originalSubmit = HTMLFormElement.prototype.submit;
        HTMLFormElement.prototype.submit = function() {
          const form = this;
          if (form.hasAttribute('data-sw-protected')) {
            const inputs = Array.from(form.querySelectorAll('input[type="text"], input:not([type]), textarea'))
              .filter(el => el.type !== 'hidden' && el.type !== 'password');
            
            const combinedText = inputs.map(el => el.value).join('\n');
            const result = self.spamcheck(combinedText, { pasted: hasPasted });

            if (result.isSpam) {
              console.warn("[SpamWarden] Blocked programmatic submit() call.");
              if (self._config.onSpam) { self._config.onSpam(result); }
              return;
            }
          }
          originalSubmit.call(form);
        };
      } catch (err) {}

      // 3. MutationObserver (Anti-Tampering)
      // Watches for removal of protected forms or their input fields.
      if (typeof MutationObserver !== "undefined") {
        const observer = new MutationObserver((mutations) => {
          for (const m of mutations) {
            if (m.removedNodes.length > 0) {
              for (const node of m.removedNodes) {
                if (node.nodeType !== 1) continue;
                if (node.tagName === 'FORM' && node.hasAttribute('data-sw-protected')) {
                  console.error("[SpamWarden] Critical Error: Protected form was removed from DOM.");
                }
                if (node.tagName === 'TEXTAREA' || node.tagName === 'INPUT') {
                  // Check if the node belonged to a protected form
                  console.warn("[SpamWarden] Warning: Input element removal detected.");
                }
              }
            }
          }
        });
        observer.observe(document.body, { childList: true, subtree: true });
      }
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
        client: this._config.siteToken || null,
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
      let finalUrl = url;
      if (url.indexOf("://") === -1) {
        const isLocal = /(^localhost|^127\.0\.0\.1)(:\d+)?(\/|$)/i.test(url);
        finalUrl = (isLocal ? "http://" : "https://") + url;
      }
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
          return { isSpam: true, prob: 0.95, reason: "spam_link", version: this._version };
        }
      }

      // 2. Currency Symbols
      const currencySymbols = ["$", "€", "£", "฿", "¥", "₹", "₽", "₿", "₮", "₩", "₱", "₫"];
      for (let i = 0; i < currencySymbols.length; i++) {
        if (input.indexOf(currencySymbols[i]) !== -1) {
          return { isSpam: true, prob: 1.0, reason: "currency_symbol", version: this._version };
        }
      }
      
      return { isSpam: false, prob: 0, reason: "safe", version: this._version };
    },

    spamcheck: function(input, opts) {
      if (!input || typeof input !== "string") { return { isSpam: false, prob: 0, version: this._version }; }
      
      const pasted = (typeof opts === "object" && opts !== null) ? !!opts.pasted : !!opts;

      // Perform light check first (Fast Fail)
      const lightResult = this.lightcheck(input);
      if (lightResult.isSpam) {
        return this._finishCheck(input, lightResult, pasted);
      }
      
      // Bypass ML model for non-Thai text (if not caught by lightcheck rules)
      if (!/[\u0e00-\u0e7f]/.test(input)) {
        return this._finishCheck(input, { isSpam: false, prob: 0, version: this._version }, pasted);
      }
      
      // Heavy ML processing (Present-Only Naive Bayes)
      this.init();
      const presentFeatures = this._transform(input);
      const nClasses = this._classes.length;
      const scores = new Float64Array(nClasses);
      for (let c = 0; c < nClasses; c++) {
        let s = this._classLogPrior[c];
        for (let k = 0; k < presentFeatures.length; k++) {
          s += this._featureLogProb[c][presentFeatures[k]];
        }
        scores[c] = s;
      }
      // Apply calibrated threshold offset
      scores[1] -= (5.5 + 0.49 * presentFeatures.length);

      const maxScore = Math.max(scores[0], scores[1]);
      const exp0 = Math.exp(scores[0] - maxScore);
      const exp1 = Math.exp(scores[1] - maxScore);
      const sum = exp0 + exp1;
      const spamProb = sum > 0 ? exp1 / sum : 0.5;
      const isSpam = scores[1] > scores[0];
      const result = { isSpam: isSpam, prob: spamProb, version: this._version };
      return this._finishCheck(input, result, pasted);
    },


    _finishCheck: function(input, result, pastedFlag = false) {
      const hasSD = this._sanitizeData(input).sd;
      if (this._config.autoReport && (result.isSpam || (this._config.reportSD && hasSD))) {
        this._report(input, result, pastedFlag);
      }
      return result;
    },

    isSpam: function(text) { return this.spamcheck(text).isSpam; },
    get version() { return this._version; },
  };

  // ── 3. Active Defense: The Ghost Tarpit ───────────────────────────
  
  if (typeof window !== 'undefined') {
    // The Real Engine: Exposed using a build-time randomized key
    // The attacker does not know this key, but the internal listeners do.
    const REAL_KEY = __SECRET_FN_NAME__; 
    window[REAL_KEY] = SpamWarden;

    // --- Developer Mode Bypass ---
    // Allows the live demo (docs/index.html) or authorized devs to test the full API.
    let isDevMode = false;
    try {
      const scripts = document.querySelectorAll('script');
      for (let i = 0; i < scripts.length; i++) {
        if (scripts[i].getAttribute('data-sw-dev') === 'true') {
          isDevMode = true;
          break;
        }
      }
    } catch(e) {}

    if (isDevMode) {
      console.warn("[SpamWarden] ⚠️ DEV MODE ACTIVE: Tarpit disabled. Real engine exposed globally.");
      window.spamwarden = SpamWarden;
    } else {
      // The Decoy: Filled with a "Poison Pill" to crash bots attempting bypasses
      window.spamwarden = {
        version: SpamWarden.version,
        spamcheck: function() {
          console.log("[System] Initializing heuristic validation...");
          
          // The CPU Tarpit: Synchronous DOM thrashing and memory exhaustion
          let junkArray = [];
          let counter = 0;
          
          // This locks the main thread, spiking CPU to 100%
          while (true) {
            counter++;
            // Push garbage to memory to trigger heap exhaustion
            junkArray.push(new Array(10000).join('x')); 
            
            // Thrash the browser's history API (heavily degrades performance in headless bots)
            try {
              history.pushState(0, 0, '/' + counter);
            } catch(e) {}

            // Cryptographic math to burn CPU cycles
            Math.sqrt(Math.random() * 9999999) * Math.sin(counter);
            
            // Anti-debugging: Break in the loop if DevTools are open
            if (counter % 1000 === 0) {
              debugger;
            }
          }
        },
        isSpam: function() { return this.spamcheck(); }
      };
    }
  }

  // ── 4. Runtime Configuration & Auto-Binding ───────────────────────

  if (typeof document !== "undefined" && document.currentScript) {
    const script = document.currentScript;
    const src = script.src;
    
    const queryStr = src.indexOf("?") !== -1 ? src.split("?")[1] : "";
    const params = new URLSearchParams(queryStr);
    const clientTokenRaw = params.get("client");

    if (clientTokenRaw) {
      try {
        let base64Config = clientTokenRaw.replace(/ /g, "+");
        while (base64Config.length % 4 !== 0) base64Config += "=";

        const decodedString = atob(base64Config);
        const parts = decodedString.split("|");
        
        if (parts.length >= 2) {
          const sdFlag = parts[0];
          const siemEndpointRaw = parts[1] || null;

          if (siemEndpointRaw) {
            SpamWarden._config.siemEndpoint = siemEndpointRaw.indexOf(",") !== -1 ? 
              siemEndpointRaw.split(",") : 
              siemEndpointRaw;
          }

          SpamWarden._config.siteToken = clientTokenRaw;
          SpamWarden._config.reportSD = sdFlag === "1";
          SpamWarden._config.autoReport = true;
          SpamWarden._config.isTrusted = true;

          SpamWarden._autoBind();
        }
      } catch (e) { console.error("[SpamWarden] Configuration failure."); }
    }
    else if (script.hasAttribute("data-auto-protect")) {
      const sdAttr = script.getAttribute("data-sd");
      SpamWarden._config.reportSD = sdAttr !== "0"; 
      SpamWarden._config.autoReport = false;
      SpamWarden._config.isTrusted = true;
      SpamWarden._autoBind();
    }
  }

  // Handle module exports safely
  if (typeof module !== 'undefined' && module.exports) { module.exports = SpamWarden; }
})();
