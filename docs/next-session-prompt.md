# ▶ CAMPAIGN cycle 55 — Kickoff Brief — `campaign/2026-06-18`

**Phase B building unattended (M6→M10). M6 ✓ · M7 ✓ · M8 ✓ · M9 underway (⑪ ✓ · ⑫ rope solver+visual ✓ C54). Now ⑫ continued.**
**⚠️ STEERING: `pause_before: "M10"` is set (C53) — once M9 (⑫+⑬) completes, the loop PAUSES for the user's M10 review.**
Boot from `docs/campaign/campaign-state.json` + `docs/roadmap.md` "Up next". The loop commits every cycle. Charter: `docs/campaign/campaign.md`.

## Read these now (in order)
1. `CLAUDE.md` (auto-loaded) — esp. "Where we are now".
2. `docs/campaign/campaign-state.json` (note `pause_before: "M10"`) + `docs/campaign/steering.md` + `docs/campaign/campaign-log.md` (the C54 entry).
3. `docs/decisions.md` tail — **D258 (⑫ visual-first; the body-coupling is THIS cycle)**, **D124 (CCD — now relevant, the rope drives bodies)**, D126 (the inextensible constraint being replaced), **D125 (the KCC/moving-body wall — adjacent to body-coupling; re-table-ish discipline if it fights back)**, D81.
4. `src/world/verletRope.ts` (the landed solver) + `src/world/ropeConstraint.ts` (`applyInextensibleConstraint`, D126) + `src/world/sled.ts` (the C54 visual wiring + the tow constraint call).

## What C54 landed (the ⑫ [partial])
`world/verletRope.ts` — a Verlet rope SOLVER (probe-validated). The SLED rope's VISUAL sag is now Verlet-driven when `FEATURES.realRope` is ON (the 3
CatmullRom mid-points swing/settle/taut vs. the static droop). Default OFF → the proven rope runs. `Tuning.VERLET_ROPE_*`; per-sled `ropeVerlet`.

## Cycle 55 focus — **M9 ⑫ continued: body-coupling + CCD + the other caller visuals**
Make the rope's PHYSICS real (not just the visual): the Verlet rope's tautness drives the towed body, replacing `applyInextensibleConstraint` when
`realRope` is ON; + CCD (D124) so a fast body can't tunnel; + extend the Verlet visual to the other 3 rope callers.

### Priority items (in order)
1. **Body-coupling (the core, the risk).** When `realRope`, the towed body (sled) is constrained by the Verlet rope's end segment going taut — i.e. the
   rope's attach-end point pulls the body — instead of the D126 position-snap. Keep the SAME `{snapped, torn, postX/Y/Z}` contract the callers expect (so
   the OFF path + the callers are untouched). **D125-adjacent risk:** the body responding to a moving rope-end can fight the KCC/contact like the sled-ride
   did. **If it drifts/jitters and 2 approaches fail, DON'T force a 3rd** — keep the visual-only ⑫ (C54), DEFER body-coupling to backlog (a D-entry), and
   move to ⑬ (the solver's already landed for cloth). Re-table-ish, per the D125 discipline.
2. **CCD (D124).** Once the rope drives the body, enable CCD on the relevant body so a fast tow can't tunnel the rope/body through colliders (mirror the
   D124 dropped-pickup CCD). Only meaningful with body-coupling — if body-coupling is deferred, CCD defers with it.
3. **The other 3 caller visuals.** Extend the Verlet-visual (like the sled rope) to the companion tether / stake / kill-drag ropes behind `realRope`
   (each reuses `verletRope.ts`). Lower-risk (visual-only, like C54's sled rope). Can be its own `[partial]` if body-coupling eats the cycle.
4. **Verify** — `npm run verify:all` stays green with `realRope` OFF. If body-coupling lands, the OFF path (inextensible snap) must stay byte-proven.
5. **Visual/feel** — flag stays OFF (don't flip); the rope sim's LOOK + the tow FEEL (and especially body-coupling feel) → walk-test at the user's M10 review.

### CRITICAL — stop conditions
- **D81:** runtime physics behind a flag → NO save change. STOP + surface if it somehow needs one.
- **D125 discipline:** if body-coupling fights the KCC/contact (drift/jitter) and won't settle in ≤2 approaches, DEFER it to backlog (don't thrash) + move on — the visual ⑫ + the other-caller visuals are a fine M9-⑫ landing for the user's review.
- **`pause_before: "M10"`:** after ⑬ (M9 complete), the next cycle PAUSES (don't start M10). This cycle is ⑫ (M9) → no pause yet.

### After ⑫
⑬ real-cloth-physics (a 2D Verlet grid behind `FEATURES.realCloth`, tent-door/flag only; reuses `verletRope.ts`'s solver). Then **the M10 pause** (C53 steering).

## Autonomy contract
Build behind `FEATURES.realRope` (OFF) so verify stays green + the proven path is untouched. Body-coupling is the risk — re-table-to-backlog if it won't
settle (D125 discipline), don't force it. `[partial]` is fine. **D81 save-bump STOPs.** Don't flip the flag (walk-test-gated).

## Stop conditions
Terminal: max-cycles (75) · catastrophic verify break · 3 fix-walls on one gate · save-version bump (STOP) · destructive attempt. Pause:
steering "pause" · `pause_before: "M10"` (after M9) · the Phase-B milestone (after M10).

## Notable footguns
- **Body-coupling is D125-adjacent** — a body chasing a moving rope-end can fight the KCC; cap attempts + defer to backlog rather than thrash.
- **Keep the constraint contract** (`{snapped, torn, postX/Y/Z}`) so the 4 callers + the OFF path are untouched.
- **CCD (D124)** only matters once the rope drives bodies.
- **Gate-and-wait:** `realRope` stays OFF; verify:all green with it OFF.
- `verify:placement` buffers output to the END + is slow; don't kill it early.

## Verification protocol
`npm run verify:all` (green with `realRope` OFF) + the standalone solver-style probe if you change the solver. The sim LOOK/body-FEEL → walk-test.

## Begin
Read the order (esp. D258 + D124 + D125) → study `verletRope.ts` + `ropeConstraint.ts` + the sled tow constraint → `TaskCreate` the body-coupling →
attempt it behind `realRope` (cap at 2 approaches; defer to backlog if it fights, per D125) + the other-caller visuals → `verify:all` (flag OFF) →
`/session-end`. `[partial]` ok. Boot fresh from FILES.
