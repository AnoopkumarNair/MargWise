// A tiny static server for the e2e tests. It serves hosting/public and applies hosting/public/_headers the way Cloudflare Pages does:
// every matching block applies, and a header set by two blocks is joined with ", " (two CSP policies are both enforced).
import http from 'node:http';
import { readFileSync, statSync, existsSync } from 'node:fs';
import { join, extname, normalize, sep } from 'node:path';

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.txt': 'text/plain', '.md': 'text/plain' };

export function parseHeaders(text) {
  const blocks = []; let cur = null;
  for (const line of text.split('\n')) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    if (!/^\s/.test(line)) { cur = { pattern: line.trim(), headers: [] }; blocks.push(cur); }
    else { const i = line.indexOf(':'); cur.headers.push([line.slice(0, i).trim(), line.slice(i + 1).trim()]); }
  }
  return blocks;
}
function matches(pattern, path) {
  if (pattern.endsWith('*')) return path.startsWith(pattern.slice(0, -1));
  return pattern === path;
}
export function headersFor(blocks, path) {
  const out = new Map();
  for (const b of blocks) if (matches(b.pattern, path)) for (const [k, v] of b.headers) out.set(k, out.has(k) ? out.get(k) + ', ' + v : v);
  return out;
}

export function startServer(publicDir, { log } = {}) {
  const blocks = parseHeaders(readFileSync(join(publicDir, '_headers'), 'utf8'));
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    let path = decodeURIComponent(url.pathname);
    log && log(req.method + ' ' + path);
    let file = normalize(join(publicDir, path));
    if (!file.startsWith(publicDir + sep) && file !== publicDir) { res.writeHead(403).end(); return; }
    try { if (statSync(file).isDirectory()) { file = join(file, 'index.html'); } } catch { /* 404 below */ }
    if (!existsSync(file) || file.endsWith('_headers')) { res.writeHead(404, { 'content-type': 'text/plain' }).end('not found'); return; }
    const h = { 'content-type': MIME[extname(file)] || 'application/octet-stream' };
    for (const [k, v] of headersFor(blocks, path)) h[k] = v;
    res.writeHead(200, h).end(readFileSync(file));
  });
  return new Promise(ok => server.listen(0, '127.0.0.1', () => ok({ server, port: server.address().port, close: () => new Promise(r => server.close(r)) })));
}
