// Daily counters (BACKEND ADR-10, T3.7). Aggregates only: a metric name and a number per UTC day, never a person, an address or a token.
// bump() is best effort: a counter that cannot be written must never break the request, so errors are swallowed.
// The under-18 refusals are NOT counted here: they live only in the `under18` table (SPEC 9), and the metrics endpoint reads them from there.
export const METRICS = ['requests', 'http_5xx', 'signups', 'codes_sent', 'code_failures', 'email_errors', 'ai_calls', 'ai_errors', 'ai_tokens'];
export const dayOf = ms => new Date(ms).toISOString().slice(0, 10);
const BUMP = 'INSERT INTO ops_daily (day, metric, n) VALUES (?, ?, ?) ON CONFLICT(day, metric) DO UPDATE SET n = n + excluded.n';
export async function bump(deps, metric, n = 1) {
  if (!METRICS.includes(metric) || !Number.isInteger(n) || n < 1 || !deps.db) return false;
  try { await deps.db.prepare(BUMP).bind(dayOf(deps.now()), metric, n).run(); return true; } catch { return false; }
}
export async function today(deps, metric) {
  try { const r = await deps.db.prepare('SELECT n FROM ops_daily WHERE day = ? AND metric = ?').bind(dayOf(deps.now()), metric).first(); return r ? r.n : 0; } catch { return 0; }
}
