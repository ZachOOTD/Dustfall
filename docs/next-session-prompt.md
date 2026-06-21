# ▶ CAMPAIGN cycle 54 — Kickoff Brief — `campaign/2026-06-18`

**Phase B building unattended (M6→M10). M6 ✓ · M7 ✓ · M8 ✓ · M9 underway (⑪ sled-ride-spike decided C53). Now ⑫ real-rope-physics.**
Boot from `docs/campaign/campaign-state.json` + `docs/roadmap.md` "Up next" (the AUTHORITATIVE queue). The loop commits every cycle and pauses only at
`### Milestone: Phase B — Build-out complete` (after M10). Charter: `docs/campaign/campaign.md`.

## Read these now (in order)
1. `CLAUDE.md` (auto-loaded) — esp. "Where we are now".
2. `docs/campaign/campaign-state.json` + `docs/campaign/steering.md` + `docs/campaign/campaign-log.md` (recent cycles).
3. `docs/roadmap.md` "Up next" → Phase B → **M9 ⑫**.
4. `docs/decisions.md` / `docs/decisions-archive.md` — **D124 (rope CCD — tunnelling; READ IT, it gates the sim design)**, **D126 (the current inextensible position-snap rope constraint)**, D257 (sled-ride, sibling M9 flag), D81 (save-bump STOP).

## Cycle 54 focus — **M9 ⑫ real-rope-physics (behind `FEATURES.realRope`, default OFF)**
Replace the inextensible position-snap rope (D126, `ropeConstraint.ts`) with a real **Verlet/segmented rope sim** — so the rope hangs, drags, and goes
taut believably — gated behind `FEATURES.realRope` (already landed inert in M2). OFF = the proven inextensible path runs unchanged (sled tow / companion
tether / stake / kill-drag); ON = the experimental Verlet sim. **CCD-from-the-start (D124)** — the rope must not tunnel through bodies at speed.

### Priority items (in order)
1. **Recon FIRST.** Read **D124** (why CCD is mandatory — the rope tunnels at speed without it), **D126** (the current `ropeConstraint.ts` inextensible
   snap — its API + every caller: sled tow, companion tether, stake, kill-drag — `grep ropeConstraint` / `FEATURES.realRope`), and the rope VISUAL (how the
   rope line is drawn today). Map exactly what the `realRope` branch must replace + the shared endpoints (the constraint is reused by 4 systems).
2. **Build the Verlet rope sim** behind `if (FEATURES.realRope)` (default OFF): N point-masses + distance constraints (a few relaxation iterations/frame),
   anchored at the two endpoints (the same endpoints the inextensible path uses), gravity + damping; **CCD** so a fast endpoint can't tunnel the rope
   through a body (D124). Drive the rope VISUAL from the simulated points. Keep it deterministic enough not to break verify (the flag is OFF for the gate).
3. **Wire all 4 callers behind the flag** — sled tow / companion tether / stake / kill-drag each select the Verlet sim when `realRope`, else the proven
   inextensible snap. Don't disturb the OFF path.
4. **Verify** — `npm run verify:all` stays green (flag OFF → shipped behavior unchanged; the placement/collider gates don't exercise rope). A flagged-OFF
   sim that compiles + leaves the proven path intact is a valid landing (gate-and-wait — flip + walk-test later).
5. **Visual/feel** — the rope LOOK (hang/drag/taut) + the tow FEEL are best judged live; render a static hang if useful, but the real validation is a
   walk-test (leave `realRope` OFF until then). Don't claim feel from a screenshot.

### CRITICAL — stop conditions
- **D81:** a rope-sim is runtime physics → NO save change. If it somehow needs one, STOP + surface (don't bump).
- **D124 (CCD):** build CCD in from the start — a non-CCD rope that tunnels is a known dead end; don't ship the sim without it.
- **Scope:** this is a load-bearing-system reimplementation behind a flag. If the full 4-caller wiring + CCD can't fit one cycle, ship `[partial]` (e.g.
  the sim + the sled-tow caller this cycle, the other 3 callers next) — keep the OFF path proven throughout.

### After ⑫
⑬ real-cloth-physics (a 2D Verlet grid behind `FEATURES.realCloth`, tent-door/flag only; **depends on ⑫'s solver**) — the LAST M9 unit. **Then a STEERING
PAUSE before M10** (`pause_before: "M10"` in campaign-state, C53 steering): when ⑬ completes (M9 done), the cycle that would start M10 ⑭ must instead
PAUSE (`status: paused`, `awaiting_approval: true`, `stop_reasons: ["steering-pause-before-M10"]`) for the user's M10 review — do NOT start M10; the user
resumes via `/campaign-approve` (which clears `pause_before`). (This is earlier than the Phase-B milestone pause after M10.)

## Autonomy contract
Build behind `FEATURES.realRope` (default OFF) so the proven path is untouched + verify stays green. Ambiguous call → log a D-entry, continue.
**D81 save-bump STOPs the loop.** `[partial]` is fine. Don't flip the flag ON (rope feel is walk-test-gated → the user's review).

## Stop conditions
Terminal: max-cycles (75) · catastrophic verify break · 3 fix-walls on one gate · save-version bump (STOP) · destructive attempt. Pause:
steering "pause" · the Phase-B milestone (after M10 — M9 units don't pause).

## Notable footguns
- **CCD (D124)** is mandatory — design the sim with it, not bolted on.
- **The rope constraint is shared by 4 systems** (sled tow / companion tether / stake / kill-drag) — the `realRope` branch must cover (or `[partial]`-stage) all; the OFF path must stay byte-proven.
- **Gate-and-wait:** `FEATURES.realRope` defaults OFF; verify:all must pass with it OFF (the proven inextensible path runs).
- `verify:placement` buffers output to the END + is slow; don't kill it early.

## Verification protocol
`npm run verify:all` (green with `realRope` OFF). The rope sim's LOOK/FEEL (hang/drag/taut/tow) → walk-test; the cycle's gate is "compiles + OFF path intact".

## Begin
Read the order (esp. **D124 + D126**) → `grep ropeConstraint` + the 4 callers + `FEATURES.realRope` → `TaskCreate` the Verlet rope → build the sim
(CCD-from-start) behind the flag + wire the callers → `verify:all` (flag OFF) → `/session-end`. `[partial]` ok. Boot fresh from FILES.
