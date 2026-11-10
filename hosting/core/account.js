// POST /api/v1/me/export, /me/delete and /me/logout-all  (SPEC 9, BACKEND ADR-11, ADR-14, T3.5)
// Export and delete cover every table in the data inventory (hosting/core/data_inventory.js). A test builds a person with a row in every such
// table and checks that delete leaves none, and that the export has every inventory field (so a new table or column cannot be forgotten).
import { defineRoute, ok, fail, readJson } from './http.js';
import { SCHEMAS } from './api_schemas.js';
import { authenticate } from './auth.js';

// An empty body or {} (the contract has no fields). Anything else is bad_request.
async function readEmpty(request, schema, rid) {
  const raw = new Uint8Array(await request.clone().arrayBuffer());
  if (raw.byteLength === 0) return null;
  const r = await readJson(request, { max: 64, schema, rid }); return r.response || null;
}

// ---- export: every inventory field about this person, table by table. Keyed hashes and the lookup keys are left out: they mean nothing to a person. ----
export async function exportTables(db, t) {
  const id = t.id, eh = t.email_hash, out = [];
  const add = async (table, stmt) => { const rows = (await stmt.all()).results; if (rows.length) { const columns = Object.keys(rows[0]); out.push({ table, columns, rows: rows.map(r => columns.map(c => r[c])) }); } };
  await add('testers', db.prepare('SELECT id, name, track, age_band, email, created_at, invite_id, source, consent_on, research_ok, key_v, tok_after FROM testers WHERE id = ?').bind(id));
  await add('profiles', db.prepare('SELECT v, rev, data, job_release, matcher_version, updated_at FROM profiles WHERE tester_id = ?').bind(id));
  await add('events', db.prepare('SELECT id, session_id, ts, type, data, eid FROM events WHERE tester_id = ? ORDER BY id').bind(id));
  await add('ai_calls', db.prepare('SELECT day, n, tokens, prompt_version FROM ai_calls WHERE tester_id = ? ORDER BY day').bind(id));
  await add('reviews', db.prepare('SELECT id, code, counsellor, baseline, baseline_at, app_top, overlap, overlap6, missed, wrong, wrong_field, use_it, notes, reviewed_at, counsellor_id, blind, career_note, sure, sections, view_after FROM reviews WHERE tester_id = ?').bind(id));
  await add('followups', db.prepare('SELECT id, months, stream, used, note, counsellor_id, created_at FROM followups WHERE tester_id = ? ORDER BY months').bind(id));
  if (eh) {
    await add('email_codes', db.prepare('SELECT expires_at, tries, invite_id, age_band, created_at FROM email_codes WHERE email_hash = ?').bind(eh));
    await add('email_sends', db.prepare('SELECT day, n FROM email_sends WHERE email_hash = ? ORDER BY day').bind(eh));
  }
  return out;
}

export const handleExport = defineRoute('POST /api/v1/me/export', async (request, deps, { rid }) => {
  const a = await authenticate(deps, request, { rid }); if (a.response) return a.response;
  const bad = await readEmpty(request, SCHEMAS.me_export, rid); if (bad) return bad;
  return ok({ generated_at: deps.now(), tables: await exportTables(deps.db, a.tester) }, { rid, headers: a.headers });
});

// ---- delete: everything about this person, from every table, in one transaction, then an audit row with no identity ----
export function deleteStatements(db, id, emailHash, now) {
  return [
    db.prepare('DELETE FROM events WHERE tester_id = ?').bind(id),
    db.prepare('DELETE FROM reviews WHERE tester_id = ?').bind(id),
    db.prepare('DELETE FROM followups WHERE tester_id = ?').bind(id),
    db.prepare('DELETE FROM profiles WHERE tester_id = ?').bind(id),
    db.prepare('DELETE FROM ai_calls WHERE tester_id = ?').bind(id),
    db.prepare('DELETE FROM email_codes WHERE email_hash = ?').bind(emailHash || ''),
    db.prepare('DELETE FROM email_sends WHERE email_hash = ?').bind(emailHash || ''),
    // a short-lived mark so a pending sign-up token issued before now cannot make the account again (S4); the purge removes it after an hour
    db.prepare("INSERT INTO meta (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v").bind('del:' + (emailHash || ''), String(now)),
    db.prepare("DELETE FROM meta WHERE k LIKE 'del:%' AND CAST(v AS INTEGER) < ?").bind(now - 3600000),
    db.prepare("DELETE FROM testers WHERE id = ? AND track = 'adult'").bind(id),   // the token stops working once the tester is gone: that is the session revoke
    db.prepare('INSERT INTO audit (ts, action, detail) VALUES (?, ?, ?)').bind(now, 'account_deleted', JSON.stringify({ track: 'adult' })),
  ];
}
export const handleDelete = defineRoute('POST /api/v1/me/delete', async (request, deps, { rid }) => {
  const a = await authenticate(deps, request, { rid }); if (a.response) return a.response;
  const r = await readJson(request, { max: 256, schema: SCHEMAS.me_delete, rid }); if (r.response) return r.response;
  await deps.db.batch(deleteStatements(deps.db, a.tester.id, a.tester.email_hash, deps.now()));
  return ok({}, { rid });
});

// ---- log out everywhere: every token issued up to now stops working (testers.tok_after) ----
export const handleLogoutAll = defineRoute('POST /api/v1/me/logout-all', async (request, deps, { rid }) => {
  const a = await authenticate(deps, request, { rid }); if (a.response) return a.response;
  const bad = await readEmpty(request, SCHEMAS.me_logout_all, rid); if (bad) return bad;
  await deps.db.prepare("UPDATE testers SET tok_after = ? WHERE id = ? AND track = 'adult'").bind(deps.now(), a.tester.id).run();
  return ok({}, { rid });   // no refreshed token: this session is revoked too
});
