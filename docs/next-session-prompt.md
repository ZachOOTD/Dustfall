# ▶ CAMPAIGN cycle 52 — Kickoff Brief — `campaign/2026-06-18`

**Phase B building unattended (M6→M10). M6 ✓ · M7 ✓ · M8: ⑧ ✓ · ⑨ ✓ COMPLETE (the cave). Now ⑩ — the companion (the LAST M8 unit).**
Boot from `docs/campaign/campaign-state.json` + `docs/roadmap.md` "Up next" (the AUTHORITATIVE queue). The loop commits every cycle and pauses only at
`### Milestone: Phase B — Build-out complete` (after M10). Charter: `docs/campaign/campaign.md`.

## Read these now (in order)
1. `CLAUDE.md` (auto-loaded) — esp. "Where we are now".
2. `docs/campaign/campaign-state.json` + `docs/campaign/steering.md` + `docs/campaign/campaign-log.md` (the C46-C51 entries — the cave).
3. `docs/roadmap.md` "Up next" → Phase B → **M8 ⑩**.
4. `docs/decisions.md` tail — **D255 (cave scope)**, D254 (cave topology), D252 (tone), **D81 (NEVER bump SAVE_VERSION autonomously — THIS is the cycle most likely to hit it)**, D226 (phash).

## What ⑨ left for ⑩
A complete single-chamber cave at `biomes.caveAnchor` (`world/deepCave.ts`, on `ctx.deepCave`): descend the funnel → enter the roofed dark chamber →
a **low stone DAIS at the chamber's deep end** (`hx*0.35, ~floorY, -hz*0.55` in the cave's local frame) = the prepared **companion-egg site**. The egg
itself is this cycle.

## Cycle 52 focus — **M8 ⑩ companion-egg-cherry-pick (M; the LAST M8 unit)**
Re-apply the `2d4035b` companion spine so the player acquires a companion creature at the cave dais. After this, M8 is COMPLETE.

### Priority items (in order)
1. **Recon FIRST.** (a) `git show 2d4035b --stat` + the diff — what the companion spine added (the creature, its follow AI, acquisition). (b) The
   CURRENT companion code already present: `ctx.companion: Companion | null`, `updateCompanion(c, dt)` in the `main.ts` tick (Session AAE), and any
   `companion`/`Companion` files (`grep`). Establish what exists vs. what `2d4035b` had — ⑩ is a CHERRY-PICK/re-enable, not a from-scratch build. Decide
   exactly what to re-apply + how to gate acquisition on the cave egg.
2. **The egg pickup at the dais.** Place an egg object on the cave dais (`ctx.deepCave` / `deepCave.ts`). Interacting with it (E) acquires the companion
   (spawn/enable `ctx.companion`, following the player). Reuse the existing pickup/interaction patterns. Decayed-tone-safe (D252 — the egg is the ONE
   intentional non-wreck object; keep it reading as a found artifact, not maintained tech).
3. **SAVE — the D81 watch (CRITICAL).** Persisting "the egg was taken / the companion exists" should be an **additive** optional field
   (`companionEggTaken?: boolean`, default false on load) per D254/D81 — NO `SAVE_VERSION` bump. **Before writing any save code, check `src/persistence/
   save.ts`:** if the companion can be re-derived/re-spawned from an additive optional field with a safe default, proceed. **If it genuinely needs a
   `SAVE_VERSION` bump (a non-additive schema change), STOP the loop + surface to the user — do NOT bump autonomously.** This is the single most likely
   STOP trigger of the whole campaign so far; treat it carefully.
4. **Verify** — `npm run verify:all` (tsc + placement 0/0 ×5 + colliders 0/40). If the egg declares a collider, account for it; if it's a pickup, follow
   the pickup conventions.
5. **Visual gate** — render the egg on the dais (`--scenario=cave --angle=inside`) — it reads as a findable egg/artifact in the dark chamber. The
   companion MODEL (if `2d4035b` brings one) gets its own gate/feel pass; the acquisition + follow FEEL → walk-test.

### After ⑩ → M8 COMPLETE
M8 is done (⑧ spike · ⑨ cave · ⑩ companion). The loop does NOT pause (only the Phase-B milestone after M10). Next is **M9 — Architectural-risk
physics** (⑪ rideable-sled-spike [A/B worktree, kill-switch, re-table if both fail per D125] · ⑫ real-rope-physics · ⑬ real-cloth-physics) — read
`docs/roadmap.md` "Up next" → M9 fresh.

## Autonomy contract
Ambiguous call → fit the tone (D252) + log a D-entry, continue. **D81 save-bump STOPs the loop — and ⑩ is where it's most likely.** If the companion
needs more than an additive optional save field, STOP + surface.

## Stop conditions
Terminal: max-cycles (75) · catastrophic verify break · 3 fix-walls on one gate · **save-version bump (STOP)** · destructive attempt. Pause:
steering "pause" · the Phase-B milestone (after M10 — M8 units don't pause).

## Notable footguns
- **D81 / the save schema:** ⑩'s whole risk. Additive optional field = OK; a `SAVE_VERSION` bump = STOP + surface.
- **`2d4035b` may predate other refactors** — the cherry-pick may not apply cleanly; re-apply the SPINE (the intent) adapted to current code, don't force a raw cherry-pick.
- **The cave is `ctx.deepCave`** (a fixed module, not an archetype); the egg/dais live in `world/deepCave.ts`.
- **Heavy-world screenshot flake:** the `cave` scenario logs numbers before the screenshot + try/catches — reuse for the egg shot.
- `verify:placement` buffers output to the END + is slow; don't kill it early. Rig renders use `--scenario=<name>`.

## Verification protocol
`npm run verify:all` + the visual gate on the egg (`--scenario=cave --angle=inside`) + the companion model if one ships. Acquisition + follow FEEL → walk-test.

## Begin
Read the order → `git show 2d4035b` + `grep` the current companion code → `TaskCreate` the ⑩ cherry-pick → place the egg on the dais + wire acquisition →
**check `save.ts` for the D81 risk FIRST** → build (additive save field only) → `verify:all` + the egg visual gate → `/session-end`. **If a SAVE_VERSION
bump is needed, STOP + surface.** Boot fresh from FILES.
