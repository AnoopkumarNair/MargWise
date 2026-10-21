# How facts get checked (owner-run, no outsiders needed)

Principle: every fact in Margwise is public. The product is the engine, the game and the pilot data. Checkers never see those.

1. `prototype/content/claims.py` turns content.json into small tasks: one public statement plus the official page to check it against. Task ids are random; the file that maps them back to fields (`claims/_private_map.json`) stays with the owner.
2. Tasks are shuffled and split into batches of 12, so nobody sees a whole field or the product.
3. The owner checks a batch in 20 to 30 minutes by opening the official page and filling the verdict columns. Skills needed: reading official notices and comparing dates, subjects and eligibility with the statement. No counselling expertise is needed for fact checking.
4. For high-stakes claims (medicine, law, defence, civil services), send the same task to a second person who has not seen the first answer. Disagreement means the owner reads the page again.
5. Judgement items (is this advice sensible for a Class 9 student?) are the only place a counsellor adds value. Show them the output screens, never the code or scoring, and treat their view as advice.
6. Re-run `claims.py` after every content change, and on the refresh cycle: exam notices before each admission season, visa rules quarterly, O*NET and pay yearly, exchange rates monthly.

Content build order: `content.py`, then `plfs.py`.
