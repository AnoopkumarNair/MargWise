# Story and arc

The story frames the choices. It never rewards or punishes a card: every keeper line and every clue is the same whatever the student chose, and nothing in it is scored.

## Premise
The lighthouse at the end of the road is dark and the lamplighter who tends it is missing. **Jyo**, a firefly, asks the student to light a lamp in each town and find out why. Jyo was the lamplighter's companion and misses her. The cover says it in one short line. The opening (below) carries the rest.

## Question that runs through the road
*Who was the lamplighter, and why did she leave?* Every keeper remembers her doing a different job. The pattern is the answer: she tried every kind of work so that the student could find theirs.

## Structure
There are no chapters. The top bar reads "Town N of 8" while the student walks the draft, with a row of 8 lamps. While sharpening it reads "Sharpening: N more at most", and the number only goes down. Towns are picked from the student's answers, so the order differs for each student. No line may name a town.

## Voices
- **Jyo** gives short guide lines only: oil hints, the clue at town 7, and the sharpen card.
- **The lamplighter** speaks once, in the letter.
- **Keepers** are the people in each town. Each says one line about the town.
- A card label always matches who speaks. Scene description uses the label "At the lighthouse".

## Beats
| Where | Beat |
| --- | --- |
| Cover | One line: the lighthouse is dark, find out why |
| Opening (once per device, skippable, about 25 s) | Four shots, one caption line at a time: the pressure (Aunty, Cousin, Sir, everyone has your road ready), the mystery (the lighthouse went dark, her door open, her oil untouched), Jyo's ask and the oil rule (a lamp in each town, two flasks each, spend them on what you'd really do), and the promise (an interest guide, not a test, no marks, about 10 to 14 minutes, kinds of work and a school path) |
| Towns 2, 4, 5 | A keeper remembers the lamplighter doing their work for a night or a day, then moving on |
| Town 7 | **Jyo** says where the lamplighter went: the lighthouse. Jyo misses her and promised to wait for the student |
| After town 8 (the only ending) | "At the lighthouse": the door is open, the lamp is dark. Then **the lamplighter's letter**: she put the light out so the student could light it, and tried every kind of work so the student could find theirs. "People will tell you what to be. The road was never mine. Choose yours." |
| Draft screen | The student sees a first result and chooses to see it or to sharpen it |
| Result page | If towns remain, "Sharpen my result" goes on with the same walk from the next town, then shows the result again |
| Sharpen | One **Jyo** card, then more towns with no extra story. There is no second ending |
| Finale | The lighthouse is lit and the result appears. It does not retell the ending |

Words: a **town** is a place, a **lamp** is what the student lights there, and the **road** is the result so far.

## Meaning for the student
Many kinds of work matter and people can try several. The result points to areas worth exploring, not a verdict, and interests grow with experience.

## Rules for writing story text
- No keeper line, clue or Jyo line may favour a type of work. Clues say "my work" and name no job.
- The same text appears whichever cards the student chose.
- No line may depend on another town having been visited first, or name a town by position.
- Keeper names are distinct Indian names that do not match the tester or persona names.
- Keep it short. Readers read at 80 to 200 words a minute.
- All text lives in `data/story2.json` (`meta` for premise, clues, draft screens, sharpen card, outro; each town's `keeper`, `line`), so it can be edited without code. Re-run the pipeline, accept a release and rebuild after a change.

## The opening
Text, picture and motion for each shot are in `meta.opening` (`art`, `lines`, `motion`, optional `audio` cues). Captions come one at a time, at most 10 words on screen, with no exclamation marks. The time must match TIME_TXT in the page. Reduced motion shows still pictures and all lines of a shot at once. Voice is optional and off by default: see `docs/OPENING_VOICE_SCRIPT.md`. The only tracking is `opening_seen` (skipped yes or no, last shot reached).
