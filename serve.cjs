// 本地静态服务器（开发验证用；部署到 GitHub Pages 时不需要）
const h = require('http'), f = require('fs'), p = require('path');
h.createServer((q, s) => {
  let u = decodeURIComponent(q.url.split('?')[0]);
  if (u === '/') u = '/index.html';
  const fp = p.join(process.cwd(), u);
  f.readFile(fp, (e, d) => {
    if (e) { s.writeHead(404); s.end('404'); return; }
    const m = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8' }[p.extname(fp)] || 'application/octet-stream';
    s.writeHead(200, { 'Content-Type': m });
    s.end(d);
  });
}).listen(8093, () => console.log('up'));
