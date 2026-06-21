# ▶ CAMPAIGN cycle 59 — Kickoff Brief — `campaign/2026-06-18`

**Phase B FINAL tier, almost done. M6–M9 ✓ · M10: ⑭ ✓ · ⑮ ✓ · NOW ⑰ pickup-instancedmesh = the LAST unit.**
**⚠️ After ⑰ ships, M10 is COMPLETE → the loop PAUSES at the "Phase B — Build-out complete" milestone** (checkpoint=milestone) — the user's BIG Phase-A/B feedback + walk-test session (they've held all feedback for this gate). **⑯ drop-pod-intro stays DEFERRED.**
Boot from `docs/campaign/campaign-state.json` + `docs/roadmap.md`. The loop commits every cycle. Charter: `docs/campaign/campaign.md`.

## Read these now (in order)
1. `CLAUDE.md` (auto-loaded) — esp. "Where we are now".
2. `docs/campaign/campaign-state.json` + `docs/campaign/steering.md` + `docs/campaign/campaign-log.md` (the C58 entry).
3. `docs/decisions.md` tail — D262 (⑮), D192/D198 (`mergeStaticByMaterial` — the existing static-merge perf pattern), D81.
4. The pickup system: grep `bobPickups`, `spawnDroppedPickup`, `pickups` in `src/` — find where world pickups are spawned/rendered (likely `src/world/` + `main.ts`'s `bobPickups` tick) + the perf HUD (`drawCalls`/`programs`, the `updatePerfHud` tick).

## What ⑮ landed (C58)
The speeder is now REPAIRABLE (broken→working) behind `FEATURES.repairableSpeeder` (OFF). D262. The current game is unchanged (flag OFF).

## Cycle 59 focus — **M10 ⑰ pickup-instancedmesh (perf — human-attended)**
Convert the world's scattered pickups from per-item meshes (one draw call each) to **`THREE.InstancedMesh`** (one draw call per pickup TYPE), to cut draw calls. "Human-attended" = the perf win is validated by a human watching the perf HUD; you verify it doesn't REGRESS visuals/behavior.

### Priority items (in order)
1. **Recon FIRST (decides scope + risk).** How are pickups rendered today? (a) per-pickup `THREE.Mesh` added to the scene, bobbed each frame by `bobPickups`? (b) how many distinct pickup item types/models? (c) do pickups share a geometry+material per type (instanceable) or is each bespoke? (d) how is a pickup picked up (raycast/proximity → which object identifies it)? InstancedMesh requires per-instance transforms + a way to map an instance back to its pickup id (for the E-take + the bob). **If pickups are already instanced or already cheap (few draw calls), this may be a no-op — confirm the perf HUD shows pickups are actually a cost before rewriting.**
2. **Instance per type.** One `InstancedMesh` per pickup model; per-instance matrix = the pickup's bobbed transform (write `setMatrixAt` each frame in `bobPickups`, `instanceMatrix.needsUpdate = true`). Maintain an index↔pickup-id map so take/remove updates the right instance (swap-remove + count-- is the usual pattern; or hide via a zero-scale matrix). Preserve the bob animation + the E-take + any glow/highlight.
3. **D81 — almost certainly no save touch** (pickups are runtime-spawned/positioned; the save stores pickup STATE [positions/ids], not render objects). If a save change somehow appears, STOP + surface (never bump SAVE_VERSION).
4. **Verify** — `verify:all` green. **Perf:** capture `drawCalls`/`programs` before/after (the perf HUD or a `__game` probe) and LOG the delta — that's the unit's whole point; a silent "done" with no number is the anti-pattern. Confirm pickups still bob + take correctly (a render + an eval probe of the pickup list).
5. **Scope:** if instancing all pickup types is too big, instance the most-numerous type(s) `[partial]` + log what's left. Don't regress correctness for the perf win.

### CRITICAL — after ⑰ ships: PAUSE at the Phase-B milestone
⑰ is the LAST M10 unit. When it ships, **M10 is complete** → the "Phase B — Build-out complete" milestone is reached. Per `checkpoint: "milestone"`, **set the verdict to STOP (pause):** `status: "paused"`, `awaiting_approval: true`, `stop_reasons: ["milestone-review"]`, and do NOT schedule another cycle. This is the planned BIG review: the user gives ALL their held Phase-A/B feedback, walk-tests everything (the flag-gated M9/M10 systems + the whole game), and designs the deferred ⑯ drop-pod-intro. Resume via `/campaign-approve`.

### If pickups are already cheap / instanced
Then ⑰ is a no-op — don't invent a rewrite. Log the finding (perf HUD numbers proving pickups aren't a draw-call cost), mark ⑰ done-by-assessment, and STILL pause at the Phase-B milestone (M10 complete).

## Stop conditions
Terminal: max-cycles (75) · catastrophic verify break · 3 fix-walls on one gate · save-version bump (STOP) · destructive attempt. **Pause: the Phase-B milestone (after ⑰ = M10 complete) — THIS fires next cycle.**

## Notable footguns
- **InstancedMesh index↔id mapping** is the trap — take/remove must update the right instance (swap-remove + count, or zero-scale hide); a stale map shows ghost/wrong pickups.
- **Measure before rewriting** — confirm pickups are actually a draw-call cost (perf HUD) before instancing; don't rewrite a non-problem.
- **The perf delta is the deliverable** — LOG drawCalls before/after; don't ship silently.
- `verify:placement` buffers output to the END + is slow; don't kill it early.

## Verification protocol
`verify:all` + a perf-HUD/probe drawCalls before/after + a pickup take/bob correctness check (render + eval). Perf FEEL (smoothness) → the walk-test.

## Begin
Read the order → recon the pickup render/take path + the perf HUD → confirm pickups ARE a draw-call cost → `TaskCreate` the instancing → build (preserve bob + take + the index map) → measure drawCalls before/after → `verify:all` → `/session-end` → **set the Phase-B milestone PAUSE verdict (don't schedule another cycle).** `[partial]` ok. Boot fresh from FILES.
