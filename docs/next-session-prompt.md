# ▶ CAMPAIGN cycle 41 — Kickoff Brief — `campaign/2026-06-18`

**Phase B is building unattended (M6→M10). M6 is COMPLETE; M7 (Wreck depth & new POIs) begins.** Boot from
`docs/campaign/campaign-state.json` + `docs/roadmap.md` "Up next" (the AUTHORITATIVE queue) — NOT this file's hints. The loop
commits every cycle and pauses only at `### Milestone: Phase B — Build-out complete` (after M10). Charter: `docs/campaign/campaign.md`.

## Read these now (in order)
1. `CLAUDE.md` (auto-loaded) — esp. "Where we are now".
2. `docs/campaign/campaign-state.json` + `docs/campaign/steering.md` (your inbox) + `docs/campaign/campaign-log.md` (recent cycles).
3. `docs/roadmap.md` "Up next" → Phase B → **M7**.
4. `docs/decisions.md` tail (esp. D226-D237 — the socket grammar + archetypes; D227 — the deferred ship→socket migration) + `docs/backlog.md` §F/§G (wreck polish).

## What's already built (one paragraph)
M6 shipped (crafting chooser · real forgiving survival · flat-color audit · diegetic HUD). The WRECK system: ACBA built a
**component/socket/`mate()` grammar** — `world/poiComponents.ts` (a Socket = pos + outward-quat + radius + tag; `mate(parent,
parentSocket, childSocket)` glues a child socket OPPOSING a parent in ANY topology — radial/vertical/scatter, not just linear),
`world/poiArchetypes.ts` (the grammar + biome-weighted `pickArchetype`), `world/poiAssembler.ts` (`placeProcgenPOI` — the
generalized burial/align/declared-collider/re-skin/merge/salvage-panel pipeline). 5 archetypes ship: **ship** (still DELEGATES to
the LEGACY linear `placeProcgenComposite` — the `cockpit→hull→engine→tail` +X-cursor assembler, D227 deferred the migration),
satellite, tank_cluster, debris_field, husk. User feedback on the ships has repeatedly been "all long tubes."

## Cycle 41 focus — **M7 ⑤ procedural-wreck-overhaul (L)** — starts M7
Add NET-NEW STRUCTURE AXES so procedural SHIPS read wider/weirder, not as the current linear tubes. The socket grammar already
supports non-linear topology (it's used by satellite/tank/debris) — the SHIP path just doesn't use it yet.

### Priority items (in order)
1. **ASSESS FIRST** — read `poiComponents.ts` (Socket/mate), `poiArchetypes.ts` (how satellite/tank compose via sockets), and the
   LEGACY `placeProcgenComposite` (the linear ship assembler) to understand the gap. Decide the smallest change that adds real
   structural variety: e.g. a socket-grammar `ship` archetype with new axes — a DORSAL spine/tower, LATERAL sponsons/pods, a
   splayed multi-engine cluster, asymmetric bow forms — instead of (or alongside) the linear cursor. Scope it; `log()` what you cut.
2. **Build the new structure axes** via the socket grammar (reuse `mate()` + the declared-collider/burial/merge pipeline in
   `poiAssembler.ts` — every component DECLARES its Rapier colliders; everything `phash`-derived so it NEVER draws the shared `rand`,
   D226). Keep determinism (the `verify:placement`/`verify:colliders` gates depend on it).
3. **Verify the gates hold** — `npm run verify:all` (placement 0/0 ×5 + colliders 0/25). New collidable meshes MUST declare colliders
   (the collider-audit will catch gaps). Watch the perf-probe `programs` + `drawCalls` (the wreck merge keeps draw calls bounded).
4. **Visual gate (this is HERO visual work — the wreck is the signature POI).** Render via the `procgen-wreck` / `--archetype=`
   rig-shot scenarios FRONT-LIT + length-framed; fan the adversarial appearance critics (the full hunt — this is a hero asset, not a
   tweak). PASS iff no sev≥2. Iterate 5-8 rounds per Rule 8. The FEEL (walking among them) → walk-test.

### Stretch
- If the overhaul lands with budget, scout **M7 ⑥ more-wreck-types-new-pois** (watchtower / debris-trail / well — ramp-vantage not
  ladder) so cycle 42 starts fast.

## Autonomy contract
Ambiguous structural call → pick the form that reads as a wrecked starship (Dune/TFA-Jakku tone — see `docs/research/`), log a D-entry,
continue — never ask the human. **D81 SAVE-VERSION bump still STOPs the loop** — procgen POI placement is archetype-agnostic + additive
(D227), so a new ship archetype shouldn't need one; if you somehow touch the save schema, STOP + surface.

## Stop conditions
Terminal: max-cycles (75) · catastrophic verify break · 3 fix-walls on one gate · a needed save-version bump (STOP+surface) · destructive
attempt. Pause: steering "pause" · the Phase-B milestone (after M10 — M7 completing does NOT pause).

## Notable footguns
- **Determinism**: components must derive randomness from `phash` (D226), NEVER the shared scatter `rand` — else `verify:placement`
  desyncs across seeds. Register-all-then-prune for panels (D208/D210).
- **Declare colliders** on every structural mesh (the collider-audit gate, D235) — decorations/overhead/hollow-shells are exempt via tags.
- Hero visual work demands the full screenshot-iterate loop (Rule 8) — do NOT ship a wreck overhaul on `tsc`-clean alone.
- `verify:placement` buffers output to the END + is slow; don't kill it early (C18 zombie footgun).

## Verification protocol
`npm run verify:all` (tsc + `verify:placement` ×5 + `verify:colliders`) + perf-probe. Hero visual → the full adversarial appearance gate
+ Rule-8 iteration. Inspect via `procgen-wreck` / `--archetype=` rig scenarios.

## Begin
Read the order above → `TaskCreate` the scope → build the new socket-grammar structure axes → `verify:all` + the adversarial visual gate
(iterate) → `/session-end`. Boot fresh from FILES; don't trust chat memory.
