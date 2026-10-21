export const MAX_BODY_BYTES = 64 * 1024;

const CORS = {
  // No cookies or credentials are ever sent, so a wildcard origin exposes nothing.
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST',
  'access-control-allow-headers': 'content-type, authorization, apikey',
  'access-control-max-age': '86400',
};

export function json(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { ...CORS, 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

export const preflight = () => new Response(null, { status: 204, headers: CORS });

export type ParsedBody = { ok: true; value: unknown } | { ok: false; response: Response };

/** Reads and parses a bounded JSON body. Never logs or echoes its contents. */
export async function readJson(req: Request): Promise<ParsedBody> {
  const declared = Number(req.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES)
    return { ok: false, response: json(413, { error: 'too_large' }) };
  const text = await req.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES)
    return { ok: false, response: json(413, { error: 'too_large' }) };
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false, response: json(400, { error: 'invalid_json' }) };
  }
}

/** Zod issue paths only — values are never reflected back. */
export function schemaViolation(
  issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey> }>,
): Response {
  return json(400, {
    error: 'schema_violation',
    paths: issues.map((i) => i.path.map(String).join('.')),
  });
}

export function sessionIdOf(value: unknown): string | undefined {
  if (
    value &&
    typeof value === 'object' &&
    'sessionId' in value &&
    typeof value.sessionId === 'string'
  )
    return value.sessionId;
  return undefined;
}
