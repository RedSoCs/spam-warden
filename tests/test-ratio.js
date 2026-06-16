#!/usr/bin/env node
/**
 * Test script to check classification metrics, prob ratios, and edge cases.
 * Usage: node tests/test-ratio.js
 */

const fs = require("fs");
const path = require("path");
const sw = require("../dist/spamwarden.js");

console.log("=========================================");
console.log("  SpamWarden — Query & Ratio Verification");
console.log("=========================================\n");

const testCases = [
  {
    text: "หวยใต้ดิน แทงเลย",
    expected: true,
    label: "Lottery/Casino Spam (Thai)",
  },
  {
    text: "Hello, how are you today?",
    expected: false,
    label: "Neutral English Text",
  },
  {
    text: "สมัครสมาชิกวันนี้เพื่อรับเครดิตฟรี",
    expected: true,
    label: "Casino Register Promo (Thai)",
  },
  {
    text: "รายงานการประชุมคณะกรรมการบริหารวันนี้",
    expected: false,
    label: "Normal Thai Office Text",
  },
];

let passes = 0;
let fails = 0;

testCases.forEach((tc, idx) => {
  const result = sw.spamcheck(tc.text);
  const isCorrect = result.isSpam === tc.expected;

  if (isCorrect) {
    passes++;
  } else {
    fails++;
  }

  console.log(`[Case ${idx + 1}] ${tc.label}`);
  console.log(
    `  Input excerpt: "${tc.text.length > 50 ? tc.text.substring(0, 50) + "..." : tc.text}"`,
  );
  console.log(
    `  Prediction:    ${result.isSpam ? "🔴 SPAM" : "🟢 HAM (Safe)"}`,
  );
  console.log(`  Probability:   ${(result.prob * 100).toFixed(6)}%`);
  console.log(`  Expected:      ${tc.expected ? "🔴 SPAM" : "🟢 HAM (Safe)"}`);
  console.log(`  Status:        ${isCorrect ? "✅ PASS" : "❌ FAIL"}`);
  console.log("-----------------------------------------");
});

console.log(`\nResults: ${passes} passed, ${fails} failed.`);
console.log(`Verification: ${fails === 0 ? "SUCCESS 🎉" : "FAILURE ❌"}`);

if (fails > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
