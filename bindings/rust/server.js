const http = require('http');
const { Akari } = require('../../dist/index.js');

const server = http.createServer(async (req, res) => {
    if (req.method === 'POST' && req.url === '/run') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const { code } = JSON.parse(body);
                const engine = new Akari({ allow: ['say'], timeout: 1000 });
                await engine.run(code);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: err.message }));
            }
        });
    } else {
        res.writeHead(404);
        res.end();
    }
});

server.listen(3000, () => {
    console.log("Akari Rust Bridge listening on port 3000");
});