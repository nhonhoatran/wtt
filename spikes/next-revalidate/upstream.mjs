import http from 'node:http';
const data = new Map();
let hits = 0;
http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  const m = u.pathname.match(/^\/match\/(\w+)$/);
  res.setHeader('content-type', 'application/json');
  if (u.pathname === '/matches') return res.end(JSON.stringify([...data.keys()]));
  if (u.pathname === '/hits') return res.end(JSON.stringify({ hits }));
  if (!m) { res.statusCode = 404; return res.end('{}'); }
  const id = m[1];
  if (req.method === 'POST') {
    let b = '';
    req.on('data', (c) => (b += c));
    req.on('end', () => {
      const v = (data.get(id)?.version ?? 0) + 1;
      data.set(id, { id, score: JSON.parse(b).score, version: v });
      res.end(JSON.stringify(data.get(id)));
    });
    return;
  }
  hits++;
  res.end(JSON.stringify(data.get(id) ?? { id, score: '0-0', version: 0 }));
}).listen(4100, '127.0.0.1');
