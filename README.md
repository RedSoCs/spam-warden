# SpamWarden.js

Lightweight, client-side JavaScript library for real-time spam detection and automated form protection. Optimized for Thai text and high-performance browser environments.

[![CI](https://github.com/RedSocs/spam-warden/actions/workflows/ci.yml/badge.svg)](https://github.com/RedSocs/spam-warden/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/%40redsocs%2Fspam-warden.svg)](https://www.npmjs.com/package/@redsocs/spam-warden)
[![Sponsor](https://img.shields.io/badge/Sponsor-Buy%20Me%20a%20Coffee-ffdd00?style=flat&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/redsocs?new=1)

# What is this?

**SpamWarden.js** is a zero-dependency, client-side engine that detects spam directly in the user's browser. It uses a **Present-Only Naive Bayes** model (derived from Bernoulli Naive Bayes) trained specifically on Thai spam patterns (gambling, loans, "fast money" scams) and optimized with a dynamic, length-calibrated decision threshold to eliminate false positives on longer, clean text.

By running in the browser, it allows you to **block spam before it ever hits your database**, saving server resources and keeping your data clean.

![SIEM Endpoint & Spam Block Demo](https://cdn.redsocs.com/assets/siem-endpoint-spamblock-demo.gif)

# Live Demo & Scanner

You can test the spam engine interactively, analyze your forms, and generate auto-blocking script configurations directly on our GitHub Pages site:

👉 **[Live Demo & Generator](https://redsocs.github.io/spam-warden/)**

# Quickstart

> [!IMPORTANT]
> **Are you a Thai government agency or public sector website administrator?**
> Get your free token configuration and drop-in script to protect your online portals from annoying gambling/loan ads and spam campaigns at [redsocs.com/spam-warden](https://redsocs.com/spam-warden).

### 1. The "No-Code" Way (Auto-Blocking)

Add this script to your page. It will automatically find your form and block submission if spam is detected.

```html
<script src="https://cdn.redsocs.com/js/spamwarden.min.js?client=cG9zdHEtZm9ybXxtZXNzYWdlLWlucHV0fDE"></script>
```

_Note: The `client` parameter is a Base64 configuration string of `formId|inputId|sdFlag|siemEndpoint` (e.g., `postq-form|message-input|1` encoded)._

### 2. Manual Configuration

```html
<script src="dist/spamwarden.min.js"></script>
<script>
  spamwarden.configure({
    siteToken: "YOUR_TOKEN",
    formId: "contact-form",
    inputId: "message-field",
    autoReport: true,
    isTrusted: true, // Required to authorize telemetry reporting
    reportSD: true,  // Optional: Enable PII/DLP leak telemetry auditing
    siemEndpoint: "https://api.yourdomain.com/v1/telemetry", // Optional: Custom secondary SIEM/SOC endpoint
    onSpam: (result) => {
      alert("Please do not send spam!");
    },
  });
</script>
```

### 3. API Usage (Node or Browser)

```javascript
const result = spamwarden.spamcheck("สมัครสมาชิกวันนี้ รับโบนัส ฟรี!");
if (result.isSpam) {
  console.log("Blocked:", result.reason || "AI match");
  console.log("Confidence:", result.prob);
}
```

# Scope

SpamWarden is designed for **interactive web elements**:

- **Contact Forms:** Prevent bot and manual spam submissions.
- **Comment Sections:** Real-time feedback for users before they post.
- **Chat Inputs:** Instant filtering of malicious links and currency-heavy spam.
- **Privacy-First Apps:** Since detection happens locally, user data doesn't leave the browser unless explicitly reported.

# What's inside?

- **Hybrid Detection Engine:**
  - **Hard Rules:** Instant blocking for currency symbols (`$€£฿`) and known spam link patterns (`line[dot]me`, `bit[dot]ly`).
  - **Thai-Optimized Tokenizer:** Extracts whitespace tokens, **trigrams**, and **quadgrams** to handle the space-less nature of the Thai language.
  - **Present-Only NB Classifier:** A modified Naive Bayes model trained on real-world spam samples. It only evaluates present vocabulary features and utilizes a length-dependent threshold offset ($5.5 + 0.49 \times N$ matched features) to calibrate confidence and prevent false positives on longer clean texts.
- **Telemetry System:** Optional auto-reporting of spam hits to `api.redsocs.com` for global threat intelligence.
- **Auto-Interceptor:** Event listeners that hook into DOM forms to provide "Drop-in" protection.

# Why this exists?

Traditional spam filters (like Akismet or ReCaptcha) often:

1. Require a round-trip to a server (latency).
2. Are expensive for high-volume sites.
3. Over-collect user data (privacy concerns).
4. Struggle with specific Thai-language spam patterns.

**SpamWarden** exists to provide a **local, fast, and Thai-centric** alternative that stops spam at the source: the user's input field.

# Local Simulation & Testing

You can spin up a local simulation server to test the DOM auto-blocking behavior and inspect the SIEM telemetry payloads in real time:

1. **Start the simulation server**:
   ```bash
   npm run test-server
   ```
2. **Open the test page** in your browser:
   [http://localhost:3000/](http://localhost:3000/)
3. **Submit a spam message** (e.g., including currency signs like `฿` or links like `line[dot]me`).
4. **Observe the result**:
   - The form submission will be blocked on the page.
   - The terminal will display the defanged and sanitized telemetry payload sent to the SIEM receiver:
     ```text
     🚨 [SIEM RECEIVER] Blocked Payload Received!
     ================================================
     Client Token: cG9zdHEtZm9ybXxtZXNzYWdlLWlucHV0fDF8aHR0cDovL2xvY2FsaG9zdDozMDAwL3YxL3RlbGVtZXRyeQ
     URL:          h_tt_p://localhost:3000/
     Rule Matched: currency_symbol
     Confidence:   100%
     PII Masked?   false
     Pasted?       false
     Actors:       []
     Sanitized:    "Win [CARD_MASKED] now!"
     ================================================
     ```

# About

- **Version:** 1.0.4 (v2 Engine)
- **Author:** [RedSocs](https://github.com/RedSocs)
- **License:** MIT
- **Model Origin:** Trained via [RedSocs/spam-labeler](https://github.com/RedSocs/spam-labeler)
- **Inquiries & Enterprise Support:** [pichit[at]redsocs.com](mailto:pichit@redsocs.com)
- **Sponsor:** [Buy Me a Coffee](https://buymeacoffee.com/redsocs?new=1)

---

### Technical Specs

| Property          | Value                     |
| ----------------- | ------------------------- |
| **Minified Size** | ~2.0 MB (including model) |
| **Gzipped Size**  | **~341 KB**               |
| **Dependencies**  | 0 (Vanilla JS)            |
| **Vocabulary**    | 36,017 features           |
