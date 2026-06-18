#!/usr/bin/env node
/**
 * Real-World Optimized Configuration Generator for SpamWarden (Thai Use-Cases)
 * Simplified 2-Part Format: sdFlag|endpoints
 */

const args = process.argv.slice(2);

function generate(sdFlag, endpoints) {
    // Remove https:// and http:// to save space (engine adds it back)
    const cleanEndpoints = (endpoints || "").replace(/https?:\/\//g, "");
    
    const raw = [sdFlag || "0", cleanEndpoints].join("|");
    
    // Base64 without padding (=)
    let b64 = Buffer.from(raw).toString("base64").replace(/=+$/, "");
    return { raw, b64 };
}

console.log("=== Real-World Thai Config Generator (v2) ===\n");

const cases = [
    {
        name: "Zero-Config (Heuristic Auto-Bind)",
        sdFlag: "0",
        endpoints: "siem.redsocs.com/v1"
    },
    {
        name: "Thai Gov Portal (Simplified)",
        sdFlag: "0",
        endpoints: "siem.thaigov.go.th/api/v1"
    },
    {
        name: "E-Commerce (Auto-Bind + DLP)",
        sdFlag: "1",
        endpoints: "logs.redsocs.com,analytics.shop.co.th"
    }
];

cases.forEach(c => {
    const { raw, b64 } = generate(c.sdFlag, c.endpoints);
    const urlEncodedB64 = encodeURIComponent(b64);
    
    console.log(`Case:   ${c.name}`);
    console.log(`Raw:    ${raw}`);
    console.log(`Base64: ${b64}`);
    console.log(`URL:    https://cdn.redsocs.com/js/spamwarden.min.js?client=${urlEncodedB64}`);
    console.log("-".repeat(40));
});

if (args.length >= 1) {
    console.log("\nCase: User Input");
    const { raw, b64 } = generate(args[0], args[1]);
    const urlEncodedB64 = encodeURIComponent(b64);
    console.log(`Raw:    ${raw}`);
    console.log(`Base64: ${b64}`);
    console.log(`URL:    https://cdn.redsocs.com/js/spamwarden.min.js?client=${urlEncodedB64}`);
} else {
    console.log("\nUsage for custom input: node tests/gen-config.js <sdFlag> [endpoints]");
}
