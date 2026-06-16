/**
 * Optimize Offset: Find the best threshold offset function for Present-Only Naive Bayes.
 * Runs against the actual spam/safe datasets to evaluate accuracy.
 */

const fs = require('fs');
const path = require('path');
const sw = require('../dist/spamwarden.js');

sw.init();

// Load data files
const dataDir = path.resolve(__dirname, 'data');
const spamFile = path.join(dataDir, 'spam-data.txt'); // we'll find actual names below
const safeFile = path.join(dataDir, 'safe-data.txt');

// Find actual file names in tests/data
const files = fs.readdirSync(dataDir);
const spamName = files.find(f => f.startsWith('spam-') && f.endsWith('.txt'));
const safeName = files.find(f => f.startsWith('safe-') && f.endsWith('.txt'));

if (!spamName || !safeName) {
  console.error('Test files not found in tests/data');
  process.exit(1);
}

const spamLines = fs.readFileSync(path.join(dataDir, spamName), 'utf-8')
  .split('\n').map(l => l.trim()).filter(l => l.length > 0);
const safeLines = fs.readFileSync(path.join(dataDir, safeName), 'utf-8')
  .split('\n').map(l => l.trim()).filter(l => l.length > 0);

console.log(`Loaded ${spamLines.length} spam lines and ${safeLines.length} safe lines.`);

// The user's false positive text
const userText = `คำว่า "mag" สามารถสื่อถึงได้หลายความหมาย ขึ้นอยู่กับบริบทที่คุณกำลังค้นหา ดังนี้:แมกนีเซียม (Magnesium / Mag): แร่ธาตุและอาหารเสริมที่ช่วยเรื่องการนอนหลับและลดอาการตะคริว สามารถดูข้อมูลผลิตภัณฑ์ได้จากร้านค้าชั้นนำเช่น Shopeeการเชื่อม MAG: กระบวนการเชื่อมโลหะ (Metal Active Gas) ค้นหาข้อมูลเพิ่มเติมได้จากบทความของ PumpkinMSI MAG: ซีรีส์อุปกรณ์และจอมอนิเตอร์สำหรับเกมเมอร์ เลือกดูรุ่นและราคาได้ที่ MSI Store Thailandแม็กกาซีน (Magazine): นิตยสารประเภทต่างๆ เช่น The Guitar Mag สำหรับคนดนตรี หรือรีวิวรถยนต์ที่ HeadLight Magazineหากคุณต้องการข้อมูลในด้านไหนเพิ่มเติม สามารถแจ้งรายละเอียดเพื่อให้ผมช่วยค้นหาได้เลยครับ`;

// Custom spam check using a dynamic offset function
function customCheck(input, offsetFn) {
  if (!input || typeof input !== "string") { return { isSpam: false }; }
  
  const lightResult = sw.lightcheck(input);
  if (lightResult.isSpam) return lightResult;
  
  const presentFeatures = sw._transform(input);
  const nClasses = sw._classes.length;
  const scores = new Float64Array(nClasses);
  
  for (let c = 0; c < nClasses; c++) {
    let s = sw._classLogPrior[c];
    for (let k = 0; k < presentFeatures.length; k++) {
      s += sw._featureLogProb[c][presentFeatures[k]];
    }
    scores[c] = s;
  }
  
  // Apply dynamic offset
  const offset = offsetFn(presentFeatures.length);
  scores[1] -= offset;
  
  return { isSpam: scores[1] > scores[0], scoreDiff: scores[1] - scores[0] };
}

// Test various offset functions
const functions = [
  { name: "Constant 8.0 (Original)", fn: (N) => 8.0 },
  { name: "Linear 8.0 + 0.1*N", fn: (N) => 8.0 + 0.1 * N },
  { name: "Linear 8.0 + 0.15*N", fn: (N) => 8.0 + 0.15 * N },
  { name: "Linear 8.0 + 0.2*N", fn: (N) => 8.0 + 0.2 * N },
  { name: "Linear 8.0 + 0.25*N", fn: (N) => 8.0 + 0.25 * N },
  { name: "Linear 8.0 + 0.3*N", fn: (N) => 8.0 + 0.3 * N },
  { name: "Linear 6.0 + 0.2*N", fn: (N) => 6.0 + 0.2 * N },
  { name: "Linear 6.0 + 0.25*N", fn: (N) => 6.0 + 0.25 * N },
  { name: "Linear 6.0 + 0.3*N", fn: (N) => 6.0 + 0.3 * N },
  { name: "Non-linear 8.0 + 1.5 * Math.sqrt(N)", fn: (N) => 8.0 + 1.5 * Math.sqrt(N) },
  { name: "Non-linear 8.0 + 2.0 * Math.sqrt(N)", fn: (N) => 8.0 + 2.0 * Math.sqrt(N) },
  { name: "Non-linear 8.0 + 2.5 * Math.sqrt(N)", fn: (N) => 8.0 + 2.5 * Math.sqrt(N) },
  { name: "Non-linear 6.0 + 2.5 * Math.sqrt(N)", fn: (N) => 6.0 + 2.5 * Math.sqrt(N) },
];

functions.forEach(cfg => {
  let spamDetected = 0;
  let safeFalsePositives = 0;
  
  spamLines.forEach(line => {
    if (customCheck(line, cfg.fn).isSpam) spamDetected++;
  });
  
  safeLines.forEach(line => {
    if (customCheck(line, cfg.fn).isSpam) safeFalsePositives++;
  });
  
  const userTextResult = customCheck(userText, cfg.fn).isSpam;
  
  console.log(`--- ${cfg.name} ---`);
  console.log(`  Spam detection:   ${spamDetected}/${spamLines.length} (${(spamDetected/spamLines.length*100).toFixed(2)}%)`);
  console.log(`  Safe FP rate:     ${safeFalsePositives}/${safeLines.length} (${(safeFalsePositives/safeLines.length*100).toFixed(2)}%)`);
  console.log(`  User text isSpam: ${userTextResult ? '🔴 SPAM (FAIL)' : '🟢 SAFE (PASS)'}`);
  console.log(`  Total Errors:     ${(spamLines.length - spamDetected) + safeFalsePositives}`);
  console.log('');
});
