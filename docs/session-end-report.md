# Dustfall — Session-end report

Cumulative state. Rewritten end-to-end at each `/session-end`. A
reviewer who's never seen the project should be able to read this +
`CLAUDE.md` + `docs/GDD.md` and understand where Dustfall is.

**Current state**: Session ZZ shipped (2026-05-21). 27 sessions
post-MVP. tsc clean. Overnight era (UU-ZZ, 7 sessions): UU-XX
(original 5-session queue) + YY (visual half of perceivedIntensity
split) + ZZ (audio half — soundscape now coherent with the visual
dampening). Working tree dirty pending the user's commit.

---

## Tier progress table

Dustfall opts out of the gamedev-framework v0.3.x tier-ladder structure
(see `docs/roadmap.md` framework note). The project is post-MVP and
operates on a per-session "Big-ticket bucket + Polish" model.
Retroactive tier mapping for orientation only:

| Era | Sessions | Status | What it proved |
|---|---|---|---|
| Tier 0 — Foundations | A–H | ✓ shipped | Browser runtime, Rapier, GameContext spine, procedural world |
| Tier 1 — Vertical slice | I–W | ✓ shipped | Inventory, crafting, interactions, opening scene, journal |
| Tier 2 — Target | X–CC | ✓ shipped | Audio architecture, atmosphere, speeder, animated title |
| Tier 3 — Expected | DD–PP | ✓ shipped | Sand worm boss, weapon variants, procgen POIs, biome rework |
| Tier 4 — Stretch / polish | QQ–XX | ✓ in progress | Sled, sandworm rescale, opening wreck redo, crafting rework, control scheme overhaul, hygiene/crosshair, RMB context verbs, HUD micro-polish, larger enterable tent + save v7 |

**Verify status**: `npm run verify` = `tsc --noEmit`. Single check
(no tier breakdown). Currently PASS.

---

## What works end-to-end (singleplayer flow)

Fresh-game start (the de-facto Tier 1 — Session W shipped):

1. **Boot title**: animated 3D title scene (Session CC-3) with a pod
   shooting-star + landing on a hero dune. NEW GAME / CONTINUE
   buttons.
2. **Opening cinematic**: player spawns ~4.5m in front of the
   redesigned opening wreck (Session RR + SS DoubleSide fix). Tapered
   cockpit + tail-stub silhouette, 30° stress-fracture skylight
   running the upper hull. Inside: skeleton + journal at cockpit
   front, tally marks on the curved interior wall, ash pile + branch
   stubs + empty canteen.
3. **First interactions**: pickup LMB (UU), journal E, salvage panel E.
4. **Speeder**: parked ~12m from the wreck entrance. Mountable via E
   (Session CC-2). Has a `speederTowBar` mesh for rope attachment
   (Session QQ-2).
5. **Survival loop**: thirst/heat/hunger/stamina/health all decaying.
   Canteen drinks **hold-LMB continuously** (UU) — one gulp per
   0.7s of hold. Wells in salt-flats refill the canteen via E (D45).
   Fire + tent placement via **LMB-click** (UU) — 2.2m forward
   ghost would help here (deferred, see backlog). Sleep skips
   dayTime + cools temperature.
6. **Combat**: 5 weapons (Session PP — machete, pipe_staff, scrap_gun,
   energy_pistol, plus scrap_bullet ammo). LMB swings/fires; combat
   is now invoked FROM `wieldAction.ts` (UU) when the equipped item's
   `wieldLmb === 'attack'`. Lizards 1-shot from any weapon. Sand worm
   boss (Session DD + MM rescale + QQ-2 halving) takes 12 hits;
   sensor collider (D48); 120m body / 10m radius.
7. **Sled mechanic** (Session QQ + QQ-2): craft rope + sled_kit
   (now via the combine-to-discover UI, D70). Wield rope, click
   sled rope-stub to tie — wieldAction.ts marks rope as `wieldLmb:
   'none'` so this code path stays in `interaction.ts` (it needs
   hover-state to dispatch). Inextensible rope constraint (D67) —
   slack = no force, taut = position-snap + velocity project.
   Locked rotation + manual yaw. Bidirectional cargo via the loot
   menu's `allowDeposit` mode.
8. **Crafting** (Session TT rework): open the menu (C). 4 input
   slots — click bag rows to add items, click input slots to remove.
   Output preview shows `?` for unknown-valid combinations, the
   actual output icon for discovered ones, "nothing happens" for
   invalid. CRAFT button is a DOM-LMB (overlay-gated by UU's
   wieldAction so it doesn't double-fire any in-world action).
9. **Save / load**: single-slot localStorage (`dustfall.save.v1`),
   `SAVE_VERSION = 6`. Death does not auto-save (D10). Continue
   restores player + speeder pose, journal state, sled tethers +
   cargo, salvage progress, harvested cacti, dead lizards, sand worm
   state, AND `inventory.discoveredRecipes`. New in UU:
   `slot.meta.holdProgress` is STRIPPED on serialize so a save
   captured mid-drink doesn't resume drinking on reload.

---

## What's freshly shipped (Session YY deltas)

The scope-cut #1 from XX, realized. Storm visual dampening
distinguishes large tent (open-front, partial dampening) from small
tent / fire (legacy fully-enclosed kill):

- **`weather.perceivedIntensity`** field added to the Weather
  interface. Player-context-aware storm intensity (vs.
  `intensity` which stays the world-truth).
- **`ShelterZone.isLargeTent?`** flag added. `addShelterZone`
  accepts new `opts?: { isLargeTent }` parameter. `largeTent.ts`
  passes `{ isLargeTent: true }` when registering its zone.
- **`updateShelter`** walks zones once via new `classifyShelter`
  helper, writes perceivedIntensity per the routing rule.
- **`weather.ts` dust layers + `stormVignette.ts`** read
  `perceivedIntensity` instead of `intensity` (and drop the binary
  `inShelter` override — it's baked into perceivedIntensity now).
- **Fog + stats + AI stay on `intensity`** (world-truth).

Decision D79 (placeholder reserved in plan; now realized; friction-2).
New Tuning constant `LARGE_TENT_STORM_DAMPEN = 0.4`. Backlog now
notes the audio extension as a future polish item.

## What's freshly shipped (Session XX deltas)

Final session of the overnight queue. New ItemId, new world entity,
save schema bump:

- **`large_tent_kit`** ItemId + ItemDef (wieldLmb='place', LMB to
  deploy). Recipe id 10 (cloth×4 + branch×3 + rope×1).
- **`src/world/largeTent.ts`** (new ~250 LOC) — mirrors tent.ts but
  with a walk-in 3-walled cabin (back + 2 sides + roof + 4 corner
  posts + front lintel; front face open). Shelter zone covers
  interior cavity only — player must be inside to get the warmth
  bubble. D80 documents the "two modules vs. parameterized" call.
- **`packUpLargeTent(ctx, tent)`** mirrors UU-2's `packUpTent`:
  atomic, inventory-full refuse, **plus** refuses if player is
  currently inside the tent (toast "can't pack — you're inside the
  tent" — don't yank shelter out from under the player).
- **`ctx.largeTents.list`** added to GameContext; initialized in
  main.ts.
- **`interaction.ts`** gains a `'largeTents'` registry case — same
  'sleep' hover verb so E opens the sleep overlay identically.
- **`wieldAction.ts` `handleContextAction`** extended to iterate
  `ctx.largeTents.list` when `hover.type === 'sleep'`. RMB pack-up
  works for both small + large tents.
- **`SAVE_VERSION 6 → 7`** (D81 — additive only). New optional
  `largeTents?: Array<{id, pos, rotationY}>` on SaveV1. Loader
  accepts v1-v7; pre-v7 saves load with empty large-tents array.

**Scope-cut #1 taken**: `weather.perceivedIntensity` split deferred.
Large tents already shelter via the ShelterZone mechanism (cold
drain etc.) but storm visuals inside the tent stay at full
intensity. Backlogged as a future polish item.

Decisions D80 (clone-not-parameterize, friction-2) + D81 (save
migration additive discipline, friction-3) logged.

## What's freshly shipped (Session WW deltas)

HUD micro-polish — three visible-at-first-boot wins:

- **`src/ui/statVignette.ts` (new)** — CSS-overlay vignettes (D78
  vs. clone-not-abstract). Two divs: `#stat-vignette-cold` blue,
  `#stat-vignette-thirst` brown. Linear opacity ramp to 0.35 as
  the stat worsens past threshold. Suppressed during peak storm
  (intensity > 0.7) so the stormVignette has the screen.
- **`src/player/staminaWobble.ts` (new)** — sin-driven camera
  jitter when stamina < 0.2. Two desynced sines (X base, Y at
  1.37× freq + phase offset, half amp). Caps at 0.04m at 6Hz.
  Mounted-suppressed. Ticks AFTER `updatePlayer` so the
  camera-anchor runs first.
- **`#interact-prompt` CSS** — opacity transition bumped 0.15s →
  0.12s ease-out (snappier feedback per brief spec).

Decision D78 logged (CSS overlay vs. in-scene shader; friction-1).

## What's freshly shipped (Session UU-2 deltas)

RMB layer on top of UU's LMB scheme. Power-user verbs:

- **`handleContextAction(ctx)`** in `src/player/wieldAction.ts` — runs
  between mount-gate and the LMB switch. Reads `mousePressed.has(2)`
  + `ctx.inventory.hover`. RMB on tent (`hover.type === 'sleep'`) →
  `packUpTent`. RMB on sled (`'open_sled' | 'attach_rope'`) with
  `sled.tether.kind === 'speeder'` → `detachRope(ctx, sled,
  'rope released')`. All overlay/mount/isPlaying gates inherited.
- **`packUpTent(ctx, tent)`** in `src/world/tent.ts` symmetric to
  `deployTent`. Atomic: tries `addItem('tent_kit')` FIRST; if -1
  (inventory full), aborts BEFORE touching scene/shelter/list +
  toasts "no room in your bag". On success: removeShelterZone,
  scene.remove, splice list, toast "tent packed".
- **Sled rope release via RMB**: reuses existing `detachRope`. No
  new function; just dispatch wiring.
- **CONTROLS table refresh** in `src/ui/tutorial.ts:44-59`. Captures
  the new LMB scheme + RMB additions + Q-as-backup. HINTS table
  also updated: canteen "hold LMB to drink", kits reference
  LMB-click + RMB pack-up.

Decision D77 logged (RMB as additive power-user verb, friction-2).

## What's freshly shipped (Session VV deltas)

Palette-cleanser between UU and UU-2. Three discrete improvements:

- **fire.ts constants → `Tuning.FIRE_*`**: 5 constants lifted
  (`FIRE_INITIAL_FUEL_S`, `FIRE_FUEL_PER_BRANCH_S`,
  `FIRE_SHELTER_RADIUS_M`, `FIRE_SHELTER_HEIGHT_M`,
  `FIRE_NEAR_DISTANCE_SQ`). Values unchanged.
- **tent.ts constants → `Tuning.TENT_*`**: 2 constants lifted
  (`TENT_SHELTER_HALF_X/Y/Z`, `TENT_NEAR_DISTANCE_SQ`). The
  `TENT_SHELTER_HALF` object remains as a local readability helper
  composing the Tuning fields.
- **Crosshair feedback** (`src/style.css` + `src/ui/interactPrompt.ts`):
  `#crosshair` gains `.interactable` (brighter + larger middle-dot)
  and `.kill` (red + larger) modifier classes. `updateInteractPrompt`
  now ALSO toggles these classes from `ctx.inventory.hover`. Cached
  DOM ref + last-state guard for cheap per-frame transitions.
- **`as any` cleanup**: lone cast in `src/world/wrecks.ts:137`
  replaced with direct property assignment. `eslint-disable` line
  dropped. **`Grep "as any" src` returns 0 matches** as of VV.

Decision D76 logged (friction-0 — pure CLAUDE.md rule compliance).

## What's freshly shipped (Session UU deltas)

**Control scheme overhaul — LMB-leaning** replaces "E for everything"
with a click-driven scheme. Detailed breakdown:

- **New module**: `src/player/wieldAction.ts` (~125 LOC) is the SOLE
  LMB-while-wielded dispatcher (D73). All gates (overlay-open,
  speeder-mounted, isPlaying) live in one file. `updateCombat` is
  invoked from here when the equipped item's `wieldLmb === 'attack'`;
  removed from `main.ts`'s direct tick.
- **Schema change**: optional `wieldLmb?: 'attack' | 'place' |
  'hold_use' | 'click_use' | 'none'` field on `ItemDef` (D74).
  Default `'click_use'`. Per-item overrides: weapons `'attack'`;
  canteen `'hold_use'`; kits `'place'`; torch/flashlight/rope
  `'none'`.
- **Hold-LMB sustained drinking**: new `ItemDef.onHoldTick` hook
  (canteen only); state lives in `slot.meta.holdProgress` (D58
  pattern, HMR-safe). One gulp per `Tuning.CANTEEN_DRINK_INTERVAL_S =
  0.7`s. Each gulp drains `CANTEEN_DRINK_DELTA` (0.25), restores
  thirst proportionally, plays drink+pour audio, fires the existing
  tip-to-lips viewmodel anim.
- **LMB-click placement** for fire_kit / tent_kit / sled_kit. Reuses
  each kit's existing `onUse` (deployFire/deployTent/deploySled);
  wieldAction just routes the LMB event. Q-key still triggers
  `onUse` via inventory.ts (backward compat).
- **LMB-take a hovered ground pickup** when wielding a non-attack
  item. E-press take logic removed from `interaction.ts`'s case
  `'pickups'`. The hover-state setup (p.hovered=true, hover.type=
  'take') stays in interaction.ts so wieldAction can find the
  hovered pickup.
- **`[E]` chip auto-hides** for `hover.type === 'take'`:
  `VERBS['take'] = ''` makes the existing "hide chip when verb is
  empty" path fire. Player sees just the noun ("branch") with no
  key chip — the UU-2 controls panel refresh communicates the
  LMB-to-take rule.
- **Placement distance unified**: `Tuning.PLACEMENT_DISTANCE_M = 2.2`
  (D75) lifts fire.ts's previously-1.5m + tent.ts/sled.ts's 2.2m to
  a single constant. Fire deploys 0.7m further out than before — a
  perceptible feel change.
- **Verb table tightening** (UU.5): `VERBS['search'] = 'open'` for
  loot containers (was "search"; loot containers OPEN, not search).
- **Save schema preserved**: `SAVE_VERSION` stays at 6.
  `slot.meta.holdProgress` stripped in `cloneSlot()` so transient
  input state never persists.
- **Decisions D73-D75** logged: (D73) wieldAction.ts dispatcher
  architecture, friction-4. (D74) wieldLmb field on ItemDef,
  friction-3. (D75) PLACEMENT_DISTANCE_M unification, friction-1.

**Verification (eval-driven preview)** confirmed every UU surface:

- ✓ Hold-LMB drinking: 2 gulps over 2.1s, thirst restored 0.3 → 0.94,
  fill drained 1.0 → 0.5, holdProgress cleared on release.
- ✓ LMB-place fire_kit: 1 fire deployed at the player's forward 2.2m,
  kit consumed.
- ✓ LMB-take pickup (branch): pickup despawned, count +1.
- ✓ Weapon LMB doesn't take pickups (machete equipped → combat path).
- ✓ Overlay gate: controls panel open → hold-LMB does NOT drink
  (thirst stayed 0.3 across 1s of mock-held).
- ✓ Mounted gate: speeder.mounted=true → hold-LMB does NOT drink
  (combat owns LMB).
- ✓ Save round-trip: localStorage save lacks `holdProgress` key,
  fillLevel preserved, version still 6.
- ✓ Rope wieldLmb='none' static check confirms QQ-2 path intact.

---

## Known issues / partials

- **No ghost-preview mesh on LMB-place** (UU scope-cut #1 in plan;
  not cut — just deferred for tighter scope). Players see "fire lit"
  toast as feedback, no pre-place visual indicator of where the
  kit will land. Backlog.
- **Pickup prompt copy is sparse**: post-UU, looking at a ground
  pickup shows just the noun ("branch") with no verb or key chip.
  The UU-2 controls-panel refresh will document LMB-to-take. A
  refined "[click] take noun" prompt was a scope-cut candidate in
  UU; deferred. Backlog candidate.
- **No source audio files yet** (`public/audio/*.ogg`). Soundscape
  has procedural fallbacks; full atmospheric experience pending CC0
  sourcing.
- **Skylight god-rays subtle**: opening wreck's 30° gap admits real
  sunlight, but without atmospheric dust scattering the interior beam
  isn't visually dramatic at midday. Possible polish via volumetric
  fog pass — deferred.
- **No "recipe book" panel yet**: combine-mode UI is discover-only;
  no list view of discovered recipes. Deferred TT stretch.
- **Opening wreck pointer-locked walk-in not yet playtested by a
  human**: eval-driven verification passed, but the actual "walk
  through the torn entrance" experience still hasn't been tried.
  Worth a quick boot before the next polish session.

---

## Constants worth tuning

Recent ones (session-tagged):

| Constant | Session | Default | Notes |
|---|---|---|---|
| `PLACEMENT_DISTANCE_M` | UU | 2.2 | All kit deploys (fire/tent/sled) — D75 |
| `CANTEEN_DRINK_INTERVAL_S` | UU | 0.7 | Time between hold-LMB gulps |
| `OPENING_WRECK_HULL_LEN` | RR | 6.0 | Tapered fuselage length |
| `OPENING_WRECK_SLICE_COUNT` | RR | 24 | Angular slices (15°/slice) |
| `OPENING_WRECK_SKYLIGHT_SLICE` | RR | 17 | First slice to omit; SS skips 17+18 |
| `SLED_TOW_DISTANCE` | QQ-2 | 5.0 | Inextensible rope length |
| `SLED_TOW_MAX_DIST` | QQ-2 | 10.0 | Hard snap-detach threshold |
| `SLED_YAW_LERP` | QQ-2 | 0.12 | Visual yaw lerp |
| `STAMINA_TOW_FACTOR` | QQ | 2.0 | Stamina drain × this while tethered on foot |
| `SANDWORM_LENGTH` | QQ-2 | 120 | Halved from MM's 240 |
| `RECIPES` array | TT | 9 entries | Stable numeric ids 1-9; new recipes append at id ≥ 10 |

---

## Suggested next session (1-3 directions in priority order)

The overnight queue is closed. Open options:

1. **Storm visual dampening inside large tent** (the scope-cut #1
   deferred from XX, ~1-1.5h). Add `weather.perceivedIntensity`
   field; updateShelter sets it to `intensity * LARGE_TENT_STORM_DAMPEN
   = 0.4` when player is in a large-tent shelter. Wire stormVignette
   + ambientDust + (optionally) soundscape to read perceivedIntensity
   instead of intensity. Storm physics + stats keep reading intensity
   (world-state stays authoritative). Decision D79 (placeholder
   reserved in the plan) becomes its actual entry.
2. **Post-mortem of the overnight run** — five sessions in a row
   produced recurring patterns worth promoting to gamedev-framework
   shared-memory:
   - "Centralized dispatch on equipped-item predicate" (wieldAction.ts
     D73 + RMB extension D77)
   - "Clone-not-abstract for N=2-3 callers" (D78 + D80)
   - "Additive-only save migration discipline" (D81)
   - "slot.meta for HMR-safe transient state" (D74 onHoldTick)
   Run `/gamedev-framework:post-mortem` to evaluate.
3. **Audio sample stems** (.ogg sourcing) — architecture exists
   since Session X; blocked on asset-pipeline external dependency.
   Not actionable without source files.

Pick whichever feels right. The codebase is in excellent shape: tsc
clean, 0 `as any`, save schema v7 with full migration coverage, all
5 overnight sessions verified end-to-end.

---

## Time spent

26 sessions shipped (A–YY). Approx ~93-148h elapsed dev time across
roughly 3 weeks of calendar time. Overnight queue (UU through XX)
ran in one continuous push of ~8-10h, landing 5 sessions clean.
YY was a tight ~45min follow-on session realizing XX's deferred
scope-cut #1 (perceivedIntensity split). Total overnight-era haul:
6 sessions, 9 D-entries (D73-D81 from overnight + D79-realization
in YY).

---

## State at session end

- **Git status**: working tree dirty (uncommitted). Branch: `master`.
- **Last commit**: `01b4eb5` (Session TT) on origin/master.
- **Tags on origin**: `session-A` through `session-TT`. `session-UU`
  not yet tagged.
- **Ports bound**: none (preview server stopped at end of UU verify).
- **Save state**: localStorage has a v6 save written during UU
  verification (canteen partially depleted, one fire deployed near
  spawn, one branch pickup-taken).

---

## Token spend this session (estimated)

Rough estimate (Claude doesn't expose live counts to the agent):

- Input: ~180K-220K tokens (plan-mode exploration with 3 Explore +
  1 Plan agent, then session-start state reads, items.ts in chunks,
  combat.ts, types.ts, main.ts, interaction.ts, tuning.ts, save.ts,
  inventory.ts, input.ts, fire.ts, tent.ts, multiple preview-eval
  rounds, session-end doc reads)
- Output: ~35K-50K tokens (5 multi-paragraph plan-file edits, 11
  items.ts edits, new wieldAction.ts module, multiple .md docs
  rewrites, D-entries D73-D75, changelog, next-session-prompt)
- Cached input: substantial (CLAUDE.md, decisions.md, items.ts
  re-read across turns)
- Cost (Opus 4.7 rates, rough): $2-$5

Flagged as **above baseline** — the plan-mode exploration phase
front-loaded most of the cost; the implementation phase was tight.
For the overnight queue (VV → UU-2 → WW → XX), expect lower per-
session token costs since the architecture is now established and
the file map is mostly familiar.

---

## Commit handoff

User pre-authorized per-session commit + tag + push for this
overnight run (plan file: `.claude/plans/i-want-to-set-floating-dusk.md`,
"Commit cadence: per-session commit + tag (Recommended)"). Skill
will execute commit + `git tag session-UU` + push to origin in the
final step.
