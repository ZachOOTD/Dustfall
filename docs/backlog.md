# Backlog

Unprioritized work. Tags: `[bug]` broken/wrong · `[feat]` new mechanic · `[polish]` feel/UX/visual · `[debt]` cleanup/refactor · `[idea]` speculative.

When ready to ship one → promote it into a session in [roadmap.md](roadmap.md). Use `/triage-ideas` to bulk-classify a dump.

**Structure:** `## PENDING` (what's left, grouped) → `## PARKED` (needs a design call first) → `## SHIPPED LOG` (condensed archive). Full per-session detail of shipped work lives in [changelog.md](changelog.md) + [decisions.md](decisions.md); the shipped log here is just a scannable index for reversibility.

---

## PENDING

### A. Owed walk-tests + in-motion feel-tunes (need a human in `npm run dev` — the headless harness can't judge feel; the "D150" pile)

- `[bug]` **Recessed Sarlacc-pit walk-test (ACAR2/ACAS).** `__game.ctx.biomes.sarlaccPitAnchor`. Judge the PULL feel (escapable but scary? D202) **combined with the funnel physically funneling you down** — can you CLIMB BACK OUT (walls ~39° < KCC 50° limit; confirm no softlock while pulled), is the crater depth/steepness right (`SARLACC_PIT_CRATER_DEPTH`/`_CLEARING`), does descending read as a dread trap, plus the damage cadence + gape/clench telegraph.
- `[bug]` **Wreck-yard graveyard walk-test (ACAQ).** `wreckYardAnchor`, 620-1000m out: relic findability + value, whether the mottled ashen ground + dense silhouette + circling vultures read ominous, are the big wrecks' (now-registered) panels reachable.
- ✓ **[bug] Dropped-item settle FEEL — RESOLVED ACAV (D211, reverts D206).** User walk-tested ACAS B2's capsule/sphere `colliderHint` shapes and disliked them (rolled + spun + thin capsules tunnelled); reverted to the original cuboid for all dropped items. (`def.colliderHint` field now dead but harmless — could be stripped in a cleanup.)
- ✓ **[debt] Salvage-panel overhaul — placement + interior/exterior REALISM COMPLETE (ACAV/ACAW placement+shapes; ACAX interior/exterior realism).** All shipped: unified `validatePanels`, surface terrain cull, flush `findSurfaceMounts`, square+circular shapes, the realism-first DIN-rail BREAKER-BOARD interior (`panelGreeble.ts` `makeBreakerBoard`/`makeBreaker`), the stencil PORTAL (`panelPortal.ts`, visible through the wreck hull only), WYSIWYG-deplete salvage, the door POP-OFF physics (`panelDebris.ts`), the rusted exterior, + the `verify:placement`/`salvage-audit`/`door-pop` gates. Remaining = only the attended walk-tests (below).
- `[bug]` **Salvage-panel ACAX walk-tests (`npm run dev`, eyes-only).** (1) **Breaker-board read under the amber pry-glow** up close + actually SALVAGE a panel to feel the bays empty (the headless audit force-opens WITHOUT the glow; tune `SALVAGE_PANEL_GLOW_*` if the cavity reads dark). (2) **Door pop-off FEEL** — does the 50% shear-loose read satisfying (outward launch / tumble / clang)? Tune `SALVAGE_PANEL_POP_SPEED`/`_UP`/`_SPIN` (tuning.ts). (3) **Stencil portal** — confirm the interior NO LONGER bleeds through terrain/dunes/sides, AND a normal pried panel doesn't FLICKER against its coplanar hull (if it does, raise the mask polygonOffset in `panelPortal.ts`).
- `[debt]` **Panel dead-code cleanup (ACAX).** The old greeble builders (`makeBreakerBank`/`makeWireLoom`/`makeCoiledWire`/`makeFuseBank`/`makeConduitElbow`/`makeCircuitBoard`/`makeCrackedScreen`/`buildGreeble`/`makeLootComponent`/`makePanelComponent`/`ARCHETYPE_EXTRACTABLES`/`PANEL_COMPONENT_PALETTES`) are now superseded by the breaker board but kept (exported → tsc-quiet). The `_panelInteriorMat` backplate is also redundant with the breaker board's full board. Strip in a cleanup pass. Also the dropped-item `colliderHint` dead field (D211).
- `[polish]` **Panel portal — 2-open-panel overlap edge case (ACAX).** With many popped/open panels, two whose mouths perfectly overlap on screen could in theory show a sliver of the back one's interior; the breaker-board's full backing board makes this effectively impossible in practice. Only a true fix (per-panel stencil IDs) would fully kill it, at the cost of the shared-material/program budget — not worth it unless it's ever actually seen.
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
- ~~`[feat]` **Raider proc-character body**~~ — **DROPPED (D238, 2026-06-18):** the user is not adding raiders. The pulse rifle (shipped ACAC) stays as a usable weapon; the raider BODY rebuild is cut. The dormant raider placeholder remains only as a combat/corpse-drag TEST affordance (D13), not an ambient threat.
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
✓ **[debt] material-factory → uniforms — SHIPPED ACAT T3 (D207).** All 7 remaining factories (glass/bone/stone/paint/wood/fabric/skin) converted from `.toFixed()`-baked GLSL → uniforms + runtime branches; cache keys dropped (fabric/skin's `pbr` rides the base material class). perf-probe programs 105→67 (−36%), boot shader-compile 270→197ms.
- ✓ **[debt] shared-noise helper — SHIPPED ACAU (D209).** The IQ hash/value-noise/fBm GLSL block duplicated across 11 factories lifted into NEW `world/shaderNoise.ts` `iqNoise2D(...)` (a generator parameterised by each factory's existing names + octave count → byte-identical, ~260 dup lines gone, perf-probe programs still 67).
- ✓ **[debt] Bury-audit — the RIGHT fix — SHIPPED ACAU (D210; closes D208).** `placeProcgenComposite` now register-all-then-prunes via exported `pruneBuriedPanels`; the wreck-yard runs it a 2nd time after `mergeStaticByMaterial(yardGroup)` against the whole yard (the 4th fail was a CROSS-wreck bury behind a neighbour's merged hull, not self-occlusion); the prune excludes the panel's `panelDoor` to match the audit's open-door state. `panels` audit 0 fails across 5 seeds; seed 1337 133→129 panels.
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

### E. Fresh triage (2026-06-17 dump — regroup into A–D / promote later)

**✓ SHIPPED in ACBB (2026-06-18):** brighter stars (`STAR_BRIGHTNESS 1.55`) · satellite dish full collider (flagship `satelliteDish`) · speeder antenna rear-tilt · dev-mode F8 keybind (works under pointer-lock) · scrap pickup → rusted-metal sheet. Also from §G: the per-bucket weathering rebalance / fleet cohesion, the COLLIDER-AUDIT harness (`verify:colliders`), sand-drift banking, debris scorch ring, husk hollow read, derelict parallel-hull outriggers. Their bullets may still appear in the list below — treat anything in the SHIPPED list above as DONE (don't re-do); the rest is genuinely pending.

- `[bug]` **Satellite dish FULL collider — partly done (ACBB):** the flagship dish reflector now has a slab collider (was walkthrough), but the FEEL owes the attended walk-test (a box approximation may slightly over-block the round dish at the diagonals). Refine if it reads wrong in play.
- `[bug]` **Satellite dish needs a full collider** (currently walkthrough/partial collision).
- `[feat]` **Sarlacc lure-and-ambush** — a bulb-flower lure in the pit centre; the maw emerges + opens when the player gets close.
- `[feat]` **Procedural wreck overhaul** — more detail, variety, sizes, variations + better textures.
- `[idea]` **Procedurally-generated wreck interiors** (walkable, not hand-placed).
- `[feat]` **More wreck types + new POIs.**
- `[polish]` **Speeder antenna tilt** — angle it toward the REAR of the bike, not the front.
- `[polish]` **Rebalance survival stats** (health/food/thirst/temperature) + enable survival in the new-game mode to playtest feel.
- `[bug]` **Dev/debug mode inaccessible** — can't click the screen to open it (pointer-lock); add a keybind.
- `[feat]` **Replace the scrap bar with a scrap machete** tool.
- `[feat]` **Open salvage panels with the machete** (tool-gated pry, replacing scrap-bar gating).
- `[polish]` **Machete panel-open animation.**
- `[polish]` **Sandworm model overhaul** — more realistic mouth + body.
- `[polish]` **Worm audio** — replace the loud/abrasive SFX with a low rumble.
- `[bug]` **Worm tail visible above ground** — should stay buried (adjust model / spawn depth).
- `[feat]` **Worm charge-and-dive attack** — remove the jump attack.
- `[polish]` **Flat-colour texture audit** — review all materials, improve the weakest-reading ones.
- `[feat]` **Crashing-ship / satellite event** — fiery wreck falls from the sky, crashes into the sand, leaves a salvageable dynamic wreck.
- `[polish]` **Rework the scrap pickup model** to a rusted sheet-of-metal look (current model disliked).
- `[debt]` **Security review** — audit the public GitHub repo for vulnerabilities / leaked secrets.
- `[polish]` **Tall smoke-signal plume** rising high into the sky from fires.
- `[feat]` **Rideable scrap sled** — press E to mount, like the bike.
- `[idea]` **Idea-generation tooling** — a way for the agent to propose new game ideas from the current project state.
- `[debt]` **Full roadmap refresh** to reflect current state + what we're working toward.

---

## PARKED (may revisit — needs a design decision first; detail preserved so the call is reversible)

- `[feat]` **Flagship NPC beats** (2026-05-24) — ~~hostile raider holdouts~~ (the raider half is DROPPED, D238) + friendly hermit NPCs at the hand-modeled flagships. ABF shipped narrative journals; this adds live NPCs. Parked: needs an NPC-AI-scope decision (dialogue? trade?) before a ~4-6h session — any raider-combat angle is off the table.
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

### F. Deferred from the ACAZ wreck-overhaul capstone critique (2026-06-17)
[polish] SHEARED_HULL breach-patch depth 0.06→0.10 + recessed near-black gash floor (rule-7; reads as a hole not scabbing)
[polish] wreck-yard: force a size tentpole (1 mega + 1 bulk + 1 scout) + scale minSep by class footprint so megas don't clip neighbours
[polish] one non-axial mass per heavy class (dorsal superstructure / sponsons / bridge tower) to break the length-axis "sausage" silhouette
[polish] up-close weathering chroma: push oxide more orange, lift seam-rust out of shadow, make gravity drips rust-coloured + seam-gated
[polish] sign-randomize + widen engine droop (currently always down-and-one-way); ~15% fully detach the nozzle off its mount
[polish] scout/corvette guaranteed visible trauma (≥1 SHEARED or breach + a list) since they sit fully proud + most-scrutinised
[polish] 2A scale-anchor: exclusion pocket so lee-flank greebles/seams don't punch through near the door; fins/antennas → impact flank only
[debt] full per-bucket weathering rebalance so hull HUE identity (not just lightness) survives the desert tint
[idea] wreck-yard draw-calls 1477 from ~36 live salvage panels (not hull mats) — cap concurrent open-panel interiors or LOD distant panels

### G. Deferred from the ACBA POI-variety overhaul + its adversarial critique (2026-06-17)

**✓ SHIPPED in ACBB (2026-06-18) — treat these as DONE:** per-bucket weathering rebalance + fleet palette cohesion (D234, `BUCKET_WEATHERING`) · tank terracotta→dark-steel (the dark bucket) · the formal COLLIDER-AUDIT harness (D235, `verify:colliders`) · sand-drift banking (D236, `makeSandMound` `proud`) · debris scorch ring · satellite crash-pose+burial + LED bezel · husk hollow read (gap widen) · derelict wide-body parallel-hull outriggers · wrecked_tank sand-tongue through the mouth.
**Still PENDING (ACBB deferrals):** [debt] **Tier 5 yard cross-POI merge** (D237 scope-cut — the ~3215 yard ground worst-case; field perf fine at 842) · [polish] the reworked **scrap pickup reads thin from a 3q edge-on angle** (re-judge in-hand; the front view reads well) · [polish] satellite solar wings still a touch dark at silhouette distance + debris fragments could use warmer ox so they read as torn hull metal not grey rock · [polish] husk + derelict deeper exterior detail · [bug] the flagship dish-collider FEEL owes the attended walk-test (slab approximation).

[done] HOLLOW-HUSK archetype SHIPPED (ACBA) — open-top-trough gutted hull shell + torn ends + flank breach + exposed rib formers, half-buried + listed, side-wall colliders (enterable-ready). Follow-up: more exterior detail, a clearer hollow read from low side angles, true enterability (floor + remove the bore obstruction) in a dedicated phase
[feat] PROCGEN_COMPOSITE_SHARE 0.50→0.85 SHIPPED (ACBA) — new system now covers the bulk of scattered wrecks in ALL biomes. **The →1.0 / retire-the-legacy-ship step is ON HOLD (D238): keep BOTH ship paths for now (user call).** Revisit only if the derelict is ever brought to the legacy ship's polish.
[done] "wider/weirder ships" SHIPPED (ACBA, D232) as an ADDITIVE socket-built `derelict` archetype (nose+barrel+engine → linear/wide-body-outriggers/stacked-tower forms). Optional follow-up: RETIRE the legacy linear assembleWreck for the derelict (then composite share → 1.0) — only if the derelict reaches the legacy ship's polish (8 variants / weathering / scale anchor); else keep both. Refine the wide-body outriggers (currently perpendicular barrels — try parallel twin-hulls or angled sponsons)
[debt] formal COLLIDER-AUDIT harness — assert each POI's declared collider-union ⊇ its visual bbox (the critique found 3 author-error mismatches by eye; a headless gate would catch them)
[polish] tank_cluster weathering reads terracotta/ceramic — a vertical cylinder fires the ox channels everywhere; give tanks a lower-ox / more-dust-chalk profile so the flank shows a top-to-bottom steel value gradient (cooler up top)
[polish] fleet palette cohesion — pull the saturated accents (navy-slate wings, terracotta tanks) toward the warm hull mid-value band so the family reads as one weather-system; distinct via LIGHTNESS not clashing hue (D224 approach)
[polish] wire pipeStrut() into assembleTankCluster (mate pipes between adjacent tanks' pipeZ sockets) — currently dead code + an untested collider path; plumbed tanks read as a connected farm
[polish] sand-drift banking — makeSandMound for the tank pad / satellite base doesn't visibly bank against the structure; raise mound height + ensure radius ≥ footprint + ~1.5m so every base meets the sand as a drift, not a clean seam
[polish] debris field scorch ring / disturbed-sand disc under the scatter centre (one impact footprint readable at yard distance) + warm ox/seam-rust on fragments so they read as torn hull metal, not grey rock
[polish] satellite solar wings still read dark at distance + bus (cool bucket) vs gold foil is slightly incoherent; consider a warmer bus bucket or more foil coverage; status-LED sub-pixel (enlarge or add a bezel)
[polish] yard ground-view worst-case 3215 draw calls — a yard-level cluster-merge across already-merged POIs (38 sub-groups un-merged) would cut it; field perf is fine (869)
[done-partial] §F SHEARED breach-patch depth 0.06→0.15 SHIPPED (ACBA); recessed gash floor stays N/A (D223 — recessed voids don't read at procgen scale, built proud instead)
[polish] wrecked_tank (ACBA critique deferred): bank sand UP the lower flank so the dune visibly laps the curve (the placement makeSandMound lands BESIDE it; needs an assembler-seated drift, since a component-baked drift sinks with the burial) + sand TONGUES intruding through the torn mouth/breaches + spilled-debris fragments seated on terrain.heightAt in the assembler (component-baked chunks drag under after the deep sink/list). The deeper burial (buryFrac 0.57) + whole-silhouette damage (2 flank breaches + crushed dome + torn end) already shipped; these are the remaining sev-2 "swallowed by a living dune" polish.
