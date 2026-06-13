# SpamWarden.js

Lightweight, client-side JavaScript library for real-time spam detection and automated form protection. Optimized for Thai text and high-performance browser environments.

[![CI](https://github.com/RedSocs/spam-warden/actions/workflows/ci.yml/badge.svg)](https://github.com/RedSocs/spam-warden/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/%40redsocs%2Fspam-warden.svg)](https://www.npmjs.com/package/@redsocs/spam-warden)

# What is this?

**SpamWarden.js** is a zero-dependency, client-side engine that detects spam directly in the user's browser. It uses a **Bernoulli Naive Bayes** model trained specifically on Thai spam patterns (gambling, loans, "fast money" scams).

By running in the browser, it allows you to **block spam before it ever hits your database**, saving server resources and keeping your data clean.

# Quickstart

### 1. The "No-Code" Way (Auto-Blocking)

Add this script to your page. It will automatically find your form and block submission if spam is detected.

```html
<script src="https://cdn.redsocs.com/js/spamwarden.min.js?client=U0lURV9UT0tFTnxteS1mb3JtLWlkfG15LWlucHV0LWlk"></script>
```

_Note: The `client` parameter is a Base64 string of `siteToken|formId|inputId`._

### 2. Manual Configuration

```html
<script src="dist/spamwarden.min.js"></script>
<script>
  spamwarden.configure({
    siteToken: "YOUR_TOKEN",
    formId: "contact-form",
    inputId: "message-field",
    autoReport: true, // Send telemetry to api.redsocs.com
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
  - **Hard Rules:** Instant blocking for currency symbols (`$€£฿`) and known spam link patterns (`line.me`, `bit.ly`).
  - **Thai-Optimized Tokenizer:** Extracts whitespace tokens, **trigrams**, and **quadgrams** to handle the space-less nature of the Thai language.
  - **Bernoulli NB Model:** A compact AI model trained on thousands of real-world spam samples.
- **Telemetry System:** Optional auto-reporting of spam hits to `api.redsocs.com` for global threat intelligence.
- **Auto-Interceptor:** Event listeners that hook into DOM forms to provide "Drop-in" protection.

# Why this exists?

Traditional spam filters (like Akismet or ReCaptcha) often:

1. Require a round-trip to a server (latency).
2. Are expensive for high-volume sites.
3. Over-collect user data (privacy concerns).
4. Struggle with specific Thai-language spam patterns.

**SpamWarden** exists to provide a **local, fast, and Thai-centric** alternative that stops spam at the source: the user's input field.

# About

- **Version:** 0.70 (v2 Engine)
- **Author:** [RedSocs](https://github.com/RedSocs)
- **License:** MIT
- **Model Origin:** Trained via [RedSocs/spam-labeler](https://github.com/RedSocs/spam-labeler)

---

### Technical Specs

| Property          | Value                    |
| ----------------- | ------------------------ |
| **Minified Size** | ~63 KB (including model) |
| **Gzipped Size**  | **~27 KB**               |
| **Dependencies**  | 0 (Vanilla JS)           |
| **Vocabulary**    | ~63,000 features         |
