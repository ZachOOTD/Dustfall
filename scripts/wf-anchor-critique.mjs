export const meta = {
  name: 'anchor-critique',
  description: 'Adversarial multi-lens critique of the Tier 2A scale-anchor hatch/ladder on procgen wrecks',
  phases: [
    { title: 'Critique', detail: '5 critics on distinct harsh lenses read the renders + source' },
    { title: 'Synthesize', detail: 'merge, dedup, severity-rank the fixes' },
  ],
}

// ROUND 2 render set — hatch-aimed close-ups (the camera now points straight at the
// door+ladder) + a wide mega for the repeated-anchor scale read. Full-res PNGs.
const IMAGES = [
  'C:/Users/Zach/projects/dustfall/verification/scen-procgen-science_vessel-3q-s42.png',
  'C:/Users/Zach/projects/dustfall/verification/scen-procgen-science_vessel-3q-s1.png',
  'C:/Users/Zach/projects/dustfall/verification/scen-procgen-bulk_hauler-3q-s1337.png',
  'C:/Users/Zach/projects/dustfall/verification/scen-procgen-mega_freighter-3q-s1337.png',
]
const SRC = 'C:/Users/Zach/projects/dustfall/src/world/procgenWreck.ts'

const GOAL = `
TIER 2A GOAL — a human-scale ACCESS HATCH + LADDER added to procgen-wreck solid hull
segments (ribbed-cylinder + plated-rectangular variants) as the "scale-read anchor".
The premise (research-grounded): a man-sized door + climbing ladder are objects whose
real size the eye knows, so repeating a CONSTANT human anchor makes a 5m scout read 5m
and a 33m freighter read 33m (the non-linear-detail rule — repeat a constant anchor,
do NOT just resize one shape). Placed on the CLEAN lee flank (negative-space contrast
to the battle-scarred impact flank). Flat-shaded low-poly aesthetic (Long Dark / Mad
Max / Dune tone). The hatch = a proud dark mounting flange + a rust pressure-door slab
+ an L-brace + a torus lock-wheel + 2 hinges. The ladder = 2 rails + 4-6 rungs.
PROJECT RULE 7: every BoxGeometry decoration on a hull exterior must be >=10cm deep
(15cm for hull-substantial) or it reads paper-thin at oblique angles.
NOTE: the renders use a studio key+fill light and the camera is aimed straight at the
hatch on the camera-facing flank for inspection; in-game it sits on the lee flank. The
warm/orange cast is desert atmosphere — judge FORM and READ, not the tint.

THIS IS ROUND 2. A prior critique already drove these fixes — VERIFY each actually
resolved, and find what's LEFT (don't re-litigate solved items unless still broken):
- ONE anchor per wreck (2 on mega/bulk), not one-per-segment. [was: hatch spam]
- door/ladder seated on the REAL hull surface per variant (no float/bury). [was: flankZ=0.92r]
- lock = a spoked HANDWHEEL+hub on the latch edge; hinges = barrel+rust strap on the
  opposite edge; two horizontal door straps. [was: hubless ring on the hinge edge]
- ladder: 6-8 rungs, wide rails, 6cm rungs, ~0.3m pitch, bound to the door's segment.
Remaining known-deferred: outward antenna/fin spikes on the silhouette + no clean
exclusion pocket around the anchor. Confirm or refine those, and surface anything new.
`.trim()

const CRITIQUE_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['verdict', 'findings'],
  properties: {
    verdict: { type: 'string', description: 'one-line overall verdict for THIS lens' },
    findings: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['title', 'severity', 'evidence', 'fix'],
        properties: {
          title: { type: 'string' },
          severity: { type: 'integer', minimum: 1, maximum: 5, description: '5=ship-blocker, 1=nit' },
          evidence: { type: 'string', description: 'the SPECIFIC thing in the image or source code that shows this' },
          fix: { type: 'string', description: 'a concrete code-level change (numbers/params), not a vibe' },
        },
      },
    },
  },
}

const LENSES = [
  {
    key: 'scale-read',
    brief: `SCALE-READ lens. Does the hatch+ladder ACTUALLY make the wreck read at its real
size? Judge door-to-hull proportion (a 0.9m door should look like a door a person walks
through, ~70% of a small-ship hull height). Does the ladder rung spacing read human
(~0.3m)? On the wide mega_freighter shot, do repeated anchors sell the 33m length, or do
they vanish? Is anything the WRONG size (door too big/small, rungs too dense)?`,
  },
  {
    key: 'surface-integration',
    brief: `SURFACE-INTEGRATION lens. Does the hatch sit FLUSH and integrated on the weathered
hull, or does it float / look pasted-on / hover off the surface? Check the flange-to-hull
seam. Does it cast a believable shadow line (proving real depth, rule 7), or read flat?
Does the rust door-slab material harmonize with the Tier-1 weathered hull, or clash?`,
  },
  {
    key: 'door-believability',
    brief: `DOOR-BELIEVABILITY lens. Does this read as a REAL functional pressure door — flange,
slab, lock-wheel, hinges, brace all legible as door parts — or as an abstract pile of
boxes? Is the lock-wheel recognizable? Are the hinges on the correct (latch-opposite)
edge? Is the ladder clearly a ladder? Is the cluster placement believable (where a crew
would actually put an airlock), or random?`,
  },
  {
    key: 'silhouette-clutter',
    brief: `SILHOUETTE & CLUTTER lens. From the wider shots: does the anchor + the seam-network
greebles ADD readable structure, or muddy the hull into noise? Is there good focal-zone
vs negative-space contrast? Are there too many competing features (antennas, fins, ports,
hatch, ladder) fighting? Does anything poke out awkwardly or break the hull silhouette?`,
  },
]

phase('Critique')
const critiques = await parallel([
  ...LENSES.map((L) => () =>
    agent(
      `You are a HARSH, adversarial art-director critic for a procedural desert-wreck game.
There is ALWAYS something to improve — find the real flaws, do not be reassuring.

${GOAL}

YOUR LENS — ${L.brief}

Read these render PNGs (use the Read tool on each absolute path):
${IMAGES.map((p) => '  ' + p).join('\n')}

Then read the scale-anchor source: ${SRC}
- the function addScaleAnchor (search for "ACAZ T2A — human-scale ACCESS HATCH")
- the seam-network branch inside addHullGreebles (search for "Panel-line seam NETWORK")

Return findings strictly in your lens. Severity 5 = ship-blocker, 1 = nit. Each finding
needs concrete image/code EVIDENCE and a concrete numeric/param FIX. If the work is
genuinely good in some respect, say so in the verdict but still surface the weakest points.`,
      { label: `critic:${L.key}`, phase: 'Critique', schema: CRITIQUE_SCHEMA },
    )
  ),
  // Pure code-auditor — no lens bias, hunts mechanical defects.
  () => agent(
    `You are a meticulous Three.js / TypeScript code auditor for a procedural wreck system.

${GOAL}

Read the source: ${SRC}
- addScaleAnchor (search "ACAZ T2A — human-scale ACCESS HATCH")
- hash2 (search "Deterministic 0..1 hash")
- the seam-network branch in addHullGreebles (search "Panel-line seam NETWORK")
- the two call sites (search "addScaleAnchor(g, len, r")

Audit for MECHANICAL defects ONLY (not aesthetics):
- Rule 7: any BoxGeometry hull decoration with a depth (z-extent) < 0.10m? List each.
- Floaters / gaps: does any piece sit off the hull surface (flangeZ vs hull flank at
  radius*0.92)? Could the door/wheel/ladder hover or clip INTO the hull?
- hash2 quality: with inputs (partLength, radius) both ~1-3.7, does hash2 actually
  decorrelate, or could many segments collapse to near-identical px/py/ladder? Is the
  ladder-present rate really ~55%? Could the wheel/hinge always land identically?
- Determinism (D208): confirm addScaleAnchor consumes ZERO rand() and the seam-network
  consumes exactly ONE (same as the single-seam branch it replaced).
- Merge/material: does it use only the 3 shared materials (_hullMat/_hullDarkMat/_rustMat)
  so the static merge folds it and the per-class re-skin remaps it?
- The __FORCE_ANCHOR_NEAR inspection global — is it truly inert in-game?
- Any z-fighting risk (coincident faces) between flange/door/hull.

Report each as a finding with code evidence + concrete fix.`,
    { label: 'critic:code-audit', phase: 'Critique', schema: CRITIQUE_SCHEMA },
  ),
])

const valid = critiques.filter(Boolean)
log(`collected ${valid.length}/5 critiques; synthesizing`)

phase('Synthesize')
const SYNTH_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['overallVerdict', 'rankedFixes'],
  properties: {
    overallVerdict: { type: 'string' },
    shipBlockers: { type: 'array', items: { type: 'string' }, description: 'severity-5 issues that must be fixed before the tier ships' },
    rankedFixes: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['rank', 'title', 'severity', 'change'],
        properties: {
          rank: { type: 'integer' },
          title: { type: 'string' },
          severity: { type: 'integer', minimum: 1, maximum: 5 },
          change: { type: 'string', description: 'the concrete code change (params/numbers/approach)' },
          rationale: { type: 'string' },
        },
      },
    },
  },
}

const synthesis = await agent(
  `You are the lead synthesizing a procedural-wreck art review. Below are JSON critiques
from 5 adversarial lenses (4 visual + 1 code-audit) of the Tier 2A scale-anchor.

${valid.map((c, i) => `--- CRITIC ${i + 1} ---\n${JSON.stringify(c, null, 2)}`).join('\n\n')}

Merge + DEDUP overlapping findings (multiple critics often flag the same thing — that
RAISES its priority). Drop anything contradicted by another lens or by the stated goal.
Produce a single severity-ranked fix list (rank 1 = do first). For each, give the
CONCRETE code change (specific params/numbers/geometry), not a vibe. List any severity-5
ship-blockers separately. Be decisive — this list drives the next iteration round.`,
  { label: 'synthesize', phase: 'Synthesize', schema: SYNTH_SCHEMA },
)

return synthesis
