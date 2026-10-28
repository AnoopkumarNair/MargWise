// Responses and request reading for the adult API (BACKEND ADR-09).
// Every response: content-type application/json, cache-control no-store, x-content-type-options nosniff, x-request-id. No CORS headers (same origin only).
// Success: {ok:true, ...}. Failure: {ok:false, error:{code, message}}. The message is safe to show to a person.
import { validate } from '../../contracts/validate.js';

// The only error codes. Keep this list short; a new code needs a new ADR note.
//   bad_request   the request is wrong (shape, type, method)      too_large     body over the limit
//   invalid_code  wrong one-time code or link                     expired       code, link or pending token ran out
//   unauthorized  no valid session                                forbidden     valid session, not allowed
//   not_found     nothing there                                   conflict      the profile changed (stale rev)
//   rate_limited  too many tries                                  unavailable   a part we depend on is down or switched off
//   internal      our bug; nothing about it is shown
export const ERRORS = {
  bad_request: [400, 'The request was not valid.'],
  too_large: [413, 'That is too large to send.'],
  invalid_code: [400, 'That code did not work. Check it and try again.'],
  expired: [410, 'That has expired. Please ask for a new one.'],
  unauthorized: [401, 'Please sign in again.'],
  forbidden: [403, 'You are not allowed to do that.'],
  not_found: [404, 'We could not find that.'],
  conflict: [409, 'This changed somewhere else.'],
  rate_limited: [429, 'Too many tries. Please wait a while and try again.'],
  unavailable: [503, 'This is not available right now. Please try again later.'],
  internal: [500, 'Something went wrong on our side.'],
};

const codes = new WeakMap();   // Response -> error code, so the logger can record it without exposing it in a header
export const codeOf = res => codes.get(res) || null;

const headers = (rid, extra) => ({ 'content-type': 'application/json', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...(rid ? { 'x-request-id': rid } : {}), ...extra });

export function ok(body = {}, { rid, status = 200, headers: extra } = {}) {
  return new Response(JSON.stringify({ ok: true, ...body }), { status, headers: headers(rid, extra) });
}

// fail('conflict', {rid, extra:{current: doc}}). `message` replaces the default only with text you wrote yourself (never user input).
export function fail(code, { rid, message, status, extra, headers: h } = {}) {
  const e = ERRORS[code] || ERRORS.internal; if (!ERRORS[code]) code = 'internal';
  const res = new Response(JSON.stringify({ ok: false, error: { code, message: message || e[1] }, ...extra }), { status: status || e[0], headers: headers(rid, h) });
  codes.set(res, code); return res;
}

export const newRid = deps => [...deps.random(8)].map(b => b.toString(16).padStart(2, '0')).join('');

// Read a JSON object body. Refuses a wrong content type, a body over `max` bytes, bad JSON and anything that is not an object.
// If `schema` is given the value must also pass it (contracts/validate.js). Returns {value} or {response}. The error text from the
// validator is NOT sent back, because it can contain the person's own input.
export async function readJson(request, { max = 8192, schema, rid } = {}) {
  if (!/^application\/json\b/i.test(request.headers.get('content-type') || '')) return { response: fail('bad_request', { rid }) };
  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > max) return { response: fail('too_large', { rid }) };
  let raw; try { raw = new Uint8Array(await request.arrayBuffer()); } catch { return { response: fail('bad_request', { rid }) }; }
  if (raw.byteLength > max) return { response: fail('too_large', { rid }) };
  let value; try { value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(raw)); } catch { return { response: fail('bad_request', { rid }) }; }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { response: fail('bad_request', { rid }) };
  if (schema) { const v = checkContract(schema, value); if (!v.ok) return { response: fail('bad_request', { rid }) }; }
  return { value };
}

// Contract check that never throws: a broken schema is our bug, so it counts as a failure rather than letting bad data in.
export function checkContract(schema, value) {
  try { const r = validate(schema, value); return { ok: !!(r && r.ok), errors: (r && r.errors) || [] }; }
  catch { return { ok: false, errors: ['schema could not be applied'] }; }
}

// Wrap a handler body as handle(request, deps) -> Response. It sets the request id, checks the method, catches bugs
// (answering `internal`, never the error text) and writes the one log line.
//   route: 'POST /api/v1/email/start' (a fixed name; this is what gets logged)
//   fn(request, deps, {rid}) -> Response built with ok() / fail()
export function defineRoute(route, fn) {
  const method = route.split(' ')[0];
  return async function handle(request, deps) {
    const t0 = deps.now(), rid = newRid(deps); let res;
    try {
      if (request.method !== method) res = fail('bad_request', { rid, status: 405, headers: { allow: method } });
      else res = await fn(request, deps, { rid });
    } catch { res = fail('internal', { rid }); }
    if (!res.headers.get('x-request-id')) { const h = new Headers(res.headers); h.set('x-request-id', rid); const c = codes.get(res); res = new Response(res.body, { status: res.status, headers: h }); if (c) codes.set(res, c); }
    deps.log({ ts: t0, rid, route, status: res.status, ms: deps.now() - t0, release: deps.config.release, api_v: deps.config.apiV, error_code: codeOf(res) });
    return res;
  };
}
