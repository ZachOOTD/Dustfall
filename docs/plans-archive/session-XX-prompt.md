# Session XX — Kickoff Brief

## Read these now (in order)

1. `CLAUDE.md` (auto-loaded) — project manual, current state, architecture rules
2. `docs/session-end-report.md` — cumulative state through Session WW
3. `docs/decisions.md` — D1-D78. Critical for XX: **D71 (recipe id stability)** — XX adds recipe id 10, must NOT renumber 1-9. **D75 (PLACEMENT_DISTANCE_M)** — large_tent_kit deploys via the same constant. **D80 (this session)** — distinct module vs. parameterized tent.ts.
4. `docs/roadmap.md` — "Overnight queue" — XX is the FINAL session
5. `docs/backlog.md` — open items

## What's already built

Dustfall is 24 sessions past start, post-MVP. UU shipped LMB-leaning
control scheme; VV shipped tuning lifts + crosshair feedback; UU-2
shipped RMB context verbs; WW shipped HUD micro-polish (stat
vignettes + stamina wobble + prompt fade). Codebase is clean: 0
`as any`, save schema v6, tsc clean.

## Session XX focus

**Larger enterable tent — `large_tent_kit`** (~3h). A second tent
variant: deploys as a structure with **interior volume** the player
can walk into. Inside, sandstorm intensity is dampened (visual +
audio + gameplay shelter zone). Player can sleep inside as with the
small tent. Replaces the current "tents are surface markers you
sleep next to" feel with "tents are shelters you actually enter."

This is the **only session in the overnight queue authorized to bump
SAVE_VERSION**. Migration is additive: pre-v7 saves load with an
empty large-tents array.

## Priority items (in order)

1. **`large_tent_kit` ItemDef + recipe** (~25 min).
   - Add `'large_tent_kit'` to the `ItemId` union in
     `src/inventory/types.ts`.
   - Add the ItemDef to `_DEFS` in `src/inventory/items.ts`:
     `wieldLmb: 'place'`, `onUse` calls `deployLargeTent(ctx)`.
     Visual: scale up the small tent_kit viewmodel by 1.5×.
   - Add recipe to `RECIPES` in `src/inventory/recipeDiscovery.ts`
     with `id: 10`, inputs `[cloth×4, branch×3, rope×1]`,
     output `large_tent_kit`. **DO NOT** renumber existing ids 1-9
     (D71 contract).
   - Acceptance: `getItemDef('large_tent_kit')` returns valid def;
     craft 4 cloth + 3 branch + 1 rope → CRAFT yields a
     large_tent_kit; recipe id 10 added to `discoveredRecipes`.

2. **`src/world/largeTent.ts`** (new module, ~1h — bulk of session).
   - Mirror `src/world/tent.ts` but with a walk-in interior:
     - Geometry: ~3.5m × 2.5m × 2.2m frame, 4 wood posts at corners,
       cloth walls/roof draped over.
     - Front face is the open entrance (no collider) — player walks
       in from the side facing them at deploy time (use the same
       `dir` math as `deployTent` for rotation).
     - Colliders: 3 walls (back + 2 sides) + roof. Player capsule
       fits inside.
     - Interior shelter zone: smaller than the footprint (the
       interior cavity, not the tent's external bounding box).
   - Export `deployLargeTent(ctx)` symmetric to `deployTent` —
     reject if too close to another large tent.
   - Export `packUpLargeTent(ctx, tent)` symmetric to `packUpTent`
     in tent.ts (UU-2). Atomic: addItem first, refuse on -1.
     **Plus** refuse if the player is currently inside (toast:
     "can't pack — you're inside the tent").
   - New Tuning constants:
     `LARGE_TENT_*` for dimensions, shelter half-extents,
     near-distance reject.
   - Acceptance: deploy via LMB-click on wielded `large_tent_kit`,
     walk into the tent (player capsule fits), sleep via E.

3. **Sandstorm dampening when inside** (~45 min).
   - Add `perceivedIntensity: number` field to `ctx.weather` (next
     to `intensity`).
   - In `updateShelter` (`src/shelter/shelterZones.ts`): when the
     player is inside a large-tent shelter zone, set
     `ctx.weather.perceivedIntensity = ctx.weather.intensity *
     Tuning.LARGE_TENT_STORM_DAMPEN` (suggest 0.4). Otherwise
     `perceivedIntensity = intensity` (default).
   - Update the systems that should attenuate visually: `stormVignette`
     reads `perceivedIntensity` instead of `intensity`; `ambientDust`
     reads `perceivedIntensity` for in-storm visibility. Storm
     physics (e.g., thirst drain, sandworm aggression triggers) keeps
     reading `intensity` so the world state is authoritative.
   - D79 will document this split.

4. **Save schema migration v6 → v7** (~30 min).
   - Bump `SAVE_VERSION` in `src/persistence/save.ts` from 6 to 7.
   - Add `largeTents?: Array<{ id, pos, rotationY }>` to the save
     schema (optional so pre-v7 loads have an empty array).
   - On serialize: push current `ctx.largeTents.list` entries.
   - On load (v6 or earlier): default `ctx.largeTents.list = []`.
   - On load (v7+): replay `spawnLargeTentAt(ctx, pos, rotationY)`
     for each entry.
   - **CRITICAL**: This migration MUST be additive only — do not
     rearrange any existing save schema fields, do not remove
     anything. Pre-v7 saves must load cleanly.
   - Acceptance: save a game with a large tent deployed → reload →
     tent restored. Load a pre-v7 save (manually edit version to
     6, remove largeTents field) → loads cleanly with empty list.

5. **UI / interaction polish** (~30 min — stretch).
   - When player approaches a large tent, prompt: "[E] enter tent"
     if outside, "[E] sleep" if inside (the existing tent sleep
     prompt). RMB on the tent from outside packs it up (per UU-2's
     dispatch).
   - Distinguish small vs. large tent in the hover prompt noun
     (e.g., "small tent" vs. "shelter tent").

## Stretch goals (if budget allows)

- Variant tent geometry — e.g., taller pole in the center to give
  visual hierarchy with the small tent.
- Audio: ambient inside-tent sound layer (wind muffled). Blocked on
  .ogg assets (Session X architecture).

## Autonomy contract

- When ambiguous: pick the option closest to GDD pillars + D80 (two
  modules cheaper than one parameterized). The collider geometry
  diverges enough that the per-piece pattern doesn't generalize.
- **CRITICAL footgun**: recipe id 10 is the next free id (D71). DO
  NOT use any id from 1-9, even if "they look unused" — they're
  load-bearing in existing save files.
- **CRITICAL footgun**: save schema migration MUST be additive only.
  Test pre-v7 load before declaring done.
- Never ask the human mid-session.

## Stop conditions (overnight mode)

- All 4 (or 5 with stretch) priority items shipped + verify passes
  → `/session-end`.
- 3-strike wall → `/scope-cut` against pre-committed list in
  `.claude/plans/i-want-to-set-floating-dusk.md` Session XX section.
- Catastrophic block → halt + write CAUTION in next-session-prompt.
- Destructive action attempt → halt unconditionally.

## Pre-committed scope cuts (cut top-first)

1. **Sandstorm dampening logic** (sub-task 3). Cut means the large
   tent is just a bigger shelter geometry with sleep affordance — no
   `perceivedIntensity` split. Save schema bump still happens.
2. **Save schema migration to v7** (sub-task 4). Cut means large
   tents do NOT persist across save/load — they reset each load.
   **High player-visible cost.** Only cut if migration becomes its
   own 3-strike wall.
3. **Pack-up integration with UU-2's `packUpTent` extension**. Cut
   means large tents are one-way deployable (matches pre-UU-2 small
   tent behavior).
4. **Interior geometry refinement** (cloth draping, post details).
   Cut means a boxy "shed" silhouette ships; document as polish
   deferral.
5. **XX entirely** (nuclear option). Cut means UU+VV+UU-2+WW ship
   and large tent goes back to backlog. Triggered if sub-tasks 1-2
   hit a 3-strike wall (half-shipping a save-schema bump for an
   unfinished feature is the worst outcome).

## Notable footguns

- **D67 (sled inextensible rope)** unaffected.
- **D71 (recipe id stability)** — large_tent_kit gets id 10. NEVER
  reuse 1-9. Never renumber.
- **D74 (wieldLmb)** — large_tent_kit gets `wieldLmb: 'place'`,
  mirrors fire_kit / tent_kit / sled_kit.
- **D75 (PLACEMENT_DISTANCE_M = 2.2)** — large_tent_kit deploys via
  the same constant.
- **Save migration** — test with both fresh-game (no save) AND
  pre-v7 save loads. The full save round-trip is the critical
  verification gate.

## Verification protocol

```
npm run verify  # = tsc --noEmit
```

Plus eval-driven preview verification:
1. tsc clean.
2. Open crafting menu, drop 4 cloth + 3 branch + 1 rope into inputs
   → CRAFT consumes inputs + produces large_tent_kit + recipe id 10
   added to `discoveredRecipes`.
3. Wield large_tent_kit → LMB → tent deploys at 2.2m (D75).
4. Walk into the tent → player capsule fits inside.
5. Press E inside → sleep overlay opens.
6. Outside the tent → look at it → RMB → tent packs to inventory
   (refuses if player is inside).
7. Trigger storm (`__game.triggerStorm()` or set
   `ctx.weather.intensity = 1`) while inside large tent → screen
   vignette + ambient dust visibly attenuated (perceived intensity
   ≈ 0.4 × actual).
8. Save game → reload → tent restored. `SAVE_VERSION` reads 7 in
   localStorage.
9. (Optional) Load a pre-v7 save (delete largeTents field, set
   version: 6) → loads cleanly with empty list.

## Begin block

Read CLAUDE.md → `docs/session-end-report.md` → `docs/decisions.md`
(especially D71 + D75). Create TaskCreate top-level list with the
4-5 priority items. Mark item 1 (`large_tent_kit` ItemDef + recipe)
as `in_progress`. Read `src/inventory/items.ts` (small tent_kit + sled_kit
references), `src/inventory/recipeDiscovery.ts`, and
`src/world/tent.ts` first — the small-tent module is the structural
template.
