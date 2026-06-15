# Session ACAW — Kickoff Brief (continue the salvage-panel overhaul — the VISUAL half)

## Read these now (in order)
1. `CLAUDE.md` (auto-loaded) — "Where we are now" (ACAV: panel placement half shipped).
2. **`.claude/plans/ok-next-i-want-ticklish-lampson.md`** — the FULL 6-tier panel-overhaul plan (Tiers 0-2 done; 3-5 remain). This is the spec.
3. `docs/session-end-report.md` — cumulative state (ACAV at top).
4. `docs/decisions.md` tail — D211 (dropped-item revert), D212 (surface-scoped terrain cull), D213 (shape-agnostic sampler).
5. `docs/backlog.md` — the panel-overhaul visual-half item + owed walk-tests.

## What's already built (ACAV — the placement half)
Salvage panels now: read the REAL hull surface via `findSurfaceMounts` (bounding-sphere rays + a full quaternion → flush on
any shape, `world/panelPlacement.ts`), get terrain-culled if a surface panel sits below the sand (center-clearance, SURFACE-
scoped — interiors exempt), and route ALL bury/terrain checks through ONE `validatePanels`. `addAccessPanel` orients from an
optional quaternion; `addAccessPanelOriented` wraps it. Occlusion audit 0 fails, boot 964ms, programs 67. The interior is
still the old fixed 5-component palette; shapes are still rectangle-only.

## Session ACAW focus — the VISUAL half (Tiers 3-5). Locked decisions from the user: keep **5 lootable** components + rich
**decorative greeble** (merged, not lootable); circular panels use a **bolted lift-off cover**; build **all 5 archetypes,
deeply iterated**. RULE 8 governs: build → `panel-studio` screenshot → critique → iterate, 5-8 rounds per new element.

## Priority items (in order)
1. **Tier 3 — shape + size variants.** Add `AccessPanelOpts {shape, aspect, archetype}` to `addAccessPanel` (absent = today's
   rect, zero rand → regression baseline). `square` = rect with aspect 1; **circle** = `buildCircleBody` (cylinder bore + bolted
   torus ring rim + a lift-off cover disc on a `coverPivot` NAMED `body.userData.panelDoor` so the audit/prune door-exclusion +
   `completePry` drive it unchanged); `updatePanelDoors` (`interaction.ts`) branches on `panelShape==='circle'` → slide+tumble
   the cover via the existing `panelDoorAngle/Target`. Behind `SALVAGE_PANEL_SHAPES_ENABLED`. Files: `wrecks.ts`,
   `interaction.ts`, `procgenWreck.ts` (derive shape from already-rolled values — zero new world-rand), `tuning.ts`.
   **Gate:** `panel-studio` rect/square/circle × open/closed visual 5-8 rounds (no paper-thin edges — circle rim is a thick
   torus); occlusion audit STILL 0 (validatePanels reads the panel's real geometry half-extents, so it honours shapes).
2. **Tier 4 — the interior overhaul (all 5 archetypes, deeply iterated).** NEW `world/panelGreeble.ts` component library
   (coiled wire, fuse bank, PCB+chips, gauge, valve wheel, conduit elbow, terminal block, frayed wires, cracked screen,
   emissive indicator). NEW `populateInterior(archetype, shape, dims, rand)` → backplate + a MERGED `greebleGroup` (8-16
   decorative pieces; `mergeStaticByMaterial(greebleGroup)` BEFORE parenting under `body`) + the **5 tagged extractables**
   (reuse the 7 existing `PanelComponentKind`s → `COMPONENT_LOOT` + loot economy unchanged → NO save bump). 5 archetypes
   (electrical/plumbing/avionics/mechanical/junction) map to an extractable palette + a greeble recipe + shape/size. Depth-
   layered (3 Z-bands); position-seeded greeble Rng (zero world-rand). Emissive indicator (NOT a PointLight — ABL perf). Behind
   `SALVAGE_PANEL_INTERIOR_V2`. **Parallelize** archetype/component authoring across subagents (`/parallel-implement`), then a
   unified `panel-studio` shoot. **Gate:** `/visual-triage` per archetype 5-8 rounds (scrappy/rustic, ≥3 material reads, depth-
   layered, glow-lit, cleanly visible at `--angle=eye`); perf-probe STILL 67 (reuse the material factories + `shaderNoise.ts`,
   no new programs); occlusion audit STILL 0; **attended pry-FEEL walk-test owed**.
3. **Tier 5 — verification hardening + scalability gate.** NEW `placement-torture` (loop `spawnProcgenWreckRig(cls,seed)` over
   all classes × seeds + a synthetic torture fixture) + `flagship-audit` (each hand-modeled flagship) + `npm run verify:placement`
   + a SURFACE-scoped terrain audit + the contract doc ("any new wreck class must pass `verify:placement`"). Also build the
   `panel-studio` rig-shot scenario + `__game.spawnPanelStudio(...)` hook (needed by Tiers 3-4). Optional: the save R4 fix
   (hide already-extracted component meshes on load) + a SAVE_VERSION 14→15 marker; verify the ≤v13 load-guard mismatch.

## Build first (blocks Tiers 3-4): the `panel-studio` harness
`__game.spawnPanelStudio({shape, archetype, scale, open, angle})` (clone `itemStudio`'s lit-for-form rig, deterministic
`makeRng(1337)`, suspend the panel high for a sky backdrop) + a `panel-studio` rig-shot scenario (`--shape --archetype --state
--angle`, + a sweep mode). This is the screenshot loop the visual gates depend on.

## Stretch goals
- Strip the now-dead `colliderHint` field + tags (`types.ts`/`items.ts`) — D211 left them harmless.
- Retire the dead `SALVAGE_PANEL_SAMPLE_GRID_*`/`FACE_INSET` tuning (old findPanelMount).
- The owed human walk-tests (Sarlacc pull-feel + climb-out, graveyard read, mega-wreck interior) — none done yet.
- Session-end-report dedup (it still has duplicate ACAC/ACAB/ACAA/ACM scope blocks).

## Autonomy contract
Tiers 3-4 are VISUAL → rule 8 (5-8 screenshot rounds/element; never mark done on tsc alone; never >150 LOC visual code without a
shot). Pry FEEL is attended-only (headless can't judge). Ambiguous → GDD pillars + realism dial, append a D-entry, continue.

## Stop conditions
3 fix-walls on one element (log + move on / cut) · a SAVE_VERSION bump turning out necessary (surface it) · destructive-git ·
a shape/cover that can't be made flush+thick after iteration (cut circular, ship square).

## Notable footguns (this arc)
- **RNG budget (D208/D213):** the sampler + any new per-panel roll must consume a FIXED `rand` count; derive shape/archetype
  from ALREADY-rolled values, seed greeble from world-position — never add a world-rand draw (regenerates the world).
- **Terrain cull is SURFACE-scoped (D212):** never terrain-cull interior panels (mega-wreck/rockyEntrance/flagship bells).
- **Door/cover sign (D196/ACP):** the circle lift-off cover + door-swing must reuse the SAME `−panelDoorAngle` hinge math as
  `updatePanelDoors`; name the cover pivot `panelDoor` so audit/prune exclusion + `completePry` apply.
- **Merge before parent:** `mergeStaticByMaterial` SKIPS `accessPanel` subtrees, so merge the `greebleGroup` BEFORE parenting it
  under `body`; emissive/transparent greeble won't merge (fine).
- **Windows rig-shot** pins `dustfall.pendingSeed`=1337; boots its own vite on `--port`; the post-scenario teardown can exit
  non-zero AFTER the assertion line prints — read the captured stdout, not the exit code.

## Verification protocol
`npm run verify` (tsc) clean. Headless: `panels` (occlusion audit — stays 0), `perf-probe` (programs stays 67, boot sane),
`procgen-wreck`, NEW `panel-studio` (visual), eventually `verify:placement`. Visual tiers → `/visual-triage` 5-8 rounds.

## On stop
Run `/session-end` (verify → changelog → CLAUDE last-shipped → roadmap → D-entries → backlog → report → next-prompt →
post-mortem → commit + tag `session-ACAW` + push).
