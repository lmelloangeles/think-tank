const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.json': 'application/json',
  '.png':  'image/png',
  '.ico':  'image/x-icon',
};

const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key, anthropic-version');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Proxy to Anthropic API
  if (req.method === 'POST' && req.url === '/v1/messages') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      let parsed;
      try { parsed = JSON.parse(body); } catch(e) {
        res.writeHead(400, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({error: {message: 'Invalid JSON'}}));
        return;
      }

      const apiKey = req.headers['x-api-key'] || '';
      if (!apiKey) {
        res.writeHead(401, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({error: {message: 'Missing API key'}}));
        return;
      }

      const payload = JSON.stringify(parsed);
      const options = {
        hostname: 'api.anthropic.com',
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Length': Buffer.byteLength(payload),
        }
      };

      const proxyReq = https.request(options, proxyRes => {
        res.writeHead(proxyRes.statusCode, {'Content-Type': 'application/json'});
        proxyRes.pipe(res);
      });
      proxyReq.on('error', e => {
        res.writeHead(502, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({error: {message: e.message}}));
      });
      proxyReq.write(payload);
      proxyReq.end();
    });
    return;
  }

  // Serve static files
  if (req.method === 'GET') {
    let filePath = req.url === '/' ? '/think-tank.html' : req.url;
    filePath = path.join(__dirname, filePath.split('?')[0]);

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404, {'Content-Type': 'text/plain'});
        res.end('Not found');
        return;
      }
      const ext = path.extname(filePath);
      res.writeHead(200, {'Content-Type': MIME[ext] || 'text/plain'});
      res.end(data);
    });
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log('Think Tank rodando na porta ' + PORT);
});
