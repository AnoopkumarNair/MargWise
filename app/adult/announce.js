// What a screen reader hears while tier 2 works: the start, each 10 percent of a phase, and the end. Not every change.
//   a = makeAnnouncer(say); a.update(phase, fraction, text); a.finish(text)   // finish always speaks
export const STEP = 0.1;

export function makeAnnouncer(say) {
  let phase = null, step = -1;
  return {
    update(name, fraction, text) {
      const f = Number.isFinite(fraction) ? Math.max(0, Math.min(1, fraction)) : 0;
      const st = Math.floor(f / STEP + 1e-9);
      if (name !== phase) { phase = name; step = st; say(text); return true; }
      if (st > step) { step = st; say(text); return true; }
      return false;
    },
    finish(text) { phase = null; step = -1; say(text); },
  };
}
