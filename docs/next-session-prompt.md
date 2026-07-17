# Next session — the campaign is PAUSED awaiting Zach's economy approval

**State:** campaign "Scavenger's Economy (setup)" **paused** on `campaign/2026-07-17-economy`
(4/16 cycles, ~1.0M/6M). `awaiting_approval: true`, `stop_reasons: ["milestone-review"]`.
**Do not build anything until the approval is given.**

## Read first
1. `docs/campaign/morning-summary-2026-07-18.md` — what shipped overnight + what needs eyes.
2. `docs/campaign/economy-proposal.md` — the decision sheet (Q1-Q6 with defaults + the 5-cycle
   build ladder in §7).

## On approval (`/campaign-approve`, then `/loop /campaign-cycle`)
Run the §7 ladder in order, one cycle each, gates as listed:
1. Loot-registry unification (LOOT-PRESERVING; 1000-roll digest old=new is the gate).
2. The 4 ItemIds + pickup meshes + ground scatter.
3. The drop matrix live + hero-wreck richness.
4. The 8 new recipes + discovery auto-unlock + UX-S items.
5. Balance pass + walk-test prep + morning summary.
Honor any Q1-Q6 edits Zach gives at approval; unanswered = the proposal's defaults.

## Standing rules (unchanged)
Fable plans / Opus executes (subagent `model: opus`) · one code-writing agent at a time · never
`git stash` here · push HELD (commit to the campaign branch; master untouched) · trust the
playtest over a green gate · new materials are ADDITIVE-ONLY save-wise.
