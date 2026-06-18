#!/usr/bin/env node
/**
 * Build script: bundles model.json into spamwarden.js → dist/
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname);
const MODEL = path.join(ROOT, 'model.json');
const DEFAULT_SRC = path.join(ROOT, 'src', 'spamwarden.js');
const SRC = process.env.SW_SRC ? path.resolve(process.env.SW_SRC) : DEFAULT_SRC;
const OUT = path.join(ROOT, 'dist', 'spamwarden.js');
const MIN = path.join(ROOT, 'dist', 'spamwarden.min.js');

console.log('=========================================');
console.log('  SpamWarden.js — Build');
console.log(`  Source: ${path.relative(ROOT, SRC)}`);
console.log('=========================================\n');

if (!fs.existsSync(MODEL)) {
  console.error('Error: model.json not found.');
  process.exit(1);
}
if (!fs.existsSync(SRC)) {
  console.error(`Error: Source file not found: ${SRC}`);
  process.exit(1);
}

if (!fs.existsSync(path.join(ROOT, 'dist'))) {
  fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true });
}

// ── Step 1: Bundle model and filter ─────────────────────────────────

console.log('[1/3] Bundling model and filter list into spamwarden.js...');
const modelRaw = fs.readFileSync(MODEL, 'utf-8');
const modelJson = JSON.parse(modelRaw);
const srcCode = fs.readFileSync(SRC, 'utf-8');

// Extract and save model version & feature count for version.sh
try {
  const version = modelJson.version || '0.0.0';
  const features = Object.keys(modelJson.vocabulary || {}).length;
  fs.writeFileSync(path.join(ROOT, 'model_version.txt'), version);
  fs.writeFileSync(path.join(ROOT, 'model_features.txt'), features.toString());
  console.log(`  ✓ Tracked model version (${version}) and features (${features})`);
} catch (err) {
  console.warn(`  ⚠️ Warning: Could not extract version/features from model.json: ${err.message}`);
}

// Load filter list
const filterDataPath = path.join(ROOT, 'src', 'spamwarden-data.js');
let filterJson = '[]';
if (fs.existsSync(filterDataPath)) {
  try {
    // Clear cache to read fresh filter data
    delete require.cache[require.resolve(filterDataPath)];
    filterJson = JSON.stringify(require(filterDataPath));
  } catch (e) {
    console.warn('  ⚠️ Warning: Could not read spamwarden-data.js, defaulting to empty list.');
  }
}

const bundled = srcCode
  .replace('MODEL_DATA_PLACEHOLDER', JSON.stringify(modelJson))
  .replace('FILTER_DATA_PLACEHOLDER', filterJson);

// Generate build-time randomized secret key for the real engine
const secretKey = '_sw_' + crypto.randomBytes(4).toString('hex');
const finalBundled = bundled.replace('__SECRET_FN_NAME__', `"${secretKey}"`);

fs.writeFileSync(OUT, finalBundled);

const outSize = fs.statSync(OUT).size;
console.log(`  Output: dist/spamwarden.js`);
console.log(`  Size:   ${(outSize / 1024).toFixed(0)} KB`);
console.log(`  Secret Key: ${secretKey} (Injected)`);

// ── Step 2: Obfuscate & Minify ───────────────────────────────────────

console.log('\n[2/3] Obfuscating and Minifying...');

async function build() {
  try {
    const JavaScriptObfuscator = require('javascript-obfuscator');
    const obfuscationResult = JavaScriptObfuscator.obfuscate(finalBundled, {
      compact: true,
      controlFlowFlattening: true,
      controlFlowFlatteningThreshold: 0.75,
      deadCodeInjection: true,
      deadCodeInjectionThreshold: 0.4,
      debugProtection: false,
      disableConsoleOutput: false,
      identifierNamesGenerator: 'hexadecimal',
      log: false,
      numbersToExpressions: true,
      renameGlobals: false,
      selfDefending: true,
      simplify: true,
      splitStrings: true,
      splitStringsChunkLength: 10,
      stringArray: true,
      stringArrayCallsTransform: true,
      stringArrayCallsTransformThreshold: 0.75,
      stringArrayEncoding: ['base64'],
      stringArrayIndexShift: true,
      stringArrayRotate: true,
      stringArrayShuffle: true,
      stringArrayWrappersCount: 2,
      stringArrayWrappersChainedCalls: true,
      stringArrayWrappersParametersMaxCount: 4,
      stringArrayWrappersType: 'function',
      stringArrayThreshold: 0.75,
      transformObjectKeys: true,
      unicodeEscapeSequence: false
    });
    
    fs.writeFileSync(MIN, obfuscationResult.getObfuscatedCode());
    console.log(`  ✓ Obfuscation complete.`);
  } catch (e) {
    console.warn(`  ⚠️ Warning: Obfuscation failed: ${e.message}`);
    // Fallback: Try terser if available
    try {
      const { minify } = require('terser');
      const result = await minify(finalBundled, { 
        compress: true, 
        mangle: true,
        format: { comments: false }
      });
      fs.writeFileSync(MIN, result.code);
      console.log(`  ✓ Fallback to Terser minification complete.`);
    } catch (te) {
      console.log(`  Terser not available, using unminified copy.`);
      fs.writeFileSync(MIN, finalBundled);
    }
  }
  
  reportSizes(OUT, MIN);
}

build();

function reportSizes(outPath, minPath) {
  const outBytes = fs.statSync(outPath).size;
  const minBytes = fs.statSync(minPath).size;
  const gzipped = zlib.gzipSync(fs.readFileSync(minPath));
  const gzSize = gzipped.length;

  console.log(`  Output: dist/spamwarden.min.js`);
  console.log(`  Size:   ${(minBytes / 1024).toFixed(0)} KB`);

  // Automatically sync to docs/js if docs exists
  const docsDir = path.join(ROOT, 'docs');
  if (fs.existsSync(docsDir)) {
    const docsJs = path.join(docsDir, 'js');
    if (!fs.existsSync(docsJs)) {
      fs.mkdirSync(docsJs, { recursive: true });
    }
    fs.copyFileSync(outPath, path.join(docsJs, 'spamwarden.js'));
    fs.copyFileSync(minPath, path.join(docsJs, 'spamwarden.min.js'));
    console.log('\n  ✓ Automatically copied to docs/js/');
  }

  console.log('\n[3/3] Summary');
  console.log(`  Uncompressed: ${outBytes.toLocaleString()} bytes (${(outBytes / 1024).toFixed(0)} KB)`);
  console.log(`  Minified:     ${minBytes.toLocaleString()} bytes (${(minBytes / 1024).toFixed(0)} KB)`);
  console.log(`  Gzipped:      ${gzSize.toLocaleString()} bytes (${(gzSize / 1024).toFixed(0)} KB)`);

  // Smoke test
  console.log('\n  Smoke test (dist/spamwarden.js):');
  try {
    delete require.cache[require.resolve(outPath)];
    const sw = require(outPath);
    const r1 = sw.spamcheck('สมัครสมาชิกวันนี้ รับโบนัส ฝากเงิน');
    const r2 = sw.spamcheck('Hello, the weather is nice today.');
    console.log(`  Spam:   ${r1.isSpam} (${(r1.prob * 100).toFixed(0)}%)`);
    console.log(`  Safe:   ${r2.isSpam} (${((1 - r2.prob) * 100).toFixed(0)}%)`);
    console.log(`  Version: ${sw.version}`);
  } catch (e) {
    console.log(`  (Cannot test — ${e.message})`);
  }

  console.log('\n=========================================');
  console.log('  Done! Include dist/spamwarden.min.js in your page.');
  console.log('  Usage: Ensure data-auto-protect is active.');
  console.log('  ⚠️ WARNING: Do NOT call window.spamwarden directly (Ghost Tarpit Active).');
  console.log('=========================================');
}
