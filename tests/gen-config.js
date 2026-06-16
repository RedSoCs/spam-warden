#!/usr/bin/env node
/**
 * Real-World Optimized Configuration Generator for SpamWarden (Thai Use-Cases)
 * Goal: Realistic URL shortening analysis.
 * Constraints: Form ID >= 7 chars, Input ID >= 5 chars.
 * Raw Format: formId|inputId|sdFlag|endpoints
 */

const args = process.argv.slice(2);

function generate(formId, inputId, sdFlag, endpoints) {
    // Remove https:// and http:// to save space (engine adds it back)
    const cleanEndpoints = (endpoints || "").replace(/https?:\/\//g, "");
    const raw = [formId, inputId, sdFlag || "0", cleanEndpoints].join("|");
    
    // Base64 without padding (=)
    let b64 = Buffer.from(raw).toString("base64").replace(/=+$/, "");
    return { raw, b64 };
}

console.log("=== Real-World Thai Config Generator ===\n");

const cases = [
    {
        name: "Thai Gov Portal (Standard)",
        formId: "gov_contact_form", // 18 chars
        inputId: "txt_message",    // 12 chars
        sdFlag: "0",
        endpoints: "siem.thaigov.go.th/api/v1"
    },
    {
        name: "E-Commerce Support (Multiple Endpoints)",
        formId: "customer_support", // 16 chars
        inputId: "comment",        // 7 chars
        sdFlag: "0",
        endpoints: "logs.redsocs.com,analytics.shop.co.th"
    },
    {
        name: "Corporate Inquiry (DLP Audit ON)",
        formId: "feedback_form_v2", // 16 chars
        inputId: "content",        // 7 chars
        sdFlag: "1",
        endpoints: "internal-soc.local/receiver"
    },
    {
        name: "Public Service (Long Endpoint)",
        formId: "service_request", // 15 chars
        inputId: "request_detail", // 14 chars
        sdFlag: "1",
        endpoints: "https://api-gateway.bangkok.go.th/services/spam/v2/reporting"
    }
];

cases.forEach(c => {
    const { raw, b64 } = generate(c.formId, c.inputId, c.sdFlag, c.endpoints);
    const urlEncodedB64 = encodeURIComponent(b64);
    
    // Validation check for user information
    const formOk = c.formId.length >= 7;
    const inputOk = c.inputId.length >= 5;

    console.log(`Case:   ${c.name} ${formOk && inputOk ? "✅" : "⚠️"}`);
    console.log(`Raw:    ${raw}`);
    console.log(`Base64: ${b64}`);
    console.log(`Length: ${b64.length} chars`);
    console.log(`URL:    https://cdn.redsocs.com/js/spamwarden.min.js?client=${urlEncodedB64}`);
    if (!formOk) console.warn(`  ⚠️ Warning: formId length (${c.formId.length}) is below recommended 7`);
    if (!inputOk) console.warn(`  ⚠️ Warning: inputId length (${c.inputId.length}) is below recommended 5`);
    console.log("-".repeat(40));
});

if (args.length >= 2) {
    console.log("\nCase: User Input");
    const { raw, b64 } = generate(args[0], args[1], args[2], args[3]);
    const urlEncodedB64 = encodeURIComponent(b64);
    console.log(`Raw:    ${raw}`);
    console.log(`Base64: ${b64}`);
    console.log(`Length: ${b64.length} chars`);
    console.log(`URL:    https://cdn.redsocs.com/js/spamwarden.min.js?client=${urlEncodedB64}`);
    if (args[0].length < 7) console.warn(`  ⚠️ Warning: formId length (${args[0].length}) is below recommended 7`);
    if (args[1].length < 5) console.warn(`  ⚠️ Warning: inputId length (${args[1].length}) is below recommended 5`);
} else if (args.length > 0) {
    console.log("\nUsage for custom input: node tests/gen-config.js <formId> <inputId> <sdFlag> [endpoints]");
}
