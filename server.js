const http = require('http');
const fs = require('fs');
const path = require('path');

// Extract curated fixtures from lib/fixtures.ts
const fixturesPath = path.join(__dirname, 'lib', 'fixtures.ts');
const fixturesContent = fs.readFileSync(fixturesPath, 'utf8');
const sanitized = fixturesContent
  .replace(/import type [^;]+;/g, '')
  .replace(/: Item\[\]/g, '')
  .replace(/: Source\[\]/g, '')
  .replace(/export const /g, 'const ');

const sandbox = {};
eval(sanitized + '; sandbox.items = items; sandbox.sources = sources;');
const items = sandbox.items;
const sources = sandbox.sources;

const server = http.createServer((req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const cleanUrl = req.url.split('?')[0];

  if (cleanUrl === '/' || cleanUrl === '/index.html' || cleanUrl === '/timeline') {
    const filePath = path.join(__dirname, 'public', 'index.html');
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Error loading index.html: ' + err.message);
      } else {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(data);
      }
    });
  } else if (cleanUrl === '/api/items') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(items));
  } else if (cleanUrl === '/api/sources') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(sources));
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`LOST IN SPACE TELEMETRY HUD LIVE ON http://localhost:${PORT}`);
});
