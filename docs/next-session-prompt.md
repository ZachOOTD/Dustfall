# ▶ CAMPAIGN cycle 45 — Kickoff Brief — `campaign/2026-06-18`

**Phase B is building unattended (M6→M10). M6 COMPLETE; M7 underway (⑤ done; ⑥ done; C44 was a steering-driven SOLITUDE PASS).**
Boot from `docs/campaign/campaign-state.json` + `docs/roadmap.md` "Up next" (the AUTHORITATIVE queue) — NOT this file's hints. The loop
commits every cycle and pauses only at `### Milestone: Phase B — Build-out complete` (after M10). Charter: `docs/campaign/campaign.md`.

## Read these now (in order)
1. `CLAUDE.md` (auto-loaded) — esp. "Where we are now".
2. `docs/campaign/campaign-state.json` + `docs/campaign/steering.md` (your inbox) + `docs/campaign/campaign-log.md` (recent cycles).
3. `docs/roadmap.md` "Up next" → Phase B → **M7 ⑦** (the LAST M7 unit).
4. `docs/decisions.md` tail — **D252 (the SOLITUDE PRINCIPLE — read this, it constrains ⑦)**, D251 (directional features / `debrisPiece` scale), D226 (phash determinism) — + `docs/vision-deltas.md` + `docs/backlog.md` §A.

## ⚠️ NEW standing constraint — D252 (the solitude principle)
The user steered (C44): **the world must read as abandoned for ~100 years; the player feels utterly alone; almost NO signs of living human life.**
Every POI / structure must read as decayed wreckage — NO maintained, currently-used, or recently-built infrastructure. C44 removed the
`watchtower` and re-scoped the `well` into a dry collapsed ruin. **M7 ⑦'s enterable interior MUST obey this**: a long-dead wreck interior
(dust, decay, dead crew/cargo), not a tidy livable shelter. Don't add working doors, lights, or "someone lives here" dressing.

## What's already built (one paragraph)
The socket-grammar POI system: `world/poiComponents.ts` (`Socket`/`mate`/`ColliderSpec`/`phash` + component builders),
`world/poiArchetypes.ts` (`assembleX` + `ARCH_WEIGHTS`), `world/poiAssembler.ts` (`placeProcgenPOI` — burial/align/collider/merge/panel).
C41 (⑤) overhauled the `derelict` ship (5 forms). Non-ship archetypes now: satellite, wrecked_tank, debris_field, hollow_husk, well (a dry
RUIN as of C44), debris_trail. **The watchtower was REMOVED in C44.** The collider-audit default list is now 7 archetypes (35 audits).
**The enterable wreck already exists**: `crash_husk` (D1 "Skyfall") — `assembleCrashHusk` builds a dressed, walk-in interior + a portal, but
it's forced ONLY by `landCrashAt` (absent from `ARCH_WEIGHTS`, so it never appears in the ambient scatter).

## Cycle 45 focus — **M7 ⑦ walkable-wreck-interiors (the LAST M7 unit; XL, spike→build)**
Generalize the D1 enterable `crash_husk` (the dressed interior + the enter/exit portal) so OTHER large wrecks become enterable in the ambient
scatter — turning some `ship`/`derelict`/`hollow_husk` hulls into spaces the player can walk INTO. This is the milestone's "wreck depth" payoff.
**The interior must read as a long-dead wreck (D252), not a shelter.**

### Priority items (in order)
1. **Recon FIRST (likely an A/B architecture spike).** Read `assembleCrashHusk` + the husk/interior dressing + the portal/enter-exit mechanic
   (`grep` for `crash_husk`, `landCrashAt`, the portal/interior trigger). Map exactly what makes `crash_husk` enterable (the hollow shell + the
   interior dressing + the collider gap for the doorway + the portal volume). Decide the generalization path: **(A)** a reusable
   `enterableInterior(shell)` decorator any large archetype can opt into, vs **(B)** a new `derelict_interior` archetype composing an existing hull
   form with the husk's interior kit. Spike both briefly if not obvious; pick one, log a D-entry.
2. **Build** the chosen path — a large wreck the player can walk into, with a real doorway gap in the collider (not a walk-through wall), DECAYED
   interior dressing (D252 — no livable/maintained read), and a clear enter/exit. Reuse `crash_husk`'s interior kit + portal wherever possible (DRY).
3. **HARD conventions** (D226/D235/D250): phash-only (one `seedOf(rand)` draw, the rest hashed); declare a collider per structural mesh, with a
   deliberate GAP for the doorway (decorations get `userData.isWreckDecoration = true`); **add any new archetype to the `collider-audit` default
   list** (`scripts/rig-shot.mjs` ~line 1023 — the audit count must rise from 35) — BUT an enterable hollow shell needs the audit to tolerate the
   doorway gap + the hollow interior (study how `crash_husk`/`hollow_husk` already pass the coverage audit).
4. **Verify** — `npm run verify:all` (placement 0/0 ×5 + colliders 0/3X). The doorway gap must not trip the collider-audit (hollow-shell exempt path).
5. **Visual gate** — render via `--scenario=procgen-wreck --archetype=<new> --pinyaw` (length-frame — D249) at several seeds; AND verify the INTERIOR
   reads (a render from inside / at the doorway). Fan the adversarial critics; iterate to PASS. "Can I tell it's enterable + where's the door + does
   it read as a DEAD wreck (D252)" is the thing to nail.
6. **CRITICAL — the only place the loop can STOP:** ⑦ likely touches the enter/exit portal + interior trigger. If generalizing it requires a
   **SAVE-SCHEMA change** (e.g. persisting which scattered wrecks are enterable / interior state), **STOP the loop and surface it** (D81 — never bump
   `SAVE_VERSION` autonomously). An additive archetype that reuses the existing transient portal should NOT need a bump — but watch for it.

### After ⑦
M7 is COMPLETE (⑤ overhaul · ⑥ new POIs · C44 solitude pass · ⑦ interiors). The loop does NOT pause (only the Phase-B milestone after M10 pauses).
Next is **M8** (see `docs/roadmap.md` "Up next" → Phase B → M8 — read it fresh; don't assume).

## Autonomy contract
Ambiguous landmark/structural call → pick the form that fits the Dune/Mad-Max scavenger tone **AND D252 (decayed, solitary)**, log a D-entry, continue.
**D81 SAVE-VERSION bump STOPs the loop** — the interior-persistence question above is the one real risk this cycle; if you hit it, STOP + surface.

## Stop conditions
Terminal: max-cycles (75) · catastrophic verify break · 3 fix-walls on one gate · save-version bump (STOP) · destructive attempt. Pause:
steering "pause" · the Phase-B milestone (after M10 — M7 units don't pause).

## Notable footguns
- **D252 (the solitude principle):** the interior must read DEAD/decayed, not livable. Don't reintroduce "someone lives here" reads.
- **The enter/exit portal + save schema (D81):** generalizing the enterable interior is the one place this milestone might want a save bump. STOP if so.
- **The collider-audit + a doorway gap (D250/D235):** an enterable shell has a deliberate collider GAP (the door) + a hollow interior. The audit must
  treat it like `crash_husk`/`hollow_husk` (hollow-shell exempt). Add the new archetype to the audit list.
- **End-on framing (D249):** render `--pinyaw` (or a 2nd angle) before concluding an asset is malformed.
- **Determinism (D226):** components use `phash`, never `rand`; the archetype spends ONE `seedOf(rand)`.
- `verify:placement` buffers output to the END + is slow; don't kill it early (C18 zombie footgun).
- **Rig scenario invocation is `--scenario=procgen-wreck`** (not a positional arg — a bare `procgen-wreck` falls through to the default rig-studio path and times out; C44 footgun).

## Verification protocol
`npm run verify:all` (tsc + `verify:placement` ×5 + `verify:colliders` — add the new archetype to the audit). New enterable wreck → the
adversarial appearance gate (`--pinyaw` length-framed + an INTERIOR/doorway render) + Rule-8 iteration.

## Begin
Read the order above → `TaskCreate` the ⑦ recon+spike → study `assembleCrashHusk` → pick A/B + log a D-entry → build (phash + declared colliders
w/ a doorway gap + audit-list, DECAYED interior per D252) → `verify:all` + the adversarial visual gate (iterate) → `/session-end`. Boot fresh from
FILES; don't trust chat memory.
