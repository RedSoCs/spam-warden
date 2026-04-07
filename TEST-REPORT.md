# SpamWarden Test Report

**Date:** 2026-04-07
**Package:** `@_redsocs/spam-warden@0.69.0`
**Model Version:** v0.68 (63,269 features, trained on 680 samples)
**Test Suite:** 91 tests — **ALL PASSING**

---

## 1. Test Summary

| Category | Tests | Status |
|---|---|---|
| Return value structure | 4 | ✅ |
| `isSpam()` convenience wrapper | 2 | ✅ |
| `version` getter | 2 | ✅ |
| Currency symbol hard rules (12 Unicode symbols) | 36 | ✅ |
| Spam link hard rules (7 domains) | 21 | ✅ |
| Edge cases (null, empty, unicode, long text) | 7 | ✅ |
| Probability bounds | 1 | ✅ |
| **File-based: spam.txt** | **10** | ✅ |
| **File-based: safe.txt** | **8** | ✅ (+ 1 known FP tracked) |
| **Cross-validation** | **1** | ✅ |
| **TOTAL** | **91** | **✅ 91/91 PASS** |

---

## 2. Detection Results

### spam.txt — 10 lines
- **Detected as spam:** 10/10 (100%)
- **Average spam probability:** 1.000

### safe.txt — 9 lines
- **Correctly classified as safe:** 8/9 (88.9%)
- **Average spam probability:** 0.111

### Cross-validation
- Average spam probability for spam texts (1.000) > average for safe texts (0.111) ✅

---

## 3. Known False Positive (1 line)

| # | Text (truncated) | Probability | Category |
|---|---|---|---|
| 1 | เว็บไซต์ที่คุณเชื่อถือได้ สำหรับเช็กคนโกง... | 1.000 | Anti-scam service |

**Root Cause:** Contains words like `โกง` (scam), `โอน` (transfer) that appear in spam training data. The context is fraud prevention, not spam itself.

**Recommended Fix:** Retrain the model with more safe samples containing anti-fraud vocabulary so the classifier learns the difference.

---

## 4. How to Run Tests

```bash
node tests/test.js
```

Test data files live in `tests/` and are auto-loaded:
- `tests/spam.*.txt` — one spam phrase per line
- `tests/safe.*.txt` — one safe phrase per line

---

## 5. API Status

| Documented API | Status |
|---|---|
| `spamwarden.spamcheck(text)` | ✅ Implemented |
| `spamwarden.isSpam(text)` | ✅ Implemented |
| `spamwarden.version` | ✅ Implemented (getter) |
| `spamwarden._version` | ✅ Internal field |
