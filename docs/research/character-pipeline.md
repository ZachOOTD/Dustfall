# Research: Character Model/Rig/Animation Fork

**Researched**: 2026-07-17
**Trigger**: Design ambiguity — proceed with procedural-ceiling push vs. switch to imported glTF; also scoping multiplayer readiness
**Depth**: deep

## Summary

The procedural humanoid rig can push further visually with IK integration and walk-cycle refinement, but import offers faster turnaround and established standards. A hybrid approach—procedural mesh + imported animation data—is defensible within the zero-asset pillar if animation is treated as *data* (retargeted bone sequences) rather than art. For 2–4 co-op MVP, the current rig's silhouette is adequate; imported glTF scales better if player counts grow.

## Key findings

1. **Procedural ceiling is real but bounded.** THREE.IK (FABRIK solver, multiple chains, constraints) can add dynamic limb placement and foot IK; procedural walk-cycle generation uses physics simulation or genetic algorithms (the latter closer to current gaits). Metaball/SDF techniques are ray-march-based and don't translate to skeletal deformation without architectural rework. Low-poly stylized characters achieve quality through *style consistency* (flat shading, unified palette, legible silhouette), not polygon/deformation sophistication — procedural can compete here. — sources: [THREE.IK docs](https://jsantell.com/three-ik/), [HumanoidProceduralAnimation](https://github.com/lchaumartin/HumanoidProceduralAnimation), [low-poly visual quality guide](https://pixune.com/blog/low-poly-game-art-guide/)

2. **Imported glTF pipeline (Mixamo → Blender → Three.js) is well-worn.** Workflow: Mixamo rig in T-pose (FBX), download animations individually (FBX, no skin), combine in Blender, export to glTF 2.0 + bin + textures. Retargeting to custom skeletons requires Blender plugins (Cats, Mixamo control rig, or Rokoko) and iterative IK adjustment; no automatic "one-click" retarget. Timeline: standard retarget is 2–4 hours per character + tweaking cycles, not a day-per-clip. — sources: [Mixamo→glTF workflow](https://www.donmccurdy.com/2017/11/06/creating-animated-gltf-characters-with-mixamo-and-blender/), [Rokoko retargeting guide](https://www.rokoko.com/insights/ace-retargeting-in-blender-with-this-simple-workflow-i-the-ultimate-retargeting-guide), [vrm-mixamo-retargeter](https://github.com/saori-eth/vrm-mixamo-retargeter)

3. **CC0 character sources are mature and plentiful.** Quaternius, Kenney (both 40k+ assets), and PolyPizza all release under CC0 Universal (no attribution required); assets are rigged, low-poly, and game-ready. Synty's POLYGON series adds premium variants. These avoid "asset flip" by design — you license *permission*, not uniqueness. — sources: [Quaternius](https://quaternius.com/), [Kenney overview](https://gamefromscratch.com/quaternius-free-3d-assets/), [free game assets guide](https://app.cinevva.com/guides/game-assets-guide)

4. **Animation-only import is defensible for the zero-asset pillar.** Retargeting Mixamo FBX animations onto a procedural skeleton (same bone naming convention, auto-map via kinematic chain length) treats animation as *data* (bone rotation sequences) rather than a mesh/texture asset. This preserves the spirit of procedural generation (all meshes + textures procedural) while borrowing tested locomotion + combat choreography. Libraries like `vrm-mixamo-retargeter` demonstrate the pattern. — sources: [vrm-mixamo-retargeter lib](https://github.com/saori-eth/vrm-mixamo-retargeter), [Three.js retargeting discussion](https://discourse.threejs.org/t/retargeting-animation-to-mixamo-rig/6172)

5. **Multiplayer avatar representation: current rig is MVP-adequate; glTF scales.** Low-poly characters in multiplayer (e.g., VRChat, small co-op games) rely on *silhouette legibility + pose clarity*, not mesh fidelity; the existing rig meets this for 2–4 players. Imported glTF scales better for 8+ players (standard serialization, lighter avatar data, proven network sync patterns). Ready Player Me offers <1-day integration with built-in multiplayer templates (Photon/Netcode), free, glTF URLs as persistent avatars. — sources: [Ready Player Me integration](https://docs.readyplayer.me/ready-player-me/what-is-ready-player-me), [Ready Player Me multiplayer setup](https://docs.readyplayer.me/ready-player-me/integration-guides/unity/setup-multiplayer), [low-poly multiplayer discussion](https://game-ace.com/blog/low-poly-models/)

6. **IK for procedural is incomplete infra.** THREE.IK (FABRIK) is the only maintained three.js IK library, but development halted in 2020; it's "baseline" (author quote) rather than production-grade. Alternatives: three-skeletor (TypeScript port), Wiggle Bones (higher-level abstraction). None are battle-tested for procedural character pipelines; adopting IK adds risk + debug surface. — sources: [THREE.IK GitHub](https://github.com/jsantell/THREE.IK), [three-skeletor](https://github.com/AGoblinKing/three-skeletor)

## Actionable takeaways

For the project at hand:

- **If procedural-push is priority:** Adopt THREE.IK or three-skeletor for foot IK on walk cycles; allocate 3–4 design-iteration rounds on leg/arm placement. Retain procedural mesh/texture. Estimated effort: M (120–150 hours: research, integration, 4+ walk-cycle tweaks, visual gate).
  
- **If time-to-silhouette is priority:** Retarget 3–5 Mixamo animations (walk, run, idle, attack) onto the existing procedural skeleton; treat animation data as retarget-only imports (no mesh). Effort: S (30–50 hours: bone-mapping, Blender retarget, clip integration, 2–3 tweak rounds). Pillar impact: minimal (animation = data, not asset).

- **If breaking zero-asset pillar is acceptable:** Source a rigged character from Quaternius or Kenney (CC0), author 5–8 animations in Blender/Mixamo, export to glTF. Keeps art cohesion; eliminates rig/mesh authoring. Effort: L (120–200 hours: character customization, animation authoring, visual polish, multiplayer serialization). Multiplayer readiness: high (glTF = standard format).

- **For MVP co-op (2–4 players):** The current procedural rig's silhouette + pose clarity is sufficient; upgrade animations only if feel-test feedback calls for more readable choreography (combat impact, state transitions). Defer full character redesign until player count or art vision clarifies.

- **For hybrid (animation-only retarget):** Establish a bone-naming convention (e.g., Mixamo standard: `Spine`, `Armature|LeftLeg`, etc.); write a retargeting function that maps Mixamo SkinnedMesh animation clips to your procedural Bone hierarchy. Mixamo offers ~300 free clips (Creative Commons, no commercial restriction); curate 10–15 core actions. This sits between zero-asset and import forks. Effort: M (80–120 hours: retarget infra, clip curation, testing).

## Contrarian or surprising

- **IK infrastructure in three.js is thin and aging.** The ecosystem treats IK as optional "nice-to-have" rather than core; no production-grade library has emerged post-2020. Procedural projects often roll their own constraint systems instead of adopting external IK, suggesting library adoption carries integration risk. This is worth cost-versus-risk scoping before committing to IK-heavy procedural work.

- **Animation retargeting to procedural rigs is underexplored.** Most literature assumes retargeting to *rigged meshes* (Mixamo → custom Blender rig → game). Retargeting Mixamo animations to a *procedural skeleton* (where bones are Unity Objects or Three.js Bones but the mesh is procedural) is less documented but technically simpler — fewer bones to tweak, simpler mapping. This opens a low-friction hybrid path most teams miss.

- **Silhouette coherence beats mesh quality for multiplayer.** VRChat and small co-op games show that players parse avatars primarily by *pose and outline*, not poly count or material. A 200-polygon procedural humanoid with clear stance is more readable at distance than a 50k-polygon hyperrealistic character in a confusing pose. The current rig's visual bar for MVP is actually *higher* than many shipped games.

## Effort tiers summary

| Fork | Effort | Pillar Impact | Quality Ceiling | MP Readiness |
|------|--------|---------------|-----------------|----|
| **Procedural-push** (add IK, refine gaits) | M/L (120–200h) | None | Good (visual driven by style + pose) | Medium (custom serialization) |
| **Imported glTF** (Quaternius/Kenney + custom anims) | L (120–200h) | High (breaks pillar — external mesh/skeleton) | Excellent (artist-authored) | High (standard format) |
| **Animation-only retarget** (Mixamo → procedural skeleton) | M (80–120h) | Low (animation = data; mesh stays procedural) | Medium–Good (animation quality > current gaits) | Medium (custom serialization, proven choreography) |
| **Hybrid procgen mesh + imported anim** | M (80–120h) | Low (mesh procedural, anim retargeted) | Medium–Good | Medium |

## Open questions

1. **Do the current feel-tests flag the rig's *animation* as limiting, or the *silhouette/mesh quality*?** Procedural-push prioritizes the latter; animation-only retarget addresses the former at lower cost. User feedback should drive the fork.

2. **If multiplayer lands as co-op 4+, what player count is the hard limit before glTF serialization becomes necessary?** Procedural skeletons can scale to 8+ players if bone arrays are efficient; glTF becomes clearer if >16-player or cross-device sync is required.

3. **Is the "zero-asset pillar" a hard constraint or a design preference?** Animation-only retarget is philosophically defensible ("animation is data") but feels adjacent to breaking the pillar. Clarify with the owner whether animation imports are acceptable.

4. **What's the priority: visual upgrade, or animation quality/quantity?** These drive fork choice. Procedural mesh improvements (IK, better cloth simulation, sharper edges) compete with animation polish (more clips, smoother transitions, contextual blending).

## Sources

- [THREE.IK GitHub](https://github.com/jsantell/THREE.IK) — FABRIK inverse kinematics for three.js; FABRIK solver, multiple chains/effectors, constraints; development inactive since 2020
- [THREE.IK documentation](https://jsantell.com/three-ik/) — FABRIK algorithm details, practical use cases (limb placement), baseline library status
- [HumanoidProceduralAnimation GitHub](https://github.com/lchaumartin/HumanoidProceduralAnimation) — fully procedural humanoid animation project; 113 stars
- [Avatar.lab GitHub](https://github.com/lo-th/Avatar.lab) — human avatar and animation framework for three.js; sea3d format support
- [Mixamo → glTF workflow by Don McCurdy](https://www.donmccurdy.com/2017/11/06/creating-animated-gltf-characters-with-mixamo-and-blender/) — standard pipeline: Mixamo FBX → Blender → glTF 2.0 export
- [vrm-mixamo-retargeter GitHub](https://github.com/saori-eth/vrm-mixamo-retargeter) — lightweight retargeting library; auto height scaling, custom bone mapping, Mixamo → VRM pattern
- [Rokoko retargeting guide](https://www.rokoko.com/insights/ace-retargeting-in-blender-with-this-simple-workflow-i-the-ultimate-retargeting-guide) — step-by-step Blender retargeting; iterative refinement with IK controls
- [Quaternius free 3D assets](https://quaternius.com/) — 40k+ CC0 rigged models; game-ready, low-poly, all genres
- [Kenney.nl assets overview](https://gamefromscratch.com/quaternius-free-3d-assets/) — Kenney.nl: 40k CC0 assets, commercial use, no attribution
- [Free game assets guide](https://app.cinevva.com/guides/game-assets-guide) — Poly Pizza, Kenney, Quaternius comparison; CC0 licensing
- [Low-poly game art visual quality guide](https://pixune.com/blog/low-poly-game-art-guide/) — silhouette legibility, consistent style, procedural generation efficiency
- [Ready Player Me: What is Ready Player Me](https://docs.readyplayer.me/ready-player-me/what-is-ready-player-me) — glTF avatar URLs, <1-day integration, free, cross-game persistence
- [Ready Player Me multiplayer setup](https://docs.readyplayer.me/ready-player-me/integration-guides/unity/setup-multiplayer) — multiplayer templates, Photon/Netcode support, avatar serialization
- [Three.js retargeting forum](https://discourse.threejs.org/t/retargeting-animation-to-mixamo-rig/6172) — community discussion on retargeting Mixamo to custom rigs
- [three-skeletor GitHub](https://github.com/AGoblinKing/three-skeletor) — TypeScript IK library; FABRIK-based, modern port of THREE.IK
- [Procedural animation concepts](https://kreonit.com/services/procedural-animation-2/) — overview of procedural animation use (particle systems, cloth, character animation)
- [Procedural walk cycle research](https://nccastaff.bournemouth.ac.uk/jmacey/MastersProject/MSc22/01/ProceduralCreatureGenerationandAnimationforGames.pdf) — procedural creature generation + animation; genetic algorithms, physics simulation
- [Low-poly multiplayer avatar design](https://game-ace.com/blog/low-poly-models/) — silhouette-first approach, polygon efficiency, multiplayer readiness
