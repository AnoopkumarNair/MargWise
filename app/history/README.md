# Night of Lamps prototype tooling

- `night-of-lamps.src.html`: the page with an empty `window.LAMP_ART`.
- `gen.py`: generates art with Cloudflare Workers AI (flux-1-schnell). Needs `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`. Skips images already in `art/`, so re-running only fills the gaps.
- `vis.py`: a plain visual description for each of the 60 options. Use these, not the option text, in prompts, because the model prints the sentence into the picture otherwise.
- `build.py`: shrinks `art/` into WebP and embeds it into the page as `lamps_built.html`.

The free tier allows 10,000 neurons a day (about 75 images). Done: 16 of 17 backdrops. Still to generate: `bg-s15` and the 60 `obj-*` images.
