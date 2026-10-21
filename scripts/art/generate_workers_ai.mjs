// Generates the art in docs/art/asset-list.csv with Cloudflare Workers AI (free daily allowance).
//   node scripts/art/generate_workers_ai.mjs [--only bg-s01,obj-s01-R] [--model flux-1-schnell] [--limit 20]
// Needs CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN (or CF_ACCOUNT_ID / CF_API_TOKEN) in the environment and
// api.cloudflare.com on the network allowlist. Writes PNG/JPEG files to assets/generated/ (Git LFS) and one row per
// image to assets/generated/manifest.csv. Skips images that already exist, and stops cleanly when the daily
// allowance is used up (rerun after 00:00 UTC). UNTESTED until it has run once with real credentials.
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : dflt;
};
const account = process.env.CLOUDFLARE_ACCOUNT_ID ?? process.env.CF_ACCOUNT_ID;
const token = process.env.CLOUDFLARE_API_TOKEN ?? process.env.CF_API_TOKEN;
if (!account || !token) {
  process.stderr.write('Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN first.\n');
  process.exit(2);
}
const model = `@cf/black-forest-labs/${arg('model', 'flux-1-schnell')}`;
const only = arg('only', '').split(',').filter(Boolean);
const limit = Number(arg('limit', '1000'));

// minimal CSV reader for the asset list (quoted fields, doubled quotes)
function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      cell = '';
      if (row.some((x) => x !== '')) rows.push(row);
      row = [];
    } else cell += c;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

const [head, ...body] = parseCsv(
  fs.readFileSync(path.join(root, 'docs/art/asset-list.csv'), 'utf8'),
);
const assets = body.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])));
const outDir = path.join(root, 'assets/generated');
fs.mkdirSync(outDir, { recursive: true });
const manifest = path.join(outDir, 'manifest.csv');
if (!fs.existsSync(manifest))
  fs.writeFileSync(manifest, 'asset_id,file,tool,model,date,seed,prompt\n');

let done = 0;
for (const a of assets) {
  if (only.length && !only.includes(a.asset_id)) continue;
  const file = path.join(outDir, `${a.asset_id}.jpg`);
  if (fs.existsSync(file)) continue;
  if (done >= limit) break;
  const portrait = a.kind === 'background';
  const seed = [...a.asset_id].reduce((s, ch) => (s * 31 + ch.charCodeAt(0)) >>> 0, 7);
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${account}/ai/run/${model}`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: a.prompt,
        steps: 4,
        seed,
        width: portrait ? 768 : 768,
        height: portrait ? 1344 : 1024,
      }),
    },
  );
  if (res.status === 429 || res.status === 403) {
    process.stderr.write(
      `Stopped at ${a.asset_id}: HTTP ${res.status} (allowance used up, or plan does not cover this model).\n`,
    );
    break;
  }
  const json = await res.json().catch(() => null);
  const b64 = json?.result?.image;
  if (!res.ok || !b64) {
    process.stderr.write(
      `Failed ${a.asset_id}: HTTP ${res.status} ${JSON.stringify(json?.errors ?? json).slice(0, 200)}\n`,
    );
    continue;
  }
  fs.writeFileSync(file, Buffer.from(b64, 'base64'));
  const esc = (s) => `"${String(s).replaceAll('"', '""')}"`;
  fs.appendFileSync(
    manifest,
    [
      a.asset_id,
      path.relative(root, file),
      'Cloudflare Workers AI',
      model,
      new Date().toISOString().slice(0, 10),
      seed,
      esc(a.prompt),
    ].join(',') + '\n',
  );
  done++;
  process.stdout.write(`ok ${a.asset_id}\n`);
}
process.stdout.write(`generated ${done}\n`);
