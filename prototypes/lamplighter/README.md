# The Night of Lamps prototype (throwaway)

One-screen playable prototype of the journey instrument, used to judge feel with Anu. Not shipped code and
not part of the build. Published as a private artifact.

- Build: `node prototypes/lamplighter/build.mjs [outDir]` bundles the real engine into
  `lamplighter.html` (default `prototypes/lamplighter/dist`, git-ignored).
- Check: `node prototypes/lamplighter/smoke.mjs <html> <screenshotDir>` walks the whole game at three phone
  sizes and fails on page errors, scrolling, clipped text or overlapping options.
- Art: scenes and objects are painted placeholders until generated art is exported. Put real images in
  `prototypes/lamplighter/art.json` as `{ "bg": {"s01": "<data-uri or url>"}, "obj": {"s01-R": "..."},
  "char": {"jyo": "..."} }` and rebuild; no code change needed.
- Sound is synthesised in the page (no audio files, no noise source). `window.__snd.render(seconds, lamps,
  sampleRate)` renders the music offline for measurement.
