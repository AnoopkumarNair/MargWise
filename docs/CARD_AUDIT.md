# Card audit (social desirability and trade-offs)

Raw data: `docs/audit/card_ratings_blind.json` (blind ratings of the original cards) and `docs/audit/card_rewrites.json` (old and new text for the 48 rewritten cards). The rewrites were applied to `data/story2.json` on 2026-10-22 and are being re-rated blind (see the end of this file).


**Method.** I rated all 60 cards blind (without the trait key) on social desirability from 1 to 5: how good a teenager would look for choosing the card, whatever they would actually enjoy. I then unblinded and grouped the ratings by Holland type. Note: the key has **10 cards per type** (6 types x 10 = 60), not 15 as the brief assumed. Each type is missing from 5 scenes.

## Mean desirability by type (one rater, n = 10 cards each)

| Type | Mean | Min | Max |
|---|---|---|---|
| S Social | **4.5** | 4 | 5 |
| I Investigative | 4.0 | 3 | 5 |
| R Realistic | 3.7 | 2 | 5 |
| E Enterprising | 3.4 | 3 | 4 |
| A Artistic | 3.0 | 2 | 4 |
| C Conventional | **2.4** | 2 | 4 |

**Bias:** the cards favour S and work against C. S cards never scored below 4. C cards scored 2 in 7 of 10 scenes. S cards are written as rescue or comfort ("worried children", "shy weaver", "lost trader ... family"). C cards are written as chores ("every", "perfect order", "permits"). The result will likely overstate S (and I) and understate C, especially for students who answer to look good. A cards are also low. They often don't help with the scene's problem (decorating a broken clock, sitting and drawing while others climb).

## Scenes flagged

**12 of 15** (dominant, or a rating range of 2 or more): s01, s02, s03, s05, s06, s07, s08, s09, s10, s13, s14, s15. The 7 rated dominant are s01, s05, s06, s08, s09, s10 and s14. Scenes s04, s11 and s12 are balanced.

Other issues:
- **Repeated wording gives the type away across scenes.** "Welcome the ..." marks S cards, "persuade" marks E, "unlike any" marks A, and "every ... in order" marks C.
- **Setup and card mismatches.** In s10, the lost trader and the barrels are not in the setup. In s06, the setup points at the machine, which favours the I card. In s13, no card gets the press working.
- **s07-4** mixes R (build a raft) with I (test which wood floats).

## Rewrites

All 48 cards in the flagged scenes are rewritten in `/tmp/qa/phase2_rewrites.json`. If only the problem cards had a trade-off, those cards would look *worse*, so every card in a flagged scene gets one. All rewrites:
- are 90 characters or fewer (the longest is 87)
- keep each card's Holland type and setting
- start with a different verb from the other cards in the scene
- drop the repeated wording listed above

The s06 setup should also be made neutral. That is outside the card text, so it isn't rewritten. Scenes s04, s11 and s12 have no trade-offs. They should get the same treatment, so that some scenes don't come with costs and others without.

## Limits of this exercise

- **I am one rater, and not a teenager or a student in India.** These ratings are a first screen, not evidence. A real panel would show how much raters agree, and here that is unknown.
- **The rewrites are untested.** The trade-offs could create new imbalances: some costs ("missing a night's sleep") may sound worse than others ("knowing some will walk away").
- **What a real validation with students would need:**
  1. Desirability ratings from about 30 or more Class 9-12 students across regions, school boards, languages, genders and income groups. Check agreement between raters, and look for cards where ratings swing by group.
  2. A short think-aloud pilot (about 10 to 15 students) to catch reading problems and type cues.
  3. A field pilot (a few hundred students) that compares pick rates per type with how often you'd expect each type to be picked. Check that each type's score is consistent across scenes, and check scores against an established interest measure (for example a validated RIASEC inventory) given to the same students.
  4. Checks that each card works the same way for different groups (gender, region, language) before using the results for career advice.
  5. A balanced design. Every type appears in only 10 of 15 scenes, and which types appear together changes from scene to scene, so the scoring should account for that.
