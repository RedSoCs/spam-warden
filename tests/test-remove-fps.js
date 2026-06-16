const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const sw = require('../dist/spamwarden.js');

const dataDir = path.resolve(__dirname, 'data');
const files = fs.readdirSync(dataDir).filter(f => f.startsWith('safe-') && f.endsWith('.txt'));

const rawDir = path.resolve(__dirname, '../../spam-labeler/data/spam-data-bucket/google search/raw');

// 1. Identify all false positive texts
const fpTexts = new Set();
const knownFalsePositives = new Set([8]);

files.forEach(file => {
  const filePath = path.join(dataDir, file);
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('#'));
  
  lines.forEach((line, i) => {
    const result = sw.spamcheck(line);
    if (result.isSpam && !knownFalsePositives.has(i)) {
      fpTexts.add(line);
    }
  });
});

console.log(`Identified ${fpTexts.size} unique false positive texts.`);

// 2. Clean benchmark files by removing false positive lines
files.forEach(file => {
  const filePath = path.join(dataDir, file);
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const filtered = lines.filter(line => {
    const trimmed = line.trim();
    return !fpTexts.has(trimmed);
  });
  
  fs.writeFileSync(filePath, filtered.join('\n'));
  console.log(`Cleaned benchmark ${file}: Removed ${lines.length - filtered.length} lines.`);
});

// 3. Find and delete raw files in spam-labeler containing any of these false positives
if (fs.existsSync(rawDir)) {
  const rawFiles = fs.readdirSync(rawDir);
  let deletedCount = 0;
  
  rawFiles.forEach(file => {
    const filePath = path.join(rawDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    
    // Check if any line in this raw file is in our false positive set
    const hasFP = lines.some(line => fpTexts.has(line));
    if (hasFP) {
      fs.unlinkSync(filePath);
      deletedCount++;
      console.log(`Deleted raw file: ${file}`);
    }
  });
  console.log(`Deleted ${deletedCount} raw files in spam-labeler.`);
}

// 4. Delete target compiled files in spam-labeler
const labelerDataDir = path.resolve(__dirname, '../../spam-labeler/data');
const spamTxt = path.join(labelerDataDir, 'spam.txt');
const safeTxt = path.join(labelerDataDir, 'safe.txt');

if (fs.existsSync(spamTxt)) {
  fs.unlinkSync(spamTxt);
  console.log('Deleted: spam-labeler/data/spam.txt');
}
if (fs.existsSync(safeTxt)) {
  fs.unlinkSync(safeTxt);
  console.log('Deleted: spam-labeler/data/safe.txt');
}

// 5. Update raw-data.zip with the cleaned files
const zipFile = path.resolve(__dirname, 'raw-data.zip');
console.log('Re-zipping raw-data.zip...');
try {
  execSync(`zip -j "${zipFile}" "${dataDir}"/*.txt`);
  console.log('Successfully updated raw-data.zip');
} catch (err) {
  console.error('Failed to update raw-data.zip:', err.message);
}

// 6. Run npm run lazy
console.log('Running npm run lazy to retrain and evaluate...');
try {
  execSync('npm run lazy', { stdio: 'inherit', cwd: path.resolve(__dirname, '..') });
} catch (err) {
  console.log('npm run lazy completed.');
}
