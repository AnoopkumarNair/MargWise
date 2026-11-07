# Playtest report: Rohan (round 2, tablet, port 9301)

## 1. Persona
Rohan, 15, Class 10, Hindi-medium state board student in Indore. Likely dyslexia, reads English at 80-100 wpm and stops on uncommon words. Loves repairing phones and motors, quick with money maths. Feels stupid with too much text and quietly gives up rather than ask.

## 2. FINISHED: yes
- Reached the result screen ("Your interest shape", then "Where this can lead") from the first draft. He chose "See my result" and did not sharpen.
- Towns done in the draft: 8 (Orchard Village, Healing House, Glass Cliffs, Herbalists' Garden, Observatory Hill, Lantern Bridge, Festival Square, Night Bazaar).
- Est. minutes: about 20 in total. Sign-up and consent about 3, eight towns about 11, draft and questionnaire about 3, result about 3. The parent step took an evening, not minutes.
- Reason in his words: the draft already said "Builder" and the result matched him. "Sharpen it" meant 7 more towns of reading, so he stopped.
- Consent: he answered "Not yet. I will ask first." He tried "Copy the link", which failed. He went back, and the father agreed that evening. He came back and pressed "Yes". This was the path the brief set, and it was the only point where the screen lost him for a moment.

## 3. Diary

| Screen (shot) | Int. | Reaction in his voice |
|---|---|---|
| Cover, 000 | 5 | "Begin. Okay, a game." |
| Sign-up form, 001-003 | 5 | "Name, then code. Master, the code is given." |
| Consent, 004 | 4 | "I am not 18. Papa has to say. Not yet." |
| "Ask a parent, come back with this link", 005 | 4 | "Good, but where is the link?" |
| "Could not copy. The link is: http://localhost:8788/", 006 | 3 | "Papa cannot open localhost. Hmm." Nearly quit here. |
| Back to form, then Start again, 007-008 | 5 | "Okay, papa said yes. Pressing Yes." |
| Login code MED4-T9WP, 009 | 5 | "Write it down. Done." |
| Home, "Take the lantern", 010 | 5 | "Start." |
| Orchard Village draft, 011-013 | 6 | "Fix the juice press. Yes, that one." |
| Healing House, 014-016 | 5 | "Test the water... most show nothing. Ok, I pick it." |
| Glass Cliffs, 017-019 | 7 | "Rope down to test the rock. 'You like to fix things. Noted.' Yes, it noticed." |
| Ila's line, 020 | 6 | "Who is Ila? Walk on." |
| Herbalists' Garden, 021-023 | 6 | "Test the soil with a sensor. 'Puzzles light you up.' Okay." |
| Chapter II, 024 | 6 | "Chapter II. Fine." |
| Observatory Hill, 025-027 | 5 | "Write a program, crashing? Too many words. I still pick it." |
| Lantern Bridge, 028-031 | 8 | "Bolt on steel supports and test each joint. Yes, this." |
| Festival Square, 032-034 | 7 | "Manage the stalls. Money. Good." |
| Night Bazaar, 035-037 | 9 | "Repair a neighbour's broken phone, with tiny screws. This is me." |
| Lamplighter's letter (88 words), 038-040 | 6 | "Long. I read it. 'Choose yours.' Okay." |
| Draft, 041 | 6 | "Builder first. Enough reading. See my result." |
| Class, board, mind questions, 042-047 | 6 | "Class 10, State board, Science." Tapped Skip on the last one. |
| Your interest shape, 048-049 | 8 | "Builder, making and fixing things. That's me." Rated 5 (Very me). |
| Where this can lead, 050 | 7 | "Engineering, Skilled trades. Agriculture first? Not me." |
| Skilled trades, 051 | 9 | "Fix a bicycle or a fan this week. ITI open day. Yes." |

Quit: no.

## 4. What kept him going, what nearly lost him

Kept him going:
1. "Repair a neighbour's broken phone at the stall, with tiny screws and bad light" (Night Bazaar, 035). He picked it at once. Interest 9.
2. "You like to fix things. Noted." (Glass Cliffs result, 019). He felt the game noticed him.
3. "Try this week: Fix a bicycle or a fan, try a school workshop, or visit an ITI open day." (Skilled trades, 051). A thing to do tomorrow.

Nearly lost him:
1. "Could not copy. The link is: http://localhost:8788/" (consent, 006). He could not send the link to his father, so the parent step almost ended the session.
2. "The road was never mine. Choose yours." in the 88-word lamplighter letter (038-040). Long words, and he had to stop to read it.
3. "Write a small program to chart the stars, even if it keeps crashing" (Observatory Hill, 025). Too many words for him; he picked it only because it was the closest to fixing.

## 5. Did it notice him? Did the mystery land?
- Yes, it noticed him, mostly. "You like to fix things. Noted.", "Puzzles light you up. Jyo noticed.", and "You were ready to decide." made him feel the game was looking at what he chose. This kept him reading.
- The mystery partly landed. He wanted to know where Ila went, and "I know where she went. I promised not to say." (Festival, 034) made him want to keep going. The lamplighter's letter was too long and abstract for him to feel the ending, though. He would have liked it shorter.

## 6. Does the result fit? Would he share it?
- Yes, it fits. Builder ("making and fixing things") was top, and the school subjects listed (Physics, workshops, technical drawing) are his. Skilled trades with ITI, plus the "Fix a bicycle or a fan" task, is the strongest part of the result for him.
- Small mismatch: "Agriculture and environment" was the top card with a "Start here" tag, which he found odd for a Builder.
- Would share: yes, he would show papa the Skilled trades card and the ITI path. The "Summary for parents" button is a good way for him to show it.

## 7. Bugs and layout problems
1. Consent link is `http://localhost:8788/`. On a phone the father cannot open it. "Copy the link" fails and shows "Could not copy." (screens: `screenshots not kept`, `screenshots not kept`). This is the most serious problem for this persona.
2. The "Could not copy" text sits tight under the "Go back" button in the consent card. It looks cramped (`screenshots not kept`).
3. The first draft screen has a large empty area between the chips and the bottom buttons (`screenshots not kept`). It looks like a chart or visual that did not render.
4. On the fields screen, the top card "Agriculture and environment" carries "Start here" even though the Builder fits Engineering and Skilled trades better (`screenshots not kept`).
5. Screenshots checked: cover `screenshots not kept`, first town `screenshots not kept`, draft `screenshots not kept`, result `screenshots not kept`, and field `screenshots not kept`. Run log: `screenshots not kept`.
