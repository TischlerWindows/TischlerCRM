import http from 'http';

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: true, message: 'Simple server works!' }));
});

server.listen(4002, '127.0.0.1', () => {
  console.log('Test server listening on http://127.0.0.1:4002');
});

server.on('error', (err) => {
  console.error('Server error:', err);
});