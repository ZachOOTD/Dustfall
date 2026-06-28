# ▶ RESUME — Escape-pod intro · Phase 0 · T0.2 (greybox ship + first beats) — `campaign/escape-pod-intro`

**Cycle 3 of the escape-pod-intro campaign.** Phase 0 (the greybox spine). T0.0 (framework) +
T0.1 (new-game/save wiring + dev hooks) shipped. Boot from `docs/campaign/campaign-state.json` +
`docs/roadmap.md` (NOT chat memory).

## Read first
1. `CLAUDE.md` (auto-loaded) — "Where we are now"
2. `docs/campaign/campaign-state.json` — cycle 2/150, current_tier (T0.2)
3. `docs/feature-escape-pod-intro.md` — the BUILD PLAN (Phase 0) + the vision (Beats 0-2)
4. `docs/decisions.md` (tail) — **D269** (the architecture contract) + **D270** (the T0.1 wiring)
5. `src/world/escapePodIntro/sequence.ts` — the framework + the per-beat dispatch (read the contract comment)

## What's built (T0.0 + T0.1)
- The beat state machine + `updateEscapePodIntro` dispatch (no-op beats so far) + `introActive` guard, `ctx.intro?`.
- New game (flag on) → `startEscapePodIntro`; Continue/Dev → normal spawn. `introComplete` save marker. Save blocked mid-intro.
- Dev hooks: `__game.startIntro()` (force, ignores flag) / `__game.skipIntro()` / `__game.jumpToBeat(beat)`. Use these to iterate.

## Cycle 3 focus — T0.2: the greybox SHIP + Beats 0-2
The first **playable** beats. **Greybox = placeholder boxes; correctness of SPACE + FLOW, not beauty** (hero ship art is Phase 3). Build:
- **Greybox ship-interior geometry** (`src/world/escapePodIntro/` — new e.g. `shipScene.ts`): a cockpit/bridge room + a corridor, as **box-collider floors + walls** the KCC walks (R4 ✓ — collision-general). Place it at an OFFSET from the desert (e.g. far +Y or far XZ) so it coexists with the boot-built world without interference. A greybox "window" (a colored quad) with the planet below. Built into the scene at boot only when the intro is active (or built lazily on intro start) — keep it out of the normal game.
- **Beat controllers** (in `sequence.ts`'s dispatch / per-beat tick fns):
  - `cockpit` (mode `seated`/`scripted`) — place the capsule in the bridge looking at the planet; a diegetic "check engines" prompt; trigger (timer or a look/keypress) → `advanceBeat`.
  - `checkEngines` (mode `walk`) — free locomotion; get up + move toward the corridor mouth; reaching it → advance.
  - `corridor` (mode `walk`) — walk the corridor; reaching the far end triggers the disaster beat (for greybox, → advance to `enterPod`, which can be a stub that hands to the desert via `endEscapePodIntro` until T0.3 builds it).
- **Locomotion gating** — wire `updatePlayer` to read `ctx.intro.mode`: `walk` = normal WASD+look; `seated` = look only (no locomotion); `scripted` = camera driven. (Add the `introActive`/mode read in `controller.ts`.)
- **System suppression** — while `introActive(ctx)`, stand down the systems that would interfere (stats drain, raiders/lizards/worm AI, combat). Add `introActive(ctx)` early-outs where needed (per D269 — NOT pause).
- **Capsule placement** — the cockpit beat teleports the player capsule onto the ship floor (set `cameraSnapNextFrame`). The handoff (T0.4) teleports back to the desert spawn.

### Acceptance
- Flag OFF (default) → game boots exactly as today (`verify:all` green). `__game.startIntro()` (or flag ON + new game) → you spawn in the greybox cockpit, see the planet, get the "check engines" prompt, walk out through the corridor, and at the corridor end it advances (to enterPod stub → desert, until T0.3). No stats drain / no enemies during the intro. `__game.skipIntro()` still hands back cleanly. No SAVE_VERSION bump.

## Visual gate (T0.2 = greybox, routine bar)
This is greybox blockout, NOT hero art — the gate verifies the SPACE reads + is walkable (legible cockpit, corridor you can traverse, planet visible), not beauty. Render the **real first-person in-game view** (drive `__game.startIntro` + walk via evals/`poseLunge`-style hooks or camera evals), 1-2 critics / `/visual-triage`, FLOOR bar (no sev≥2). Hero ship modeling is Phase 3 (procedural-modeler) — do NOT gold-plate greybox.

## Then (rest of Phase 0)
T0.3 greybox descent + seated pod + the parachute-gag fallback · T0.4 greybox wake → desert handoff
(pod-as-spawn seam) → tutorial scaffold + smoke check. **Phase 0 milestone → PAUSE** for the user's
first walk-test (the whole flow + pacing).

## Campaign rules
ENRICH-NOT-CUT · greybox now / hero art (procedural-modeler + real FP-view gate) in Phases 1-5 ·
anti-punt · behind the flag · no save bump · `verify:all` + a live smoke each cycle · commit each
cycle · checkpoint = per phase. Steer via `docs/campaign/steering.md`.

## Footguns
- Keep the flag OFF by default — the live game (on master) must stay byte-identical when the intro isn't active.
- Greybox ship geometry must NOT spawn in the normal game — gate its build on the intro.
- `introActive` gating ≠ pause (D269). Place the ship offset so it doesn't collide with desert POIs.
- The KCC walks box colliders (R4) — no terrain coupling needed for the ship floor.

## Verify
`npm run verify:all` (tsc + placement 0/0 ×5 + colliders 0/40 — watch the collider gate if you add ship colliders). Plus a live smoke: `__game.startIntro()` → walk the cockpit→corridor → confirm beat advance + no errors.
