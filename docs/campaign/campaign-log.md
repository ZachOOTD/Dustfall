# Campaign log — Dustfall "Sharpen & Deepen" (started 2026-07-09)

Newest cycle at top. Prior campaign (2026-06-18, M1–M13, COMPLETE) archived at
`campaign-log-2026-06-18-cont.md` + `campaign-log-2026-06-18-m1-m13.md`.

---

## Cycle 1 — M1 perf + housekeeping (2026-07-09) — SHIPPED

- **Planned:** M1 (pickup-instancing, decisions-archival, panel-deadcode, crash-heat guard, doc-scrub).
- **Shipped:**
  - Pickup instancing (D281): branch/scrap → shared InstancedMesh pools; `instanceId→pickupId` raycast resolver; swap-with-last slot frees + index fixup; overflow fallback; seeded rand order preserved. drawCalls 852→817 at the probe cam (worst-case dense-view flattened; +70K always-drawn tris accepted). NEW permanent gate `pickup-take-sweep` (6 real E-takes end-to-end incl. the swap-fixup case + id↔slot bijection invariant).
  - decisions.md archival D221–D235 (280=280 conserved) · panel dead-code sweep (backlog stale — mostly pre-shipped; deleted `clearPanelDebris`) · `survivalProbe` crash-heat guard · endgame-finale candidates scrubbed from CLAUDE.md/roadmap/next-session-prompt.
- **Discovery (feature-audit):** M2 "survival curve" was ALREADY BUILT + probe-pinned (C38/D246: heat 7.54 / cold 8.67 / thirst 10 / hunger 15 min; prepared heals; death UI) — the planning input was stale. M2 → verify-only, re-run green this cycle. M3's sun-shade half also pre-shipped (C31) → M3 re-scoped to the occluder-threshold decouple + water-scarcity.
- **Verify:** `verify:all` PASS (tsc + placement + colliders 40-audits) · `smoke-intro` {ok,beats:12} · `smoke-pod-tutorial` ok · `pickup-take-sweep` PASS · `survival-probe` PASS (guard active).
- **Visual iteration:** N/A — pure perf/debt cycle (appearance unchanged by construction; instance positions proven by the take-sweep gate).
- **Spend:** ~600K est. (campaign total ~600K / 10M; cycle 1/50). The take-sweep harness burned ~5 diagnostic rounds (stale-body, 3P boot, settle-drift) — lessons embedded in the gate + D281.
- **Commit:** (this cycle's commit — SHA in git log)
- **Next:** cycle 2 → M3 survival depth: (a) C31 sun-occluder decouple + occluder coverage, (b) water-scarcity/exposure.

## Cycle 0 — campaign started (2026-07-09)

- **Goal:** sharpen/deepen the existing game — no new pillars, no tone change, no endgame.
- **Budget:** max-cycles 50 (hard stop) · ~10M output-token soft ceiling.
- **Checkpoint:** `none`, with two sanctioned pauses (Skyfall pre-detail `[feel-critical]`; any SAVE_VERSION bump).
- **Verify gate:** `npm run verify:all` + `smoke-intro`/`smoke-pod-tutorial` + adversarial visual gate on visual cycles.
- **Ladder:** M1 perf/housekeeping → M2 survival-curve (flagged) → M3 survival-depth → M4 ambient beds → M5 diurnal-cycle → M6 POI archetypes → M7 Skyfall `[feel-critical]`.
- **Excluded:** the Phase-A feel-pile (attended sessions).
- **Setup done:** session-end docs committed to `master` (`873d310`, tagged `session-ACN`); guard hook installed + behaviorally confirmed (blocks `rm -rf`/`reset --hard`/force-push under `overnight.lock`); `campaign/2026-07-09` branch created; old 2026-06-18 campaign state archived; `.gamedev-framework/overnight.lock` set.
- **Next:** cycle 1 builds M1.
