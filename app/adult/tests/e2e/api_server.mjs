// The e2e server for the account screens (slice S4): the static server of server.mjs plus /api/v1/* answered by the REAL handlers in
// hosting/core/ (the same code Pages Functions run), on a fresh in-memory SQLite database with every migration (hosting/tests/adult/fakedb.mjs).
// What is faked is only what needs a network or a clock: the email service (messages are kept in memory; the test reads them from
// GET /__test/mail), the Turnstile check (any token passes, except "ts-fail"), and the keys (test values). It also serves the files of the
// built app to the handlers as their "assets", so the id check on a save reads the real /work/graph/<release>/ids.json the build wrote.
// `npx wrangler pages dev` does the same job against the real runtime, but it needs network access to install and start; this does not.
import http from 'node:http';
import { readFileSync, statSync, existsSync } from 'node:fs';
import { join, extname, normalize, sep } from 'node:path';
import { parseHeaders, headersFor } from './server.mjs';
import { createFakeDb } from '../../../../hosting/tests/adult/fakedb.mjs';
import { KEYS } from '../../../../hosting/tests/adult/api_helpers.mjs';
import { makeFakeDeps } from '../../../../hosting/core/deps.js';
import { clearReleaseCache } from '../../../../hosting/core/release_ids.js';
import { handle as startH } from '../../../../hosting/core/email_start.js';
import { handle as verifyH } from '../../../../hosting/core/email_verify.js';
import { handle as completeH } from '../../../../hosting/core/email_complete.js';
import { handleGet, handlePut } from '../../../../hosting/core/profile.js';
import { handleExport, handleDelete, handleLogoutAll } from '../../../../hosting/core/account.js';
import { handle as eventH } from '../../../../hosting/core/events.js';
import { handle as healthH } from '../../../../hosting/core/health.js';

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2', '.png': 'image/png', '.txt': 'text/plain', '.md': 'text/plain; charset=utf-8' };

const ROUTES = {
  'POST /api/v1/email/start': startH, 'POST /api/v1/email/verify': verifyH, 'POST /api/v1/email/complete': completeH,
  'GET /api/v1/me/profile': handleGet, 'PUT /api/v1/me/profile': handlePut,
  'POST /api/v1/me/export': handleExport, 'POST /api/v1/me/delete': handleDelete, 'POST /api/v1/me/logout-all': handleLogoutAll,
  'POST /api/v1/event': eventH, 'GET /api/v1/health': healthH,
};

export async function startApiServer(publicDir, { invite = 'adult1', env = {} } = {}) {
  clearReleaseCache();
  const db = createFakeDb();
  db.raw.prepare("INSERT INTO invites (code, label, created_at, track, active) VALUES (?, 'e2e', ?, 'adult', 1)").run(invite, Date.now());
  const manifest = JSON.parse(readFileSync(join(publicDir, 'work', 'manifest.json'), 'utf8'));
  const assets = new Proxy({}, { has: (_, p) => existsSync(join(publicDir, String(p))) && statSync(join(publicDir, String(p))).isFile(), get: (_, p) => readFileSync(join(publicDir, String(p)), 'utf8') });
  const deps = makeFakeDeps({ db, assets, env: { ...KEYS, ADULT_SIGNUP: '1', EMAIL_FROM: 'hello@margwise.test', RELEASE_ID: manifest.release_id, ...env } });
  deps.now = () => Date.now();   // a real clock: sessions, codes and limits behave as they do live
  const log = []; const blocks = parseHeaders(readFileSync(join(publicDir, '_headers'), 'utf8'));
  let ipn = 0;
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x'); const path = decodeURIComponent(url.pathname);
    if (path === '/__test/mail') {   // the test reads the sign-in code and link here (the server never exposes this outside the tests)
      const m = deps.email.outbox[deps.email.outbox.length - 1];
      res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(m ? { to: m.to, code: (/code is (\d{6})/.exec(m.text) || [])[1], link: (/#link=([A-Za-z0-9_-]+)/.exec(m.text) || [])[1], count: deps.email.outbox.length } : { count: 0 })); return;
    }
    if (path === '/__test/requests') { res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(log)); return; }
    if (path === '/__test/age') { res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(db.raw.prepare('SELECT * FROM under18').all())); return; }
    const handler = ROUTES[req.method + ' ' + path];
    if (path.startsWith('/api/')) {
      log.push(req.method + ' ' + path);
      if (!handler) { res.writeHead(404, { 'content-type': 'application/json' }).end('{"ok":false,"error":{"code":"not_found","message":"no"}}'); return; }
      const chunks = []; for await (const c of req) chunks.push(c);
      const body = Buffer.concat(chunks);
      const r = new Request('http://app.test' + path, { method: req.method, headers: { ...Object.fromEntries(Object.entries(req.headers).filter(([k]) => ['content-type', 'authorization'].includes(k))), 'cf-connecting-ip': '198.51.100.' + (1 + (ipn++ % 200)) }, body: ['GET', 'HEAD'].includes(req.method) ? undefined : body });
      const out = await handler(r, deps);
      const h = {}; out.headers.forEach((v, k) => { h[k] = v; });
      res.writeHead(out.status, h).end(Buffer.from(await out.arrayBuffer())); return;
    }
    let file = normalize(join(publicDir, path));
    if (!file.startsWith(publicDir + sep) && file !== publicDir) { res.writeHead(403).end(); return; }
    try { if (statSync(file).isDirectory()) file = join(file, 'index.html'); } catch { /* 404 below */ }
    if (!existsSync(file) || file.endsWith('_headers')) { res.writeHead(404, { 'content-type': 'text/plain' }).end('not found'); return; }
    const hd = { 'content-type': MIME[extname(file)] || 'application/octet-stream' };
    for (const [k, v] of headersFor(blocks, path)) hd[k] = v;
    res.writeHead(200, hd).end(readFileSync(file));
  });
  return new Promise(ok => server.listen(0, '127.0.0.1', () => ok({ server, db, deps, port: server.address().port, base: 'http://127.0.0.1:' + server.address().port, close: () => new Promise(r => server.close(r)) })));
}
