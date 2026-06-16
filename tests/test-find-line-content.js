const fs = require('fs');
const path = require('path');

const dataDir = path.resolve(__dirname, 'data');
const files = fs.readdirSync(dataDir);
const safeName = files.find(f => f.startsWith('safe-') && f.endsWith('.txt'));
const safeFile = path.join(dataDir, safeName);

const safeLines = fs.readFileSync(safeFile, 'utf-8').split('\n');

safeLines.forEach((line, i) => {
  if (line.includes('ตกค้าง ไม่เคยเข้าระบบหรือเข้าไม่ได้') || line.includes('ขบวนพาเหรดที่แสนอบอุ่น')) {
    console.log(`Original Line ${i + 1}: "${line}"`);
  }
});
