import { describe, expect, it } from 'vitest';
import { findPiiKeysInJsonSchema, findPiiKeysInValue, isPiiKey } from './pii.ts';

describe('isPiiKey — 04 §6.2 data minimisation', () => {
  it.each([
    'name',
    'firstName',
    'full_name',
    'email',
    'emailAddress',
    'phone',
    'mobileNumber',
    'school',
    'schoolName',
    'address',
    'dob',
    'dateOfBirth',
    'age',
    'exactAge',
    'income',
    'annualIncome',
    'lat',
    'latitude',
    'lng',
    'longitude',
    'geo',
    'ip',
    'ipAddress',
    'userAgent',
    'user_agent',
    'fingerprint',
    'deviceId',
    'contact',
    'contacts',
    'aadhaar',
    'pan',
  ])('flags %s', (key) => {
    expect(isPiiKey(key)).toBe(true);
  });

  it.each([
    'type',
    'sessionId',
    'scene',
    'careerId',
    'durationMs',
    'itemNumber',
    'cityTier',
    'incomeBand',
    'classYear',
    'tier',
    'noticeVersion',
    'arm',
    'deviceClass',
    'plan',
    'span',
  ])('allows %s', (key) => {
    expect(isPiiKey(key)).toBe(false);
  });
});

describe('findPiiKeysInValue — server-side deep scan of incoming JSON', () => {
  it('finds PII keys at any depth, including inside arrays', () => {
    const payload = { events: [{ type: 'x', meta: { email: 'a@b.c' } }], deep: [[{ phone: '1' }]] };
    expect(findPiiKeysInValue(payload).sort()).toEqual(
      ['events.0.meta.email', 'deep.0.0.phone'].sort(),
    );
  });

  it('returns nothing for clean payloads and primitives', () => {
    expect(findPiiKeysInValue({ a: 1, b: [1, 'x', null] })).toEqual([]);
    expect(findPiiKeysInValue('name')).toEqual([]);
  });
});

describe('findPiiKeysInJsonSchema — catches a schema that gains a PII field', () => {
  it('walks properties, items, anyOf/oneOf/allOf and $defs', () => {
    const schema = {
      type: 'object',
      properties: {
        ok: { type: 'string' },
        nested: { type: 'object', properties: { email: { type: 'string' } } },
      },
      anyOf: [{ properties: { phone: {} } }],
      items: { properties: { school: {} } },
      $defs: { X: { properties: { dob: {} } } },
    };
    expect(findPiiKeysInJsonSchema(schema).sort()).toEqual(['dob', 'email', 'phone', 'school']);
  });
});
