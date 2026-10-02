const http = require('http');
const fs = require('fs');
const path = require('path');
const dist = path.join(__dirname, 'dist');
const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
};
const server = http.createServer((req, res) => {
  let filePath = path.join(dist, req.url === '/' ? 'index.html' : decodeURIComponent(req.url.split('?')[0]));
  if (!fs.existsSync(filePath)) { res.writeHead(404); res.end('Not found: ' + req.url); return; }
  const ext = path.extname(filePath);
  res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
});
server.listen(4180, '0.0.0.0', () => {
  console.log('READY http://localhost:4180');
});
