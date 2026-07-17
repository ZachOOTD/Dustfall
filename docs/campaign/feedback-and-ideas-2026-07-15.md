# Feedback + ideas capture — 2026-07-15

Full capture of the review round + new ideas, to feed the next campaign plan. Nothing here is code yet.

## A. Review feedback (fixes/polish on existing content)

### A1. Leviathan (big-fin) wreck
- The **original larger exterior hull needs proper collision** (its blocking box was replaced by the interior set → no exterior collision; you can walk through it from outside).
- Entrance mismatch: the exterior's real **opening is at the front and leads nowhere**; the interior entrance faces the **back into a wall** — no real way in. Fix: align the interior entrance to the front opening, OR add a back opening + close the front (whichever reads better).
- The interior must **fit cleanly inside the exterior** — no overlap, no gaps, no paper-thin edges; the entrance jamb connects exterior↔interior as one solid thick edge.

### A2. Boneyard (giant skeleton + scatter)
- Bones read **too white + flat at distance** → more surface **texture** (deeper cracks/crevices/weathering that survives distance).
- **See-through / backface-culling bug**: parts of the skeleton vanish at certain angles, showing the inside. Exterior must be **solid from every angle**. Diagnose precisely (multi-angle probe) before fixing — likely a winding/single-sided/unclosed-solid issue in the swept tubes or spikes.
- **Redesign**: less arched, **lower + more sunken** into the sand, **a bit longer** → reads as a **massive sandworm skeleton**, not a tall arched ribcage. Keep walk-under quality.
- **100% accurate collision** on the new shape.
- **Remove the blob scatter bones** (the dome-ish "tail bone" scatter bits that read as featureless blobs).

### A3. Skyfall wreck
- **Close both hull ENDS** — a torn end is open with the thin edge exposed; cap cleanly, no gaps.
- Seat **floating exterior detail** panels on the hull walls near the end.
- Seat the **floating fixture on top** (by the mast).
- **Entrance edges (both split sides)**: exterior skin ends at a knife edge that doesn't meet the interior wall → visible gap between exterior/interior. Join into one solid thick cut edge on BOTH fracture faces (the stern split never got a jamb). **Standing rule: torn/cut hull ends always close with a solid thick cross-section, exterior meeting interior — never a paper-thin edge or skin gap. Apply to all future wreck modeling.**
- **Entrance floor z-fighting** — coplanar surfaces flickering on the deck edge; offset them.
- **Integration: the sky-crash (meteor) wreck should BE the new Skyfall wreck.**

### A4. Hab dome POI
- A bit **bigger**.
- **Open, walkable connector tube** between the domes (currently closed/decorative).
- **Accurate collision** throughout (domes + tube).
- **Floating cone** inside a dome top — mis-placed; seat or remove.

### A5. Storm
- **Dustwall spins/wraps** (curved cylinder re-yawed each frame) → rework into a **Dune-style linear advancing wall** from one fixed wind direction (grows on the horizon, sweeps toward you, no rotation).
- **Distant structure outlines still show through the fog** → go beyond fog density: denser earlier in the ramp + the **sky-dome horizon flatten** + possibly a **hard draw-distance cull** during storms so nothing far can render an outline.

### A6. Horizon worm sweep
- **Lighter brown** from a distance (still reads dark).
- **Sink the body slightly under the terrain** (currently looks like it floats on top).

### Open feel-calls / decisions (from the overnight)
- Boneyard skull (built without one — add a characterful horned/tusked skull?).
- Leviathan interior lighting (moody-dark by design — brighter?).
- POI density + storm feel (walk-test tuning).
- The held production push (nothing shipped to master/live yet).

## B. New feature ideas (future)

1. **Mega dune biome** — much larger, realistic Sahara-style dunes; you can only see far from atop a dune. (Big terrain feature — sightline/occlusion gameplay.)
2. **Ridable scrap sled** — a ride/mount button; ride it sliding down hills. (Previously tabled — see D125 riding-mechanic wall.)
3. **Crafting material + recipe variety** — beyond scrap+cloth: scrap metal, scrap bars, electronics, machine parts, etc. (+ more). Realistic recipes. Makes searching/crafting more fun.
4. **Loot variety on the ground** — the new loot types spawn scattered around wrecks/POIs.
5. **Panel/lootable variety** — different panel models (lockers, crates, machine-access panels), varied sizes/shapes, to go with the new loot types.
6. **Infinite sprint + toggle** — no stamina drain on sprint; toggle with Left Shift (instead of hold).
7. **Realistic cave terrain system for the egg** — build out the actual cave system for the egg objective. Big feature — get it right.

## C. Carried-over (from the earlier campaign-plan discussion — pending decisions)
- **Audio de-cute pass** — remove beepy/cute sounds (flare etc.) → neutral/rugged. Needs the user's ears + which sounds.
- **Character model + rig + animation** — heavy; research-first; DECISION: procedural (on-ethos, lower fidelity) vs imported rigged glTF (higher quality, breaks no-assets rule). Prereq for good multiplayer.
- **Multiplayer** — very heavy; DECISION: scope (co-op vs many) + infra (needs a server/hosting — currently client-only) + authoritative-vs-P2P. Depends on the character model.
