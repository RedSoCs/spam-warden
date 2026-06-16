const fs = require('fs');
const path = require('path');

const dataDir = path.resolve(__dirname, 'data');
const files = fs.readdirSync(dataDir);
const safeName = files.find(f => f.startsWith('safe-') && f.endsWith('.txt'));
const safeFile = path.join(dataDir, safeName);

const safeLines = fs.readFileSync(safeFile, 'utf-8').split('\n');

for (let i = 635; i <= 645; i++) {
  console.log(`Line ${i + 1}: "${safeLines[i]}"`);
}
