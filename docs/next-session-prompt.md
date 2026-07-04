# Next session — Y-QUEUE COMPLETE (2026-07-04); RELEASE PENDING the user's final walk-test

**THE RELEASE IS STAGED.** The full Y-queue shipped through `b6ade67` (cockpit Mk-III glazed
dome w/ user review round; the ONE-pod consistency + interior Mk-II; pivoting levers at
seated reach; rotate-then-eject 180° beat; visible eject pull; real-glass hallway windows +
densified real starfield; z-fights root-caused; menu freeze-frame loading; Model Stage +
Geometry Lint tooling; E-to-sit + no-emoji fixes). Full suite green incl. the new permanent
gates (door-flush-audit 7 states · doorway-torture 6/6). The 4173 server serves the release
build. ON THE USER'S CONFIRMATION: (1) flip `FEATURES.escapePodIntro` default ON w/ env
kill-switch (`!== '0'`), (2) re-gate the DEFAULT build (plain `npm run build` + smoke) + the
Continue-with-old-save path, (3) `git merge --no-ff` → master + push, (4) watch deploy.yml →
verify the LIVE Pages link (New Game → cockpit; old-save Continue skips the intro), (5) docs
+ campaign-state to RELEASED. If the user reports issues instead: fold into a new queue,
re-verify, THEN release.

--- (superseded prior state below) ---
# X-queue COMPLETE (overnight 2026-07-04); awaiting the user's walk-test

The full overnight batch from the user's W2 walk-test feedback SHIPPED (9 commits,
`bab0cd9..a97a3de`, all pushed). Boot from this file + `docs/campaign/steering-archive.md`
(2026-07-04 entries). Branch `campaign/escape-pod-intro`. The intro preview build + local
server (port 4173, `dustfall-intro-preview`) were rebuilt at close-out.

## What shipped (all gates green; per-unit detail in the git log)
- ✅ **X1+X1p COCKPIT FULL REBUILD** — 8-pane faceted panoramic canopy (research-grounded),
  side walls cleaned, bolts root-caused (_stud axis), rib strips re-seated, hauler nose
  matched + made legible; polish: uniform pane clarity (Fresnel overdrive), slim A-posts,
  rooted beacon, sill fascia. Adversarial gate PASS.
- ✅ **X2a THE ONE POD** — the bay pod IS the real cabin (one interior path, sealed shell,
  no space visible inside), console/eject detail redesign, flush door (hinge root cause),
  pale-at-eject killed, landed pod on plain terrain w/ clear plumb door + walk-back-in.
- ✅ **X3 FLOW** — board straight from the engine check (bay-reach arming); red-alert strobes
  through the whole boarding + release; BAY-UNTIL-EJECT (the frame swap rides the eject
  blast; same door in view before/after).
- ✅ **X4 CORRIDOR** — walkable lived-in crew quarters (sliding door, CREW placard, bunk/
  locker/desk/props); the starboard viewport strip; bay-entrance hull seams root-caused +
  sealed; bay-pod collision ring verified; airlock detail; pipe ends in manifolds; engine
  detail.
- ✅ **X6 WRAP** — combined 3-lens adversarial gate (11 agents) → 3 confirmed SEV1s + SEV2s
  ALL fixed + own-eyes re-verified (viewport = real starfield window [root cause: an opaque
  reveal panel COVERED the glass], quarters doorway conduits split + capped, airlock leaves
  matched + aligned seal lamps, plumb open pod door [swing sag + over-rotation], sealed ring
  seams, capped conduits, seated hauler brow). SHIP-WIDE COLLISION AUDIT: rule-9 PASS, zero
  stale colliders, zero uncovered walkables. Suite: verify:all · smoke-intro beats:12 ·
  pod-walkin · pod-walkout · airlock-motion · smoke-pod-persistence · bench:intro (PRELOAD
  Σ-entry 21.3ms, 0 frames >50ms — no hitch regression; bench takes ~30min wall-clock under
  swiftshader, that is NORMAL).

## WALK-TEST FLAGS for the user (stills can't gate these — their eyes decide)
1. The cockpit seated WOW + head-turn parallax through the wrap panes (+ the planet framing).
2. The boarding rhythm end-to-end: engine check → straight to the airlock → E-opens → sit →
   red-alert flashing throughout → eject WITH the bay visible until the blast.
3. The collar depth read in motion (a critic still counts the door jamb as a "nested frame").
4. The viewport strip on the corridor walk (star backdrop; largest stars read faintly square).
5. The quarters peek (lived-in read; furniture is intentionally walk-through decoration).
6. The landed pod: plumb open door, walk-back-in, plain terrain (sand dressing removed —
   re-enable lever: ENABLE_CRASH_GROUND_DRESSING in podScene.ts).
7. Audio mix balance (standing flag).

## Known non-blocking residuals
- ship-explode rig scenario shows a false-pale cabin (live-loop noon stomp — documented in
  steering-archive; judge the eject cabin in-game or via pod-interior scenarios).
- The bench COLD path rose 124→181ms with the new geometry; the shipped PRELOAD path is
  the gate and held (~21ms). If COLD ever matters, extend the preload warm list.
- Star quads: texture point-sprites would be crisper (deferred by draw-call discipline).

## Next after the walk-test
Fold the user's feedback (steering → a new queue); then the remaining campaign phases
(the CLAUDE.md note: Phase 3 hauler/disaster polish → 4 crash/tutorial → 5 audio) per
`docs/campaign/campaign-state.json`. Rule 9 stands: collision matches models, same change,
motion-proven.
