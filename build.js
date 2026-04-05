#!/usr/bin/env node
// Build script: bundles model.json into spamwarden.js → dist/spamwarden.min.js

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname);
const MODEL = path.join(ROOT, "model.json");
const SRC = path.join(ROOT, "src", "spamwarden.js");
const OUT = path.join(ROOT, "dist", "spamwarden.js");
const MIN = path.join(ROOT, "dist", "spamwarden.min.js");

console.log("=========================================");
console.log("  SpamWarden.js — Build");
console.log("=========================================\n");

if (!fs.existsSync(MODEL)) {
  console.error("Error: model.json not found. Copy from spam-labeler/extension/model.json");
  process.exit(1);
}
if (!fs.existsSync(SRC)) {
  console.error("Error: src/spamwarden.js not found.");
  process.exit(1);
}

if (!fs.existsSync(path.join(ROOT, "dist"))) {
  fs.mkdirSync(path.join(ROOT, "dist"), { recursive: true });
}

// Step 1: Bundle model
console.log("[1/3] Bundling model.json into spamwarden.js...");
const modelJson = fs.readFileSync(MODEL, "utf-8");
const src = fs.readFileSync(SRC, "utf-8");
const bundled = src.replace("MODEL_DATA_PLACEHOLDER", modelJson);
fs.writeFileSync(OUT, bundled);
const outSize = fs.statSync(OUT).size;
console.log(`  Output: dist/spamwarden.js`);
console.log(`  Size:   ${(outSize / 1024).toFixed(0)} KB`);

// Step 2: Minify
console.log("\n[2/3] Minifying...");
try {
  const { minify } = require("terser");
  minify(bundled, { compress: true, mangle: true }).then((result) => {
    fs.writeFileSync(MIN, result.code);
    const minSize = fs.statSync(MIN).size;
    console.log(`  Minified with terser`);
    console.log(`  Output: dist/spamwarden.min.js`);
    console.log(`  Size:   ${(minSize / 1024).toFixed(0)} KB`);
    finishReport(OUT, MIN);
  });
} catch (e) {
  // Fallback: simple minification
  const simpleMinified = bundled
    .replace(/\/\/.*$/gm, "")        // strip line comments
    .replace(/\/\*[\s\S]*?\*\//g, "") // strip block comments
    .replace(/\n\s*\n/g, "\n")        // strip blank lines
    .replace(/\s{2,}/g, " ")          // collapse whitespace
    .trim();
  fs.writeFileSync(MIN, simpleMinified);
  const minSize = fs.statSync(MIN).size;
  console.log(`  Terser not installed — simple minification applied`);
  console.log(`  For production: npm install terser`);
  console.log(`  Output: dist/spamwarden.min.js`);
  console.log(`  Size:   ${(minSize / 1024).toFixed(0)} KB`);
  finishReport(OUT, MIN);
}

function finishReport(outPath, minPath) {
  const outBytes = fs.statSync(outPath).size;
  const minBytes = fs.statSync(minPath).size;

  // Estimate gzip size
  const zlib = require("zlib");
  const gzipped = zlib.gzipSync(fs.readFileSync(minPath));
  const gzSize = gzipped.length;

  console.log("\n[3/3] Summary");
  console.log(`  Uncompressed: ${outBytes.toLocaleString()} bytes (${(outBytes / 1024).toFixed(0)} KB)`);
  console.log(`  Minified:     ${minBytes.toLocaleString()} bytes (${(minBytes / 1024).toFixed(0)} KB)`);
  console.log(`  Gzipped:      ${gzSize.toLocaleString()} bytes (${(gzSize / 1024).toFixed(0)} KB)`);

  // Smoke test
  console.log("\n  Smoke test:");
  try {
    // Use the bundled file (not minified, easier to debug)
    delete require.cache[require.resolve(outPath)];
    const sw = require(outPath);
    const r1 = sw.spamcheck("สมัครสมาชิกวันนี้ รับโบนัส ฝากเงิน");
    const r2 = sw.spamcheck("Hello, the weather is nice today.");
    console.log(`  Spam:   ${r1.isSpam} (${(r1.prob * 100).toFixed(0)}%)`);
    console.log(`  Safe:   ${r2.isSpam} (${((1 - r2.prob) * 100).toFixed(0)}%)`);
    console.log(`  Version: ${sw.version}`);
  } catch (e) {
    console.log(`  (Cannot test — running in Node: ${e.message})`);
  }

  console.log("\n=========================================");
  console.log("  Done! Include dist/spamwarden.min.js in your page.");
  console.log("  Usage: spamwarden.spamcheck(text)");
  console.log("=========================================");
}
