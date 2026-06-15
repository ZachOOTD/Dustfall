# Backlog

Unprioritized work. Tags: `[bug]` broken/wrong · `[feat]` new mechanic · `[polish]` feel/UX/visual · `[debt]` cleanup/refactor · `[idea]` speculative.

When ready to ship one → promote it into a session in [roadmap.md](roadmap.md). Use `/triage-ideas` to bulk-classify a dump.

**Structure:** `## PENDING` (what's left, grouped) → `## PARKED` (needs a design call first) → `## SHIPPED LOG` (condensed archive). Full per-session detail of shipped work lives in [changelog.md](changelog.md) + [decisions.md](decisions.md); the shipped log here is just a scannable index for reversibility.

---

## PENDING

### A. Owed walk-tests + in-motion feel-tunes (need a human in `npm run dev` — the headless harness can't judge feel; the "D150" pile)

- `[bug]` **Recessed Sarlacc-pit walk-test (ACAR2/ACAS).** `__game.ctx.biomes.sarlaccPitAnchor`. Judge the PULL feel (escapable but scary? D202) **combined with the funnel physically funneling you down** — can you CLIMB BACK OUT (walls ~39° < KCC 50° limit; confirm no softlock while pulled), is the crater depth/steepness right (`SARLACC_PIT_CRATER_DEPTH`/`_CLEARING`), does descending read as a dread trap, plus the damage cadence + gape/clench telegraph.
- `[bug]` **Wreck-yard graveyard walk-test (ACAQ).** `wreckYardAnchor`, 620-1000m out: relic findability + value, whether the mottled ashen ground + dense silhouette + circling vultures read ominous, are the big wrecks' (now-registered) panels reachable.
- `[bug]` **Dropped-item settle FEEL (ACAS B2).** Drop pipe_staff/amban_rifle/branch (capsule) + canteen/relic_core (sphere) on flat + slope + the crater — does the capsule/ball lie read more natural than the old box? `__game.dropTestItem('id')` spawns one; tune the bbox-derived half-extents in `pickups.ts` if a body jitters/slides. (Also the older ABM defaults: damping/friction/density.)
- `[bug]` **Mega-wreck interior walk-test re-confirm (ACAL).** Push into bow/flanks/island/engine-bells (exact trimesh collision D189 shouldn't let you through), walk the lee sand-ramp into the fracture, confirm both lee-flank panels are flush + pry-able + journal/shelter register, judge interior brightness (natural-only light D190). Flag residual sub-0.6m floaters with a screenshot.
- `[polish]` **Mega-wreck interior depth + exterior dagger polish (ACAK/ACAL).** If too dark → WIDER openings, not fake lights. Interior debris/floor planes still want contact-AO grounding tints at object-floor seams. Exterior bow is a touch needle-thin; richer mid-span greeble + a downwind debris fan would lift it (`megawreck-critique`).
- `[polish]` **Vulture in-motion feel (ACAI, D150).** Flap cadence (`VULTURE_FLAP_HZ`/`FLAP_AMP`/`WING_EXTEND`), relocate flight arc (`FLEE_SPEED`/`CRUISE_HEIGHT`), landing flare (`LAND_*`), death tumble (`DEATH_SPIN`/`SETTLE_*`), and the carcass-ecology cadence (circle orbit `VULTURE_CIRCLE_*`, swoop `VULTURE_SWOOP_SPEED`/`GRAB_DIST`, hunt `VULTURE_HUNT_*`, carry duration, `VULTURE_CIRCLE_COUNT`).
- `[polish]` **Storm + atmosphere feel-tunes.** In-storm sensory sway amp + audio low-pass cutoff (#134, partial ACW); cloud-shadow strength (`CLOUD_SHADOW_SCALE`/`DARKEN`, ACAH); star twinkle/drift + storm-wall sweep timing in-motion; dynamic aim-twist lead (`AIM_TWIST_TURN_GAIN` 0.18, ACV).
- `[polish]` **Sled mechanics tuning (post-ACD).** Slope-slide speed (`SLED_SLOPE_SLIDE_GAIN` 6.0 — maybe too aggressive steep), static-friction threshold (`SLED_KINETIC_FRICTION` 0.15), collision feel vs wrecks/rocks (currently "stop dead" — wants bounce/thump/slow-ramp), item rest height, sled-to-sled collision (untested), tow-when-blocked-by-cliff.
- `[polish]` **Speeder riding feel (ACX).** In-motion riding feel + exact feet-on-pegs contact (legs splayed astride, feet ~22cm from pegs).
- `[polish]` **3P pass (ABP/ABQ).** 3P camera real-playtest (wreck walls, F-toggles, mount mid-3P; wire `cameraSnapNextFrame` on mount/dismount/save-load so the camera doesn't lerp across teleports); held items in 3P (canteen/machete/scrap_gun/bandage swap+render); walk-cycle ↔ footstep cadence sync (gait fires on a separate timer → footstep can fire mid-air); foot-IK idle→walk-on-slope reset snap (cosmetic); 3P mouse-look orbit-around-player option; ABQ walk-cycle amplitude / pauldron / hood-asymmetry; 3P interact-prompt on-object placement (ACW #149); per-item 3P readability (small/dark items — a `thirdPersonColorBoost` hint?).
- `[polish]` **Small viewmodel nits.** 3P torch flame doesn't animate in the rig-hand copy (FP-only, ACAA); FP held-item night lighting (fixed vm-scene lights → held items don't dim at night, D170).
- `[polish]` **Amban rifle balance** vs scrap_gun/energy_pistol (range 60 / dmg 3 / cd 1.6 / mag 8); acquisition fixed (massive-wreck loot, ACY).

### B. Features not yet built

- `[feat]` **DEEP CAVE SYSTEM → companion egg (Cycle 7).** A genuine underground cave SYSTEM — deep, dark, SPRAWLING with branching passages you could get lost in, reached via a surface descent opening; the companion egg lives deep inside. Substantial procedural-cave build (tunnel/chamber gen below the heightfield + descent opening + dark-nav + lighting), NOT the shallow `rockyEntrance`. **Needs a design pass first** (gen method: cellular-automata / tunnel-carving / hand-authored modules? sub-heightfield collision? torch/dark model?). RECOVERABLE INFRA: the egg-acquisition spine (egg + `'eggs'` interaction + `despawnCompanion` + additive `companionAcquired` save + boot reconcile) is intact in commit `2d4035b` to cherry-pick once the cave exists; gated-acquisition pattern in `shared-memory/save-schema-migration.md` (D158).
- `[feat]` **Raider proc-character body (Cycle 5 remainder).** The pulse rifle (its weapon) shipped ACAC; the raider BODY is still a placeholder. Rebuild it as a full procedural character (the player-rig/vulture/lizard pipeline) so the corpse-drag path + raider combat has a believable body. Needs Cycle 1+2's rig vocabulary (have it).
- `[feat]` **Interactive opening drop-pod cutscene.** Drop-pod descent from orbit through a window view of the desert planet: blinking alarm + parachute-deploy lever in front of the player; player hits the lever repeatedly but it doesn't deploy and snaps off; pod hits the desert + blackout; wake → open pod door → exit to start the game; scrap scattered around the pod wreck to salvage; craft a scrap_bar + pry the first panel off your own pod; that pry triggers a delayed comedic parachute deploy. **Approach:** keep the CC-3 title screen; on NEW GAME, spawn the player inside a NEW small enclosed pod mesh with a pre-baked descent animation (camera fixed inside, window-mesh + skybox + ground-approach on a timeline — NOT a scene-swap); lever/blackout/exit/deploy are in-world interactions on the same scene you then play. The existing W-era opening wreck STAYS as a separate POI near the pod-crash spawn (the previous occupant's larger ship — "someone crashed here before me"). Opening-scene anchor + seed-stability rules (AAI) still apply. (Also tracked loosely as the "ODST drop-pod intro".)
- `[feat]` **Activate the crafting CHOOSER (ACAS B3).** The multi-match chooser UI is built + verified + discovery-respecting, but dormant — no two recipes share an input multiset. Add ONE colliding recipe (same inputs → a different output) for a real player choice. Infra ready (`__registerTestRecipe` shows the shape); a gameplay-design call (D71 ids ≥ 17 + discovery/save balance).
- `[feat]` **Base-building mechanics.**
- `[feat]` **Craftable hover bike** — build from found parts instead of starting with one. (Related: `[feat]` procedural speeder bikes that must be repaired before they're functional.)
- `[feat]` **Lie-down-to-sleep** — camera lerps low to a fixed pose above the bedroll, sleep, wake + stand; replaces the instant-sleep overlay. Needs lie-down/get-up anims (gated on player-rigging progress).
- `[feat]` **Multi-worm population** — N worms per world (save-schema bump `sandWorm|null` → `sandWorms:[]`, per-worm min-separation, early-game playtest). And the sandworm **retreat-and-stalk loop** (deferred ABO — re-enter 'alert' at retreat-end if the player's still close + worm has HP).
- `[feat]` **Rope-attach to the speeder via its rear mount bar** (replaces the mount-while-holding-rope tether-transfer flow). Plus the rope Phase-3 remainder: **RMB-on-rope raycast-pick UX** (cut from ACC — conflicts with the D77 RMB metaphor, needs a design pass).
- `[feat]` **Real rope physics with slack (Cycle 4)** — segmented/Verlet sim instead of the cosmetic catmull-rom sag + inextensible position-snap (ACE `ropeConstraint.ts`); ropes should hang, drag, go taut. Shares a solver with PM-D cloth.
- `[feat]` **Real cloth physics** — Verlet/spring-mass on fabric panels (tent walls, large-tent door, sails, the player tunic/cloak). ~400 LOC. Cheap intermediate: a vertex-shader wind ripple in `fabricMaterial.ts` (~30 LOC, ~80% of the look).
- `[feat]` **Multiplayer server** (gated on the player model; see `shared-memory/multiplayer-mvp-scope.md`) + **character customization** (color/clothing/accessory variants; unblocked once a rigged player model exists).
- `[feat]` **Real PBR texture treatment** — revisit the D107 zero-texture-files policy (UV authoring for programmatic geometry + CC0 PBR + 50-200MB asset budget). Speculative until procedural-shader quality is the bottleneck.
- `[idea]` **Sarlacc pit — "throw items in for a TBD effect"** (minor, unscoped — the hazard itself shipped).
- `[idea]` **Remove HUD stat bars** in favor of audio/visual/text cues ("you could use a drink").
- `[idea]` **Dynamic POI model generation** — procedurally compose unique POI silhouettes per-seed from a parts vocabulary + composition rules, so every wreck looks distinct without hand-modeling. Big architecture lift; would supersede some hand-modeled flagships. Needs design pass. (Partly realized by the procgen-composite fleet already.)

### C. Perf + debt

- `[debt]` **Pickup InstancedMesh (deferred ACAS — attended).** ~340 branch+scrap pickups ≈ 340 draw calls. Each is individually takeable → needs an interaction-raycast (`instanceId`) rework; do it with a human to confirm pickups still take.
✓ **[debt] material-factory → uniforms — SHIPPED ACAT T3 (D207).** All 7 remaining factories (glass/bone/stone/paint/wood/fabric/skin) converted from `.toFixed()`-baked GLSL → uniforms + runtime branches; cache keys dropped (fabric/skin's `pbr` rides the base material class). perf-probe programs 105→67 (−36%), boot shader-compile 270→197ms. Optional stretch left: lift the identical IQ hash/fbm GLSL helpers (duplicated per factory) into one shared snippet.
- `[debt]` **Bury-audit — the RIGHT fix (ACAT T2 deferred, D208).** The 4 fails (≈3% of 133) are procgen `findPanelMount` cases — a panel valid on an ISOLATED part ends up occluded by a sibling once assembled. The fix must be **register-all-then-prune**: let every panel `registerSalvageable` normally (it consumes `rand` — skipping desyncs the procgen world, D208), then a 2nd pass removes panels the assembled wreck occludes (match the audit raycast; `updateWorldMatrix(true,true)` on the wreck root first). `placeProcgenComposite` registration loop + `panelBuryAudit`.
- `[polish]` **W2 flagship/procgen greebles — DEFERRED (ACAT T4).** Architecturally awkward: `addHullGreebles` assumes ±Z cylinder flanks, but the flagships are boxes/lathes (already hand-detailed) + the un-greebled procgen variants (PANELED_TAPERED/OPEN_TRUSS/FUEL_BARRELS) are intentionally distinct. ACAT's W5 brightness pass already delivers W2's intent. Only revisit with custom `addDishGreebles`/`addLatheHullGreebles` if a flagship reads bare.
- ✓ **[polish] W5 brighter-lit procgen pass — SHIPPED ACAT T1.** Hull base color lifted + `_hullMat` streak/AO lowered so the existing greeble/seam detail surfaces.
- `[feat]` **Salvage-panel variations (optional)** — per-panel variable slot counts + a genuinely new panel `kind` with a distinct interior. (Size variants + kind-based layouts already shipped ACY.)
- `[debt]` **Shrew save-restore determinism** (D144) — restore matches shrews by id assuming deterministic same-seed procgen; revisit if shrew scatter becomes non-deterministic.
- `[idea]` **Real procgen breach HOLES** (D197) — `makeBreach` (decal void, no boolean cut) doesn't read as a hole on small intact hulls. Real holes need a built-in hull gap or a lightweight CSG step. Lower priority (the flat dark patch reads fine).
- `[idea]` **Desktop packaging (Electron)** for distribution (Steam/offline), NOT perf. Possible real edge: discrete-GPU selection on dual-GPU laptops + no tab-throttle. See `shared-memory/desktop-packaging.md`.
- `[idea]` **Renderer exploration** — Three's WebGPURenderer (better batching/less driver overhead, works in-browser) is the realistic API-level frame win short of a rewrite; a native-engine rewrite throws away the TS codebase. Re-evaluate when frames are the wall.
- `[note]` **Ongoing perf budget** — re-profile with `perf-probe` (draw calls / scene meshes / programs) + `window.__bootT` as content is added; watch for un-shared shader programs (D175/D177) + per-instance prop meshes.

### D. Optional / deprioritized polish

- **Player model (at its in-pipeline ceiling — see [feature-player-model.md](feature-player-model.md)).** Remaining OPTIONAL: **PM-D** cloth physics (Verlet tunic + possible cloak; shares the Cycle-4 rope solver); **PM-S.3** torso/neck-head skinning (the true junction blend — currently filler-bridged); **PM-E** deeper texture (weathering/dye/leather/normals); **in-game lighting mood for figure solidity** (D142 — the figure reads far more solid under key/rim than the flat bright-desert ambient; lowering ambient / raising contrast changes the WHOLE game's look → an aesthetic decision, surface first; **biggest remaining realism lever for actual play**); **photoreal = a D107 asset fork** (import a rigged+textured humanoid — the only path past "stylized", breaks zero-asset, user's call); sled-on-back when undeployed (design fork).

---

## PARKED (may revisit — needs a design decision first; detail preserved so the call is reversible)

- `[feat]` **Flagship NPC beats** (2026-05-24) — hostile raider holdouts + friendly hermit NPCs at the hand-modeled flagships. ABF shipped narrative journals; this adds live NPCs. Parked: needs an NPC-AI-scope decision (combat? dialogue? trade?) before a ~4-6h session.
- `[feat]` **Salvage durability per-wreck** (2026-05-24) — finite mass across a wreck's panels; deplete → a dimmed "stripped corpse" wreck. Parked: the current infinite-per-panel model + AAT condition tiers don't read as broken; revisit if the salvage economy needs tightening.
- `[feat]` **Rare key-card panels** (2026-05-24) — a panel kind gated behind a found key-card item → high-tier loot. Parked: adds an item type + rarity tier + quest mechanic; too many degrees of design freedom without a clearer goal.
- `[feat]` **Restore corroded panels via weld kit** (2026-05-24) — a weld_kit item upgrades corroded → standard, inverting D96 (deterministic immutable condition) + needs a save-schema bump. Parked: ABT's deterministic condition works well; revisit if corroded panels feel like a tax.
- `[feat]` **Add machete back as wreck loot** (2026-05-24) — the starter loadout swapped machete → scrap_bar (the scrap-bootstrap fix); player starts melee-unarmed + crafts pipe_staff. Could add machete as a small-chance procgen drop. Parked: "start unarmed" is intentional; revisit if early-game reads too hostile.

---

## SHIPPED LOG (condensed index — full per-session detail in [changelog.md](changelog.md) + [decisions.md](decisions.md))

**Player rig & 3P** (ABP→ACK): primitive rig → procedural **SkinnedMesh** limbs (skinnedLimb.ts, D136) → PM silhouette/hood/face/tunic + realism PBR pass (D140-D142) = believable stylized human at the in-pipeline ceiling. Over-shoulder 3P camera + Rapier raycast collision (D112/D116) + dual-mesh held items (D113) + foot IK + 3P held-item hand-attach + machete 3P chop.

**Creatures & ecology**: lizard + **desert shrew** (catch/cook + burrow FSM) + **companion** "Pebble" (proc-character) + **vulture** (rigged + idle/flap/landing/death anims + branch-perch + relocate-and-land FSM + dynamic-body death tumble + carcass ecology: circle/swoop/grab/carry + prey clustering + burrow-escape, D179-D184) + **sandworm** (procgen biome-seeded spawn + noise detection + ambush state + twilight breach + weakness/feeding + shelter-immunity).

**Wrecks / salvage / POIs**: tactile pry + per-component extract + condition tiers (AAR-AAU) + dynamic panel placement (`findPanelMount`, D168) + size/kind variants + greebles + impact asymmetry + half-burial; the `wreckForms.ts` toolkit (D185) + procgen-composite fleet (6 classes + biome bias) + the static-merge perf collapse (`mergeStaticByMaterial`, D192/D198); **mega-wreck** from-scratch listing-dagger + aligned interior + exact trimesh collision + natural light (ACAK-ACAL, D186-D191); flagship merges + panel fixes; themed clusters + biome POIs + journals.

**Wreck-yard biome (Cycle 8, ACAQ-ACAS, D201-D206)**: rare distance-override destination biome + dense graveyard (`wreckYard.ts`) + `relic_core` exclusive loot + vulture ecology + perf merges; **recessed Sarlacc pit** carved into the heightfield (Great Pit of Carkoon, D204); ground oil/ash mottle + lootable big wrecks + denser maw.

**Sled & rope**: sled visual + slope-slide + terrain-tilt + throw-items-on-deck + locker-on-sled (ACA-ACD, D119-D125); rope `RopeEndpoint` vocabulary + craftable stake + corpse/carcass drag + inextensible constraint (ACC-ACF, D126-D132).

**Speeder**: hover bike + dedicated 3P chase cam + seated rig (numeric-IK re-solve, D165-D167) + dust/engine FX + mount look-gate + **static-merge** (ACAS, D205).

**Weather / sky / atmosphere**: day-night cycle + 7-day storm countdown + sweeping storm WALL + in-storm movement penalty + sensory degradation (fog/vignette/sway/audio-muffle); procedural FBM clouds + clear↔overcast + storm telegraph + night stars + cloud shadows + ambient-dust night gate (ACL-ACAB, D145/D171).

**Items & crafting**: all 62 items at hero/decent viewmodels (item-studio harness, ACY-ACZ-ACAS) + cloth-drape/skewer-branch upgrades; **pulse rifle** (auto-fire energy carbine, D172) + amban rifle; combine-to-discover 4-slot crafting + the multi-match chooser (discovery-fixed, ACAS B3); per-item dropped-collider shapes (`colliderHint`, D206); rust/weathering material pass (D173); FP-viewmodel 2nd-pass depth-clear render (D170).

**World gen & core**: procedural 2400m seeded world + biome sampler + flagship rejection-sampler placement + opening-scene seed-stable anchor (AAI-AAK, D82-D85); GameContext spine; save/load v14 (additive-schema discipline, D81).

**Perf & tooling**: static-merge + pickup geometry-merge + `compileAsync` boot prewarm + the `customProgramCacheKey` shader-cache fix (D175/D177); the **rig-shot Playwright harness** + ~25 scenarios (rigStudio/item-studio/panels/perf-probe/procgen-wreck/wreck-yard/speeder-fx/drop-test/craft-chooser/sky/…) + `__game` dev hooks (D134/D138/D149).
