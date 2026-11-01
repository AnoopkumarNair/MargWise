// Shared by the S3 e2e test and the privacy journey test: build the app, start the server, collect everything a journey sends.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
export const { chromium } = require('playwright');
const here = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(here, '..', '..', '..', '..');
export const PUBLIC = join(ROOT, 'hosting', 'public');
export const OUT = join(here, '..', 'out');
export const SHOTS = join(here, 'screenshots');
mkdirSync(OUT, { recursive: true }); mkdirSync(SHOTS, { recursive: true });
export const REAL = process.env.MW_E2E_DATA === 'real';
export const VIEWS = [{ name: '390', width: 390, height: 844, phone: true }, { name: '1280', width: 1280, height: 800, phone: false }];

export function buildApp() {
  if (process.env.MW_NO_BUILD) return;
  const r = spawnSync('python3', [join(ROOT, 'app', 'adult', 'build.py'), '--dev'].concat(REAL ? [] : ['--fixtures']), { stdio: 'inherit' });
  assert.equal(r.status, 0, 'build failed');
}

let axeSrc = null;
try { axeSrc = readFileSync(join(here, '..', 'node_modules', 'axe-core', 'axe.min.js'), 'utf8'); } catch { /* reported by axeCheck */ }
export async function axeCheck(page, label) {
  assert.ok(axeSrc, 'axe-core is not installed: run `npm install` in app/adult/tests/');
  await page.evaluate(axeSrc);
  const res = await page.evaluate(() => window.axe.run(document, { resultTypes: ['violations'] }));
  const bad = res.violations.filter(v => v.impact === 'serious' || v.impact === 'critical');
  assert.deepEqual(bad.map(v => v.id + ' (' + v.impact + '): ' + v.nodes.slice(0, 3).map(n => n.target.join(' ')).join(' | ')), [], 'axe on ' + label);
  return res.violations.map(v => v.id + ':' + v.impact);
}

export async function shot(page, v, name) {
  await page.screenshot({ path: join(OUT, `s3-${name}-${v.name}.png`), fullPage: true });
  if (v.phone && process.env.MW_SHOTS === 'commit') await page.screenshot({ path: join(SHOTS, `s3-${name}-${v.name}.png`), fullPage: true });
}

// Watches a whole browser context (pages and their workers). Everything that must stay empty or small is collected here.
export function watchContext(ctx) {
  const w = { errors: [], requests: [], failed: [] };
  const onPage = page => {
    page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') w.errors.push(m.type() + ': ' + m.text()); });
    page.on('pageerror', e => w.errors.push('pageerror: ' + e.message));
    page.on('response', r => { if (r.status() >= 400) w.errors.push('http ' + r.status() + ' ' + r.url()); });
  };
  ctx.pages().forEach(onPage); ctx.on('page', onPage);
  ctx.on('request', r => w.requests.push({ method: r.method(), url: r.url(), body: r.postData(), type: r.resourceType() }));
  ctx.on('requestfailed', r => w.failed.push(r.url() + ' ' + (r.failure() || {}).errorText));
  return w;
}

// The profile the page would hand to the matcher right now, and whether it passes the contract. Reads the page's own modules.
export async function pageProfile(page) {
  return page.evaluate(async () => { const s = await import('/work/state.js'); const p = s.buildProfile(); return { profile: p, check: s.checkProfile(p) }; });
}

// Chooses a file on the intake screen and waits for the confirm screen. Returns the milliseconds from choosing to the confirm screen.
export async function uploadToConfirm(page, base, file) {
  await page.goto(base + '/work/#/intake');
  await page.locator('#resume-file').waitFor();
  const t0 = Date.now();
  await page.locator('#resume-file').setInputFiles(file);
  await page.locator('h1:has-text("Check what we found")').waitFor({ timeout: 30000 });
  return Date.now() - t0;
}

// Waits for the roads list. A person with few skills may have only leaps (hidden at first), so show them when there is nothing else.
export async function roadsReady(page) {
  await page.locator('#road-count:has-text("shown")').waitFor();
  if (!(await page.locator('ol.cards > li').count()) && (await page.locator('#show-leaps').isVisible())) await page.locator('#show-leaps').click();
  await page.locator('ol.cards > li').first().waitFor();
}
