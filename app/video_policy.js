/* Margwise video policy. One small function, inlined into the page by app/build.py and loaded by node for its test.
   mwVideoPolicy(env) says whether the page may use video. env fields (all optional except exists):
     exists        the clip file is in the manifest
     off           the student turned video off
     failed        a clip already failed to start or stalled in this session (set by the page)
     reduceMotion  prefers-reduced-motion
     saveData      navigator.connection.saveData
     effectiveType navigator.connection.effectiveType, or undefined where the API is missing (iOS)
     deviceMemory  navigator.deviceMemory in GB, or undefined
   Returns { use, why, probe }. probe is true when the network type is unknown: the page then
   watches the first clip and drops to the stills if it does not start in time. */
function mwVideoPolicy(e) {
  e = e || {};
  if (!e.exists) return { use: false, why: 'no file', probe: false };
  if (e.off) return { use: false, why: 'turned off', probe: false };
  if (e.failed) return { use: false, why: 'failed this session', probe: false };
  if (e.reduceMotion) return { use: false, why: 'reduced motion', probe: false };
  if (e.saveData) return { use: false, why: 'data saver', probe: false };
  if (/^(slow-2g|2g|3g)$/.test(e.effectiveType || '')) return { use: false, why: 'slow connection', probe: false };
  if (typeof e.deviceMemory === 'number' && e.deviceMemory < 2) return { use: false, why: 'low memory', probe: false };
  return { use: true, why: 'ok', probe: !e.effectiveType };
}
/* Reads the browser (win = window) into an env for mwVideoPolicy. extra overrides: { exists, off, failed }. */
function mwVideoEnv(win, extra) {
  var n = (win && win.navigator) || {}, c = n.connection || n.mozConnection || n.webkitConnection || {}, rm = false;
  try { rm = !!(win.matchMedia && win.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (x) { /* no matchMedia */ }
  var env = { reduceMotion: rm, saveData: !!c.saveData, effectiveType: c.effectiveType, deviceMemory: n.deviceMemory };
  for (var k in extra) env[k] = extra[k];
  return env;
}
if (typeof module !== 'undefined' && module.exports) module.exports = { mwVideoPolicy: mwVideoPolicy, mwVideoEnv: mwVideoEnv };
