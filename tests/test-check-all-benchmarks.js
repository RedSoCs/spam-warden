const fs = require('fs');
const path = require('path');

const dataDir = path.resolve(__dirname, 'data');
const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.txt'));

files.forEach(file => {
  const filePath = path.join(dataDir, file);
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  lines.forEach((line, i) => {
    if (line.includes('นักเรียนโรงเรียนบ้านควนพลี') || line.includes('SLOT ONLINE')) {
      console.log(`${file} Line ${i + 1}: contains target text`);
    }
  });
});
