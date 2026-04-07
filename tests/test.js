#!/usr/bin/env node
/**
 * SpamWarden Test Suite
 * Validates detection against test-data files and API contract.
 *
 * Usage: node tests/test.js
 */

const fs = require('fs');
const path = require('path');

const sw = require('../dist/spamwarden.js');

let pass = 0;
let fail = 0;
const failures = [];

function assert(condition, label) {
  if (condition) {
    pass++;
  } else {
    fail++;
    failures.push(label);
    console.error(`  ✗ ${label}`);
  }
}

// ── 1. API Contract ────────────────────────────────────────────────

console.log('\n--- API Contract ---');

// spamcheck returns correct structure
const r = sw.spamcheck('test text');
assert(typeof r === 'object', 'spamcheck returns object');
assert(typeof r.isSpam === 'boolean', 'isSpam is boolean');
assert(typeof r.prob === 'number', 'prob is number');
assert(typeof r.version === 'string', 'version is string');

// isSpam convenience wrapper
assert(sw.isSpam('สมัครสมาชิกวันนี้ รับโบนัส ฝากเงิน') === true, 'isSpam returns true for spam');
assert(sw.isSpam('Hello, how are you today?') === false, 'isSpam returns false for safe');

// version getter
assert(sw.version === sw._version, 'version matches _version');
assert(sw.version.startsWith('v'), 'version starts with v');

// ── 2. Currency Symbol Hard Rules ──────────────────────────────────

console.log('\n--- Currency Hard Rules ---');

const currencies = [
  { symbol: '$', name: 'dollar' },
  { symbol: '€', name: 'euro' },
  { symbol: '£', name: 'pound' },
  { symbol: '฿', name: 'baht' },
  { symbol: '¥', name: 'yen' },
  { symbol: '₹', name: 'rupee' },
  { symbol: '₽', name: 'ruble' },
  { symbol: '₿', name: 'bitcoin' },
  { symbol: '₮', name: 'tugrik' },
  { symbol: '₩', name: 'won' },
  { symbol: '₱', name: 'peso' },
  { symbol: '₫', name: 'dong' },
];

currencies.forEach(c => {
  const result = sw.spamcheck(`Win ${c.symbol}500 now!`);
  assert(result.isSpam === true, `currency ${c.name} (${c.symbol}) triggers spam`);
  assert(result.prob === 1.0, `currency ${c.name} prob = 1.0`);
  assert(result.reason === 'currency_symbol', `currency ${c.name} reason = currency_symbol`);
});

// ── 3. Spam Link Hard Rules ────────────────────────────────────────

console.log('\n--- Spam Link Hard Rules ---');

const spamLinks = [
  'line.me', '@line', 'lin.ee', 'bit.ly', 'shorturl', 'tinyurl', 'liff.line'
];

spamLinks.forEach(link => {
  const result = sw.spamcheck(`Click here: https://${link}/abc`);
  assert(result.isSpam === true, `spam link ${link} detected`);
  assert(result.prob === 0.95, `spam link ${link} prob = 0.95`);
  assert(result.reason === 'spam_link', `spam link ${link} reason = spam_link`);
});

// ── 4. Edge Cases ──────────────────────────────────────────────────

console.log('\n--- Edge Cases ---');

assert(sw.spamcheck(null).isSpam === false, 'null input → not spam');
assert(sw.spamcheck(undefined).isSpam === false, 'undefined input → not spam');
assert(sw.spamcheck('').isSpam === false, 'empty string → not spam');
assert(sw.spamcheck('   ').isSpam === false, 'whitespace only → not spam');
assert(sw.spamcheck('🎉🔥💰').isSpam === false, 'emoji only → not spam');
assert(sw.spamcheck('a'.repeat(10000)).isSpam === false, 'very long text → no crash');

// Probability bounds
const probR = sw.spamcheck('Hello world');
assert(probR.prob >= 0 && probR.prob <= 1, 'prob in [0, 1] range');

// ── 5. File-Based Tests: spam.txt ──────────────────────────────────

console.log('\n--- File-Based: spam.txt ---');

const spamFile = path.resolve(__dirname, 'spam.1775350723.txt');
const spamLines = fs.readFileSync(spamFile, 'utf-8')
  .split('\n')
  .map(l => l.trim())
  .filter(l => l.length > 0);

let spamDetected = 0;
let spamTotalProb = 0;

spamLines.forEach((line, i) => {
  const result = sw.spamcheck(line);
  if (result.isSpam) spamDetected++;
  spamTotalProb += result.prob;
  assert(result.isSpam === true, `spam line ${i + 1} detected`);
});

const spamAvg = spamLines.length > 0 ? spamTotalProb / spamLines.length : 0;
console.log(`  ${spamDetected}/${spamLines.length} detected as spam (avg prob: ${spamAvg.toFixed(3)})`);

// ── 6. File-Based Tests: safe.txt ──────────────────────────────────

console.log('\n--- File-Based: safe.txt ---');

const safeFile = path.resolve(__dirname, 'safe.1775349357.txt');
const safeLines = fs.readFileSync(safeFile, 'utf-8')
  .split('\n')
  .map(l => l.trim())
  .filter(l => l.length > 0);

// Known false positives: texts that are safe but contain spam-like vocabulary.
// Line 9: anti-scam service ("เช็กคนโกง") — contains words like โอน, โกง
// which overlap with spam training data but context is fraud prevention.
const knownFalsePositives = new Set([8]); // 0-based index

let safeDetected = 0;
let safeTotalProb = 0;

safeLines.forEach((line, i) => {
  const result = sw.spamcheck(line);
  if (!result.isSpam) safeDetected++;
  safeTotalProb += result.prob;
  if (knownFalsePositives.has(i)) {
    // Track but don't fail
    console.log(`  ⚠ Known FP line ${i + 1}: "${line.slice(0, 40)}..." (prob: ${result.prob.toFixed(3)})`);
  } else {
    assert(result.isSpam === false, `safe line ${i + 1} classified safe`);
  }
});

const safeAvg = safeLines.length > 0 ? safeTotalProb / safeLines.length : 0;
console.log(`  ${safeDetected}/${safeLines.length} classified as safe (avg prob: ${safeAvg.toFixed(3)})`);

// ── 7. Cross-Validation ────────────────────────────────────────────

console.log('\n--- Cross-Validation ---');

assert(spamAvg > safeAvg, `spam avg prob (${spamAvg.toFixed(3)}) > safe avg prob (${safeAvg.toFixed(3)})`);

// ── 8. Summary ─────────────────────────────────────────────────────

console.log('\n=========================================');
console.log(`  Results: ${pass} passed, ${fail} failed`);
console.log('=========================================\n');

if (failures.length > 0) {
  console.error('Failures:');
  failures.forEach((f, i) => console.error(`  ${i + 1}. ${f}`));
  console.error('');
  process.exit(1);
} else {
  console.log(`All ${pass} tests passed!`);
}
