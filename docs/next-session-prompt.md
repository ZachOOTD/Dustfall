# ▶ CAMPAIGN cycle 53 — Kickoff Brief — `campaign/2026-06-18`

**Phase B building unattended (M6→M10). M6 ✓ · M7 ✓ · M8 ✓ COMPLETE. Now M9 — architectural-risk physics (⑪ rideable-sled-spike).**
Boot from `docs/campaign/campaign-state.json` + `docs/roadmap.md` "Up next" (the AUTHORITATIVE queue). The loop commits every cycle and pauses only at
`### Milestone: Phase B — Build-out complete` (after M10). Charter: `docs/campaign/campaign.md`.

## Read these now (in order)
1. `CLAUDE.md` (auto-loaded) — esp. "Where we are now".
2. `docs/campaign/campaign-state.json` + `docs/campaign/steering.md` + `docs/campaign/campaign-log.md` (recent cycles).
3. `docs/roadmap.md` "Up next" → Phase B → **M9 ⑪**.
4. `docs/decisions.md` — **D125 (the riding/KCC wall — READ THIS; it's the whole risk of ⑪)**, D124 (rope-physics CCD, for ⑫), D226 (phash), D81 (save-bump STOP).

## Cycle 53 focus — **M9 ⑪ rideable-sled-spike (A/B worktree spike — architectural-risk)**
Spike making the **sled rideable** (the player stands/rides on a towed sled while the speeder tows it — a moving-platform-ride). This is an
**architectural-risk** unit: a prior riding attempt hit the KCC/moving-platform wall (**D125** — read it: the kinematic character controller fights
a moving platform under it). The spike's job is to find whether a sound approach exists — NOT to ship polished gameplay.

### Priority items (in order)
1. **Recon FIRST — read D125 + the current riding/tow code.** What exactly failed before (KCC vs. moving platform; slope projection)? Map the CURRENT
   state: the speeder ride (mount/dismount, the rider seat, `updatePlayer`'s moving-platform-ride read — `grep` moving-platform / ride / sled XZ delta),
   the sled tow (`updateSleds`, the tow spring, `ctx.sleds`), and how `updatePlayer` already handles "this-frame's sled XZ delta" (the C24/QQ note in
   the main.ts tick mentions sleds run before updatePlayer so the delta is fresh). Establish what's reusable.
2. **Spike 2 candidate approaches CONCURRENTLY (worktrees — `isolation: worktree`), behind a `FEATURES.rideableSled` KILL-SWITCH (default OFF).**
   Candidates to consider (pick the real ones after recon): **(A)** parent/teleport the player capsule to the sled each frame (carry the sled's XZ
   delta onto the KCC like the speeder seat does) vs **(B)** a kinematic "platform" body the KCC rides via Rapier's character-controller move + the
   platform velocity. Each spike: can the player stand on a moving (towed) sled without jitter/ejection/sinking, on flat ground + a gentle slope?
3. **Decide + write the verdict.** If ONE candidate works → keep it behind the flag (default OFF until walk-tested), log a D-entry, ship the spike.
   **If BOTH candidates fail → RE-TABLE (D125): do NOT force a 3rd KCC attempt.** Mark ⑪ re-tabled, move the idea to `backlog.md` PARKED with the
   failure notes, log a D-entry, and CONTINUE to ⑫ (don't STOP the loop — re-table is a normal outcome for this flagged-risk unit).
4. **Verify** — `npm run verify:all` stays green (the flag is default-OFF, so shipped behavior is unchanged). A worktree spike that lands only a
   flagged-OFF prototype + a verdict doc is a valid outcome.
5. **Visual/feel** — riding is FEEL-dominant + headless can't judge it; the spike proves the MECHANISM works structurally (no jitter/NaN in a physics
   probe), and the actual ride feel → walk-test. Don't claim feel from a screenshot.

### Autonomy contract / stop conditions
- **D125 re-table escape hatch:** if both A/B fail, re-table (backlog PARKED) + a D-entry + CONTINUE — that's the designed outcome, NOT a STOP.
- **Kill-switch:** ship behind `FEATURES.rideableSled` default OFF (flip-authority is autonomous per the Phase-B calls ONLY once a headless+feel gate
  passes — but riding feel is walk-test-only, so leave it OFF for the user's milestone review).
- **D81:** a sled-ride shouldn't need a save change (it's a runtime mount state). If it does, STOP + surface.
- **`isolation: worktree`** for the concurrent A/B prototypes so they don't collide on `updatePlayer`/`updateSleds`.

## Stop conditions
Terminal: max-cycles (75) · catastrophic verify break · 3 fix-walls on one gate · save-version bump (STOP) · destructive attempt. Pause:
steering "pause" · the Phase-B milestone (after M10 — M9 units don't pause). **D125 re-table is a CONTINUE, not a stop.**

## Notable footguns
- **D125 is the whole risk** — read it before spiking. The KCC + a moving platform is the known wall.
- **Tick order:** `updateSleds` runs BEFORE `updatePlayer` (so the sled's this-frame XZ delta is fresh for a moving-platform-ride read) — the speeder
  ride relies on this; the sled ride likely must too.
- **Worktree spikes auto-clean** if unchanged. Behind a default-OFF `FEATURES` flag → verify:all unaffected.
- `verify:placement` buffers output to the END + is slow; don't kill it early.

## Verification protocol
`npm run verify:all` (green with the flag OFF). The spike's deliverable is a verdict (works-behind-flag | re-tabled) + a D-entry; riding feel → walk-test.

## Begin
Read the order (esp. **D125**) → `git`/`grep` the speeder-ride + sled-tow + `updatePlayer` moving-platform code → `TaskCreate` the A/B spike →
spike both in worktrees behind `FEATURES.rideableSled` → pick one OR re-table (D125) + log a D-entry → `verify:all` → `/session-end`. Boot fresh from FILES.
