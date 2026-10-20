import {
  ConsentRecord,
  CoverageRequest,
  EventBatch,
  Feedback,
  findPiiKeysInValue,
  ItemResponses,
  TIER_REQUIRED,
} from '@margwise/contracts';
import { json, preflight, readJson, schemaViolation, sessionIdOf } from './http.ts';
import type { Deps } from './ports.ts';

export { MAX_BODY_BYTES } from './http.ts';

type Route = 'consent' | 'events' | 'responses' | 'coverage-requests' | 'feedback';

const ROUTES = {
  consent: {
    schema: ConsentRecord,
    minTier: null,
    write: (d: Deps, v: ConsentRecord) => d.store.recordConsent(v),
  },
  events: {
    schema: EventBatch,
    minTier: TIER_REQUIRED.events,
    write: (d: Deps, v: EventBatch) => d.store.insertEvents(v),
  },
  responses: {
    schema: ItemResponses,
    minTier: TIER_REQUIRED.responses,
    write: (d: Deps, v: ItemResponses) => d.store.insertResponses(v),
  },
  'coverage-requests': {
    schema: CoverageRequest,
    minTier: TIER_REQUIRED.coverageRequests,
    write: (d: Deps, v: CoverageRequest) => d.store.insertCoverageRequest(v),
  },
  feedback: {
    schema: Feedback,
    minTier: TIER_REQUIRED.feedback,
    write: (d: Deps, v: Feedback) => d.store.insertFeedback(v),
  },
} as const;

function routeOf(req: Request): Route | undefined {
  const last = new URL(req.url).pathname.split('/').filter(Boolean).at(-1);
  return last !== undefined && last in ROUTES ? (last as Route) : undefined;
}

/**
 * Telemetry ingest (04 §5.2, §6.4). Order of checks: method → route → size
 * and JSON → PII denylist → kill switch → rate limit → closed schema →
 * consent tier → insert. Nothing in the request is logged or echoed, and
 * IP addresses are only hashed in memory for rate limiting, never stored.
 */
export async function handleTelemetryIngest(req: Request, deps: Deps): Promise<Response> {
  if (req.method === 'OPTIONS') return preflight();
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });
  const route = routeOf(req);
  if (!route) return json(404, { error: 'not_found' });

  const body = await readJson(req);
  if (!body.ok) return body.response;

  const pii = findPiiKeysInValue(body.value);
  if (pii.length > 0) return json(400, { error: 'pii_key', paths: pii });

  if (!(await deps.store.minorsTelemetryEnabled()))
    return json(403, { error: 'telemetry_disabled' });

  const sessionId = sessionIdOf(body.value);
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  if (sessionId && !deps.rateLimiter.allow(`s:${sessionId}`))
    return json(429, { error: 'rate_limited' });
  if (ip && !deps.rateLimiter.allow(`ip:${await deps.sha256(ip)}`))
    return json(429, { error: 'rate_limited' });

  const { schema, minTier, write } = ROUTES[route];
  const parsed = schema.safeParse(body.value);
  if (!parsed.success) return schemaViolation(parsed.error.issues);

  if (minTier !== null) {
    const consent = await deps.store.latestConsent(parsed.data.sessionId);
    if (!consent || consent.tier < minTier) return json(403, { error: 'no_consent' });
  }

  await (write as (d: Deps, v: unknown) => Promise<void>)(deps, parsed.data);
  return json(202);
}
