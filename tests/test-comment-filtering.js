const assert = require('assert');

// Test that comment lines starting with # are successfully filtered out.
function filterComments(content) {
  return content
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0 && !l.startsWith('#'))
    .join('\n');
}

// Test cases
const input = `
  # This is a comment instruction
  สมัครสมาชิกวันนี้ รับโบนัสทันที
  # Another comment line
  สล็อตเว็บตรง ไม่ผ่านเอเย่นต์
`;

const expected = `สมัครสมาชิกวันนี้ รับโบนัสทันที\nสล็อตเว็บตรง ไม่ผ่านเอเย่นต์`;
const output = filterComments(input);

try {
  assert.strictEqual(output, expected);
  console.log('✓ Comment filtering test passed!');
  process.exit(0);
} catch (err) {
  console.error('✗ Comment filtering test failed:', err.message);
  process.exit(1);
}
