const sw = require('../dist/spamwarden.js');
sw.init();

const text = 'JOBTOPGUN เว็บหางานอันดับ 1 รวมงานจากบริษัทในฝันของคุณ อ่านรีวิวจริงก่อนสมัคร พร้อม Super Resume ที่ช่วยให้คุณโดดเด่นและเพิ่มโอกาสได้สัมภาษณ์มากขึ้น.';

const presentFeatures = sw._transform(text);
const invVocab = {};
for (const [word, index] of Object.entries(sw._vocab)) {
  invVocab[index] = word;
}

const featuresWithDiffs = presentFeatures.map(fIdx => {
  const word = invVocab[fIdx] || `[idx:${fIdx}]`;
  const lp0 = sw._featureLogProb[0][fIdx]; // Safe
  const lp1 = sw._featureLogProb[1][fIdx]; // Spam
  const diff = lp1 - lp0;
  return { word, fIdx, lp0, lp1, diff };
});

featuresWithDiffs.sort((a, b) => b.diff - a.diff);

console.log('Top 30 features contributing to Spam classification:');
console.log('Rank | Feature      | lp Safe | lp Spam | Diff (Spam - Safe)');
console.log('-----|--------------|---------|---------|------------------');
featuresWithDiffs.slice(0, 30).forEach((f, idx) => {
  console.log(` ${String(idx + 1).padEnd(3)} | ${f.word.padEnd(12)} | ${f.lp0.toFixed(4)} | ${f.lp1.toFixed(4)} | +${f.diff.toFixed(4)}`);
});

console.log('\nBottom 15 features (contributing to Safe):');
console.log('Rank | Feature      | lp Safe | lp Spam | Diff (Spam - Safe)');
console.log('-----|--------------|---------|---------|------------------');
featuresWithDiffs.slice(-15).forEach((f, idx) => {
  console.log(` ${String(idx + 1).padEnd(3)} | ${f.word.padEnd(12)} | ${f.lp0.toFixed(4)} | ${f.lp1.toFixed(4)} | ${f.diff.toFixed(4)}`);
});

const totalDiff = featuresWithDiffs.reduce((sum, f) => sum + f.diff, 0);
console.log(`\nTotal sum of diffs: ${totalDiff.toFixed(4)}`);
const priorDiff = sw._classLogPrior[1] - sw._classLogPrior[0];
console.log(`Prior diff (Spam - Safe): ${priorDiff.toFixed(4)}`);
console.log(`Raw score diff: ${(totalDiff + priorDiff).toFixed(4)}`);
const offset = 5.5 + 0.49 * presentFeatures.length;
console.log(`Length offset: -${offset.toFixed(4)}`);
console.log(`Final calibrated diff: ${(totalDiff + priorDiff - offset).toFixed(4)}`);
