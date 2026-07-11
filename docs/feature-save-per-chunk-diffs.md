# Feature slice — S5: per-chunk save diffs (SAVE_VERSION 16 → 17)

**Status: ⏸ AWAITING HUMAN APPROVAL (the campaign's ONE sanctioned pause — D81: never ship an
unreviewed migration).** Written cycle 6, 2026-07-11. Review this + walk the world, then
`/campaign-approve` releases the build (one cycle).

## Goal
Player changes to the INFINITE field persist: strip a far wreck, save, reload → still stripped.
Today every streamed content class is save-TRANSIENT (D292 — regenerates pristine); the origin
world persists exactly as before. S5 adds a SPARSE diff layer over the deterministic base:
a chunk with no diff costs nothing and regenerates pristine.

## The design in one paragraph
A new optional save field `chunkDiffs` maps `"cx,cz"` → the chunk's deviations from its
descriptor-pristine state. Content inside a chunk is addressed by a STABLE within-chunk
CONTENT ID derived from the descriptor/render order (D290/D296 — deterministic per seed), never
by runtime registry ids (the D292 trap: visit-order ids mis-patch on reload). Diffs are captured
on chunk unload + at save time, applied on chunk load after render. Old saves have no field →
empty map → today's exact behavior (zero-loss, no migration pass).

## Schema (v17 — additive; the bump marks the semantic epoch the charter promised)
```ts
// SaveV1 gains:
chunkDiffs?: {
  [chunkKey: string]: {            // "cx,cz" — only MODIFIED chunks appear
    salvage?: {
      [contentId: string]: {       // see Content IDs below
        remaining: number;
        stripped: boolean;
        extracted: number[];       // hidden panelComponents indices (WYSIWYG, mirrors v16)
      };
    };
    fauna?: { looted: string[] };  // contentIds of looted lizards/shrews
  };
};
```
`SAVE_VERSION = 17`. Loader range check (`save.ts:738`) already accepts 1..SAVE_VERSION — v16
and older load unchanged. Seed binding (`save.seed === ctx.seed`) already rejects cross-world
saves; chunk diffs inherit that guarantee.

## Content IDs (the load-bearing rule)
Registration order within a chunk is deterministic (each piece renders from its own
descriptor-derived seed — D296), so:
- The chunk's rolled POI wreck → `poi`; its salvage panels in registration order → `poi/0`,
  `poi/1`, …
- Landmark knot wrecks → `lm/0..2` with panels `lm/0/0`…; the colossal ribcage has no state.
- Fauna → `fauna/l0..l1`, `fauna/s0..s1` (descriptor array order).
- Rocks / wordless scenes / markers: STATELESS — never persisted.
A diff entry whose contentId doesn't resolve after a future content update is DROPPED silently
(count logged) — the descriptor is the authority, the diff is a patch on it.

## Capture / apply points
- **Capture on `unloadChunk`**: snapshot each transient salvageable's
  `{salvageRemaining, stripped, extractedIndices}` + looted fauna contentIds into a runtime
  `ctx.chunkDiffCache: Map<string, ChunkDiff>`. Entries equal to pristine are dropped (sparse).
- **Capture at `saveGameState`**: serialize the cache PLUS a direct snapshot of currently-loaded
  chunks (they haven't unloaded yet).
- **Apply on `loadChunk`**, after render: look up the diff, patch salvage records (reuse the v16
  apply shape — cap remaining, hide extracted components, apply stripped desaturation), despawn
  looted fauna before they spawn (skip their spawn thunk).
- **On load-game**: `chunkDiffCache` rebuilds from `save.chunkDiffs`; on new-game it starts empty.
- The D292 `transient` filters STAY — streamed content remains excluded from the global id-keyed
  arrays; the per-chunk diff is its dedicated channel.

## What v1 deliberately excludes (each with the reason)
- **Scrap-debris rings at streamed wrecks** (still not spawned): pickups persist via the global
  id-keyed survivor set; folding them into chunk diffs needs descriptor-derived pickup ids — a
  contained v2 on top of this schema. REC: defer.
- **Fauna positions/states** beyond looted: ambient wildlife re-rolling fresh reads fine.
- **Landmark/wreck existence changes**: nothing destroys wrecks today.

## Verification plan (the build cycle's gates)
- Extend `chunk-streaming`: a PERSISTENCE leg — strip a far panel (drive the real extract path),
  walk home (unload), walk back → assert still-stripped with the exact extracted set; save at
  the far point → parse the file → `chunkDiffs` contains EXACTLY the modified chunk (sparse);
  reload-boot round-trip: the origin world byte-exact (existing asserts) + the far diff re-applies
  after a REAL page reload (the pod-persistence-reload scenario pattern).
- All existing gates stay green (placement/colliders/determinism/perf untouched by design —
  diffs never feed generation).

## Open questions (recommendation first)
1. **Bump to 17 vs stay 16-with-optional-field?** REC: bump — the charter promised it, and the
   epoch marker is cheap insurance for future loaders. (Both are backward-safe.)
2. **Scrap rings in v1?** REC: no (above). Say the word and it becomes a v1 line item.
3. **Diff-map growth cap?** REC: none in v1 — one entry per modified chunk is player-bounded;
   if a save ever exceeds ~1MB, add FIFO eviction of farthest-from-player entries (D-entry then).
4. **Persist looted fauna at all?** REC: yes (cheap, prevents "loot the same wreck-lizard every
   re-visit" farming); alternatively drop `fauna` from v1 for an even smaller diff.

## Build estimate
One cycle: save.ts (field + version bump + load wiring), chunkManager (capture/apply + content-id
plumbing + the fauna-thunk skip), GameContext (`chunkDiffCache` slot), the probe persistence leg.
No new art, no new systems.
