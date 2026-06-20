# ▶ CAMPAIGN cycle 42 — Kickoff Brief — `campaign/2026-06-18`

**Phase B is building unattended (M6→M10). M6 COMPLETE; M7 (Wreck depth & new POIs) underway (⑤ done).** Boot from
`docs/campaign/campaign-state.json` + `docs/roadmap.md` "Up next" (the AUTHORITATIVE queue) — NOT this file's hints. The loop commits
every cycle and pauses only at `### Milestone: Phase B — Build-out complete` (after M10). Charter: `docs/campaign/campaign.md`.

## Read these now (in order)
1. `CLAUDE.md` (auto-loaded) — esp. "Where we are now".
2. `docs/campaign/campaign-state.json` + `docs/campaign/steering.md` (your inbox) + `docs/campaign/campaign-log.md` (recent cycles).
3. `docs/roadmap.md` "Up next" → Phase B → **M7 ⑥**.
4. `docs/decisions.md` tail (D249 — the C41 wreck overhaul + the **end-on framing footgun**; D226-D237 — the socket grammar) + `docs/backlog.md` §A.

## What's already built (one paragraph)
The socket-grammar POI system (`world/poiComponents.ts` = `Socket` + `mate()` + per-component declared colliders, all phash-deterministic;
`world/poiArchetypes.ts` = the `assembleX` archetypes + `ARCH_WEIGHTS` roulette; `world/poiAssembler.ts` = `placeProcgenPOI`, the
burial/align/collider/merge/salvage-panel pipeline). C41 (⑤) extended the `derelict` ship archetype (splayed engines, sensor masts, 5
forms). Existing NON-ship archetypes: satellite (radial), wrecked_tank (toppled), debris_field (scattered), hollow_husk (gutted shell).
The rig has `--archetype=` + `--pinyaw` + the `procgen-wreck` / `collider-audit` scenarios.

## Cycle 42 focus — **M7 ⑥ more-wreck-types-new-pois (L)**
Add 2-3 NEW non-ship POIs via the SAME socket grammar so the desert has more landmark variety than ships + tanks. Per the proposal:
a **watchtower** (a tall lookout structure — RAMP/switchback vantage, NOT a ladder movement-mode), a **debris-trail** (a streak of
crash ejecta the player can follow), and/or a **well/cistern** (a sunken water/storage structure). Pick the 2-3 highest-value; `log()` cuts.

### Priority items (in order)
1. **ASSESS + scope** — read `poiComponents.ts` (the component builders + the `Socket`/`mate`/`ColliderSpec`/`phash` conventions) +
   `poiArchetypes.ts` (how `assembleSatellite`/`assembleDebris` compose — your templates) + `poiAssembler.ts` (`ArchetypeParams`: bucket,
   burySink/bury/seatSink, list, panelMin/Max, sandMound). Decide the 2-3 POIs + their components.
2. **Build new components + archetypes** — NEW component builders in `poiComponents.ts` (legs/platform/roof for the watchtower; a ramp;
   ejecta chunks for the trail; a curb/shaft for the well). NEW `assembleX` in `poiArchetypes.ts` + register in `ARCHETYPES` +
   `ARCH_WEIGHTS`. **Conventions (hard):** phash-only (one `seedOf(rand)` draw, the rest hashed — D226); declare a collider per structural
   mesh (decorations get `userData.isWreckDecoration=true`); a `panelMount` if it carries salvage.
3. **The watchtower's ramp must be WALKABLE** — keep the ramp slope under the KCC climb limit (~50°, see `character-controller`); this is
   the one with real traversal stakes (feel-pending walk-test, but the slope is gate-checkable structurally).
4. **Verify** — `npm run verify:all` (placement 0/0 ×5 + colliders 0/25 — the collider-audit will catch undeclared structural meshes).
5. **Visual gate (hero — new landmarks).** Render each new archetype via `procgen-wreck --archetype=<new> --pinyaw` (LENGTH-FRAME — D249's
   lesson: don't let an end-on shot grade the camera) at several seeds; fan the adversarial critics; iterate 3-5+ rounds; PASS iff no sev≥2.

### Stretch
- Scout **M7 ⑦ walkable-wreck-interiors** (XL, spike→build) — read D1's enterable `crash_husk` (`assembleCrashHusk` + the portal/interior),
  the generalization path. That's the next + final M7 unit (an A/B spike likely).

## Autonomy contract
Ambiguous structural/landmark call → pick the form that fits the Dune/Mad-Max scavenger tone (`docs/research/`), log a D-entry, continue.
**D81 SAVE-VERSION bump still STOPs the loop** — procgen POI placement is additive/archetype-agnostic (D227), so a new archetype shouldn't
need one; if you touch the save schema, STOP + surface.

## Stop conditions
Terminal: max-cycles (75) · catastrophic verify break · 3 fix-walls on one gate · save-version bump (STOP) · destructive attempt. Pause:
steering "pause" · the Phase-B milestone (after M10 — M7 units don't pause).

## Notable footguns
- **End-on framing (D249):** a subject whose long axis is randomly yawed reads END-ON in a fixed-axis framer → looks like a blob. Render
  with `--pinyaw` (or a 2nd angle) before concluding an asset is malformed — rule out the camera first.
- **Determinism (D226):** components use `phash`, never `rand`; the archetype spends ONE `seedOf(rand)`. A stray `rand()` desyncs `verify:placement`.
- **Declare colliders** (D235) on every structural mesh; the collider-audit gate fails otherwise.
- `verify:placement` buffers output to the END + is slow; don't kill it early (C18 zombie footgun).

## Verification protocol
`npm run verify:all` (tsc + `verify:placement` ×5 + `verify:colliders`). New landmarks → the adversarial appearance gate (`--pinyaw`
length-framed) + Rule-8 iteration. Walkable ramp slope → structural check + walk-test.

## Begin
Read the order above → `TaskCreate` the 2-3 POIs → build components + archetypes (phash + declared colliders) → `verify:all` + the
adversarial visual gate (iterate) → `/session-end`. Boot fresh from FILES; don't trust chat memory.
