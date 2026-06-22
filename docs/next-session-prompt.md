# ▶ RESUME — M11 review-fix pass (wreck fixes validated) — `campaign/2026-06-18`

**Picking up where the last session left off.** The campaign is in the **Phase-B review-fix pass (M11→M13)** from the user's 2026-06-20 triage. The wreck/panel fixes (M11) are done + the user walk-tested them ("looks ok for now", 2026-06-21). Boot from `docs/campaign/campaign-state.json` + `docs/roadmap.md`.

## Status — what's DONE (M11, user-validated)
- **ⓐ panels "not openable"** (C61/D264) — culled panels were left visible; `pruneBuriedPanels` cull() now hides them. 21 hidden / 79 openable, verified.
- **ⓑ floating panels** (C62) — flat-on-curved-crest panels overhang; sank the crest mounts (wreckedTank + derelict).
- **ⓒⓓ wrecked_tank + ⓒⓓⓔ husk** (C63 + 4 follow-ups) — **the root cause was `makeFormerRings`' hidden `0.84×` shrink** (`radius*(0.84−i·taper)`): ribs rendered ~19% inside the shell, floating. Fix: pass `ribActualR/0.84` so ribs touch the wall (BOTH wrecks). Plus: removed the floating cone-spikes (huskShell), removed a bad stringer, clamped a seam that floated past the shell's open-top edge, embedded/relocated the salvage panels off the ribs. tank + husk both walk-tested ok.

**Hard-won learning** (see `shared-memory`/the `verify-visual-multi-angle` memory): verify wreck fixes from MULTIPLE angles INCLUDING the player's-eye / into-the-tear view — a single framed exterior shot hid the floating ribbing for several rounds. The isolated `procgen-wreck` rig works for side/3q but its **into-the-torn-end / front angle reliably flakes** (near-all-dark frame), so that angle needs the user's in-game eyes.

## REMAINING in this review-fix pass
- **M11 stragglers:** ~3 far-out **hand/hero-wreck unregistered panels** still visible-but-not-openable (a different path from the procgen cull — `crashedHull`/`megaShip`/`megaWreck`/`heroLandmarks` register only "above-ground" panels, ACAS A4). → [backlog.md](backlog.md) §A. Register-or-hide them.
- **M12 — sand worm** (needs the user's LISTEN + feel): remove the dorsal ridges · attack = charge-straight then DIVE from the current position (no airborne jump) · alert audio → a low quiet rumble + screen-shake buildup (mysterious).
- **M13 — weapon & vehicle audio** (needs the user's EARS): gunshot + reload SFX for all guns · speeder engine → a lower-pitched smoother hum.

## How to resume
- The campaign is **paused at M11 batch-1** (`status: paused`, `awaiting_approval: true`) — the user validated the wreck fixes but the explicit gate is still set. **`/campaign-approve`** to clear it + continue → M11 stragglers → M12 → M13.
- Execution model (user, 2026-06-20): **autonomous fixes, PAUSE after each tier (batch) for the user's walk-test/listen** — audio + feel can't be self-verified. Keep the per-tier milestone pauses.
- **NOT in the loop — dedicated solo sessions:** the **Skyfall crashed-ship** (new researched high-quality enterable HERO wreck — its own `/feature-slice`) and the **CAVE rework** (user planning the direction). Both in [backlog.md](backlog.md).

## Verify protocol
`npm run verify:all` (tsc + placement 0/0 ×5 + colliders 0/40). For wreck visuals: the isolated `procgen-wreck` rig (`--archetype=<x> --seed=42 --angles=3q,side --zoom=`) for exterior; the user confirms the into-the-tear/inside angle + all audio/feel. phash-only edits (no new world-rand) or `verify:placement` desyncs.

## Pointers
- `docs/decisions.md` — D264 (panels). The `0.84×` rib root-cause is in the C63 campaign-log + the `wreckedTank`/`huskShell` comments.
- `docs/campaign/campaign-log.md` — the C61-C63 detail.
- Dev server: `npm run dev` (port 5173, or 5180 via the preview).
