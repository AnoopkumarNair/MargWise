import test from 'node:test';
import assert from 'node:assert/strict';
import { readFlags, parseSwitch } from '../../core/flags.js';

test('with nothing set: adult signup, AI and demand are off; email is a dry run', () => {
  assert.deepEqual(readFlags({}), { adultSignup: false, aiEnabled: false, emailDryRun: true, showDemand: false });
  assert.deepEqual(readFlags(), readFlags({}));
});
test('EMAIL_DRY_RUN is on by default everywhere except production', () => {
  for (const e of ['local', 'preview', 'staging', '', undefined]) assert.equal(readFlags({ ENVIRONMENT: e }).emailDryRun, true, String(e));
  assert.equal(readFlags({ ENVIRONMENT: 'production' }).emailDryRun, false);
  assert.equal(readFlags({ ENVIRONMENT: ' Production ' }).emailDryRun, false);
});
test('each switch can be turned on', () => {
  for (const on of ['1', 'true', 'ON', 'Yes', true, 1]) {
    assert.equal(readFlags({ ADULT_SIGNUP: on }).adultSignup, true, String(on));
    assert.equal(readFlags({ AI_ENABLED: on }).aiEnabled, true);
    assert.equal(readFlags({ SHOW_DEMAND: on }).showDemand, true);
    assert.equal(readFlags({ EMAIL_DRY_RUN: on }).emailDryRun, true);
  }
});
test('EMAIL_DRY_RUN can be turned off, and can be turned on in production', () => {
  assert.equal(readFlags({ EMAIL_DRY_RUN: '0' }).emailDryRun, false);
  assert.equal(readFlags({ ENVIRONMENT: 'production', EMAIL_DRY_RUN: '1' }).emailDryRun, true);
});
test('each switch can be turned off explicitly', () => {
  for (const off of ['0', 'false', 'off', 'No', false, 0]) {
    assert.equal(readFlags({ ADULT_SIGNUP: off }).adultSignup, false);
    assert.equal(readFlags({ AI_ENABLED: off }).aiEnabled, false);
    assert.equal(readFlags({ SHOW_DEMAND: off }).showDemand, false);
  }
});
test('garbled values fall back to the safe default', () => {
  for (const junk of ['maybe', '2', 'enable', ' ', null, {}]) {
    assert.deepEqual(readFlags({ ADULT_SIGNUP: junk, AI_ENABLED: junk, SHOW_DEMAND: junk, EMAIL_DRY_RUN: junk }), { adultSignup: false, aiEnabled: false, emailDryRun: true, showDemand: false });
    assert.equal(readFlags({ ENVIRONMENT: 'production', EMAIL_DRY_RUN: junk }).emailDryRun, false, 'production default still applies');
  }
  assert.equal(parseSwitch('maybe'), null);
});
test('switches do not affect each other', () => {
  const f = readFlags({ AI_ENABLED: '1' }); assert.equal(f.aiEnabled, true); assert.equal(f.adultSignup, false); assert.equal(f.showDemand, false);
});
