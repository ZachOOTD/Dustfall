# Next cycle (1) — #28 Skyfall stern seam

**State:** campaign "Scavenger's Economy (setup)" `active` on `campaign/2026-07-17-economy`
(0 cycles, 0/6M spent, max-cycles 16). Checkpoint = pause at the economy proposal.
Self-author = none. **Plan of record: `docs/campaign/plan-2026-07-17.md` — do NOT re-plan.**

## The fixed queue (in order)
1. **#28 Skyfall stern seam** ← THIS cycle
2. #29 Boneyard scatter overhaul (hero visual)
3. Research swarm (4 digests)
4. Economy proposal → PAUSE

## Cycle 1 mission — #28 Skyfall stern seam
**Symptom (Zach's playtest):** "the smaller side that's broken off … a slight gap, like a crack
between the edges of the walls where the ship splits. just need to connect the seam."

**Diagnosis of record (from `STATE-2026-07-16.md`):** this is almost certainly the SHARED
`solidInner` lip weld in `src/world/wreckForms.ts`, not a stern-only defect — the fore mouth +
the leviathan use the same `makeLoftedHull(..., solidInner)` path and hide it. So fix it at the
SOURCE in `wreckForms.ts` (the rim-lip weld / bridge bands), and confirm the fore mouth + leviathan
seams stay clean after. Do NOT hand-patch the stern.

**Watch out:** no existing gate catches inter-mesh sliver gaps — `open-end` is per-mesh topology,
so two closed solids with daylight between them both pass. If cheap, add a daylight-leak / seam
check to `verify:solid` (a ray fired across the fracture rim from just outside should hit hull, not
sky) so this class stops recurring. If not cheap this cycle, log it as a follow-up — don't block.

**Gates:** `npm run verify` → `verify:all` → `verify:solid --asset=skyfall` (+ leviathan, to prove
the shared weld didn't regress) → `chunk` gate's `skyfall-walk`. Screenshot the stern fracture from
a grazing angle to confirm the crack is gone (rule 8 — don't ship geometry on tsc alone).

**Commit** to `campaign/2026-07-17-economy`. Push HELD.

## Hard rules
Never `git stash` here · one agent at a time (research swarm excepted) · no AskUserQuestion
overnight (decisions are locked in the plan doc) · trust the playtest over a green gate.
