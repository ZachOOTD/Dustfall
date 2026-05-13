# Models directory

Drop CC0 GLB files here to auto-replace the primitive geometry.

## Kenney "Survival Kit" (recommended for props)

Download from <https://kenney.nl/assets/survival-kit> (free, CC0).
Extract `.glb` files into `public/models/kenney/` and rename to match
`src/assets/manifest.ts`:

```
public/models/kenney/
  rock_small_a.glb
  rock_small_b.glb
  rock_large_a.glb
  rock_large_b.glb
  dead_tree_a.glb
  dead_tree_b.glb
  wreckage_car_a.glb
  wreckage_barrel.glb
  mesa_a.glb
  canteen.glb
```

Anything missing falls back silently to the existing primitive — gameplay still works with no assets installed.

## Quaternius character (for Session D's raider)

Download from <https://quaternius.com/packs/ultimateanimatedcharacters.html>
(CC0). Place at `public/models/quaternius/raider.glb`. Must include `idle`,
`walk`, `run`, `attack`, `die` animation clips (or be retargeted to those
names in Blender).
