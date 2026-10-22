# Drop the generated images here

Upload the 12 images from `docs/ART_PROMPTS.md` into this folder (on GitHub: **Add file > Upload files**, drag all 12 in, commit). Name each file exactly as below. PNG, JPG or WebP all work.

| File name | What it is |
| --- | --- |
| `hero-cover` | Cover picture (image 1) |
| `intro1` | Story panel 1, the valley of lamps |
| `intro2` | Story panel 2, the dark lighthouse |
| `intro3` | Story panel 3, Jyo asks you to carry the lantern |
| `intro4` | Story panel 4, the two flasks |
| `logo-colour` | Logo mark, full colour, transparent |
| `logo-light` | Logo mark, cream, transparent |
| `app-icon` | App icon, square |
| `jyo-hover` | Jyo hovering, transparent |
| `jyo-fly` | Jyo flying, transparent |
| `jyo-sleepy` | Jyo sleepy, transparent |
| `share-card` | Link-preview card, wide |

Then tell me, and I run `python3 app/tools/ingest_art.py` (it resizes, compresses and places each file) and rebuild. Files here are inputs only; the game reads from `app/art/`.
