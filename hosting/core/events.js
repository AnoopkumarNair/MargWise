// POST /api/v1/event  {type, eid, data}  (SPEC 9, BACKEND ADR-08, T3.6)
// Adult event types: intake, profile_saved, roads_viewed, road_opened, road_added, feedback. Each type has its own strict schema
// (contracts/event_schemas.js): an unknown type, a field from another type, or free text outside feedback.text is `bad_request`. Ids and numbers
// only. Stored once per (tester, eid): a repeat is accepted and not stored again. At most EVENTS_PER_DAY a person a day.
import { defineRoute, ok, fail, readJson } from './http.js';
import { authenticate } from './auth.js';
import { schemaForType, checkEvent } from '../../contracts/event_schemas.js';

export const EVENTS_PER_DAY = 300;
export const EVENT_BODY_MAX = 12000;   // bytes; feedback.text is capped at 1,500 characters by the contract

export const handle = defineRoute('POST /api/v1/event', async (request, deps, { rid }) => {
  const a = await authenticate(deps, request, { rid }); if (a.response) return a.response;
  const r = await readJson(request, { max: EVENT_BODY_MAX, rid }); if (r.response) return r.response;
  const body = r.value;
  if (!schemaForType(body.type)) return fail('bad_request', { rid });   // an unknown type
  if (!checkEvent(body).ok) return fail('bad_request', { rid });
  const id = a.tester.id, now = deps.now();
  const dup = await deps.db.prepare('SELECT 1 AS x FROM events WHERE tester_id = ? AND eid = ?').bind(id, body.eid).first();
  if (dup) return ok({}, { rid, headers: a.headers });   // a retry of an event we already have
  const n = await deps.db.prepare('SELECT COUNT(*) AS n FROM events WHERE tester_id = ? AND ts > ?').bind(id, now - 86400000).first();
  if (n && n.n >= EVENTS_PER_DAY) return fail('rate_limited', { rid });
  await deps.db.prepare('INSERT OR IGNORE INTO events (tester_id, session_id, ts, type, data, eid) VALUES (?, NULL, ?, ?, ?, ?)').bind(id, now, body.type, JSON.stringify(body.data), body.eid).run();
  return ok({}, { rid, headers: a.headers });
});
