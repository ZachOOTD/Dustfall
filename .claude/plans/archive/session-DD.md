# Session DD-2 — Sand worm redesign: roaming Dune-style ambush

## Context

DD-1 shipped a stationary boss-tower worm at a fixed XZ. Playtest revealed
two problems:

1. **It doesn't feel like a sandworm.** A vertical pillar with a glowing
   weak-point ring doesn't evoke Dune / Shai-Hulud. The weak point reads
   as unrealistic UI.
2. **Combat is static.** The worm rises, stands still, bites in place,
   sinks. Player and worm trade hits without movement — no sense of being
   hunted in the open desert.

DD-2 redesigns the worm as a **roaming underground predator** that swims
through sand, surfaces only briefly, and orchestrates a multi-phase
attack loop with telegraphed warnings.

Visual reference: Dune's Shai-Hulud — long segmented body, no head,
just a circular toothed maw; surfaces in arcs; leaves sand wakes. We're
keeping it scaled for first-person combat (25m long, not 400m).

## Scope split

This is split across two sessions.

**DD-2 (this session, ~7-9h)** — mechanics:
- New mesh: long horizontal body, lamprey maw, no weak-point ring
- 7-state behavior loop with movement (patrol → alert → charge → lunge → retreat → stationary_breach → dead)
- Lunge arc above sand (the actual attack)
- Stationary breach as warning posture
- Combat: hit anywhere on visible body, uniform damage, hits only count during lunge + stationary_breach
- Save/load: persist live worm position (since it now roams) + state collapse on load
- Minimal audio reuse: existing playWormRoar/playWormChomp wired into the new states

**DD-3 (next session, ~4-5h)** — polish:
- Sand wake mound visual under the worm during charge (Tremors-style)
- Sand-vibration particles near player when worm is in detection range
- Distant-breach event during patrol (worm visibly arcs out 60m+ away as world flavor)
- Layered proximity audio (low rumble grows as worm closes)
- Pre-breach mound (1s telegraph before lunge surfaces)

The split keeps DD-2 shippable in one session and saves the high-risk
visual effects for a dedicated polish pass.

## Goals (DD-2)

1. Worm has a home anchor; patrols ~60m radius around it when player is absent.
2. When player enters detection range (50m), worm enters a continuous attack cycle.
3. Attack cycle: charge underground → lunge above sand (arc) → retreat → repeat.
4. Every 3rd attack is a stationary_breach (vertical rise) instead of a lunge — gives a different read on the same threat.
5. Player can only damage the worm during lunge or stationary_breach windows. Any hit anywhere on the visible body = 1.0 dmg.
6. Player disengages by fleeing past 80m from worm — worm returns to patrol.
7. Save/load persists position + state + health + looted; restoring during attack cycle collapses to patrol.

## Design

### New mesh — horizontal long body with lamprey maw

Build the worm along **local +X** as the length axis (head at +X tip, tail at -X tip). This makes horizontal movement natural: `mesh.rotation.y = atan2(-forward.z, forward.x)` aligns the body along the direction of travel. Lunge pitch applied via `mesh.rotation.z`.

Mesh structure (all in a `THREE.Group`):

```
SandWorm.mesh (length-axis = local +X)
├── segments[0..11]    — 12 ring segments, 2m long each, stacked along +X
│                       — radii: head 1.0m → peak 2.0m at idx 4 → tail 0.4m
│                       — each segment: CylinderGeometry rotated 90° on Z
│                                       (so its length-axis becomes +X)
│                       — ridge plates: TorusGeometry on each segment joint
├── maw (parented to segments[0], at +X tip)
│   ├── outerRing      — wide dark cone, open end facing +X (the maw entrance)
│   ├── teeth[0..15]   — 16 small inward-pointing cones (concentric rings)
│   └── innerThroat    — small dark sphere deep inside
└── tail               — short narrow cone at -X tip
```

Total length: ~24m. Max radius: 2m. Lamprey/leech aesthetic — no mandible plates, no weak-point ring. The maw reads as a circular ring of teeth on the head end.

Body palette: same as DD-1 (sand `#a89878` body, dark `#5c4a32` ridges). Maw interior `#1a0e0a` with subtle emissive `#401408` so it reads as a dark cavity even in shadow.

### State machine

```typescript
type SandWormState =
  | 'patrol'
  | 'alert'
  | 'charging'
  | 'lunge'
  | 'stationaryBreach'
  | 'retreat'
  | 'dead';
```

State details:

- **patrol** — underground (mesh hidden). Slowly traces a circular path at radius `PATROL_RADIUS × 0.7` around the home anchor, speed `PATROL_SPEED = 3 m/s`. Heading rotates around the circle. Transitions: player enters `DETECTION_RADIUS = 50m` from worm's current position → alert.

- **alert** — underground, hidden. Picks target = current player XZ. Moves toward target at 6 m/s for `ALERT_DURATION = 1.2s`. Plays `playWormRoar()` at entry (audible-warning that the worm has noticed the player). Transitions: alert duration elapsed → charging. Or: player flees past `DISENGAGE_RADIUS = 80m` → retreat-to-patrol.

- **charging** — underground, hidden. Snapshot `chargeTarget = playerPos + playerVel × 1.0s` (lead the player; recompute every 0.5s while charging). Move toward chargeTarget at `CHARGE_SPEED = 12 m/s`. Burst small puffs every 0.15s at the worm's current surface position for "wake hint" (full wake mound is DD-3). Transitions: within `LUNGE_RANGE = 6m` of player → lunge. Or: overshoots target (player moved out of arc) → retreat.

- **lunge** — visible, the actual attack window. Worm arcs out of the sand: y interpolates above ground in a parabola (peak `BREACH_ARC_PEAK = 6m` at midpoint), `rotation.z` pitches +0.6 rad on rise, -0.6 rad on descent. Mesh moves forward 8-10m during the arc. Duration `LUNGE_DURATION = 1.8s`. At t=0.9 (peak), check `dist(player, wormBodyMidpoint) <= BITE_RANGE = 4m` → apply `BITE_DAMAGE = 0.35` + flash + chomp audio + toast `'the maw passes over you'`. Mesh visible, collider live + rotated to match pose. Transitions: arc complete → retreat.

- **stationaryBreach** — visible, alternative to lunge. Worm rises straight up at current position. `rotation.z` goes to +π/2 (vertical, head pointing up). Y interpolates from underground to `groundY + 8m`. Holds vertical for `STATIONARY_BREACH_DURATION = 3.0s`. No bite damage (this is intimidation + an attack window for the player). Transitions: duration elapsed → submerge into retreat.

- **retreat** — underground, hidden. Pick retreat point = playerPos + (worm→player vector × -1) × `RETREAT_DISTANCE = 25m`. Move toward retreat point at `RETREAT_SPEED = 8 m/s`. On arrival: increment encounter cycle counter. If `cycle % STATIONARY_EVERY === 0` (every 3rd attack) → stationaryBreach; else → alert. If player has fled past `DISENGAGE_RADIUS` during retreat → patrol.

- **dead** — final corpse pose at last position. Mesh sinks halfway, laid on its side (rotation.z = π/2 + small jitter), maw visible. Tag children as `'take'`. Persists across save/load.

### Movement system

Worm has a kinematic body. Each frame:
1. Compute new position based on current state's velocity vector and `dt`.
2. Snap `mesh.position` and `body.position` to it.
3. Compute heading `forward = (chargeTarget - worm.pos)` and align `mesh.rotation.y = atan2(-forward.z, forward.x)`. (Lizard pattern from `lizard.ts:223`.)
4. For lunge/stationary_breach, apply additional `mesh.rotation.z` (pitch).

When underground (patrol, alert, charging, retreat): set worm Y to `groundY - UNDERGROUND_DEPTH = -5m`, mesh hidden, collider moved far below ground so machete can't hit.

When above sand (lunge, stationaryBreach): mesh visible, collider repositioned + rotated to match pose.

### Combat

Simplified from DD-1's three-zone system:

```typescript
function damageSandWorm(worm: SandWorm, _hitY: number, ctx: GameContext): void {
  // Guard — hits only count when the worm is above sand.
  if (worm.state !== 'lunge' && worm.state !== 'stationaryBreach') return;
  worm.health -= 1.0;
  if (worm.health <= 0) { worm.health = 0; transitionToDead(worm, ctx); return; }
  ctx.ui.showToast('the blade bites into chitin');
}
```

`hitY` is no longer used for zone classification — leave the param in the signature to keep `combat.ts` dispatch unchanged. `SANDWORM_MAX_HEALTH = 6.0` so 6 hits to kill.

Collider during attack states is a capsule, repositioned + rotated to follow the worm's pose. Single capsule approximates the long body — not perfect for a 25m worm but sufficient for the brief attack windows (the visible portion during lunge is ~12m of body + half off the ground, well-covered by one rotated capsule with halfHeight=6m, radius=2m).

### Tuning block — replace DD-1 block in `tuning.ts`

```typescript
// Sand worm (Session DD-2) — roaming Dune-style ambush. Patrols a home
// zone underground; attacks in lunge arcs out of the sand.
SANDWORM_HOME_POS: { x: 60, z: 0 },        // anchor for patrol circle
SANDWORM_PATROL_RADIUS: 60,                // m — patrol circle radius
SANDWORM_DETECTION_RADIUS: 50,             // m — player triggers alert at this dist from worm
SANDWORM_DISENGAGE_RADIUS: 80,             // m — player escapes by exceeding this
SANDWORM_PATROL_SPEED: 3,                  // m/s — slow patrol traversal
SANDWORM_ALERT_SPEED: 6,                   // m/s — orienting movement
SANDWORM_CHARGE_SPEED: 12,                 // m/s — rush at player (player sprints 7.1)
SANDWORM_RETREAT_SPEED: 8,                 // m/s — disengage movement
SANDWORM_ALERT_DURATION: 1.2,              // s — windup before charging
SANDWORM_LUNGE_RANGE: 6,                   // m — trigger lunge when this close to player
SANDWORM_LUNGE_DURATION: 1.8,              // s — arc duration above sand
SANDWORM_BREACH_ARC_PEAK: 6,               // m — peak Y of lunge arc above ground
SANDWORM_STATIONARY_BREACH_DURATION: 3.0,  // s — vertical hold during stationary breach
SANDWORM_STATIONARY_BREACH_HEIGHT: 8,      // m — how high above ground the head rises
SANDWORM_STATIONARY_BREACH_EVERY: 3,       // every Nth attack is stationary
SANDWORM_RETREAT_DISTANCE: 25,             // m — distance to retreat before next attack
SANDWORM_BITE_RANGE: 4.0,                  // m from worm body center for bite to land
SANDWORM_BITE_DAMAGE: 0.35,                // unchanged from DD-1
SANDWORM_MAX_HEALTH: 6.0,                  // 6 machete hits to kill
SANDWORM_LENGTH: 24,                       // m — total body length head-to-tail
SANDWORM_MAX_RADIUS: 2.0,                  // m — peak body radius (segment 4)
SANDWORM_UNDERGROUND_DEPTH: 5,             // m below ground while submerged
```

Remove from DD-1: `SANDWORM_SPAWN_POS, SANDWORM_TERRITORY_RADIUS, SANDWORM_BREACH_DELAY, SANDWORM_BREACH_DURATION, SANDWORM_EMERGED_DURATION, SANDWORM_SUBMERGE_DURATION, SANDWORM_SUBMERGE_COOLDOWN, SANDWORM_BITE_COOLDOWN, SANDWORM_HEAD_DIP_WINDOW, SANDWORM_DORMANT_Y_OFFSET, SANDWORM_EMERGED_HEIGHT`.

### Save/load schema update

Current `SaveV1.sandWorm` shape:
```typescript
sandWorm?: { state: SandWormState; health: number; looted: boolean; }
```

New shape:
```typescript
sandWorm?: {
  state: SandWormState;
  health: number;
  looted: boolean;
  pos: V3;       // current world position — worm now roams
}
```

Save handling: write the worm's current `basePos` plus state/health/looted.

Load handling:
- If saved state is `dead`: apply corpse pose at saved pos.
- Else: collapse to `patrol` at saved pos (no need for breach delay since patrol is the neutral state). Discard mid-encounter substate — too brittle to restore mid-arc.

`SaveV1` stays at version 1 (additive `pos` field; old saves without `pos` collapse worm back to `HOME_POS` on load — graceful fallback).

### Reusable patterns referenced

- **Lizard +X-forward yaw**: `src/enemies/lizard.ts:223` — pattern `Math.atan2(-fleeDir.z, fleeDir.x)` for aligning a +X-modeled mesh to a direction vector. Use the same convention.
- **Speeder kinematic body update**: `src/world/speeder.ts` — translation/rotation update each frame on a kinematic body.
- **Lizard tag/untag**: `src/enemies/lizard.ts:51-65` — copy-paste shape for retagging the corpse as `'take'`.
- **Existing particle pool**: keep `makePuffPool` + `burstPuffs` + `updatePuffs` from DD-1; reuse for the breach burst.
- **DD-1 corpse + loot path**: `damageSandWorm` lethal handler + `applySandWormDeadPose` + `lootSandWorm` + `interaction.ts` `'sandWorms'` case — all preserved with minimal changes (just simplify damage calc, drop hit-zone classification).

## Files to modify

| File | Change |
|------|--------|
| **REWRITE** `src/enemies/sandWorm.ts` | Replace mesh assembly (lamprey body), state machine (7 states, movement), combat (drop zones). ~600 lines. Keep: particle pool, dead-pose handler, loot helper, registry export. |
| `src/config/tuning.ts` | Replace `// Sand worm` block with DD-2 tuning (above). |
| `src/player/combat.ts` | Simplify dispatch — pass flat 1.0 dmg instead of hit-Y. Remove unused `_shapeVel.y * hit.time_of_impact` math (keep variable, just pass 0). |
| `src/persistence/save.ts` | Add `pos: V3` to `SaveV1.sandWorm`. Update save block. Update load block: dead → restore pose at pos; non-dead → patrol at pos. |
| `src/main.ts` | Update biome-verify message to read `Tuning.SANDWORM_HOME_POS` (was `SPAWN_POS`). |

**No changes** to: GameContext (slot unchanged), interaction.ts (dispatch by 'sandWorms' registry still works), audio.ts (existing roar/chomp reused), inventory types/items (worm meat unchanged), hotbar/HUD.

## Verification

1. **Type check**: `npx tsc --noEmit` clean.
2. **Boot check** (`npm run dev` + force-flag bypass per DD-1 procedure):
   - `__game.ctx.sandWorm` non-null
   - `state === 'patrol'`
   - `basePos.y` ≈ `groundY - 5`
   - `mesh.visible === false`
3. **Patrol observation**: leave the worm undisturbed for 30s. Verify it moves around the home anchor in a circle (poll `basePos` every 5s, confirm distance from home anchor stays roughly constant at `PATROL_RADIUS × 0.7 = 42m`).
4. **Alert trigger**: teleport player into 40m radius. Within 1.2s, state should transition to `'charging'`. Console should show `playWormRoar()` was invoked (or we just trust it).
5. **Lunge arc**: stand at the worm's projected charge target. Wait. Worm should arc up + over you within ~2s. Verify:
   - `state === 'lunge'` for ~1.8s
   - `mesh.visible === true` during that window
   - `basePos.y` traces a parabola from underground → peak → underground
   - `mesh.rotation.z` peaks around 0.6 then returns
   - If standing within 4m of worm at midpoint, health drops by 0.35 + damage flash + toast
6. **Damage gating**: while worm is in `'charging'` state, simulate `damageSandWorm(worm, 0, ctx)` directly — health should NOT decrement (combat-window guard). During `'lunge'`, health should decrement by 1.0 per call.
7. **Stationary breach cycle**: trigger 3 retreats in a row (force `state = 'retreat'` and `phaseStartedAt = elapsed` repeatedly). 3rd attack should pick `stationaryBreach`. Screenshot the vertical pose.
8. **Kill**: 6 calls to `damageSandWorm` during lunge → worm transitions to `'dead'` with corpse pose. Verify visible-on-side at last position, retag to `'take'`.
9. **Disengage**: from any non-dead state, teleport player to (200, 200). Within 5s, worm should be back to `'patrol'` near home anchor.
10. **Save/load round-trip**:
    - During patrol: save → reset to defaults → load. State should restore to patrol at saved pos.
    - Mid-charge: save → reset → load. State collapses to patrol at saved pos (not mid-charge).
    - Dead: save → reset → load. Corpse pose restored at saved pos.
11. **Browser screenshot** of the new mesh in stationary-breach pose (vertical worm with lamprey maw at top, no weak-point ring).
12. **Browser screenshot** of the lunge mid-arc (worm angled across the sand).

## Out of scope for DD-2 (deferred to DD-3)

- Sand wake mound rendering during charge (Tremors trail)
- Sand-vibration particles near the player when worm is in detection range
- Distant-breach event during patrol (cinematic world flavor)
- Mound rising on sand 1-1.5s before a lunge surfaces (telegraph)
- Layered proximity-based audio (rumble volume scaling with worm distance)
- Multiple worms / second worm in another biome
- Cinematic camera-shake on stationary breach
- Drum/thumper item to attract the worm

## Effort estimate: 7-9h

- New mesh assembly + maw construction: 1.5h
- State machine rewrite (7 states + transitions): 2.5h
- Movement system + kinematic body sync with rotation: 1.5h
- Lunge arc math + collider rotation: 1h
- Combat simplification + damage gating: 0.5h
- Save/load schema update + handlers: 0.5h
- Tuning constants + main.ts wiring tweaks: 0.5h
- Verification + tuning passes: 1.5h

Lower end if mesh + movement come together cleanly; upper end if collider rotation needs iteration to feel right during lunge.
