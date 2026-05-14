# Session X — Audio overhaul

## Context

Sessions V and W both shipped with audio mostly **disabled**. Session V built a procedural music module (drone + pentatonic plucks + feedback-delay reverb + storm sub-bass) plus a bandpassed-noise wind loop, then turned all of it off because:

- The drone+pluck system "wasn't the right vibe for calm weather" — sounded synthetic, not lonely-desert.
- The wind loop "felt abrasive" as bandpassed white noise.
- The current default (silence in calm weather, music+wind only in storm) actually plays OK as a fallback.

This session replaces the procedural-only approach with a small **CC0 sample pack** for ambient beds + music stems, kept under tight runtime crossfade control. Procedural Web Audio still owns all SFX (footsteps, drink, craft, hit, etc.) — those work and aren't touched. Bar for success: **clearly an improvement over the carry-over silence**, not just "noise added."

User will source + commit CC0 files during the session (freesound.org / OpenGameArt). Code lands first with a tolerant loader; missing files degrade to silence so the build is never broken mid-session.

---

## Design

### Three sample layers (all crossfaded by `updateSoundscape` each frame)

| Layer | Stems | Driven by |
|---|---|---|
| **Wind** | `wind-calm.ogg`, `wind-mid.ogg`, `wind-storm.ogg` | `windLevel = max(weather.intensity, slow procedural drift 0..0.25)` |
| **Ambient life** | `day-bed.ogg` (distant bird call), `night-bed.ogg` (insect chitter) | `day` / `night` from `ctx.time.sunHeight`, **suppressed when storm > 0.3** so dust drowns wildlife correctly |
| **Music** | `music-calm.ogg`, `music-tense.ogg` | Calm plays continuously at ~0.20 gain. Tense crossfades in at `weather.intensity > 0.4`; calm fades out symmetrically. |

All three layers use `AudioBufferSourceNode` with `loop = true`, started once at `startSoundscape`. Each stem has its own `GainNode` ramped via `linearRampToValueAtTime` in `updateSoundscape` (existing `rampParam` pattern in `music.ts:323`). No re-triggering, no scheduling — just gain curves.

### Why this shape

- **Stems-not-tracks**: 7 loopable files total. No timeline, no stems-aligned BPM logic — just independent loops crossfaded by world state. Cheap and forgiving of imperfect loop points (we'll mask with crossfades anyway).
- **Continuous quiet music**: per user — "lonely-desert mood present but unobtrusive." Calm baseline ~0.20 gain (well below SFX). Tense variant only swells with sandstorms.
- **Wind-windward suppression of ambient life**: insects + birds vanish under sandstorm noise floor, which sells the storm and avoids two competing beds.
- **Procedural drift on calm wind**: keeps `wind-calm.ogg` from being a perfectly static drone. Slow sine sum over 2 frequencies (~0.05 Hz and ~0.013 Hz), output in 0..0.25 — gives subtle breeziness during clear weather without ever hitting "windy" intensity unprompted.

### File contract — `public/audio/`

Loader logs warnings for missing files but boot succeeds. Recommended specs:

- `wind-calm.ogg` — 15–30s loop, low rumble + occasional gust, peak ~ −18 dBFS
- `wind-mid.ogg` — 15–30s loop, steadier mid-band breeze, peak ~ −12 dBFS
- `wind-storm.ogg` — 15–30s loop, roaring high-energy sandstorm, peak ~ −8 dBFS
- `day-bed.ogg` — 20–40s loop, sparse distant bird call (one call every ~10–15s of source), peak ~ −22 dBFS
- `night-bed.ogg` — 20–40s loop, sparse insect chitter, peak ~ −22 dBFS
- `music-calm.ogg` — 60–120s loop, lonely sci-fi pad (Dune / Death Stranding flavor), tonic A minor preferred to match retained `playDeath`/`playSleepThud` tonality
- `music-tense.ogg` — 60–120s loop, same key, denser low-end, swelling pads — designed to crossfade *with* calm not *replace* it

All mono is fine — stereo widening on ambient beds is welcome but not required. OGG Vorbis @ q4 (≈96 kbps) keeps total payload around 1.5–2 MB.

---

## Files to change

### NEW — `src/audio/samples.ts`

Sample-loader module modeled on `src/assets/loader.ts:32` (tolerant async preload). Public API:

```ts
type SampleId =
  | 'wind-calm' | 'wind-mid' | 'wind-storm'
  | 'day-bed' | 'night-bed'
  | 'music-calm' | 'music-tense';

// Idempotent. Call once from startSoundscape() after AudioContext exists.
// Fetches each file in parallel, decodes via ctx.decodeAudioData, populates
// the registry. Missing files resolve to null — soundscape checks per-stem.
export async function preloadSamples(ctx: AudioContext): Promise<void>;

export function getSample(id: SampleId): AudioBuffer | null;
```

Internally a `Map<SampleId, AudioBuffer | null>` and a `Map<SampleId, string>` for URLs. Use `fetch(url).then(r => r.arrayBuffer()).then(b => ctx.decodeAudioData(b))`. Wrap each in try/catch — silently log failure and store null. Total budget for failure mode: zero broken-by-default state.

### REWRITE — `src/audio/soundscape.ts` (replaces all current content)

Becomes the orchestrator for sample-based ambient + music layers. The current commented-out wind block is **deleted, not restored** — sample wind replaces it.

Sketch:

```ts
interface SoundscapeState {
  ctx: AudioContext;
  // Per-stem source + gain, built once
  wind: { calm: StemNodes; mid: StemNodes; storm: StemNodes };
  ambient: { day: StemNodes; night: StemNodes };
  music: { calm: StemNodes; tense: StemNodes };
  musicBus: GainNode;   // 4s fade-in on first start
  driftPhase: number;
}
interface StemNodes { src: AudioBufferSourceNode | null; gain: GainNode; }

export function startSoundscape(): void;
export function updateSoundscape(ctx: GameContext, dt: number): void;
```

`startSoundscape` is async-friendly: it kicks off `preloadSamples(a.ctx)` and **then** builds source nodes per stem as buffers arrive. Stems with null buffers get a silent `GainNode` placeholder so `updateSoundscape` doesn't have to null-check each frame.

`updateSoundscape` per frame:

1. Derive signals:
   ```
   storm   = ctx.weather.intensity            // 0..1
   sy      = ctx.time.sunHeight                // -1..1
   day     = clamp(sy * 1.5 + 0.1, 0, 1)
   night   = clamp(-sy * 1.5 + 0.1, 0, 1)
   drift   = 0.125 * (sin(t*0.05) + sin(t*0.013)) + 0.125  // 0..0.25
   windLvl = max(storm, drift)
   ```
2. Map `windLvl` → 3 wind gains:
   - calm gain: `1 - smoothstep(0.0, 0.35, windLvl)`
   - mid gain: `smoothstep(0.0, 0.35, windLvl) * (1 - smoothstep(0.45, 0.85, windLvl))`
   - storm gain: `smoothstep(0.45, 0.85, windLvl)`
   - Multiply all by `WIND_MASTER = 0.55`
3. Ambient life gains:
   - `lifeMask = 1 - smoothstep(0.15, 0.35, storm)` (suppress under sandstorm)
   - day gain: `day * lifeMask * AMBIENT_LIFE_MASTER (0.35)`
   - night gain: `night * lifeMask * AMBIENT_LIFE_MASTER (0.35)`
4. Music gains (gated on `musicBus` 4s fade-in):
   - calm gain: `(1 - smoothstep(0.30, 0.55, storm)) * MUSIC_CALM_TARGET (0.20)`
   - tense gain: `smoothstep(0.30, 0.55, storm) * MUSIC_TENSE_TARGET (0.45)`
5. All ramps go through `rampParam(param, target, ctx, 0.5)` — same helper currently in `music.ts:323`. Lift into soundscape.ts or share via a small helper module.

### DELETE/REWRITE — `src/audio/music.ts`

The drone+pluck+storm-sub system is gone. **Two options**:

- **Delete the file** entirely; fold the new music-stem logic into `soundscape.ts` (recommended — it's < 50 lines once procedural is gone, and keeps the audio module count low).
- Keep `music.ts` as a thin module that owns just the music-stem crossfade, called from soundscape.

I recommend **delete**. The new music layer is two BufferSources + two gains — not enough to justify a separate file. The currently-imported `updateMusic`/`startMusic` is `import { updateMusic } from './music.ts';` in `soundscape.ts:12` and a commented-out `startMusic` reference at `soundscape.ts:13`. Both go away.

### TINY EDIT — `src/audio/audio.ts`

Add `__game.audioState()` hook (Section: Verification below) — exposes per-stem current gain values for debugging. ~10 lines.

Optional: split a `_music` sub-bus off of `_ambient` so console can mute music independently. **Skip for v1** — single ambient bus is fine; sample mix is controlled per-stem inside soundscape.

### EDIT — `src/debug/debugPanel.ts`

Add `audioState()` to the `__game` registry (parallel to `state()` at `debugPanel.ts:49`). Returns `{ windLevel, day, night, storm, gains: { ... } }` for console-only inspection. Helps tune sample-pack levels without re-running.

### EDIT — `docs/architecture.md` file-map block

One-line update to `src/audio/soundscape.ts` description at `architecture.md:60` reflecting the new responsibilities. If `music.ts` is deleted, drop any reference. New `samples.ts` line below the audio block.

### NO CHANGES

- `src/core/input.ts` — already calls `ensureAudioStarted()` + `startSoundscape()` on first click (`input.ts:76-77`). Soundscape's new async preload kicks off from inside `startSoundscape`, so this wiring is identical.
- `src/main.ts` — `updateSoundscape(ctx, dt)` is already in the tick order at the correct point (after `updateStats`, before `bobPickups`).
- `src/ui/menus.ts` — single master volume slider stays. No per-layer UI in v1.
- `src/world/weather.ts` — no schema change needed; we read `intensity` only.

---

## Sourcing checklist (during session)

Recommended CC0 sources, in order:

1. **freesound.org** — filter by license "CC0". Search terms: "desert wind loop", "sandstorm wind loop", "cricket night loop", "distant hawk", "drone ambient pad".
2. **OpenGameArt.org** — has curated pads/drones tagged "ambient/desert/sci-fi", often loopable.
3. **Sonniss GDC bundles** (royalty-free, license-permissive enough for indie use — verify CC0 vs RF before commit).

Audition criteria (≤ 3 min per file): does it loop without an obvious seam? Does it sit at the recommended peak level? Edit in Audacity if needed: trim to 15–60s, normalize, fade first/last 50ms if seam audible. Commit final files into `public/audio/`. **Do not commit unedited raw downloads** — they bloat the repo and often have hard cuts.

---

## Verification

1. **Type check**: `npx tsc --noEmit` — green.
2. **Boot**: `npm run dev`, open browser, dismiss start overlay (this triggers `ensureAudioStarted` + `startSoundscape`).
3. **Calm vibe check** (~30s listening with eyes closed): wind is barely audible, day-bed bird call once or twice, music sits just under the wind. Should *clearly* improve over silence — if it feels worse than V/W silence, treat as a failure and reduce master gains.
4. **Time-of-day swap**: `__game.setTime(0.5)` → day-bed should be active; `__game.setTime(0.0)` → night-bed; crossfade smooth (no clicks). `__game.audioState()` shows the gain values.
5. **Storm transition**: `__game.triggerStorm()` → over the next ~8s of building, wind crossfades calm → mid → storm; ambient life beds fade out; calm music fades down as tense music swells. After ~90s storm + 12s settling, all reverses.
6. **Loop-seam audit**: leave each layer playing isolated for 2× its file length (mute the others via `audioState` setters added in debug panel, OR temporarily set MASTER overrides). Listen for thumps/clicks at seams. Re-trim files if audible.
7. **Missing-file graceful path**: rename one .ogg, reload, confirm no crash + console warning + that layer is silent. Restore.
8. **Browser preview snapshot**: `preview_console_logs` to confirm `AudioContext: running` + no decode errors after first click.

---

## Risk register

- **Sample mix levels are unknowable until files exist.** Targets in the spec table are starting points. Plan reserves time to re-normalize during sourcing.
- **Loop seams.** Mitigated by 0.5s linearRampToValueAtTime gain ramps that mask gain transitions; per-stem seams still audible unless files are clean. Audacity edit pass is part of the sourcing checklist.
- **Continuous quiet music could grate.** If 30s of calm listening feels worse than silence, drop `MUSIC_CALM_TARGET` to 0.10 or implement option C (sparse fade-in/out cycle) as a follow-up.
- **Web Audio decode is async.** Soundscape must tolerate buffers arriving over the first ~500ms after first-click. Plan handles this by building stems lazily as buffers resolve.
- **No new perf cost** — 5–7 always-running BufferSourceNodes is negligible vs. existing scene/physics load.
