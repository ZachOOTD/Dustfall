# Campaign DEEPER — CHECKPOINT: hazard-spec-review (paused for Zach, 2026-07-28)

**Cycle 9 SHIPPED.** `verify:all` green end-to-end + all 24 chunk legs green (gate of record:
`verification/gate-logs/20260728T083350Z-SUMMARY.txt`, 54m50s). Tree clean, push HELD.
9/20 cycles, **~9.15M / 10M soft ceiling**.

## What Zach reviews at this checkpoint

1. **[hazard-spec.md](campaign/hazard-spec.md)** — Q1-Q10, each with a recommended default.
   The headline recommendations: rockfall + deep-cold + non-lethal foul air build unattended
   (conservative, telegraphed, survivable); foul-air lethality ships as a zero'd number you
   flip; false floors DEFERRED (no fall-damage system exists; drops break the walk-gate tree
   invariant); fungal cavern = the safe kind; canonical caves hazard-free.
   `/campaign-approve` (or `--with-changes`) releases the hazards build.
2. **The budget ceiling** — the remaining ladder (hazards → light budget → return reason →
   integration) does not fit in ~0.85M. Raise it (`/campaign-start --resume --budget-total=N`)
   or scope-cut the tail per the charter's order (11 → 10 → 8-drop-a-kind → 9-deferred).
3. **THE REPAIR DESCENT WALK-TEST** — still owed; now judges everything cycles 6-9 built:
   pools + jerrycan, the interior rendering overhaul, the crevice entrance (horn/roof/teeth),
   caves-at-density, the four kinds. Motion-feel items stills can't judge: pool ripple/glint
   movement, bounce flicker, dither crawl, the tor arrival hitch (~155-200ms), flooded-cave
   audio. Feedback → `steering.md` same-day per the standing rule.

## Parked decisions (full list in the cycle-9 log entry)

Canonical speleothem knife-tips (digest re-baseline) · pocket-9 wedge trap + floorOk margin +
the seed-7 marginal pocket (digest-moving) · the shaft collapse-skylight (spec Q9) · kind
taste dials (`CAVE_KIND_WEIGHTS`, warren `scrapPerCave 6`) · `CAVE_SITE_CHANCE 0.60`
(~3.0-3.2 caves/travel-hour measured) · sun/moon discs through kind-cave roofs (queued
cycle 10) · jerrycan/pool balance · ~20 CAVE_*/CREVICE_* dials · swiftshader rock cost.

## Standing rules (unchanged)

Fable plans / Opus executes · one code-writing agent at a time · push HELD · SPEED RULES +
EFFICIENCY WATCH (gate suite ~55 min with march legs quiet — verdict integrity over the 35-min
target; `--legs=` for iteration; full suite once per cycle; poll-to-completion for gate
runners; probe the pixels before trusting a critique's builder attribution) · NO creature
underground · D290 · trust the playtest over a green gate.
