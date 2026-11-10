// Who is calling? (BACKEND ADR-04, ADR-15, ADR-20.) authenticate(deps, request) -> {tester, headers} or {response}.
// The tester id always comes from the verified token, never from the request body. Every failure is the same 401, so a caller learns nothing
// about which check failed. The checks, in order: Authorization header, token shape, key version, MAC, issue time (in readSession), then the
// database: the tester exists, is an adult, and the token was not issued before tok_after. A student token has another format and never passes.
import { fail } from './http.js';
import { readSession, mintSession, keysProblem, SESSION_REFRESH_AFTER } from './keys.js';

export async function authenticate(deps, request, { rid } = {}) {
  if (keysProblem(deps)) return { response: fail('unavailable', { rid }) };   // fail closed: no keys, no sessions
  const h = request.headers.get('authorization') || '', m = /^Bearer ([^\s]+)$/.exec(h);
  const s = m ? await readSession(deps, m[1]) : null;
  if (!s) return { response: fail('unauthorized', { rid }) };
  const t = await deps.db.prepare("SELECT id, tok_after, email_hash, key_v, age_band FROM testers WHERE id = ? AND track = 'adult'").bind(s.id).first();
  // tok_after revokes everything issued up to and including that millisecond (fail closed on a tie)
  if (!t || (t.tok_after != null && s.iat <= t.tok_after)) return { response: fail('unauthorized', { rid }) };
  const headers = {};
  const at = deps.now();
  if (at - s.iat > SESSION_REFRESH_AFTER) {   // sliding session: a new token at most once a day, sent in the x-session-token header
    // The new token is handed out only if this UPDATE still finds tok_after before its issue time `at`. So a "log out everywhere" that commits
    // between the check above and here either stops the refresh, or revokes the new token (its iat is not after tok_after). (S3)
    const u = await deps.db.prepare("UPDATE testers SET key_v = ? WHERE id = ? AND track = 'adult' AND (tok_after IS NULL OR tok_after < ?)").bind(deps.config.signKeyV, t.id, at).run();
    if (u.meta && u.meta.changes === 1) headers['x-session-token'] = await mintSession(deps, t.id, at);
  }
  return { tester: t, headers };
}
