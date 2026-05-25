# Dustfall — Session-end report

Cumulative state. Rewritten end-to-end at each `/session-end`. A
reviewer who's never seen the project should be able to read this +
`CLAUDE.md` + `docs/GDD.md` and understand where Dustfall is.

**Current state**: Session ABN shipped (2026-05-24, smaller post-
compaction scope ~1.5h). 69 sessions post-MVP. tsc clean. SAVE_VERSION
v11 unchanged (no schema changes this session — all 3 bug fixes are
pure code/shader changes; B6 + bow shell are visual-only additions).
All commits through ABN pushed to `origin/master`.

**ABN scope**: Procgen wreck family expansion + megaWreck bow shell +
3 bug fixes from user playtest report.
- **B6**: 5th procgen wreck class `bulk_hauler` (longest hull, 7-8
  parts, 3-4 panels, cargo_container loot palette). Class roulette
  4-way → 5-way (35/20/18/12/15).
- **megaWreck bow hull-shell**: half-cylinder (thetaStart=0..π) caps
  upper bow box; open underside preserves -X side entrance; matches
  aft shell ellipsoidal scale for continuous silhouette family.
  Closes ABL deferred item.
- **Bug 1**: companion follows stale pre-mount position when player
  rides speeder — new `getPlayerPos(ctx)` helper in companion.ts
  mirrors sandWorm.ts pattern (reads speeder body when mounted).
- **Bug 2 (D109)**: procedural shaders crawl on moving entities —
  added `opts.localSpace?: boolean` to skinMaterial + paintMaterial;
  applied to companion + sandworm + lizard + speeder. Static surfaces
  keep world-space sampling for coherent weathering.
- **Bug 3**: cloth + bandage viewmodels expand during player movement
  — added `opts.disableShimmer?: boolean` to fabricMaterial; applied
  to cloth + bandage viewmodels (camera-relative world-coord
  displacement was animating against player movement).
- **Deferred**: 1 of 4 triage entries — "stale fire+cloth POI" —
  code-only inspection couldn't pinpoint; needs user to identify.
10 files, 4 commits. D109 added.

---

## Tier progress table

Dustfall opts out of the gamedev-framework v0.3.x tier-ladder structure
(see `docs/roadmap.md` framework note). The project is post-MVP and
operates on a per-session "Big-ticket bucket + Polish" model.

| Era | Sessions | Status | What it proved |
|---|---|---|---|
| Tier 0 — Foundations | A–H | ✓ shipped | Browser runtime, Rapier, GameContext spine, procedural world |
| Tier 1 — Vertical slice | I–W | ✓ shipped | Inventory, crafting, interactions, opening scene, journal |
| Tier 2 — Target | X–CC | ✓ shipped | Audio architecture, atmosphere, speeder, animated title |
| Tier 3 — Expected | DD–PP | ✓ shipped | Sand worm boss, weapon variants, procgen POIs, biome rework |
| Tier 4 — Polish + breadth | QQ–ABN | ✓ ongoing | Sled, crafting rework, control overhaul, creature companion, long-storm countdown, procgen world, salvage tactile pry+extract+conditions, procgen wreck system (now 5 classes), fire grill multi-cook, narrative journals, texture-overhaul shader vocabulary, biome-specific POIs (dune cockpit + salt outpost + rocky entrance), sandworm bait-and-strike feeding loop, comm-relay cluster, v11 schema, dropped-item physics, megaWreck rebuild (now aft + bow shell), shader-crawl fix for moving entities (D109) |

**Verify status**: `npm run verify` = `tsc --noEmit`. Single check
(no tier breakdown). Currently PASS.

---

## What works end-to-end (singleplayer flow)

1. **Boot title**: animated 3D title scene (CC-3) with a pod
   shooting-star + landing on a hero dune. NEW GAME / DEV MODE
   buttons. Advanced disclosure for typing a custom uint32 seed
   (per-seed worlds — AAI).
2. **Opening cinematic**: player spawns ~4.5m in front of the
   redesigned opening wreck. Tapered cockpit + tail-stub silhouette,
   30° stress-fracture skylight running the upper hull. Inside:
   skeleton + journal at cockpit front, tally marks on the interior
   side wall, ash pile + branch stubs + empty canteen. Companion
   (AAE — Rocky-inspired) deployed 3m camera-right. **ABN**:
   companion follows speeder in real time when player mounts (was
   chasing pre-mount position). Companion's crystalline carapace
   pattern now stays anchored to the body as it walks/rolls (D109).
3. **First interactions**: pickup E, journal E (per-kind content via
   ABF Journal.kind discriminator).
4. **Speeder**: parked ~12m from the wreck entrance. Mountable via E.
   **ABN**: paint chips + drip streaks now stay anchored to hull as
   speeder moves (D109 — no more crawling texture).
5. **Survival loop**: thirst/heat/hunger/stamina/health all decaying.
   Canteen drinks hold-LMB continuously. Wells in salt-flats refill
   via E. Fires/tents/sleds/bedrolls/lanterns/lockers/grill — all
   LMB-click placement with ghost preview ring. Sleep cools temp;
   respects shelter state.
6. **Combat**: 5 weapons. LMB swings/fires; combat dispatched from
   `wieldAction.ts`. R-key reload for scrap_gun. Lizards 1-shot; sand
   worm boss 12 hits (sensor collider, 120m body). All weapons render
   with metal shader. **ABN**: sandworm + lizard skin patterns now
   stay anchored to body as they move (D109).
7. **Sled mechanic**: craft rope + sled_kit. Rope wield + click sled
   rope-stub to tie. Inextensible rope constraint.
8. **Crafting**: combine-to-discover via 4-slot multiset. 16 recipes
   shipped (added scrap_bar AAR). Categorization sub-headers (ABE).
   Partial-match suggestions (AAV). Recipe Book panel TAB-key. First-
   recipe discovery fanfare.
9. **Salvage**: tactile pry+extract flow. Equip scrap_bar, hold E
   ~0.85s to pry door, E-presses extract components. Per-component
   loot mapping. Condition tiers (corroded/standard/pristine). All
   flagship panels migrated to addAccessPanel (ABA P3). ABG BackSide
   body fix makes cavity interior visible.
10. **Cooking**: equip raw meat → E on lit fire to start cook (3.5s).
    Grill attachment raises per-fire cap to 4 parallel cooks.
11. **Long Storm**: escalating storm schedule day 0 → 6 plateau day
    7+. HUD countdown indicator.
12. **POI narrative**: 5 lone-survivor journals at hand-modeled
    flagships, plus W-era opening journal. Per-kind content via
    Journal.kind discriminator (D106).
13. **Procgen wrecks** (ABA P7 → ABC → ABD → ABJ → **ABN**):
    composite wreck system. Part vocabulary: cockpit (3 variants),
    hullSegment (5 variants), engineModule (2 variants), tailStub
    (2 variants). Decoration: breach patches (~41% of eligible
    hulls). **5 wreck classes** (corvette / gunship / freighter /
    science_vessel / **bulk_hauler ← ABN**); class roulette
    35/20/18/12/15. PROCGEN_COMPOSITE_SHARE 0.50.
14. **Biome POIs**: dune buried cockpit (ABJ), salt corroded outpost
    + rocky subterranean entrance (ABK). Dispatch dune→salt→rocky.
15. **megaWreck** (ABL rebuild + **ABN bow extension**): aft hull-
    shell (ABL) + bow hull-shell (ABN, half-cylinder thetaStart=0..π
    preserves -X entrance) now read as one continuous silhouette
    family. All 8 salvage panels + shelter zone + journal intact.
16. **Save / load**: single-slot localStorage. `SAVE_VERSION = 11`
    (ABM additive `droppedPickups`; ABN added no schema fields).

---

## What's freshly shipped (ABN delta)

- **`src/world/procgenWreck.ts`** (+55/-9): bulk_hauler class added,
  class roulette expanded to 5-way, salvage palette dispatch updated.
- **`src/world/megaWreck.ts`** (+25/-0): bow half-cylinder shell
  added in parallel to aft shell block; attached to bowGroup for
  terrain-Y tracking.
- **`src/enemies/companion.ts`** (+27/-3): new `getPlayerPos(ctx)`
  helper; replaces direct `ctx.player.body.body.translation()` read.
  Plus `localSpace: true` on both createSkinMaterial calls.
- **`src/world/skinMaterial.ts`** (+18/-4): added `localSpace?` opt
  to SkinMaterialOpts + conditional vertex-shader replace.
- **`src/world/paintMaterial.ts`** (+18/-4): same pattern.
- **`src/enemies/sandWorm.ts`** (+10/-2): `localSpace: true` on both
  body skin materials.
- **`src/enemies/lizard.ts`** (+6/-2): same.
- **`src/world/speeder.ts`** (+5/-2): `localSpace: true` on hull mats.
- **`src/world/fabricMaterial.ts`** (+34/-9): added `disableShimmer?`
  opt to new FabricMaterialOpts interface; conditional shimmer +
  conditional shader-ref registration + local-space sampling branch.
- **`src/inventory/items.ts`** (+8/-3): `disableShimmer: true` at
  cloth + bandage viewmodel call sites (5 createFabricMaterial calls).
- **`docs/backlog.md`** triage: 4 entries from user playtest dump,
  3 of which shipped this session.
- **`docs/plans-archive/session-ABN-prompt.md`** (new): archived ABN
  brief per session-start convention.

---

## ABB-ABM deltas (condensed)

- **ABM** (B7 dropped-item rigid-body physics): Pickup gains optional
  Rapier body; spawnDroppedPickup opts arg; per-frame updatePickups;
  v11 additive `droppedPickups` save field. Player drops / craft
  overflow / pickup-swap all use bodies; seed-spawn stays static. B8
  cut + re-scoped.
- **ABL** (megaWreck visual rebuild): procedural shader vocab applied
  to all hull/rust/pipe materials. Tapered aft-section hull shell.
  6 rust bands + exposed ribs + torn fragments at mid-hull break.
  ABN extended shell to bow.
- **ABK-tail** (perf pass + bugfixes, 4 direct-paste commits):
  shaders/Rapier pre-warm at boot (14ms handoff was multi-second
  freeze); panel-glow PointLight pool (96 → 31); Lambert downgrade
  (215 StandardMat → 0); shadow map 2048 → 1024 + 6-frame cadence;
  starter swap machete → scrap_bar; pointer-lock dev guard.
- **ABK** (biome POI family closed): saltOutpost + rockyEntrance
  modules; dispatch dune→salt→rocky.
- **ABJ** (aggressive overnight 14-item bundle): v10→v11 combined
  bump (D108); biome-bias procgen recipes; 3 new shader factories
  (wood/bone/glass) extending ABH; science_vessel wreck class;
  sandworm feeding loop; 5 item viewmodel upgrades; comm-relay
  cluster; buriedCockpit (first biome POI).
- **ABI** (panel rim fix + 3 procgen panel relocations).
- **ABH** (texture overhaul): 4 new procedural shader factories
  (metalMaterial + paintMaterial + stoneMaterial + skinMaterial)
  applied across weapons + placeables + creatures. D107.
- **ABG** (panel interior visibility BackSide fix — D105; opening-
  wreck salvage panels removed).
- **ABF** (5 flagship narrative journals — D106).
- **ABE** (5-item polish overnight: tutorial hints + fabric wind
  shimmer + scrap_gun reload + crafting categorization + megaWreck
  ground-level secondary panel).
- **ABD** (breach freq tune).
- **ABC** (procgen wreck expansion: 2 hullSegment variants + gunship
  class + breach patches helper).
- **ABB** (visual audit: 3 migrated flagship panels recomputed from
  lathe profile).

## Older sessions (condensed, see changelog for detail)

- **ABA**: overnight 7-item bundle. Light-pool refactor. D101-D104.
- **AAY**: visual overhaul (tents + fabric shader + lantern +
  companion). D97-D100.
- **AAR/AAS/AAT/AAU/AAV**: salvage stack (tactile pry+extract,
  variant interiors, condition tiers, panel polish, inventory).
- **AAA-AAQ**: polish + atmosphere arc.
- **QQ-ZZ**: control overhaul, RMB context verbs, larger tent,
  crafting rework, opening wreck rebuild, sled, weapons.
- **DD-PP**: sandworm boss, weapon variants, procgen POIs, biome
  rework, terrain shader, procedural shader expansion.
- **A-CC-4**: foundations + atmosphere + speeder + animated title.

---

## Known issues / partials

- **Stale fire+cloth wreck POI** (ABN deferred triage): user reported
  but code-only inspection couldn't pinpoint which POI. Needs user
  identification (scavenger camp + opening wreck are closest
  candidates but neither is a clean match for "fire AND cloth").
- **Sandworm at procgen-seeded position**; multi-worm population still
  backlog (needs schema bump).
- **_cooks module-level state** in interaction.ts survives HMR badly.
  Hard-reload preview tab if editing.
- **megaWreck catwalk panels 3 + 4** (~11.5m up) still require stairs.
  ABE added 1 ground panel; full sweep deferred.
- **preview_screenshot tool blocked in hidden tabs** — canvas 0×0
  problem. Workarounds in `memory/dustfall_preview_gotchas.md`.
- **Item viewmodel fidelity pass** — ABJ shipped 5; ~25 ItemDefs
  remaining that could benefit.
- **Dropped-item playtest tune** — ABM defaults need in-play signal;
  friction may need bumping if items roll on slopes.

See `docs/backlog.md` for full open list.

---

## Constants worth tuning

Recent (session-tagged):

| Constant | Session | Default | Notes |
|---|---|---|---|
| Class roulette weights | ABN | 35/20/18/12/15 | 5-way procgen wreck class distribution (corvette/gunship/freighter/science_vessel/bulk_hauler) |
| `bulk_hauler` panel count | ABN | 3-4 | Richest loot density of any procgen class |
| `bulk_hauler` hullCount | ABN | 4-5 | Longest silhouette in the procgen pool (~14-21m) |
| Bow shell `scale.y` | ABN | 0.62 | Ellipsoidal flatten; matches aft shell ratio |
| `localSpace` opt (skin/paint) | ABN | true for moving entities | D109 — companion + sandworm + lizard + speeder all opt-in; static surfaces stay false |
| `disableShimmer` opt (fabric) | ABN | true for viewmodels | Cloth + bandage viewmodel call sites only; world fabric (tents) keep shimmer |
| `PROCGEN_COMPOSITE_SHARE` | ABC | 0.50 | Composite vs legacy procgen wreck mix |
| Wind shimmer amplitude | ABE | 0.5cm–4cm | calm baseline + storm peak |
| `FIRE_GRILL_MAX_PARALLEL_COOKS` | AAM | 4 | Per-fire cap with grill |
| `FLAGSHIP_SCATTER_RADIUS_MIN/MAX` | AAK | 200/800 | Flagship POI scatter band |

---

## Suggested next session (1-3 directions in priority order)

1. **A1 infinite chunk streaming** (~6-10h big-ticket). Last major
   architectural lift. Lazy 800m chunks at boundaries; free farthest;
   per-chunk seed derivation; GPU memory budget. Save bump v11→v12.
   This is the biggest remaining architectural debt.
2. **B8 generalized rope attachment, re-scoped** (~4-5h medium-big).
   Now that B7 dropped-item physics shipped (ABM), items HAVE
   positions + bodies suitable as rope anchors. Needs new UX path (no
   rope-stub on pickups) + gameplay decisions (can cloth pull a
   sled?) + Tether → Endpoint refactor.
3. **Stale fire+cloth POI** (~30 min once user identifies it). Quick
   win — needs user to name the POI then strip the content.

Top pick depends on user appetite: A1 if architecture, B8 if
gameplay, the POI fix as a low-cost warm-up.

---

## Time spent

69 sessions shipped (A through ABN). Approx ~245-310h cumulative dev
time across ~5 weeks calendar. ABN itself was a tight ~1.5h session
(post-context-compaction, deliberately smaller scope than overnight).

---

## State at session end

- **Git status**: working tree dirty (this session-end's docs updates
  about to be committed). Branch: `master`. Through `ab86e0d` pushed
  to origin.
- **Last commit**: `ab86e0d` (ABN: triage 4 backlog entries + archive
  ABN session brief) — session-end commit will follow.
- **Last tag**: `session-ABM` (per ABM session-end). No tag for ABN
  yet — user runs `git tag session-ABN` if desired.
- **Ports bound**: none.
- **Save state**: localStorage v11 (ABM). ABN made zero save-schema
  changes; any v11 save loads identically.

---

## Token spend this session (estimated)

ABN was a tight post-compaction session — most of the conversation
was the inherited context summary + 3 small tasks (session-start +
4 bug fixes + session-end). Rough estimates:

- Input: ~80-110K tokens (compacted summary + 3-4 file reads per
  task + grep results)
- Output: ~25-40K tokens (file edits + summary responses + this
  session-end rewrite)
- Cached input: substantial (CLAUDE.md, system reminders re-read)
- Cost (Opus 4.7 rates, very rough): $5-9 for ABN itself

Within normal range. Did NOT burn ≥2× baseline.

---

## Commit handoff

Print-hints mode (Dustfall CLAUDE.md does not have `auto-commit: on`).
ABN's 3 work commits already pushed; this session-end commit will be
the 4th and final ABN commit. Commands surfaced as the final step.
