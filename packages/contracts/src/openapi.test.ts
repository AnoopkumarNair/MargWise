import { describe, expect, it } from 'vitest';
import { buildOpenApi } from './openapi.ts';

describe('OpenAPI 3.1 document (04 §5)', () => {
  const doc = buildOpenApi();

  it('is OpenAPI 3.1', () => {
    expect(doc.openapi).toBe('3.1.0');
  });

  it('declares every endpoint in 04 §5', () => {
    expect(Object.keys(doc.paths).sort()).toEqual(
      [
        '/content/v1/current',
        '/content/v1/releases/{id}/manifest',
        '/content/v1/releases/{id}/core',
        '/content/v1/releases/{id}/colleges/{courseCode}',
        '/content/v1/releases/{id}/countries/{code}',
        '/content/v1/releases/{id}/ai-exposure',
        '/content/v1/coverage',
        '/telemetry/v1/consent',
        '/telemetry/v1/events',
        '/telemetry/v1/responses',
        '/telemetry/v1/coverage-requests',
        '/telemetry/v1/feedback',
        '/telemetry/v1/deletion',
        '/review/v1/changes',
        '/review/v1/changes/{id}',
        '/review/v1/changes/{id}/{decision}',
        '/review/v1/releases',
        '/review/v1/releases/{id}/rollback',
      ].sort(),
    );
  });

  it('every $ref resolves to a component schema', () => {
    const refs = JSON.stringify(doc).match(/"#\/components\/schemas\/[^"]+"/g) ?? [];
    expect(refs.length).toBeGreaterThan(10);
    for (const ref of refs) {
      const name = ref.slice('"#/components/schemas/'.length, -1);
      expect(doc.components.schemas, `missing ${name}`).toHaveProperty(name);
    }
  });

  it('is deterministic (CI diffs the committed file)', () => {
    expect(JSON.stringify(buildOpenApi())).toBe(JSON.stringify(doc));
  });

  it('telemetry endpoints are insert-only POSTs', () => {
    for (const [path, item] of Object.entries(doc.paths)) {
      if (path.startsWith('/telemetry/')) expect(Object.keys(item)).toEqual(['post']);
    }
  });
});
