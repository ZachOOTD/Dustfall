# ▶ CAMPAIGN cycle 56 — Kickoff Brief — `campaign/2026-06-18`

**Phase B building unattended (M6→M10). M6 ✓ · M7 ✓ · M8 ✓ · M9 nearly done (⑪ ✓ · ⑫ ✓ C54+C55). Now ⑬ — the LAST M9 unit.**
**⚠️ STEERING `pause_before: "M10"` (C53): ⑬ is M9 → build it. But after ⑬ ships, the NEXT cycle (which would start M10) MUST PAUSE for the user's review.**
Boot from `docs/campaign/campaign-state.json` + `docs/roadmap.md` "Up next". The loop commits every cycle. Charter: `docs/campaign/campaign.md`.

## Read these now (in order)
1. `CLAUDE.md` (auto-loaded) — esp. "Where we are now".
2. `docs/campaign/campaign-state.json` (note `pause_before: "M10"`) + `docs/campaign/steering.md` + `docs/campaign/campaign-log.md` (the C54+C55 entries).
3. `docs/decisions.md` tail — **D258 (the Verlet solver), D259 (⑫'s scope: foundation shipped, body-coupling deferred)**, D81 (NEVER bump SAVE_VERSION).
4. `src/world/verletRope.ts` (the landed Verlet solver — ⑬ REUSES its `stepRopeVerlet`/`makeRopeVerlet` integration + distance-constraint pattern) + `src/config/features.ts` (`realCloth` is landed inert — this cycle is its first reader).

## What ⑫ landed (C54+C55)
A Verlet rope SOLVER (`world/verletRope.ts`) + the sled rope's dynamic-sag VISUAL behind `FEATURES.realRope` (OFF). D259 deferred the body-coupling +
other-caller visuals to a walk-test-gated backlog. **The solver primitives (Verlet integrate + relax distance constraints to a rest length) are exactly
what cloth needs** — a 2D grid is the same relaxation over a mesh of constraints instead of a 1D chain.

## Cycle 56 focus — **M9 ⑬ real-cloth-physics (the last M9 unit)**
A **2D Verlet grid** cloth sim behind `FEATURES.realCloth` (default OFF), **tent-door / flag only** (a small, bounded surface — NOT a general cloth system).
Mirror ⑫'s shape: a self-contained solver + a VISUAL integration behind the flag; default OFF → the existing static mesh runs unchanged → verify green.

### Priority items (in order)
1. **Recon FIRST (cheap).** Find the target surface — a tent door-flap and/or a flag mesh in the world (grep `tent`, `flag`, `banner`, `door.*flap`,
   `cloth` across `src/world/`). Confirm it's a static quad/plane mesh you can replace with a Verlet-driven grid. **Also confirm D81:** the cloth is a
   runtime VISUAL behind a flag → it must NOT touch the save schema. If a target surface doesn't exist, the lightest path is to ADD a small flag/banner to
   an existing camp/wreck prop (a pole + a cloth quad) and drive THAT — but keep it bounded.
2. **The cloth solver** — `src/world/verletCloth.ts` (new): an `W×H` grid of point-masses + structural distance constraints (right + down neighbours) +
   the same Verlet integrate / relax loop as `verletRope.ts` (lift the shared math; don't fork a divergent copy — extract a tiny shared helper if clean).
   Pin the TOP edge (a hanging flag) or the HINGE edge (a tent flap); gravity + a little wind sway (reuse the existing wind/weather phase if cheap). Pure +
   deterministic given inputs, like the rope solver. Standalone math-probe it (a pinned-top grid sags + settles; no NaN).
3. **The VISUAL integration** — when `realCloth` is ON, rebuild the target mesh's vertices from the cloth grid each frame (or drive a small BufferGeometry).
   Default OFF → the static mesh path runs unchanged.
4. **Verify** — `npm run verify:all` green with `realCloth` OFF (the proven path untouched). If you added a flag prop, the placement/collider gates must
   still pass (a flag quad is `isWreckDecoration`/no-collider, or declare its pole collider).
5. **Visual/feel** — the flag stays OFF (don't flip); the cloth's LOOK + sway FEEL → walk-test at the user's M10 review. A render with the flag temporarily
   forced on (uncommitted) is OK to confirm the cloth sags/sways, then revert — but don't commit the flag flipped.

### CRITICAL — stop conditions
- **D81:** a runtime cloth VISUAL behind a flag → NO save change. If ⑬ somehow needs a save field, STOP + surface (never bump SAVE_VERSION autonomously).
- **`pause_before: "M10"` — THIS IS THE BIG ONE.** ⑬ is the last M9 unit. **After ⑬ ships this cycle, set the verdict so the NEXT cycle PAUSES:** in
  `campaign-state.json` the cycle that would start M10 ⑭ must instead set `status: "paused"`, `awaiting_approval: true`,
  `stop_reasons: ["steering-pause-before-M10"]`. **Concretely: this cycle (⑬) ends CONTINUE** (⑬ is M9), **but the next `/campaign-cycle` boot will gate
  on `pause_before == "M10"` + M9-complete and STOP.** Make the next-session-prompt + the campaign-log "Next" line say this loudly so the next boot pauses
  cleanly rather than starting M10. (The user resumes into M10 via `/campaign-approve`, which clears `pause_before`.)
- **Scope:** cloth is open-ended — keep it to ONE small bounded surface (a flag or a tent flap). If it can't fit the cycle, ship `[partial]` (the solver +
  a probe) and finish the visual next cycle. Don't build a general cloth system.

### After ⑬
**The `pause_before: "M10"` gate.** The next cycle pauses for the user's M10 review + planning. Do NOT start M10 (⑭+) autonomously.

## Autonomy contract
Build behind `FEATURES.realCloth` (OFF) so verify stays green + the existing mesh is untouched. Reuse the `verletRope.ts` solver math. `[partial]` is fine.
**D81 save-bump STOPs.** Don't flip the flag (walk-test-gated). Recon the target surface BEFORE building.

## Stop conditions
Terminal: max-cycles (75) · catastrophic verify break · 3 fix-walls on one gate · save-version bump (STOP) · destructive attempt. Pause:
steering "pause" · **`pause_before: "M10"` (fires NEXT cycle, after this ⑬ ships — M9 complete)** · the Phase-B milestone (after M10).

## Notable footguns
- **Reuse the rope solver math** — cloth = the same Verlet integrate + relax, over a 2D constraint grid; don't reinvent a divergent integrator.
- **Pin the right edge** — a flag pins its top (or pole-side) edge; a tent flap pins its hinge edge. An unpinned cloth falls away.
- **Gate-and-wait:** `realCloth` stays OFF; verify:all green with it OFF.
- **The M10 pause is the headline** — make sure the next boot stops cleanly (the gate reads `pause_before` + M9-complete).
- `verify:placement` buffers output to the END + is slow; don't kill it early.

## Verification protocol
`npm run verify:all` (green with `realCloth` OFF) + a standalone cloth-solver math probe (a pinned grid sags/settles, no NaN). The cloth LOOK/sway FEEL →
walk-test at the M10 review.

## Begin
Read the order → recon the flag/tent-door target (grep) + confirm D81-clean → `TaskCreate` the cloth solver → write `verletCloth.ts` (reuse the rope math)
+ the flagged visual integration → math-probe + `verify:all` (flag OFF) → `/session-end`. **Then ensure the verdict + docs set up the `pause_before: M10`
stop for the next boot.** `[partial]` ok. Boot fresh from FILES.
