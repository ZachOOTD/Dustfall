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
function run(scenario, seed, port, timeout, extraArgs = []) {
  const r = spawnSync('node', ['scripts/rig-shot.mjs', `--scenario=${scenario}`, `--seed=${seed}`, `--port=${port}`, ...extraArgs], {
    cwd: ROOT, encoding: 'utf8', shell: false, timeout,
  });
  return `${r.stdout || ''}${r.stderr || ''}`;
}

/** Run + parse with one bounded retry on the no-line boot-race signature. */
function runParsed(scenario, seed, port, regex, timeout = 420000, extraArgs = []) {
  let out = run(scenario, seed, port, timeout, extraArgs);
  let m = out.match(regex);
  if (!m) {
    console.log(`  transient boot failure (${scenario} seed ${seed}) — retrying (1/1)…`);
    out = run(scenario, seed, port + 37, timeout, extraArgs);
    m = out.match(regex);
  }
  // DEEPER cycle 5 — a single scenario run can print SEVERAL probe lines (chunk-perf now prints both
  // CHUNK-PERF and CAVE-BUILD). Carry the raw stdout so a second regex can be applied to the SAME run
  // instead of paying for a second 15-minute walk.
  if (m) m.raw = out;
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

// ── 3b. DEEPER cycle 5 (walk-test D-4) — CAVE BUILD BUDGET + RESIDENT CAP. Printed by the SAME
//      chunk-perf run (no extra boot). Asserts the streamed-cave build is SLICED (not one ~1.2s
//      synchronous hitch), that the divisible slice budget and the ATOMIC Rapier trimesh bake each
//      sit inside their own tripwire, that the caves ACTUALLY BUILT (a gate that passes because
//      nothing built is the failure mode this project keeps hitting), that the resident cap evicts,
//      and that the cave the player is standing INSIDE is never the one evicted.
const cbRe = /CAVE-BUILD pass=(\d) preload=([-\d.]+)ms\(ent=([-\d.]+)\/body=([-\d.]+)\) builds=(\d+) steps=(\d+) slice=([\d.]+)ms atomic=([\d.]+)ms\((\S+)\) frame=([\d.]+)ms residents=(\d+) evict=(\d+) occBlocked=(\d+) occSurvived=(\d) fails=(\d+)/;
const cb = pm && pm.raw ? pm.raw.match(cbRe) : null;
if (!cb) {
  allPass = false;
  rows.push('cave-build: NO PROBE LINE (the cave-build leg of chunk-perf did not report)  *** FAIL ***');
} else {
  const okCb = cb[1] === '1';
  if (!okCb) allPass = false;
  rows.push(`cave-build: preload ${cb[2]}ms (tor ${cb[3]} / body ${cb[4]}), ${cb[5]} sliced builds in ${cb[6]} steps, divisible slice ${cb[7]}ms / atomic ${cb[8]}ms (${cb[9]}) / worst frame ${cb[10]}ms, residents ${cb[11]}, ${cb[12]} evictions (occupied-blocked ${cb[13]}, survived=${cb[14]}), ${cb[15]} fails  ${okCb ? 'OK' : '*** FAIL ***'}`);
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

// ── 7. The Deep Desert — the ERG (mega dune-sea) PLAYABILITY gate. For BOTH
//      seeds: locate the nearest erg, sample the real pure height function across
//      the core dunes, and assert windward faces are walkable (≤30°), slip faces
//      sit at the angle of repose (the sled's playground), the erg→desert border
//      has no seam-slope spike, the mega-dunes are colossal (40-70m), a KCC march
//      climbs a windward face, and the erg height fn stays within the perf budget. ──
let dsPort = 5500;
for (const seed of DET_SEEDS) {
  const dm = runParsed('dune-slope', seed, dsPort,
    /DUNE-SLOPE pass=(\d) seed=(\S+) erg=\((-?\d+),(-?\d+)\)@(\d+)m .*windP95=([\d.]+)° .*slipMed=([\d.]+)° .*amp=([\d.]+)m border=([\d.]+)° .*fails=(\d+)/,
    420000);
  dsPort += 3;
  if (!dm) {
    allPass = false;
    rows.push(`dune-slope seed ${seed}: NO PROBE LINE (boot failed after retry)  *** FAIL ***`);
    continue;
  }
  const ok = dm[1] === '1';
  if (!ok) allPass = false;
  rows.push(`dune-slope seed ${seed}: erg@${dm[5]}m windP95=${dm[6]}° slipMed=${dm[7]}° amp=${dm[8]}m border=${dm[9]}°, ${dm[10]} fails  ${ok ? 'OK' : '*** FAIL ***'}`);
}

// ── 8. THE CAVE (UNDERWORLD, shipped 2026-07-20) — the generated cave is now default-ON, so its
//      real-KCC full-tree walk is a permanent gate. For BOTH seeds: a full march (surface → mouth →
//      every chamber depth-first → back out) must PASS, and the flag-on layout+mesh digest must be
//      STABLE ×2 (same seed twice → identical digest). This replaces the old flag-off digest-identity
//      proof: with the cave shipped, the invariant is flag-on determinism, not "no surface change".
let cavePort = 5520;
for (const seed of DET_SEEDS) {
  const re = /CAVE-WALK pass=(\d) seed=(\S+) digest=(\S+) chambers=(\d+) .* reached=(\d+)\/(\d+)/;
  const a = runParsed('cave-walk', seed, cavePort, re, 600000);
  const b = runParsed('cave-walk', seed, cavePort + 1, re, 600000);
  cavePort += 3;
  if (!a || !b) {
    allPass = false;
    rows.push(`cave-walk seed ${seed}: NO PROBE LINE (boot failed after retry)  *** FAIL ***`);
    continue;
  }
  const passA = a[1] === '1', passB = b[1] === '1';
  const stable = a[3] === b[3];
  const ok = passA && passB && stable;
  if (!ok) allPass = false;
  rows.push(`cave-walk seed ${seed}: reached ${a[5]}/${a[6]} chambers, digest ${a[3]}${stable ? ' (stable ×2)' : ` vs ${b[3]} *** DIGEST DRIFT ***`}, pass=${passA ? 1 : 0}/${passB ? 1 : 0}  ${ok ? 'OK' : '*** FAIL ***'}`);
}

// ── 9. DEEPER cycle 5 — the ORIGIN-CAVE PRELOAD, at BOTH flag states. Boot-only (no walk), so it
//      is cheap enough to run twice. ON: the cave was built during module init — i.e. behind the boot
//      loading screen, before the first presented frame — and adopted as a PINNED resident with real
//      visual AND collider triangles. OFF (`--cave=0`): no preload record, no residents, and the
//      flag-off world still boots — the shipped kill-switch path cannot be regressed by the preload.
{
  const preRe = /CAVE-PRELOAD pass=(\d) flag=(\d) boot=([-\d.]+)ms preload=([-\d.]+)ms\(ent=([-\d.]+)\/body=([-\d.]+)\) tris=(\d+) digest=(\S+) fails=(\d+)/;
  const legsCfg = [
    { label: 'flag ON ', args: [], port: 5540 },
    { label: 'VITE_CAVE=0', args: ['--cave=0'], port: 5543 },
  ];
  for (const leg of legsCfg) {
    const m = runParsed('cave-preload', 1337, leg.port, preRe, 420000, leg.args);
    if (!m) {
      allPass = false;
      rows.push(`cave-preload ${leg.label}: NO PROBE LINE (boot failed after retry)  *** FAIL ***`);
      continue;
    }
    const okPl = m[1] === '1';
    if (!okPl) allPass = false;
    rows.push(`cave-preload ${leg.label}: boot ${m[3]}ms, cave preload ${m[4]}ms (tor ${m[5]} / body ${m[6]}), ${m[7]} tris, digest ${m[8]}, ${m[9]} fails  ${okPl ? 'OK' : '*** FAIL ***'}`);
  }
}

console.log('\n=== verify:chunks (infinite-world determinism + streaming/leak + generation-perf gate) ===');
for (const row of rows) console.log('  ' + row);
console.log(allPass
  ? '\nCHUNKS GATE: PASS — deterministic per-chunk content, clean streaming, no body leaks.'
  : '\nCHUNKS GATE: FAIL — the infinite-world machinery regressed (see rows above).');
process.exit(allPass ? 0 : 1);
