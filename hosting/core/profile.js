// GET and PUT /api/v1/me/profile  (SPEC 9, BACKEND ADR-05, ADR-06, T3.5)
// The profile is one JSON document with an edit counter. `rev` lives only in the table and in the API wrapper {rev, data}, never inside data (D4).
//  GET: the stored document, upgraded to the current v (contracts/profile_migrations.js) and with retired ids mapped (contracts/migrate_ids.js).
//       The stored row changes only when the person saves. No profile yet is `not_found`.
//  PUT {rev, data}: the contract check (strict, no free text), the 32 KB limit, every id must be in the current release's id list, then a
//       write that only succeeds if rev is still the stored one. A stale rev is 409 `conflict` with the current document: the app offers
//       "Keep mine" or "Use the newer one", and the server never merges.
import { defineRoute, ok, fail, readJson } from './http.js';
import { SCHEMAS } from './api_schemas.js';
import { authenticate } from './auth.js';
import { loadRelease, unknownIds } from './release_ids.js';
import { upgrade, PROFILE_V } from '../../contracts/profile_migrations.js';
import { migrateIds } from '../../contracts/migrate_ids.js';

export const PROFILE_MAX_BYTES = 32768;
const UNKNOWN_IDS = 'Some skills, jobs or certificates are not in the current list. Please reload the page and check them again.';
const parse = text => { try { return JSON.parse(text); } catch { return null; } };

export const handleGet = defineRoute('GET /api/v1/me/profile', async (request, deps, { rid }) => {
  const a = await authenticate(deps, request, { rid }); if (a.response) return a.response;
  const row = await deps.db.prepare('SELECT v, rev, data FROM profiles WHERE tester_id = ?').bind(a.tester.id).first();
  if (!row) return fail('not_found', { rid, headers: a.headers, message: 'There is no saved profile yet.' });
  const stored = parse(row.data); if (!stored) throw new Error('stored profile is not JSON');   // our bug: answered as internal
  let data = upgrade({ ...stored, v: row.v }), mapped = [], dropped = [], unknown = [];
  const rel = await loadRelease(deps);
  if (rel && rel.registry) {
    const m = migrateIds(data, rel.registry);
    data = m.profile; dropped = m.dropped.slice(0, 500); unknown = m.unknown.slice(0, 500);
    mapped = m.mapped.slice(0, 500).map(({ from, to, field, pick }) => (pick ? { from, to, field, pick } : { from, to, field }));   // `index` is for the app's own use only
  }
  const body = { rev: row.rev, data, mapped, dropped }; if (unknown.length) body.unknown = unknown;
  return ok(body, { rid, headers: a.headers });
});

async function conflict(deps, id, rid, headers) {
  const cur = await deps.db.prepare('SELECT v, rev, data FROM profiles WHERE tester_id = ?').bind(id).first();
  let extra; if (cur) { const d = parse(cur.data); if (d) { try { extra = { current: { rev: cur.rev, data: upgrade({ ...d, v: cur.v }) } }; } catch { extra = undefined; } } }
  return fail('conflict', { rid, extra, headers, message: 'This profile changed on another device.' });
}

export const handlePut = defineRoute('PUT /api/v1/me/profile', async (request, deps, { rid }) => {
  const a = await authenticate(deps, request, { rid }); if (a.response) return a.response;
  const r = await readJson(request, { max: 40000, schema: SCHEMAS.me_profile_put, rid }); if (r.response) return r.response;
  const { rev, data } = r.value, text = JSON.stringify(data);
  if (new TextEncoder().encode(text).length > PROFILE_MAX_BYTES) return fail('too_large', { rid });
  const rel = await loadRelease(deps); if (!rel) return fail('unavailable', { rid });   // no id list, no write
  if (unknownIds(data, rel.ids).length) return fail('bad_request', { rid, message: UNKNOWN_IDS });
  const now = deps.now(), id = a.tester.id;
  let changed;
  if (rev === 0) {   // first save: only if there is no row yet
    const x = await deps.db.prepare('INSERT INTO profiles (tester_id, v, rev, data, job_release, matcher_version, updated_at) VALUES (?, ?, 1, ?, ?, ?, ?) ON CONFLICT(tester_id) DO NOTHING')
      .bind(id, PROFILE_V, text, data.job_release || null, data.matcher_version || null, now).run();
    changed = x.meta && x.meta.changes === 1;
    if (changed) return ok({ rev: 1 }, { rid, headers: a.headers });
  } else {
    const x = await deps.db.prepare('UPDATE profiles SET v = ?, rev = rev + 1, data = ?, job_release = ?, matcher_version = ?, updated_at = ? WHERE tester_id = ? AND rev = ?')
      .bind(PROFILE_V, text, data.job_release || null, data.matcher_version || null, now, id, rev).run();
    changed = x.meta && x.meta.changes === 1;
    if (changed) return ok({ rev: rev + 1 }, { rid, headers: a.headers });
  }
  return conflict(deps, id, rid, a.headers);
});
