# Changelog

2–4 lines per shipped session. Latest at top. Full plans archived at
`.claude/plans/archive/`.

## Session SS — 2026-05-20 — Opening wreck playtest + polish ✓ verify pass
`verified` — tsc clean; first framework-managed session post-retrofit;
eval-driven playtest from interior camera positions caught a latent
RR bug (interior was invisible). **Critical fix**:
`createRustedHullMaterial` returns `MeshLambertMaterial` with default
`side: FrontSide`. The 22 lathe slices of the opening wreck were
back-face-culled from inside the cockpit — players walking in would
have seen "open desert + floating debris" instead of the enclosed
hull. Patched `openingWreck.ts` to set `_hullMat.side =
THREE.DoubleSide` + `shadowSide: FrontSide` on both `_hullMat` and
`_hullDarkMat` (shadowSide prevents the interior surface from casting
shadows back into the cavity). RR was eval-verified from outside
positions only; never rendered from an interior camera. **Polish**:
entrance fragments reduced 7 → 4 with upper-half bias — was a
"saw-blade crown" around the rim, now reads as asymmetric torn metal
on one flank. Plate size slightly bumped (`w 0.55+rand*0.55` was
`0.35+rand*0.45`) so fragments read as hull plates not confetti.
**Verified**: tsc clean; interior renders with curved ceiling +
ribbed slice seams + tally marks + salvage panel B + entrance
opening visible from inside; spawn-toward-entrance silhouette reads
as torn-open wreck; save/load roundtrip preserves player + speeder
+ 22 wreck slices + 51 salvageables. **Backlog cleanup**: struck 2
shipped entries ("opening wreck more holes", "opening wreck full
redo"). Decision D69.

## Session RR — 2026-05-20 — Opening wreck full redo (cockpit + tail stub)
`partially verified` — tsc clean; eval-driven structural verification
(wreck spawns at (-53.5, 15.2, -2) with yaw=π/2; 22 of 24 lathe
slices present, the two top slices intentionally omitted for the
skylight; 50+ supporting meshes; save/load roundtrip preserves
player + speeder positions; 51 salvageables registered including 2
new opening-wreck panels) + side-angle + top-down screenshots
confirming the new silhouette. Pointer-locked walk-in test deferred
to the user. Full rewrite of `src/world/openingWreck.ts` (~440 LOC,
replaces the 534-LOC W-era box-walled module) following the
KK/LL/NN/MM modelling vocabulary. **Silhouette**: tapered fuselage
cockpit dome at +Z transitioning through a neck pinch to a tail-
stub body at -Z, with the tail-stub torn open as the entrance.
Hull built as **24 angular LatheGeometry slices** (15° each); the
two slices straddling true vertical are omitted, leaving a genuine
30° stress-fracture skylight running the full length of the upper
hull — real god-rays pass through this gap into the interior.
**Procedural rust shader** (`createRustedHullMaterial` from OO)
applied; alternating slice materials read as panel joints. **3
cockpit window boxes** wrapping the upper-front cockpit shoulder.
**Lateral breach patches** on side flanks at world ±X (initial
implementation had a lathe-local/world-Y axis confusion that
buried half of them — fixed by parametrizing in flank-centric
phi ranges around 0 and π). **7 torn hull-plate fragments**
around the rear entrance rim, with a bottom-110° arc skipped
(`sin(ang) < -0.3`) so the player has an unobstructed walk-in
path. **Antenna stub + crossbar** on the upper cockpit hull;
**rust-band torus** wrapping the tail body. **Per-piece tilted
colliders**: floor slab + cockpit front cap + 2 tilted boxes per
side (lower wall + roof-angled upper wall) + ceiling plate; rear
opening uncollided so the player walks in. **2 salvage panels**
registered as `'fuselage'` salvage kind (upper-rear hull + side
flank) — story-prop opening wreck is now also salvageable per the
session direction; narrative read: "the previous occupant
cannibalized panels for parts before they died". `OPENING_WRECK_EXTENTS`
preserved as the orchestrator contract with new dimensions
(halfX=1.7 / halfY=1.35 / halfZ=3.0 / backZ=2.4). 11 new
OPENING_WRECK_* Tuning constants. `openingScene.ts` + `main.ts`
updated to thread `salvageables` through and use the new
OPENING_WRECK_PLAYER_SPAWN_OFFSET=4.5 constant. Decision D68.

## Session QQ-2 — 2026-05-20 — Sled feel pass + sandworm rescale + hotbar tooltips
`partially verified` — tsc clean; eval-driven verification of the new
rope physics (lockedRotations + inextensible constraint) and HMR
playtest by the user for the visual + UI changes. Follow-up to QQ
addressing the "rope too elastic, sled spins around character" feel
problems. **Rope physics rewritten** (supersedes D65): one-way spring-
damper replaced with an **inextensible-rope constraint**. If `dist <=
SLED_TOW_DISTANCE` the rope is slack and applies no force; if `>`,
position-snap the sled body inward by the stretch + project out the
outward radial velocity component. Sled body rotations LOCKED via
`setEnabledRotations(false, false, false, true)` — verified
applyTorqueImpulse(50) → angvel stays (0,0,0). Visual yaw lerped
each frame toward "face the anchor" via `SLED_YAW_LERP = 0.12` so
the bow tracks the pull direction without physics-driven spin.
Friction back to **0.6** (metal-on-sand) since static friction now
correctly holds slack-rope sleds in place. Rope length 3 → 5m.
**Visual upgrade**: 2-vertex `THREE.Line` replaced with
`Mesh(TubeGeometry, MeshLambertMaterial)` along a 5-point
`CatmullRomCurve3` with parabolic mid-point sag scaled by rope
slack. Radius 0.04m, rebuilt each frame. **New speeder back-bar**:
two short uprights + horizontal crossbar at (0, 0.38, 0.95), named
`speederTowBar`, ref exposed on `SpeederState.towBar`. `updateSleds`
speeder-tether branch now reads `s.towBar.getWorldPosition()` so the
rope visually attaches to the bar mesh. **Sandworm halved**
(MM 240m → QQ-2 120m). All ranges scaled with body size halved
proportionally (BITE_RANGE 25→12.5, LUNGE_RANGE 30→15,
BREACH_ARC_PEAK 40→20, STATIONARY_BREACH_HEIGHT 50→25,
PATROL/DETECTION/DISENGAGE_RADIUS halved). Speeds + durations + HP
unchanged per D49. **Sled cargo bidirectional**: lootMenu widened
with optional `allowDeposit` flag → two-column layout (CARGO + YOU).
Click left = take from sled, click right = deposit from player
inventory. Stackable meta-less items merge with existing entries;
meta-bearing items (canteen fill, ammo, attached-sled-id) push as
new entries to preserve per-stack state. Empty sleds now open
(so the player can stash into them — previously refused). New CSS
classes `.loot-columns`, `.loot-column`, `.loot-col-header`.
**Hotbar tooltips**: hover any non-empty slot → custom-styled
tooltip floats above the slot showing item name (large, beige)
+ description (small, muted). Replaces the native browser `title`.
Position computed via `getBoundingClientRect()` at hover time;
content refreshes if the hovered slot's item changes. **Backlog
cleanup**: struck 4 shipped entries (sand worm, weapon variants,
world+biome rework, satellite dish POI). Replaced generic
"wreck POI rework" with specific "opening wreck full redo" feat
per user direction. Decision D67.

## Session QQ — 2026-05-19 — Sled mechanic — rope-tow flatbed cargo
`partially verified` — tsc clean; eval-driven verification confirmed
all critical paths (deploy / attachRopeToSled / detachRope / spring tow
velocity / snap-distance auto-detach at 8m / transferTetherOnMount +
Dismount / save v5 / load roundtrip restoring tether + cargo + ropeLine
+ rope's `meta.attachedSledId`). Pointer-locked input chain wasn't
exercised — document.hidden throttling + Vite dynamic-import module
isolation are the same gaps NN/OO hit. **New module
`src/world/sled.ts`** (~395 LOC) mirrors tent/fire placement + loot-
container cargo + speeder velocity-follow idiom. Two new ItemIds:
`rope` (wieldable, ties to a sled's rope stub via LMB) and `sled_kit`
(deploys a flatbed entity). Three tagged sub-meshes: cargo deck +
front yoke + rope stub. **Tow physics: one-way spring-damper impulse**
on a dynamic Rapier body with CCD enabled. Mid-impl tuning fix: K=90
+ friction=0.8 caused static-friction stiction (μmg ≈ 78N >
spring 60N at 0.7m err) → bumped to K=220, damp=28, friction=0.25 so
sleds glide on dunes. Lootmenu widened to `OpenContainer` structural
type so both `LootContainer` and `Sled` satisfy. Mount/dismount auto-
promotes a `player` tether to `speeder` and vice versa. Save format
`SAVE_VERSION 4 → 5` — `sleds?` field is optional so v1-v4 saves load.
Recipes: rope = 2 cloth + 1 branch; sled_kit = 2 scrap + 1 branch + 1
rope. Trimmed pipe_staff + energy_pistol from DEBUG_STARTER_LOADOUT to
fit (14/14 cap). Decisions D65-D66.

## Session PP — 2026-05-19 — Weapon variants + combat generalization + dev rAF fallback
`verified` — tsc clean; rAF fallback enables hidden-tab combat
verification for the first time (`ctx.time.elapsed` advances at ~60Hz
even with `document.hidden = true`); confirmed scrap_gun ammo
decrements 6→5 on single LMB press; energy_pistol chargeProgress hits
expected 0.594 at 700ms hold (charge_time 1.2s), clears to 0 on
release; all 5 weapons load with correct meta. **Combat refactor**:
old machete-only `combat.ts` (100 LOC) replaced with a generalized
`_WEAPON_SPECS` lookup table dispatching by `WeaponKind` (`'melee'` |
`'ranged'` | `'charged'`). Shared `fireMelee()` / `fireRanged()` /
`dispatchHit()` helpers. Machete numbers lifted into Tuning constants
(`WEAPON_MACHETE_RANGE/DAMAGE/COOLDOWN`) — no behavior change for the
existing weapon. **3 new weapons** (PP = first combat content since
the machete shipped):
- `pipe_staff` — melee, 2.6m reach (+44%), 0.85s cooldown, 0.55
  damage, **3m knockback** via new `knockbackLizard()` +
  `knockbackRaider()` (sandworm exempt — 240m body doesn't budge).
- `scrap_gun` — ranged raycast, 30m, 1.5 damage, 1.2s cooldown,
  6-round magazine via `slot.meta.ammoRemaining`. Empty-click toast
  + half-cooldown. New `scrap_bullet` item: hold the gun + use
  bullet to reload. Crafting recipe 1 scrap → 2 bullets.
- `energy_pistol` — charged ranged, 18m, 0.50→2.00 damage scaled
  over 1.2s charge time, 0.3s post-fire cooldown. Hold LMB to
  charge (tracked via new `mouseHeld: Set<number>` on InputBundle
  since `mousePressed` clears each frame). Release fires. Chamber
  glow shader interpolates dark→warm-orange→hot-blue-white via
  `updateHeld` hook reading `window.__chargeProgress` (exposed by
  combat.ts to avoid import cycle).
**Dev-mode rAF fallback** (D64) in `core/loop.ts`: when
`document.hidden && import.meta.env.DEV`, `setTimeout(16)` replaces
`requestAnimationFrame` so the game tick runs at full speed in
hidden preview tabs. Production keeps rAF (no CPU burn when user
isn't looking). Unblocks the verification gap that plagued NN+OO
combat work. **Inventory housekeeping**: bumped to 14/14 slots
used (max capacity); trimmed `torch` + `tent_kit` + `alien_fruit`
from DEBUG_STARTER_LOADOUT to fit the new weapons. Player starts
with all 5 weapons + 8 bullets + full magazine in the gun. Decisions
D64.

## Session OO — 2026-05-19 — Procedural shader expansion: hull rust + concrete weathering + dune wind streaks + rocky biome via scatter
`verified` — tsc clean; multi-angle browser screenshots via a new
toDataURL workflow (preview_screenshot tool stalls in hidden tabs;
fallback documented in
`memory/dustfall_preview_screenshot_workaround.md` so future sessions
don't re-investigate). Major procedural-shader pass building on MM's
pattern. **Three new shared material helpers + four terrain/biome
upgrades + a screenshot workflow fix.** New
`src/world/hullMaterial.ts` (~190 LOC) — `createRustedHullMaterial
({baseColor, rustHex?, bleachHex?, streakIntensity?, wearAmplitude?})`
patches MeshLambertMaterial via onBeforeCompile with vertical rust
streaks attenuated by `(1 - vWorldNormal.y)` (drips run DOWN only),
low-freq panel wear, sun bleach via `smoothstep(0.60, 0.95,
vWorldNormal.y)`. D62 baked in. Applied to all 3 flagship wreck
modules (satelliteDish.ts, engineBlock.ts, crashedHull.ts) AND to
shared wrecks.ts hull/rust materials — every procgen wreck inherits
the weathering. Flat-shaded primitives produce per-triangle effect
bands (intentional: reads as per-panel wear states on a riveted plated
hull). New `src/world/concreteMaterial.ts` (~165 LOC) —
`createWeatheredConcreteMaterial({baseColor, leachHex?, stainHex?,
leachIntensity?, aggregateAmplitude?})`. Aggregate noise + mineral
mottling + salt-leach efflorescence (paler streaks, low-Y biased —
salt wicks up from groundwater) + edge grime. Applied to dish
`_concreteMat` + `_concreteDarkMat`. `terrainMaterial.ts` extended:
**wind-streak overlay** on dunes — `(u, v) = world XZ in along-wind /
perpendicular-wind frame`, long primary streaks (`u*0.03, v*0.45`) +
secondary (`u*0.13, v*1.20`) blended at 0.35, brightness ±11% plus a
directional tint shift (warmer on streak ridges, cooler in troughs).
**Rocky biome shader REVERTED** (D63) — first pass at Voronoi
fissures + strata bands + boulder mottling read too similarly to the
salt-flat desiccation pattern. Replaced with the dune-effect path
(gated on `1 - saltness`, which is 1 in rocky) so rocky inherits sand
grain + ripples + wind streaks, with natural dark-brown rocky vertex
color carrying the differentiation. New `src/world/rockScatter.ts`
(~90 LOC) places 520 small IcosahedronGeometry rocks across rocky
biome regions (two tiers: pebbles 0.15-0.4m + medium 0.5-1.2m, random
rotation + Y-flatten, no colliders — deadTree pattern). Rocky biome
now reads as "sand-like ground with rocks strewn across it" — visually
distinct from salt ("crackled flat with wells") and dune ("smooth
dunes with ripples"). Wired into `main.ts` after `spawnCacti`.
**Screenshot workflow fix**: `mcp__Claude_Preview__preview_screenshot`
stalls (hidden-tab issue, reproduced across NN + OO with fresh server
restarts + visibility-API spoofing). `mcp__Claude_in_Chrome` returned
no connected browsers. Pivoted to render → `canvas.toDataURL` →
auto-saved tool-results file → python base64 decode → Read PNG. ~7
captures this session via the new flow. Memory note added with the
full incantation. Decisions D63. Memory:
`dustfall_preview_screenshot_workaround.md` added.

## Session NN — 2026-05-18 — Crashed_hull dedicated module (Wreck POI rework arc complete)
`partially verified` — tsc clean; 49 salvageables total (matches MM
baseline, net zero — old crashed_hull registered 1 'massive' + 1
'engine_bell' = 2, new module registers 2 'massive' panels = 2);
`gl.readPixels` grid sampling confirms renderer drawing terrain +
geometry; **browser screenshot tool stalled** every attempt this
session (two fresh server restarts, visibility-API override,
manual renderer.setSize all failed to unblock) — preview-environment
regression vs. MM, NOT a code issue. Architecture identical to the
proven LL engineBlock.ts pattern. New module
`src/world/crashedHull.ts` (~430 LOC) replaces the 41-LOC inline
`placeCrashedHull` in `poi.ts`. **LatheGeometry-tapered fuselage**
— 14-point profile sweeping tail seal → HULL_R_TAIL 1.2m neck →
HULL_R_MID 2.6m mid-body waist → pinch → cockpit bulge HULL_R_FRONT
1.4m → nose tip; lathe rotated Z=-π/2 so the Y-length axis aligns
with world +X. **Hull detail**: rust band torus + 4 structural rib
torus rings (radius-matched to local profile via interpolation) +
3 cockpit window strips wrapping the upper-front + darkened hull
breach + 2 broken antenna stubs (D60 anchored — `geometry.translate
(0, halfL, 0)` so the foot stays planted when the stub leans).
**Custom tail engine bell** local to the module (NOT reusing the
shared `placeWreck(engine_bell)`): LatheGeometry mirroring
engineBlock.ts (throat → bulged shoulder → pinch → flared rim) +
BackSide inner cylinder + dark backstop disc + rim torus + scar
ring (D48 sandworm-maw trick). Bell rotated Z=+π/2 so mouth opens
in world -X (away from hull). **2 salvage panels**: Panel A on
upper-mid hull (visible from dune approach), Panel B recessed
inside the bell throat (hidden loot — climb the hull, peer into
the bell). **4 per-piece tilted box colliders** via composed-
quaternion `addCHCollider` helper (mirrors engineBlock's pattern):
main fuselage cuboid + walkable upper-hull strip + bell cuboid +
underside wedge. Drops the prior single `attachCompoundCollider`
AABB. No interior + no shelter zone — open landmark (dish stays the
lone shelter POI). `placeDebrisField` preserved (16m, 12 pieces).
`makeFuselage` import kept in poi.ts — still used by
`placeScavengerCamp`. Wreck POI rework arc (LL engine_block + NN
crashed_hull) is now complete; camp deferred as intentionally lean.

## Session MM — 2026-05-18 — Sandworm boss-tier rescale + procedural terrain shader (dunes + salt cracks)
`verified` — tsc clean; multi-angle browser screenshots confirm
sandworm body 240m rearing 50m above the dunes in stationaryBreach,
patrol orbit 140m around (60, 0), detection transitions to alert at
the new 150m range; terrain shader shows dune sand with subtle grain
+ slope coloring at all camera pitches and salt flats with textbook
polygonal desiccation crack pattern (multi-resolution: ~0.67m primary
+ ~0.22m secondary), wet-zone patches, polygon edge-curl rim
brightening. **Thread 1 — Sandworm 10× boss rescale** (D49-preserving):
all SANDWORM_* tuning constants rescaled per a sheet (body 24→240m,
max radius 2→20m, patrol 60→200m, detection 50→150m, lunge range
7→30m, breach arc 5→40m, stationary breach height 8→50m, bite range
4→25m, HP 6→12, bite damage 0.35→0.50). Speeds DELIBERATELY unchanged
(D49: combat must stay dodgeable — player sprint 13.2 m/s vs charge
8 m/s preserves the perpendicular-sidestep dodge window). Hardcoded
sandWorm.ts values that don't belong in tuning also scaled: TREMOR_FAR
35→150 + TREMOR_NEAR 4→25 (match new detection+bite), camera shake
0.06→0.10, particle pool 56→140, burst counts 24-30 → 60-85.
**Thread 2 — Procedural terrain shader** in new
`src/world/terrainMaterial.ts` (~280 LOC): patches stock
`MeshLambertMaterial` via `onBeforeCompile` to inject world-space
noise on top of biome vertex colors. Zero bundle cost (no textures
shipped) — matches the project's procedural-everything ethos (Web
Audio already procedural). Dune effects: domain-warped multi-scale
FBM grain, macro mineral zones, asymmetric scallop ripples (`pow`-
skewed), warm-amber/cool-pale tint shift, slip-face vs stoss-face
slope coloring, heterogeneous grain specks (magnetite/iron/quartz).
Salt effects: multi-resolution Voronoi cracks (primary + secondary
suppressed inside primary), per-cell crack-width variation, polygon
edge-curl brightening (raised crust rim), wet-zone darker patches,
salt-crystal sparkle. **Critical bug fix mid-session** (D62, memory
note): first shader iteration silently MASKED OFF all effects at
extreme camera pitches because `vNormal` in Three.js fragment
shaders is in VIEW space, not world space — looking straight down,
world-up (0,1,0) projects to vNormal.y ≈ 0, killing
flatness-gated effects. Also discovered that
`saltness = smoothstep(0.6, 0.82, diffuseColor.b)` was unreliable
deep in salt biome because vertex color interpolation dragged B
below threshold near biome edges. Fix: terrain.ts now writes a
per-vertex `aBiomeRaw` Float32 attribute (biome noise value); the
shader injects `vWorldNormal = normalize(mat3(modelMatrix) * normal)`
+ `vBiomeRaw` varying and uses both for slope/flatness/biome
detection. Decisions D61 done in LL — this session D62. Memory:
`dustfall_shader_gotchas.md` added with the 4-step shader-debug
stack (vWorldPos → hash → noise primitive → each mask) so the
6-round diagnosis loop doesn't repeat.

## Session LL — 2026-05-17 — Satellite dish polish + engine_block POI rework
`verified` — tsc clean; multi-angle browser screenshots confirm
doorway accessible (lintel mostly above grade, sill 0.4m below
terrain), interior lantern glow visible on walls, dish-back panel
reachable via new exterior ladder, cable B properly anchored to
broken arm tip, 4-tone rust variation visible around dish rim,
engine_block reads as curved 5-bell cluster with recessed emissive
throats + cooling-shroud rings (was boxy 5-cylinder cluster). 49
salvageables register (was 48 → +1 from engine_block going 1→2
panels). **Thread A — dish polish** in `satelliteDish.ts`: exterior
45° ladder on +X wall (rails + auto-spaced rungs) + tilted ramp
collider via composed quaternion (climb to roof, reach the dish-back
salvage panel KK left unreachable); warm interior PointLight
(`0xffa844` × 0.6) + emissive lantern body + steel ceiling hanger;
2 droopy `TubeGeometry`-over-`CatmullRomCurve3` cables on the feed
assembly (cable B anchor bug fixed — was missing focalDist offset);
rust variation `i % 2 → i % 4` (added `_dishPanelRustLight` +
`_dishPanelRustEdge`). `BURY_Y` 2.5 → 1.0 (D61) so the 2.2m doorway
opening sits mostly above grade — KK had it trapped 1.9m
underground; ladder dimensions auto-rescale to the new exterior
height (rise 2.5 → 4.5m). Removed a wrapping `SphereGeometry` burial
dune on user feedback (read as fake — defer for refinement on other
POIs). **Thread B — engine_block rework**: new
`src/world/engineBlock.ts` (~370 LOC) replaces the 31-LOC inline
`placeEngineBlock` in `poi.ts`. `LatheGeometry`-tapered nozzle bells
(throat → bulged shoulder → pinch → flared rim) with `BackSide`
emissive throats + dark backstop disc (D48 sandworm-maw trick) +
char/scar rings; cooling-shroud `TorusGeometry` rings + 4 lengthwise
ribs sleeving the box thrust frame; `LatheGeometry` ablative
heat-shield; 2 `TubeGeometry` fuel hoses; 4 per-piece tilted box
colliders via composed-quat helper (was single
`attachCompoundCollider` AABB that overshot ~1.5m at tilted
corners); 2 salvage panels (frame face + recessed inside center
bell throat). `placeDebrisField` preserved. Decisions D61.

## Session KK — 2026-05-17 — Wrecked satellite dish flagship POI
`verified` — tsc clean; multi-angle browser screenshots confirm the
dish silhouette reads as a Rust-style monumental wreck, no floating
pieces remain across 5 verified angles, walkable interior strip ~3.8m
× 6.8m, all expected colliders + shelter zone + 2 salvage panels
register. Antenna spire retired entirely (zero `'antenna_spire'`
salvageables in the world). Swapped the anchor `antenna_outpost` POI
at (-88, -50) for a new flagship-scale wrecked satellite dish in a
dedicated module `src/world/satelliteDish.ts`: 8×8×5m concrete base
(half-buried) with hollow interior + entrance + sand pile + slope
wedge + shelter zone, 4 corner buttress columns, raised roof rim,
collapsed roof corner chunks, recessed door frame, 3 exterior side
pipes with valve handles; 14m steel tripod (3 legs + cross-bracing +
1 bent broken strut anchored to a leg foot); 16m-diameter parabolic
dish (12 radial panels, 3 missing exposing radial framework + 3
concentric rings underneath, patchwork rust shades); feed horn +
2 feed arms + 1 broken arm anchored at the focal point; interior
props (broken console + monitor + ladder rungs + ceiling pipes);
9 terrain-snapped sand mounds in an apron around the base. Static
colliders for roof + 6 walls + sand pile so player can climb on top
and shelter inside. `'satellite_dish'` removed from `WreckKind` since
this POI is bespoke (matches `placeMegaShip` / `placeMegaWreck`
pattern). Decision D60 (anchor angled cylinders via geometry.translate
instead of manual rotation math — bit me twice).

## Session JJ-2 — 2026-05-16 — Spawn teleport fix + level opening camera
`verified` — tsc clean; preview confirms player teleports to wreck
entrance immediately at boot (was stuck at placeholder origin), and
the opening camera now looks level/forward instead of tilting up at
the entrance arch. **Bug**: `setupOpeningScene` called
`playerBody.body.setNextKinematicTranslation(...)` to teleport the
player, but the game boots PAUSED (title screen up), so no physics
step ever applied the scheduled translation. On NEW GAME the
character controller takes over and overwrites the scheduled
translation with its own (computed from the still-placeholder body
position at origin). Result: player permanently spawned at world
origin, ~52m from the opening wreck. Fix: use `setTranslation(pos,
true)` — immediate, synchronous write — so the body's current
translation is already at the wreck entrance when the controller
first ticks. Also: `PLAYER_SPAWN_OFFSET_FROM_ENTRANCE 1 → 4` so the
wreck reads at a comfortable framing distance, and
`camera.lookAt(entrance.x, spawnY, entrance.z)` (held at camera-Y)
so the opening view is level, no upward tilt onto the arch.
Decision D59.

## Session JJ — 2026-05-16 — UI overlap fixes + scatter clustering + movement-feel tuning + spawn polish
`verified` — tsc clean; preview confirms toast and shelter indicator
both clear the hotbar / stat bars respectively (numerically and
visually); cluster verification numbers show 30 trees across 13
sub-clusters with density mix 0→5 (groves + lone trees), 10 cacti
across 4 patches with 2-3 each; exactly 1 antenna_spire salvageable
remains (the hand-placed `antenna_outpost`); spawn ~5.3m from wreck
entrance with the wreck dominating the opening view. **UI**: toast
bottom `32 → 100px` (clears the hotbar at top ~80px); shelter
indicator bottom `100 → 200px` (clears the stat-bar column at top
~185px). **Clustering**: dead trees now spawn in a two-pass scheme —
3 dense groves (6 trees each = 18) at greedy salt centroids via
`findBiomeCentroid` + a sporadic uniform pass for the remaining 12 so
the world reads as "thickets + lone trees" instead of either
"uniform scatter" or "all-in-one-spot"; cacti spread across 4
patches × 2-3 each (was 1 patch × 10). **Antenna cleanup**: removed
`'antenna_spire'` from `HERO_WRECK_TYPES` and `PROCGEN_WRECK_KINDS`;
hand-placed `antenna_outpost` POI stays as the single antenna in the
world (per backlog "remove antenna tower landmarks"). **Movement**:
`WALK_SPEED 4.2 → 6.0`, `SPRINT_MULTIPLIER 1.7 → 2.2` (sprint 13.2
m/s), new `DEBUG_UNLIMITED_STAMINA` flag pins `stats.stamina = 1`
when set so the sprint gate always passes (for testing); footstep
cadence `1.7 / 1.4m → 3.0 / 4.5m` so step audio at the new speeds
lands at natural 2 / 2.9 steps-per-sec rather than 3.5 / 9.4. **Spawn
polish**: `PLAYER_SPAWN_OFFSET_FROM_ENTRANCE 6 → 3m` so the opening
wreck dominates the player's first view. Cleared the 5 backlog items
that landed.

## Session II — 2026-05-16 — Lizard-on-a-stick cooking + dead-lizard model + held-cook animation + debug starter loadout
`verified` — tsc clean; preview screenshots confirm DEAD LIZARD held as
the lizard mesh, vertical skewer with lizard impaled belly-to-back, cook
animation centered over the fire with twist envelope (still while
extending/retracting, spinning only while held over flames), lizard
hovering above flames not phasing through; numeric craft + eat-recover-
branch verified. Two new items: `lizard_on_a_stick_raw` +
`lizard_on_a_stick_cooked`. `raw_lizard_meat` renamed to DEAD LIZARD
with the actual lizard mesh as viewmodel (no longer an abstract meat
slab); `makeLizardVisual` exported from `enemies/lizard.ts` to share
the geometry. New `buildSkewerMesh(cooked)` helper in items.ts: vertical
0.55m stick (grey grey to match dead-tree palette), lizard impaled at
73% up the stick, slight 3-axis slump tilt + Y=π so the head faces
left. Cooked variant clones the lizard materials and tints them to
charred brown. **Cook architecture** (D58): cook duration bumped 0.6s
→ 3.5s, `lizard_on_a_stick_raw` added to `COOK_MAP`, `tickCooking`
writes `slot.meta.cookProgress` each frame, `viewModel.ts` reads it
and drives a new `playCookAnim` hook on the item def. Skewer
animation: extend forward + pitch down, shifted left to cancel
`VIEWMODEL_OFFSET_X` so the tip lands on the crosshair; twist gated
to t∈[~0.25, 0.75]; lifted Y so lizard hovers above flames. Worm meat
+ cactus pulp got matching extend-and-twist cook anims. Branch
viewmodel + world pickup recolored grey (`0x6e685f`) to match the dead
trees they shed from; branch model + skewer stick both lengthened.
Crafting recipe: 1 branch + 1 raw_lizard_meat → 1 raw skewer.
Eat cooked skewer → +0.35 hunger + 1 branch returned via `addItem`.
**Debug starter loadout** behind `Tuning.DEBUG_STARTER_LOADOUT = true`:
spawn with branches/cloth/scrap/meat/cactus/fruit/fire_kit/tent_kit/
torch/flashlight stocked for crafting iteration without scavenging.
Decisions D58.

## Session HH — 2026-05-16 — World rework #3: procgen POIs + biome-aware AI spawns (+ FF LOD removed)
`partially verified` — tsc clean; numeric checks confirm 28 lizards (was
4 hardcoded), 0 in salt, min radius from origin 74m (above 25m buffer);
48 salvageables (was 33) with procgen-vs-anchor min separation 265m
(above 250m); 9 terrain chunks present, no LOD mesh; visual screenshot
in a 13m dune valley shows single continuous terrain surface, no
floating second-ground / pop-through. New `src/world/procgenPoi.ts`:
rejection-sample placement of ~15 procgen POIs across the chunk band,
min-separation 250m against all already-registered salvageables
(anchors + hero landmarks). `placeProcgenPOIs` reuses the FF/EE
`placeWreck` API + the GG `findBiomeCentroid`-style exclusion pattern.
New `spawnLizardsProcgen` in `src/enemies/lizard.ts`: clusters 1-2
lizards per POI (any biome != salt), tops up via global scatter with
25m spawn buffer, deterministic from the shared scatter RNG. Replaced
4 hardcoded lizards in main.ts. **Also removed the FF LOD ring**
(`src/world/terrainLod.ts` deleted) — its coarse 50m linear interp
poked 10m+ above the chunks' fine detail in dune valleys, causing a
visible "second terrain" with no collider; fog at the chunk-band edge
(density 0.0018 → ~99% opaque at 1200m) serves as the visible horizon.
D52 superseded by D56. `SAVE_VERSION 3 → 4` (pure marker, loader
accepts v1/v2/v3/v4 — id-based scatter persistence handles lizards
4→28 without migration per D55). Decisions D56-D57.

## Session GG — 2026-05-16 — World rework #2: biome rescale + scatter retune
`partially verified` — tsc clean; numeric checks confirm 10 cacti (was 3),
30 dead trees (was 12), 3 wells (was 1) pairwise-separated 1112-1413m (min
400m), all wells + cacti in salt, sandworm home still in dune; visual
screenshot shows vast bone-white salt regions interleaving with dune
sections; save round-trip not exercised but loader accepts v1/v2/v3.
`BIOME_NOISE_FREQ 1/220 → 1/900` (vast ~2.67-region-per-axis biomes in
the 2400m world). New `findBiomeCentroid(biomes, target, options)` in
biomes.ts generalises the old `findSaltCentroid` with greedy
`excludeCenters` for multi-pass placement; waterSources uses it to plant
3 wells across separate salt regions (≥400m apart). Cactus / dead-tree /
hero-landmark counts + radius bounds promoted to tuning constants and
rescaled for the 2400m world (`CACTUS_TARGET_COUNT: 10`,
`DEAD_TREE_TARGET_COUNT: 30`, `HERO_LANDMARK_COUNT_MIN/MAX: 15-20`,
radii out to ~1100m). `SAVE_VERSION 2 → 3` (pure marker bump, loader
accepts v1/v2/v3, no migration code — id-based scatter persistence
handles count growth automatically). Dropped dead `LANDMARK_COUNT: 180`
from tuning (verified unused). Decisions D53-D55.

## Session FF — 2026-05-16 — World rework #1: chunked terrain + bigger map
`partially verified` — tsc clean; seam check passed numerically (Δ <
0.0004m across all four chunk boundaries x=±400, z=±400, and the corner);
preview screenshots confirm continuous horizon out to the LOD ring + no
seam artifacts; full v1-save round-trip not exercised but loader accepts
both versions. Replaced the single 800m heightfield with a 3×3 grid of
TERRAIN_CHUNK_SIZE-meter chunks (default 800m × 3 = 2400m world span) all
sharing one `createNoise2D` instance + world-space sampling for bit-
identical heights at boundaries. New `Terrain.meshes: THREE.Mesh[]` +
`Terrain.noise` (exposed so the far-LOD ring + future procgen can sample
the same noise). New `src/world/terrainLod.ts`: coarse 80×80 square plane
spanning [-2000, +2000], sits at `y=-0.15` to slot under the chunks (no
donut carving needed — chunks always win the depth fight in the band).
`SAVE_VERSION` 1 → 2 as a pure marker bump; loader accepts both versions
(no schema change). Tuning bumps: `FAR_PLANE 600→1800`, `WORLD_RADIUS
280→900`, `FOG_DENSITY_CLEAR 0.0035→0.0018`, `SHADOW_CULL_DISTANCE
80→120`. Biome wavelength + POI placements + AI spawns intentionally
unchanged (sessions #2 + #3). Decisions D50–D52.

## Session EE — 2026-05-16 — Scoping: world rework split into 3 sub-sessions
No code shipped — planning-only session. Split the 10-15h "world + biome
rework" roadmap item into three shippable sub-sessions: #1 chunked
terrain + bigger map (5-6h, 800m → 2400m via 3×3 heightfield chunks +
far-LOD ring), #2 biome rescale + scatter retune (4-5h, `BIOME_NOISE_FREQ`
1/220 → 1/900, count/bounds rescale), #3 procgen POIs + biome-aware AI
spawns (4-6h, Poisson-disk POIs + ~28 lizards salt-excluded). Updated
`docs/roadmap.md` to replace the single world-rework entry with the
three ordered sub-entries. Authored
`.claude/plans/world-rework-1-chunked-terrain.md` ready to execute next
session (full files-to-touch list, tuning constants, seam-invisibility
note, acceptance criteria, save-compat plan). Scoping rationale archived
in `.claude/plans/archive/session-pick-from-soft-lobster.md`.

## Session DD — 2026-05-16 — Roaming Dune-style sand worm boss
First boss-tier enemy. NEW `src/enemies/sandWorm.ts` (~750 lines):
24m long lamprey-style mesh built along local +X with continuously
tapered cylinder segments + embedded torus ridge rings (major radius
0.94× body so ribs read as connected, not floating). Recessed maw —
no external protrusion: last 2 head segments are `openEnded`, an
inward-narrowing `BackSide` cylinder forms the throat (rim flush
with body diameter, emissive `#4a1808`), with concentric inward-
pointing tooth rings (14 outer at the rim, 10 smaller deeper inside)
and a dark back-cap disc. Body cylinder is `DoubleSide` so the open
segments don't reveal daylight through the worm. 7-state behavior
loop: `patrol → alert → charging → lunge → retreat → stationaryBreach
→ dead`. Worm orbits a home anchor (`SANDWORM_HOME_POS = (60, 0)`,
verified dune-biome at boot) at radius 42m on a 60m patrol disc.
Detection radius 50m → alert (2s windup + roar) → charging at 8 m/s
underground with **half-body riding above the sand** (basePos.y =
groundY puts top half exposed). Charge commits to the player's
position **snapshotted at enterCharging** — no leading, no per-tick
refresh — so dodging sideways before the worm arrives causes the
lunge to miss into empty sand. Lunge: 2.6s arc with `BREACH_ARC_PEAK
= 5m`, pitch following `cos(t·π)·0.6` for tangent-aligned head pose,
and a parabolic body bend (`sin(t·π) * 2.5m`, peak shifted 0.15
toward head) applied per-child via `applyBodyBend` so the worm looks
curved through the air, not a rigid stick. Bite damage 0.35 at
arc midpoint within `BITE_RANGE = 4m`. Every 3rd retreat triggers
stationaryBreach instead: rises vertical (pitch = π/2) for 5.5s
with layered-sine sway around the world-horizontal lateral axis
(eased in/out, peak ±0.3 rad) — reads as a cobra rearing. 6 HP, hits
gated to lunge + stationaryBreach states only (uniform 1.0 dmg per
swing — DD-1's three-zone weak-point system was scrapped after the
glowing-ring weak point read as unrealistic UI). **Sensor collider**:
worm cuboid is `setSensor(true)` so it never applies contact forces;
otherwise the kinematic worm body shoves the kinematic player capsule
skyward and ragdolls the dynamic speeder. Bite damage uses an
explicit distance check, not physics contact. Machete `castShape`
passes `0` for filter flags to include sensors. **Speeder mount fix**:
`getPlayerPos(ctx)` returns `ctx.speeder.body.translation()` when
`ctx.speeder.mounted` is true, since the capsule body is parked at
`(0,-2000,0)` while mounted — without this the worm targets origin.
**Tremor warning**: during alert/charging/retreat AND within 35m,
camera position jitter ±0.06m × proximity-scaled intensity + dust
puffs at the player's feet on a 0.35→0.10s cadence. Drops `[take]`
worm corpse loot — `raw_worm_meat` + `cooked_worm_meat` items added
to `ItemId` union with `inventory/items.ts` registrations; cook map
in `interaction.ts` extends to worm meat over a fire. `playWormRoar`
+ `playWormChomp` synthesized in `audio.ts` (layered sawtooth/noise/
sub-bass for the roar; tri+lowpass-noise impact for the chomp). 22
new `SANDWORM_*` tuning constants. Save/load: optional
`SaveV1.sandWorm = { state, health, looted, pos }` — mid-encounter
states collapse to `patrol` at the saved XZ on load; dead state
restores corpse at exact death position. New `GameContext.sandWorm`
slot. Decisions D48–D49. `verified` (tsc clean, state-machine
transitions hand-ticked through full cycle, dual-zone damage logic
confirmed via `damageSandWorm` direct calls, charge commitment
confirmed by player-move test, save/load round-trip verified for
dead + mid-encounter states, sensor + castShape interaction
confirmed via direct Rapier API call, screenshots of stationary
breach + lunge body bend + recessed maw + charging half-body).

## Session CC-4 — 2026-05-16 — Biome polish + crescent moon fix + GH Pages deploy
Multi-thread polish session. **World/biome**: green saguaro cacti
retired (`makeCactus` deleted, `CactusKind = 'alien'` only); alien
cactus rare (TARGET 12 → 3), restricted to salt-flats + flat ground
via new `terrainFlatnessAt` helper, base recolored to warm grey
(`#7a7268`) so the teal fruit pops as the only saturated element.
Dead trees same salt+flat restriction (new `biomes` param in
`spawnDeadTrees`). Wells: 3 stacked rock rings (`WELL_STONE_RINGS=3`)
with tighter spacing (`baseSize * 0.85`, was *1.75) so layers
interlock instead of leaving gaps; hatch lowered to `stoneMinHalfHeight`
+ widened tilt randomization (±6° pitch + ±5° roll) so all four corners
sit on stones instead of floating. Single well at the salt-flats
centroid via new `findSaltCentroid` grid sweep (`WELL_TARGET_COUNT` 5
→ 1). **Alien fruit lifecycle** (`updateCacti` tick): fruit + stems
hide on harvest, regrow after a full `DAY_LENGTH_SECONDS` cycle, retag
as harvestable; save/load re-arms the regrow clock on restore so
save-scumming can't shortcut it. **Day cycle**: `DAY_LENGTH_SECONDS`
480 → 720 (12 real-min, was 8). **Lizards**: `FLEE_SPEED` 2.5 → 1.8
(catchable while sprinting now) + fixed head-rotation formula —
mesh's local forward is +X (head at +X=0.11), but the old yaw used
`atan2(x, z)` which assumes Three.js's -Z-forward default, leaving
the head 90° perpendicular to motion. New formula `atan2(-fleeDir.z,
fleeDir.x)` applied every frame during flee (was one-shot at flee
transition). **Moon-direction bug fix** in `lighting.ts`: moon's
`target` was never added to scene or updated, so its `target.position`
stayed at world origin. When the player capsule parks at `(0,-2000,0)`
while mounted on the speeder, moon position dropped below world, target
stayed at origin → light direction inverted → night went pitch-dark
when mounted. Fix: `scene.add(moon.target)` + `target.position.copy(
playerPos)` + `target.updateMatrixWorld()` each frame, matching the
sun's setup. Subtle side benefit: moonlight direction is now correct
anywhere the player walks, not just near origin. **Save round-trips
correctly**: removed the `!hasSave()` guard around `setupOpeningScene`
(wreck/skeleton/journal/speeder always exist after boot;
`loadGameState` patches the speeder pose over the default placement
on Continue). NEW GAME with an existing save wipes + reloads for a
clean slate. Title overlay gained `CONTINUE` button (via
`titleOverlay.ts` `onContinue` option) plus tighter button spacing.
Title subtitle: "a desert is patient" → "the desert is patient". CSS
specificity fix so `#title-overlay.hidden` actually hides
(`display:flex` at id-spec was beating `.overlay.hidden` at class-
spec). **Infra**: NEW `.github/workflows/deploy.yml` builds + ships
`dist/` to GitHub Pages on every push to master; `vite.config.ts`
gains mode-based `base: '/Dustfall/'` for production. Phantom-dep
landmine fixed — `simplex-noise@4.0.3` was being resolved from a
parent directory's node_modules locally and never declared in
`package.json`; CI's `npm ci` couldn't see it. Now declared properly
(D46). Decisions D45–D47. `partially verified` (tsc clean; state
checks confirmed cactus rarity + grey palette + fruit harvest/regrow
round-trip + well 3-ring stack + hatch flat-bottom-on-min-stone +
moon-target equal direction in mounted vs unmounted + lizard
rotation across all 4 cardinal directions + save round-trip restored
speeder pose to (123,5,-45) exactly + first GH Pages deploy
succeeded after the simplex-noise fix; screenshot tool flaked
intermittently — visual checks via pixel sampling).

## Session CC-3 — 2026-05-15 — Animated main menu (title screen)
NEW `src/world/titleScene.ts` — dedicated THREE.Scene + camera, decoupled
from the game world. Camera atop a Gaussian-bump hero dune on a 800m
displaced-plane dune field looking out across the basin, tilted up so the
horizon falls at the bottom-third of frame (sky 2/3 / desert 1/3). Tiny
escape-pod streaks in like a shooting star (scale 0.04, 9s cubic-ease
descent from 280m out) with a 28-segment additive Line trail + glow
sprite, impacts far out, and a procedural **pyre** engulfs it (4 nested
cones + 5 random tongues + glowing coal-bed + 16-ember pool + 14-smoke
pool + warm PointLight, all `fog: false` so it punches through atmospheric
haze at 200m). Day/night cycle uses the **real in-game sky package**
(sphere-shader gradient + sun sprite + moon sprite + 800-star points +
planet + 4-shooter pool) ported into the title via exported helpers from
`sky.ts`. Sun arc rebuilt (`dawnAxis * cos + upPerp * sin` instead of
`(cos, sin, 0.18)`) so the sun crosses the fixed camera view; both bodies
left-shifted via `LEFT_SHIFT=0.50`. Boot starts at `cycleOffset=0.19`
(astronomical twilight, sun 18° below horizon → user watches sunrise ~15s
in). **Moon overhauled** in `sky.ts` (affects in-game too): canvas
`destination-out` carves a crescent from the disc + halo, `MOON_DISC_SIZE`
16 → 32, `depthTest: false → true` so terrain properly occludes the moon.
Title-only night-brightness boosts (3× moon directional + 4× ambient
night gain + ground multiplier 0.30 → 0.55) keep dunes legible under
moonlight. NEW `src/ui/titleOverlay.ts` — DOM overlay (z=250) with
DUSTFALL wordmark + "a desert is patient" subtitle + CONTINUE (only
when save exists) + NEW GAME. Render-loop change: `startLoop` accepts an
optional render-target getter that swaps between title and game scenes
based on `ctx.flags.titleActive`. **Save/load round-trips speeder pose**:
added `speeder?` field to SaveV1 (pos + rotationQuat + mounted +
headlampOn); `setupOpeningScene` now runs on EVERY boot (was gated on
`!hasSave`), and `loadGameState` patches over the default placement on
Continue. NEW GAME with an existing save calls `clearSave() + reload()`
for a clean slate. Two glitch fixes: `#title-overlay { display: flex }`
was id-specificity beating `.overlay.hidden { display: none }` so the
title never actually hid after NEW GAME — added matching id-specificity
`#title-overlay.hidden { display: none }` rule; HUD/hotbar/crosshair
hidden via `style.visibility` while the title is up so they don't bleed
through the gradient. Decisions D41–D44. `verified` (tsc clean, screenshots
confirmed pre-dawn red glow + sun visible morning + crescent moon + night
brightness + button layout, save→reload→Continue round-trip restored
speeder to (123,5,-45) exactly).

## Session CC-2 — 2026-05-15 — Hover speeder polish (model, tilt, jump, bells, colliders)
Long iteration pass on the speeder. **Tilt**: visual-only pitch/roll
quaternion composed on top of the body's yaw (the X+Z rotation locks
from D34 stay in place), lerped toward W/S pitch + A/D roll targets.
Camera roll applied via tracked-undo on `camera.quaternion` (naive
multiply accumulated to 720°/s spin). **Jump**: 2-phase pulse →
recover with linearly-decaying upward floor + softer recover lerp
(0.08), so the peak arcs smoothly instead of capping hard. **Camera**
height tuned to 1.0m (between original 0.55 and prior 1.45).
**Headlight**: toggleable on L — SpotLight child of bike + emissive
disc material swap (intensity 0/8, materials `_headlampOff/OnMat`).
**Model**: full rusty-scoutbike redesign — extended fuselage, 2-stage
forward arm + tip + headlamp housing, sunken cockpit + windshield cowl
+ backrest, angled handlebar stem, fuel canister with bands + cap,
foot pegs (moved forward to Z=0.15 to clear canister), exposed cables
underneath, vent louvers + patched rust panels, antenna whip with
attached red tip light. **Saddlebag**: single chunky bag on +X engine
face with **9-piece contour-hugging strap rings** (×2 rings) that step
pod-height→bag-height at the junction, plus a small buckle on top of
the bag-top strap. **Engine bell mesh overhaul**: NEW `makeEngineBellMesh`
helper in `wrecks.ts` — flared open-ended cone + recessed solid interior
cylinder + rim torus, with WeakMap-cached DoubleSide material clone.
Replaces the flat-`CircleGeometry`-disc pattern across speeder (2 bells),
megaShip (1), megaWreck (2), and reused inside `makeEngineBell`
(standalone wreck) + `makeEngineCluster` (engine_block POI nozzles).
**Mount prompt**: NEW `'mount'` InteractType + `'speeder'` registry;
seat mesh tagged + raycast-targeted in `interaction.ts` so looking at
the seat shows `[E] mount speeder` via the existing prompt system.
**Colliders**: speeder body gains a nose cuboid + 2 bell cylinders so
the front + bells are solid; megaShip + megaWreck bells also get
cylinder colliders. Decisions D37-D40. `partially verified` (tsc clean
+ state checks all confirmed; preview screenshot tool flaked
mid-session — visuals deferred to live play).

## Session CC — 2026-05-15 — Hover speeder bike (dynamic-body, 1P, velocity-controlled)
NEW `src/world/speeder.ts` — bike that spawns next to the opening
wreck on fresh worlds. Iterated from force-based thrust + torque
steering (unstable, spun out, NaN'd) to **velocity-controlled** X/Z
(target vel from input × bike forward/right, lerp 0.07), velocity-
controlled yaw (lerp toward camera yaw, 0.30 response), velocity-
controlled hover (already established BB-style PD-but-as-velocity-
control). Camera written directly from rider seat at +1.45m above
bike body (above handlebars); player capsule parked at (0,-2000,0)
while mounted so it can't collide with the dynamic bike. Bike-body
gravity scaled to 0 (we own Y entirely). Input scheme: **mouse turns
the bike, A/D strafe, W/S throttle, Shift boost, Space hop, E
mount/dismount**. Top speed 14 m/s forward / 23.8 m/s boosted /
7 m/s strafe. Decisions D34 (velocity over force), D35 (mouse-turns
+ strafe over A/D-turns), D36 (camera-from-rider-seat / player-body-
parked). `verified` (tsc + state checks for accel curve, yaw lerp,
strafe direction; screenshot of rider POV with mega-wreck dead-
ahead).

## Session BB-4 — 2026-05-15 — Storm + fog visual rework
`THREE.Fog` → `THREE.FogExp2` with smoothstep density curve (`0.0035` →
`0.055`). Single 2500-particle dust cloud → 3 stacked layers
(`near` 800 / `mid` 2500 / `far` 600) with staged opacity ramps (far
appears first as "storm on horizon", near appears last when wind reaches
player). NEW `src/world/stormVignette.ts` — clip-space full-screen
quad with aspect-corrected radial alpha gradient, only engages above
intensity 0.4. `lighting.ts` adds storm dimming: sun × (1 - 0.65×storm),
ambient × (1 - 0.20×storm) with color shifting toward warm dust. Fog
color lerp to dust bumped 0.45 → 0.70 (FogExp2's denser falloff makes
fog repaint every surface — needed stronger sky-color match). All storm
visuals die in shelter (3 layers + vignette); skylights then read as
"dark portals to the storm outside" with dust-tinted ambient leaking
in. FPS 143 clear → 91 peak (target ≥60). `verified` (tsc + screenshots
of clear/building/peak/inside-shelter states + state checks).

## Session BB-3 — 2026-05-15 — Mega-wreck verticality + detail pass
3 catwalks (Y=3/7/11m) + 3 ramps inside aft bay. NEW dark side room
(Chamber 3) off aft +X wall via doorway in refactored aft right wall.
3 skylights via roof-strip `panelWithHole` replacement (3 strip panels,
each with one hole). Bow gets a small ragged +X side opening for side-
light. 6 more salvage panels (catwalks + side room + 2 engine bells +
antenna spire requiring tower climb via debris-pile steps). Interior
detail pass (ceiling pipes, wall conduits, broken consoles, hull-plate
fragments). Exterior detail pass (seams, rust streaks/patches, exterior
pipes, vents, broken antenna stubs). `placeDebrisField` (50m radius ×
40 pieces) + 3 companion wrecks (fuselage + engine_cluster + escape_pod)
at 30-60m offsets. 1049 total scene meshes, FPS 143. `verified` (tsc +
preview screenshots of skylight-lit bay, dark side room, engine bells
silhouetted against moon, antenna spire visible from spawn).

## Session BB-2 — 2026-05-15 — Mega-wreck shell (Jakku-scale, 120m)
NEW `src/world/megaWreck.ts` — TRULY mega-scale crashed ship at
(-180, -130) in SW quadrant (drifted to (-180, -190) by flat-spot
search). 3 hull sections (bow 35m + open mid-hull break + aft 60m) + 12m
bridge tower + 2 ten-meter engine bells. Bow lives in a named 'bow'
sub-group with runtime Y-offset anchored to terrain at the ENTRANCE
position — needed because at 120m length terrain varies 12m+ across
the footprint, so a static `BOW_ORIGIN_Y` like the archived plan
suggested would push the entrance below terrain (D29). Widened
flat-spot search to 9×9 at 15m spacing × radii up to 60m, tilt cap
0.10 rad, `BOW_ENTRANCE_H` bumped to 4m for slack. 2 salvage panels
(aft + bow), shelter zone over aft bay. POI registered in
[src/world/poi.ts](src/world/poi.ts) with a new `terrainVarAtWide`
helper. `verified` (tsc + screenshots + state checks for biome,
clearance, salvageables, inShelter).

## Session BB — 2026-05-15 — Mega-ship POI (enterable wreck v1) + mega-wreck plan
NEW `src/world/megaShip.ts` — a ~12m enterable wreck in central dunes
(-120, 30). Extracted `panelWithHole` to shared `src/world/panelUtils.ts`.
Multi-iteration session: started boxy, ended as a detailed rusty sci-fi
crashed cargo hauler — 111 meshes incl. 2 chambers split by bulkhead, side
entrance, **sand-reclaimed floor** (no floor mesh; terrain serves), walls
extending 2m below origin (no slope gaps), terrain-normal tilt for crashed
feel, segmented bridge cone w/ viewport, engine bell + antenna masts +
wing fins + exterior pipes/vents/seams/rust + interior ceiling pipes +
wall conduits + broken hull plates around entrance. 3 salvage panels
(massive×2 + engine_bell). Also authored a detailed BB-2/BB-3 plan for a
TRULY mega-scale crashed ship (120m, Force Awakens Jakku scale) — see
archived plan. `verified` (tsc + multiple screenshots).

## Session AA — 2026-05-14 — Torch/flashlight + opening-scene rebuild
NEW `torch` (consumable, 3-min burn, warm PointLight + flicker) and
`flashlight` (rechargeable, drains while lit, cool SpotLight) items + craft
recipes + salvage drops + `ItemDef.updateHeld` per-frame hook. Opening
wreck rebuilt: removed floor sun-patch + rust patches, brightened tally
marks (Y=1.30), pierced REAL geometry holes in side walls + roof + back
wall via new `panelWithHole` helper, replaced back roof with a translucent
canvas TARP (emissive + `noShadow`), fixed pre-existing roof rotation
inversion that had the apex BELOW the wall tops (Session W bug). Opening
scene: no boot storm, wreck moved to central dunes (-50,0,0) via empirical
biome+POI scan, yaw forced to π/2 (back wall faces east), player
teleported relative to wreck post-placement. First-frame view is now the
wreck silhouetted against the rising sun with the back-wall window
glowing. `verified` (tsc + multiple screenshots).

## Session Z — 2026-05-14 — Stone-well rework + tactile salvage panels
Two threads. (1) `makeWell` rewritten: ring of 9 perturbed icosahedron stones
(alternating light/dark palette) + askew 5-plank wooden hatch with cross-brace.
`spawnWaterSources` now hard-requires salt biome (no quota fallback; unplaceable
wells silently drop). 5/5 wells land in salt. (2) New `addAccessPanel` helper
in `wrecks.ts` adds a small dark plate + brass rim + stub handle to every wreck
at a kind-specific local offset. `Salvageable` gains a `panel` field; salvage
interact tag moves from the wreck root to the panel mesh only, so players aim
at the panel directly. POI custom hulls (engine_block, crashed_hull) forward
the inner wreck's panel ref to the parent group. `partially verified` (tsc +
state checks + well screenshot; panel-on-wreck screenshot blocked by paused-tick
lighting).

## Session Y — 2026-05-14 — Footprints + lizard tracks
NEW `src/world/footprints.ts` — InstancedMesh pools per kind (player ×200,
lizard ×240). Canvas-drawn alpha-mask textures (toe+heel double oval for
player, three-streak claw mark for lizard) — zero asset files. Per-instance
opacity via `onBeforeCompile` shader patch on MeshBasicMaterial: 1 draw
call per kind yet independent fades. Player decals hook the existing
`_stepAccum` cadence in `controller.ts` with L/R parity offset (±0.16m
perpendicular, ±6° toe-out); lizard decals fire every 0.30m of flee-state
travel in `lizard.ts`. Both skip rocky biome. 12s smoothstep tail; 45s
total lifetime. Round-robin pool recycling. `partially verified` (tsc +
spawn writes + fade math + decal screenshots; controller cadence path
unexercised due to preview pointer-lock + rAF throttling).

## Session X — 2026-05-14 — Audio overhaul (sample-stem architecture)
Replaced V/W procedural drone+pluck+bandpass-wind with sample-stem orchestrator.
NEW `src/audio/samples.ts` (tolerant fetch+decodeAudioData; missing files log
warning + null). REWRITE `src/audio/soundscape.ts`: 7 stems (calm/mid/storm
wind, day/night ambient beds, calm/tense music) crossfaded via smoothstep on
weather.intensity + sunHeight + slow procedural breeze drift. Music bus 4s
fade-in. DELETED `src/audio/music.ts`. New `__game.audioState()` debug hook.
Files intentionally NOT shipped — `public/audio/` empty, code activates as
each .ogg lands (Session N precedent). `partially verified` (tsc + signal
math + graceful-degradation path confirmed via preview_eval; audible test
deferred to when files arrive).

## Session W — 2026-05-14 — Opening scene + world detail
Cinematic intro on fresh worlds (gated by `!hasSave()`): 30-s sandstorm,
hand-authored crashed-shelter wreck (rectangular box-walls — NOT the broken
half-cylinder first cut), skeleton slumped against back wall with journal at
fingertips opening a modal lore panel. Skylight hole in roof + emissive sun-
patch on floor. Bundled: 12 dead trees clustering branch pickups (replaces
random scatter), alien-cactus variant yielding new `alien_fruit`. Storm
aggression rebuilt: dust particles use a circular gradient map (no more
pixel squares), velocities 6 m/s, sky lerps 95% to dust, fog `near`+`far`
BOTH move with intensity (math inversion bug — `fog.far < fog.near`
painted everything fog color — fixed). Wreck oriented so entrance faces
spawn, sits on flattest 5×5 patch within 20 m. `partially verified` (DOM
+ scene checks via preview_eval; screenshots timed out).

## Session V — 2026-05-13 — Atmosphere + audio placeholder
Night sky: moon sprite opposite the sun, 800-point star field, 4-line
shooting-star pool, distant reddish-planet sprite anchored on the eastern
horizon. New ambient-dust system (toned-down storm cousin) suppressed when
storm > 0.15 or `player.inShelter`. Built a procedural music module (drone
pad + pentatonic plucks + feedback-delay reverb + storm sub-bass) then
DISABLED IT entirely — vibe wasn't right and a full audio overhaul is
deferred (D14). Wind layer also disabled. `partially verified` (scene +
audio-context unlock confirmed; screenshot timed out).

## Session U — 2026-05-13 — UX & tuning pass + empty the world
Removed spawned raider at boot (code path stays — D13). Window-listener
Ctrl+W/A/S/D/Q `preventDefault` so the browser doesn't intercept (Ctrl-W
was closing the tab mid-playtest). `I`/`C` now TOGGLE (open AND close)
inventory + crafting overlays via a new window-keydown handler in input.ts
— the polling in updateInventoryInput early-returned while paused. Hover
tooltips via `root.title` on hotbar + inventory tiles. Lizard `FLEE_SPEED`
3.0→2.5; `DAY_LENGTH_SECONDS` 360→480. `verified` via synthetic keydown +
DOM inspection.

## Session N — 2026-05-13 — Rigged raider visual + animation infra
Per-instance `AnimationMixer`, fuzzy clip resolver (Quaternius packs name
clips wildly — substring match against `idle/walk/run/attack/die`),
crossfade helper. New `Raider.rig` field; bladeArm tween becomes
primitive-only. Primitive fallback path exercised end-to-end. The rigged
GLB at `public/models/quaternius/raider.glb` is intentionally NOT shipped
— user deferred asset work; code activates the rigged path automatically
when the file lands. `partially verified` (primitive path; rigged path
unverified pending asset).

## Session M — 2026-05-14 — Save / load
NEW `src/persistence/save.ts`. Single-slot `localStorage['dustfall.save.v1']`,
seed-stamped (mismatch refused with toast). Sleep autosave + manual pause-menu
Save. **No death autosave**: Continue from last save on death overlay only
when a save exists, else Main Menu. New-game-while-save confirm prompt.

## Session Q — 2026-05-13 — Camera bob + footsteps + ease curves
Viewmodel Y-bob phase-locked to footfall cadence; idle breath fades in below
0.5 m/s. 4 procedural footstep variants (sand/rock/salt/wet) dispatched via
`biomeAt()` + 2m water proximity. New `src/core/ease.ts` (`easeOutBack`,
`easeInOutCubic`, `easeOutQuad`); canteen/bandage/machete use-anims swapped.

## Session T — 2026-05-13 — Salvage gameplay
Every wreck (hero landmarks + massive POIs) becomes a finite salvage source.
NEW `src/world/salvage.ts`: registry, loot tables per `WreckKind`,
1.5s salvage timer mirroring the cooking pattern, `markSalvageStripped()`
desaturation walk on depletion. 14 salvageables registered.

## Session S — 2026-05-13 — Sci-fi pivot + ship wrecks
Tonal pivot to Jakku-flavored scavenger desert. NEW `src/world/wrecks.ts`
(6 wreck-type registry: engine cluster / fuselage / escape pod / cargo /
antenna / engine bell). Massive POI hulls + debris fields. Hero landmarks
+ POIs rerouted to wreck registry; monolith dropped.

## Session P — 2026-05-13 — Barren-desert pass
Realistic ridged + wind-warped dunes; biome map (dune / rocky / salt);
per-vertex terrain tinting; ring of 22 perimeter mountains as horizon
silhouettes; 4 hand-placed POIs (monolith, abandoned camp, watchtower,
ribcage cluster). Scattered rocks/logs/crates/truck-wreck removed.

## Session L — v1.5 — Tutorial & first-time UX
NEW `src/ui/tutorial.ts`. First-boot controls panel (14 keybind rows) +
H-key reopen. Per-item pickup hints fire once across sessions via
`localStorage['dustfall.tutorial.v1']`. Debug: `__game.resetTutorial()`,
`__game.showControls()`.

## Session K — v1.5 — FPS diagnostics + shadow toggle
F1 HUD: GPU ms / CPU ms / frame ms via `EXT_disjoint_timer_query_webgl2`.
SW-render warning (WARP / SwiftShader / MS Basic). Shadow on/off setting
live-applies. Pickups + branches no longer cast shadows. Sandstorm Points
hidden when intensity ≤ 0.01.

## Session J — v1.5 — Performance + graphics quality preset
F1 HUD shows GPU name (`WEBGL_debug_renderer_info`), framebuffer res, render
scale. New `renderQuality: 'low' | 'medium' | 'high'` setting (persists to
localStorage) live-applies pixel ratio + shadow map size with no reload.

## Session I — v1.5 — Inventory & feel polish
Space jumps; G drops selected slot as a Pickup (meta preserved); 10-slot
backpack + I-key overlay (click-then-click swap); pickups auto-overflow into
backpack; canteen fillLevel as hotbar/backpack bar; raider hits trigger red
damage vignette + hurt sfx; dead fires relight with a branch; 1s craft
progress bar; death screen "you survived N days".

## Session H — v1.5 — Performance pass
InstancedMesh for 134 rocks/trunks (14 pools). Distant-shadow culling: 76
landmarks marked `userData.farFromOrigin`. Raider sight raycast cached
(0.5s). F1 perf HUD overlay (FPS / draws / tris).

## Session G — v1.5 — Fire / tents / sleep / crafting / day counter
4 new items: branch / cloth / fire_kit / tent_kit. Placeable fire
(`deployFire`, fuel + flicker + shelter zone + cooking + add_fuel),
placeable tent + sleep overlay (4h/8h advances dayTime + stat scale).
Crafting menu (C key, 3 recipes). Day counter. 5 new procedural sounds.

## Session F — v1.5 — Realism overhaul
Stats expanded to 5 (added hunger + stamina + two-way temperature replacing
heat). Canteen refillable via `Slot.meta.fillLevel`; `onUse(ctx, slot)`.
4 new world systems (water sources / cacti / lizards / loot containers).
Multi-type hover dispatch (`take` / `refill` / `search` / `harvest` / `kill`).

## Session E — v1.5 — First-person viewmodel
Hands + held item as a camera-tracking Group with `depthTest=false`.
Per-item use animations: canteen 1.2s drink-tilt, machete 0.4s thrust,
bandage 0.8s rise. SVG hotbar icons replace single-char glyphs. 5 new
procedural UI sounds.

## Session D — v1 — Raider + sandstorm + menus + persistence
Raider enemy (primitive hooded wanderer + 6-state AI). LMB combat via
swept-capsule `castShape` → `damageRaider`. Sandstorm weather. Main menu
+ pause + settings panel. `localStorage` persistence for settings.

## Session C — v1 — Inventory + look-at + shelter + audio
Inventory + look-at raycast + hotbar UI + interact prompt. Shelter zones
(AABB registry). Procedural Web Audio (wind / footsteps / pickup / drink).

## Session B.5 — v1 — Lighting + shadows + sky
PCFSoft shadows + follow-player shadow camera. Visible sun disc. Gradient
sky shader. Mid-day brighter. Wreckage / mesa / canteen polish.

## Session B — v1 — Terrain + hero landmarks
Simplex heightmap + heightfield collider. Improved primitives. 4 hero
landmark types: ribcage / truck / tower / obelisk (truck removed in P).

## Session A — v1 — Module refactor + Rapier
Single-file prototype split into systems. Rapier physics + collisions.
Kinematic character controller capsule.

## Session v0 — 1-hour prototype
Flat sand, primitive landmarks, click-to-play.
