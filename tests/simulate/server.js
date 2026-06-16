const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;

const server = http.createServer((req, res) => {
    // Enable CORS preflight handling
    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Max-Age': '86400'
        });
        res.end();
        return;
    }

    // 1. Telemetry Receiver Endpoint
    if (req.method === 'POST' && req.url === '/v1/telemetry') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                const payload = JSON.parse(body);
                console.log('\n================================================');
                console.log('🚨 [SIEM RECEIVER] Blocked Payload Received!');
                console.log('================================================');
                console.log(`Client Token: ${payload.client}`);
                console.log(`URL:          ${payload.url}`);
                console.log(`Rule Matched: ${payload.rule}`);
                console.log(`Confidence:   ${payload.prob}%`);
                console.log(`PII Masked?   ${payload.sd}`);
                console.log(`Pasted?       ${payload.paste}`);
                console.log(`Actors:       ${JSON.stringify(payload.uid)}`);
                console.log(`Sanitized:    "${payload.text}"`);
                console.log('================================================\n');
                
                res.writeHead(204, { 
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                });
                res.end();
            } catch (err) {
                res.writeHead(400, { 
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                });
                res.end(JSON.stringify({ error: 'Invalid JSON' }));
            }
        });
        return;
    }

    // 2. Serve minified main library from dist/
    if (req.method === 'GET' && req.url.startsWith('/js/spamwarden.min.js')) {
        const filePath = path.join(__dirname, '..', '..', 'dist', 'spamwarden.min.js');
        fs.readFile(filePath, (err, content) => {
            if (err) {
                res.writeHead(404);
                res.end('File not found');
            } else {
                res.writeHead(200, { 'Content-Type': 'application/javascript' });
                res.end(content);
            }
        });
        return;
    }

    // 3. Serve Test HTML Page
    if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
        // Base64 Token representing "postq-form|message-input|1|http://localhost:3000/v1/telemetry"
        // Raw token: postq-form|message-input|1|http://localhost:3000/v1/telemetry
        const configStr = "postq-form|message-input|1|http://localhost:3000/v1/telemetry";
        const clientToken = Buffer.from(configStr).toString('base64').replace(/=/g, '');

        const html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <title>SpamWarden Local Test Server</title>
            <style>
                body { font-family: sans-serif; padding: 40px; background: #f8fafc; color: #0f172a; }
                .card { max-width: 600px; margin: 0 auto; background: white; padding: 24px; border-radius: 8px; border: 1px solid #cbd5e1; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
                input, textarea { width: 100%; padding: 12px; margin: 8px 0 20px; border-radius: 4px; border: 1px solid #cbd5e1; box-sizing: border-box; font-size: 1rem; }
                button { background: #dc244c; color: white; border: none; padding: 12px 24px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 1rem; }
                button:hover { background: #be003a; }
            </style>
        </head>
        <body>
            <div class="card">
                <h2>SpamWarden Form Protection Test</h2>
                <p>Submit a spam comment (e.g. contains <i>$€£฿</i> or links like <i>line[dot]me</i> or Thai loan/gambling words) to test blocking and telemetry.</p>
                <form id="postq-form" action="/success" method="GET">
                    <label>Name</label>
                    <input type="text" name="name" placeholder="John Doe" />
                    <label>Comment / Message</label>
                    <textarea id="message-input" rows="4" placeholder="ป้อนความคิดเห็นของคุณ..."></textarea>
                    <button type="submit">Submit Message</button>
                </form>
            </div>
            <!-- Auto-binding Script Tag with encoded local client key -->
            <script src="/js/spamwarden.min.js?client=${clientToken}"></script>
        </body>
        </html>
        `;
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(html);
        return;
    }

    // Redirect form success
    if (req.method === 'GET' && req.url.startsWith('/success')) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<h2>✅ Form Submitted Successfully! (Not blocked as spam)</h2><a href="/">Try again</a>');
        return;
    }

    res.writeHead(404);
    res.end('Not found');
});

server.listen(PORT, () => {
    console.log(`\x1b[32m🚀 SpamWarden Local Test Server running at http://localhost:${PORT}\x1b[0m`);
    console.log(`   - Test Page: http://localhost:${PORT}/`);
    console.log(`   - Telemetry Endpoint: http://localhost:${PORT}/v1/telemetry`);
});
