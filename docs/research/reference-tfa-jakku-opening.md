# Visual Reference — The Force Awakens Jakku Opening

**Source**: opening sequence of *Star Wars: The Force Awakens* (2015) — Rey introduction on Jakku. User-supplied screenshots, captured during a vibe-research pass in 2026-05.

**Status**: reference only. No specific action items yet — this doc exists so future visual sessions (texture pass, megaWreck polish, lighting tuning, sled aesthetic, outfit iteration, atmospheric work) can grep + match against it.

**Why this reference**: this is the closest tonal match the user has found for Dustfall. Lone scavenger pulling salvage from massive industrial wreckage on a vast warm dune planet. Validates the existing direction across rig, sled, wreck flagships, terrain palette — and surfaces a few open visual questions.

---

## The 10 reference shots

### Interior / night shots (cool palette, single light source)

1. **Welding close-up.** Rey in goggles + welding mask inside a dark wreck interior. Blue arc-weld is the SOLE light source against pitch-black surrounding cables/pipes. Framed through a torn hull-window in the foreground.
   - Palette: black (~95% of frame) + arc-light blue (`#5ec8ff` core, `#1a4a8a` falloff).
   - Composition: triangular framing through torn metal opening.

2. **Standing on engine wreck exterior, night.** Lone figure with white headlamp glowing, perched on a massive ribbed engine cylinder. Multiple engine modules visible behind.
   - Palette: deep navy-black field + warm white headlamp point.
   - Scale: figure occupies ~3% of frame height against massive ribbed-cylinder forms.

3. **Cathedral interior with god rays.** Hangar-scale wreck interior, sun shafts cutting through hull-tear openings into the dim space. Lone figure rappelling on a rope from above. Floor strewn with salvageable debris.
   - Palette: dark slate (~`#1f2530`) + warm dust-shaft cream (~`#e0c896`).
   - Dust motes visible in light beams.

### Day / interior closeups (warm palette)

4. **Drinking from canteen, daylight.** Rey's face lifted to drink from a small metallic flask. Sweat-streaked skin, headscarf wraps, goggles on neck.
   - Palette: warm flesh + cream/tan wraps + soft warm bokeh background.
   - The cinematic version of Dustfall's existing canteen-drink animation.

### Exterior wide shots (warm sand + atmospheric haze)

5. **Sliding down a tall dune.** Single figure on a rough sled-like rig sliding down a steep dune slope. Skid trail behind.
   - Palette: warm peach-orange dune (~`#d8a575`) + cream-shadow line where sun meets shade.
   - Top-down-ish camera reveal of dune-slope scale.

6. **Engine cluster half-buried in dune.** Massive Star Destroyer engine bells leaning and partially sunk into sand. Tiny figure walking across sand at base.
   - Palette: warm cream sand (~`#e8c89a`) + dusty rust-brown engine metal (~`#6e5644`) + light blue-gray sky.
   - Composition: repeating ringed engine maws as dominant shape, figure as scale-marker.

7. **Rey + speeder + tow-net on flat desert floor.** Standing beside a hover-speeder, salvage-net laid on the ground behind for a planned tow drag.
   - Outfit detail: cream-beige wraps, headscarf, goggles dropped to neck, scrap-leather gloves, layered tunic + cinched belt + pouches.
   - Tow-rig material: rough netting + rope (NOT a metal sheet — see Dustfall open question below).

8. **Star Destroyer wreck mid-ground + downed TIE foreground.** Massive Star Destroyer broken-hulled across the dune horizon. Tiny crashed TIE fighter in foreground.
   - Palette: pale gray-blue sky, hazy mid-ground (atmospheric perspective).
   - Composition: layered depth — close fore + mid wreck + far dunes + sky band.

9. **Niima Outpost silhouette on horizon.** Distant scavenger trading post — improvised tents/truss structures dotted across a horizon line. Dust trail from an approaching speeder.
   - Palette: very washed-out cream-yellow (peak-day heat, atmospheric haze flattening contrast).
   - Composition: thin horizon strip, ~70% sky.

10. **Rey running, dragging salvage on a long-handle rig.** Sprinting across desert flat, single hand on a long pole that drags a wrapped salvage bundle behind. The rig is basically a textile-and-rope sled.
    - Outfit detail (close-up confirm): earth-tone wraps, cinched belt, layered tunic, gloves with finger cutouts at knuckles, scarf wrapping head + neck.

---

## Extracted patterns

### Color palettes

| Mode | Primary | Secondary | Accent |
|---|---|---|---|
| Day exterior | warm sand `#e8c89a` | dusty rust metal `#6e5644` | pale sky `#bcc8d0` |
| Day exterior (peak heat) | washed cream `#e8d8b0` | dust haze (~70% opacity) | low contrast everywhere |
| Night/interior | deep slate `#1f2530` to black | rust metal `#3a2f28` | single warm point (headlamp) or single cool point (arc-weld) |
| Cathedral interior with god rays | dark slate floor | warm dust shaft `#e0c896` | dust motes |
| Scavenger outfit | cream-beige `#cab48a` | leather wear `#6e5333` | dirt smudges + sweat highlights |

### Lighting language

- **SINGLE-source lighting in dark scenes.** Welding arc, headlamp, god ray. Everything else falls to black. The light source IS the composition.
- **Atmospheric haze on wide exteriors.** Far objects are noticeably bluer/grayer + lower contrast than near objects. Real-air convincingness.
- **God rays from hull tears.** Sun shafts through irregular openings, light pools on the floor, dust motes in the beams. (Note: Dustfall removed the AAB godray on the opening wreck per a "theatrical" critique — this reference says theatrical IS the goal.)

### Composition signatures

- **Lone figure dwarfed by ruins** — 6 of 10 shots. The character occupies <5% of frame. The wreck IS the protagonist of the frame.
- **Scale-marker framing** — figure visible specifically to telegraph "this thing is massive."
- **Triangular interior framing** — torn metal openings, doorways, hull tears used as natural vignettes around the subject.
- **Horizontal sky bands** — 60-75% sky on the wide exteriors. Land is a strip; sky is the dominant void.

### Outfit canon

The Jakku scavenger outfit appears in 7/10 shots:
- Earth-tone wraps + cinched belt
- Headscarf wrapping head + neck
- Goggles (worn on forehead by default, dropped over eyes when sandstorming or welding)
- Scrap-leather gloves, often with finger cutouts at knuckles
- Layered tunic + sleeve wraps
- Visible backpack / pouches strapped on
- Boots wrapped in cloth

**This is exactly the Dustfall procedural-character pipeline target.** Validates the ABP-ABY 10-session arc direction (hood + poncho + bandolier + pauldron + bandana + forearm wraps + leather details).

### Mechanic validation

- **Sled / hand-towed salvage drag** appears in shots 5, 7, 10 — central enough to the Jakku visual identity that it shows up across both action and quiet beats. **Strongly validates the ACA-ACC-ACD sled mechanic as a CORE Dustfall activity, not a side feature.**
- **Welding / repair tools** appear in shot 1. Dustfall doesn't currently have a repair-tool mechanic — could be a future addition (weld broken sled components? repair speeder?).
- **Rappelling / climbing on wreck interiors** appears in shot 3. Dustfall doesn't currently have vertical traversal — this is "could-be" territory if the wreck POIs ever go more vertical.

---

## Mapping to Dustfall systems

| Reference signal | Dustfall system | Match | Notes |
|---|---|---|---|
| Wrapped scavenger outfit | `src/player/playerRig.ts` | ✓ on-target | ABP-ABY pipeline already covers hood/poncho/wraps/goggles. Could add: visible backpack mesh, finger-cutout glove detail. |
| Engine bell wrecks | `src/world/wrecks.ts` engine_cluster | ✓ on-target | Visual silhouette matches. Could polish: lean angles, partial dune-burial depth. |
| Star Destroyer-scale flagship | `src/world/megaWreck.ts` | ✓ on-target | Current megaWreck is the right tier of scale. Atmospheric haze on mid-ground matches. |
| God rays through hull tears | `updateOpeningWreckGodRay` (REMOVED in AAJ) | open question | We removed this as "theatrical" — TFA reference says theatrical IS the goal. Consider reinstating with refined parameters. |
| Single-source dark-interior lighting | `src/world/lighting.ts` + lantern/welding/torch | inform | When interior darkness deepens (e.g., entering a wreck), lean harder into single-source convention. |
| Warm sand + atmospheric haze | `src/world/terrainMaterial.ts` + fog | ✓ on-target | Current dune palette + AAF storm haze are aligned. Could polish: stronger haze on FAR draw distance (>500m) for the megaWreck-on-horizon shot. |
| Hand-towed sled mechanic | `src/world/sled.ts` | ✓ on-target | ACA-ACD shipped this. ACD slope-slide adds the dune-slide TFA references. Riding mechanic (tabled) would close the loop. |
| Net/rope sled (vs. our metal-sheet) | sled visual | **open question** | Rey's tow-rig is textile + rope; Dustfall's ACA-rework is a warped scrap-metal sheet. Different aesthetic. Is the metal-sheet the right Dustfall identity (more hardware-salvage tone) or should there be a craftable second tier (a primitive rope-net sled the player starts with, upgrading to the metal one)? |
| Scavenger settlement on horizon | `src/world/poi.ts` clusters | could extend | Existing clusters: comm-relay, refugee caravan, military convoy. A "trader outpost" cluster would extend toward Niima Outpost vibe. |
| Welding/repair tools | n/a — not in game | future addition | Could enable: repair broken sled, weld panel back onto a wreck (reverse-salvage), craft from scrap with a welding step. |
| Rappelling on wreck interiors | n/a — not in game | could-be | Vertical traversal not currently supported. Would require KCC rope-attach mechanic. |

---

## Open visual questions raised by this reference

1. **Reinstate godrays inside the opening wreck?** Removed in AAJ as theatrical; TFA reference says theatrical is right. Worth a re-evaluation in a future visual session.

2. **Primitive sled tier — textile + rope (à la Rey's tow-net)?** Currently the only sled is the ACA scrap-metal sheet. A starter sled crafted from cloth + rope (cheaper recipe) could precede the scrap-metal upgrade, matching the TFA tow-net visual.

3. **Backpack mesh on player rig?** Rey's outfit prominently features a strapped backpack. Dustfall's current rig has no visible backpack — could be a small geometry addition without breaking D107 zero-asset.

4. **Glove finger-cutouts.** Subtle but recurring in TFA outfits. The Dustfall rig currently uses solid wrap gloves; finger cutouts would add character detail.

5. **Stronger far-distance haze.** Shot 8's Star Destroyer on the horizon has very strong atmospheric perspective (mid-ground noticeably bluer + lower contrast than fore). Dustfall's current fog ramps are tuned for storm intensity — a base "day haze" beyond ~500m could match.

6. **Visible repair / welding tool.** Not necessary now but would unlock the welding aesthetic from shot 1 if ever pursued.

---

## How to use this doc

- **Visual session starting?** Read this first if the work touches: rig outfit, terrain palette, lighting, wreck POI silhouettes, sled aesthetic, fog/haze, settlement clusters.
- **Stuck on a "what should this look like?" question?** Check the relevant pattern table above + the "Mapping to Dustfall systems" matrix. The reference shots are the source of truth for "is this the right vibe?"
- **Find a discrepancy?** If the game ships something that visibly diverges from this reference and the user calls it out, this doc is the comparison baseline.

Reference doc lives at `docs/research/reference-tfa-jakku-opening.md`. Companion docs in `docs/research/`:
- `3p-cameras-in-games.md` (ABP camera research)
- `sci-fi-desert-scavenger-aesthetic.md` (ABP outfit research — already covers the Jakku/scavenger archetype generally; this doc is the SPECIFIC shot-by-shot pattern extraction from TFA's opening)
