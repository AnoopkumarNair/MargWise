import { z } from 'zod';
import {
  Manifest,
  CurrentPointer,
  CoreBundle,
  CollegesBundle,
  CountryBundle,
  AiExposureBundle,
} from './release.ts';
import { ChangeEvent, ReviewDecision, ReviewTask } from './review.ts';
import {
  ConsentRecord,
  CoverageRequest,
  DeletionRequest,
  EventBatch,
  Feedback,
  ItemResponses,
} from './telemetry/schemas.ts';

const COMPONENTS = {
  CurrentPointer,
  Manifest,
  CoreBundle,
  CollegesBundle,
  CountryBundle,
  AiExposureBundle,
  ConsentRecord,
  EventBatch,
  ItemResponses,
  CoverageRequest,
  Feedback,
  DeletionRequest,
  ChangeEvent,
  ReviewTask,
  ReviewDecision,
} as const;
type ComponentName = keyof typeof COMPONENTS;

const ref = (name: ComponentName) => ({ $ref: `#/components/schemas/${name}` });
const json = (name: ComponentName) => ({ content: { 'application/json': { schema: ref(name) } } });
const pathParam = (name: string, description: string) => ({
  name,
  in: 'path',
  required: true,
  schema: { type: 'string' },
  description,
});
const errors = {
  '400': { description: 'Schema violation, unknown field or PII-like key' },
  '403': {
    description: 'No consent record at the required tier, or minors telemetry switched off',
  },
  '429': { description: 'Rate limited' },
};
const get = (summary: string, schema: ComponentName, parameters: object[] = []) => ({
  get: { summary, parameters, responses: { '200': { description: 'OK', ...json(schema) } } },
});
const post = (summary: string, body: ComponentName, extra: Record<string, object> = errors) => ({
  post: {
    summary,
    requestBody: { required: true, ...json(body) },
    responses: { '202': { description: 'Accepted' }, ...extra },
  },
});

const id = pathParam('id', 'Release id, e.g. 2026-10-20.1');

/** Builds the OpenAPI 3.1 document from the Zod contracts. Output is committed and diffed in CI. */
export function buildOpenApi() {
  const schemas = Object.fromEntries(
    Object.entries(COMPONENTS).map(([name, schema]) => [
      name,
      z.toJSONSchema(schema as z.ZodType, {
        target: 'draft-2020-12',
        io: 'input',
        unrepresentable: 'any',
      }),
    ]),
  );
  return {
    openapi: '3.1.0',
    info: {
      title: 'Margwise APIs',
      version: '1.0.0',
      description:
        'Content API (static, public, read-only), Telemetry API (consent-gated, insert-only) and Review API (Studio). Generated from packages/contracts — do not edit by hand.',
    },
    paths: {
      '/content/v1/current': get('Current release pointer', 'CurrentPointer'),
      '/content/v1/releases/{id}/manifest': get('Release manifest with bundle hashes', 'Manifest', [
        id,
      ]),
      '/content/v1/releases/{id}/core': get('Core bundle', 'CoreBundle', [id]),
      '/content/v1/releases/{id}/colleges/{courseCode}': get(
        'College Explorer bundle for a course',
        'CollegesBundle',
        [id, pathParam('courseCode', 'Course slug, e.g. b-tech-cse')],
      ),
      '/content/v1/releases/{id}/countries/{code}': get('Country module', 'CountryBundle', [
        id,
        pathParam('code', 'Country code, e.g. DE'),
      ]),
      '/content/v1/releases/{id}/ai-exposure': get('Two-lens AI exposure', 'AiExposureBundle', [
        id,
      ]),
      '/content/v1/coverage': get('What is covered (share-link landing)', 'CurrentPointer'),
      '/telemetry/v1/consent': post(
        'Record consent (Tier 1 or 2) and create the session',
        'ConsentRecord',
      ),
      '/telemetry/v1/events': post('Batch of usage events (Tier 1+)', 'EventBatch'),
      '/telemetry/v1/responses': post(
        'Item responses and area scores (Tier 2 only)',
        'ItemResponses',
      ),
      '/telemetry/v1/coverage-requests': post('Coverage request (Tier 1+)', 'CoverageRequest'),
      '/telemetry/v1/feedback': post('Structured feedback (Tier 1+)', 'Feedback'),
      '/telemetry/v1/deletion': post(
        'Delete all rows for a session within 7 days',
        'DeletionRequest',
        {
          '400': errors['400'],
          '404': { description: 'Unknown session or code (same response for both)' },
        },
      ),
      '/review/v1/changes': {
        get: {
          summary: 'Change queue',
          parameters: [
            {
              name: 'status',
              in: 'query',
              schema: { type: 'string', enum: ['pending', 'approved', 'edited', 'rejected'] },
            },
          ],
          responses: {
            '200': {
              description: 'OK',
              content: {
                'application/json': { schema: { type: 'array', items: ref('ReviewTask') } },
              },
            },
          },
        },
      },
      '/review/v1/changes/{id}': get(
        'Change detail: diff, extracted fact, quote, snapshot',
        'ChangeEvent',
        [pathParam('id', 'Review task id')],
      ),
      '/review/v1/changes/{id}/{decision}': {
        post: {
          summary: 'Approve, edit or reject a change',
          parameters: [
            pathParam('id', 'Review task id'),
            {
              name: 'decision',
              in: 'path',
              required: true,
              schema: { type: 'string', enum: ['approve', 'edit', 'reject'] },
            },
          ],
          requestBody: { required: true, ...json('ReviewDecision') },
          responses: {
            '200': { description: 'Recorded' },
            '403': { description: 'Role not allowed for this stream' },
          },
        },
      },
      '/review/v1/releases': {
        post: {
          summary: 'Build and publish a release from approved facts (validation gate applies)',
          responses: {
            '201': { description: 'Published', ...json('Manifest') },
            '422': { description: 'Validation gate refused the release' },
          },
        },
      },
      '/review/v1/releases/{id}/rollback': {
        post: {
          summary: 'Point current.json back at this release',
          parameters: [id],
          responses: { '200': { description: 'Rolled back', ...json('CurrentPointer') } },
        },
      },
    },
    components: { schemas },
  };
}
