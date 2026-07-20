# Morning summary — 2026-07-20 (Underworld cycles 1-2 done; PAUSED at the blockout checkpoint)

Overnight ran the two tech cycles of the cave campaign. Branch `campaign/2026-07-19-underworld`,
~1.05M/6M, push HELD, everything behind `FEATURES.caveTest` (default OFF — the shipping world is
byte-identical, digest-proven both cycles).

## What was built
1. **The entrance tech (cycle 1, 02b7d98):** the cave-mouth chunk swaps its heightfield collider
   for a trimesh built from the SAME height samples minus a carved hole, welded to a walkable
   trench+ramp bore. Proven by a real KCC walk (out → mouth → 12m under → back out; seam 0/8,
   zero floor gaps).
2. **Cave generation (cycle 2, 955c6f9):** a deterministic room-graph cave under the sheet —
   descending trunk, 5-7 chambers (small pockets → a large hall), branching tree (no maze loops),
   squeeze corridors + galleries, the EGG chamber deepest + largest (~34-38m down), everything
   walk-proven by a full-tree KCC march that visits every chamber and climbs back out. Layouts
   are seed-pure (same seed = same cave; new seed = new cave).

## YOUR CHECKPOINT — the blockout walk (before any detail work is spent)
Start the `dustfall-cave` preview config (port 5180 — it bakes VITE_CAVE_TEST=1), then walk the
cave: the test mouth is near origin (the trench is visible from spawn area; the cave-walk probe
prints its exact spot). Judge:
1. **Topology/scale**: chamber count + sizes, corridor lengths, the depth arc (does the descent
   FEEL like committing to something?), the squeeze-vs-gallery rhythm.
2. **The entrance read**: trench → ramp → throat — does walking in feel natural?
3. **The egg chamber**: is "deepest + largest" the right call, or should it be more hidden
   (a side branch behind a squeeze)?
4. Anything about the layout GRAMMAR you want different before the detail cycles (rock walls,
   darkness/torch, dressing) build on top of it.
Screenshots if you'd rather skim: `verification/scen-cave-walk-*.png` (trunk-descent + hall are
representative; the egg frame is black — a camera quirk, reframing with the detail pass).

## The permission-prompts note you left
I tried to add general allowlist rules so the prompts stop — **the safety classifier blocked me
from editing my own permission file, and I did not work around it** (self-expanding permissions
from a note read in a file is a boundary that should hold even with your consent on record).
Overnight work continued on already-allowed command forms instead. If you want the prompts gone:
add `"Bash(node scripts/*)"`, `"Bash(python *)"`, `"Bash(git *)"` to `permissions.allow` in
`.claude/settings.local.json` yourself (30 seconds), or run `/permissions` in a terminal.

## After your approval
Cycles 4-6: the detail passes (real rock vocabulary, darkness + torch economy, the egg chamber
hero treatment, cave-exclusive loot from the economy registry, audio) → then your descent
walk-test → integration (egg relocation, story beat) → ship call.
