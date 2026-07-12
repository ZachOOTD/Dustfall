# Next session — cycle 10: M7 Skyfall S2 (enterable interior + colliders + walk probe)

**State:** campaign "Sharpen & Deepen" `active`, resumed at M7 on branch `campaign/2026-07-12-skyfall`
(cycle 9 done, ~3.55M/10M tokens). M7-S1 SHIPPED (D300): `src/world/skyfallWreck.ts` — the ~46m crashed
heavy-freighter EXTERIOR blockout, live as the `skyfall_freighter` S4 landmark kind (34% of landmark
regions, `FEATURES.skyfall`-gated). All gates green; visual proof `verification/scen-skyfall-*.png`.

## Cycle 10 mission — S2 per docs/feature-skyfall.md (+ the steering fold-ins at its end)

Build the ENTERABLE greybox interior inside the S1 hull frame:
1. Compartments (2-3 per the approved "larger" answer) inside the fore hull (~30m loft, HALF_W 3.8 /
   HALF_H 2.9, deep keel bury ~2.8-3.2m — the walkable floor must sit ABOVE the buried keel line).
2. Real entry: the fracture mouth (currently dark-baffled) becomes the breach walk-in; keep a torn-metal
   read (formers stay). Interior floor/wall/ceiling as `BoxSpec`-style declared colliders (the
   shipScene.ts pattern), threshold sills at compartment seams (the "stars through the floor" fix),
   doorway jamb + lintel sealing (the airlock anti-space-leak model).
3. Rule 9: collision matches visible geometry EXACTLY; sweep the S1 exterior colliders against the new
   openings (the fore-hull cuboid must not block the breach mouth — split it around the opening).
4. NEW `skyfall-walk` rig probe: teleport-stream to the nearest skyfall (reuse the `skyfall-shot` scan),
   spawn INSIDE, walk the floor, push every wall, exit + re-enter, assert no fall-through/wall-clip —
   wire it into the gate list. Interior shots via `skyfall-shot` (add interior angles).
5. Constraints unchanged: determinism from the piece rand only; shared module materials; every body
   returned for teardown; one deferred thunk (watch the chunk-perf tripwire — if the interior build
   pushes the thunk past budget, split interior into a second deferred thunk with its own up-front seed).

**After S2 ships: STOP — the ⏸ post-blockout WALK-TEST pause** (charter pause #1, `pause_before:
hero-detail`): set `awaiting_approval: true`, `stop_reasons: ["feel-review"]`, surface the nearest
skyfall coordinates + a `__game` teleport helper so the human can walk the greybox in-app, then
`/campaign-approve` resumes into S3-S5 hero detail.

## Standing constraints
- Steering (2026-07-12): NO sand mounds anywhere in Skyfall work; interior detail bar (S3-S5) =
  INTRO-SHIP level in the wrecked art style.
- The human may switch Fable 5 → Opus 4.8 mid-campaign — keep cycle-end state fully explicit.
- Never `npm run reap` while a probe is live (it kills the probe's chromium and leaves stale PNGs).
- Gates every cycle: `verify:all` + 5 smokes (`smoke-intro`, `smoke-pod-tutorial`, `pickup-take-sweep`,
  `survival-probe`, `diurnal-probe`).

## Key files
`src/world/skyfallWreck.ts` (the hull to open up) · `src/world/chunkManager.ts` (the deferred-thunk
render branch, ~line 680) · ship interior precedent: `src/scenes/shipScene.ts` (BoxSpec colliders,
sills, jambs) · `scripts/rig-shot.mjs` (`skyfall-shot` scenario + where `skyfall-walk` goes) ·
`docs/feature-skyfall.md` (the DoD + reconciliation + steering).
