// Feature switches (BACKEND ADR-18). Every one has a safe default, so a missing or garbled setting never turns something on by accident.
//   ADULT_SIGNUP   default off   new adult sign-ups
//   AI_ENABLED     default off   the AI read path
//   EMAIL_DRY_RUN  default on, except when ENVIRONMENT=production   emails are not really sent
//   SHOW_DEMAND    default off   demand figures, until job postings exist
// Accepted "on" words: 1, true, on, yes. "Off" words: 0, false, off, no. Anything else counts as unset.
const ON = new Set(['1', 'true', 'on', 'yes']), OFF = new Set(['0', 'false', 'off', 'no']);
export function parseSwitch(v) {
  if (v === true || v === 1) return true; if (v === false || v === 0) return false;
  const s = String(v == null ? '' : v).trim().toLowerCase();
  return ON.has(s) ? true : OFF.has(s) ? false : null;
}
export const isProduction = env => String((env && env.ENVIRONMENT) || '').trim().toLowerCase() === 'production';
export function readFlags(env = {}) {
  const f = (k, dflt) => { const v = parseSwitch(env[k]); return v === null ? dflt : v; };
  return {
    adultSignup: f('ADULT_SIGNUP', false),
    aiEnabled: f('AI_ENABLED', false),
    emailDryRun: f('EMAIL_DRY_RUN', !isProduction(env)),
    showDemand: f('SHOW_DEMAND', false),
  };
}
