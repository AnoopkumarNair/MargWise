# Vendored files

Browser libraries and fonts are copied here. There are no CDNs (strict CSP). When you change a file, update its row. CI fails if a file is unlisted, missing, or its SHA-256 differs.

Check by hand: `node .github/scripts/check_vendor_hashes.mjs`

| Path | Version | SHA-256 | Source |
| --- | --- | --- | --- |
| `fonts.css` | n/a (Fraunces and Nunito, stylesheet) | `114ee2377cd91599bedfbda40408da92961bbe96bb97a718666e5b47abfeb305` | Google Fonts, self-hosted |
| `fonts/6NU78FyLNQOQZAnv9bYEvDiIdE9Ea92uemAk_WBq8U_9v0c2Wa0KxC9TeA.woff2` | n/a (font file) | `7234ed860a9cc83045413c4faee63c960a8f2d1917adcf728119307d56e0d783` | Google Fonts, self-hosted |
| `fonts/XRXV3I6Li01BKofINeaB.woff2` | n/a (font file) | `ba344451eab25b217a165363b1982048a5e5830a0daf36577973955a04cac793` | Google Fonts, self-hosted |
| `gsap.min.js` | 3.12.5 (from file header) | `28033e449a31ebcc396e5be8b13b63152bf03094288fb5867034321927bce087` | gsap.com |
