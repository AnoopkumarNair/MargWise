# Vendored files

Browser libraries and fonts are copied here. There are no CDNs (strict CSP). When you change a file, update its row. CI fails if a file is unlisted, missing, or its SHA-256 differs.

The game's files (`fonts.css`, `fonts/`, `gsap.min.js`) live in `app/vendor/`; `python3 app/build.py` copies them here and never deletes this file or other vendored files. Change them in `app/vendor/`, rebuild, then update the row. The check also fails if a file in `app/vendor/` differs from its row.

The resume reader's libraries (`pdfjs/`, `mammoth/`) are used only by the adult app (`/work/`) and are loaded only after a person picks a file. They live only here, not in `app/vendor/`; the student build does not touch them. Each was taken unchanged from its npm package (registry.npmjs.org), at a version more than two weeks old on 29 Oct 2026. To update one, download the new package, copy the same files, and change the row.

Check by hand: `node .github/scripts/check_vendor_hashes.mjs`

| Path | Version | SHA-256 | Source |
| --- | --- | --- | --- |
| `fonts.css` | n/a (Fraunces and Nunito, stylesheet) | `114ee2377cd91599bedfbda40408da92961bbe96bb97a718666e5b47abfeb305` | Google Fonts, self-hosted |
| `fonts/6NU78FyLNQOQZAnv9bYEvDiIdE9Ea92uemAk_WBq8U_9v0c2Wa0KxC9TeA.woff2` | n/a (font file) | `7234ed860a9cc83045413c4faee63c960a8f2d1917adcf728119307d56e0d783` | Google Fonts, self-hosted |
| `fonts/XRXV3I6Li01BKofINeaB.woff2` | n/a (font file) | `ba344451eab25b217a165363b1982048a5e5830a0daf36577973955a04cac793` | Google Fonts, self-hosted |
| `gsap.min.js` | 3.12.5 (from file header) | `28033e449a31ebcc396e5be8b13b63152bf03094288fb5867034321927bce087` | gsap.com |
| `pdfjs/pdf.min.mjs` | pdfjs-dist 6.4.299 (legacy browser build; released 2026-10-03) | `bccc24ea711db8e44503629519904a5292d73b9daaa214bbe7cdcc282b0f4259` | npm `pdfjs-dist@6.4.299`, file `legacy/build/pdf.min.mjs` (Apache-2.0; package integrity sha512-AVl138zALtfaAPvADulE0PZThbYzCBS79nL4pOSL/6Sm/4AH5A21BD9VHt97OlCuzJuCpmeZtAtkinisF4Vb1g==) |
| `pdfjs/pdf.worker.min.mjs` | pdfjs-dist 6.4.299 (legacy browser build) | `145d2dd3ab0c86151011dba95acfa2d5336e2accd59388ea43dbee0efddaaec6` | npm `pdfjs-dist@6.4.299`, file `legacy/build/pdf.worker.min.mjs`, served from this site as the PDF worker (Apache-2.0) |
| `pdfjs/LICENSE` | pdfjs-dist 6.4.299 | `0d542e0c8804e39aa7f37eb00da5a762149dc682d7829451287e11b938e94594` | npm `pdfjs-dist@6.4.299`, file `LICENSE` (Apache License 2.0) |
| `mammoth/mammoth.browser.min.js` | mammoth 1.13.0 (browser build; released 2026-09-26) | `92914a3708cfdf1e62cb553d1856a7fedab21da83d8ee82845de2f897b368cab` | npm `mammoth@1.13.0`, file `mammoth.browser.min.js` (BSD-2-Clause; package integrity sha512-2cawcYFcP7ISfXbBcL9lmVgTNWo88v/52ND1gnywHtVT/pX0//puPnf0iMPV9ZgmuvNOE+zkIhDgZ9M2c2dDDg==) |
| `mammoth/LICENSE` | mammoth 1.13.0 | `6663bbd049205d38a496ccacb412a151980b444627d38de218b3b809aef330f1` | npm `mammoth@1.13.0`, file `LICENSE` (BSD 2-Clause) |
