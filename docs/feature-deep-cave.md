# Feature spec — Deep cave (M8 ⑧ design spike)

**Status:** spike COMPLETE (C46). Decision locked; ⑨ builds it, ⑩ adds the companion.
**Decision of record:** [decisions.md](decisions.md) **D254**.

## The problem
M8 wants ONE deep, walkable, **enclosed** cave: the player descends below the desert, walks chambers with a roof overhead (torch-lit, dark, tense but **no horror**), reaches a deepest chamber (the M8 ⑩ companion-egg), and climbs back out. The blocker: the world ground is a **Rapier heightfield** (one Y per XZ) — it physically *cannot* enclose a volume or make an overhang. So the spike must answer: how does the player get into a real enclosed, collidable underground space and back out, deterministically, with no save bump and no new movement mode?

## Candidates evaluated
- **(A) Terrain funnel + placed box/cylinder room-kit (CHOSEN).** Reuse the Sarlacc carve to lower the heightfield into a walk-down funnel (the descent), then place an enclosed interior built from declared box/cylinder colliders (walls + **a real roof collider**) at the bottom. The player walks the carved terrain down, crosses a doorway gap into the shell, and walks the chambers.
- **(B) Trimesh / marching-cubes tunnel.** A full 3D carved trimesh. Highest fidelity, but needs a *new* marching-cubes/voxel subsystem (none exists), trimesh colliders are the priciest per-frame, and concave carves risk KCC clip/stuck states. **Rejected** — friction 3-4, disproportionate for ONE location.
- **(C) Pure box-collider room kit (no terrain carve).** Just the interior kit, entered through a surface hole. Simplest, but with no carved descent the entrance reads as a flat hatch, not a cave mouth. **Folded into A** — A *is* C plus the Sarlacc descent funnel, which gives the dramatic "descend into the earth" read.

## Why A
1. **Reuses proven, deterministic systems.** The Sarlacc pit (`terrain.ts:163-173`, `biomes.ts`) already carves the heightfield + mesh bit-identically from a seed anchor — no save state, no seams. The interior reuses `attachDeclaredColliders` + the `ColliderSpec` box/cylinder kit (`physics/bodies.ts:243-281`) that every wreck POI uses, and the `huskShell` "walk an enclosed shell" precedent (now with an added roof collider).
2. **KCC-safe, no new movement mode (D125).** Descent ramp tuned to ~37° (< the 50° `setMaxSlopeClimbAngle`); 0.3 m autostep + 0.3 m snap-to-ground are fine. The roof collider sits above the capsule and doesn't fight snap-to-ground (which fires downward). No climbing/crouch controller.
3. **Determinism (D226), no save bump (D81).** Cave location = a seed-derived anchor (distance-gated, like the Sarlacc anchor); geometry is phash-assembled at boot, persisted by nothing. ⑧ touches no save. ⑨/⑩ persist only an **additive** `companionEggTaken?: boolean` (default false on load) — D81-compliant, **no `SAVE_VERSION` bump** (the recon confirmed; if ⑨ discovers it needs more, it STOPs and surfaces).
4. **Tone (D252 + no-horror).** Interior dressed as long-dead/decayed (reuse the aged-interior idiom from D253 — no powered/maintained reads); darkness = isolation tension, not jump-scares.

## Architecture (for ⑨ to build)
- **Anchor:** a seed-derived `caveAnchor` (distance-gated far from spawn; one per world), mirroring `sarlaccPitAnchor`.
- **Descent:** carve the heightfield at the anchor into a **funnel ramp** (smoothstep radial profile, slope clamped ≤ ~37°) down to depth ~12-20 m, feeding both the mesh and the heightfield collider (bit-identical, the Sarlacc code path).
- **Mouth → interior gap:** at the funnel base, a doorway gap leads into the enclosed shell (the collider has a deliberate opening, like the husk/`auditExempt` pattern).
- **Interior (the room kit):** 4-8 chambers as declared **box + cylinder colliders** — floor, walls, and **a roof collider** per chamber; connected by short ≤37° ramps. Procedurally assembled from a small grammar (one `seedOf` draw + phash), merged by material (the wreck-yard draw-call pattern). Decayed dressing (no maintained/lit props).
- **Deepest chamber:** the M8 ⑩ companion-egg site.
- **Dark-nav (decide in ⑨, recommendation here):** prefer a **cheap shader/ambient darken-below-Y** (lower ambient when the player's Y is under a threshold) + an emissive torch glow, over a dynamic point light (which adds per-frame shadow-map cost). Ambient-dim + torch read satisfies "torch-only dark-nav, no horror" without a new lighting subsystem. If a point light proves necessary, gate it behind a `FEATURES` flag.
- **Collider audit:** add the cave archetype/module to the `verify:colliders` list; the enclosed shell uses the hollow-shell exemption for any intentional gaps (the doorway), exactly like `crash_husk`/`enterable_wreck`.

## Risks / open questions (carried to ⑨)
- **Carving INTO the heightfield vs a hole:** a funnel depression is safe (Sarlacc-proven). A true vertical shaft is NOT representable by the heightfield — keep the descent a walkable funnel/ramp, not a sheer drop.
- **The roof collider × snap-to-ground:** validate in the ⑨ prototype that a low roof doesn't cause capsule jitter; keep ceilings ≥ ~2.5 m.
- **Dark-nav cost:** confirm the ambient-darken approach reads as "dark cave" without tanking perf; this is a ⑨ visual-gate item.
- **Save (D81):** if ⑨ finds it needs to persist anything beyond an additive `companionEggTaken?` flag, **STOP and surface** — do not bump `SAVE_VERSION` autonomously.

## Sub-tasks
- **⑨ deep-cave-build (XL):** the seeded `caveAnchor` + the Sarlacc-style funnel carve + the box/cylinder room-kit interior (walls + roof + ramps, doorway gap, audit-listed) + decayed dressing + the dark-nav darken-below-Y + torch glow. Visual gate: descent read, enclosed-interior read, dark-but-navigable, no-horror tone. `verify:all` green (placement + colliders incl. the cave).
- **⑩ companion-egg-cherry-pick (M):** re-apply the `2d4035b` companion spine at the deepest chamber; the additive `companionEggTaken?` save field (no bump).

## Success criteria (the cave, end of ⑨)
1. The player can walk DOWN into an enclosed space and back OUT, on ramps ≤37°, no new movement mode.
2. The interior is genuinely enclosed (a roof collider overhead) and dark but navigable with the torch.
3. Deterministic: same location + layout every boot from the seed; `verify:all` green (placement 0/0, colliders 0/N incl. the cave).
4. Reads as a long-dead, no-horror, solitary place (D252).
5. No `SAVE_VERSION` bump.
