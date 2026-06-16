#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const os = require('os');
const zlib = require('zlib');
const { spawnSync } = require('child_process');

const HOME = os.homedir();
const DOWNLOADS_DIR = path.join(HOME, 'Downloads');
const SPAM_LABELER_DIR = path.resolve(__dirname, '../spam-labeler');
const TARGET_DIR = path.join(SPAM_LABELER_DIR, 'data/spam-data-bucket/google search/raw');

console.log('=========================================');
console.log('  SpamWarden — Lazy Import & Retrain');
console.log('=========================================');

// 1. Verify target directory exists
if (!fs.existsSync(DOWNLOADS_DIR)) {
  console.error(`❌ Downloads directory not found at: ${DOWNLOADS_DIR}`);
  process.exit(1);
}
if (!fs.existsSync(TARGET_DIR)) {
  console.error(`❌ Target directory in spam-labeler not found at: ${TARGET_DIR}`);
  process.exit(1);
}

// 2. Scan Downloads for files matching spam.\d+.txt or safe.\d+.txt
console.log(`[1/6] Scanning ${DOWNLOADS_DIR} for raw download files...`);
const files = fs.readdirSync(DOWNLOADS_DIR);
const targetPattern = /^(spam|safe)\.\d+\.txt$/;
const filesToMove = files.filter(file => targetPattern.test(file));

if (filesToMove.length === 0) {
  console.log('  ℹ No new spam.*.txt or safe.*.txt files found in Downloads. Skipping import.');
} else {
  console.log(`  Found ${filesToMove.length} files to import.`);
  
  // Set up tests/data directory and extract raw-data.zip if needed
  const dataDir = path.join(__dirname, 'tests/data');
  const zipFile = path.join(__dirname, 'tests/raw-data.zip');
  
  if (fs.existsSync(zipFile)) {
    const needsExtract = !fs.existsSync(dataDir) || 
      fs.readdirSync(dataDir).filter(f => f.endsWith('.txt')).length === 0;
    if (needsExtract) {
      console.log('  Extracting current test data from raw-data.zip first...');
      fs.mkdirSync(dataDir, { recursive: true });
      const { execSync } = require('child_process');
      try {
        execSync(`unzip -o "${zipFile}" -d "${dataDir}"`);
      } catch (err) {
        console.warn('  ⚠️ Warning: Failed to extract raw-data.zip:', err.message);
      }
    }
  }

  // Find active safe/spam benchmark filenames
  const testFiles = fs.existsSync(dataDir) ? fs.readdirSync(dataDir) : [];
  let activeSafeFile = testFiles.find(f => f.startsWith('safe-') && f.endsWith('.txt'));
  let activeSpamFile = testFiles.find(f => f.startsWith('spam-') && f.endsWith('.txt'));

  // Fallbacks if not found
  if (!activeSafeFile) {
    const d = new Date();
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    activeSafeFile = `safe-${day}${month}${year}.txt`;
  }
  if (!activeSpamFile) {
    const d = new Date();
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    activeSpamFile = `spam-${day}${month}${year}.txt`;
  }

  const safeTestPath = path.join(dataDir, activeSafeFile);
  const spamTestPath = path.join(dataDir, activeSpamFile);

  filesToMove.forEach(file => {
    const srcPath = path.join(DOWNLOADS_DIR, file);
    const destPath = path.join(TARGET_DIR, file);
    try {
      // 1. Filter out comment lines and concat contents to tests/data benchmark first
      const rawContent = fs.readFileSync(srcPath, 'utf-8');
      const filteredContent = rawContent
        .split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 0 && !l.startsWith('#'))
        .join('\n');

      if (filteredContent.length > 0) {
        if (file.startsWith('safe')) {
          fs.appendFileSync(safeTestPath, '\n' + filteredContent);
          console.log(`  ✓ Concatenated ${file} -> tests/data/${activeSafeFile}`);
        } else if (file.startsWith('spam')) {
          fs.appendFileSync(spamTestPath, '\n' + filteredContent);
          console.log(`  ✓ Concatenated ${file} -> tests/data/${activeSpamFile}`);
        }
      }

      // 2. Move to spam-labeler (copyFileSync + unlinkSync)
      fs.copyFileSync(srcPath, destPath);
      fs.unlinkSync(srcPath);
      console.log(`  ✓ Moved: ${file} -> spam-labeler/.../raw/`);
    } catch (err) {
      console.error(`  ❌ Failed to process ${file}: ${err.message}`);
      process.exit(1);
    }
  });

  // B. Update tests/raw-data.zip and clean up extracted tests/data
  console.log('\n[2/6] Synchronizing benchmark tests/raw-data.zip...');
  const { execSync } = require('child_process');
  try {
    execSync(`zip -j "${zipFile}" "${safeTestPath}" "${spamTestPath}"`);
    console.log('  ✓ Updated tests/raw-data.zip successfully.');
  } catch (err) {
    console.error('  ❌ Failed to update raw-data.zip:', err.message);
    process.exit(1);
  }

  try {
    fs.rmSync(dataDir, { recursive: true, force: true });
    console.log('  ✓ Cleaned up temporary tests/data directory.');
  } catch (err) {
    console.warn('  ⚠️ Warning: Failed to clean up tests/data directory:', err.message);
  }
}

// 3. Execute retrain.sh in spam-labeler
console.log('\n[3/6] Executing retrain.sh in spam-labeler...');
const retrainScript = path.join(SPAM_LABELER_DIR, 'retrain.sh');
if (!fs.existsSync(retrainScript)) {
  console.error(`❌ retrain.sh not found at: ${retrainScript}`);
  process.exit(1);
}

const retrainResult = spawnSync('./retrain.sh', [], {
  cwd: SPAM_LABELER_DIR,
  stdio: 'inherit',
  shell: true
});

if (retrainResult.status !== 0) {
  console.error(`❌ retrain.sh failed with exit code ${retrainResult.status}`);
  process.exit(1);
}
console.log('  ✓ Retraining completed successfully.');

// 4. Copy and Ungzip model.json.gz from spam-labeler to spam-warden
console.log('\n[4/6] Extracting new model.json...');
const modelGzPath = path.join(SPAM_LABELER_DIR, 'extension/model.json.gz');
const destModelPath = path.resolve(__dirname, 'model.json');

if (!fs.existsSync(modelGzPath)) {
  console.error(`❌ Trained model.json.gz not found at: ${modelGzPath}`);
  process.exit(1);
}

try {
  const gzBuffer = fs.readFileSync(modelGzPath);
  const jsonBuffer = zlib.gunzipSync(gzBuffer);
  fs.writeFileSync(destModelPath, jsonBuffer);
  console.log(`  ✓ Decompressed and copied model.json to: ${destModelPath}`);
} catch (err) {
  console.error(`  ❌ Failed to decompress/copy model: ${err.message}`);
  process.exit(1);
}

// 5. Rebuild spam-warden library with the new model
console.log('\n[5/6] Rebuilding spam-warden with the new model...');
const buildResult = spawnSync('npm', ['run', 'build'], {
  cwd: __dirname,
  stdio: 'inherit',
  shell: true
});

if (buildResult.status !== 0) {
  console.error(`❌ npm run build failed with exit code ${buildResult.status}`);
  process.exit(1);
}
console.log('  ✓ Rebuild completed successfully.');

// 6. Run tests
console.log('\n[6/6] Running tests in spam-warden...');
const testResult = spawnSync('npm', ['test'], {
  cwd: __dirname,
  stdio: 'inherit',
  shell: true
});

if (testResult.status !== 0) {
  console.error(`❌ Tests failed with exit code ${testResult.status}`);
  process.exit(1);
}

console.log('\n=========================================');
console.log('  🎉 All steps completed successfully!');
console.log('=========================================');
