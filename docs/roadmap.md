# Roadmap

Next sessions in execution order. One-liner each + terse scope notes.
Detailed plans live in `.claude/plans/<session>.md` while active; on ship
they're archived + summarised in [changelog.md](changelog.md).

When done with a session, the `/session-end` skill removes the "Next" entry
and promotes the second.

---

## Next — N: Rigged Quaternius raider + animations (~5h)
Replace the primitive cloak/hood raider with a rigged GLTF (Quaternius
"Animated Characters" pack, CC0). GLTFLoader infra exists from Session B.
`SkeletonUtils.clone()` per raider; `AnimationMixer` per instance crossfades
`idle / walk / run / attack / die`. Hit detection unchanged. Preserve the
`Raider.id` field added in M.

## Then — O: Enemy variety + win condition (~7h)
Scout / Ambusher / Brute raider variants + warlord camp at the radio tower
+ satellite-phone signal endgame. Unblocks balance tuning + GOD_MODE off.

## Then — Q2: Rigged hands + lizard + windup attacks (~5h)
Depends on N. Replaces primitive hands viewmodel with rigged hands;
rigs the lizard; multi-keyframe attack windup frames for raiders.

## Later — R: Additional gameplay loops (1–2 picks at ~4–7h each)
Trading, base-building, vehicle, 7-day storm countdown, bounties.
Pick 1–2 based on what feels missing post-O.

---

## Continuous polish (interleaved between numbered sessions)
- Environmental: dust motes in light beams, footprint puffs, distant cloud
  bank, mirage shader on salt-flat biome.
- Audio: ambient bird calls during day, insect chitter at night, distant
  wind howl when sandstorm builds.
- HUD micro-polish: low-stat warning vignettes (cold = blue tint, thirst =
  brown), interact-prompt fade, low-stamina screen wobble.
- Crosshair feedback: thicken on interactable, red on enemy.
