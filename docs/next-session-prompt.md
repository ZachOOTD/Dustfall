# Next cycle (4) — the ECONOMY PROPOSAL, then PAUSE (the milestone)

**State:** campaign "Scavenger's Economy (setup)" `active` on `campaign/2026-07-17-economy`
(3 cycles done, ~0.9M/6M spent, max-cycles 16). **This is the LAST cycle before the planned
pause** — `until: milestone:economy-proposal`.

## The fixed queue
1. ~~#28 Skyfall stern seam~~ ✅ (009ccca) · 2. ~~#29 boneyard scatter~~ ✅ (e90344b) ·
3. ~~research swarm~~ ✅ (2c58916) · 4. **economy proposal → PAUSE** ← THIS cycle

## Cycle 4 mission
Per the model-split steering, the MAIN LOOP (Fable) writes this — it's synthesis/planning, do NOT
delegate to an execution agent.

Inputs to read:
- `docs/research/crafting-improvements.md` (the recommended 4-5 material set + recipe patterns).
- The CURRENT code (ground truth): `src/inventory/types.ts` (ItemId union), `src/inventory/items.ts`
  (registration), `src/inventory/recipeDiscovery.ts` (bench-free discovery), and the THREE loot
  systems to be unified (grep: `rollLoot` in lootContainers, `TABLES` in salvage, `COMPONENT_LOOT`).
- Locked decisions (`plan-2026-07-17.md`): bench-free stays; leaner set (~4-5) building on existing
  `scrap`; per-POI loot identity; NO ItemIds baked, NO loot tables changed until approval.

Output: **`docs/campaign/economy-proposal.md`** — decision-ready for a coffee-length read:
1. The proposed material set (4-5 new ItemIds + why each earns its slot; keep `scrap` as the base).
2. A ONE-PAGE drop matrix: rows = POI archetypes + hero landmarks, cols = materials (incl. `scrap`),
   cells = relative weight — the per-POI identity at a glance.
3. Proposed recipes: which existing recipes deepen (multi-material), which new ones arrive; repair
   costs if recommended. Bench-free discovery flow notes (auto-unlock on first collect, per the
   research).
4. The unification plan (3 loot systems → 1 data-driven registry) as pure plumbing, flagged
   loot-preserving.
5. Crafting-UX improvements worth doing (from the research), each S/M sized.
6. OPEN QUESTIONS for Zach, each with a recommended default so approval can be "yes to defaults."
7. A build plan for the approved campaign (ordered cycles, gates per cycle).

Then close out:
- Write `docs/campaign/morning-summary-2026-07-18.md` (what shipped overnight: #28/#29/research/
  proposal; what needs his eyes: boneyard scatter renders, stern seam, the proposal itself; how to
  approve: `/campaign-approve`).
- Set state: `status: "paused"`, `awaiting_approval: true`, `stop_reasons: ["milestone-review"]`,
  cycles_completed 4, current_tier "PAUSED:awaiting-economy-approval".
- Log cycle 4 in campaign-log. Commit everything. **STOP the loop** (ScheduleWakeup stop: true).

## Hard rules
No ItemIds/loot-table changes. No AskUserQuestion (write open questions into the proposal instead).
Push HELD.
