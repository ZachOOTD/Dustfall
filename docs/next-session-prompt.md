# ▶ CAMPAIGN cycle 43 — Kickoff Brief — `campaign/2026-06-18`

**Phase B is building unattended (M6→M10). M6 COMPLETE; M7 underway (⑤ done; ⑥ `[partial]` — the watchtower shipped C42).**
Boot from `docs/campaign/campaign-state.json` + `docs/roadmap.md` "Up next" (the AUTHORITATIVE queue) — NOT this file's hints. The loop
commits every cycle and pauses only at `### Milestone: Phase B — Build-out complete` (after M10). Charter: `docs/campaign/campaign.md`.

## Read these now (in order)
1. `CLAUDE.md` (auto-loaded) — esp. "Where we are now".
2. `docs/campaign/campaign-state.json` + `docs/campaign/steering.md` (your inbox) + `docs/campaign/campaign-log.md` (recent cycles).
3. `docs/roadmap.md` "Up next" → Phase B → **M7 ⑥** (`[partial]`).
4. `docs/decisions.md` tail (D250 — the watchtower + the audit-list reminder; D249 — the wreck overhaul + the end-on framing footgun; D226 — phash determinism) + `docs/backlog.md` §A.

## What's already built (one paragraph)
The socket-grammar POI system: `world/poiComponents.ts` (`Socket`/`mate`/`ColliderSpec`/`phash` + component builders),
`world/poiArchetypes.ts` (`assembleX` + `ARCH_WEIGHTS`), `world/poiAssembler.ts` (`placeProcgenPOI` — burial/align/collider/merge/panel).
C41 (⑤) overhauled the `derelict` ship (5 forms). C42 (⑥, `[partial]`) added the **watchtower** — a NEW `watchtower()` component +
`assembleWatchtower` archetype (study it as the template: a single unitary structure, declared colliders, decoration via `isWreckDecoration`,
a walkable inclined-box ramp under the KCC slope limit). Existing non-ship archetypes: satellite, wrecked_tank, debris_field, hollow_husk.

## Cycle 43 focus — **M7 ⑥ continued — the WELL/CISTERN + the DEBRIS-TRAIL**
Finish ⑥ by adding the 2 remaining non-ship POIs (then ⑥ is complete → ⑦ next):
- **Well/cistern** — a sunken stone/metal water structure: a circular curb/rim at ground level + a winch A-frame (two posts + a crossbar +
  a pulley + a hanging bucket on a rope) + a dark shaft opening. The winch silhouette is the recognizable landmark. A scavenger water cache.
- **Debris-trail** — a LINEAR streak of crash ejecta: a row of scrap chunks that grow larger toward a central impact gouge/crater (a trail
  the player follows to "what crashed here"). Like `debris_field` but a directional gradient, not a scattered disc.

### Priority items (in order)
1. **Study the templates** — `assembleWatchtower` (C42, a unitary structure) + `assembleDebris`/`debrisPiece` (the existing scatter, the
   trail's basis) + `wreckedTank` (a single bedded object). Decide each POI's components.
2. **Build** — NEW component builders in `poiComponents.ts` (a `wellCurb`/`winchFrame` for the well; reuse/extend `debrisPiece` for the trail)
   + NEW `assembleWell` + `assembleDebrisTrail` in `poiArchetypes.ts` + register in `ARCHETYPES` + `ARCH_WEIGHTS`.
3. **HARD conventions** (D226/D235/D250): phash-only (one `seedOf(rand)` draw, the rest hashed — a stray `rand()` desyncs `verify:placement`);
   declare a collider per structural mesh (decorations get `userData.isWreckDecoration = true`); **add each new archetype to the
   `collider-audit` default list** (`scripts/rig-shot.mjs` line ~1023 — else its coverage is NOT gate-verified; the audit count is the tell,
   it should rise from 30).
4. **Verify** — `npm run verify:all` (placement 0/0 ×5 + colliders, now 0/40 with 2 new archetypes ×5).
5. **Visual gate** — render each via `procgen-wreck --archetype=<new> --pinyaw` (length-frame — D249) at several seeds; fan the adversarial
   critics; iterate to PASS (no sev≥2). The well's winch read + the trail's directional gradient are the things to nail.

### Stretch
- If both land with budget, ⑥ is COMPLETE — scout **M7 ⑦ walkable-wreck-interiors** (XL, spike→build): read D1's `assembleCrashHusk` +
  the portal/interior + the generalization path. Likely an A/B spike. That's the final M7 unit.

## Autonomy contract
Ambiguous landmark/structural call → pick the form that fits the Dune/Mad-Max scavenger tone (`docs/research/`), log a D-entry, continue.
**D81 SAVE-VERSION bump still STOPs the loop** — additive archetypes shouldn't need one; if you touch the save schema, STOP + surface.

## Stop conditions
Terminal: max-cycles (75) · catastrophic verify break · 3 fix-walls on one gate · save-version bump (STOP) · destructive attempt. Pause:
steering "pause" · the Phase-B milestone (after M10 — M7 units don't pause).

## Notable footguns
- **The collider-audit list (D250):** a new archetype with declared colliders is NOT gate-verified until it's in the `collider-audit`
  default list — `verify:placement` passes regardless. Add it; watch the audit count rise.
- **End-on framing (D249):** render `--pinyaw` (or a 2nd angle) before concluding an asset is malformed.
- **Determinism (D226):** components use `phash`, never `rand`; the archetype spends ONE `seedOf(rand)`.
- `verify:placement` buffers output to the END + is slow; don't kill it early (C18 zombie footgun).

## Verification protocol
`npm run verify:all` (tsc + `verify:placement` ×5 + `verify:colliders` — add the new archetypes to the audit). New landmarks → the
adversarial appearance gate (`--pinyaw` length-framed) + Rule-8 iteration.

## Begin
Read the order above → `TaskCreate` the well + trail → build components + archetypes (phash + declared colliders + audit-list) → `verify:all`
+ the adversarial visual gate (iterate) → `/session-end`. Boot fresh from FILES; don't trust chat memory.
