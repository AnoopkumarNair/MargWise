// D29 (amendment A2): the sign-up flow sends the verified address in POST /email/complete, and that body fits the frozen contract.
//   node --test app/adult/tests/unit/account_complete_email.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { checkContract } from '../../../../hosting/core/http.js';
import { SCHEMAS } from '../../../../hosting/core/api_schemas.js';

const flow = readFileSync(fileURLToPath(new URL('../../account/flow.js', import.meta.url)), 'utf8');

test('the profile step posts the address held in the flow beside the pending token', () => {
  const call = flow.match(/api\.post\('\/email\/complete', (\{[^}]*\})/);
  assert.ok(call, 'the complete call is there');
  assert.match(call[1], /\bpending: f\.pending\b/); assert.match(call[1], /\bemail: askEmail \? addr\.value\.trim\(\) : f\.email\b/, "the flow address, or the one typed on a link device");
});

test('that body fits the email_complete contract, and a bad address does not', () => {
  const h = 'a'.repeat(64), pending = `p1.${h}.42.25-34.1761609600000.${h}`;
  const body = { pending, email: 'asha@example.com', nickname: 'Asha', consent: true, research: false };
  assert.ok(checkContract(SCHEMAS.email_complete, body).ok);
  for (const bad of ['asha', 'a b@example.com', '@']) assert.ok(!checkContract(SCHEMAS.email_complete, { ...body, email: bad }).ok, bad);
});

test('the flow clears the address when it ends, and keeps it out of storage', () => {
  assert.match(flow, /function done\(\) \{[^}]*f\.email = ''/);
  assert.doesNotMatch(flow, /(local|session)Storage[^\n]*email/i);
});
