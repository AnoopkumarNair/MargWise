// The alert rules of BACKEND ADR-10 (T3.7), as code a scheduled job can run. Usage (the owner sets the URL and the key as secrets):
//   MARGWISE_URL=https://example.pages.dev ADMIN_KEY=... node hosting/tools/health_watch.mjs
// It reads GET /api/v1/health and GET /api/v1/admin/metrics, prints the alerts as JSON lines and exits 1 when there is at least one, so a
// GitHub Actions schedule (every 30 minutes) can open an issue from the output. The workflow file itself is the QA lane's
// (.github/workflows/health-watch.yml): it only needs to run this command and open an issue on exit code 1.
// The rules, on the counters of the UTC day so far (ops_daily keeps day totals, not hours):
//   health fails                          the call fails, or ok is false, or the database is not reachable
//   5xx above 2 percent                   http_5xx / requests, from 50 requests
//   email errors above 10 percent         email_errors / (codes_sent + email_errors), from 10 attempts
//   AI errors above 10 percent            ai_errors / ai_calls, from 10 calls
//   AI spend past 80 percent of the cap   ai_calls against limits.ai_daily_cap, when a cap is set
// Nothing here prints a person: only the rule name and the numbers.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const RULES = { http5xxRate: 0.02, http5xxMin: 50, emailErrorRate: 0.1, emailMin: 10, aiErrorRate: 0.1, aiMin: 10, aiSpendShare: 0.8 };

export function evaluate({ health, metrics, now = Date.now() }) {
  const alerts = [], add = (rule, detail) => alerts.push({ rule, detail });
  if (!health || health.ok !== true || health.db !== true) add('health_failed', 'the health check did not report ok with the database up');
  if (!metrics || metrics.ok !== true) { add('metrics_unavailable', 'the metrics endpoint did not answer ok'); return alerts; }
  const day = new Date(now).toISOString().slice(0, 10), m = ((metrics.days || []).find(d => d.day === day) || {}).metrics || {};
  const n = k => (Number.isFinite(m[k]) ? m[k] : 0), rate = (a, b) => (b > 0 ? a / b : 0), pct = x => Math.round(x * 1000) / 10;
  if (n('requests') >= RULES.http5xxMin && rate(n('http_5xx'), n('requests')) > RULES.http5xxRate) add('http_5xx_rate', `${pct(rate(n('http_5xx'), n('requests')))} percent of ${n('requests')} requests`);
  const sends = n('codes_sent') + n('email_errors');
  if (sends >= RULES.emailMin && rate(n('email_errors'), sends) > RULES.emailErrorRate) add('email_error_rate', `${pct(rate(n('email_errors'), sends))} percent of ${sends} sends`);
  if (n('ai_calls') >= RULES.aiMin && rate(n('ai_errors'), n('ai_calls')) > RULES.aiErrorRate) add('ai_error_rate', `${pct(rate(n('ai_errors'), n('ai_calls')))} percent of ${n('ai_calls')} calls`);
  const cap = metrics.limits && metrics.limits.ai_daily_cap;
  if (cap > 0 && n('ai_calls') >= cap * RULES.aiSpendShare) add('ai_spend_near_cap', `${n('ai_calls')} of ${cap} calls today`);
  return alerts;
}

async function getJson(url, headers = {}) {
  try { const res = await fetch(url, { headers }); const body = await res.json().catch(() => null); return res.ok ? body : null; } catch { return null; }
}
export async function watch(base, adminKey) {
  const root = String(base).replace(/\/+$/, '');
  return evaluate({ health: await getJson(root + '/api/v1/health'), metrics: await getJson(root + '/api/v1/admin/metrics', { 'x-admin-key': adminKey || '' }) });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!process.env.MARGWISE_URL) { console.error('set MARGWISE_URL (and ADMIN_KEY)'); process.exit(2); }
  const alerts = await watch(process.env.MARGWISE_URL, process.env.ADMIN_KEY);
  for (const a of alerts) console.log(JSON.stringify(a));
  console.log(alerts.length ? `${alerts.length} alert(s)` : 'no alerts');
  process.exit(alerts.length ? 1 : 0);
}
