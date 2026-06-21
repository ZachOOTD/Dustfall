# ▶ CAMPAIGN cycle 60 — Kickoff Brief — `campaign/2026-06-18`

**RESUMED into a Phase-B review-fix pass (M11→M13).** The Phase-B milestone review happened (2026-06-20): the user gave feedback → triaged → chose "campaign for the bounded fixes; Skyfall hero wreck + cave rework are DEDICATED solo sessions (NOT the loop)." Now grinding the fixes.
Boot from `docs/campaign/campaign-state.json` + `docs/roadmap.md` (the "Phase-B review-fix pass" block). The loop commits every cycle. Charter: `docs/campaign/campaign.md`.

## Read these now (in order)
1. `CLAUDE.md` (auto-loaded) — "Where we are now".
2. `docs/campaign/campaign-state.json` + `docs/campaign/steering.md` + `docs/campaign/campaign-log.md` (the C59 pause + the 2026-06-20 resume).
3. `docs/backlog.md` — the **"Fresh triage (2026-06-20 — Phase-B review dump)"** block at the bottom = the source of these fixes (the verbatim user feedback).
4. For M11: `src/world/poiAssembler.ts` (`placeProcgenPOI`, panel registration), `src/world/panelPlacement.ts` (`findSurfaceMounts`/`validatePanels`/`pruneBuriedPanels`), `src/player/interaction.ts` (the `salvageables` case — what makes a panel openable), + `src/world/poiArchetypes.ts`/`poiComponents.ts` (the `wrecked_tank` assembly).

## The review-fix pass (M11→M13) — pause after M13
- **M11 — wreck/panel fixes (THIS tier, ~the next few cycles):** ⓐ procgen-wreck access panels **not openable** · ⓑ procgen-wreck panels **floating** · ⓒ `wrecked_tank` interior **ribbing floats** · ⓓ `wrecked_tank` reads **disconnected/floating → structural** · ⓔ `wrecked_tank` access **panel floats/unconnected**.
- **M12 — sand worm:** ⓕ remove dorsal ridges · ⓖ attack: remove the high jump → charge-straight then dive from current pos · ⓗ alert audio → quiet rumble + screen-shake buildup.
- **M13 — weapon & vehicle audio:** ⓘ gunshot + reload SFX (all guns) · ⓙ speeder engine → lower/smoother hum.
- After M13 → **PAUSE** at the "Phase-B review fixes complete" milestone (`checkpoint: milestone`).

## Cycle 60 focus — **M11 ⓐ + ⓑ (do them together — same root): procgen-wreck panels not-openable + floating**
These are almost certainly the SAME placement/registration path on the socket-grammar archetypes (derelict / satellite / tank_cluster / enterable_wreck), so fix them in one pass.

### Priority items (in order)
1. **Recon FIRST — reproduce + locate.** Which archetypes have the broken panels? Spawn each via the rig (`spawnProcgenWreckRig` / the POI rig) + check: (a) do the access panels register as salvageable (`registerSalvageable` / the `salvageables` registry — "not openable" = the panel exists visually but isn't in the registry, or its pry collider/`pickupId`-equiv isn't hit)? (b) are they seated FLUSH on the hull (`findSurfaceMounts` flush-quaternion) or floating off it? The existing `verify:placement` bury-audit + `verify:colliders` cover SOME of this — check whether the new archetypes are even IN those audits.
2. **Not-openable (ⓐ).** Trace the salvage path: a panel is openable iff it's registered + the `salvageables` interaction resolves it + a pry tool is held (scrap_bar/scrap_machete, C57). Likely the socket-grammar panels aren't being `registerSalvageable`'d (the legacy `placeWreck`/flagship path registers; the new `placeProcgenPOI` may not). Wire registration for the archetype panels.
3. **Floating (ⓑ).** The panel mount on the new archetypes sits off-surface — fix the `findSurfaceMounts` flush-seat (full-quaternion + inward offset) for the socket-component hull shapes, OR the component's panel socket is mis-placed. Render to confirm flush.
4. **Verify** — `npm run verify:all` (the placement + collider audits are directly relevant; if the new archetypes aren't audited, consider extending the audit so this can't regress — that's the D235 contract). Render the fixed archetypes (panels flush + the pry-glow). A probe that the panels are registered + openable.
5. **Scope** — if ⓐ+ⓑ across all archetypes is too big for one cycle, fix the worst archetype(s) `[partial]` + continue; log which remain.

### CRITICAL — stop conditions
- **D81:** these are geometry/registration fixes — almost certainly NO save change. If one appears, STOP + surface (never bump SAVE_VERSION).
- **Determinism:** the socket grammar is `phash`-driven (one `seedOf` draw, D226); any change to panel placement/registration must NOT add world-rand draws (it desyncs the salvage stream). Reuse the existing rolled values.
- **Don't touch the Skyfall wreck or the cave** — those are the user's dedicated sessions (not the loop).

## Notable footguns
- **"Openable" = registered + interaction-resolvable + pry-tool-gated** — a visible panel that isn't `registerSalvageable`'d looks fine but won't open.
- **Flush seat** = full-quaternion mount + inward offset (the `findSurfaceMounts` path); a fixed-Y or wrong-normal mount floats.
- **The collider/placement audits** are the regression guard — extend them to the new archetypes if they're not covered (D235).
- `verify:placement` buffers output to the END + is slow; don't kill it early.
- Determinism: NO new world-rand draws (phash only).

## Verification protocol
`npm run verify:all` (placement + colliders) + a render of the fixed archetypes (panels flush + pry-glow) + an eval/probe that the panels register + resolve as salvageable. Pry FEEL → walk-test (flag for the post-M13 review).

## Begin
Read the order → reproduce the not-openable + floating panels per archetype (rig spawn) → trace registration + the flush-mount → fix ⓐ+ⓑ (no new rand; extend the audit) → `verify:all` + render → `/session-end`. `[partial]` ok. Boot fresh from FILES.
