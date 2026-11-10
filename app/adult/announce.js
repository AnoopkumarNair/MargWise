// What a screen reader hears while tier 2 works. The progress bar and the visible numbers can change many times a second; a live region that
// repeats each change is unusable. This keeps the spoken text to its start, one update each time a phase passes another 10 percent, and the end.
//   const a = makeAnnouncer(text => { liveRegion.textContent = text; });
//   a.update('download', 0.37, 'Downloading… 14 MB of 39 MB');    // says something only when the phase is new, or has passed another 10 percent step
//   a.finish('We found 3 skills you may also have.');             // always says it
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
