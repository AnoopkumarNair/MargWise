# Story and arc

The story frames the choices. It never rewards or punishes a card: every keeper line and every clue is the same whatever the student chose, and nothing in it is scored.

## Premise
The lighthouse at the end of the old road lights once a year so that anyone far from home can find the way back. This year the lamplighter vanished three days ago, leaving a torn note. Her student **Ila** cannot find out why. **Jyo**, a firefly who remembers every lamp, finds the student and asks them to carry the lantern.

## Question that runs through the road
*Who was the lamplighter, and why did she leave?* Every keeper remembers her doing a different kind of work (a mechanic, a surveyor, a weaver, a gardener, a printer, a healer). The pattern is the answer: she never settled on one kind of work.

## Beats
| Where | Beat |
| --- | --- |
| Intro, four panels | The valley lights a lamp for every road a person might take; the lighthouse is dark and the lamplighter gone; Jyo asks you to carry the lantern; two flasks of oil and no right answers |
| Chapter I (start) | "The first lamps are the hardest. Somewhere on the road, a girl is looking for the lamplighter too." |
| After lamp 3 | **Ila's goal.** She introduces herself: the lamplighter was her teacher; will you help find out why she left? |
| Chapter II (after lamp 4) | A pattern is forming: every keeper remembers the lamplighter a little differently |
| After lamp 6 | **Ila's clue.** Everyone remembers her differently. What was she looking for? |
| Every stop | The keeper's line, then a short memory of the lamplighter (the `clue` in `data/story2.json`), a different kind of work at each stop and not tied to the card chosen |
| Chapter III (after lamp 8) | The sea is close and the lighthouse lamp is still dark |
| After lamp 9 | **Ila's obstacle.** The lighthouse is dark and her flask is nearly empty; it needs every lamp |
| Before the last stop | **Ila hands over her lantern.** (The walk length adapts to the student's answers, so this beat waits for the end of the walk, not a fixed lamp number.) The road was never the lamplighter's; she will keep the harbour lamp burning |
| Note fragments | Revealed as lamps are lit: "A lamp burns best for hands that like the work. Light the road for the ones who walk behind you. The road was never mine. Choose yours." |
| Finale | The lighthouse lights and the last line is readable: she tried many kinds of work so that you could find yours. This is the light you carry. The result screen follows as the doors that opened |

## Meaning for the student
Many kinds of work matter and people can try several. The result points to areas worth exploring, not a verdict, and interests grow with experience.

## Rules for writing story text
- No keeper line, clue or Ila line may favour a type of work. Each stop's clue names a different activity, in plain words, with equal warmth.
- The same text appears whichever cards the student chose.
- Where a student's order of stops differs, no line may depend on having visited another stop first (the road order adapts to the answers).
- All text lives in `data/story2.json` (`meta` for premise, mission, chapters, Ila, note, outro, intro; each stop's `keeper`, `line`, `clue`), so it can be edited without code. Re-run the pipeline, accept a release and rebuild after a change.
