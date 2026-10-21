"""Builds packages/engine/src/journey/data/scenes-v0.json from a compact table.

Design (docs/journey/design.md): 15 stops = every 4-subset of the six areas
once, so each area appears in 10 stops and each pair in 6. Each option has a
primary area (weight 1) and one Holland-hexagon neighbour (weight 0.5), with
each area used as a neighbour exactly 10 times. Wording is DRAFT for review.
"""
import json, pathlib

W_PRIMARY, W_SECOND = 1.0, 0.5
S = [  # (place, setup, [(code, text), ...]) code = primary+secondary
 ("Salt Harbour","The ferry is stuck at the quay and the crowd is growing.",[
  ("RI","Take the engine apart and find the fault"),
  ("IR","Measure the tides and work out what is wrong"),
  ("AS","Paint a bright sign to cheer up the waiting crowd"),
  ("SA","Sing with the waiting children to keep them calm")]),
 ("Lantern Bridge","The old bridge must be mended before the festival.",[
  ("RC","Fit the planks exactly as the plan shows"),
  ("IA","Study how old arches stand, then sketch a better one"),
  ("AI","Design a striking new bridge shape and test that it stands"),
  ("EC","Take charge of the schedule and the money for the repair")]),
 ("Clockmaker's Lane","The tower clock has stopped and nobody knows why.",[
  ("RI","Climb up and trace the broken gear by hand"),
  ("IR","Work out from the pattern of missed chimes what went wrong"),
  ("AS","Decorate the clock face to welcome visitors"),
  ("CE","Start a repair log and organise who does each job")]),
 ("Orchard Village","The harvest has come early and the crates are piling up.",[
  ("RC","Run the press and keep every crate stacked right"),
  ("IA","Try blends of apples to invent a new juice flavour"),
  ("SA","Teach visiting children to make juice, with games"),
  ("EC","Sell the juice and keep the accounts tidy")]),
 ("Fog Pass","Thick fog has settled and travellers cannot see the road.",[
  ("RI","Fix the broken signal lamp so people can see it"),
  ("IR","Map where the fog thickens, and find out why"),
  ("SE","Welcome the lost travellers and rally them to move together"),
  ("CE","Count everyone through and keep the group in order")]),
 ("Night Bazaar","The bazaar is opening and your stall is empty.",[
  ("RC","Build a sturdy stall and set it up to the plan"),
  ("IA","Examine a strange old machine and imagine what it did"),
  ("ES","Call to the crowd and make every visitor feel at home"),
  ("CR","Sort the stock by size and label every shelf")]),
 ("River Camp","A river blocks the way and the group is tired.",[
  ("RI","Build a raft and work out which wood floats best"),
  ("AI","Sketch a boat nobody has imagined, then try it"),
  ("SE","Look after tired travellers and gently get them going again"),
  ("ES","Lead the camp meeting and make sure everyone is heard")]),
 ("Weavers' Town","The great loom is jammed before the market day.",[
  ("RC","Repair the loom and keep it working to the pattern"),
  ("AS","Design a pattern that tells the town's story"),
  ("SA","Coach a shy weaver to show their work with pride"),
  ("CR","Check every bolt of cloth and store it just so")]),
 ("Glass Cliffs","A group wants to reach the cliff top by evening.",[
  ("RI","Rope down the cliff and test the rock as you go"),
  ("AI","Watch the cliff light change and work out why it glows"),
  ("EC","Organise the climbers into teams with a clear timetable"),
  ("CE","Check the safety gear, then brief the group on the plan")]),
 ("Salt Market","Two traders are arguing over a spilled load.",[
  ("RC","Haul and stack the barrels so they stay put"),
  ("SE","Help a lost trader find family and rally others to help"),
  ("ES","Negotiate a fair deal between the two arguing traders"),
  ("CR","Weigh and record every sack, then pack the cart")]),
 ("Observatory Hill","A clear night is coming and visitors are arriving.",[
  ("IA","Chart the stars and wonder what they mean"),
  ("AI","Paint the night sky and notice how it changes"),
  ("SE","Show visitors around and gently persuade them to join the club"),
  ("ES","Run the club night and make everyone feel included")]),
 ("Herbalists' Garden","The garden is overgrown and the season is turning.",[
  ("IR","Experiment with soil and seed to grow healthier plants"),
  ("AS","Shape a garden that makes people feel peaceful"),
  ("SA","Teach children to care for the plants, with stories"),
  ("CR","Label every herb and keep the beds in neat rows")]),
 ("Printers' Quarter","The old press has been found in a cellar.",[
  ("IA","Investigate how the old press makes its mark"),
  ("AI","Design a new letter style and test how readable it is"),
  ("EC","Pitch a new newspaper and set the plan and prices"),
  ("CE","Proofread every page and keep the print run on schedule")]),
 ("Healing House","Many travellers are ill and the house is full.",[
  ("IR","Test the water supply to find what is making people ill"),
  ("SE","Comfort the patients and organise helpers for the night"),
  ("ES","Run the clinic and make sure everyone is seen kindly"),
  ("CR","Keep the medicine store counted and in perfect order")]),
 ("Festival Square","The festival begins at dusk and the square is bare.",[
  ("AS","Create the welcome arch with a story in its design"),
  ("SA","Perform with the visitors so they feel part of it"),
  ("EC","Run the festival: set the stalls, the prices and the plan"),
  ("CE","Keep permits and timings in order and keep stallholders informed")]),
]
scenes=[]
for k,(place,setup,opts) in enumerate(S, start=1):
    o=[]
    for code,text in opts:
        p,s=code[0],code[1]
        o.append({"id":f"s{k:02d}-{p}","text":text,"loads":{p:W_PRIMARY,s:W_SECOND}})
    scenes.append({"id":f"s{k:02d}","place":place,"setup":setup,"options":o})
out=pathlib.Path("packages/engine/src/journey/data/scenes-v0.json")
out.write_text(json.dumps({"version":"journey-v0-draft","scenes":scenes},indent=2,ensure_ascii=False)+"\n")
print(len(scenes),"scenes")
