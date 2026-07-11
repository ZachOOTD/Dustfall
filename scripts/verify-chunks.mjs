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

function run(scenario, seed, port) {
  const r = spawnSync('node', ['scripts/rig-shot.mjs', `--scenario=${scenario}`, `--seed=${seed}`, `--port=${port}`], {
    cwd: ROOT, encoding: 'utf8', shell: false, timeout: 420000,
  });
  return `${r.stdout || ''}${r.stderr || ''}`;
}

/** Run + parse with one bounded retry on the no-line boot-race signature. */
function runParsed(scenario, seed, port, regex) {
  let out = run(scenario, seed, port);
  let m = out.match(regex);
  if (!m) {
    console.log(`  transient boot failure (${scenario} seed ${seed}) — retrying (1/1)…`);
    out = run(scenario, seed, port + 37);
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
const sm = runParsed('chunk-streaming', 1337, 5480, /CHUNK-STREAM pass=(\d) bodies=(\d+)->(\d+) chunks=(\d+)\/(\d+) farMarkers=(\d+) tiles=(\d+) fails=(\d+)/);
if (!sm) {
  allPass = false;
  rows.push('streaming: NO PROBE LINE (boot failed after retry)  *** FAIL ***');
} else {
  const ok = sm[1] === '1';
  if (!ok) allPass = false;
  rows.push(`streaming: bodies ${sm[2]}→${sm[3]}, chunks ${sm[4]}/${sm[5]} (home/far), farMarkers=${sm[6]}, tiles=${sm[7]}, ${sm[8]} fails  ${ok ? 'OK' : '*** FAIL ***'}`);
}

console.log('\n=== verify:chunks (infinite-world determinism + streaming/leak gate) ===');
for (const row of rows) console.log('  ' + row);
console.log(allPass
  ? '\nCHUNKS GATE: PASS — deterministic per-chunk content, clean streaming, no body leaks.'
  : '\nCHUNKS GATE: FAIL — the infinite-world machinery regressed (see rows above).');
process.exit(allPass ? 0 : 1);
