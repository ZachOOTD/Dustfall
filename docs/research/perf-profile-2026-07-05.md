# Steady-state frame-cost profile — 2026-07-05 (read-only, post-release)

Headless census of `renderer.info` per phase (draw calls / triangles / programs are viewport-
and GPU-independent scene facts; absolute frame-ms under SwiftShader is NOT representative and
was used only for within-run ranking). Full method + logs: the 2026-07-05 profiler run
(scratchpad artifacts `prof-desert.log`, `prof-out2.log`, `profile-steady-state.mjs`).

## The numbers

| Phase | draws | tris | programs | notes |
|---|---:|---:|---:|---|
| Intro cockpit (seated) | ~62 | 56k | 67 | partial sample (software-GL stall) |
| Intro corridor (fire+alert) | **1255** | 541k | 74 | full ship interior; merged — these are the unmergeable survivors |
| Intro descent 0.3 / 0.7 | 435 / 462 | ~508k | 75-77 | vista + re-entry shaders |
| Ship explosion (detonation) | 482 | 35k | **92** | highest program count — FX variants |
| Wake / step-out | 585 | 497k | 71 | crashed cabin + desert |
| Desert plain (noon) | 582 | 411k | 69 | the baseline |
| Desert near crash site | **1215** | 540k | 74 | the persisted pod ≈ doubles draws |
| Desert near Leviathan | **2323** | 468k | 73 | POI-dense region — heaviest gameplay |
| Desert NIGHT / STORM | 581 / 582 | 411k | 69 | identical to noon — night + weather are free |

Constants: ~30 pooled PointLights (only ~4 lit), 481 materials → 69 programs (shared-uniform
work holding), 3 InstancedMesh in the whole game.

## Ranked findings — draw calls dominate; triangles and lights do not track cost

1. **World pickups are not instanced** (~360 draws every desert frame; ~220 scrap + ~140
   branch as individual meshes sharing one geometry+material — `src/pickups/pickups.ts:266,328`;
   already scoped as D263/§A, deferred for the instanceId raycast rework). Biggest, lowest-risk win.
2. **The Leviathan landmark never calls mergeStaticByMaterial** (`leviathanLandmark.ts`, ~21
   meshes) and sits in the POI-dense region that hits 2323 draws — merge + sweep the cluster.
3. **The persisted pod's unmergeable survivors** (+633 draws at the crash site) — audit which
   transparent-but-static pieces could merge with `includeTransparent`.
4. **The 30-light pool is padded** (worst-case demand ~20-24) — trimming is a straight
   per-fragment win on integrated GPUs (`src/core/lightPool.ts`, `main.ts:130`).
5. **Prewarm the explosion/plasma shader set** (programs spike to 92 at the detonation) —
   extend the existing compileAsync preload; this is the residual beat-hitch source.

## Verdict on "are we hitting the browser's limit?"

**No.** Steady-state gameplay is ~580 draws / 410k tris / 4 lit lights — comfortable desktop-GPU
territory; the 2323-draw worst case is unmerged/un-instanced POI geometry with already-scoped
fixes, not an architectural wall. Night and storms cost nothing extra. The user-felt pain was
beat-entry shader compiles (already largely preloaded; candidate 5 finishes it). No measured
evidence justifies WebGPU or an engine port for frame budget — do the cheap web wins (pickup
instancing first) and re-measure on real hardware.
