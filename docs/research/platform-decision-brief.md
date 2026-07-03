# Platform Decision Brief — Dustfall

**Date:** 2026-07-03 · **Author:** research pass (autonomous) · **Status:** decision-pending, read-and-call
**Question on the table:** performance concerns (frame drops / stutter, now being addressed by a
loading-screen + profiling pass) prompted the ask — *"a separate launcher to get it out of the
browser, or potentially transitioning the game onto Godot — either way find the best path forward."*

> **This is a decision doc, not an action plan.** No code was changed writing it. Every effort
> estimate below is grounded in *this* repo (read at time of writing); every platform claim is
> tied to a 2025-2026 source. Companion raw-facts file: [platform-facts-2026.md](platform-facts-2026.md).

---

## TL;DR — the recommendation

**Stay web, wrap for distribution, measure before you rewrite.**

1. **Land the perf pass and measure first.** The browser ceiling is *not yet demonstrated* to be the
   binding constraint — the current pain (beat-entry build/compile hitches) is a **preload problem**,
   not a runtime-frame-budget problem. Two different bugs; the loading-screen work fixes the loud one.
2. **Add a desktop wrapper for distribution regardless** (itch/Steam, fullscreen, real save files). It is
   cheap (~days), orthogonal to perf, and the Vite build ports as-is. **Default to Tauri** (tiny bundle);
   **pick Electron only if a full-Steamworks Steam release is a firm goal** (its `steamworks.js` path is
   far smoother than Tauri's Rust bridge). **It is NOT a perf fix** — the webview is the same
   Chromium/WebGL runtime as the browser.
3. **WebGPU only when the frame budget is the wall** — and know it carries a real, quantified cost: the
   17 `onBeforeCompile` GLSL shader patches do **not** port automatically and must be rewritten as TSL.
4. **Godot is a multi-month full rewrite** of a mature ~69k-LOC codebase. It's the right call *only* if
   specific, measured ceilings are hit that WebGPU can't clear — and it throws away the web-deploy story
   and the whole verification harness. Not now.

---

## Part 1 — Grounding: what this codebase actually is

Read before trusting any effort number below.

| Metric | Value | Source |
|---|---|---|
| TypeScript LOC (`src/`) | **~69,500** across **160 files** | `find src -name '*.ts'` |
| Largest module | `src/world/` — **39,400 LOC / 90 files** | per-dir count |
| `onBeforeCompile` GLSL shader patches | **17 files**, 34 patch sites | `grep onBeforeCompile` |
| Files touching Rapier physics | **~40** | `grep RAPIER` |
| Files touching raw GLSL / ShaderMaterial | **~24** | `grep vertexShader…` |
| `new THREE.Mesh(…)` call sites | **966** | grep |
| Lights instantiated | **67** | grep |
| Procedural audio | **~3,000 LOC** synthesized via Web Audio (no sample files) | `src/audio/` |
| Save system | `save.ts` **1,389 LOC**, `SAVE_VERSION = 15` | read |
| Measured draw calls (wreck field) | **~842–960** (recorded across recent sessions) | roadmap perf fields |
| Shader programs | **69** | roadmap perf fields |

**Everything is procedural — geometry, materials, audio.** There are **no asset files to migrate**
(a real upside for a port). But the flip side is the load-bearing point for this whole brief: **every
system is CODE.** A port doesn't move assets — it *rewrites systems*. The terrain noise, the POI/wreck
generators, the KCC over Rapier, the intro beat-machine, the ~3k-LOC Web Audio synthesizer, and all
17 material shaders are hand-authored logic, not content that transfers.

### The material shaders are the crux of the WebGPU/Godot cost

The 17 material factories (`metalMaterial`, `hullMaterial`, `terrainMaterial`, `skinMaterial`, the
sky, the fireball…) work by **string-replacing Three.js's internal GLSL chunk includes** — e.g.
`shader.fragmentShader.replace('#include <color_fragment>', …)` — to inject fbm noise, world-position
varyings, and multi-layer weathering (scratches, worn highlights, dirt, rust drips). Sampled from
`src/world/metalMaterial.ts`:

```glsl
shader.fragmentShader = shader.fragmentShader.replace(
  '#include <color_fragment>',
  `#include <color_fragment>
   float scratchNoise = metalHash(vec2(scratchCoord * 90.0, wpm.y * 2.0));
   float wornNoise = metalFbm(wpm.xz * uWornScale);
   … rust drips, dirt, grain … `);
```

This mechanism **exists only in the WebGLRenderer's GLSL pipeline.** It has no equivalent in the
WebGPU backend (which compiles TSL → WGSL) or in Godot (`.gdshader`). This is why WebGPU and Godot
are not "flip a switch" — the shader layer is the tax. Note the codebase already did the *cheap* half
of this work: all factories were converted from per-instance baked GLSL to shared uniforms + one
program (sessions ACAT/ACAU), which is what keeps it at 69 programs.

### The perf story so far (why "measure first" is the honest gate)

This is not a naive WebGL project. It already has:

- A **dev perf HUD** (`src/ui/perfHud.ts`, F1) reporting FPS, draw calls, triangles, **and a
  GPU-ms vs CPU-ms split** — so the team can *already tell* whether a frame is GPU-bound or JS-bound.
- **Quality tiers** (`src/core/settings.ts`): low/med/high pixel-ratio + shadow-map presets.
- **Shadow throttling** (`SHADOW_UPDATE_EVERY_N_FRAMES = 6`, `autoUpdate = false`) and a
  1024 shadow map (down from 2048 — a deliberate 4× fill-rate cut).
- **Aggressive static-merge**: `mergeStaticByMaterial` collapsed the mega-wreck 491→79 meshes, the
  fleet ~254→52; flagships merged (megaShip 160→67, satelliteDish 148→47). Draw calls in the
  heaviest scene sit at **~842–960**, already down from historical highs.

**The pending item is honest: profiling results are not yet in.** The current stutter is described as
*beat-entry build/compile hitches* — i.e. the intro constructs and shader-compiles new geometry at a
beat boundary, causing a one-frame hitch. **That is a preload/warm-up problem** (fixable with
`compileAsync` prewarm + a loading screen, which is the pass already in flight), **not evidence that
the steady-state 60fps frame budget is blown.** Do not conflate the two. The whole staged
recommendation hinges on separating them.

---

## Part 2 — the four paths

### Path 1 — Stay web + optimize (the baseline)

**What it is.** Keep the exact stack. Finish the preload pass, then apply the standard WebGL2
draw-call-reduction playbook where the HUD says it's needed.

**What it buys.** Zero migration risk. Keeps the web-deploy story (GH Pages live, itch-web tier
possible), the whole verify harness (`verify:placement`, `verify:colliders`, rig-shot), and the
team's fluency. Every optimization here *also* benefits every other path (a Tauri wrap or a WebGPU
swap inherits the merged geometry and light budget).

**What it costs (grounded).**
- **Preload / warm-up (the actual current fix):** small — `compileAsync` prewarm already exists in the
  boot path; extend it to intro-beat geometry + a loading screen. **~1–2 sessions.**
- **Pickup instancing** (backlog §C, `[debt]`): ~340 branch+scrap pickups ≈ 340 draw calls; needs an
  `instanceId` interaction-raycast rework. **Attended, ~1 session.** This is the single biggest
  remaining draw-call win and is already scoped.
- **Further static-merge / light budgeting:** incremental, HUD-driven, **sessions not weeks.**

**Realistic WebGL2 ceiling for *this* game's scope — read this carefully, the numbers look
contradictory and aren't.** A common conservative rule of thumb caps browser 60fps at
[**~50–100 draw calls/frame**](https://game-developers.org/why-draw-calls-matter-the-hidden-performance-killer-every-game-developer-must-understand/)
because each call carries CPU-side validation overhead. **Dustfall already runs at ~842–960 draw calls
and hits its fps targets** — so that 50–100 figure is clearly a *worst-case CPU-bound* guideline, not a
hard wall. The real ceiling is GPU/driver-dependent and only the profiler knows it; desktop GPUs
routinely push [500–5000 calls](https://velasquezdaniel.com/blog/rendering-100k-spheres-instantianing-and-draw-calls/).
The takeaway is the same either way: **the standard fixes are
[`InstancedMesh`](https://threejs.org/docs/pages/InstancedMesh.html) and
[`BufferGeometryUtils.mergeGeometries`](https://threejsroadmap.com/blog/draw-calls-the-silent-killer)**
(plus `BatchedMesh`, r156+) — all already in this repo's toolbox. With a flat-shaded low-mid-fi art
style and instancing not yet applied to the ~340 pickups, **this game has clear draw-call headroom
left before any wall.** The likely true constraints are (a) the compile hitches (preload fixes),
(b) fill-rate on low-end integrated GPUs (the quality tiers already address), and (c) pickup draw
calls (instancing fixes) — *none of which are WebGL2 architectural limits.*

**Risks.** Low. The main risk is *not measuring* and optimizing the wrong thing.

**Effort:** **days to ~2 weeks** of incremental, already-scoped work.

---

### Path 2 — Desktop launcher wrapper (Tauri vs Electron)

**What it is.** Wrap the identical Vite build in a native window. **Tauri** uses the OS webview
(WebView2/Chromium on Windows, WKWebView on macOS, WebKitGTK on Linux); **Electron** bundles its own
Chromium + Node.js.

**Be honest: this is NOT a perf fix.** On Windows, Tauri's WebView2 *is* Chromium — the same WebGL/
WebGPU runtime as the browser. You do not get a faster renderer by wrapping; runtime GPU throughput is
identical to Chrome. *(Tauri = system webview, same runtime — [tech-insider 2026 comparison](https://tech-insider.org/tauri-vs-electron-2026/),
[Tauri system-webview architecture](https://dev.to/shrsv/exploring-system-webviews-in-tauri-native-rendering-for-efficient-cross-platform-apps-9hl),
+ `shared-memory/desktop-packaging.md`.)*

**What it *does* buy.**
- **Distribution.** Ship on **[itch.io](https://itch.io/docs/creators/html5)** (the itch app also runs
  the raw HTML5 build with no wrapper at all) and **Steam**. Web-tech games ship on Steam routinely
  ([Phaser's Electron→Steam guide, 2025](https://phaser.io/news/2025/03/publishing-web-games-on-steam-with-electron)).
- **Fullscreen + input polish**, no browser chrome, no accidental Ctrl-W.
- **Real file-system saves.** Today saves are `localStorage` (fragile — a browser cache-clear wipes
  them). A wrapper writes to `%APPDATA%/<bundle-id>/` with a proper save file. Meaningful for a
  survival game with progress.
- **No tab-throttling** (a documented Dustfall preview gotcha — hidden tabs get throttled). A dedicated
  process removes that class of jank, and may give **modest GC/jank wins** from not sharing a browser
  process — but treat that as a bonus, not the reason.
- **Discrete-GPU selection** on dual-GPU laptops (a real edge the backlog already notes).

**Effort (grounded).** The Vite build already ports as-is — the repo builds env-gated bundles today
(`netlify.toml`, `wrangler.jsonc`, `VITE_BASE`/`VITE_ESCAPE_POD_INTRO`). Tauri bootstrap on an
existing project is `npm i -D @tauri-apps/cli && npx tauri init`, pointing at `dist` +
`http://localhost:5173` — `src/` untouched. First Rust build ~3-5 min; then it's a window.
**~2–4 days to a working signed-ish build**, per `shared-memory/desktop-packaging.md`. Bundle:
Tauri **~8 MB** vs Electron **~100–240 MB** ([2026 comparison](https://tech-insider.org/tauri-vs-electron-2026/);
Tauri v2 went [stable Oct 2024](https://v2.tauri.app/blog/tauri-20/)).

**Tauri vs Electron for Dustfall — one honest fork, and it's about Steam.** For everything *except*
Steam, **Tauri wins**: single-player, procedural-only, no in-process Node server needed → the decision
matrix (bundle size, modern security, simpler config) points squarely at Tauri. **BUT** if a Steam
release is a firm goal, note the 2026 reality: **Electron has the smoother Steamworks path** — the
`steamworks.js` npm package is a one-`npm install` integration, whereas **Tauri needs a custom Rust
bridge** to reach the Steamworks SDK (achievements/overlay/lobbies), which is real extra work
([Tauri Steamworks limitation](https://github.com/tauri-apps/tauri/issues/6196)). So: **itch.io or a
plain direct-download → Tauri. Steam-with-full-Steamworks a firm target → Electron is the pragmatic
call** despite the bundle size. *(Full matrix: `shared-memory/desktop-packaging.md`.)*

**Steam-readiness notes.** Achievements/overlay/lobbies go through the Steamworks SDK — via
`steamworks.js` on Electron (easy) or a Rust crate on Tauri (more work). Windows code-signing
(~$70-200/yr) avoids the SmartScreen "unrecognized app" install-rate hit; macOS notarization ($99/yr)
is mandatory for Gatekeeper. Skippable for a first itch.io drop; required for a Steam release.

**Risks.** Low. One caveat from the shared-memory canon: **re-profile after wrapping** — WebView2's
GC/memory behavior differs subtly from Chrome. And `localStorage` saves are per-storage-scope, so
browser saves and desktop saves are *separate* — decide whether that matters.

**Effort:** **~2–4 days.** Orthogonal to everything else. **Do this regardless of the perf verdict.**

---

### Path 3 — Web + WebGPU (Three.js `WebGPURenderer`)

**What it is.** Swap `WebGLRenderer` for Three's `WebGPURenderer`, keeping the entire rest of the
codebase (physics, world-gen, audio, save, UI).

**What it buys.** Lower **CPU/driver overhead per draw call** (WebGPU's core win — better batching,
less validation cost per call) and access to **compute shaders**. For a draw-call-bound or
CPU-bound scene, this is the realistic API-level frame win *short of a rewrite*. It keeps the web
deploy story intact and runs in-browser.

**What it costs — and this is the load-bearing caveat.** The renderer swap is the *easy* part.
The **17 `onBeforeCompile` GLSL patches do NOT port to WebGPU.** The WebGPU backend does not run the
GLSL chunk pipeline those patches string-inject into — materials are authored in **TSL (Three Shading
Language)** node graphs that compile to WGSL. Every weathering shader (metal scratches+rust, hull,
terrain, skin, bone, wood grain, fabric, glass, concrete, stone, the sky shader, the fireball, the
particle trails) **must be re-authored as TSL nodes.**

*(This is the load-bearing claim: GLSL `onBeforeCompile` patches are WebGL-only string surgery and do
not port; TSL nodes replace them — [migration checklist](https://www.utsubo.com/blog/webgpu-threejs-migration-guide),
[TSL field guide](https://blog.maximeheckel.com/posts/field-guide-to-tsl-and-webgpu/).)*

That's the real Path-3 bill:
- **Renderer swap + boot/pipeline plumbing:** ~1 session.
- **Rewrite 17 material shaders GLSL → TSL** (each with fbm noise, world-pos varyings, multi-layer
  composition — non-trivial, and TSL is a different mental model): the bulk of the work. Realistically
  **2–4 weeks** to re-author + visually re-gate all of them to parity (and this codebase holds a high
  visual bar — every material would need the adversarial-gate re-verification). The upside: TSL
  compiles to *both* WGSL and GLSL, so once rewritten you get a WebGL fallback from the same source.
- Until then you'd maintain **both** material stacks (GLSL-patch + TSL) behind an `isWebGPURenderer`
  check — a transitional maintenance cost.

**Three's WebGPURenderer maturity (2026) — better than you might assume.** It became
[**production-ready in Three.js r171 (Sept 2025)**](https://www.utsubo.com/blog/threejs-2026-what-changed)
with zero-config imports, and WebGPU browser support reached
[**~85% globally by March 2026**](https://web.dev/blog/webgpu-supported-major-browsers) (Chrome/Edge
stable since 113, Firefox 145+, Safari 26 completing coverage). So Path 3 is **not experimental** — the
*renderer* is ready. The cost is entirely the **[GLSL-patch → TSL rewrite](https://www.utsubo.com/blog/webgpu-threejs-migration-guide)**,
not renderer risk.

**Risks.** Medium. The shader rewrite is real weeks of visual work; browser support means a fallback
burden; and it only pays off **if the profiler proves the frame is draw-call/CPU-bound** (WebGPU does
little for a fill-rate-bound or already-batched scene). Doing this *before* measuring would be
premature.

**Effort:** **~3–5 weeks** (renderer swap is days; the shader-patch rewrite is the cost). Keeps
everything else.

---

### Path 4 — Godot port (full rewrite)

**What it is.** Reimplement Dustfall in Godot 4.x. Not a migration — a **rewrite**, because nothing
is content: it's all code.

**Full-rewrite scope (grounded against the module count).** Every system is bespoke:
- **Terrain / noise** → reimplement heightfield + simplex noise in GDScript/C# (`src/world/terrain.ts`
  + the noise plumbing).
- **POI / wreck generators** → the socket/component/`mate()` grammar, `procgenWreck` (2,170 LOC),
  the flagships, the wreck-yard biome — all re-authored (`src/world/`, ~39k LOC, the bulk of the game).
- **KCC + Rapier physics → Godot physics.** ~40 files touch Rapier; the character controller
  (`computeColliderMovement`, kinematic bodies, the whole collision model) maps to Godot's
  `CharacterBody3D` / Jolt but every call site and tuning value re-derives.
- **Intro beat-machine** (`escapePodIntro/` — podScene 3,617 LOC, shipScene 3,164, sequence 1,299,
  haulerScene 1,170) → re-authored in Godot's scene/animation system. This is a *lot* of recent,
  in-flight hero work.
- **Procedural audio (~3k LOC Web Audio) → Godot audio.** Godot has no direct Web-Audio-node analog;
  the synthesizers rewrite against `AudioStreamGenerator` / buses.
- **Every shader → `.gdshader`.** All 17 material patches + the sky/fireball/vignette shaders,
  re-authored in Godot's shading language (a *third* shader dialect, distinct from both GLSL-patch and
  TSL).
- **Save system** (1,389 LOC, v15 with migration) → Godot resource/JSON serialization.
- **UI** (~4k LOC, DOM-owned per-module) → Godot Control nodes.

**What it buys.** Native performance headroom (no browser/webview layer), **console paths** — though
note Godot does **not** self-export to consoles; Switch/PS5/Xbox require paid third-party middleware
([W4 Games](https://www.w4games.com/w4consoles), [Godot console support](https://godotengine.org/consoles/)),
so plan for onboarding, not a button — and an **editor + tooling** workflow (scene tree, inspector,
animation editor) instead of code-only iteration.

**What it's lost.** The **entire web-deploy story** (GH Pages live today; [Godot's HTML5/WASM export](https://docs.godotengine.org/en/latest/tutorials/export/exporting_for_web.html)
works but defaults to *single-threaded* to sidestep the SharedArrayBuffer COOP/COEP header requirement,
ships a ~40 MB uncompressed / ~5 MB Brotli runtime, and is weaker than native). The **whole verification
harness** (`verify:placement`, `verify:colliders`, rig-shot, the adversarial visual gates) is
Playwright-over-the-web-build — it does not transfer. And the **codebase maturity** — 160 files of
debugged, tuned, gated systems — resets to zero-in-a-new-engine.

**Risks.** High. This is the highest-risk, highest-cost path by an order of magnitude, and it is
**not a guaranteed perf win for this game's scope** — a flat-shaded procedural scene at <1000 draw
calls is not obviously beyond WebGL2/WebGPU. You'd be spending months to *maybe* clear a ceiling not
yet proven to exist.

**Effort:** **multi-month full rewrite** (realistically 3-6+ months to reach current feature parity,
and the intro showpiece is still actively being built — you'd be chasing a moving target).

---

## Part 3 — comparison table

| | **1. Web + optimize** | **2. Desktop wrapper** | **3. WebGPU** | **4. Godot port** |
|---|---|---|---|---|
| **Is it a perf fix?** | Yes (targeted) | **No** (distribution only) | Yes, *if CPU/draw-bound* | Yes (native) — but unproven need |
| **Effort (this repo)** | days–2 wks | **~2–4 days** (Tauri) | ~3–5 wks | **multi-month** |
| **Migration risk** | none | very low | medium | very high |
| **Keeps web deploy** | ✅ | ✅ (+ desktop) | ✅ | ❌ |
| **Keeps verify harness** | ✅ | ✅ | ✅ | ❌ (rewrite) |
| **Shader rewrite needed** | none | none | **17 → TSL** | **all → .gdshader** |
| **Steam / itch** | itch-web only | ✅ both (Steam→Electron) | itch-web only | ✅ native |
| **Real file saves** | ❌ (localStorage) | ✅ | ❌ | ✅ |
| **Console path** | ❌ | ❌ | ❌ | via W4 (paid) |
| **Buys headroom for future scope** | limited | none | moderate | large |

---

## Part 4 — the staged recommendation (with concrete gates)

Do these **in order**. Each gate is a measured number, not a vibe.

**Gate 0 — land the preload pass and turn on the HUD.** Finish the loading-screen + `compileAsync`
prewarm work already in flight. Then play a full session with the F1 HUD open and read the
**GPU-ms / CPU-ms split** in the heaviest scenes (wreck field, the intro descent).
→ *Decision:* if steady-state holds **≥60fps (≤16.6 ms/frame) on your target mid-tier GPU** and the
only stutters were the (now-fixed) beat-entry hitches, **the browser is not the constraint — stay web.**
The perf question is answered without any platform change.

**Gate 1 — do the cheap web wins if the HUD flags them.** If draw calls in a hot scene exceed
**~1,500** or CPU-ms dominates, land **pickup instancing** (§C, ~340 draws → ~1) and any remaining
static-merge. Re-measure. This clears most realistic pressure for this game's scope.

**Gate 2 — add the desktop wrapper. Regardless of Gates 0-1.** It's ~2-4 days, orthogonal to perf, and
buys itch/Steam distribution + real save files + no tab-throttle. There is no reason to defer it
behind the perf question — it answers a *different* question (distribution). **Default Tauri**; choose
**Electron only if full-Steamworks Steam is committed.** Ship browser + desktop tiers from one codebase.

**Gate 3 — consider WebGPU only if, after Gates 0-1, the profiler still shows a CPU/draw-call-bound
frame you can't merge away** — i.e. GPU-ms is low but CPU-ms/frame stays **>16 ms** and it's driver/
draw-call overhead (not JS logic). Budget the **17-shader TSL rewrite** as the real cost (~weeks) and
confirm WebGPU browser support covers your audience with a WebGL fallback retained.

**Gate 4 — consider Godot only if ALL of these are true:** (a) Gates 0-3 are exhausted and a
*measured* frame ceiling remains (e.g. sustained **>16 ms/frame that is GPU-bound and irreducible**
even on WebGPU at the lowest quality tier), **and** (b) you specifically need a **native console path**
that no web target can provide, **and** (c) you accept losing the web deploy + verify harness and
spending months. Absent a hard, measured ceiling *and* a console mandate, this path is not justified.

**In one line:** *Measure (Gate 0) → cheap web wins if flagged (Gate 1) → wrap for distribution
anyway (Gate 2) → WebGPU only if proven CPU-bound (Gate 3) → Godot only if a measured native ceiling
+ console mandate exist (Gate 4).*

---

## Sources

Platform-fact claims above are drawn from the companion research digest, which carries the inline
source URLs: **[docs/research/platform-facts-2026.md](platform-facts-2026.md)**. Framework canon
cited: `gamedev-framework/shared-memory/desktop-packaging.md` (Tauri/Electron decision matrix,
bootstrap, Steam/itch distribution, save paths, signing). Codebase figures are from direct inspection
of this repo at 2026-07-03 (grep/read of `src/`, `docs/roadmap.md` perf fields, `src/ui/perfHud.ts`,
`src/core/settings.ts`, `vite.config.ts`, the deploy configs).
