const sw = require('../dist/spamwarden.js');
sw.init();

const text = 'JOBTOPGUN เว็บหางานอันดับ 1 รวมงานจากบริษัทในฝันของคุณ อ่านรีวิวจริงก่อนสมัคร พร้อม Super Resume ที่ช่วยให้คุณโดดเด่นและเพิ่มโอกาสได้สัมภาษณ์มากขึ้น.';
const result = sw.spamcheck(text);
console.log('Result:', result);

const presentFeatures = sw._transform(text);
console.log('Present features:', presentFeatures.length);

// Build inverse vocabulary
const invVocab = {};
for (const [word, index] of Object.entries(sw._vocab)) {
  invVocab[index] = word;
}

const nClasses = sw._classes.length;
const scores = new Float64Array(nClasses);
for (let c = 0; c < nClasses; c++) {
  let s = sw._classLogPrior[c];
  console.log(`Class ${c} log prior:`, s);
  for (let k = 0; k < presentFeatures.length; k++) {
    const fIdx = presentFeatures[k];
    const logP = sw._featureLogProb[c][fIdx];
    const word = invVocab[fIdx] || `[index:${fIdx}]`;
    console.log(`  Feature "${word}" (idx ${fIdx}): logProb = ${logP}`);
    s += logP;
  }
  scores[c] = s;
}

console.log(`Raw scores: Safe = ${scores[0].toFixed(4)}, Spam = ${scores[1].toFixed(4)}`);
const offset = 5.0 + 0.43 * presentFeatures.length;
console.log(`Offset applied to Spam score: ${offset}`);
scores[1] -= offset;
console.log(`Scores after offset: Safe = ${scores[0].toFixed(4)}, Spam = ${scores[1].toFixed(4)}`);
console.log(`isSpam: ${scores[1] > scores[0]}`);
