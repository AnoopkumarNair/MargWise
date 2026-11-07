# Story and arc

The story frames the choices. It never rewards or punishes a card: every keeper line and every clue is the same whatever the student chose, and nothing in it is scored.

## Premise
The lighthouse at the end of the road is dark and the lamplighter who tends it is missing. **Jyo**, a firefly, asks the student to light a lamp in each town and find out why. **Ila**, the lamplighter's student, is looking for her teacher too. The cover says this in two short sentences.

## Question that runs through the road
*Who was the lamplighter, and why did she leave?* Every keeper remembers her doing a different job. The pattern is the answer: she tried every kind of work so that the student could find theirs.

## Structure
There are no chapters. The top bar reads "Town N of 8" while the student walks the draft, with a row of 8 lamps. While sharpening it reads "Sharpening: N more at most", and the number only goes down. Towns are picked from the student's answers, so the order differs for each student. No line may name a town.

## Voices
- **Jyo** gives short guide lines only: oil hints, the clue at town 7, and the sharpen card.
- **Ila** appears twice. Each card is her own speech.
- **The lamplighter** speaks once, in the letter.
- **Keepers** are the people in each town. Each says one line about the town.
- A card label always matches who speaks. Scene description uses the label "At the lighthouse".

## Beats
| Where | Beat |
| --- | --- |
| Cover | Goal, Jyo and the missing lamplighter, in 2 sentences |
| After town 1 | **Ila** says who she is and that she is looking for her teacher |
| Towns 2, 4, 5 | A keeper remembers the lamplighter doing their work for a night or a day, then moving on |
| After town 6 | **Ila** asks why a person would try so many kinds of work |
| Town 7 | **Jyo** says where the lamplighter went: the lighthouse |
| After town 8 (the only ending) | "At the lighthouse": the door is open, the lamp is dark. Then **the lamplighter's letter**: she put the light out so the student could light it, and tried every kind of work so the student could find theirs |
| Draft screen | The student sees a first result and chooses to see it or to sharpen it |
| Sharpen | One **Jyo** card, then more towns with no extra story. There is no second ending |
| Finale | The lighthouse is lit and the result appears. It does not retell the ending |

Words: a **town** is a place, a **lamp** is what the student lights there, and the **road** is the result so far.

## Meaning for the student
Many kinds of work matter and people can try several. The result points to areas worth exploring, not a verdict, and interests grow with experience.

## Rules for writing story text
- No keeper line, clue or Ila line may favour a type of work. Clues say "my work" and name no job.
- The same text appears whichever cards the student chose.
- No line may depend on another town having been visited first, or name a town by position.
- Keeper names are distinct Indian names that do not match the tester or persona names.
- Keep it short. Readers read at 80 to 200 words a minute.
- All text lives in `data/story2.json` (`meta` for premise, Ila, clues, draft screens, sharpen card, outro; each town's `keeper`, `line`), so it can be edited without code. Re-run the pipeline, accept a release and rebuild after a change.
