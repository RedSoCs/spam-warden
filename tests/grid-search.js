/**
 * Grid search to find the optimal offset formula (base + slope * N)
 */

const fs = require('fs');
const path = require('path');
const sw = require('../dist/spamwarden.js');

sw.init();

const dataDir = path.resolve(__dirname, 'data');
const files = fs.readdirSync(dataDir);
const spamName = files.find(f => f.startsWith('spam-') && f.endsWith('.txt'));
const safeName = files.find(f => f.startsWith('safe-') && f.endsWith('.txt'));

const spamLines = fs.readFileSync(path.join(dataDir, spamName), 'utf-8')
  .split('\n').map(l => l.trim()).filter(l => l.length > 0);
const safeLines = fs.readFileSync(path.join(dataDir, safeName), 'utf-8')
  .split('\n').map(l => l.trim()).filter(l => l.length > 0);

const userText = `คำว่า "mag" สามารถสื่อถึงได้หลายความหมาย ขึ้นอยู่กับบริบทที่คุณกำลังค้นหา ดังนี้:แมกนีเซียม (Magnesium / Mag): แร่ธาตุและอาหารเสริมที่ช่วยเรื่องการนอนหลับและลดอาการตะคริว สามารถดูข้อมูลผลิตภัณฑ์ได้จากร้านค้าชั้นนำเช่น Shopeeการเชื่อม MAG: กระบวนการเชื่อมโลหะ (Metal Active Gas) ค้นหาข้อมูลเพิ่มเติมได้จากบทความของ PumpkinMSI MAG: ซีรีส์อุปกรณ์และจอมอนิเตอร์สำหรับเกมเมอร์ เลือกดูรุ่นและราคาได้ที่ MSI Store Thailandแม็กกาซีน (Magazine): นิตยสารประเภทต่างๆ เช่น The Guitar Mag สำหรับคนดนตรี หรือรีวิวรถยนต์ที่ HeadLight Magazineหากคุณต้องการข้อมูลในด้านไหนเพิ่มเติม สามารถแจ้งรายละเอียดเพื่อให้ผมช่วยค้นหาได้เลยครับ`;

const userText2 = "1. Data Minimization (PDPA) ประมวลผลบน Client-Side 100% ข้อมูลผู้ใช้ไม่ถูกส่งออกนอกเบราว์เซอร์ พร้อมระบบ Masking ข้อมูลส่วนบุคคล (PII) อัตโนมัติก่อนส่ง Log";

function customCheck(input, base, slope) {
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
  
  const offset = base + slope * presentFeatures.length;
  scores[1] -= offset;
  
  return { isSpam: scores[1] > scores[0] };
}

console.log('Running Grid Search...');

const results = [];

for (let base = 3.0; base <= 8.0; base += 0.5) {
  for (let slope = 0.25; slope <= 0.65; slope += 0.03) {
    let spamDetected = 0;
    let safeFalsePositives = 0;
    
    spamLines.forEach(line => {
      if (customCheck(line, base, slope).isSpam) spamDetected++;
    });
    
    safeLines.forEach(line => {
      if (customCheck(line, base, slope).isSpam) safeFalsePositives++;
    });
    
    const userTextResult = customCheck(userText, base, slope).isSpam;
    const userText2Result = customCheck(userText2, base, slope).isSpam;
    const errors = (spamLines.length - spamDetected) + safeFalsePositives;
    const userTextPass = !userTextResult && !userText2Result;
    
    results.push({
      base,
      slope,
      spamPct: (spamDetected / spamLines.length * 100),
      safeFpPct: (safeFalsePositives / safeLines.length * 100),
      userTextPass,
      errors
    });
  }
}

// Sort results by total errors ascending, then by spam detection rate descending
results.sort((a, b) => {
  if (a.userTextPass !== b.userTextPass) {
    return a.userTextPass ? -1 : 1; // Prioritize passing userText
  }
  if (a.errors !== b.errors) {
    return a.errors - b.errors;
  }
  return b.spamPct - a.spamPct;
});

console.log('\nTop 15 Grid Search Results (Sorted by userTextPass=true, errors=min):');
console.log('Rank | Base | Slope | Spam Det % | Safe FP % | User Pass | Total Errors');
console.log('-----|------|-------|------------|-----------|-----------|-------------');
results.slice(0, 15).forEach((r, idx) => {
  console.log(` ${String(idx + 1).padEnd(3)} | ${r.base.toFixed(1).padEnd(4)} | ${r.slope.toFixed(2).padEnd(5)} | ${r.spamPct.toFixed(2).padStart(9)}% | ${r.safeFpPct.toFixed(2).padStart(8)}% | ${r.userTextPass ? '✅ PASS' : '❌ FAIL'.padEnd(7)} | ${r.errors}`);
});
