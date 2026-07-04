# model-stage — the model stage + geometry lint (Y5)

`scripts/model-stage.mjs` mounts a **single builder's output alone in a neutral
studio** (dark grid floor, 3-point white lighting, auto-framed camera), shoots a
**12-angle turntable** + optional close-ups, and runs an automated **geometry
lint** (floaters / z-fight pairs / floor penetration / out-of-envelope orphans)
with object names + world positions. Zero game-source changes — everything is
injected into the running page via the rig-shot harness pattern (own Vite dev
server + Playwright chromium + `page.evaluate` on `window.__game`).

There are **no npm scripts** for this (package.json is contended) — run the raw
node commands.

## Staging a builder

```
node scripts/model-stage.mjs --module=src/world/escapePodIntro/podScene.ts --builder=buildCanonicalPodExterior
node scripts/model-stage.mjs --module=... --builder=... --args='{"door":"open"}' --closeups=canonicalPodDoor
node scripts/model-stage.mjs --module=... --builder=... --lint-only
node scripts/model-stage.mjs --test-mode                # synthetic defect rig (see below)
```

| flag | meaning |
| --- | --- |
| `--module` | path to the builder's module (any spelling; normalized to a Vite URL) |
| `--builder` | named export. All three shapes handled: `fn(): Group`, `fn(): {root: Group, …}`, and `fn(ctx): void` that adds to the scene (**scene-diff adoption**: the most-meshed newly-added root is staged at identity transform; extra roots/lights are left hidden + listed). |
| `--args` | JSON for the builder's args (array = spread, object = single arg). Without it: arity ≥ 1 → called with `window.__game.ctx`, then retried bare. If every call shape throws, the run prints a named `SKIP` (exit 0) instead of crashing. |
| `--closeups` | comma list of child-object **names**; each is framed from its own bounding sphere. A miss prints the available names. |
| `--lint-only` | mount + lint, skip all shots |
| `--floor` | `auto` (default) / `origin` / `none`. `origin` = y=0 is the authored ground (penetration check ACTIVE). `auto` picks `origin` when bbox.min.y ≈ 0, else drops the grid to bbox.min.y and disables the penetration check (free-floating models — e.g. the hauler — have no authored ground plane). |
| `--port` | dev server port, default **5195** |
| `--probe` | debug dump (camera/scene/render state as JSON) — for diagnosing the harness itself |

Output: `verification/stage/<builder>-<angle>.png` — 8 orbit shots @45°
(el 12°), `top34-045`, `top34-225`, `under34-135`, and a tighter `hero-front`
(12 total), plus `-closeup-<name>.png`. One manifest line is printed.

## Reading the lint

One JSON line: `[model-lint] {floaters, zfights, penetrations, orphans, counts}`.

- **floaters** — connected-component analysis over mesh AABBs expanded by the
  1.5cm tolerance. Any component that is not the largest (by volume) AND does
  not touch the floor plane is a floating island. Reports member object labels,
  mesh count, world center + size. Points/lines/sprites and `visible=false`
  subtrees (inert FX shells) are excluded.
- **zfights** — sampled triangle pairs from DIFFERENT meshes that are
  near-coplanar (**signed** normal dot > 0.999 — same-facing only; opposing
  normals at ~0 distance are butted solid boxes whose contact faces are
  backface-culled, not visible z-fights), separated by < 1.5mm in plane, and
  overlapping in-plane. Reports pair labels + a sample point + hit count.
  **WARN-ONLY**: deliberately flush shared-material decals/patches false-positive,
  and back-to-back DoubleSide panels evade the signed-dot rule. Sampling is
  budget-capped (`counts.capped` says whether the sweep was truncated;
  `counts.checkedPairs` / `triComparisons` for honesty). Pairs with a single
  grazing sample are counted (`grazingPairs`) but not reported.
- **penetrations** — meshes whose AABB dips > 1.05cm below y=0, **origin floor
  mode only** (the 0.5mm over the spec's 1cm absorbs FP epsilon on authored
  1cm-flush parts).
- **orphans** — mesh AABB centre outside 1.2× the MAIN component's bounding
  sphere (main-component sphere so a far orphan can't inflate the envelope and
  hide itself).

**Exit code 1 if floaters or penetrations exist** (z-fights warn-only). A named
`SKIP` (builder can't stage) exits 0 — it is not a lint failure.

Labels look like `canonicalPodInterior[m147]` (nearest named ancestors + mesh
index) or `mesh#69(BoxGeometry)` when nothing on the path is named — positions
are always included, so unnamed pieces are still findable.

## The workflow

1. **Build on stage** — iterate the builder against the turntable, not against
   sparse in-game angles. Off-azimuth shots (e.g. a flat chord door standing
   proud of a curved hull) can look like defects — always check the piece from
   its own azimuth before calling it broken.
2. **Lint clean** — floaters + penetrations to zero; triage the z-fight warns
   (real overlap vs flush decal).
3. **User review** (hero pieces) — the turntable set is the review artifact.
4. **Integrate** into the scene/game.
5. **In-game shots + lint again** — the stage can't see context bugs (lighting,
   state machines, placement); those still need the in-game gates
   (`rig-shot --scenario=…`, walk-tests).

## `--test-mode` — proving the detectors

Mounts a synthetic defect rig: a grounded box + a sphere floating 10cm above it
+ two coplanar decal planes 0.5mm apart on the box face + a bar sunk 4cm into
the floor. Asserts the lint catches each class (and does NOT flag the grounded
box or invent orphans) — 6 assertions, exit 1 if any fail. Run it after touching
the lint math; it proves the detectors aren't vacuously green.

## Harness notes / gotchas

- **Port 5195** is this script's dedicated dev-server port (5191/5192 are
  rig-shot's, 5194 reserved). Windows teardown kills the whole npm→vite tree.
- **HMR is blocked** in the staged page (a WebSocket stub in the init script):
  concurrent sessions editing `src/` would otherwise full-reload the page
  mid-run and wipe the stage. Consequence: the page is a snapshot of the source
  at boot; re-run to pick up edits. (The stub also stalls the window `load`
  event — the script navigates with `domcontentloaded` + polls `__game`.)
- **Shadow-map gotcha (the big one)**: the game runs
  `renderer.shadowMap.autoUpdate = false` (shadows update on a cadence inside
  `updateLighting`, which is paused on stage). The stage forces
  `shadowMap.needsUpdate = true` on mount + every reframe — without it the
  stale shadow state blanks EVERY lit draw (whole stage renders black).
- The stage hides the world by flipping `visible` on scene children, hides HUD
  DOM overlays, disables fog, neutralizes exposure to 1.0, and renders through
  the game camera (`ctx.three.camera`) while `ctx.flags.paused = true` — the
  render loop keeps drawing under pause; only the tick systems freeze.
- THREE is resolved to the **game's own module instance** (the Vite
  `/deps/three.js?v=…` URL sniffed from a transformed module) — a second three
  copy is only a last-resort fallback (a warning is printed).
- The framing/floor bbox measures **visible meshes only** — builders that carry
  inert hidden FX (the hauler's 70m explosion shells) would otherwise dwarf the
  model in frame.
