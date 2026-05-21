# Dustfall — Session-end report

Cumulative state. Rewritten end-to-end at each `/session-end`. A
reviewer who's never seen the project should be able to read this +
`CLAUDE.md` + `docs/GDD.md` and understand where Dustfall is.

**Current state**: Session SS shipped (2026-05-20). First framework-
managed session post-retrofit. tsc clean. Working tree has uncommitted
changes pending the user's git decision (see `## Commit handoff` at
the bottom).

---

## Tier progress table

Dustfall opts out of the gamedev-framework v0.3.x tier-ladder structure
(see `docs/roadmap.md` framework note). The project is **17 sessions
past MVP** and operates on a per-session "Big-ticket bucket + Polish"
model. Retroactive tier mapping for orientation only:

| Era | Sessions | Status | What it proved |
|---|---|---|---|
| Tier 0 — Foundations | A–H | ✓ shipped | Browser runtime, Rapier, GameContext spine, procedural world |
| Tier 1 — Vertical slice | I–W | ✓ shipped | Inventory, crafting, interactions, opening scene, journal |
| Tier 2 — Target | X–CC | ✓ shipped | Audio architecture, atmosphere, speeder, animated title |
| Tier 3 — Expected | DD–PP | ✓ shipped | Sand worm boss, weapon variants, procgen POIs, biome rework |
| Tier 4 — Stretch / polish | QQ–SS | ✓ in progress | Sled mechanic, sandworm rescale, opening wreck redo + playtest |

**Verify status**: `npm run verify` = `tsc --noEmit`. Single check
(no tier breakdown). Currently PASS.

---

## What works end-to-end (singleplayer flow)

Fresh-game start (the de-facto Tier 1 — Session W shipped):

1. **Boot title**: animated 3D title scene (Session CC-3) with a pod
   shooting-star + landing on a hero dune. NEW GAME / CONTINUE
   buttons. CC0 stems are wired but `.ogg` files not sourced yet —
   game boots in soft ambient silence with procedural wind layered in.
2. **Opening cinematic**: player spawns ~4.5m in front of the new
   opening-wreck rebuild (Session RR + Session SS DoubleSide fix).
   Camera lookAt at the torn rear entrance. The wreck is a tapered
   cockpit + tail-stub silhouette with a 30° stress-fracture skylight
   running the upper hull. Inside: skeleton slumped at cockpit front,
   journal at its outstretched hand, tally marks on the curved
   interior wall, ash pile + branch stubs + empty canteen as
   environmental storytelling. Reads as "the last occupant".
3. **First interactions**: pickup E to take items from the floor; E on
   the journal to read the opening note; E on the rear-hull salvage
   panel (2 panels registered as `'fuselage'` kind in RR — 2-3 rolls
   each).
4. **Speeder**: parked ~12m from the wreck entrance with a deliberate
   yaw aimed at the SW. Mountable via E on the seat (Session CC-2,
   D39 singleton-interactable pattern). Hover physics via PD
   terrain-tracking (D34 velocity-controlled). Has a `speederTowBar`
   mesh behind the seat for rope attachment (Session QQ-2).
5. **Survival loop**: thirst/heat/hunger/stamina/health all decaying
   on time-elapsed. Canteen drinks from a well in the salt-flats
   biome (Session CC-4 — single well at salt centroid, D45). Fire
   warms + cooks meat (fire_kit deploys via E from inventory). Tent
   sleeps off dayTime + cools temperature.
6. **Combat**: 5 weapons across 3 kinds (PP):
   - `machete` — melee, 1.8m, 0.45 dmg
   - `pipe_staff` — melee, 2.6m, 0.55 dmg + 3m knockback
   - `scrap_gun` — ranged, 30m raycast, 1.5 dmg, 6-round mag
   - `energy_pistol` — charged ranged, 18m, 0.50→2.00 dmg over 1.2s
     hold
   - Sand worm exempt from knockback (240m → 120m body in QQ-2 still
     too massive to budge)
   Lizards (1 HP) one-shot from any weapon. Sand worm boss (Session
   DD + MM rescale + QQ-2 halving) takes 12 hits, sensor collider
   (D48) so no contact-impulse exploits.
7. **Sled mechanic** (Session QQ + QQ-2): craft rope (2 cloth + 1
   branch) + sled_kit (2 scrap + 1 branch + 1 rope). Deploy sled.
   Wield rope, click sled rope-stub to tie. Inextensible rope
   constraint (D67) — slack = no force, taut = position-snap +
   velocity project. Locked rotation + manual yaw to face the
   anchor. Bidirectional cargo: open sled for two-pane CARGO + YOU
   transfer. Mount speeder while tethered → auto-promotes tether
   to `speederTowBar`.
8. **Save / load**: single-slot localStorage (`dustfall.save.v1`),
   `SAVE_VERSION = 5`. Death does not auto-save (D10). Continue
   restores player + speeder pose, journal state, all sled tethers
   + cargo, salvage progress, harvested cacti, dead lizards, sand
   worm state.

---

## What's freshly shipped (Session SS deltas)

**Fix**: `_hullMat` and `_hullDarkMat` in `src/world/openingWreck.ts`
now set `side: THREE.DoubleSide` + `shadowSide: THREE.FrontSide`.
This unbroke the cockpit interior — RR's eval-only verification missed
that the procedural rust shader returned a `MeshLambertMaterial` with
default `FrontSide`, which back-face-culled the 22 lathe slices when
viewed from inside. Players walking in via pointer-lock would have
seen "open desert + floating debris" instead of the enclosed hull.
See D69 for the full architectural rule.

**Polish**: entrance torn-fragments reduced from 7 evenly-distributed
to 4 upper-biased + one-flank-clustered. Was reading as a "saw-blade
crown around rim"; now reads as asymmetric torn metal. Fragment plate
size slightly bumped (`w: 0.55+rand*0.55` was `0.35+rand*0.45`).

---

## Known issues / partials

- **No source audio files yet**: `public/audio/*.ogg` slots are wired
  via Session X's stem architecture but not committed. The soundscape
  has procedural fallbacks but the full atmospheric experience is
  pending CC0 sourcing. See `docs/backlog.md` [feat] entry.
- **Skylight god-ray subtlety**: the 30° stress-fracture gap admits
  real sunlight, but without atmospheric dust scattering the
  interior beam isn't visually dramatic at midday. Looks OK at
  golden hour. Possible polish: add a volumetric-fog-pass for the
  beam visual (deferred — would need a new shader pass).
- **`docs/session-end-report.md`** (this file) is brand new at
  Session SS. Older sessions don't have a per-session retro entry —
  only the cumulative state above. The plans-archive directory has
  per-session frozen retros from before the retrofit.
- **Older-session screenshots in `docs/playtest-shots/`** (SS-01
  through SS-07) — debug artifacts from the SS playtest. Useful
  evidence; small (~2MB). Not strictly state.

---

## Constants worth tuning

Recent ones (session-tagged):

| Constant | Session | Default | Notes |
|---|---|---|---|
| `OPENING_WRECK_HULL_LEN` | RR | 6.0 | Tapered fuselage length |
| `OPENING_WRECK_SLICE_COUNT` | RR | 24 | Angular slices (15°/slice) |
| `OPENING_WRECK_SKYLIGHT_SLICE` | RR | 17 | First slice to omit; SS skips 17+18 for 30° gap |
| `SLED_TOW_DISTANCE` | QQ-2 | 5.0 | Inextensible rope length |
| `SLED_TOW_MAX_DIST` | QQ-2 | 10.0 | Hard snap-detach threshold |
| `SLED_YAW_LERP` | QQ-2 | 0.12 | Manual visual yaw lerp toward anchor |
| `STAMINA_TOW_FACTOR` | QQ | 2.0 | Sprint stamina drain × this while tethered on foot |
| `SANDWORM_LENGTH` | QQ-2 | 120 | Was 240 in MM; halved per playtest direction |

---

## Suggested next session (1-3 directions in priority order)

1. **Crafting rework** — combine up to 4 items to discover recipes
   (no grid); chooser when multiple recipes match the same inputs.
   Replaces the current bloating `RECIPES` array. Most recent
   backlog add, scoped at one session. Files:
   `src/ui/craftingMenu.ts`, probably new
   `src/inventory/recipeDiscovery.ts`. Touches no combat or physics
   so blast radius is contained.
2. **Control scheme overhaul** — modern-survival-game parity, LMB-
   leaning (hold to drink, click to place kits, etc.). Touches every
   per-item `onUse` plus `combat.ts` + `interaction.ts`. Highest
   blast radius of the bucket.
3. **Small red creature companion** — pocketable + re-deployable,
   no combat surface area. Mirrors lizard visual/AI shape; reuses
   the speeder velocity-follow idiom. Was the pre-RR recommendation.

The top pick (crafting rework) is the recommended default for
Session TT.

---

## Time spent

19 sessions shipped, ~4-7h each = ~80-130h elapsed game-development
time across roughly 3 weeks of calendar time. Session SS itself was
a short polish session — ~1h post-RR-rebuild verification + fix.

---

## State at session end

- **Git status**: working tree dirty (uncommitted) per "Commit handoff"
  below. Branch: `master`.
- **Last commit**: `7c36699` retrofit step 7 (delete local skills).
  Session SS work is uncommitted as of writing.
- **Tags on origin**: `session-A` through `session-RR`, with sub-tags
  (`session-BB-2`, `session-CC-3`, etc.). `session-SS` not yet tagged.
- **Ports bound**: none (preview server stopped at end of playtest).
- **Save state**: ephemeral (Session SS save was eval-driven; no
  persisted save expected to survive).

---

## Token spend this session (estimated)

Rough estimate (Claude doesn't expose live counts to the agent):

- Input: ~150K-200K tokens (heavy reads — decisions.md is now 80KB,
  changelog 100KB; multi-file reads + preview tool roundtrips)
- Output: ~30K-50K tokens (one full openingWreck.ts edit, one
  decisions.md append, multiple smaller edits, screenshots base64
  decode pipeline)
- Cached input: substantial (CLAUDE.md, recent files re-read across
  turns)
- Cost (Sonnet 4 rates, rough): $0.50-$1.20

Not flagged — within baseline range for a polish session.

---

## Commit handoff

See `/session-end` step 12. Dustfall's CLAUDE.md does not have a
`## Git policy` section, so default = **print-hints mode**. Commands
printed in the user-facing summary; user authorizes per-turn.
