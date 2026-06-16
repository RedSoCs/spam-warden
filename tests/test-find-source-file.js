const fs = require('fs');
const path = require('path');

const targetDir = path.resolve(__dirname, '../../spam-labeler/data/spam-data-bucket/google search/raw');
if (!fs.existsSync(targetDir)) {
  console.log('Target directory does not exist:', targetDir);
  process.exit(1);
}

const files = fs.readdirSync(targetDir);

files.forEach(file => {
  const filePath = path.join(targetDir, file);
  const content = fs.readFileSync(filePath, 'utf-8');
  if (content.includes('นักเรียนโรงเรียนบ้านควนพลี') || content.includes('SLOT ONLINE')) {
    console.log(`Found in file: ${file}`);
  }
});
