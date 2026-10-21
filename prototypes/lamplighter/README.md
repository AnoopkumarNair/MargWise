# Lamplighter's Road prototype (throwaway)

One-screen playable prototype of the journey instrument, used to judge feel with Anu. Not shipped
code and not part of the build. Published as a private artifact.

Build: copy `entry.ts.txt` to `entry.ts` and `vite.config.mjs.txt` to a config inside `apps/web`
(it needs that folder's `vite`), adjust the absolute paths at the top of both files, run
`vite build -c <config>`, then replace the `/*ENGINE*/` marker in `lamplighter.template.html` with
the built `engine.js` and open the result. `smoke.mjs.txt` is the Playwright walk-through used
to check for page errors and scrolling.

The art is placeholder vector drawing. The real art pipeline is in `docs/art/`. Sound is
synthesised in the page (no audio files).
