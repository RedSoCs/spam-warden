const sw = require('../dist/spamwarden.js');

// Initialize the model
sw.init();

// Build inverse vocabulary to map feature indices back to words/n-grams
const invVocab = {};
for (const [word, index] of Object.entries(sw._vocab)) {
  invVocab[index] = word;
}

const text = 'a'.repeat(10000);

console.log('================================================================');
console.log('SPAMWARDEN DIAGNOSTIC ON P1');
console.log('================================================================');
console.log(`Input Length: ${text.length}`);

const features = sw._transform(text);
let matchCount = 0;
const matchedIndices = [];

for (let j = 0; j < sw._nFeatures; j++) {
  if (features[j] === 1) {
    matchCount++;
    matchedIndices.push(j);
  }
}

console.log(`Matched Features Count: ${matchCount}`);
matchedIndices.forEach(index => {
  const word = invVocab[index] || `[index:${index}]`;
  console.log(`  - Index: ${index} | Word/N-gram: "${word}"`);
});

const result = sw.spamcheck(text);
console.log(`Result isSpam: ${result.isSpam}`);
console.log(`Result Prob: ${(result.prob * 100).toFixed(6)}%`);
console.log('================================================================');
