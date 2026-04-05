const sw = require('./dist/spamwarden.js');

const r1 = sw.spamcheck('สมัครสมาชิกวันนี้ รับโบนัส ฝากเงิน');
const r2 = sw.spamcheck('Hello, the weather is nice today.');

console.log('Spam:', r1.isSpam, '(' + (r1.prob * 100).toFixed(0) + '%)');
console.log('Safe:', r2.isSpam, '(' + ((1 - r2.prob) * 100).toFixed(0) + '%)');
console.log('Version:', sw._version);

if (!r1.isSpam) {
  console.error('FAIL: spam not detected');
  process.exit(1);
}
if (r2.isSpam) {
  console.error('FAIL: safe detected as spam');
  process.exit(1);
}
console.log('All tests passed.');
