# Steering archive — Dustfall campaign

Processed steering directives, dated, with the action taken. Moved here by the
loop at the cycle boundary so they're not re-applied each cycle.

---

## 2026-06-29 (Phase 2 milestone WALK-TEST feedback, via the Netlify preview link) — descent-feel fixes + forward reqs

The user walk-tested the descent (Phase 2) via the deployed preview and gave 5 notes:
1. **Screen shake too much + too early.** Wants it PEACEFUL while still far/high (orbit); shake ONLY when going through the atmosphere (re-entry); and gentler. → **FIXED (post-C17):** removed the constant descent base-rumble (`addTrauma(0.04+re*0.45)` → `addTrauma(re*0.18)` — re-entry-only + gentle), softened the eject kick (0.95→0.55) + the tumble buffet (`0.05+settle*0.30` → `settle*0.12`).
2. **Exterior pod model should match the INTERIOR's size** for consistency. → captured as a roadmap **Phase 4** req (the exterior `placeCrashedPodWreck` must match the cabin CAB_R/WALL_H — same vessel inside vs out).
3. **Player teleports outside the pod on landing — wants to START in the pod (in the desert) + RELEASE the door to walk out** (the vision's "blow the pod door"). → captured as a roadmap **Phase 4 T4.1** req (rework the greybox `stepOut`: wake INSIDE the pod, the BLOW-DOOR is the player-triggered step-out).
4. **Weird purple lines across the landscape** (the dunes) when nearing the surface. → **FIXED (post-C17):** the dune lee-shadow trough colour was a saturated blue-violet (`vec3(0.28,0.26,0.44)`) reading as purple lines; desaturated to a cool dusty shadow (`vec3(0.33,0.27,0.31)`).
5. **Interior pod detail/improvement pass** — acknowledged as LATER ("decent first model for now"). → backlog.

**Action:** #1 + #4 fixed immediately (descent-feel, this pass) + pushed so the preview link refreshes for a re-test; #2 + #3 captured as Phase 4 reqs in the roadmap; #5 to backlog. Campaign stays paused at the Phase 2 milestone (the user re-tests the shake/dunes, then `/campaign-approve` → Phase 3).

**ROUND 2 (same day, after re-test):** the user: "the shake is still way too much. i also want to try WITHOUT the pod tumbling — keep the pod UPRIGHT and have it more slowly descend through the phases, more SEAMLESS: watch the planet get closer, fall through the atmosphere, see space transition to sky, the ground slowly approaching." → **REVERSED T2.3's tumble (a design change, like the box→cylindrical pod):** removed the camera tumble entirely (the pod stays upright + level facing the window; `shipExplode` is now just a brief blast flash + a fading cabin glow, NO scripted tumble, mode='seated'); the controller's `applyIntroTumble` is left as an unused guarded no-op (in case a SUBTLE version is wanted later). **Slowed the descent** `DESCENT_DURATION` 8→18s + `SHIP_EXPLODE_DWELL` 4→2.2s for a slow, seamless fall. **Shake cut to a whisper** (`re*0.18`→`re*0.05`, eject kick `0.55`→`0.18`). The descentProgress vista already does space→sky→ground (orbital planet+stars → cross-fade → dawn sky + dune ground); the slower pace lets it read seamlessly. tsc + smoke `{ok:true,beats:10}` clean. Pushed for re-test. (The user is experimenting — "i want to TRY without the tumbling" — so this is a tried direction, not necessarily final; T2.3's tumble code is preserved as a no-op.)

---

## 2026-06-29 (received during cycle 17, the Phase 2 milestone) — A pushed campaign branch + a playable preview link to walk-test each cycle

**Directive:**
> "want to set up a separate branch on github that we can commit to after each cycle that i can create a playable link for and go test it as we continue developing."

**Action taken:** surfaced at the Phase 2 milestone pause (the campaign was already pausing for the walk-test). The campaign already commits each cycle to the `campaign/escape-pod-intro` branch locally; the new ask is to PUSH it to GitHub + deploy a playable preview link (so the in-progress escape-pod intro can be walk-tested via a URL, with `FEATURES.escapePodIntro` ON in that preview build — separate from the live master deploy). Investigated the existing deploy mechanism + proposed a concrete plan to the user at the pause; pushing/deploy is outward-facing so it's confirmed with the user before executing (NOT done unilaterally). Once set up, each cycle's push refreshes the preview link. See the C17 milestone-pause handoff + next-session-prompt.

---

## 2026-06-20 (applied at cycle 44) — Remove the watchtower; POIs must read as long-decayed, no signs of living human life

**Directive:**
> "don't like the watchtower, lets remove the watchtower. the watchtower is too much of a sign of infrastructure, everything in the world should be a wreck/decayed for a hundred years, a watchower still standing reads as recent and that people could be close by which is not what i want, i want the player to feel alone and have almost no signs of living human life, this goes for pois as well."

**Action taken (cycle 44, the "solitude pass"):**
- Removed the `watchtower` archetype entirely (component + assembler + `ARCH_WEIGHTS` + collider-audit list).
- Re-scoped the `well` into a long-dry collapsed ruin (no bucket/rope/working crank) — kept but de-peopled (user-confirmed scope: option 2 + the well treated per option 3).
- Codified the principle as a standing constraint: [decisions.md](../decisions.md) D252 + [vision-deltas.md](../vision-deltas.md).
- Older wreck POIs (satellite, wrecked_tank, debris_field, husks, derelict, debris_trail) already read as decayed — left untouched per the confirmed scope.

## 2026-06-20 (received during cycle 53; applied) — Pause before starting M10 for a user review

**Directive:**
> "lets pause before starting M10 so I can review and plan accordingly"

**Action taken (recorded C53):** added a **PAUSE-FOR-USER-REVIEW gate at the M9→M10 boundary**. M9 continues unattended (⑫ real-rope-physics · ⑬ real-cloth-physics — they're M9, not M10); when M9 completes, the cycle that WOULD start M10 ⑭ instead PAUSES (`status: paused`, `awaiting_approval: true`, `stop_reasons: ["steering-pause-before-M10"]`) so the user reviews + plans M10 (the final tier) before it begins. Recorded in `campaign-state.json` (`pause_before: "M10"`) + a ⏸ marker in `roadmap.md` before the M10 line + the ⑫/⑬ next-session-prompts carry the reminder. (The campaign's other pause — the Phase-B milestone after M10 — is unchanged; this adds an earlier user-requested gate.)

## 2026-06-20 (received at the M9→M10 pause; applied) — Resume into M10, but defer the drop-pod intro + hold Phase-A/B feedback

**Directive (verbatim):**
> "ok lets continue with the campaign loop cycle. just want to hold off on doing the drop pod start sequence as that is a big feature that i want to tackle later in more detail. there's lots of feedback to give on phase A and B but want to wait till we run through the remaining before we tackle"

**Context:** the C53 `pause_before:M10` gate fired cleanly at C56 (M9 complete). The user started the dev server + walk-tested, then resumed.

**Actions taken (recorded at the C56→C57 boundary):**
1. **Approved + cleared the gate** — `status: active`, `awaiting_approval: false`, `stop_reasons: []`, `pause_before: null`. The loop resumes into M10.
2. **Deferred ⑯ drop-pod-intro-cutscene** — removed from the M10 autonomous tier (M10 = ⑭ machete + ⑮ hover-bike + ⑰ pickup-instancing only); moved to `backlog.md` §A as a HELD feature to be designed in detail later via its own `/feature-slice`. Marked DEFERRED on the roadmap M10 line.
3. **Phase-A/B feedback deferred to the post-M10 gate** — the user is holding all Phase-A/B feedback until M10 ships. Noted on the "Phase B — Build-out complete" milestone in `roadmap.md` so that pause is framed as the big feedback + walk-test session.
