// verify:chunks — the INFINITE-WORLD GATE (Infinite Sands S1, campaign 2026-07-10).
//
// Two permanent probes over the chunk-streaming machinery (src/world/chunkManager.ts
// + the streaming terrain tile ring in src/world/terrain.ts):
//
//   1. chunk-determinism — per-chunk content is a PURE function of
//      (worldSeed, cx, cz): descriptors byte-identical across derivations,
//      adjacent chunks distinct. Runs at TWO seeds and additionally asserts
//      the two seeds' world digests DIFFER (the seed actually feeds the hash).
//   2. chunk-streaming — walks the player past the old ±1200m world edge and
//      back twice: terrain follows, chunks load/unload with no seam
//      duplicates, reloaded chunks regenerate identically, and the global
//      Rapier body count returns to baseline (rule 9 — no leaks).
//
//   npm run verify:chunks
//
// Mirrors verify-placement.mjs: stdout-parsed (rig-shot teardown can exit
// non-zero after the probe prints), with a single bounded retry per run on
// the headless-boot-race signature (NO probe line at all). A run that
// PRINTED a failing probe line is a real failure and is never retried.

import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DET_SEEDS = [1337, 7];

// Per-scenario child timeout. The streaming walk is LONG (a 4×1.5km
// teleport walk with POI generation; ~3-4 min alone, plus a cold Vite boot
// that can take 60-120s under machine load) — a too-tight spawnSync timeout
// KILLS the child mid-probe, which both reads as the boot-failure signature
// ("no probe line") AND leaks the child's dev server (rig-shot's taskkill
// teardown never runs). 15 min is a give-up deadline, not a wait.
function run(scenario, seed, port, timeout) {
  const r = spawnSync('node', ['scripts/rig-shot.mjs', `--scenario=${scenario}`, `--seed=${seed}`, `--port=${port}`], {
    cwd: ROOT, encoding: 'utf8', shell: false, timeout,
  });
  return `${r.stdout || ''}${r.stderr || ''}`;
}

/** Run + parse with one bounded retry on the no-line boot-race signature. */
function runParsed(scenario, seed, port, regex, timeout = 420000) {
  let out = run(scenario, seed, port, timeout);
  let m = out.match(regex);
  if (!m) {
    console.log(`  transient boot failure (${scenario} seed ${seed}) — retrying (1/1)…`);
    out = run(scenario, seed, port + 37, timeout);
    m = out.match(regex);
  }
  return m;
}

let allPass = true;
const rows = [];

// ── 1. Determinism at two seeds + cross-seed distinctness ──
const digests = [];
let detPort = 5470;
for (const seed of DET_SEEDS) {
  const m = runParsed('chunk-determinism', seed, detPort, /CHUNK-DET seed=(\d+) digest=([0-9a-f]+) pass=(\d+)\/(\d+) fails=(\d+)/);
  detPort += 3;
  if (!m) {
    allPass = false;
    rows.push(`determinism seed ${seed}: NO PROBE LINE (boot failed after retry)  *** FAIL ***`);
    continue;
  }
  const ok = m[5] === '0' && m[3] === m[4];
  if (!ok) allPass = false;
  digests.push(m[2]);
  rows.push(`determinism seed ${seed}: ${m[3]}/${m[4]} stable, digest=${m[2]}  ${ok ? 'OK' : '*** FAIL ***'}`);
}
if (digests.length === 2 && digests[0] === digests[1]) {
  allPass = false;
  rows.push(`cross-seed: seeds ${DET_SEEDS.join('/')} produced the SAME digest — worldSeed does not feed chunk content  *** FAIL ***`);
} else if (digests.length === 2) {
  rows.push(`cross-seed: digests differ (${digests[0]} vs ${digests[1]})  OK`);
}

// ── 2. Streaming / leak walk (one seed — the walk itself is the test) ──
const sm = runParsed('chunk-streaming', 1337, 5480, /CHUNK-STREAM pass=(\d) bodies=(\d+)->(\d+) chunks=(\d+)\/(\d+) farMarkers=(\d+) farPois=(\d+) farSalvage=(\d+) farRocks=(\d+) farFauna=(\d+) tiles=(\d+) persisted=(\d) fails=(\d+)/, 900000);
if (!sm) {
  allPass = false;
  rows.push('streaming: NO PROBE LINE (boot failed after retry)  *** FAIL ***');
} else {
  const ok = sm[1] === '1';
  if (!ok) allPass = false;
  rows.push(`streaming: bodies ${sm[2]}→${sm[3]}, chunks ${sm[4]}/${sm[5]} (home/far), farMarkers=${sm[6]}, farPois=${sm[7]}, farSalvage=${sm[8]}, farRocks=${sm[9]}, farFauna=${sm[10]}, tiles=${sm[11]}, persisted=${sm[12]}, ${sm[13]} fails  ${ok ? 'OK' : '*** FAIL ***'}`);
}

// ── 3. Generation perf (S6): sliced tile builds, bounded chunk loads,
//      draw/body ceilings across a multi-km walk ──
const pm = runParsed('chunk-perf', 1337, 5490, /CHUNK-PERF pass=(\d) slice=([\d.]+)ms\(fill=([\d.]+)\/geo=([\d.]+)\/fin=([\d.]+)\) steps=(\d+) load=([\d.]+)ms lm=([\d.]+)ms draw=(\d+)->(\d+) bodies=(\d+)->(\d+)->(\d+) fails=(\d+)/, 900000);
if (!pm) {
  allPass = false;
  rows.push('perf: NO PROBE LINE (boot failed after retry)  *** FAIL ***');
} else {
  const ok = pm[1] === '1';
  if (!ok) allPass = false;
  rows.push(`perf: slice ${pm[2]}ms (fill ${pm[3]} / geo ${pm[4]} / fin ${pm[5]}), ${pm[6]} steps, load ${pm[7]}ms, landmark-piece ${pm[8]}ms, draw ${pm[9]}→${pm[10]}, bodies ${pm[11]}→${pm[12]}→${pm[13]}, ${pm[14]} fails  ${ok ? 'OK' : '*** FAIL ***'}`);
}

// ── 4. M7-S2 — the Skyfall interior walk (rule 9 real-motion: enter through
//      the fracture, walk all 3 compartments + both doorways, exit, re-enter;
//      castDown collider-identity proves no fall-through). ──
const wm = runParsed('skyfall-walk', 1337, 5495, /SKYFALL-WALK pass=(\d) waypoints=(\d+) fails=(\d+)/, 900000);
if (!wm) {
  allPass = false;
  rows.push('skyfall-walk: NO PROBE LINE (boot failed after retry)  *** FAIL ***');
} else {
  const ok = wm[1] === '1';
  if (!ok) allPass = false;
  rows.push(`skyfall-walk: ${wm[2]} waypoints walked (enter/exit/re-enter + both doorways), ${wm[3]} fails  ${ok ? 'OK' : '*** FAIL ***'}`);
}

// ── 5. The LEVIATHAN interior walk (rule 9 real-motion: the fixed colossal
//      monument's enterable hold — enter through the fracture, walk all 3
//      compartments + both doorways, exit, re-enter; castDown collider-identity
//      proves no fall-through / no invisible wall). Not chunk-streamed, but the
//      same real-motion collision proof the skyfall walk provides. ──
const lm = runParsed('leviathan-walk', 1337, 5497, /LEVIATHAN-WALK pass=(\d) waypoints=(\d+) fails=(\d+)/, 900000);
if (!lm) {
  allPass = false;
  rows.push('leviathan-walk: NO PROBE LINE (boot failed after retry)  *** FAIL ***');
} else {
  const ok = lm[1] === '1';
  if (!ok) allPass = false;
  rows.push(`leviathan-walk: ${lm[2]} waypoints walked (enter/exit/re-enter + both doorways), ${lm[3]} fails  ${ok ? 'OK' : '*** FAIL ***'}`);
}

// ── 6. The colossal RIBCAGE climb gate (bone_field hero — Zach's walk-test: "full
//      collision on the top, i want to be able to climb it"). Builds the ribcage via
//      the REAL code path + colliders, then proves the collision is a WALKABLE surface
//      (rest-on-top castDown at crest + rib samples, a sphere CLIMB march from the sand
//      up the spine to the crown, a TRAVERSE march out along a rib) — the march is the
//      proof (teleported waypoints lie). Not chunk-streamed, but the same real-motion
//      collision proof. ──
const cm = runParsed('ribcage-climb', 1337, 5499, /RIBCAGE-CLIMB pass=(\d) bodies=(\d+) crest=(\d+)pts ribs=(\d+) crestRest=(\S+) ribRest=(\S+) climb=(\S+) traverse=(\S+) fails=(\d+)/, 420000);
if (!cm) {
  allPass = false;
  rows.push('ribcage-climb: NO PROBE LINE (boot failed after retry)  *** FAIL ***');
} else {
  const ok = cm[1] === '1';
  if (!ok) allPass = false;
  rows.push(`ribcage-climb: ${cm[2]} colliders, crest ${cm[3]}pts / ${cm[4]} ribs, crestRest=${cm[5]}, ribRest=${cm[6]}, climb=${cm[7]}, traverse=${cm[8]}, ${cm[9]} fails  ${ok ? 'OK' : '*** FAIL ***'}`);
}

console.log('\n=== verify:chunks (infinite-world determinism + streaming/leak + generation-perf gate) ===');
for (const row of rows) console.log('  ' + row);
console.log(allPass
  ? '\nCHUNKS GATE: PASS — deterministic per-chunk content, clean streaming, no body leaks.'
  : '\nCHUNKS GATE: FAIL — the infinite-world machinery regressed (see rows above).');
process.exit(allPass ? 0 : 1);
