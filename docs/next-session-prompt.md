# Next session — MID ship+sequence OVERHAUL (session handoff 2026-07-03)

The prior (very long) session ended mid-overhaul by user choice. Boot from THIS file + the
campaign log + `docs/campaign/steering-archive.md` (the 2026-07-03 entries hold every spec,
verbatim-derived from the user's playtests). Branch `campaign/escape-pod-intro`; everything
committed through `aa77968` is pushed. **Standing rule 9 (CLAUDE.md): collision always
matches the models — update both in the same change; prove with motion probes.**

## The work queue (the user's playtest feedback — specs in steering-archive 2026-07-03)
- ✅ **W1** (`aa77968`) — cockpit WOW canopy (58% glass, panoramic), console lowered, side
  panels deleted, pre-taper purge, chair collider deleted + roam-proven.
- ✅ **W4** (`9a8f7e7`) — planet ballooning truly fixed (anchor at 1000m — the old fix held
  but 400m had real parallax; on-screen drift now −1.1% over the walk).
- ✅ **W6** (committed) — free-look seated camera; ONE continuous recede-while-exploding ship shot;
  the 2-phase slower planet approach (DESCENT_DURATION 18→22s); the impact eye-in-cabin fix (proven
  3519 frames); the ZERO-SHIFT handoff (exposure lift DELETED — constant 1.05; fog normalized during
  the fall; the clock backward-snap fixed; proven by the new zero-shift-handoff gate); the door-slant
  hinge fix. NEW gates: impact-eye, zero-shift-handoff, door-check. Walk-test flags: the merged shot
  rhythm, approach pacing, free-look feel.
- ✅ **W2 — the canonical pod + airlock bay** (committed this session): pod TALLER (2.65→3.40m,
  h/d 0.92→1.18); ONE unified door/porthole constant set (FDOOR/CPOD divergence deleted; porthole
  R 0.44→0.33, bezel ≤0.41, ≥0.10m margins, no hull clip); `buildCanonicalPodExterior` returns the
  FULL modeled interior behind genuinely see-through glass (the `_cpodCabinGlow` fake killed); pod
  materials retuned into the ship's worn-gunmetal family (incl. the scorch-fade `cAlu` offender +
  the cabin-hatch door set + a transparent porthole rim well — the open door reads THROUGH now).
  NEW BAY: operational sliding blast-door (`setBayAirlockDoor`, seal collider opens with it) →
  round ribbed gasketed collar (de-telescoped after an adversarial-gate FAIL) → the pod's own door,
  pod body mostly OUTSIDE the hull w/ exterior mating hardware. Boarding flow: new `airlock`/`collar`
  phases (player-gated E-opens), both doors auto-reseal at launch prep; smoke driver updated;
  `__game.setBayAirlockDoor` exposed. RIG ASPECT FIX: `page.screenshot` was resampling non-900×1100
  buffers into the fixed viewport — every such rig shot was stretched (the "oval porthole" false
  frame); the capture now snaps the viewport to the canvas buffer. Flee-cam pulled off the +X wall
  (grazing-sliver false positives, D165 class). Gates: verify:all · smoke-intro beats:12 ·
  pod-walkin · pod-walkout · airlock-motion · smoke-pod-persistence all PASS. Adversarial gate run
  (3 critics + 1 confirm): all cross-confirmed SEV1s fixed. WALK-TEST residuals: the collar
  jamb-stack read at the still camera (motion parallax should resolve it), the rig-only exterior
  mating legibility (no player vantage sees it), the hatch close-up's warm beacon wash.
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
