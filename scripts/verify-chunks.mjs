// verify:chunks — THE INFINITE-WORLD / UNDERWORLD GATE RUNNER
// (Infinite Sands S1 2026-07-10 · parallelized DEEPER 2026-07-27.)
//
// ─────────────────────────────────────────────────────────────────────────────
// WHAT THIS IS
//   One runner over every permanent world-machinery probe. Each LEG is an
//   independent headless rig-shot process on its own port; a leg's verdict comes
//   from parsing its probe line out of stdout (rig-shot teardown can exit
//   non-zero *after* the probe has printed, so the exit code is not the signal).
//
//   Run it:
//     npm run verify:chunks                       # the FULL suite (the gate of record)
//     npm run verify:chunks -- --legs=cave-walk   # only the legs a change touches
//     npm run verify:chunks -- --serial           # the old one-at-a-time path, for debugging
//     npm run verify:chunks -- --list             # the leg inventory + phase assignment
//
// ─────────────────────────────────────────────────────────────────────────────
// WHY IT IS PARALLEL (EFFICIENCY WATCH, Zach 2026-07-27)
//   The serial suite grew to ~90 min and was measured as the #1 wall-clock cost
//   of the DEEPER campaign. Legs are independent processes, so most of them run
//   concurrently. Two rules keep that from buying speed with lies:
//
//   1. CLOCK-COUPLED LEGS RUN SOLO, ON A QUIET MACHINE. A leg whose verdict can
//      move with machine load cannot share the machine — a contended measurement
//      is a made-up measurement, and a gate that reds on contention is a gate
//      people learn to ignore. Two kinds qualify, and BOTH were established by
//      reading the scenario and then measuring, never by assumption:
//        · explicit millisecond tripwires — `chunk-perf`'s slice/load budgets,
//          the `cave-build` sub-row's 20/170/260ms, `cave-density`'s
//          shader-warm-frame checks;
//        · dt-coupled KCC marches over marginal geometry — `cave-kinds`, which
//          demonstrably flips a kind's march verdict under 4-way load (see its
//          leg comment for the measurement).
//      Phase 1 runs the correctness legs concurrently; phase 2 runs the timing
//      legs one at a time after a settle delay. Perf integrity outranks the
//      wall-clock target: if in doubt, raise `--settle`, never the tripwires.
//   2. NO SHARED WRITABLE STATE. Every leg gets its own dev-server port (and its
//      own retry port — the old `port+37` retry could land on another leg's port
//      once these overlap in time) and, in the parallel phase, its own rig-shot
//      output directory via RIG_OUT_DIR, so two legs of the same scenario at
//      different seeds can never race on `verification/scen-*.png`.
//
// ─────────────────────────────────────────────────────────────────────────────
// THE TEETH ARE UNCHANGED
//   Every regex, every threshold, every vacuous-pass guard is the serial
//   runner's, moved not rewritten. Exit code semantics unchanged: any red leg
//   (or any red aggregate) → exit 1. The single bounded retry is still ONLY on
//   the boot-race signature (NO probe line at all); a run that PRINTED a failing
//   probe line is a real failure and is never retried.
//
//   Two things got STRONGER while moving:
//     · `verify-cave-void.mjs` is now a LEG instead of a `&&` chain in
//       package.json. The chain silently skipped the see-through gate whenever
//       anything else failed — i.e. exactly when you most want to know.
//     · Every leg's full stdout+stderr is teed to
//       `verification/gate-logs/<UTC>-<leg>.txt`. A result is never lost to an
//       over-narrow console filter and never re-run just to report it.
//
// ─────────────────────────────────────────────────────────────────────────────
// LEG INVENTORY — the names `--legs=` accepts (also printed by `--list`).
//   Filters match a leg's NAME or its GROUP, so `--legs=cave-walk` takes all
//   four cave-walk runs and `--legs=cave-walk-7a` takes exactly one. An
//   unknown name is a hard error (exit 2) — a typo must never quietly run
//   nothing and report success.

import { spawn, spawnSync } from 'node:child_process';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, mkdirSync, createWriteStream, writeFileSync } from 'node:fs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DET_SEEDS = [1337, 7];

const argv = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, v] = a.replace(/^--/, '').split('=');
  return [k, v ?? true];
}));

const SERIAL = argv.serial === true || String(argv.serial) === '1';
// jobs=4 is not a guess. MEASURED 2026-07-27: the parallel phase is ~48 min of summed leg time
// with `cave-kinds` in the quiet phase, and its longest single leg is `cave-streamed-7` at ~9 min.
// At jobs=3 the phase runs ~16 min; at jobs=4 it runs ~12-13 min, at which point the quiet phase
// (~19 min, serial by construction) dominates the suite and more workers buy contention for
// nothing. Parallel-phase legs carry no clock-coupled assertions, so concurrency there costs
// wall-clock only, never a verdict.
const JOBS = Math.max(1, Number(argv.jobs ?? 4));
// A settle window between the parallel phase and the quiet timing phase: Windows
// process-tree teardown lags, and a chromium/vite that is still exiting is still
// stealing frames from a leg that measures frames.
const SETTLE_S = Number(argv.settle ?? 45);
// Per-leg timeouts are GIVE-UP DEADLINES, not assertions. Under concurrency a leg
// legitimately takes longer, so the deadline scales; the tripwires never do.
const TIMEOUT_SCALE = Number(argv['timeout-scale'] ?? 1.6);
const RUN_STAMP = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const LOG_DIR = resolve(ROOT, 'verification', 'gate-logs');

// ─────────────────────────────────────────────────────────────────────────────
// LEG TABLE
//
// Each leg: { name, group, scenario, seed, args, timeout, solo, est, re, row(), noLineRow }
//   solo    — true ⇒ runs alone in the quiet phase (its assertions read a clock).
//   est     — minutes, used ONLY to schedule longest-first. Never asserted on.
//   re      — the primary probe regex. No match ⇒ boot race ⇒ one bounded retry.
//   row(m, out) → { ok, rows: [...], data } — the verdict + the printed row(s).
//
// Ports are allocated from a private contiguous block (5400 + 4·index), with the
// retry port at +2, so every leg — and every retry — owns a port nothing else in
// this suite can take. 52xx stays free for the SPEED-RULES agent probe path and
// 5173 for `npm run dev`.
const LEGS = [];
function leg(spec) {
  const i = LEGS.length;
  LEGS.push({ args: [], timeout: 420000, solo: false, est: 3, ...spec, port: 5400 + i * 4, retryPort: 5402 + i * 4 });
}

// ── 1. Determinism at two seeds (+ the cross-seed distinctness aggregate) ──
for (const seed of DET_SEEDS) {
  leg({
    name: `determinism-${seed}`, group: 'determinism', scenario: 'chunk-determinism', seed, est: 1.5,
    re: /CHUNK-DET seed=(\d+) digest=([0-9a-f]+) pass=(\d+)\/(\d+) fails=(\d+)/,
    row(m) {
      const ok = m[5] === '0' && m[3] === m[4];
      return { ok, data: { digest: m[2] }, rows: [`determinism seed ${seed}: ${m[3]}/${m[4]} stable, digest=${m[2]}  ${ok ? 'OK' : '*** FAIL ***'}`] };
    },
    noLineRow: `determinism seed ${seed}: NO PROBE LINE (boot failed after retry)  *** FAIL ***`,
  });
}

// ── 2. Streaming / leak walk (one seed — the walk itself is the test) ──
leg({
  name: 'streaming', group: 'streaming', scenario: 'chunk-streaming', seed: 1337, timeout: 900000, est: 6,
  re: /CHUNK-STREAM pass=(\d) bodies=(\d+)->(\d+) chunks=(\d+)\/(\d+) farMarkers=(\d+) farPois=(\d+) farSalvage=(\d+) farRocks=(\d+) farFauna=(\d+) tiles=(\d+) persisted=(\d) fails=(\d+)/,
  row(m) {
    const ok = m[1] === '1';
    return { ok, rows: [`streaming: bodies ${m[2]}→${m[3]}, chunks ${m[4]}/${m[5]} (home/far), farMarkers=${m[6]}, farPois=${m[7]}, farSalvage=${m[8]}, farRocks=${m[9]}, farFauna=${m[10]}, tiles=${m[11]}, persisted=${m[12]}, ${m[13]} fails  ${ok ? 'OK' : '*** FAIL ***'}`] };
  },
  noLineRow: 'streaming: NO PROBE LINE (boot failed after retry)  *** FAIL ***',
});

// ── 3 + 3b. Generation perf (S6) AND the cave build budget — ONE process, TWO rows.
//     SOLO: every assertion under both rows is a millisecond tripwire (terrain slice ≤60ms,
//     chunk load ≤120ms, landmark piece ≤120ms, sync bake ≤250ms; cave divisible slice ≤20ms,
//     indivisible ≤170ms, worst OBSERVED rAF gap ≤260ms). Those numbers are only meaningful on
//     a machine that is not doing anything else.
leg({
  name: 'perf', group: 'perf', aliases: ['cave-build'], scenario: 'chunk-perf', seed: 1337,
  timeout: 900000, solo: true, est: 6,
  re: /CHUNK-PERF pass=(\d) slice=([\d.]+)ms\(fill=([\d.]+)\/geo=([\d.]+)\/fin=([\d.]+)\) steps=(\d+) load=([\d.]+)ms lm=([\d.]+)ms draw=(\d+)->(\d+) bodies=(\d+)->(\d+)->(\d+) fails=(\d+)/,
  row(m, out) {
    const rows = [];
    const okPerf = m[1] === '1';
    rows.push(`perf: slice ${m[2]}ms (fill ${m[3]} / geo ${m[4]} / fin ${m[5]}), ${m[6]} steps, load ${m[7]}ms, landmark-piece ${m[8]}ms, draw ${m[9]}→${m[10]}, bodies ${m[11]}→${m[12]}→${m[13]}, ${m[14]} fails  ${okPerf ? 'OK' : '*** FAIL ***'}`);
    // The CAVE-BUILD sub-row is printed by the SAME chunk-perf run (no extra boot) — DEEPER
    // cycle 5, walk-test D-4. Asserts the streamed-cave build is SLICED (not one ~1.2s
    // synchronous hitch), that the divisible slice budget and the ATOMIC Rapier trimesh bake
    // each sit inside their own tripwire, that the caves ACTUALLY BUILT (a gate that passes
    // because nothing built is the failure mode this project keeps hitting), that the resident
    // cap evicts, and that the cave the player is standing INSIDE is never the one evicted.
    const cbRe = /CAVE-BUILD pass=(\d) preload=([-\d.]+)ms\(ent=([-\d.]+)\/body=([-\d.]+)\) builds=(\d+) steps=(\d+) slice=([\d.]+)ms atomic=([\d.]+)ms\((\S+)\) frame=([\d.]+)ms residents=(\d+) evict=(\d+) occBlocked=(\d+) occSurvived=(\d) fails=(\d+)/;
    const cb = out.match(cbRe);
    let okCb = false;
    if (!cb) {
      rows.push('cave-build: NO PROBE LINE (the cave-build leg of chunk-perf did not report)  *** FAIL ***');
    } else {
      okCb = cb[1] === '1';
      rows.push(`cave-build: preload ${cb[2]}ms (tor ${cb[3]} / body ${cb[4]}), ${cb[5]} sliced builds in ${cb[6]} steps, divisible slice ${cb[7]}ms / atomic ${cb[8]}ms (${cb[9]}) / worst frame ${cb[10]}ms, residents ${cb[11]}, ${cb[12]} evictions (occupied-blocked ${cb[13]}, survived=${cb[14]}), ${cb[15]} fails  ${okCb ? 'OK' : '*** FAIL ***'}`);
    }
    return { ok: okPerf && okCb, rows };
  },
  noLineRow: ['perf: NO PROBE LINE (boot failed after retry)  *** FAIL ***', 'cave-build: NO PROBE LINE (chunk-perf never reported)  *** FAIL ***'],
});

// ── 4. M7-S2 — the Skyfall interior walk (rule 9 real-motion: enter through the fracture, walk
//      all 3 compartments + both doorways, exit, re-enter; castDown collider-identity proves no
//      fall-through). ──
leg({
  name: 'skyfall-walk', group: 'skyfall-walk', scenario: 'skyfall-walk', seed: 1337, timeout: 900000, est: 3,
  re: /SKYFALL-WALK pass=(\d) waypoints=(\d+) fails=(\d+)/,
  row(m) {
    const ok = m[1] === '1';
    return { ok, rows: [`skyfall-walk: ${m[2]} waypoints walked (enter/exit/re-enter + both doorways), ${m[3]} fails  ${ok ? 'OK' : '*** FAIL ***'}`] };
  },
  noLineRow: 'skyfall-walk: NO PROBE LINE (boot failed after retry)  *** FAIL ***',
});

// ── 5. The LEVIATHAN interior walk — the fixed colossal monument's enterable hold. Not
//      chunk-streamed, but the same real-motion collision proof. ──
leg({
  name: 'leviathan-walk', group: 'leviathan-walk', scenario: 'leviathan-walk', seed: 1337, timeout: 900000, est: 3,
  re: /LEVIATHAN-WALK pass=(\d) waypoints=(\d+) fails=(\d+)/,
  row(m) {
    const ok = m[1] === '1';
    return { ok, rows: [`leviathan-walk: ${m[2]} waypoints walked (enter/exit/re-enter + both doorways), ${m[3]} fails  ${ok ? 'OK' : '*** FAIL ***'}`] };
  },
  noLineRow: 'leviathan-walk: NO PROBE LINE (boot failed after retry)  *** FAIL ***',
});

// ── 6. The colossal RIBCAGE climb gate (bone_field hero — Zach's walk-test: "full collision on
//      the top, i want to be able to climb it"). The MARCH is the proof; teleported waypoints lie. ──
leg({
  name: 'ribcage-climb', group: 'ribcage-climb', scenario: 'ribcage-climb', seed: 1337, est: 3,
  re: /RIBCAGE-CLIMB pass=(\d) bodies=(\d+) crest=(\d+)pts ribs=(\d+) crestRest=(\S+) ribRest=(\S+) climb=(\S+) traverse=(\S+) fails=(\d+)/,
  row(m) {
    const ok = m[1] === '1';
    return { ok, rows: [`ribcage-climb: ${m[2]} colliders, crest ${m[3]}pts / ${m[4]} ribs, crestRest=${m[5]}, ribRest=${m[6]}, climb=${m[7]}, traverse=${m[8]}, ${m[9]} fails  ${ok ? 'OK' : '*** FAIL ***'}`] };
  },
  noLineRow: 'ribcage-climb: NO PROBE LINE (boot failed after retry)  *** FAIL ***',
});

// ── 7. The Deep Desert — the ERG (mega dune-sea) PLAYABILITY gate, both seeds. Windward faces
//      walkable (≤30°), slip faces at the angle of repose, no seam-slope spike at the border,
//      colossal amplitude, a KCC march up a windward face, and the erg height fn inside its perf
//      budget. NOTE the perf assertion is RELATIVE (erg grid vs origin grid, ×4 + 30ms slack),
//      both measured in the same process on the same frame — so it does not need the quiet phase.
for (const seed of DET_SEEDS) {
  leg({
    name: `dune-slope-${seed}`, group: 'dune-slope', scenario: 'dune-slope', seed, est: 2,
    re: /DUNE-SLOPE pass=(\d) seed=(\S+) erg=\((-?\d+),(-?\d+)\)@(\d+)m .*windP95=([\d.]+)° .*slipMed=([\d.]+)° .*amp=([\d.]+)m border=([\d.]+)° .*fails=(\d+)/,
    row(m) {
      const ok = m[1] === '1';
      return { ok, rows: [`dune-slope seed ${seed}: erg@${m[5]}m windP95=${m[6]}° slipMed=${m[7]}° amp=${m[8]}m border=${m[9]}°, ${m[10]} fails  ${ok ? 'OK' : '*** FAIL ***'}`] };
    },
    noLineRow: `dune-slope seed ${seed}: NO PROBE LINE (boot failed after retry)  *** FAIL ***`,
  });
}

// ── 8. THE CAVE (UNDERWORLD, shipped 2026-07-20) — a full-tree KCC march (surface → mouth →
//      every chamber depth-first → back out) must PASS, and the layout+mesh digest must be
//      STABLE ×2 at the same seed. The two runs per seed are two independent derivations; they
//      are separate legs so they can run concurrently, and the ×2 digest comparison is the
//      `cave-walk-<seed>` aggregate below.
for (const seed of DET_SEEDS) {
  for (const half of ['a', 'b']) {
    leg({
      name: `cave-walk-${seed}${half}`, group: 'cave-walk', scenario: 'cave-walk', seed, timeout: 600000, est: 5,
      re: /CAVE-WALK pass=(\d) seed=(\S+) kind=(?:\S+) digest=(\S+) chambers=(\d+) .* reached=(\d+)\/(\d+)/,
      row(m) {
        // The row for cave-walk is emitted by the per-seed aggregate (it needs both halves).
        return { ok: m[1] === '1', rows: [], data: { digest: m[3], pass: m[1] === '1', reached: m[5], total: m[6] } };
      },
      noLineRow: `cave-walk seed ${seed} (run ${half}): NO PROBE LINE (boot failed after retry)  *** FAIL ***`,
      quiet: true,   // the aggregate prints the row; a green half prints nothing of its own
    });
  }
}

// ── 9. DEEPER cycle 5 — the ORIGIN-CAVE PRELOAD, at BOTH flag states. Boot-only (no walk).
//      ON: the cave was built during module init — behind the boot loading screen, before the
//      first presented frame — and adopted as a PINNED resident with real visual AND collider
//      triangles. OFF (`--cave=0`): no preload record, no residents, and the flag-off world still
//      boots — the shipped kill-switch path cannot be regressed by the preload.
//      Its ms figures are REPORTED, never asserted (the only timing assertion is `body > 0`), so
//      it does not need the quiet phase.
for (const l of [{ tag: 'on', label: 'flag ON ', args: [] }, { tag: 'off', label: 'VITE_CAVE=0', args: ['--cave=0'] }]) {
  leg({
    name: `cave-preload-${l.tag}`, group: 'cave-preload', scenario: 'cave-preload', seed: 1337, args: l.args, est: 1.5,
    re: /CAVE-PRELOAD pass=(\d) flag=(\d) boot=([-\d.]+)ms preload=([-\d.]+)ms\(ent=([-\d.]+)\/body=([-\d.]+)\) tris=(\d+) digest=(\S+) fails=(\d+)/,
    row(m) {
      const ok = m[1] === '1';
      return { ok, rows: [`cave-preload ${l.label}: boot ${m[3]}ms, cave preload ${m[4]}ms (tor ${m[5]} / body ${m[6]}), ${m[7]} tris, digest ${m[8]}, ${m[9]} fails  ${ok ? 'OK' : '*** FAIL ***'}`] };
    },
    noLineRow: `cave-preload ${l.label}: NO PROBE LINE (boot failed after retry)  *** FAIL ***`,
  });
}

// ── 10. DEEPER cycle 6 — UNDERGROUND WATER, both seeds. ≥1 pool exists; the water plane carries
//       NO collider and the collider floor agrees with the VISIBLE bottom to within 5cm (rule 9);
//       a real KCC crossing wades through without an invisible wall and without the feet ever
//       rising onto the water plane; E fills the canteen AND the jerrycan at a pool; a WELL fills
//       the canteen and REFUSES the jerrycan; and the placement is byte-stable when re-derived.
//       Plus the round-13 additions inside the same run: the PIXEL gate (darker-than-lit-rock, a
//       LIVE ripple measured TEMPORALLY by advancing `uPoolTime` — deterministic, not wall-clock —
//       no banding plateaus, the unlit canary both ways), the GPU-anchored waterline, the per-cave
//       emitter proof, and the shader-anchor guard.
for (const seed of DET_SEEDS) {
  leg({
    name: `pool-fill-${seed}`, group: 'pool-fill', scenario: 'pool-fill', seed, est: 4,
    re: /POOL-FILL pass=(\d) seed=(\S+) digest=(\S+) pools=(\d+) fails=(\d+)/,
    row(m) {
      const ok = m[1] === '1';
      return { ok, data: { digest: m[3] }, rows: [`pool-fill seed ${seed}: ${m[4]} pools, digest ${m[3]}, ${m[5]} fails  ${ok ? 'OK' : '*** FAIL ***'}`] };
    },
    noLineRow: `pool-fill seed ${seed}: NO PROBE LINE (boot failed after retry)  *** FAIL ***`,
  });
}

// ── 11. DEEPER cycle 8 — CAVES AS ROCKY-TERRAIN DENSITY, both seeds. Site-list purity + the
//       placement rules + MEASURED density + the hole open/close mechanism restored to EXACTLY 0m
//       + a real streamed site in/out/in bit-identical with every leak canary back to baseline.
//
//       SOLO: this leg asserts on SHADER-COMPILE FRAMES — "0 programs compiled on the frame the
//       cave became visible" and "no warm-up hit CAVE_WARM_MAX_FRAMES". Both are frame-budget
//       claims: a contended GPU/CPU can push a compile past the warm-up window and red the gate
//       for a reason that has nothing to do with the code. It also reports the tor/slice/atomic/
//       worst-frame table that the density taste calls are read off.
for (const seed of DET_SEEDS) {
  leg({
    name: `cave-density-${seed}`, group: 'cave-density', scenario: 'cave-density', seed, timeout: 600000, solo: true, est: 5,
    re: /CAVE-DENSITY pass=(\d) digest=(\S+) sites=(\d+) spacing=([\d.]+)m\/(\d+)m extent=([\d.]+)m rocky=([\d.]+) perKm2=([\d.]+) perKm2Rocky=([\d.]+) encPerHour=([\d.]+) restoreMax=([\d.]+)m reentry=(\d) bodies=(\d+)->(\d+)->(\d+) tor=([\d.]+)ms fin=([\d.]+)ms teardown=([\d.]+)ms holeRebuild=([\d.]+)ms slice=([\d.]+)ms atomic=([\d.]+)ms\(([\w:-]+)\) warm=([\d.]+)ms\/(\d+)f×(\d+) progs=(\d+)->(\d+)\(visibleFrame (\d+)\) frame=([\d.]+)ms\(([\w:-]+)\) fails=(\d+)/,
    row(m) {
      const ok = m[1] === '1';
      return {
        ok, data: { digest: m[2] },
        rows: [`cave-density seed ${seed}: ${m[3]} sites, spacing ${m[4]}m (grid ${m[5]}m, cave extent ${m[6]}m), rocky ${m[7]}, ${m[8]}/km² world = ${m[9]}/km² rocky ≈ ${m[10]} per travel-hour, restore Δ${m[11]}m, re-entry ${m[12] === '1' ? 'bit-identical' : 'DRIFTED'}, bodies ${m[13]}→${m[14]}→${m[15]}, tor ${m[16]}ms / slice ${m[20]}ms / atomic ${m[21]}ms (${m[22]}) / finalize ${m[17]}ms / teardown ${m[18]}ms / hole ${m[19]}ms, shader warm ${m[23]}ms + ${m[24]}f wait ×${m[25]} (programs ${m[26]}→${m[27]}, ${m[28]} on the visible frame), worst frame ${m[29]}ms (${m[30]}), ${m[31]} fails  ${ok ? 'OK' : '*** FAIL ***'}`],
      };
    },
    noLineRow: `cave-density seed ${seed}: NO PROBE LINE (boot failed after retry)  *** FAIL ***`,
  });
}

// ── 12. DEEPER cycle 8 — THE STREAMED CAVES GET WALKED, both seeds. The two nearest streamed
//       sites arrive through the shipped path; the nearest gets the FULL cave-walk Euler-tour KCC
//       march, BOTH get the FULL cave-void sweep. Not a copy of those gates — literally those
//       gates pointed at a resident key, so they cannot drift from the origin-cave versions.
//       STRANDS RIDE THE ROW whether green or red: a stranded leg means the capsule wedged and
//       the tour kept measuring from the wrong place.
for (const seed of DET_SEEDS) {
  leg({
    name: `cave-streamed-${seed}`, group: 'cave-streamed', scenario: 'cave-streamed', seed, timeout: 1500000, est: 9,
    re: /CAVE-STREAMED pass=(\d) seed=(\S+) sites=(\d+) marched=(\d+) voided=(\d+) marchOk=(\d+)\/(\d+) ascentOut=(\d+)\/(\d+) minChambers=(\d+) strands=(\d+) voidPoints=(\d+) voidRays=(\d+) escapes=(\d+) excused=(\d+) culled=(\d+) holes=(\d+) fails=(\d+)/,
    row(m) {
      // The vacuous-pass guard, harness side: a green row off zero marched / zero void-sampled
      // caves would launder "the streamer never delivered" as "the streamed caves are fine".
      const marched = Number(m[4]), voided = Number(m[5]), vrays = Number(m[13]);
      if (!(marched >= 1) || !(voided >= 2) || !(vrays >= 3840)) {
        return { ok: false, rows: [`cave-streamed seed ${seed}: VACUOUS — marched=${m[4]} voided=${m[5]} voidRays=${m[13]} (expected ≥1 / ≥2 / ≥3840)  *** FAIL ***`] };
      }
      const ok = m[1] === '1';
      return { ok, rows: [`cave-streamed seed ${seed}: ${m[3]} streamed sites — ${m[6]}/${m[7]} marched clean, ascent OUT ${m[8]}/${m[9]}, ≥${m[10]} chambers each, strands ${m[11]}${m[11] === '0' ? '' : ' ⚠ WEDGE TRAP'}, void ${m[12]} pts / ${m[13]} rays → ${m[14]} escapes (excused ${m[15]}, culled ${m[16]}, holes ${m[17]}), ${m[18]} fails  ${ok ? 'OK' : '*** FAIL ***'}`] };
    },
    noLineRow: `cave-streamed seed ${seed}: NO PROBE LINE (boot failed after retry)  *** FAIL ***`,
  });
}

// ── 13. DEEPER cycle 9 — CAVE KINDS. ONE seed, all four kinds forced onto real descriptor-
//       accepted sites through the shipped `requestSite` path, each given the SAME cave-walk
//       march and cave-void sweep, plus the kind-defining and cross-kind distinctness assertions
//       (a table that collapsed to canonical marches perfectly — so "green" has to mean more).
//       The wider each-kind × 3-seed net is one flag away:
//           npm run rig -- --scenario=cave-kinds --seed=7 --port=5299
//
//       SOLO — MEASURED, NOT ASSUMED (2026-07-27). This leg carries no millisecond tripwire, so
//       the first parallel build ran it concurrently. It then reported 23 fails where the serial
//       runner reports 13: flooded's 13 (the known entrance-headroom defect) PLUS 10 from `shaft`,
//       whose march went reached=0/8 ascent=FAIL under load and reached=8/8 alone — same site,
//       same seed, same digest, byte-identical geometry stats (slope 23.3° / head 2.72 /
//       chamHead 3.26 / cover 12.48 in both). The mechanism is that a KCC march is dt-coupled:
//       fewer frames per second ⇒ a larger per-step translation ⇒ different collision resolution,
//       which only bites where the geometry is already marginal — and the shaft/1337 apron is the
//       cycle-9 known-marginal one. A gate that reds on contention is the same class of error as
//       one that greens on breakage (the open-end/leviathan-front-door precedent), so this leg
//       joins the quiet phase. It costs ~12 min of wall clock and the suite still lands inside the
//       35-min budget. The other march legs (cave-walk ×4, cave-streamed ×2, skyfall, leviathan,
//       ribcage) were all clean under 4-way concurrency and stay parallel — but they are dt-coupled
//       too, so a future march over marginal geometry belongs HERE, not there.
leg({
  name: 'cave-kinds', group: 'cave-kinds', scenario: 'cave-kinds', seed: 1337, timeout: 2100000, solo: true, est: 25,
  re: /CAVE-KINDS pass=(\d) seed=(\S+) kinds=(\d+) built=(\d+) marched=(\d+) voided=(\d+) sites=(\d+) strands=(\d+) escapes=(\d+) fails=(\d+)/,
  row(m) {
    // Vacuous-pass guard, harness side: a green row off zero built / zero marched kinds would
    // launder "the kind table never produced a cave" as "every kind is fine".
    const kinds = Number(m[3]), built = Number(m[4]), marched = Number(m[5]), voided = Number(m[6]), sites = Number(m[7]);
    if (!(kinds >= 4) || built !== kinds || marched !== kinds || voided !== kinds || !(sites >= 120)) {
      return { ok: false, rows: [`cave-kinds: VACUOUS — kinds=${m[3]} built=${m[4]} marched=${m[5]} voided=${m[6]} sites=${m[7]} (expected ≥4 / all built / all marched / all voided / ≥120 sites)  *** FAIL ***`] };
    }
    const ok = m[1] === '1';
    return { ok, rows: [`cave-kinds seed 1337: ${m[3]} kinds built + marched + void-swept, mix audited over ${m[7]} sites, strands ${m[8]}${m[8] === '0' ? '' : ' ⚠ WEDGE TRAP'}, void escapes ${m[9]}, ${m[10]} fails  ${ok ? 'OK' : '*** FAIL ***'}`] };
  },
  noLineRow: 'cave-kinds: NO PROBE LINE (boot failed after retry)  *** FAIL ***',
});

// ── 14. THE SEE-THROUGH GATE (DEEPER cycle 1) — folded in from verify-cave-void.mjs, which used
//       to run as `&& node scripts/verify-cave-void.mjs` after this suite. That chain SKIPPED the
//       void gate entirely whenever anything above it went red — the one time you most need to
//       know whether the cave shell is watertight. It is a leg now, so it always runs and always
//       reports.
//
//       96 rays from ~100 sample points across every chamber and corridor, at eye height, against
//       the real cave mesh set; Raycaster honours material.side, so a BackSide shell registers
//       back-face hits — renderer-faithful. A ray that hits nothing is an ESCAPE: the player,
//       standing there, looking that way, sees the void. Rays through the DECLARED entrance
//       (`userData.intendedOpening`) are excused. PASS = ZERO unexcused escapes.
//       Wide-net runs stay on the standalone: npm run verify:cave:void -- --seeds=1337,7,42,99,…
//       The puncture proof (`--puncture=25`) is documented there too.
for (const seed of DET_SEEDS) {
  leg({
    name: `cave-void-${seed}`, group: 'cave-void', scenario: 'cave-void', seed, timeout: 600000, est: 3,
    re: /^CAVE-VOID .*$/m,
    row(m, out) {
      const f = Object.fromEntries(m[0].trim().split(/\s+/).slice(1).map((kv) => kv.split('=')));
      // VACUOUS-PASS GUARD (harness side, mirroring the in-page one): a pass reported off a tiny
      // or empty sample set would launder a see-through cave as verified. ≥8 chambers ⇒ ≥40
      // chamber points ⇒ ≥3840 rays.
      const points = Number(f.points), rays = Number(f.totalRays ?? f.rays);
      if (!(points >= 40) || !(rays >= 3840)) {
        return { ok: false, rows: [`cave-void seed ${seed}: VACUOUS SWEEP — points=${f.points} rays=${rays} (expected ≥40 / ≥3840)  *** FAIL ***`] };
      }
      const ok = f.pass === '1';
      // Echo the worst offenders so a failure names the rooms, not just a number.
      const worst = out.split('\n').filter((l) => l.startsWith('[cave-void] ') && l.includes('esc=')).slice(0, 8);
      return {
        ok,
        rows: [`cave-void seed ${seed}: escapes ${f.escapes}/${f.totalRays ?? f.rays} (${f.rate}) across ${f.leakyPoints} leaky sample points`
          + `, culled=${f.culled} holes=${f.holes} excused=${f.excused}, chamber=${f.chamberEsc} corridor=${f.corridorEsc}`
          + `  ${ok ? 'OK' : '*** FAIL ***'}`
          + (worst.length ? '\n' + worst.map((l) => `    ${l.replace('[cave-void] ', '')}`).join('\n') : '')],
      };
    },
    noLineRow: `cave-void seed ${seed}: NO PROBE LINE (boot failed after retry)  *** FAIL ***`,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// AGGREGATES — checks that need more than one leg. Each declares the legs it
// needs; with a partial `--legs=` selection it degrades to an explicit SKIPPED
// note rather than a silent pass. `after` fixes where the row prints, so the row
// order is identical to the serial runner's regardless of completion order.
const AGGREGATES = [
  {
    id: 'cross-seed', after: `determinism-${DET_SEEDS[1]}`, needs: DET_SEEDS.map((s) => `determinism-${s}`),
    run(R) {
      const d = DET_SEEDS.map((s) => R[`determinism-${s}`]?.data?.digest).filter(Boolean);
      if (d.length !== 2) return { ok: true, rows: [`cross-seed: SKIPPED — needs both determinism legs (have ${d.length}/2)`] };
      const differ = d[0] !== d[1];
      return { ok: differ, rows: [differ
        ? `cross-seed: digests differ (${d[0]} vs ${d[1]})  OK`
        : `cross-seed: seeds ${DET_SEEDS.join('/')} produced the SAME digest — worldSeed does not feed chunk content  *** FAIL ***`] };
    },
  },
  // The cave-walk row needs BOTH halves (the ×2 digest-stability proof), but it must still
  // report when only one half is selected — a leg whose row silently vanishes under a narrow
  // filter is the exact failure this rewrite exists to end. Hence `needsAny`.
  ...DET_SEEDS.map((seed) => ({
    id: `cave-walk-${seed}`, after: `cave-walk-${seed}b`, needsAny: [`cave-walk-${seed}a`, `cave-walk-${seed}b`],
    run(R) {
      const halves = [R[`cave-walk-${seed}a`], R[`cave-walk-${seed}b`]].filter(Boolean);
      const good = halves.filter((h) => h.data);
      if (!good.length) return { ok: false, rows: [`cave-walk seed ${seed}: NO PROBE LINE (boot failed after retry)  *** FAIL ***`] };
      if (good.length === 1) {
        // A partial `--legs=` selection: report honestly that ×2 stability was NOT checked.
        const a = good[0];
        const ok = a.data.pass;
        return { ok, rows: [`cave-walk seed ${seed}: reached ${a.data.reached}/${a.data.total} chambers, digest ${a.data.digest} (STABILITY ×2 NOT CHECKED — only 1 of 2 runs selected), pass=${ok ? 1 : 0}  ${ok ? 'OK' : '*** FAIL ***'}`] };
      }
      const [a, b] = good;
      const stable = a.data.digest === b.data.digest;
      const ok = a.data.pass && b.data.pass && stable;
      return { ok, rows: [`cave-walk seed ${seed}: reached ${a.data.reached}/${a.data.total} chambers, digest ${a.data.digest}${stable ? ' (stable ×2)' : ` vs ${b.data.digest} *** DIGEST DRIFT ***`}, pass=${a.data.pass ? 1 : 0}/${b.data.pass ? 1 : 0}  ${ok ? 'OK' : '*** FAIL ***'}`] };
    },
  })),
  {
    // Cross-seed teeth: two different worlds must not produce the same cave (a placement that
    // ignored the seed would still pass every per-seed assertion).
    id: 'pool-fill-cross', after: `pool-fill-${DET_SEEDS[1]}`, needs: DET_SEEDS.map((s) => `pool-fill-${s}`),
    run(R) {
      const d = DET_SEEDS.map((s) => R[`pool-fill-${s}`]?.data?.digest).filter(Boolean);
      if (d.length !== 2) return { ok: true, rows: [`pool-fill cross-seed: SKIPPED — needs both pool-fill legs (have ${d.length}/2)`] };
      const differ = d[0] !== d[1];
      return { ok: differ, rows: [`pool-fill cross-seed: cave digests ${differ ? `differ (${d[0]} vs ${d[1]})  OK` : `IDENTICAL (${d[0]}) — the seed does not reach the cave  *** FAIL ***`}`] };
    },
  },
  {
    id: 'cave-density-cross', after: `cave-density-${DET_SEEDS[1]}`, needs: DET_SEEDS.map((s) => `cave-density-${s}`),
    run(R) {
      const d = DET_SEEDS.map((s) => R[`cave-density-${s}`]?.data?.digest).filter(Boolean);
      if (d.length !== 2) return { ok: true, rows: [`cave-density cross-seed: SKIPPED — needs both cave-density legs (have ${d.length}/2)`] };
      const differ = d[0] !== d[1];
      return { ok: differ, rows: [`cave-density cross-seed: site lists ${differ ? `differ (${d[0]} vs ${d[1]})  OK` : `IDENTICAL (${d[0]}) — the seed does not reach cave placement  *** FAIL ***`}`] };
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// CLI
function usage() {
  const w = Math.max(...LEGS.map((l) => l.name.length));
  console.log(`
verify:chunks — the infinite-world / underworld gate runner

  npm run verify:chunks                      run the FULL suite (the gate of record)
  npm run verify:chunks -- --legs=a,b,c      run only these legs (name OR group)
  npm run verify:chunks -- --serial          one leg at a time, declared order (debugging)
  npm run verify:chunks -- --list            print this inventory and exit
  npm run verify:chunks -- --jobs=N          parallel-phase concurrency (default ${JOBS})
  npm run verify:chunks -- --settle=S        quiet-phase settle delay, seconds (default ${SETTLE_S})
  npm run verify:chunks -- --timeout-scale=X give-up deadline multiplier in parallel (default ${TIMEOUT_SCALE})
  npm run verify:chunks -- --solo-first      run the timing legs BEFORE the parallel phase

LEGS  (phase: [par] concurrent · [SOLO] alone on a quiet machine — its assertions read a clock)

${LEGS.map((l) => `  ${l.solo ? '[SOLO]' : '[par] '} ${l.name.padEnd(w)}  group=${l.group}${l.aliases ? ` alias=${l.aliases.join(',')}` : ''}  scenario=${l.scenario} seed=${l.seed}${l.args.length ? ` ${l.args.join(' ')}` : ''}  port=${l.port}`).join('\n')}

GROUPS  ${[...new Set(LEGS.map((l) => l.group))].join(' · ')}
Logs    verification/gate-logs/<UTC>-<leg>.txt  (full stdout+stderr of every leg, always)
`);
}

if (argv.help || argv.h || argv.list) { usage(); process.exit(0); }

// Leg selection. An unknown filter token is a HARD ERROR: the whole point of the
// tee-to-file + explicit-inventory work is that a result is never lost to an
// over-narrow filter, and a silently-empty run is the worst version of that.
let selected = LEGS;
if (argv.legs && argv.legs !== true) {
  const want = String(argv.legs).split(',').map((s) => s.trim()).filter(Boolean);
  const known = new Set();
  for (const l of LEGS) { known.add(l.name); known.add(l.group); for (const a of l.aliases || []) known.add(a); }
  const bad = want.filter((w) => !known.has(w));
  if (bad.length) {
    console.error(`verify:chunks: unknown leg name(s): ${bad.join(', ')}`);
    console.error(`valid names: ${LEGS.map((l) => l.name).join(', ')}`);
    console.error(`valid groups: ${[...new Set(LEGS.map((l) => l.group))].join(', ')}`);
    process.exit(2);
  }
  selected = LEGS.filter((l) => want.includes(l.name) || want.includes(l.group) || (l.aliases || []).some((a) => want.includes(a)));
}
const selectedNames = new Set(selected.map((l) => l.name));
/** An aggregate reports when ALL of `needs` are selected, or ANY of `needsAny` is — the latter
 *  for aggregates that own the only row a group prints, so a narrow filter degrades to an
 *  explicit "not checked" note instead of a vanished result. */
const aggEligible = (agg) => (agg.needsAny
  ? agg.needsAny.some((n) => selectedNames.has(n))
  : agg.needs.every((n) => selectedNames.has(n)));

// ─────────────────────────────────────────────────────────────────────────────
// PROCESS PLUMBING
if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true });

function killTree(child) {
  try {
    if (process.platform === 'win32' && child.pid) spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    else child.kill('SIGKILL');
  } catch { /* ignore */ }
}

/** Spawn one rig-shot process, teeing stdout+stderr to the leg's log file.
 *  Resolves with the captured combined output — the same string the old
 *  spawnSync-based runner parsed, including on a timeout kill (partial output is
 *  still parsed, exactly as spawnSync's timeout path behaved). */
function spawnLeg(legSpec, port, { parallel, logPath, append }) {
  return new Promise((res) => {
    const args = ['scripts/rig-shot.mjs', `--scenario=${legSpec.scenario}`, `--seed=${legSpec.seed}`, `--port=${port}`, ...legSpec.args];
    const env = { ...process.env };
    // Own output directory per leg while concurrent, so two legs of the same
    // scenario at different seeds can never race on verification/scen-*.png.
    if (parallel) env.RIG_OUT_DIR = join('verification', 'gate-shots', legSpec.name);
    const child = spawn(process.execPath, args, { cwd: ROOT, shell: false, env });
    const log = createWriteStream(logPath, { flags: append ? 'a' : 'w' });
    log.write(`=== ${legSpec.name} | node scripts/rig-shot.mjs ${args.slice(1).join(' ')} | started ${new Date().toISOString()} ===\n`);
    let buf = '';
    const take = (d) => { const s = d.toString(); buf += s; log.write(s); };
    child.stdout.on('data', take);
    child.stderr.on('data', take);
    const deadline = Math.round(legSpec.timeout * (parallel ? TIMEOUT_SCALE : 1));
    const timer = setTimeout(() => { buf += `\n[gate-runner] TIMEOUT after ${(deadline / 1000).toFixed(0)}s — killing the process tree\n`; killTree(child); }, deadline);
    child.on('error', (e) => { buf += `\n[gate-runner] spawn error: ${e.message}\n`; });
    child.on('close', (code) => {
      clearTimeout(timer);
      log.end(`\n=== ${legSpec.name} exit=${code} finished ${new Date().toISOString()} ===\n`);
      res(buf);
    });
  });
}

/** Run one leg to a verdict: spawn → parse → (one bounded retry ONLY when NO probe
 *  line printed) → row(s). A run that PRINTED a failing probe line is a real
 *  failure and is never retried. */
async function runLeg(legSpec, parallel) {
  const t0 = Date.now();
  const logPath = join(LOG_DIR, `${RUN_STAMP}-${legSpec.name}.txt`);
  console.log(`  ▶ ${legSpec.name} started (${legSpec.scenario} seed=${legSpec.seed} port=${legSpec.port}${legSpec.solo ? ', SOLO' : ''})`);
  let out = await spawnLeg(legSpec, legSpec.port, { parallel, logPath, append: false });
  let m = out.match(legSpec.re);
  let retried = false;
  if (!m) {
    retried = true;
    console.log(`  … ${legSpec.name}: transient boot failure — retrying (1/1) on port ${legSpec.retryPort}`);
    out = await spawnLeg(legSpec, legSpec.retryPort, { parallel, logPath, append: true });
    m = out.match(legSpec.re);
  }
  const secs = (Date.now() - t0) / 1000;
  let result;
  if (!m) {
    const noLine = Array.isArray(legSpec.noLineRow) ? legSpec.noLineRow : [legSpec.noLineRow];
    result = { ok: false, rows: noLine, data: null, noLine: true };
  } else {
    result = legSpec.row(m, out);
    result.probeLine = m[0];
  }
  result.name = legSpec.name;
  result.secs = secs;
  result.logPath = logPath;
  result.retried = retried;
  result.rawTail = out.split('\n').filter((l) => l.trim()).slice(-25).join('\n');
  // Console gets the summary, the file has everything.
  const verdict = result.ok ? 'PASS' : 'FAIL';
  console.log(`  ${result.ok ? '✔' : '✘'} ${legSpec.name} ${verdict} in ${fmt(secs)}${retried ? ' (after 1 retry)' : ''}  → ${logPath.replace(ROOT + (process.platform === 'win32' ? '\\' : '/'), '')}`);
  if (result.probeLine) console.log(`      ${result.probeLine.trim()}`);
  if (!result.ok) {
    console.log(`      ─ last lines of ${legSpec.name} (full log in the file above) ─`);
    for (const l of result.rawTail.split('\n')) console.log(`      | ${l}`);
  }
  return result;
}

function fmt(s) {
  const t = Math.round(s);                       // round FIRST — flooring then rounding prints "3m60s"
  const m = Math.floor(t / 60), r = t % 60;
  return m ? `${m}m${String(r).padStart(2, '0')}s` : `${r}s`;
}

/** Bounded-concurrency pool, longest-estimate-first so the critical path starts
 *  immediately instead of waiting behind a queue of cheap legs. */
async function runPool(legs, jobs, parallel) {
  const queue = [...legs].sort((a, b) => b.est - a.est);
  const results = {};
  let next = 0;
  const worker = async (slot) => {
    for (;;) {
      const i = next++;
      if (i >= queue.length) return;
      // Stagger process starts a little: a pile of simultaneous cold Vite boots
      // contends on the same node_modules/.vite dep cache for no benefit.
      if (i < jobs) await new Promise((r) => setTimeout(r, slot * 2000));
      const r = await runLeg(queue[i], parallel);
      results[r.name] = r;
    }
  };
  await Promise.all(Array.from({ length: Math.min(jobs, queue.length) }, (_, s) => worker(s)));
  return results;
}

async function runSerial(legs, parallel) {
  const results = {};
  for (const l of legs) { const r = await runLeg(l, parallel); results[r.name] = r; }
  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  const t0 = Date.now();
  const parLegs = selected.filter((l) => !l.solo);
  const soloLegs = selected.filter((l) => l.solo);
  const mode = SERIAL ? 'SERIAL (debug)' : `PARALLEL jobs=${JOBS}`;

  console.log(`\n=== verify:chunks — ${selected.length}/${LEGS.length} legs · ${mode} · run ${RUN_STAMP} ===`);
  console.log(`  parallel phase : ${parLegs.length ? parLegs.map((l) => l.name).join(', ') : '(none)'}`);
  console.log(`  quiet phase    : ${soloLegs.length ? soloLegs.map((l) => l.name).join(', ') : '(none)'}   ← frame-time assertions, one at a time`);
  console.log(`  logs           : verification/gate-logs/${RUN_STAMP}-<leg>.txt\n`);

  let results = {};
  if (SERIAL) {
    results = await runSerial(selected, false);
  } else {
    const phases = argv['solo-first']
      ? [['quiet', soloLegs, 1], ['parallel', parLegs, JOBS]]
      : [['parallel', parLegs, JOBS], ['quiet', soloLegs, 1]];
    for (const [label, legs, jobs] of phases) {
      if (!legs.length) continue;
      if (label === 'quiet' && parLegs.length && !argv['solo-first'] && SETTLE_S > 0) {
        console.log(`\n  — settling ${SETTLE_S}s before the quiet phase (frame-time legs need the machine idle) —\n`);
        await new Promise((r) => setTimeout(r, SETTLE_S * 1000));
      }
      console.log(`\n  ── ${label} phase (${legs.length} leg${legs.length > 1 ? 's' : ''}, concurrency ${jobs}) ──\n`);
      Object.assign(results, jobs > 1 ? await runPool(legs, jobs, true) : await runSerial(legs, false));
    }
  }

  // ── Verdict assembly, in the DECLARED leg order (never completion order) ──
  let allPass = true;
  const rows = [];
  const legTable = [];
  for (const l of selected) {
    const r = results[l.name];
    if (!r) continue;
    if (!r.ok) allPass = false;
    if (!l.quiet || !r.ok) for (const row of r.rows) rows.push(row);
    legTable.push({ name: l.name, ok: r.ok, secs: r.secs, log: r.logPath, retried: r.retried, solo: !!l.solo });
    for (const agg of AGGREGATES) {
      if (agg.after !== l.name || !aggEligible(agg)) continue;
      const a = agg.run(results);
      if (!a.ok) allPass = false;
      for (const row of a.rows) rows.push(row);
    }
  }
  // Aggregates whose `after` leg was not selected still get a chance to report.
  for (const agg of AGGREGATES) {
    if (selectedNames.has(agg.after) || !aggEligible(agg)) continue;
    const a = agg.run(results);
    if (!a.ok) allPass = false;
    for (const row of a.rows) rows.push(row);
  }

  const wall = (Date.now() - t0) / 1000;
  const lines = [];
  lines.push('\n=== verify:chunks (infinite-world determinism + streaming/leak + generation-perf + underworld gate) ===');
  for (const row of rows) lines.push('  ' + row);
  lines.push('\n--- per-leg verdicts ---');
  const w = Math.max(...legTable.map((r) => r.name.length), 4);
  for (const r of legTable) {
    lines.push(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.name.padEnd(w)}  ${fmt(r.secs).padStart(7)}  ${r.solo ? 'quiet ' : 'par   '}${r.retried ? ' retry' : '      '}  ${r.log.replace(ROOT + (process.platform === 'win32' ? '\\' : '/'), '')}`);
  }
  const cpuTime = legTable.reduce((a, c) => a + c.secs, 0);
  lines.push(`\n  wall clock ${fmt(wall)}  ·  summed leg time ${fmt(cpuTime)}  ·  speedup ×${(cpuTime / wall).toFixed(2)}  ·  mode ${mode}`);
  lines.push(allPass
    ? '\nCHUNKS GATE: PASS — deterministic per-chunk content, clean streaming, no body leaks, watertight caves.'
    : '\nCHUNKS GATE: FAIL — the infinite-world machinery regressed (see rows above).');
  const text = lines.join('\n');
  console.log(text);
  const summaryPath = join(LOG_DIR, `${RUN_STAMP}-SUMMARY.txt`);
  writeFileSync(summaryPath, text + '\n');
  console.log(`\n  summary written to ${summaryPath.replace(ROOT + (process.platform === 'win32' ? '\\' : '/'), '')}`);
  process.exit(allPass ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
