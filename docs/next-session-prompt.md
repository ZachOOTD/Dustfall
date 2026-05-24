# Session ABI — Kickoff Brief (post-ABH)

## Read these now (in order)

1. `CLAUDE.md` (auto-loaded)
2. `docs/session-end-report.md` — cumulative state through ABH
3. `docs/changelog.md` — ABH entry at top + ABB-ABG just below
4. `docs/decisions.md` — D105–D107 (BackSide cavity render, Journal.kind
   discriminator, procedural shader vocab as formal D3 extension)
5. `docs/roadmap.md`
6. `docs/backlog.md`

## What's already built

62 sessions. Tactile salvage + 6 narrative journals + 3 procgen wreck
classes with breach patches + 5 weapon variants + procedural world
seed-stable + 4 procedural shader factories covering all major surface
types. R-key reload, crafting categorization, wind-shimmer fabric, 5
flagship lore voices, panel interior visibility fix all landed in the
ABB-ABH arc. Texture overhaul (ABH) was the most recent big-ticket —
zero new texture files, all detail via shader vocab.

## Suggested focus (pick one)

### Big-ticket (single session, 4-10h)

- **Multi-worm population** (~3-4h medium). Closes AAP scope-cut. Needs
  schema bump (sandWorm singleton → sandWorms[]), per-worm
  min-separation logic, playtest sweep for early-game balance. Highest
  gameplay-impact per hour.
- **Sandworm encounter depth** (~3-5h). Ambush state, retreat-and-stalk
  loop, weakness/feeding behavior, dawn/dusk surfacing. Combinable with
  multi-worm as a multi-session arc.
- **Infinite chunk streaming** (~6-10h). The last major architectural
  lift. Lazy 800m chunk gen at boundaries; free farthest chunks; per-
  chunk seed derivation; GPU memory budget. Save bump v10→v11.
- **Biome-specific POI kinds** (~6-8h). Salt = corroded scientific
  outpost, rocky = subterranean entrance, dune = buried cockpit. Breaks
  AAQ composition-only pattern (D93) — requires new POI modules per
  biome.
- **megaWreck rebuild** (~4-6h). BB-2 era model is visually behind the
  rest of the world (pre-OO procedural shaders). Rebuild with higher
  fidelity + better silhouette + apply ABH metal/paint shaders.

### Medium (~2-4h)

- **Salvage thermal-cut tier** — fire-starter as alternative pry tool
  (AAR backlog).
- **megaWreck catwalk panels 3 + 4 reachability** — ABE shipped 1
  ground panel; the 2 catwalk-mounted ones still require stairs.
- **Comm-relay third cluster kind** — satellite_dish + tower + debris
  layout (AAQ follow-on).
- **Procgen biome-bias on recipe pick** — salt = corroded short
  corvettes, dune = freighters (ABC follow-on).
- **More flagship NPC beats** — hostile raider holdouts, friendly
  hermit NPCs at flagships (ABF shipped journals; NPC beats remain).

### Polish / quick wins (~1-2h)

- **Saved companion huddle state** — additive v10→v11 with
  `companion.huddleState?`.
- **Saved journal read/unread state** — ABF follow-on; additive
  v10→v11 with `journalReadKinds?: JournalKind[]`. Dim the interact
  prompt for read journals.
- **Wood-grain procedural shader** — D107 vocabulary extension for
  sled planks + locker body (currently bare Lambert).
- **Stamina tow factor playtest + tune** — current 2.0× drain may
  discourage sled travel.
- **Speeder spin angular damping playtest** — ABA's 2.5/s damping
  verification.
- **Music tuning** — AAP shipped 3 procedural tracks; needs playtest.

## Autonomy contract

When ambiguous, pick the option closest to the GDD pillars +
decisions.md realism dial (D45+, D49, D67, D86–D107), append a new
D-entry, keep going.

Stop conditions: wall-clock limit, 3-strike fix wall, catastrophic
block, destructive-action attempt.

## Notable footguns (carried + new)

- **ABG BackSide rendering** (D105): when adding new "open cavity"
  primitives, follow the addAccessPanel pattern — clone material with
  `side: BackSide` + `shadowSide: FrontSide`, module-cache the clone.
  Don't make the mesh invisible (raycast skips invisible meshes).
- **ABF Journal.kind discriminator** (D106): the canonical pattern for
  "many entities, one interaction handler, varying content" is
  `userData.interactSubKind` (set in placeFn) → surfaces as
  `info.subKind` in interaction.ts → looked up in a
  `Map<Kind, Content>` exported from the UI module. Use this for any
  new tagged-content system.
- **ABH procedural shader vocabulary** (D107): zero-texture-files
  policy is now formal. Future surfaces use existing factories
  (metalMaterial, paintMaterial, stoneMaterial, skinMaterial,
  fabricMaterial, terrainMaterial, hullMaterial, concreteMaterial)
  or extend with a new factory following the onBeforeCompile +
  IQ-hash + world-space-FBM pattern. Don't ship texture files.
- **ABC procgen variants need panel anchors for salvage**: hullSegment
  variants 3 (PANELED_TAPERED) + 4 (OPEN_TRUSS) have `panelAnchor:
  null`. A wreck composed entirely of these + cockpit + tail might
  end up with zero panels (panel-bearing parts only). Recipe ensures
  at least 1 panel-eligible part via cockpit (all 3 cockpit variants
  have anchors).
- **ABA light pool sized at 24**. If a session adds many simultaneous
  light sources, bump the pool size in `src/main.ts`. Pool exhaustion
  is graceful (no illumination but no crash).
- **AAB legacy preview_screenshot blocker**: canvas 0×0 in hidden
  tabs. Per `dustfall_preview_gotchas.md`: use data-driven
  verification via preview_eval (mesh-signature inspection, geometry
  parameter dumps, panel position bounds).
- **Save schema v10**. Recipe id 16 next per D71. If a session needs
  to persist new state (multi-worm, saved companion huddle, saved
  journal-read), bump additively per D81.

## Verification protocol

```
npm run verify     # = tsc --noEmit
npx vite build     # production-build sanity
```

For substantial features:
1. Boot game, exercise the feature.
2. Save + reload roundtrip if persisted state changed.
3. Multi-seed sanity if the change touches world generation.

Preview screenshot tool is blocked for in-game camera views (per the
gotchas memory). Use preview_eval + mesh-signature inspection for
data-driven verification.

## Begin block

Read CLAUDE.md (auto), session-end-report (current state through ABH),
recent changelog (ABH + ABG + ABF entries — they're long), decisions
D105-D107. Pick focus from the menu above. TaskCreate sub-tasks. Start
coding.
