// POI density probe (walk-test fix 2026-07-17) — measures POI+wreck AREAL
// DENSITY (destinations / km²) for BOTH content systems in the SAME units so
// the origin (boot-placed) and far field (chunk-streamed) can be equalized.
//
//   node scripts/poi-density-probe.mjs
//
// (a) BOOT / ORIGIN: computed analytically from the samplers' known params
//     (counts + radial band + distribution law). The samplers are pure
//     rejection loops over a radius band — at these densities rejections are
//     rare, so the analytic radial profile is accurate. Reports a per-band
//     areal density so the CENTER-CLUMP (linear-r bias) is visible.
// (b) FAR FIELD: analytic from CHUNK_POI_CHANCE / chunk-area, PLUS a live
//     simulation of the real per-chunk POI roll (chunkSeed + makeRng, the
//     exact draw order from chunkManager.describeChunk) over a 3x3 km area at
//     2 world seeds to VALIDATE the analytic number.
//
// Prints BEFORE (shipped constants) and AFTER (this fix) for both systems +
// the seam-band counts around the origin-exclusion boundary.

// ── exact replicas of src/core/rng.ts + src/world/chunkManager.ts ──
function makeRng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0x100000000; };
}
function chunkSeed(worldSeed, cx, cz) {
  let h = worldSeed >>> 0;
  h = Math.imul(h ^ (cx | 0), 0x85ebca6b) >>> 0;
  h = ((h << 13) | (h >>> 19)) >>> 0;
  h = Math.imul(h ^ (cz | 0), 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x45d9f3b) >>> 0;
  h ^= h >>> 15;
  return h >>> 0;
}

const SIZE = 112; // Tuning.CHUNK_SIZE

// ── config: BEFORE = shipped; AFTER = this fix ──
const BEFORE = {
  label: 'BEFORE (shipped)',
  flagship: { n: 6, rMin: 200, rMax: 800, law: 'linear' },
  procgen:  { n: 22, rMin: 120, rMax: 1100, law: 'linear' },
  cluster:  { n: 3, rMin: 250, rMax: 800, law: 'linear' }, // each = 1 themed destination
  chunkPoiChance: 0.048,
  exclusionM: 1600,
};
const AFTER = {
  label: 'AFTER (fix)',
  // flagships + clusters UNCHANGED — they are the curated near-spawn HERO layer
  // (6 flagships + 3 narrative clusters), the origin analog of the far field's
  // sparse region-landmarks/wreck-yards. AAK tightened flagships to 800m after a
  // playtest found them landing >1km felt too far — do NOT respread them.
  flagship: { n: 6, rMin: 200, rMax: 800, law: 'area' },
  cluster:  { n: 3, rMin: 250, rMax: 800, law: 'area' },
  // The AMBIENT POI layer — the direct analog of the streamed chunk POI. Flatten
  // (linear→area, kills the 1/r center spike) + modest count trim + fill to the
  // new exclusion seam so it matches the far-field chunk density.
  procgen:  { n: 18, rMin: 120, rMax: 1150, law: 'area' },
  chunkPoiChance: 0.055,
  exclusionM: 1150,
};

// Expected count of a layer within radial band [a,b], given its [rMin,rMax] +
// distribution law. linear = uniform in r; area = uniform in area (r=sqrt).
function bandCount(layer, a, b) {
  const lo = Math.max(a, layer.rMin), hi = Math.min(b, layer.rMax);
  if (hi <= lo) return 0;
  if (layer.law === 'linear') {
    return layer.n * (hi - lo) / (layer.rMax - layer.rMin);
  } else { // area-uniform: fraction ∝ (r² span)
    return layer.n * (hi * hi - lo * lo) / (layer.rMax * layer.rMax - layer.rMin * layer.rMin);
  }
}
const km2 = (a, b) => Math.PI * (b * b - a * a) / 1e6; // ring area in km²

const BANDS = [
  [0, 200], [200, 400], [400, 600], [600, 800],
  [800, 1100], [1100, 1200], [1200, 1400], [1400, 1600], [1600, 1900], [1900, 2400],
];

function bootProfile(cfg) {
  // returns per-band { flag, proc, clus, total, area, density }
  return BANDS.map(([a, b]) => {
    const flag = bandCount(cfg.flagship, a, b);
    const proc = bandCount(cfg.procgen, a, b);
    const clus = bandCount(cfg.cluster, a, b);
    const total = flag + proc + clus;
    const area = km2(a, b);
    return { a, b, flag, proc, clus, total, density: total / area };
  });
}

// Boot system density averaged over its content disc (out to max content R).
function bootAvgDensity(cfg) {
  const R = Math.max(cfg.flagship.rMax, cfg.procgen.rMax, cfg.cluster.rMax);
  const n = cfg.flagship.n + cfg.procgen.n + cfg.cluster.n;
  // ambient = the procgen layer alone, over ITS disc — the direct analog of the
  // streamed chunk-POI layer (this is the number that must match the far field).
  const ambient = cfg.procgen.n / km2(0, cfg.procgen.rMax);
  return { R, all: n / km2(0, R), ambient };
}

const farAnalytic = (cfg) => cfg.chunkPoiChance / (SIZE * SIZE / 1e6); // per km²

// Live simulation of the real chunk POI roll over a square area, at one world
// seed. Mirrors chunkManager.describeChunk exactly: poiRand = makeRng(seed ^
// 0x9e3779b9); roll = poiRand(); px/pz consume 2 more draws; present = center
// outside exclusion && roll < chance. (wreck_yard 6x multiplier ignored — a
// rare far biome; documented.)
function simFarField(cfg, worldSeed, halfChunks) {
  let present = 0, chunks = 0, farChunks = 0;
  for (let cx = -halfChunks; cx <= halfChunks; cx++) {
    for (let cz = -halfChunks; cz <= halfChunks; cz++) {
      const centerX = (cx + 0.5) * SIZE, centerZ = (cz + 0.5) * SIZE;
      const seed = chunkSeed(worldSeed, cx, cz);
      const poiRand = makeRng((seed ^ 0x9e3779b9) >>> 0);
      const roll = poiRand();
      const outside = centerX * centerX + centerZ * centerZ > cfg.exclusionM * cfg.exclusionM;
      if (outside) farChunks++;             // only non-excluded chunks are eligible
      if (outside && roll < cfg.chunkPoiChance) present++;
      chunks++;
    }
  }
  const cellKm2 = SIZE * SIZE / 1e6;
  return { present, chunks, farChunks, density: present / (farChunks * cellKm2) };
}

// Count streamed POIs that land in a world-space radial band, for the seam check.
function simFarFieldBand(cfg, worldSeed, aM, bM, halfChunks) {
  let present = 0;
  for (let cx = -halfChunks; cx <= halfChunks; cx++) {
    for (let cz = -halfChunks; cz <= halfChunks; cz++) {
      const centerX = (cx + 0.5) * SIZE, centerZ = (cz + 0.5) * SIZE;
      const seed = chunkSeed(worldSeed, cx, cz);
      const poiRand = makeRng((seed ^ 0x9e3779b9) >>> 0);
      const roll = poiRand();
      const px = (cx + 0.5) * SIZE + (poiRand() - 0.5) * (SIZE - 2 * 25);
      const pz = (cz + 0.5) * SIZE + (poiRand() - 0.5) * (SIZE - 2 * 25);
      const outside = centerX * centerX + centerZ * centerZ > cfg.exclusionM * cfg.exclusionM;
      if (!(outside && roll < cfg.chunkPoiChance)) continue;
      const d = Math.hypot(px, pz);
      if (d >= aM && d < bM) present++;
    }
  }
  return present;
}

function fmt(n, w = 6) { return n.toFixed(2).padStart(w); }

function report(cfg) {
  console.log(`\n========== ${cfg.label} ==========`);
  const prof = bootProfile(cfg);
  console.log('  ORIGIN (boot) radial profile — destinations/km² per band:');
  console.log('   band(m)      flag   proc   clus  total   area(km²)  density/km²');
  for (const p of prof) {
    console.log(
      `   ${String(p.a).padStart(4)}-${String(p.b).padEnd(4)}  ${fmt(p.flag)} ${fmt(p.proc)} ${fmt(p.clus)} ${fmt(p.total)}   ${fmt(km2(p.a, p.b), 8)}   ${fmt(p.density)}`,
    );
  }
  const avg = bootAvgDensity(cfg);
  console.log(`  ORIGIN avg over content disc (R=${avg.R}m): all-layers ${avg.all.toFixed(2)}/km²  |  AMBIENT procgen layer ${avg.ambient.toFixed(2)}/km²`);

  const far = farAnalytic(cfg);
  console.log(`  FAR FIELD analytic: CHUNK_POI_CHANCE ${cfg.chunkPoiChance} / (112m)² = ${far.toFixed(2)}/km²  (exclusion ${cfg.exclusionM}m)`);
  const HC = Math.ceil(1500 / SIZE); // ~3x3 km
  for (const seed of [1, 1337]) {
    const s = simFarField(cfg, seed, HC);
    console.log(`  FAR FIELD sim seed=${seed}: ${s.present} POIs over ${s.farChunks} non-excluded chunks (of ${s.chunks}) = ${s.density.toFixed(2)}/km²  (validates analytic ${far.toFixed(2)})`);
  }
  return { avg, far };
}

const b = report(BEFORE);
const a = report(AFTER);

// ── seam check: 3 radial bands straddling the AFTER exclusion boundary ──
console.log('\n========== SEAM CHECK (AFTER) — POIs by radial band across the exclusion boundary ==========');
console.log(`  origin content ends ~${Math.max(AFTER.procgen.rMax, AFTER.flagship.rMax)}m; streamed exclusion = ${AFTER.exclusionM}m`);
const seamBands = [[900, 1150], [1150, 1400], [1400, 1650]];
const HC = Math.ceil(1600 / SIZE);
for (const [aM, bM] of seamBands) {
  // boot destinations expected in band
  const boot = bandCount(AFTER.flagship, aM, bM) + bandCount(AFTER.procgen, aM, bM) + bandCount(AFTER.cluster, aM, bM);
  // streamed destinations counted in band (avg over 2 seeds)
  const s1 = simFarFieldBand(AFTER, 1, aM, bM, HC);
  const s2 = simFarFieldBand(AFTER, 1337, aM, bM, HC);
  const streamed = (s1 + s2) / 2;
  const area = km2(aM, bM);
  const total = boot + streamed;
  console.log(`   ${aM}-${bM}m:  boot ${boot.toFixed(2)} + streamed ${streamed.toFixed(2)} = ${total.toFixed(2)}  over ${area.toFixed(2)}km²  = ${(total / area).toFixed(2)}/km²`);
}

// ── verdict: are the two SYSTEM densities within 15%? ──
console.log('\n========== VERDICT ==========');
function pct(x, y) { return Math.abs(x - y) / ((x + y) / 2) * 100; }
console.log('  PRIMARY GATE — the AMBIENT POI layer (origin procgen ↔ far-field chunk POI), same units:');
console.log(`   BEFORE: origin-ambient ${b.avg.ambient.toFixed(2)} vs far ${b.far.toFixed(2)} /km²  → ${pct(b.avg.ambient, b.far).toFixed(0)}% apart`);
console.log(`   AFTER : origin-ambient ${a.avg.ambient.toFixed(2)} vs far ${a.far.toFixed(2)} /km²  → ${pct(a.avg.ambient, a.far).toFixed(0)}% apart  ${pct(a.avg.ambient, a.far) <= 15 ? '✓ within 15%' : '✗ over 15%'}`);
console.log('  CONTEXT — origin-all (ambient + the 6 flagship + 3 cluster HERO layer, curated near-spawn home base):');
console.log(`   BEFORE origin-all ${b.avg.all.toFixed(2)} (peak band ${Math.max(...bootProfile(BEFORE).map((p) => p.density)).toFixed(1)}/km²)  →  AFTER origin-all ${a.avg.all.toFixed(2)} (peak band ${Math.max(...bootProfile(AFTER).map((p) => p.density)).toFixed(1)}/km²)`);
console.log('   (origin-all sits above far-ambient by design: the home base is hero-rich, mirroring the far field\'s sparse region-landmarks/wreck-yards.)');
