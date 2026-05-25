# Research: Sci-Fi Desert Scavenger Aesthetic for Procedural Player Rig

**Researched**: 2026-05-25
**Trigger**: Next session will overhaul procedural player rig with "mismatched scavenger" aesthetic from desert survival sci-fi. Asset constraint: stay procedural (no GLB, only Three.js primitives + existing shader vocabulary).
**Depth**: medium

## Summary

Desert scavenger aesthetic hinges on three design pillars: **asymmetric mixed layers** (not symmetric armor sets), **functional silhouette** (ponchos, bandoliers, wrapped limbs communicate survival, not style), and **weathered earth tones** (ochre, rust, grey, tan — never bright). The canonical references are Cobb Vanth (armored vest over poncho), Star Wars Outlaws' Kay Vess (layered jacket with wraps), and Rey's Force Awakens outfit (cloth Jersey + arm wraps + head scarf + goggles). For Dustfall's procedural rig, this means building **8-10 discrete cloth/metal/bone geometry layers** in ConeGeometry (hood), tapered CylinderGeometry (poncho), TorusGeometry (wraps), and BoxGeometry (armor plates), each with a distinct procedural shader from the shipped vocabulary, then arranging them asymmetrically around the core capsule-sphere-bone rig.

## Key findings

1. **Silhouette communicates function.** Cobb Vanth's iconic look pairs an open-sided poncho (CylinderGeometry, thetaLength < 2π) with a diagonal bandolier strap and a single asymmetric shoulder pauldron — reads as "gunslinger scavenger living rough," not "armored soldier." — source: [Cobb Vanth build | The Dented Helmet](https://www.thedentedhelmet.com/forums/threads/cobb-vanth-build.38352/)

2. **Layering convention from inside out: base cloth → poncho/cloak → bandolier → asymmetric armor → wraps → head covering.** Rey's Jakku outfit demonstrates the pattern: light brown Jersey (base), long scarf draped over torso (poncho), arm wrappings (protection), crop-boots (practical), goggles (sand-eye), head scarf (sun/sand). Each layer serves function, not decoration. — source: [Star Wars: The Force Awakens Scavenger](http://costumevault.blogspot.com/2015/12/star-wars-force-awakes-scavenger.html)

3. **Asymmetric armor is visual shorthand for salvage-cobbled.** Only one shoulder pauldron (reused armor piece), not matching pair. This breaks the "warrior full-kit" silhouette and reads as "I found this on a wreck and bolted it on." — source: [Star Wars costume design asymmetric](https://setthetape.com/2017/12/08/star-wars-style-analysing/)

4. **Earth-tone palette: ochre (0xB8860B), rust-orange (0xA0522D), warm-grey (0x7A7A7A), desert-tan (0xD2B48C).** Dark cloth wraps (0x3A3A3A) for face + forearms read as "functional protection" and visually anchor the design. Avoid bright colors — they break immersion and read as "costume" not "survival gear." — source: [Dune Fremen Costumes — color psychology](https://psylofashion.com/blogs/blog/dune-costumes-inspirations)

5. **Dune Fremen stillsuit design emphasizes breathable, layered, lightweight fabrics** (cotton, gauze) in dark grey to maximize sweat collection. This informs the *concept* of Dustfall's scavenger: practical, heat-adapted, multi-layered. The dark-grey choice is functional (not aesthetic), which grounds the silhouette in *why* the character wears it. — source: [Dune (2021) costumes hidden details](https://screenrant.com/dune-2021-costumes-hidden-details/)

6. **Star Wars Outlaws' Kay Vess wears a blue-grey satin-leather jacket with tan fur lining over desert-nomad robes — the jacket top-layer reads as "competence" while robes underneath communicate "adaptable to environment."** The mix of leather (scrap-ready) + cloth (breathable) is the key. For procedural rig, this means pairing metalMaterial (bandolier, buckles) with fabricMaterial (poncho, wraps) and skinMaterial for visible face/hands. — source: [Star Wars Outlaws Kay outfits](https://www.cbr.com/star-wars-outlaws-kay-outfits-guide/)

7. **Procedural geometry trade-offs for clothing: CylinderGeometry (tapered via radiusTop/radiusBottom + thetaLength < 2π) builds ponchos and hoods; TorusGeometry builds wraps and bandana; TubeGeometry along a CatmullRomCurve3 builds bandolier strap with natural sag.** LatheGeometry is overkill for simple asymmetric layers — reserve it for hullwork. — source: [Three.js geometries guide](https://blog.logrocket.com/three-js-geometries-and-materials/)

8. **Weathering = legitimacy.** Every layer must read as dusty, worn, patched. Use paintMaterial (chips reveal rust) on armor plates, fabricMaterial (wind-shimmer + noise) on cloth, metalMaterial (brushed scratches + grain) on buckles/straps. No clean surfaces = no "tailored costume" impression. — source: Dustfall's shipped shader vocabulary (ABH session onwards)

## Actionable takeaways

For the Dustfall rig overhaul:

- **Build 8 core layers in this order (Z-hierarchy, innermost to outermost):**
  1. **Torso base**: existing capsule body (keep) — skinMaterial, tan (0xC9A876 weathered skin tone)
  2. **Poncho body**: tapered CylinderGeometry (radiusBottom 0.45, radiusTop 0.35, height 1.2, thetaLength 1.5π, open at +X side) — fabricMaterial, sun-bleached ochre (0xB8860B)
  3. **Bandolier strap**: TubeGeometry along diagonal Catmull-Rom curve (shoulder to opposite hip, 5-point path with mid-arc sag) OR stacked thin TorusGeometry tilted ~35° — metalMaterial, dark grey (0x505050)
  4. **Bandolier pouches**: 6–8 small BoxGeometry (0.12×0.15×0.08 each) along strap path, alternating paintMaterial rust-chip (0xA0522D) and metalMaterial
  5. **Right-shoulder pauldron only** (asymmetric): 2–3 curved BoxGeometry plates or a partial SphereGeometry sector (radius 0.25, spherical segment ~120° arc) — metalMaterial, worn steel (0x6A6A6A with paintMaterial chips)
  6. **Chest plate** (optional, thin): small BoxGeometry on torso front (0.35×0.50×0.08, slightly recessed) — metalMaterial + faint emissive
  7. **Forearm wraps**: 2–3 stacked thin TorusGeometry per arm (radius ~0.10, tube radius ~0.015, rotated to wrap around cylinder arms) — fabricMaterial, warm-grey (0x7A7A7A)
  8. **Face bandana + head wrap**: TorusGeometry (radius 0.12, tube radius 0.02) positioned at lower face (mouth/nose level) + cone-based hood — fabricMaterial, dark cloth (0x3A3A3A)

- **Parent hierarchy for proper layering:** `rig.torso (capsule) → poncho (group) → bandolier (group: strap + pouches + pauldron) → forearm_wraps (group: left + right) → head_wraps (group: bandana + hood)`

- **D-entry candidates:**
  - **D112: Asymmetric one-pauldron rule** — only right shoulder, never left, never paired. Communicates "salvaged scrap, not matched set." Friction-2 (clear, visual impact, one-line commitment).
  - **D113: Bandolier strap geometry choice** — TubeGeometry (natural sag, more visual interest) vs. stacked TorusGeometry (cheaper, easier parenting). TubeGeometry wins for silhouette; code commitment ~40 LOC. Friction-2 (trade-off, testable).
  - **D114: Weathered-only palette** — no "clean" materials on rig. Every surface reads dusty via noise + chip sampling. Ensures immersion at first-person and third-person views. Friction-1 (unanimous consensus in references).

- **Stretch / cut-first layers if budget tight:**
  - Forearm wraps (layers 7) — purely cosmetic; cutting saves geometry + shader binding
  - Chest plate (layer 6, optional) — visually redundant if pauldron + poncho read strong; defer to future cosmetic pass
  - Bandolier pouches (layer 4 detail) — can reduce from 8 to 3–4 spaced pouches if verts explode

- **Shaders to use per layer:**
  - **Torso (skin):** skinMaterial — scale-cell FBM + pigment blotches, tan weathered tone
  - **Poncho + wraps:** fabricMaterial — wind shimmer + noise sampling in object-local space (per ABN fixes); ochre + warm-grey base
  - **Bandolier + pauldron + buckles:** metalMaterial — brushed scratches + grain + edge dirt, dark steel base (0x505050)
  - **Armor plates:** paintMaterial — paint chips reveal rust, orange-brown base (0xA0522D) with chip edges showing 0x8a4a28 rust beneath
  - **Goggles** (if added): glassMaterial or simplify to small SphereGeometry pair with dark-tint opacity

## Contrarian or surprising

- **No helmet.** All references (Cobb pre-helmet, Kay Vess, Rey) wear hood + bandana + goggles, NOT a full helmet. Helmets read as "soldier" or "formal." Open head = "survivor." This is non-obvious because most procedural character rigs default to a spherical head + helmet box. Dustfall's choice to go hood + wraps instead is a deliberate signal.

- **Open-side poncho is better than a full tube.** Intuition says "wrap the character completely," but half-open (thetaLength 1.5π) means the player's view of their torso arms is never fully obscured, AND the silhouette reads as "living out of doors" not "encased in fabric." The asymmetry is the point.

- **Bandolier strap sag matters.** A perfectly taut strap reads as "parade uniform." A sagging strap (via TubeGeometry curve with arc midpoint) reads as "carrying weight, lived-in." This is a small detail with outsized impact on "scavenger vs. soldier" read.

## Sources

- [Cobb Vanth build | The Dented Helmet](https://www.thedentedhelmet.com/forums/threads/cobb-vanth-build.38352/) — costume construction details for Cobb Vanth's iconic layered scavenger-marshal look
- [Cobb Vanth | Rebel Legion](https://rebellegion.com/cobb-vanth/) — reference for armor + poncho pairing (HTTP 403 blocked detailed fetch; search results confirm costume details)
- [Star Wars: The Force Awakens Scavenger | Costume Vault](http://costumevault.blogspot.com/2015/12/star-wars-force-awakes-scavenger.html) — Rey's layering structure (Jersey + scarf + arm wraps + boots + goggles)
- [Star Wars Style: Analysing the Costume Design | Set The Tape](https://setthetape.com/2017/12/08/star-wars-style-analysing/) — silhouette + asymmetry as character shorthand (Captain Phasma's asymmetrical cape, functional aesthetics)
- [Star Wars Outlaws Kay outfits | CBR](https://www.cbr.com/star-wars-outlaws-kay-outfits-guide/) — Kay Vess's satin-leather jacket over robes; desert-nomad design language
- [Dune Costumes Inspirations | Psylo Fashion](https://psylofashion.com/blogs/blog/dune-costumes-inspirations) — Fremen layering philosophy (lightweight, breathable, multi-layer for desert)
- [Dune (2021) Costumes Hidden Details | Screen Rant](https://screenrant.com/dune-2021-costumes-hidden-details/) — stillsuit color choice (dark grey for practical water management, not aesthetics)
- [Three.js Geometries and Materials | LogRocket Blog](https://blog.logrocket.com/three-js-geometries-and-materials/) — Three.js primitive shapes (CylinderGeometry, ConeGeometry, TorusGeometry, TubeGeometry parameters)
- [Exploring Three.js Geometries | Dipankar Paul](https://blog.iamdipankarpaul.com/exploring-threejs-geometries-the-building-blocks-of-3d) — procedural geometry fundamentals for character construction

## Recommendations for Dustfall

**Immediate actionable spec for next session's rig overhaul:**

| Layer | Geometry | Shader | Color (hex) | Notes |
|-------|----------|--------|-------------|-------|
| Torso | Capsule (existing) | skinMaterial | 0xC9A876 | Keep; core body anchor |
| Poncho | tapered CylinderGeometry, thetaLength 1.5π | fabricMaterial | 0xB8860B | Open side toward +X; 1.2m long |
| Bandolier strap | TubeGeometry (Catmull-Rom curve) | metalMaterial | 0x505050 | Diagonal, sagging, shoulder to hip |
| Bandolier pouches | 6× small BoxGeometry | paintMaterial + metalMaterial | 0xA0522D / 0x505050 | Spaced along strap; mixed rust/metal |
| Pauldron (R shoulder) | partial SphereGeometry or 3× curved BoxGeometry | metalMaterial + paintMaterial | 0x6A6A6A / 0x8a4a28 | Asymmetric only; chips + scratches |
| Chest plate (optional stretch) | thin BoxGeometry | metalMaterial | 0x505050 | Small accent; recessed into torso |
| Forearm wraps (stretch) | 2–3 TorusGeometry per arm | fabricMaterial | 0x7A7A7A | Functional, not decorative |
| Face bandana | TorusGeometry at mouth level | fabricMaterial | 0x3A3A3A | Dark, sand-protective |
| Hood | inverted ConeGeometry or half-Icosahedron | fabricMaterial | 0xD2B48C | Open base; sits on head |
| Goggles (future) | 2× small SphereGeometry + TorusGeometry strap | glassMaterial or dark opacity | 0x1a1a1a | Eye protection; stretch feature |

**Z-hierarchy (parent-child grouping):**
```
rig.torso (capsule, spheres for head/hands)
  └─ poncho (group: CylinderGeometry body + slight sway animation hook)
       └─ bandolier (group: strap + pouches + pauldron)
            └─ forearm_wraps (group: left + right TorusGeometry stacks)
                 └─ head_wraps (group: bandana TorusGeometry + hood ConeGeometry)
```

**Design rules to commit (next-session D-entries):**
- **D112:** Only right-shoulder pauldron; asymmetry = salvage aesthetic. Friction-2.
- **D113:** Bandolier strap geometry = TubeGeometry (natural sag > visual interest). Friction-2.
- **D114:** Every surface weathered (no clean materials); dusty immersion > pristine readability. Friction-1.

**Budget allocation:**
- **Tier 1 (ship default):** Torso + poncho + bandolier strap + pauldron + bandana + hood (6 layers, ~50 verts total at reduced segment count).
- **Tier 2 (polish if time):** Add 6 pouches + forearm wraps (detail pass, +30 verts).
- **Stretch / defer:** Chest plate, goggles, full hood geometry (these can ship in a future cosmetics pass if rig feels bare).

**Implementation notes:**
- All geometries must preserve the **procedural-only constraint** — no GLB imports, no texture files. Rely entirely on the ABH shader vocabulary (skinMaterial, fabricMaterial, metalMaterial, paintMaterial, stoneMaterial, woodGrainMaterial, boneMaterial, glassMaterial).
- Shader instancing via `onBeforeCompile` is already wired per ABH; each layer's material will auto-sample world-space coords for variation (no two pauldrons read identical).
- Head rotation + limb animation (walk cycle from playerRig.ts) remains unchanged; new layers just move with the rig, no additional bone deformation needed in this first pass.
- Weathering sampling should read **consistent per-body-part** (poncho weathering doesn't crawl with the mesh per ABN fixes; use object-local sampling for cloth layers).
