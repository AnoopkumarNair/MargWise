// GET /api/v1/health (BACKEND ADR-10): is the database reachable, which release and API version, is AI on, is email set up, which switches.
// The body has exactly the fields of contracts/api/health.response.schema.json. When the database is down the status is 503 and the
// same body also carries error {code: 'unavailable', message}. It returns no secrets and nothing about people.
// Used by the monitoring check every 30 minutes.
import { defineRoute, ok, fail } from './http.js';

export function healthBody(deps, db) {
  return {
    db, release: deps.config.release, api_v: deps.config.apiV,
    ai_enabled: !!(deps.flags.aiEnabled && deps.config.secrets && deps.config.secrets.ai),   // the switch is on AND a key is set
    email_configured: !!deps.config.emailFrom,
    flags: { adult_signup: deps.flags.adultSignup, ai_enabled: deps.flags.aiEnabled, email_dry_run: deps.flags.emailDryRun, show_demand: deps.flags.showDemand },
  };
}

export const handle = defineRoute('GET /api/v1/health', async (request, deps, { rid }) => {
  let db = false;
  try { const r = await deps.db.prepare('SELECT 1 AS up').first(); db = !!(r && r.up === 1); } catch { db = false; }
  const body = healthBody(deps, db);
  return db ? ok(body, { rid }) : fail('unavailable', { rid, extra: body });
});
