# ▶ RESUME — M12 sand-worm fixes (M11 complete) — `campaign/2026-06-18`

**Picking up where C64 left off.** The campaign is ACTIVE in the **Phase-B review-fix pass (M11→M13)**. **M11 is COMPLETE + user-validated** (wreck/panel fixes walk-tested "looks ok for now" 2026-06-21; the straggler panels closed in C64). Next tier: **M12 sand-worm**. Boot from `docs/campaign/campaign-state.json` + `docs/roadmap.md` (NOT chat memory).

## Read these now (in order)
1. `CLAUDE.md` (auto-loaded) — "Where we are now"
2. `docs/campaign/campaign-state.json` — cycle count (64/75), status, current_tier, the framework-upgrade directives in `resume_note`
3. `docs/campaign/campaign-log.md` (tail) — C64 detail
4. `docs/decisions.md` (tail) — D265 (straggler fix)
5. `docs/roadmap.md` — the M11→M13 block (line ~178)

## What's already built
A deep procedural desert-survival game. The sand worm already exists and is heavily built (C12-C18): model + maw fangs + dorsal armor crest, `applyBodyBend` pose (tail-sink, charge-dive submerge), a Web-Audio approach rumble, multi-worm population (`ctx.sandWorms`), and the `worm_lure` bait. M12 is a FEEL/look REVISION of that worm per the user's 2026-06-20 review — not a rebuild.

## Cycle 65 focus — M12 sand worm (3 units, all from the user's triage)
Per the user: the worm's current attack reads as a silly "high jump"; the dorsal ridges are unwanted; the alert should be mysterious dread, not a loud tell. **This is hero-creature work** → per the framework upgrade, **delegate the modeling/pose changes to the `procedural-modeler` agent** and **render the PLAYER'S REAL in-game view** (the worm surfacing/charging in the actual scene at the distance/angle a player sees), NOT an isolated rig. Iterate to a quality BAR (5-8 rounds for hero); do NOT ship a scaffold and defer the defining motion (anti-punt).

Priority items (verify each against the real in-game view + `npm run verify:all`):
1. **ⓕ Remove the dorsal ridges** [polish] — strip the C13 dorsal-armor crest/ridges from the worm model. Find the worm model builder (grep `dorsal`, `worm-model`, `applyBodyBend`; likely `src/**/sandWorm*.ts` + the `worm-model` rig scenario). Keep the maw + body silhouette; just remove the spiky dorsal crest. Determinism: the worm is a creature, not a placement/collider POI — tsc is the relevant gate, but re-run `verify:all`.
2. **ⓖ Attack = charge-straight then DIVE from current position, NO airborne jump** [polish] — find the worm attack FSM (grep the charge/lunge/jump states). Replace the high-arc jump with: charge along the surface toward the player, then dive down from where it is (a downward plunge, not a launch up-and-over). This is the FEEL-critical unit → the user walk-tests it. Build it to completion; don't leave the jump in behind a flag.
3. **ⓗ Alert audio → a low, quiet rumble + screen-shake buildup** [polish] — the alert should be mysterious ("you don't know what it is"), not a loud growl/roar. Find the worm alert/approach audio (the C16 `worm-audio-rumble` Web-Audio synth) + any screen-shake. Make the tell a subtle sub-bass rumble that builds + a gentle camera shake. AUDIO can't be self-verified → the user LISTENS at the M12 batch pause.

## Stop / pause condition
M12 is a milestone with a pause marker after it (`### Milestone: M12 sand-worm — USER BATCH-VALIDATE`). When all 3 units ship, the cycle that completes M12 **PAUSES** (`awaiting_approval`, `milestone-review`) for the user's worm-attack-FEEL walk-test + alert-rumble LISTEN. Then `/campaign-approve` → M13 audio. **Headroom: 64/75 cycles (~11 left).** If M12+M13 need more than the cap, STOP at 75 and tell the user to `/campaign-start --resume --max-cycles=N`.

## Autonomy contract
Autonomous fixes; when a call is ambiguous, pick the realism-forward option, log a D-entry, and continue — don't ask. Pause ONLY at the per-tier milestone markers (feel/audio can't be self-verified). The visual/look units (ⓕ, the dive pose) self-verify via the real-in-game-view adversarial gate; the FEEL (attack timing) + AUDIO (ⓗ) verify at the user pause.

## NOT in the loop (dedicated solo sessions)
The **Skyfall crashed-ship** (new researched hero wreck + its fire-from-wreck fix) and the **CAVE rework** — both `docs/backlog.md` §A. Do NOT start them in the loop.

## Notable footguns
- **Worm = creature, not a placement POI** → `verify:placement`/`verify:colliders` won't exercise it; tsc + the real-view render + the FEEL walk-test are the gates.
- **Real-view over rig** (the C60/C63 lesson + the `verify-visual-multi-angle` memory): the isolated rig grades a different scene than ships. Drive the game's own camera at the surfacing/charging worm. The heavy-scene SCREENSHOT can flake (`dustfall_preview_gotchas`) — prefer a numeric/eval check where possible + a framed shot when the scene is light enough.
- **Determinism:** if any worm change touches the world `rand` stream, it'll desync `verify:placement`. The worm runtime is decoupled from world-gen, so this is unlikely, but keep model/pose/audio edits out of the seeded scatter path.
- **No save bump** unless a schema change is unavoidable (D81 — a `SAVE_VERSION` bump STOPS the loop; never bump autonomously).

## Verify protocol
`npm run verify:all` (tsc + placement 0/0 ×5 + colliders 0/40). For the worm LOOK: the real in-game view via the live preview (port 5180) — render the surfacing/charging worm at player distance, multiple angles. The user confirms the attack FEEL + the alert audio.
