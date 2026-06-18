export const meta = {
  name: 'overhaul-critique',
  description: 'Comprehensive adversarial critique over the WHOLE procedural-wreck overhaul (materials + silhouette + scale + crash + fleet variety + code)',
  phases: [
    { title: 'Critique', detail: '6 critics on distinct harsh lenses read the fleet renders + source' },
    { title: 'Synthesize', detail: 'merge, dedup, severity-rank; honest verdict on whether the overhaul lands' },
  ],
}

const V = 'C:/Users/Zach/projects/dustfall/verification/'
// Curated fleet set spanning every tier of the overhaul.
const IMAGES = {
  fleet: V + 'scen-wreckyard-aerial.png',
  megaBurial: V + 'scen-procgen-mega_freighter-side-s1337.png',
  scoutBurial: V + 'scen-procgen-scout-side-s1337.png',
  gunshipCrash: V + 'scen-procgen-gunship-side-s1337.png',
  materialCloseup: V + 'scen-procgen-gunship-3q-s42.png',
  anchorCloseup: V + 'scen-procgen-science_vessel-3q-s42.png',
  corvettePalette: V + 'scen-procgen-corvette-side-s2024.png',
  freighterSilhouette: V + 'scen-procgen-freighter-side-s7.png',
  shearedVariant: V + 'scen-procgen-corvette-side-s7-v6.png',
  cargoVariant: V + 'scen-procgen-science_vessel-side-s1337-v7.png',
}
const ALL = Object.values(IMAGES)
const SRC = 'C:/Users/Zach/projects/dustfall/src/world/procgenWreck.ts'
const MAT = 'C:/Users/Zach/projects/dustfall/src/world/hullMaterial.ts'

const GOAL = `
THE OVERHAUL — the ACAX salvage-panel work made the welded access-PANELS photoreal, which
left the WRECKS they bolt onto looking flat + out-classed: one brown material family across
the whole fleet, oxidation only on side-faces, limited silhouette/size variety. This
session is a full reference-grounded overhaul of the procedural wrecks. Tone: Long Dark /
Mad Max / Dune. Flat-shaded low-poly, NO texture files (all procedural). Tiers shipped:
- T1 hull MATERIAL: a 12-channel procedural weathering shader (dust-crust on decks, paint-
  chalk haze, rust streaks gravity-flowing down seams, saturated underside/belly oxide,
  cool scoured lower hull) + per-CLASS palette identity (corvette cool-grey, gunship
  gunmetal, science pale, freighter warm tan, bulk industrial, pod off-white, mega dark).
- T2A scale-anchor HATCH+LADDER: a human-scale access door (flange+slab+handwheel+hinges+
  straps) + climbing ladder on a solid hull's clean flank — a constant human reference so
  the eye reads true SIZE (1 per wreck, 1-3 on mega/bulk).
- T2B new hull VARIANTS: SHEARED_HULL (a blasted-open section — charred breach patch +
  exposed bent ribs + torn flaps) + CARGO_POD_ROW (a freight spine of container pods, some
  torn off). Now 8 hull-segment variants total.
- T2C size CLASSES: scout (~4-5m sleek dart) ↔ mega_freighter (~33m). 8 classes.
- T2D CRASH realism: class-scaled half-burial (scout sits upright on the surface, mega beds
  DEEP into the dune) + a class crash-list (roll) + engine shear (drooped torn nozzles).

THE TEST: does the fleet now read VARIED, correctly SCALED, CRASH-believable, and richly
WEATHERED — no longer out-classed by the photoreal panels? Judge against that bar.

NOTES: renders use a studio key+fill light; the warm/orange cast is desert atmosphere — judge
FORM/READ, not tint. Some shots are forced-variant or close inspection framings. Perf budget:
drawCalls <1000 (currently 978 — near the ceiling), shader programs ≤72 (currently 69).
`.trim()

const SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['verdict', 'findings'],
  properties: {
    verdict: { type: 'string', description: 'one-line verdict for THIS lens: does the overhaul land here?' },
    findings: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['title', 'severity', 'evidence', 'fix'],
        properties: {
          title: { type: 'string' },
          severity: { type: 'integer', minimum: 1, maximum: 5, description: '5=ship-blocker, 1=nit' },
          evidence: { type: 'string', description: 'the SPECIFIC image (by name) or source line that shows this' },
          fix: { type: 'string', description: 'a concrete code-level change (params/numbers/approach)' },
        },
      },
    },
  },
}

const imgList = Object.entries(IMAGES).map(([k, p]) => `  ${k}: ${p}`).join('\n')

const LENSES = [
  { key: 'surface-realism', brief: `SURFACE / MATERIAL realism. Read the weathering across the fleet (materialCloseup, gunshipCrash, anchorCloseup, the palette/silhouette shots): do dust-crust decks + paint-chalk + gravity rust-streaks + saturated underside oxide + scoured lower hull all READ, or does it collapse to flat brown? Are the per-CLASS palettes actually distinct at a glance (corvette vs gunship vs science vs freighter vs bulk vs mega)? Does the hull still look out-classed next to the photoreal panel, or has it caught up? Any banding/stark transitions/plasticky highlights?` },
  { key: 'silhouette-scale', brief: `SILHOUETTE & SCALE diversity. Across scoutBurial / corvettePalette / freighterSilhouette / megaBurial: does the fleet read as genuinely DIFFERENT ship shapes AND a believable size LADDER (4m scout ↔ 33m mega)? Do the scale anchors (anchorCloseup) + burial depth actually sell true size, or do hulls read ambiguously? Is scout clearly the opposite of mega (pointed-narrow vs long/blocky)?` },
  { key: 'crash-believability', brief: `CRASH believability. Across megaBurial / scoutBurial / gunshipCrash / shearedVariant: does the field read as "violently crashed, half-swallowed by the desert long ago" or as "parked models on flat sand"? Judge burial depth by class, the crash-list roll, the engine shear (drooped nozzles), and the SHEARED blasted-open damage. Is anything overdone (buried to invisibility) or underdone (suspiciously intact)?` },
  { key: 'fleet-variety', brief: `FLEET VARIETY. Focus on the wreck-yard 'fleet' aerial + cargoVariant + shearedVariant: standing in a field of these, does it feel like a GRAVEYARD OF DIFFERENT SHIPS (varied classes, hull variants, damage, sizes, palettes) or repetitive/samey? What's the single biggest variety weakness — a silhouette that repeats, a missing damage state, a too-uniform spacing/orientation?` },
]

phase('Critique')
const critiques = await parallel([
  ...LENSES.map((L) => () =>
    agent(
      `You are a HARSH, adversarial art director for a procedural desert-wreck survival game.
There is ALWAYS something to improve — find the real flaws; do not be reassuring.

${GOAL}

YOUR LENS — ${L.brief}

Read these render PNGs (use Read on each absolute path; the key names tell you what each is):
${imgList}

You may also read the source for context: ${SRC} (procgen assembly/variants/burial) and
${MAT} (the weathering shader). Return findings strictly in your lens. Severity 5 =
ship-blocker, 1 = nit. Each finding needs concrete image/code EVIDENCE (name the image) and
a concrete numeric/param FIX. Lead your verdict with whether the overhaul LANDS in your lens.`,
      { label: `critic:${L.key}`, phase: 'Critique', schema: SCHEMA },
    )
  ),
  () => agent(
    `You are a meticulous Three.js / TypeScript performance + correctness auditor for the
procedural-wreck system.

${GOAL}

Read: ${SRC} (focus: the 8 HULL_SEGMENT_VARIANTS incl. SHEARED_HULL + CARGO_POD_ROW; the
class tables CLASS_BURY/CLASS_LIST/CLASS_HULL_BASE; placeProcgenComposite burial+list; the
assembleWreck engine-shear + scale-anchor placement; addScaleAnchor; hash2) and ${MAT}.

Audit MECHANICAL issues only (not aesthetics):
- PERF: the normal field is drawCalls 978 vs a <1000 budget; the DENSE wreck-yard POI
  (114 objects, all in-frustum from the aerial) is drawCalls 1499 — OVER budget. Diagnose
  the root cause: the T1B per-CLASS palette gives each of 8 classes its own hull/dark/rust
  material set, so mergeStaticByMaterial can only fold by material — 8 classes × 3 mats =
  ~24 merged meshes per cluster instead of 3 (pre-1B). The new SHEARED/CARGO_POD decoration
  meshes (flaps/ribs/clamps/pods) + engine-shear rotated bells add more. Propose the cheapest
  fix that KEEPS per-class colour identity: e.g. quantize class palettes to fewer shared
  material buckets, OR a cluster-level palette cap, OR fold dark/rust into vertex-tint of the
  hull mat. Quantify the win. Is 1499 a real gameplay risk (the yard is one POI; frustum +
  distance culling apply) or only a worst-case aerial?
- DETERMINISM (D208): verify the new code is rand-neutral where claimed — burial/list use
  CLASS_* tables + hash2(pos) (no rand?), engine-shear uses hash2(cursor) (no rand?), the
  per-wreck anchor pick is deterministic. Flag any rand() that would shift the panel stream.
- RULE 7: any BoxGeometry hull decoration <0.10m deep in the new variants?
- FLOATERS/CLIP: does the class-LIST roll or engine-shear droop push geometry through the
  terrain, or detach the tail badly? Does deep mega burial sink ALL panels (no loot)?
- The SHEARED proud-damage (patch+ribs+flaps) + CARGO_POD (spine+pods+clamps): correct
  shared materials so the merge + per-class re-skin still work?
Report each as a finding with code evidence + concrete fix.`,
    { label: 'critic:code-audit', phase: 'Critique', schema: SCHEMA },
  ),
])

const valid = critiques.filter(Boolean)
log(`collected ${valid.length}/5 critiques; synthesizing`)

phase('Synthesize')
const SYNTH = {
  type: 'object', additionalProperties: false,
  required: ['overallVerdict', 'overhaulLands', 'rankedFixes'],
  properties: {
    overallVerdict: { type: 'string', description: 'honest 3-5 sentence verdict: does the overhaul achieve its goal (fleet varied/scaled/crash-believable/weathered, no longer out-classed by the panels)?' },
    overhaulLands: { type: 'boolean', description: 'true if the overhaul meets its bar modulo polish; false if a ship-blocker remains' },
    shipBlockers: { type: 'array', items: { type: 'string' } },
    rankedFixes: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['rank', 'title', 'severity', 'tier', 'change'],
        properties: {
          rank: { type: 'integer' },
          title: { type: 'string' },
          severity: { type: 'integer', minimum: 1, maximum: 5 },
          tier: { type: 'string', description: 'which tier it touches (T1/T2A/T2B/T2C/T2D/perf)' },
          change: { type: 'string' },
          rationale: { type: 'string' },
        },
      },
    },
  },
}

const synthesis = await agent(
  `You are the lead synthesizing a comprehensive review of a procedural-wreck overhaul. Below
are JSON critiques from 6 adversarial lenses (4 visual + 1 code-audit... and any others).

${valid.map((c, i) => `--- CRITIC ${i + 1} ---\n${JSON.stringify(c, null, 2)}`).join('\n\n')}

Merge + DEDUP overlapping findings (cross-lens agreement RAISES priority). Drop anything
contradicted by another lens or the goal. Produce: an HONEST overallVerdict on whether the
overhaul lands (the wrecks no longer out-classed by the panels; fleet varied/scaled/crash-
believable/weathered), a boolean overhaulLands, any sev-5 shipBlockers, and a severity-ranked
fix list (rank 1 = do first) — each with the concrete change + which tier it touches. Be
decisive and specific; this drives the final convergence round + the session-end honesty note.`,
  { label: 'synthesize', phase: 'Synthesize', schema: SYNTH },
)

return synthesis
