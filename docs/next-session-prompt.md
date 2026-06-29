# ▶ RESUME — Escape-pod intro · Phase 1 REDESIGN · the CYLINDRICAL pod exterior (C11) — `campaign/escape-pod-intro`

**Cycle 11 of the escape-pod-intro campaign.** Phase 1 (the hero pod). **The user steered (C10): the
boxy pod is rejected — REDESIGN cylindrical.** The new identity is locked (D271, user AskUserQuestion):
a **VERTICAL RIVETED ALUMINUM CAPSULE/TORPEDO**. C11 rebuilds the EXTERIOR; C12 rebuilds the interior to
match; then T1.3 (seated camera) → Phase 1 milestone. Boot from `docs/campaign/campaign-state.json` +
`docs/roadmap.md` (NOT chat memory).

## Read first
1. `CLAUDE.md` (auto-loaded) — "Where we are now"
2. `docs/decisions.md` **D271** — the identity change (box → vertical riveted aluminum capsule/torpedo)
3. `docs/research/escape-pod-cylindrical.md` — the LIVE reference (the riveted-torpedo + Vostok/Soyuz candidates; orientation analysis). `escape-pod-design-variety.md` §B (box) is now HISTORICAL.
4. `src/world/escapePodIntro/podScene.ts` — `placeCrashedPodWreck` (the box exterior to REPLACE) + `buildPodScene` (the box interior — C12 redoes it) + the contracts (`getPodSpawn`/`setDescentProgress`/`setParachuteLeverPull`/`removeCrashedPodWreck`/`disposePodScene`) + `createRustedHullMaterial` usage.

## The new identity (D271 — LOCKED by the user)
**A vertical riveted aluminum capsule/torpedo:**
- **Silhouette:** a short, fat **cylinder** standing **UPRIGHT** (vertical), with a **rounded/hemispherical nose cap** on top + an antenna / chute-mast stub; a **scorched flat heat-shield base** at the bottom, sunk into the sand. (NOT a box. NOT an ODST pod.)
- **Surface:** **hand-riveted weathered aluminum** (Airstream-ish) — dense rivet seams (latitudinal bands + vertical), dented + patina'd + sand-abraded; **scorched/discoloured** toward the base; grey-aluminium with rust/oxide accents (use the `createRustedHullMaterial` idiom, but tuned toward aluminium not heavy rust).
- **Viewport:** a **small, off-center, recessed** porthole/window (channel-framed) — keep the anti-ODST discipline (small/offset/recessed, a mechanic's window).
- **Salvageable:** **strippable panels / a pried-or-blown hatch** (the salvage face the player escaped through + will strip) — keep the "you can take this apart" read for the tutorial.
- **Half-buried + tilted** in the dune for drama (vertical, base sunk, leaning).

## Cycle 11 focus — T1.1 REDO: the cylindrical pod EXTERIOR (procedural-modeler)
**Delegate to the `procedural-modeler` agent.** Replace the box exterior in `placeCrashedPodWreck` with the vertical riveted aluminum capsule/torpedo (D271). Build it with cylinder/lathe geometry (a CylinderGeometry body + a hemispherical/dome cap + a tapered/flat scorched base ring), riveted-seam detailing (rings of small rivet studs — low-poly), a recessed viewport, a strippable/blown hatch panel (the salvage face), antenna/handholds breaking the silhouette. Match the game's weathered idiom (`createRustedHullMaterial`, ≥10cm depth on box decorations per rule 7 — though cylinders/lathes are inherently thick). Keep it a PERSISTENT world object at the desert spawn (not disposed by `endEscapePodIntro`); refine the collider (a cylinder/compound) to fit. KEEP `placeCrashedPodWreck`/`removeCrashedPodWreck` signatures.
- **Gate:** the REAL wake view — render via the `crashed-pod` rig (`node scripts/rig-shot.mjs --scenario=crashed-pod --angle=wake|hatch|oblique`), which reproduces the real stepOut placement (preview_screenshot hangs on the full desert — memory #3). Iterate build→shoot→critique 5-8 rounds to the hero bar: reads as a weathered, riveted, vertical aluminium capsule, half-buried + strippable. (You may need to update the rig's camera framing for a vertical-tall pod vs the old wide box.)
- **Orientation:** vertical standing capsule, base sunk, tilted.

### Acceptance (C11)
- The cylindrical riveted-aluminum vertical capsule replaces the box in `placeCrashedPodWreck`, reads as the D271 identity at the wake + hatch + oblique angles (hero bar). `verify:all` green end-to-end (600s, real exit; watch the collider gate). Flag OFF → live game byte-unchanged. The smoke chain still reaches the desert (`__game.smokeIntro()` ok).

## Then
- **C12 — T1.2 REDO: the cylindrical pod INTERIOR** — rebuild `buildPodScene` as the cylindrical capsule interior (curved ribbed walls, the seated cabin), matching the new exterior; re-home the viewport + the red parachute lever (`setParachuteLeverPull`) + the eject control + console in the round cabin; keep all contracts.
- **C13 — T1.3: seated-FP camera + viewport framing** (lower the seated eye; frame the viewport).
- Then **Phase 1 milestone → PAUSE** for the user's "pod in + out" walk-test of the CYLINDRICAL pod.

## Campaign rules
ENRICH-NOT-CUT · hero geometry → procedural-modeler + the real in-game-view (crashed-pod rig) gate, 5-8
rounds, defining quality not punted · anti-punt · behind the flag · no save bump · `verify:all` (600s, real
exit, NOT piped through `tail`) · commit each cycle · checkpoint = per phase.

## Footguns
- The box C9/C10 commits stay as the audit trail — C11/C12 REPLACE the box geometry with the cylinder; don't revert the commits, rewrite the builders.
- Cylinder geometry: use CylinderGeometry/LatheGeometry for the body/cap (inherently thick — rule 7's box-depth caveat mostly doesn't apply); rivet studs can be small instanced bumps (keep poly sane).
- `preview_screenshot` hangs on the full desert → use the `crashed-pod` rig. `verify:all` is slow → 600s + real exit.
- Keep `FEATURES.escapePodIntro` OFF by default; keep the podScene contracts intact so the beats keep playing.

## Verify
`npm run verify:all` (600s, real exit) + the `crashed-pod` rig at wake/hatch/oblique (the cylindrical pod reads at the hero bar) + `__game.smokeIntro()` ok + 0 console errors.
