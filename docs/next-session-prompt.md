# Session ACV — Kickoff Brief

> Recent: ACT (FP footprints/hints + D109 swim sweep), **ACU (playtest pass — PBR-shimmer revert, shadow-swim
> fix, Rey outfit + full-body cloth + head smooth, #40 speed-spike, #42 sled-POI, #50 rope-leaves-inventory,
> footstep-puff FP fix, tow-handle rework, slope-slide tune)**. **The foreground bug/feature backlog is now
> CLEARED.** What remains is the big **art/animation idea wave** from the ACT idea dump — large + multi-session.
> START by scoping ONE piece (don't try to do the wave in one session).

## Read these now (in order)
1. **CLAUDE.md** (auto-loaded) — rules; note the tick order + **rule 8** (visual iteration discipline — load-bearing this session, it's all visual/animation work).
2. **docs/session-end-report.md** — top "Current state" + "ACU scope" + "Suggested next".
3. **docs/decisions.md** tail — **D154** (no derivative micro-bump on moving meshes), **D155** (shadow regen-on-move), **D156** (sled-POI shapecast), **D157** (rope deploy = both-ends-anchored via `applyTether`); plus **D150** (kinematic/feel = foreground-only), **D151** (rig bones are 3P-gated), **D107** (procedural-only — relevant if "higher-detail item models" tempts an asset import → that's a user-call fork).
4. **docs/backlog.md** — the ACT idea-dump block (bottom).
5. `shared-memory/iterative-polish-discipline.md` + `preview-screenshot-tips.md` — REQUIRED before visual work.

## What's already built
A full singleplayer desert-survival loop + a believable stylized procedural player rig (skinned, dressed in a Rey-like off-white outfit, full-body cloth, Lambert-shaded — no PBR shimmer). Footprints/audio + interact hints work in both camera modes; shadows + procedural weathering are stable while moving. Sled tow (rope leaves inventory when both ends anchored; collides with POIs; gentle slope-slide). Speeder, stake, Pebble companion, salvage panels, 2 procedural music systems, sweeping Dune storm. SAVE_VERSION 14. Verification: `npm run rig-shot` (static pose/closeup) + `--scenario` (live AI/weapon state); foreground `npm run dev` for kinematic/feel.

## Session ACV focus
Pick ONE item from the ACT art/animation wave and take it through the full rule-8 build→screenshot→critique→iterate loop. Suggested ordering (highest player-visible value first):

## Priority items (pick ONE; in rough value order)
1. **Speeder dust trail + engine-ignition FX** (`speeder.ts` + a particle/quad system like `footprintPuffs.ts`/`ambientDust.ts`). Speed-gated dust under/behind the bike while driving; engines visibly light on throttle. Self-verifiable via a `--scenario` harness shot (it's render-state, not kinematic-feel). Good first scope — contained, high-impact.
2. **Lizard + shrew walk gaits** (`enemies/lizard.ts`, `enemies/shrew.ts`) — leg/body gait while moving (mirror the player rig's absolute-time gait pattern), + **shrew burrow** dig-in/out animation composing with flee/idle. Screenshot/scenario-verify.
3. **Higher-detail item models + 3P hand placement + 3P use-anims** (`inventory/items.ts` makeViewModel + `playerRig.ts` `rightHandAttach` + a 3P use-animation hook). **NOTE the D107 fork**: "higher-detail" via more procedural geometry is in-bounds; importing art assets is a user-call (surface it).
4. **Seated 3P speeder rig + camera** (`speeder.ts` + `playerRig.ts` + the 3P cam) — a proper seated stance pose while mounted + a speeder-specific 3P camera.
5. **Dynamic salvage-panel placement on procgen POIs** (HEAVIEST — its own design spike first): place `addAccessPanel`s on procgen POIs at runtime without clipping through model parts/terrain, snapped to flat surfaces with valid facing. Needs a surface-finding/raycast approach before any code.

## Stretch / standing levers
- Game **lighting mood** (D142) — the biggest remaining in-game realism lever; surface to the user before a whole-scene aesthetic shift.
- PM-D cloth-physics robe (the "wrap the model in real cloth" idea — large; D107-adjacent).

## Autonomy contract
Ambiguous → GDD pillars + decisions realism dial → new D-entry → continue. Surface only on: **D107 (asset-vs-procedural fork — likely to come up on item models)**, save bumps (D81), destructive git, whole-game aesthetic shifts (lighting mood — D142).

## Stop conditions
Wall-clock / budget · 3 fix-walls on one element (cut/log) · catastrophic block · destructive attempt · **rule-8: don't mark a visual element done on `tsc`-clean alone — screenshot-iterate (5-8 rounds new / 3-5 tuning) or honestly flag it un-iterated.**

## On stop
Invoke `/session-end` (verify → changelog → CLAUDE Last-shipped → roadmap → D-entries → backlog → report → next-prompt → post-mortem → commit per Dustfall git policy + tag `session-ACV`).

## Notable footguns
- **Rule 8 is the whole game this session** — it's visual/animation work. Screenshot-iterate every element; a "long session" ships 1-2 fully-iterated elements, not 5 shallow ones.
- **D154**: no screen-space-derivative (`dFdx/dFdy`) normal bump on anything that moves/animates — it shimmers. Bake relief into geometry or use a real normal map.
- **D151**: the player rig's bone transforms are only posed in 3P (the visibility gate is a render optimization). Anything OTHER systems read off the rig (cadence, foot pos) must not assume the bones are current in FP.
- **D150**: gait/feel/kinematic-velocity behavior is FOREGROUND-only — the headless harness can't exercise it. Render-state (FX opacity, particle spawn, materials) IS harness-checkable.
- **D156/D157**: the sled POI-collision (`Tuning.SLED_POI_COLLISION`) + rope `applyTether` state machine are new + flag-gated/centralized — don't bypass them; route any new tether transition through `applyTether`.
- D107 procedural-only (asset import = user call); rule 2 magic-numbers→tuning.ts; rule 6 no innerHTML; rule 7 box depth ≥10cm. SAVE_VERSION 14.

## Verification protocol
`npm run verify` (= `tsc --noEmit`) = type gate. Visual elements: `npm run rig-shot` (+ `--scenario` for FX/AI) → screenshot → critique → iterate. Feel/kinematic: foreground `npm run dev`.

## Begin block
1. Read CLAUDE.md, session-end-report, decisions tail (D154-D157 + D150/D151/D107), backlog ACT idea block, the discipline docs.
2. `npm run verify` baseline.
3. Pick ONE priority item; if it's #3/#5, surface the D107 / design-spike fork to the user first.
4. TaskCreate sub-tasks for that element; run the rule-8 screenshot loop.
