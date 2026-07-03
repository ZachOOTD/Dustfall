# Next session — MID ship+sequence OVERHAUL (session handoff 2026-07-03)

The prior (very long) session ended mid-overhaul by user choice. Boot from THIS file + the
campaign log + `docs/campaign/steering-archive.md` (the 2026-07-03 entries hold every spec,
verbatim-derived from the user's playtests). Branch `campaign/escape-pod-intro`; everything
committed through `aa77968` is pushed. **Standing rule 9 (CLAUDE.md): collision always
matches the models — update both in the same change; prove with motion probes.**

## FIRST: reconcile W6 (possibly interrupted mid-flight)
A W6 agent (sequence fixes + the ZERO-SHIFT handoff) was RUNNING when the session ended,
editing `sequence.ts` / `sky.ts` / `podScene.ts` / `rig-shot.mjs`. At boot: `git status`.
- If the tree is DIRTY: reconcile per the campaign crash protocol — `tsc` + `smoke-intro`;
  if coherent, checkpoint-commit as WIP (label it W6-CHECKPOINT, unverified) and RE-VERIFY
  against the W6 spec below before counting it done; if incoherent, surface + decide.
- If CLEAN with a W6 commit in the log: verify its report claims (the gates), then proceed.

## The work queue (the user's playtest feedback — specs in steering-archive 2026-07-03)
- ✅ **W1** (`aa77968`) — cockpit WOW canopy (58% glass, panoramic), console lowered, side
  panels deleted, pre-taper purge, chair collider deleted + roam-proven.
- ✅ **W4** (`9a8f7e7`) — planet ballooning truly fixed (anchor at 1000m — the old fix held
  but 400m had real parallax; on-screen drift now −1.1% over the walk).
- ⏳ **W6** (reconcile first): camera = FREE-LOOK seated (set once, never re-anchor); ONE
  continuous ship view (recede WHILE exploding — no fade/re-frame); the planet approach
  SLOWER in 2 phases (far-slow → atmosphere-approach); impact frames must never show
  outside the pod; **the ZERO-SHIFT handoff** (normalize ALL intro world-state high during
  the fall: DELETE the wake exposure lift/ease entirely [the washed-out exit the user still
  sees], blend to normal survival fog during the fall, weather/time continuous, NOTHING
  changes when exiting the pod — wake = spawning into the world).
- ▶ **W2 — the canonical pod + airlock bay** (the user's #1 repeated ask: "the EXACT same
  model through the whole sequence — I don't think you're getting this correctly"): make the
  pod TALLER (reads short/stubby); BIG interior overhaul (the porthole circle overlaps the
  door, overlapping models/textures — clean redesign where everything connects); ONE model
  used in the bay + the fall + the surface (full interior + see-through porthole visible in
  the bay). NEW BAY LAYOUT: an OPERATIONAL sliding door (engine-room style) → a small
  corridor/airlock → the pod's own door at its end → the pod body mostly OUTSIDE the hull.
  Clean the hallway pipes/arches crossing in front. (Files: podScene + shipScene + sequence
  boarding flow — after W6 reconciliation.)
- ▶ **W3** — grey bolts on walls/floor rotated wrong (undersides exposed — rotation must
  match the surface; note the ship is static-merged, fix the SOURCE builders); the corridor-
  entrance pipes end abruptly (route into the wall/an archway); more engine-room detail.
- ▶ **W5** — CREW QUARTERS: opposite side of the hallway from the pod, toward (not at) the
  engine room; sliding doors + a clean entranceway (clear blockers in front).
- ▶ **THE WRAP** (after all): a SHIP-WIDE COLLISION AUDIT (rule 9 — every collider vs the
  visible geometry, motion-proven) → full gate suite → rebuild `npm run preview:intro`
  (serve via the `dustfall-intro-preview` launch.json entry, port 4173) → kill stray test
  servers → clean `git status` → ONE "everything's done" summary to the user.

## Contracts + tools (unchanged)
Gates: `verify:all` · `smoke-intro` (beats:12) · `pod-walkin`/`pod-walkout` ·
`smoke-pod-persistence` · `bench:intro` (no hitch regression). Behind
`FEATURES.escapePodIntro`; no SAVE_VERSION bumps; the live master untouched. Modeler agents
for hero geometry; verify claims with own eyes + motion probes; commit+push per unit.
The architecture map: `docs/architecture-escape-pod-intro.md`.
