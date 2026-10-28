// GET /api/v1/health (BACKEND ADR-10): is the database reachable, which release and API version, which switches, is email set up.
// It returns no secrets and nothing about people. Used by the monitoring check every 30 minutes.
import { defineRoute, ok, fail } from './http.js';

export const handle = defineRoute('GET /api/v1/health', async (request, deps, { rid }) => {
  let db = false;
  try { const r = await deps.db.prepare('SELECT 1 AS up').first(); db = !!(r && r.up === 1); } catch { db = false; }
  const body = {
    db, release: deps.config.release, api_v: deps.config.apiV, environment: deps.config.environment,
    flags: { adult_signup: deps.flags.adultSignup, ai_enabled: deps.flags.aiEnabled, email_dry_run: deps.flags.emailDryRun, show_demand: deps.flags.showDemand },
    email_configured: !!deps.config.emailFrom,
  };
  return db ? ok(body, { rid }) : fail('unavailable', { rid, extra: body });
});
