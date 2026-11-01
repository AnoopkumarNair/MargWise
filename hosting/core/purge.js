// The adult daily purge (SPEC 10, BACKEND ADR-11): on the first request of the day, delete `email_codes` older than 24 hours, `email_sends`
// older than 7 days and `joins` older than 24 hours; and, when RETENTION_DAYS_ADULT is set, adults older than that, from every table.
// Safe to call on every request: a meta row ('adult_purge') holds the day it last ran. Errors never block a request.
import { dayKey, DAY } from './limits.js';

// Everything about the adults created before `cut`, from every table in the data inventory (hosting/core/data_inventory.js). A test checks
// that a database with a row in every such table is empty of that person afterwards.
export function retentionStatements(db, cut) {
  return [
    db.prepare("DELETE FROM events WHERE tester_id IN (SELECT id FROM testers WHERE track = 'adult' AND created_at < ?)").bind(cut),
    db.prepare("DELETE FROM reviews WHERE tester_id IN (SELECT id FROM testers WHERE track = 'adult' AND created_at < ?)").bind(cut),
    db.prepare("DELETE FROM followups WHERE tester_id IN (SELECT id FROM testers WHERE track = 'adult' AND created_at < ?)").bind(cut),
    db.prepare("DELETE FROM profiles WHERE tester_id IN (SELECT id FROM testers WHERE track = 'adult' AND created_at < ?)").bind(cut),
    db.prepare("DELETE FROM ai_calls WHERE tester_id IN (SELECT id FROM testers WHERE track = 'adult' AND created_at < ?)").bind(cut),
    db.prepare("DELETE FROM email_codes WHERE email_hash IN (SELECT email_hash FROM testers WHERE track = 'adult' AND created_at < ? AND email_hash IS NOT NULL)").bind(cut),
    db.prepare("DELETE FROM email_sends WHERE email_hash IN (SELECT email_hash FROM testers WHERE track = 'adult' AND created_at < ? AND email_hash IS NOT NULL)").bind(cut),
    db.prepare("DELETE FROM testers WHERE track = 'adult' AND created_at < ?").bind(cut),
  ];
}

export async function purgeAdultDaily(deps) {
  try {
    const now = deps.now(), today = dayKey(now);
    const last = await deps.db.prepare("SELECT v FROM meta WHERE k = 'adult_purge'").first();
    if (last && last.v === today) return false;
    const stmts = [
      deps.db.prepare('DELETE FROM email_codes WHERE created_at < ?').bind(now - DAY),
      deps.db.prepare('DELETE FROM email_sends WHERE day < ?').bind(dayKey(now - 7 * DAY)),
      deps.db.prepare('DELETE FROM joins WHERE ts < ?').bind(now - DAY),
    ];
    const days = deps.config.retentionDays.adult;
    if (days > 0) {
      const cut = now - days * DAY, n = await deps.db.prepare("SELECT COUNT(*) AS n FROM testers WHERE track = 'adult' AND created_at < ?").bind(cut).first();
      stmts.push(...retentionStatements(deps.db, cut));
      stmts.push(deps.db.prepare('INSERT INTO audit (ts, action, detail) VALUES (?, ?, ?)').bind(now, 'purge_adult', JSON.stringify({ deleted: n ? n.n : 0, retentionDays: days })));   // counts only, no identity
    }
    stmts.push(deps.db.prepare("INSERT INTO meta (k, v) VALUES ('adult_purge', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v").bind(today));
    await deps.db.batch(stmts);
    return true;
  } catch { return false; }
}
