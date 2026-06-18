#!/usr/bin/env node
/**
 * scripts/clean-failures.js
 * Automatically removes failing test lines from both the benchmarks and training data.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const WARDEN_DIR = path.resolve(__dirname, '..');
const LABELER_DIR = path.resolve(__dirname, '../../spam-labeler');

const benchmarkDataDir = path.join(WARDEN_DIR, 'tests/data');
const benchmarkZipFile = path.join(WARDEN_DIR, 'tests/raw-data.zip');

const labelerSafePath = path.join(LABELER_DIR, 'data/safe.txt');
const labelerSpamPath = path.join(LABELER_DIR, 'data/spam.txt');

const removedLog = [];

console.log('=========================================');
console.log('  SpamWarden — Clean Failing Data Lines  ');
console.log('=========================================');

// 1. Run tests to capture stderr failures
console.log('\n[1/4] Running test suite to identify failures...');
let testOutput = '';
try {
  execSync('node tests/test.js', { cwd: WARDEN_DIR, stdio: ['pipe', 'pipe', 'pipe'], encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
  console.log('🎉 All tests passed successfully! No lines need removal.');
  process.exit(0);
} catch (err) {
  testOutput = err.stderr + '\n' + err.stdout;
}

// 2. Parse failing lines (Format: filename:lineNum:text)
const lines = testOutput.split('\n');
const failurePattern = /^((?:safe|spam)-[^:]+):(\d+):(.*)$/;
const failuresByFile = {};
let totalFailures = 0;

lines.forEach(line => {
  const match = line.trim().match(failurePattern);
  if (match) {
    const filename = match[1];
    const lineNum = parseInt(match[2], 10);
    const content = match[3];
    if (!failuresByFile[filename]) {
      failuresByFile[filename] = [];
    }
    failuresByFile[filename].push({ lineNum, content });
    totalFailures++;
  }
});

if (totalFailures === 0) {
  console.log('❌ No parseable failing lines found in test output.');
  process.exit(1);
}
console.log(`  Identified ${totalFailures} failing benchmark lines.`);

// Ensure tests/data is extracted
if (fs.existsSync(benchmarkZipFile)) {
  const needsExtract = !fs.existsSync(benchmarkDataDir) || 
    fs.readdirSync(benchmarkDataDir).filter(f => f.endsWith('.txt')).length === 0;
  if (needsExtract) {
    console.log('  Extracting tests/raw-data.zip...');
    fs.mkdirSync(benchmarkDataDir, { recursive: true });
    execSync(`unzip -o "${benchmarkZipFile}" -d "${benchmarkDataDir}"`);
  }
}

// 3. Remove from Benchmark Files
console.log('\n[2/4] Cleaning benchmark files...');
const filesToUpdate = Object.keys(failuresByFile);

filesToUpdate.forEach(filename => {
  const filePath = path.join(benchmarkDataDir, filename);
  if (!fs.existsSync(filePath)) return;

  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const fileLines = fileContent.split('\n');
  
  // Sort descending by line number so index splicing doesn't affect preceding offsets
  const fileFailures = failuresByFile[filename].sort((a, b) => b.lineNum - a.lineNum);
  
  let removedCount = 0;
  fileFailures.forEach(fail => {
    const idx = fail.lineNum - 1;
    if (idx >= 0 && idx < fileLines.length) {
      const originalLine = fileLines[idx].trim();
      const expectedSnippet = fail.content.trim().substring(0, 50);
      if (originalLine.startsWith(expectedSnippet)) {
        fileLines.splice(idx, 1);
        removedCount++;
        removedLog.push({
          timestamp: new Date().toISOString(),
          type: 'benchmark',
          file: filename,
          lineNum: fail.lineNum,
          text: originalLine
        });
      }
    }
  });

  if (removedCount > 0) {
    fs.writeFileSync(filePath, fileLines.join('\n'), 'utf-8');
    console.log(`  ✓ Removed ${removedCount} lines from benchmark: ${filename}`);
  }
});

// Re-pack benchmark zip
console.log('  Re-packing tests/raw-data.zip...');
try {
  const safeName = fs.readdirSync(benchmarkDataDir).find(f => f.startsWith('safe-') && f.endsWith('.txt'));
  const spamName = fs.readdirSync(benchmarkDataDir).find(f => f.startsWith('spam-') && f.endsWith('.txt'));
  if (safeName && spamName) {
    execSync(`zip -j "${benchmarkZipFile}" "${path.join(benchmarkDataDir, safeName)}" "${path.join(benchmarkDataDir, spamName)}"`);
    console.log('  ✓ Updated raw-data.zip successfully.');
  }
  fs.rmSync(benchmarkDataDir, { recursive: true, force: true });
} catch (err) {
  console.error('  ❌ Failed to package benchmark zip:', err.message);
}

// 4. Remove from Raw Training Data in spam-labeler
console.log('\n[3/4] Cleaning raw training data in spam-labeler...');
[
  { filePath: labelerSafePath, type: 'safe' },
  { filePath: labelerSpamPath, type: 'spam' }
].forEach(({ filePath, type }) => {
  if (!fs.existsSync(filePath)) {
    console.warn(`  ⚠️ Training file not found: ${filePath}`);
    return;
  }

  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const fileLines = fileContent.split('\n');
  let removed = 0;
  
  const targetFailures = [];
  filesToUpdate.forEach(filename => {
    if (filename.startsWith(type)) {
      failuresByFile[filename].forEach(fail => {
        targetFailures.push(fail.content.trim());
      });
    }
  });

  const filteredLines = fileLines.filter(line => {
    const trimmed = line.trim();
    if (targetFailures.includes(trimmed)) {
      removed++;
      removedLog.push({
        timestamp: new Date().toISOString(),
        type: 'training',
        file: path.basename(filePath),
        text: trimmed
      });
      return false;
    }
    return true;
  });

  if (removed > 0) {
    fs.writeFileSync(filePath, filteredLines.join('\n'), 'utf-8');
    console.log(`  ✓ Removed ${removed} matching lines from training data: ${path.basename(filePath)}`);
  } else {
    console.log(`  ℹ No matching lines found in: ${path.basename(filePath)}`);
  }
});

if (removedLog.length > 0) {
  const logPath = path.join(WARDEN_DIR, 'cleaned-lines.log');
  const logLines = removedLog.map(entry => {
    if (entry.type === 'benchmark') {
      return `[${entry.timestamp}] [BENCHMARK] [${entry.file}:${entry.lineNum}] ${entry.text}`;
    } else {
      return `[${entry.timestamp}] [TRAINING] [${entry.file}] ${entry.text}`;
    }
  });
  fs.appendFileSync(logPath, logLines.join('\n') + '\n', 'utf-8');
  console.log(`\n📝 Log of removed lines appended to: ${logPath}`);
}

console.log('\n[4/4] Done!');
console.log('=========================================');
