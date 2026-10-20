// Deno entrypoint. Logic lives in ../_lib (runtime-agnostic, unit-tested in Vitest).
import { createClient } from '@supabase/supabase-js';
import { handleDeletionRequest } from '../_lib/deletion-request.ts';
import { supabaseTelemetryStore, type SchemaClient } from '../_lib/supabase-store.ts';
import { cachedFlag, sha256Hex, windowRateLimiter } from '../_lib/util.ts';

const url = Deno.env.get('SUPABASE_URL');
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if (!url || !serviceKey) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');

const db = createClient(url, serviceKey, {
  auth: { persistSession: false },
  db: { schema: 'telemetry' },
});
const store = supabaseTelemetryStore(db as unknown as SchemaClient);
// Kill switch read at most every 10 s per isolate (review #7).
const minorsTelemetryEnabled = cachedFlag(() => store.minorsTelemetryEnabled(), 10_000);
const deps = {
  store: { ...store, minorsTelemetryEnabled },
  rateLimiter: windowRateLimiter({ limit: 120, windowMs: 60_000 }),
  sha256: sha256Hex,
};

Deno.serve((req) => handleDeletionRequest(req, deps));
