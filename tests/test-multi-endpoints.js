
const SpamWarden = require('../dist/spamwarden.js');

let sendCount = 0;
// Mock _send to count calls
SpamWarden._send = function(url, data) {
    console.log(`Sending to: ${url}`);
    sendCount++;
};

console.log('--- Testing single endpoint ---');
SpamWarden.configure({
    siteToken: 'test-token',
    endpoint: 'http://endpoint1.com',
    autoReport: true,
    isTrusted: true
});
SpamWarden.spamcheck('Win $500 now!');
console.log(`Send count: ${sendCount}`);

console.log('\n--- Testing multiple endpoints (array) ---');
sendCount = 0;
SpamWarden.configure({
    endpoint: ['http://endpoint1.com', 'http://endpoint2.com'],
    siemEndpoint: ['http://siem1.com', 'http://siem2.com']
});
SpamWarden.spamcheck('Win $500 now!');
console.log(`Total send count: ${sendCount}`);

console.log('\n--- Testing multiple endpoints (comma string) ---');
// Simulating the parser result
SpamWarden.configure({
    endpoint: null,
    siemEndpoint: ['http://multi1.com', 'http://multi2.com']
});
sendCount = 0;
SpamWarden.spamcheck('Win $500 now!');
console.log(`Total send count: ${sendCount}`);
