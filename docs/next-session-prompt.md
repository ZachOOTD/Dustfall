# ▶ CAMPAIGN cycle 44 — Kickoff Brief — `campaign/2026-06-18`

**Phase B is building unattended (M6→M10). M6 COMPLETE; M7 underway (⑤ done; ⑥ COMPLETE — watchtower C42 + well & debris-trail C43).**
Boot from `docs/campaign/campaign-state.json` + `docs/roadmap.md` "Up next" (the AUTHORITATIVE queue) — NOT this file's hints. The loop
commits every cycle and pauses only at `### Milestone: Phase B — Build-out complete` (after M10). Charter: `docs/campaign/campaign.md`.

## Read these now (in order)
1. `CLAUDE.md` (auto-loaded) — esp. "Where we are now".
2. `docs/campaign/campaign-state.json` + `docs/campaign/steering.md` (your inbox) + `docs/campaign/campaign-log.md` (recent cycles).
3. `docs/roadmap.md` "Up next" → Phase B → **M7 ⑦** (the LAST M7 unit).
4. `docs/decisions.md` tail (D251 — the directional-feature lesson + the `debrisPiece` `scale` param; D250 — the watchtower walkable-ramp-vantage; D226 — phash determinism) + `docs/backlog.md` §A.

## What's already built (one paragraph)
The socket-grammar POI system: `world/poiComponents.ts` (`Socket`/`mate`/`ColliderSpec`/`phash` + component builders),
`world/poiArchetypes.ts` (`assembleX` + `ARCH_WEIGHTS`), `world/poiAssembler.ts` (`placeProcgenPOI` — burial/align/collider/merge/panel).
C41 (⑤) overhauled the `derelict` ship (5 forms). C42–C43 (⑥) added 3 non-ship POIs: **watchtower** (a unitary built structure + a walkable
ramp), **well** (`wellHead` — a recessed shaft + a windlass winch), **debris-trail** (`assembleDebrisTrail` — a directional ejecta streak).
Existing non-ship archetypes: satellite, wrecked_tank, debris_field, hollow_husk, watchtower, well, debris_trail. **The enterable wreck already
exists**: `crash_husk` (D1 "Skyfall") — `assembleCrashHusk` builds a dressed, walk-in interior + a portal, but it's forced ONLY by `landCrashAt`
(absent from `ARCH_WEIGHTS`, so it never appears in the ambient scatter).

## Cycle 44 focus — **M7 ⑦ walkable-wreck-interiors (the LAST M7 unit; XL, spike→build)**
Generalize the D1 enterable `crash_husk` (the dressed interior + the enter/exit portal) so OTHER large wrecks become enterable in the ambient
scatter — turning some `ship`/`derelict`/`hollow_husk` hulls into spaces the player can walk INTO, not just around. This is the milestone's
"wreck depth" payoff.

### Priority items (in order)
1. **Recon FIRST (likely an A/B architecture spike).** Read `assembleCrashHusk` + the husk/interior dressing + the portal/enter-exit mechanic
   (`grep` for `crash_husk`, `landCrashAt`, the portal/interior trigger). Map exactly what makes `crash_husk` enterable (the hollow shell + the
   interior dressing + the collider gap for the doorway + the portal volume) vs what a normal `hollow_husk`/`derelict` has. Decide the generalization
   path: **(A)** a reusable `enterableInterior(shell)` decorator that any large archetype can opt into, vs **(B)** a new `derelict_interior` archetype
   that composes an existing hull form with the husk's interior kit. Spike both briefly if it's not obvious; pick one, log a D-entry.
2. **Build** the chosen path — a large wreck the player can walk into, with a real doorway gap in the collider (not a walk-through wall), interior
   dressing, and the enter/exit read. Reuse `crash_husk`'s interior kit + portal wherever possible (DRY).
3. **HARD conventions** (D226/D235/D250): phash-only (one `seedOf(rand)` draw, the rest hashed); declare a collider per structural mesh, with a
   deliberate GAP for the doorway (decorations get `userData.isWreckDecoration = true`); **add any new archetype to the `collider-audit` default
   list** (`scripts/rig-shot.mjs` ~line 1023 — the audit count must rise from 40; D250) — BUT note an enterable hollow shell needs the audit to
   tolerate the doorway gap + the hollow interior (study how `crash_husk`/`hollow_husk` already pass the 40%-coverage audit).
4. **Verify** — `npm run verify:all` (placement 0/0 ×5 + colliders 0/4X). The doorway gap must not trip the collider-audit (hollow-shell exempt path).
5. **Visual gate** — render via `procgen-wreck --archetype=<new> --pinyaw` (length-frame — D249) at several seeds; AND verify the INTERIOR reads
   (a render from inside / at the doorway). Fan the adversarial critics; iterate to PASS. The "can I tell it's enterable + where's the door" read is
   the thing to nail.
6. **CRITICAL — this is the only place the loop can STOP:** ⑦ likely touches the enter/exit portal + interior trigger. If generalizing it requires a
   **SAVE-SCHEMA change** (e.g. persisting which scattered wrecks are enterable / interior state), **STOP the loop and surface it** (D81 — never bump
   `SAVE_VERSION` autonomously). An additive archetype that reuses the existing transient portal should NOT need a bump — but watch for it.

### After ⑦
M7 is COMPLETE (⑤ overhaul · ⑥ new POIs · ⑦ interiors). The loop does NOT pause (only the Phase-B milestone after M10 pauses). Next is **M8**
(see `docs/roadmap.md` "Up next" → Phase B → M8 — read it fresh; don't assume).

## Autonomy contract
Ambiguous landmark/structural call → pick the form that fits the Dune/Mad-Max scavenger tone (`docs/research/`), log a D-entry, continue.
**D81 SAVE-VERSION bump STOPs the loop** — the interior-persistence question above is the one real risk this cycle; if you hit it, STOP + surface.

## Stop conditions
Terminal: max-cycles (75) · catastrophic verify break · 3 fix-walls on one gate · save-version bump (STOP) · destructive attempt. Pause:
steering "pause" · the Phase-B milestone (after M10 — M7 units don't pause).

## Notable footguns
- **The enter/exit portal + save schema (D81):** generalizing the enterable interior is the one place this milestone might want a save bump. If it
  does, STOP — don't bump autonomously.
- **The collider-audit + a doorway gap (D250/D235):** an enterable shell has a deliberate collider GAP (the door) + a hollow interior. The audit must
  treat it like `crash_husk`/`hollow_husk` (hollow-shell exempt), not flag the gap as a missing collider. Add the new archetype to the audit list.
- **End-on framing (D249):** render `--pinyaw` (or a 2nd angle) before concluding an asset is malformed.
- **Determinism (D226):** components use `phash`, never `rand`; the archetype spends ONE `seedOf(rand)`.
- `verify:placement` buffers output to the END + is slow; don't kill it early (C18 zombie footgun).

## Verification protocol
`npm run verify:all` (tsc + `verify:placement` ×5 + `verify:colliders` — add the new archetype to the audit). New enterable wreck → the
adversarial appearance gate (`--pinyaw` length-framed + an INTERIOR/doorway render) + Rule-8 iteration.

## Begin
Read the order above → `TaskCreate` the ⑦ recon+spike → study `assembleCrashHusk` → pick A/B + log a D-entry → build (phash + declared colliders
w/ a doorway gap + audit-list) → `verify:all` + the adversarial visual gate (iterate) → `/session-end`. Boot fresh from FILES; don't trust chat memory.
