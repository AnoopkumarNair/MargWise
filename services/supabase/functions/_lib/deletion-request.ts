import { DeletionRequest } from '@margwise/contracts';
import { json, preflight, readJson, schemaViolation } from './http.ts';
import type { Deps } from './ports.ts';

/**
 * "Delete my data" (04 §5.2, §6.1). The family proves ownership with the
 * deletion code shown at consent time; the server only ever stored its hash.
 * Honoured regardless of the kill switch. Unknown session and wrong code get
 * the same 404 so the endpoint cannot be used to probe for sessions.
 */
export async function handleDeletionRequest(req: Request, deps: Deps): Promise<Response> {
  if (req.method === 'OPTIONS') return preflight();
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  const body = await readJson(req);
  if (!body.ok) return body.response;
  const parsed = DeletionRequest.safeParse(body.value);
  if (!parsed.success) return schemaViolation(parsed.error.issues);

  const { sessionId, deletionCode } = parsed.data;
  if (!deps.rateLimiter.allow(`del:${sessionId}`)) return json(429, { error: 'rate_limited' });

  const consent = await deps.store.latestConsent(sessionId);
  if (!consent || consent.deletionCodeHash !== (await deps.sha256(deletionCode)))
    return json(404, { error: 'not_found' });

  await deps.store.requestDeletion(sessionId);
  return json(202);
}
