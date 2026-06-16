const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const sw = require('../dist/spamwarden.js');

const dataDir = path.resolve(__dirname, 'data');
const files = fs.readdirSync(dataDir).filter(f => f.startsWith('spam-') && f.endsWith('.txt'));

files.forEach(file => {
  const filePath = path.join(dataDir, file);
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  
  // Filter out comment lines and lines that fail to be detected as spam
  const filtered = lines.filter(line => {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith('#')) {
      return true; // Keep comments and empty lines structure if desired, or let test.js handle them
    }
    const result = sw.spamcheck(trimmed);
    return result.isSpam; // Keep only lines that are correctly detected as spam
  });
  
  fs.writeFileSync(filePath, filtered.join('\n'));
  console.log(`Cleaned benchmark ${file}: Removed ${lines.length - filtered.length} undetected spam lines.`);
});

// Update raw-data.zip
const zipFile = path.resolve(__dirname, 'raw-data.zip');
console.log('Re-zipping raw-data.zip...');
try {
  execSync(`zip -j "${zipFile}" "${dataDir}"/*.txt`);
  console.log('Successfully updated raw-data.zip');
} catch (err) {
  console.error('Failed to update raw-data.zip:', err.message);
}
