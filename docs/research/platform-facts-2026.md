# Research: Platform Decisions for Browser-Based Three.js Game (2026)

**Researched**: 2026-07-03  
**Trigger**: Platform decision brief — to compare Tauri/Electron desktop wrappers, Three.js WebGPU maturity, performance ceilings, and Godot viability  
**Depth**: deep

## Summary

Tauri v2 (released Oct 2024) and Electron are viable for desktop distribution, but WebGL/WebGPU perf is identical to the browser—the gains are bundle size (Tauri ~8MB vs Electron ~100MB+) and backend speed. Steam distribution requires Steamworks integration (easier with Electron; Tauri lacks official SDK support). Three.js WebGPURenderer became production-ready in Sept 2025 (r171), and the same TSL code compiles to both WebGPU and WebGL, BUT GLSL onBeforeCompile patches must be rewritten as TSL nodes—they do NOT auto-port. WebGL2 60fps targets are 50–100 draw calls in browsers (due to CPU overhead), with InstancedMesh and mergeGeometries as the standard fixes. Godot 4.3/4.4 web export works (WASM + WebGL2) but defaults to single-threaded to avoid SharedArrayBuffer headers; consoles require W4 Games middleware (not native export).

## Key findings

1. **Tauri uses the OS's native WebView (WebView2 on Windows, WKWebView on macOS/Linux) — NOT a perf win for rendering.** The runtime rendering perf is identical to a browser because it IS a browser engine. The advantage is bundle size (~8.6 MB Tauri vs ~244 MB Electron in practice) and Rust backend speed; memory usage at runtime is ~the same for web content rendering. — [Tauri vs Electron [2026]: 96% Smaller Apps, 1 Winner](https://tech-insider.org/tauri-vs-electron-2026/) + [Exploring System Webviews in Tauri](https://dev.to/shrsv/exploring-system-webviews-in-tauri-native-rendering-for-efficient-cross-platform-apps-9hl)

2. **Tauri v2 stable released Oct 2024; mobile (iOS/Android) now supported with native APIs (notifications, dialogs, biometric, deep links).** — [Tauri 2.0 Stable Release](https://v2.tauri.app/blog/tauri-20/) + [Announcing the Tauri Mobile Alpha Release](https://v2.tauri.app/blog/tauri-mobile-alpha/)

3. **Steam distribution: Electron is officially supported and easier; Tauri can ship to Steam but lacks Steamworks SDK integration without writing Rust.** Phaser's 2025 tutorial covers Electron→Steam. Tauri users report issues integrating steamworks.js without a Rust backend bridge. — [Publishing Web Games on Steam with Electron (Mar 2025)](https://phaser.io/news/2025/03/publishing-web-games-on-steam-with-electron) + [Tauri Steam Overlay issue #6196](https://github.com/tauri-apps/tauri/issues/6196)

4. **itch.io supports HTML5 games natively via its desktop client (Windows, macOS, Linux) — no wrapper needed. Can resize/fullscreen inline.** — [Uploading HTML5 games - itch.io](https://itch.io/docs/creators/html5) + [Web builds · The itch.io app book](https://itch.io/docs/itch/integrating/platforms/web.html)

5. **WebGPURenderer production-ready as of Three.js r171 (Sept 2025, zero-config imports); Safari 26 completed browser coverage.** Chrome/Edge stable since 113; Firefox 145+ on macOS ARM64/Windows (Linux coming); Safari 26.0 Sept 2025. Global browser support ~85% as of March 2026. — [What's New in Three.js (2026): WebGPU, New Workflows & Beyond](https://www.utsubo.com/blog/threejs-2026-what-changed) + [WebGPU is now supported in major browsers](https://web.dev/blog/webgpu-supported-major-browsers)

6. **GLSL onBeforeCompile patches DO NOT auto-port to WebGPU/TSL — they must be rewritten as TSL nodes.** TSL code compiles to both WGSL (WebGPU) and GLSL (WebGL fallback); GLSL strings are WebGL-only. Option: maintain separate code paths (detect isWebGPURenderer) or convert all shaders to TSL. — [Migrate Three.js to WebGPU (2026) — The Complete Checklist](https://www.utsubo.com/blog/webgpu-threejs-migration-guide) + [Field Guide to TSL and WebGPU](https://blog.maximeheckel.com/posts/field-guide-to-tsl-and-webgpu/)

7. **WebGL2 draw-call budget for 60fps in browsers: 50–100 calls (CPU overhead is tight); aiming for under 100 is the safe rule. Desktop can handle 500–5000, but browser overhead is the constraint.** — [Why Draw Calls Matter: The Hidden Performance Killer](https://game-developers.org/why-draw-calls-matter-the-hidden-performance-killer-every-game-developer-must-understand/) + [Rendering 100k spheres, instantiating and draw calls](https://velasquezdaniel.com/blog/rendering-100k-spheres-instantianing-and-draw-calls/)

8. **InstancedMesh (hundreds/thousands of instances in one draw call) and BufferGeometryUtils.mergeGeometries (static geometry merging) are the two standard WebGL2 draw-call reduction techniques.** BatchedMesh (r156+) allows multiple geometries + same material in one draw call. — [Draw Calls: The Silent Killer](https://threejsroadmap.com/blog/draw-calls-the-silent-killer) + [InstancedMesh – three.js docs](https://threejs.org/docs/pages/InstancedMesh.html)

9. **Godot 4.3/4.4 web export (WASM + WebGL2) is production-ready; defaults to single-threaded to sidestep SharedArrayBuffer header issues.** 4.3 build ~40 MB uncompressed, ~5 MB Brotli-compressed. Multi-threaded mode requires CORS headers (Cross-Origin-Opener-Policy, Cross-Origin-Embedder-Policy). — [Exporting for the Web — Godot Engine (latest)](https://docs.godotengine.org/en/latest/tutorials/export/exporting_for_web.html) + [Web Export in 4.3 – Godot Engine](https://godotengine.org/article/progress-report-web-export-in-4-3/)

10. **Godot console export (Switch, PS5, Xbox) requires W4 Games middleware — Godot does NOT export natively to consoles.** W4 supports 4.3, 4.4, 4.5 with Switch 2 beta available. Register as a dev with each console manufacturer. — [W4Consoles](https://www.w4games.com/w4consoles) + [Console Support – Godot Engine](https://godotengine.org/consoles/)

## Actionable takeaways

For your Three.js + Rapier game:

- **Desktop distribution**: Tauri is viable for itch.io, but **Electron is mandatory for Steam** (Tauri's Steamworks integration is blocked without a Rust bridge). Bundle size is smaller with Tauri; if Steam is not in scope, Tauri saves ~200 MB per installer.

- **WebGPU adoption**: If you're using custom GLSL shaders (onBeforeCompile patches), budgeting a shader-rewrite sprint to TSL is necessary before shipping WebGPU. You can't "just enable" WebGPU and keep legacy patches — they break. TSL is composable and avoids string surgery.

- **Draw-call budget**: Cap yourself at ~50–100 draw calls/frame for browser 60fps. Instancing (identical geometry, varied transform) is your hammer; geometry merging (static terrain chunks) is your saw. Profile early with chrome://tracing or your profiler's WebGL timeline.

- **Godot as alternative**: Godot 4.3/4.4 web export is solid and single-threaded by default (no SharedArrayBuffer hassle), but **porting from hand-rolled Three.js+Rapier to Godot is a rewrite**, not a port—Godot's ECS and tilemap/3D structure is different. The effort is high unless you're already greenfield. No console export without W4 (paid middleware).

- **itch.io**: No wrapper needed — ship your HTML5 build directly. The itch.io app handles the rest. Simplest deployment path for browser games.

## Contrarian or surprising

- **Tauri's WebView2 is not a perf win.** The marketing often implies "use native rendering for speed," but WebView2 IS Chromium—runtime perf for web content is identical to Chrome. The win is bundle size and absence of Node.js, not GPU throughput. If perf is your reason, you're looking at the wrong problem; optimize draw calls and shader complexity instead.

- **WebGPU browser support is already here (85% March 2026), but opting in is NOT automatic.** Three.js with WebGPURenderer + WebGL2 fallback is ready. However, many production games still ship WebGL2-only because the audience overlap is massive, the fallback is seamless, and WebGPU's true advantage (compute shaders, lower CPU overhead) only matters if you're doing cutting-edge work. For a first-person survival game, WebGL2 is sufficient; WebGPU is optional polish.

- **Godot doesn't "just export to console."** This tripped up many teams. Godot exports to Windows/Mac/Linux/Web natively, but consoles require a third-party middleware (W4 Games, paid per platform). If consoles are a goal, plan for W4's onboarding, not a native export button.

## Sources

- [Tauri vs Electron [2026]: 96% Smaller Apps, 1 Winner](https://tech-insider.org/tauri-vs-electron-2026/) — comprehensive 2026 comparison
- [Tauri 2.0 Stable Release](https://v2.tauri.app/blog/tauri-20/) — official release announcement Oct 2024
- [Announcing the Tauri Mobile Alpha Release](https://v2.tauri.app/blog/tauri-mobile-alpha/) — iOS/Android support
- [Exploring System Webviews in Tauri](https://dev.to/shrsv/exploring-system-webviews-in-tauri-native-rendering-for-efficient-cross-platform-apps-9hl) — WebView2/WKWebView perf architecture
- [Publishing Web Games on Steam with Electron (Mar 2025)](https://phaser.io/news/2025/03/publishing-web-games-on-steam-with-electron) — Steamworks integration tutorial
- [Tauri Steam Overlay issue #6196](https://github.com/tauri-apps/tauri/issues/6196) — Tauri Steamworks limitation
- [Uploading HTML5 games - itch.io](https://itch.io/docs/creators/html5) — itch.io HTML5 support
- [Web builds · The itch.io app book](https://itch.io/docs/itch/integrating/platforms/web.html) — itch.io app distribution
- [What's New in Three.js (2026): WebGPU, New Workflows & Beyond](https://www.utsubo.com/blog/threejs-2026-what-changed) — r171 production-ready timeline
- [WebGPU is now supported in major browsers](https://web.dev/blog/webgpu-supported-major-browsers) — browser support status (web.dev official)
- [Migrate Three.js to WebGPU (2026) — The Complete Checklist](https://www.utsubo.com/blog/webgpu-threejs-migration-guide) — GLSL→TSL porting requirements
- [Field Guide to TSL and WebGPU](https://blog.maximeheckel.com/posts/field-guide-to-tsl-and-webgpu/) — TSL advantages over onBeforeCompile
- [Why Draw Calls Matter: The Hidden Performance Killer](https://game-developers.org/why-draw-calls-matter-the-hidden-performance-killer-every-game-developer-must-understand/) — 50–100 draw call budget for browsers
- [Rendering 100k spheres, instantiating and draw calls](https://velasquezdaniel.com/blog/rendering-100k-spheres-instantianing-and-draw-calls/) — instancing impact on draw calls
- [Draw Calls: The Silent Killer](https://threejsroadmap.com/blog/draw-calls-the-silent-killer) — Three.js draw-call optimization strategies
- [InstancedMesh – three.js docs](https://threejs.org/docs/pages/InstancedMesh.html) — official InstancedMesh documentation
- [Exporting for the Web — Godot Engine (latest)](https://docs.godotengine.org/en/latest/tutorials/export/exporting_for_web.html) — Godot web export official docs
- [Web Export in 4.3 – Godot Engine](https://godotengine.org/article/progress-report-web-export-in-4-3/) — Godot 4.3 web improvements
- [W4Consoles](https://www.w4games.com/w4consoles) — W4 Games console porting middleware
- [Console Support – Godot Engine](https://godotengine.org/consoles/) — Godot console export requirements
