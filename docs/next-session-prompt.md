# Session ACI — Finish the player model: skin/cloth texture pass + rig-debt

> Phase 2 iteration plan: **[docs/iteration-plan.md](iteration-plan.md)**. Cycles 1+2
> shipped (ACG drag verification, ACH rig-to-Rey-tier). ACH got the model's GEOMETRY
> to the Rey-Jakku silhouette; this session finishes it with the **material/texture
> pass** + the small rig-debt, then the plan resumes at **Cycle 3 (sled riding)**.

## Read these now (in order)

1. **CLAUDE.md** (auto-loaded) — esp. rule 8 (iteration discipline) — LOAD-BEARING.
2. **docs/session-end-report.md** — cumulative state through ACH.
3. **docs/backlog.md** — the `[feat/polish] Player model refinement` entry (geometry ✓; REMAINING = texture/material + the polish list).
4. **docs/decisions.md** — recent tail; esp. **D134** (the `__game.enterGame` headless screenshot loop — USE IT this session), D107 (zero-asset → procedural shaders only), D109 (localSpace on moving entities), D117/D118 rig stack.
5. **docs/iteration-plan.md** — Cycle 3 (next after this).

## What's already built

The player rig is at the Rey-Jakku **silhouette**: hood→one unified tan scarf, 7-band
forearm wraps + fingerless glove, cinched belt + hip pouches, scavenger backpack +
bedroll, cloth-wrapped boots, plus the D115/D117/D118 Lathe+drape+sub-pivot stack. All
self-verified via the headless screenshot loop. The gap now is **surface richness** —
the cloth + skin read as flat single-color fabric; they need procedural shader detail.

## Session ACI — focus

**Finish the player model: procedural skin + cloth TEXTURE pass** (per D107 zero-asset —
NO image files; extend the `onBeforeCompile` shader vocabulary: `skinMaterial.ts`,
`fabricMaterial.ts`, `paintMaterial.ts`, `metalMaterial.ts`). Heavy visual-iteration —
honor rule 8, and **use the `__game.enterGame` headless loop (D134)** to self-verify
every element (recipe below).

## Priority items (in order)

1. **Skin weathering** (`skinMaterial.ts` params on face + hands) — sun-damage/dirt
   gradient, grimier knuckles; currently flat. 3-5 screenshot rounds.
2. **Cloth weave + dye** (`fabricMaterial.ts` on poncho/scarf/wraps) — subtle weave
   density + stripe/dye variation + wear at edges; the cloth reads uniform now.
3. **Glove contrast** — bump the glove cloth to a tone that reads distinct from skin at
   3P distance (ACH flagged it as too subtle under warm light).
4. **Backpack + pouch detail** — stitching/strap/wear on the plain box (paint/fabric shaders).
5. **Rig-debt bundle** (cheap, fold in): 3P-rig-on-speeder **seated stance** + the
   **E-mount-without-seat-hover bug** (`interaction.ts`/speeder mount range), foot-IK
   idle→walk slope-snap, 3P-camera real-playtest.

## Stretch
- Goggles crispness at 3P. Sled-on-back-when-undeployed (surface design fork first).

## Headless self-verify recipe (D134 — this is how you iterate)
```js
__game.enterGame(true)                                   // headless entry, loop ticks
const r=__game.ctx.three.renderer; r.setSize(1200,1000,false)
const cam=__game.ctx.three.camera; cam.aspect=1.2; cam.updateProjectionMatrix()
__game.ctx.flags.thirdPerson=true; __game.setTime(0.5)   // 3P + midday light
// let it run a frame, THEN: __game.ctx.flags.paused=true; pose rig joints; position cam; screenshot
```
Footgun: pause AFTER a frame settles the rig at the player (else joint world-pos is stale → camera aims at sky). Pose arms/legs out via `rig.shoulders[i]/elbows[i]` while paused to clear the poncho.

## Autonomy contract
Ambiguous → GDD pillars + realism dial, append D-entry, continue. Surface only on:
procedural-vs-asset (D107 — stay procedural), save bumps (D81), destructive git,
the sled-on-back design fork.

## Stop conditions
Wall-clock 2-4h. 3 fix-walls on one element → `/scope-cutter`. **Rule-8 self-check**:
never mark a material element done on tsc alone — screenshot it.

## Notable footguns
- **D107 zero-asset** — no image textures; procedural shaders only. **D109 localSpace**
  on the rig (moving entity) or detail crawls.
- **Preview**: if `preview_screenshot` wedges (it can, mid-session), restart Claude Code /
  the preview MCP — it clears. State inspection via `__game.ctx` still works regardless.

## Verification protocol
`npm run verify` (= tsc) is the type gate. QUALITY gate = the headless screenshot loop,
3-5 rounds per material element.

## Begin block
1. Read CLAUDE.md, session-end-report, backlog (Rey item), decisions (D134/D107/D109).
2. `npm run verify` baseline.
3. TaskCreate the 1-2 material elements you'll fully iterate + the rig-debt bundle.
4. Start the preview, `enterGame`, and iterate per element.
