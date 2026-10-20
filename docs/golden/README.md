# Golden cases (03 §3.13)

`golden-cases.xlsx` holds the money-engine golden cases. **Every expected value
is a spreadsheet formula over visible inputs** (blue = input, black = formula,
yellow = asserted value), so the workbook is an implementation independent of
`packages/engine`. Status: **draft, awaiting Anu's approval**, then a CA's review.

| Sheet                 | Cases                                                                                                                                                                        |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tax                   | 12: new-regime edges ₹4L, ₹8L, ₹12L, ₹12,00,001, ₹24L, ₹30L (taxable) + marginal-relief case; old-regime ₹2.5L, ₹5L, ₹5,00,001, ₹10L, ₹20L                                   |
| EMI                   | 4 annuity cases incl. zero rate                                                                                                                                              |
| Moratorium            | 4: capitalisation, PM-Vidyalaxmi 3% subvention, full subvention, longer moratorium                                                                                           |
| Sec129                | 5: old regime 30% and 20%, new → ₹0, not sure → ₹0, year 9 → ₹0                                                                                                              |
| FX                    | 3 depreciation-path conversions                                                                                                                                              |
| ROC                   | rank-order-centroid weights for 6 ranks                                                                                                                                      |
| NPV-* (+ loan sheets) | 7 deterministic plans at "likely": core India, repeat year, fallback, abroad with return to India, custom path, loan + Section 129 (old regime), loan with interest serviced |

Pipeline (never edit the JSON by hand):

```sh
pnpm golden:build                      # writes the workbook (formulas only)
python3 <xlsx-skill>/scripts/recalc.py docs/golden/golden-cases.xlsx 120   # LibreOffice recalculation
pnpm golden:export                     # → packages/engine/src/golden/golden-cases.json (records the workbook SHA-256)
pnpm golden:check                      # CI: JSON must match the committed workbook
```

The engine asserts each case within ±₹1 or ±0.01% (`packages/engine/src/golden/golden.test.ts`).
A mutation check (off-by-one discounting) fails all 7 NPV cases.

`assessment-hand-cases.md` holds the independent Python check for Pearson fit.
