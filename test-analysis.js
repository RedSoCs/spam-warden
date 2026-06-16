const fs = require('fs');
const sw = require('./dist/spamwarden.js');

// Initialize the model
sw.init();

// Build inverse vocabulary to map feature indices back to words/n-grams
const invVocab = {};
for (const [word, index] of Object.entries(sw._vocab)) {
  invVocab[index] = word;
}

const testCases = [
  { text: 'Hello world', label: 'Hello world (neutral English)' },
  { text: 'a'.repeat(10000), label: 'Very Long String of a (10,000 chars)' },
  { text: '   ', label: 'Whitespace only' },
  { text: '🎉🔥💰', label: 'Emoji only' },
  { text: 'Hello, the weather is nice today.', label: 'Neutral English sentence' },
  { text: 'สมัครสมาชิกวันนี้ รับโบนัส ฝากเงิน', label: 'Casino/Lottery Spam (Thai)' }
];

console.log('================================================================');
console.log('SPAMWARDEN MODEL DIAGNOSTIC RUN');
console.log('================================================================');
console.log(`Model Version: ${sw.version}`);
console.log(`Vocabulary Size: ${sw._nFeatures} features`);
console.log(`Base Scores (scores when no features match):`);
console.log(`  - Class 0 (Safe): ${sw._baseScore[0].toFixed(4)}`);
console.log(`  - Class 1 (Spam): ${sw._baseScore[1].toFixed(4)}`);
console.log(`  - Difference (Spam - Safe): ${(sw._baseScore[1] - sw._baseScore[0]).toFixed(4)}`);
console.log('================================================================\n');

testCases.forEach((tc, idx) => {
  console.log(`--- [Test Case ${idx + 1}] ${tc.label} ---`);
  const displayInput = tc.text.length > 60 ? tc.text.substring(0, 60) + '...' : tc.text;
  console.log(`Input: "${displayInput}" (length: ${tc.text.length})`);

  // Transform input to get present features
  const presentFeatures = sw._transform(tc.text);
  console.log(`Matched Features Count: ${presentFeatures.length}`);

  let sumW0 = 0;
  let sumW1 = 0;

  if (presentFeatures.length > 0) {
    console.log('\nMatched Feature Details:');
    console.log('  Index  | Feature Token  | Weight Class 0 (Safe) | Weight Class 1 (Spam) | Diff (Spam-Safe)');
    console.log('  -------|----------------|-----------------------|-----------------------|-----------------');
    
    presentFeatures.slice(0, 20).forEach(index => {
      const word = invVocab[index] || `[index:${index}]`;
      const w0 = sw._featureWeight[0][index];
      const w1 = sw._featureWeight[1][index];
      const diff = w1 - w0;
      console.log(`  ${String(index).padEnd(6)} | ${word.padEnd(14)} | ${w0.toFixed(4).padStart(21)} | ${w1.toFixed(4).padStart(21)} | ${diff.toFixed(4).padStart(15)}`);
      
      sumW0 += w0;
      sumW1 += w1;
    });

    if (presentFeatures.length > 20) {
      console.log(`  ... and ${presentFeatures.length - 20} more features.`);
      // Still sum up the rest of the weights
      presentFeatures.slice(20).forEach(index => {
        sumW0 += sw._featureWeight[0][index];
        sumW1 += sw._featureWeight[1][index];
      });
    }
    console.log('  -------|----------------|-----------------------|-----------------------|-----------------');
  }

  // Calculate final score using the same math as spamcheck
  const finalScore0 = sw._baseScore[0] + sumW0;
  const finalScore1 = sw._baseScore[1] + sumW1;

  // Run spamcheck to get actual outputs
  const result = sw.spamcheck(tc.text);

  console.log(`\nCalculation Summary:`);
  console.log(`  - Class 0 (Safe) Score: Base (${sw._baseScore[0].toFixed(4)}) + Features Sum (${sumW0.toFixed(4)}) = ${finalScore0.toFixed(4)}`);
  console.log(`  - Class 1 (Spam) Score: Base (${sw._baseScore[1].toFixed(4)}) + Features Sum (${sumW1.toFixed(4)}) = ${finalScore1.toFixed(4)}`);
  console.log(`  - Log Probability Diff: ${(finalScore1 - finalScore0).toFixed(4)}`);
  console.log(`  - Result isSpam:        ${result.isSpam ? '🔴 SPAM' : '🟢 HAM (Safe)'}`);
  console.log(`  - Result Probability:   ${(result.prob * 100).toFixed(6)}%`);
  console.log('----------------------------------------------------------------\n');
});
