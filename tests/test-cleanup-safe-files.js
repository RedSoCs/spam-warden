const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const dataDir = path.resolve(__dirname, 'data');
const files = fs.readdirSync(dataDir).filter(f => f.startsWith('safe-') && f.endsWith('.txt'));

files.forEach(file => {
  const filePath = path.join(dataDir, file);
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  
  // Filter out any lines containing 'นักเรียนโรงเรียนบ้านควนพลี' or 'SLOT ONLINE'
  const filteredLines = lines.filter(line => {
    return !line.includes('นักเรียนโรงเรียนบ้านควนพลี') && !line.includes('SLOT ONLINE');
  });
  
  fs.writeFileSync(filePath, filteredLines.join('\n'));
  console.log(`Cleaned ${file}: Removed ${lines.length - filteredLines.length} lines`);
});

// Update raw-data.zip
const zipFile = path.resolve(__dirname, 'raw-data.zip');
console.log('Updating raw-data.zip...');
try {
  execSync(`zip -j "${zipFile}" "${dataDir}"/*.txt`);
  console.log('Successfully updated raw-data.zip');
} catch (err) {
  console.error('Failed to update raw-data.zip:', err.message);
}
