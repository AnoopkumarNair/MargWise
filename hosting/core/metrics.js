// GET /api/v1/admin/metrics  (BACKEND ADR-10, T3.7). For the owner and the 30-minute health watch. Aggregates only: counters per day,
// counts of rows, and the under-18 refusal totals. Never a person, an address or a token. Needs the x-admin-key header (ADMIN_KEY).
// Wrong keys are counted per IP bucket in admin_fail (prefix 'm:'), and 30 in 15 minutes locks that bucket out, as for the admin page.
import { defineRoute, ok, fail } from './http.js';
import { safeEqual, ipKey } from './keys.js';
import { dayOf } from './ops.js';
import { healthBody } from './health.js';

const DAYS = 14;
export const handle = defineRoute('GET /api/v1/admin/metrics', async (request, deps, { rid }) => {
  const adminKey = deps.config.secrets.admin, now = deps.now();
  if (typeof adminKey !== 'string' || adminKey.length < 16 || !deps.config.secrets.ip) return fail('unavailable', { rid });
  const ip = 'm:' + await ipKey(deps, request);
  const fails = await deps.db.prepare('SELECT COUNT(*) AS n FROM admin_fail WHERE ip = ? AND ts > ?').bind(ip, now - 900000).first();
  if (fails && fails.n >= 30) return fail('rate_limited', { rid });
  if (!safeEqual(request.headers.get('x-admin-key') || '', adminKey)) {
    await deps.db.prepare('INSERT INTO admin_fail (ip, ts) VALUES (?, ?)').bind(ip, now).run();
    return fail('forbidden', { rid });
  }
  const since = dayOf(now - (DAYS - 1) * 86400000);
  const rows = (await deps.db.prepare('SELECT day, metric, n FROM ops_daily WHERE day >= ? ORDER BY day, metric').bind(since).all()).results;
  const u18 = (await deps.db.prepare('SELECT day, SUM(n) AS n FROM under18 WHERE day >= ? GROUP BY day ORDER BY day').bind(since).all()).results;
  const byDay = {}; for (const r of rows) (byDay[r.day] ||= {})[r.metric] = r.n;
  for (const r of u18) (byDay[r.day] ||= {}).under18_refusals = r.n;
  return ok({
    generated_at: now,
    days: Object.keys(byDay).sort().map(day => ({ day, metrics: byDay[day] })),
    totals: {
      adult_testers: (await deps.db.prepare("SELECT COUNT(*) AS n FROM testers WHERE track = 'adult'").first()).n,
      profiles: (await deps.db.prepare('SELECT COUNT(*) AS n FROM profiles').first()).n,
      open_codes: (await deps.db.prepare('SELECT COUNT(*) AS n FROM email_codes').first()).n,
    },
    limits: { ai_daily_cap: deps.config.aiDailyCap, email_daily_cap: deps.config.emailDailyCap },
    health: healthBody(deps, true),
  }, { rid });
});
