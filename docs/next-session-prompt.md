# Session ACE — Kickoff Brief

## Read these now (in order)

1. **CLAUDE.md** (auto-loaded) — project manual.
2. **docs/session-end-report.md** — cumulative state through ACD.
3. **docs/backlog.md** — open items. Note the **Sled riding mechanic — TABLED** entry near the top with tried-approaches + next-attempt directions.
4. **docs/decisions.md** — D-entries through D125. ACD added D122 (managed-scalar slope-slide bypass), D123 (sled body kinematic + tilts to terrain), D124 (pickup CCD), D125 (riding mechanic tabled).
5. **docs/roadmap.md** — "Up next" lists ACE candidates.
6. **docs/architecture.md** — only if touching a system you don't already know.

## What's already built (one paragraph)

ACD shipped a major sled physics rework: slope-slide via managed-scalar velocity bypassing Rapier's velocity integrator, sled body switched to `KinematicPositionBased` (immune to dynamic-item push impulses), body tilts each frame to match terrain slope (Option B — top face is uniformly above terrain across footprint), pickup CCD enabled (rope no longer tunnels through terrain when dropped), back wall as sensor (player doesn't perch on the lip when jumping on). `_frameDeltaX/Y/Z` tracking added to Sled as foundation for the future player-ride attempt. The "stand on sled and ride it" mechanic was attempted across 3+ architectures and tabled — Rapier KCC has no built-in moving-platform tracking and no amount of detection + delta application could fully counter its slope-projection/autostep/contact-resolution interactions with a tilted moving kinematic body. See `docs/backlog.md` + D125 for tried approaches and concrete next-attempt directions.

## Session ACE — pick at session-start

User did not explicitly direct ACE. Pick at session-start based on what feels most missing. Top three candidates:

**Option A — Sled riding mechanic, second attempt** (~3-5h). Take the D125 next-attempt directions:
- Full Option C parenting: when ride detection fires, COMPLETELY override `setNextKinematicTranslation` on the player to `(sled.tr + savedLocalOffset + inputMotion)`. Skip KCC entirely while riding. Jump (Space) exits ride state. Most deterministic — eliminates all KCC-interaction issues.
- OR: synthetic "ride peg" dynamic body anchored to the sled center. Thin invisible cylinder that overlaps slightly with the player capsule's lower hemisphere. Sled drags peg via friction; peg's lateral motion shoves the capsule via Rapier's contact resolution. Mirrors the working "branch on sled" trick the user discovered.

Acceptance: player can stand on a stationary sled and walk around freely on it. Player can stand on a sliding sled (downhill) and stays on it. Player can jump off to exit. No drift, no perching, no falling-through.

**Option B — B1 Phase 3 generalised rope** (~4-6h). Lift the inextensible-rope constraint out of `updateSleds` into a shared system so NON-sled tethers work. Then add new endpoint kinds (`raider_corpse`, `sandworm_carcass`, `world_anchor` stake) + the gameplay around each. Big-ticket follow-up to ACC's Phase 2 architectural lift. Acceptance: drag a raider corpse on a rope; lasso a sandworm carcass for harvesting; tie a sled to a stake in the ground.

**Option C — Visual-polish wrap-ups + 3P camera real-playtest** (~2-3h). Remaining polish items from the ABP-ABX arc (per-item viewmodel 3P readability NOTE from ABY, 3P camera collision real-playtest, walk-cycle-to-footstep audio cadence sync).

## Autonomy contract

When ambiguous mid-session → pick the option closest to the GDD pillars + decisions.md realism dial, append a new D-entry explaining the call, keep going. Never block to ask the user mid-session for routine ambiguity. Surface only on:
- Procedural-vs-asset question (D107 — stay procedural unless explicit user approval).
- Save-schema bumps (D81 — additive only; flag if you need to bump SAVE_VERSION).
- Destructive git operations.
- Catastrophic block (a critical system breaks and the fix > 1h).

## Stop conditions

- Wall-clock 4-6h elapsed for a focused session, 8-14h for an overnight.
- All priority items shipped + budget remains → escalate to next item from candidates.
- 3 consecutive fix walls on the same gate → invoke `/scope-cutter` and pick a different path.
- Catastrophic block — the kind that breaks main.ts boot or the save format.
- Destructive-action attempt — STOP and surface immediately.

## On stop — `/session-end`

Run `/session-end`. It verifies (tsc clean), appends the changelog entry, updates CLAUDE.md / roadmap.md / decisions.md / backlog.md / session-end-report.md / next-session-prompt.md, runs `/post-mortem`, prints commit-message hints (print-hints mode per Dustfall's default git policy).

## Notable footguns

- **D107 zero-asset**: No GLB, no PBR textures, no external assets. Everything procedural.
- **D109 localSpace=true on moving entities**: any shader applied to a moving body (sled, companion, sandworm, lizard, speeder, player rig) MUST pass `localSpace: true` or texture detail will crawl across the surface as the body moves.
- **D81 additive save discipline**: new fields are optional, no version bump unless schema is genuinely incompatible.
- **D122 managed-scalar motion bypass**: if you setLinvel on a body with friction against the heightfield, expect the contact solver to eat it. Use kinematic + setNextKinematicTranslation instead.
- **D123 body tilts to match terrain**: the sled body is now KinematicPositionBased and rotates each frame to terrain normal. Items on the deck stay via friction (0.85, atan = 40° threshold > any practical dune slope).
- **D125 KCC moving platforms**: Rapier's KCC has no built-in moving-platform support. Don't expect setLinvel or friction on a moving kinematic body to drag the KCC capsule along.
- **Sled `_frameDeltaX/Y/Z`**: tracked each frame in `updateSleds` but currently UNUSED. Preserved as foundation for the next ride-mechanic attempt. Free to read.

## Verification protocol

Single command: `npm run verify` (= `tsc --noEmit`). Dustfall is post-MVP and opted out of the framework's tier-ladder verification model per the roadmap.md framework note.

## Begin block

1. Read CLAUDE.md (auto-loaded), session-end-report.md, backlog.md (note the TABLED riding entry), decisions.md (D125 especially), roadmap.md.
2. Confirm `npm run verify` baseline passes.
3. Decide on ACE direction (A / B / C above, or surface a different priority the user wants).
4. TaskCreate covering the priority items.
5. Begin coding.
