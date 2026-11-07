# Optional video in the student game

Video is an extra. The game works fully without it. The still pictures and the image animation stay as the fallback everywhere.

## What plays where

| File in `app/video/` | Where it plays |
|---|---|
| `opening_1.mp4` to `opening_4.mp4` | One per opening shot, behind the captions. Tap and Skip work and stop the clip. |
| `town_s01.mp4` to `town_s15.mp4` | About 5 seconds when the student arrives in that town. The last frame holds; the still is under it. |
| `ending.mp4` | The lighthouse lighting, at the finale. |
| `cover_loop.mp4` | Muted loop behind the cover title and Begin. Starts only after the cover picture has painted. |
| `trailer.mp4` | The full trailer. A "Watch the trailer" button appears on the cover only if this file exists. It plays with sound on tap, in a simple player with a Close button. |

Each file may also have a `.webm` sibling with the same name. The page uses the webm where the browser plays it, otherwise the mp4. Other file names are skipped by the build with a message.

Captions stay as page text. The clips are silent, apart from the trailer. Make them 2:3 (portrait) like the stills, 720p at most.

## How video is chosen

One small function decides: `mwVideoPolicy` in `app/video_policy.js` (tests in `app/tests/video.test.mjs`). Video is used only if all of these hold:

- the file exists in the manifest;
- the student has not turned video off (the "Video: on/off" button, kept in `localStorage`);
- the device does not ask for reduced motion or data saving;
- the connection is not `slow-2g`, `2g` or `3g` (where the browser reports it);
- the device memory is not under 2 GB (where the browser reports it);
- no clip has failed in this session.

Where the browser does not report the connection (iOS), video is allowed but watched: if a clip does not start within 1.5 seconds, or stalls for 1.5 seconds, the page switches to the stills for the rest of the session. Where the connection is reported, it takes two such failures.

With no files in `app/video/`, the page has an empty manifest, makes no video request and shows no video buttons.

## How clips are fetched

- During sign-up and consent, the page fetches `opening_1` and the first town (the engine's first scene).
- Each time a lamp is lit, the next scene is known, and that town's clip is fetched. Near the draft (and when the walk ends) `ending.mp4` is fetched instead.
- While the opening plays, the next opening clip is fetched.
- One clip is fetched at a time, with low priority, and kept in memory (at most three) so it starts at once. Only one clip of each kind waits in line. Without `fetch`, a `<link rel="preload" as="video">` is used.
- No prefetch happens when the policy says no.
- The cover loop and the trailer are not prefetched.

URLs carry `?v=<hash>`, written by the build, so `/video/*` can be cached for a year (`hosting/public/_headers`). Replacing a file changes the hash.

## Data note

The page shows one line from the manifest sizes, for example "Video uses about 0.8 MB a town and 3.1 MB for the opening." Keep clips small. Aim for under 1 MB a town, and say so to whoever makes them.

## Adding files

1. Put the files in `app/video/` with the exact names above.
2. Run `python3 app/build.py`. It copies them to `app/dist/video` and `hosting/public/video` and writes the manifest into the page (`window.MW_VIDEO`).
3. Check the cover, the opening, one town and the ending on a phone with the connection throttled. Then ask the owner to deploy.

## Before every deploy: walk to the result

CI cannot run this (it has no browser). Run it by hand on the built page before you deploy, and after any change to the opening, the lighthouse or the result screen. It plays the real game on a phone-sized Chromium to the result and fails on any page error, an invisible lighthouse, or a result that is not shown.

```bash
python3 app/build.py && git checkout hosting/public/manifest.json   # build, then undo the tracked side effect
PORT=8801 bash app/tests/playtest/start_server.sh
NODE_PATH=<folder with playwright> URL_=http://localhost:8801/ node app/tests/result_walk.mjs
bash app/tests/playtest/stop_server.sh
```

Paths: see my result, Sharpen it, Sharpen then stop, skip the quick questions, reduced motion, reload and resume, and "Sharpen my result" from the result page. `PATHS=rsharpen` runs a subset. `OUT=dir` saves screenshots. It exits 1 on any failure. This guards the 2026-11-07 bug: a second lighthouse played at opacity 0 and left a blurred empty screen.
