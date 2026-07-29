// Journal panel (Session W) — modal lore overlay shown when the player
// presses E on a journal interactable. Session ABF extended to support
// per-POI journal kinds — the same panel renders different entries
// depending on which journal was opened, so each flagship gets its own
// narrator voice without duplicating panel DOM.
//
// Follows the controls-panel pattern from tutorial.ts: a fullscreen
// overlay div with title + entries + close button. Built once at boot
// (createJournalPanel); the dynamic content (title, subtitle, entries)
// is REBUILT each time openJournalPanel(ctx, kind) fires.
//
// While open, the game pauses (controls.unlock → pause overlay shows
// underneath); the panel sits above via the existing overlay z-index.
// Esc and the close button both close.

import type { GameContext } from '../GameContext.ts';
import type { JournalKind, JournalContent } from '../world/journal.ts';
import { playUiHover, playUiClick } from '../audio/audio.ts';

// Session W — original opening-wreck journal. Anonymous survivor in the
// W-era story prop. Stays as the default kind so existing behavior is
// unchanged.
const OPENING_CONTENT: JournalContent = {
  title: 'JOURNAL',
  subtitle: 'pages from the previous survivor',
  entries: [
    ['DAY 1',  'wreck spotted across the dunes. dust in the eyes. I crawled inside.'],
    ['DAY 4',  'the salt-flats have wells. taste like rust. it is water.'],
    ['DAY 11', 'saw a man with a blade walking south. did not follow.'],
    ['DAY 16', 'ate a fruit from the blue cactus. should not have. fever for two days.'],
    ['DAY 17', 'the storm has not stopped. I am —'],
  ],
};

// Session ABF — per-POI journals. Each is a distinct voice, deliberately
// kept short (4-6 entries) so the player can read in 30-60 seconds. The
// narrators only loosely overlap so the player builds a mental map of
// which crashed group landed where.

// megaShip cargo handler — technical, "left behind by the lifeboat"
const MEGA_SHIP_CONTENT: JournalContent = {
  title: 'CARGO LOG',
  subtitle: "logistics officer's notes — Yardline Freight",
  entries: [
    ['SHIPDAY 47', 'engines flamed out two days out from the relay. captain says we drift to ground.'],
    ['SHIPDAY 49', 'we are down. nobody upstairs answering. lifeboat ejected at altitude — manifest says everyone but me made it.'],
    ['SHIPDAY 51', 'I am owed three months back pay. the company will not honor it. I logged the cargo regardless.'],
    ['SHIPDAY 58', 'the cargo is salt-flour and seed. nobody is coming back for it.'],
    ['SHIPDAY 64', 'wells exist on the flats if you walk far enough. cooked a lizard tonight.'],
    ['SHIPDAY ??', 'pages stop here'],
  ],
};

// megaWreck captain — terse military ship's log, last hours
const MEGA_WRECK_CONTENT: JournalContent = {
  title: "CAPTAIN'S LOG",
  subtitle: 'cmdr. K. Selene — INV Inflictor',
  entries: [
    ['STARDATE 4471.6', 'hull integrity 88%. proceeding to the planetary search grid as ordered.'],
    ['STARDATE 4472.1', 'unauthorized weapons discharge in the aft bay. two crew dead. responsible party in confinement.'],
    ['STARDATE 4472.4', 'maincore down. backup down. we are falling. crew to the bow.'],
    ['STARDATE 4472.5', 'impact in ninety seconds. I write this so the record shows who took us out: it was not the enemy.'],
    ['STARDATE 4472.5', 'good crew. wrong orders.'],
  ],
};

// satelliteDish radio operator — anxious, signal-loss
const SATELLITE_DISH_CONTENT: JournalContent = {
  title: 'OPERATOR NOTES',
  subtitle: "relay-station radio operator — call sign 'WREN'",
  entries: [
    ['T+0',   'station receiving. dish aligned to the orbital window. nominal.'],
    ['T+18d', 'storm started. signal scratches at the edges but holds.'],
    ['T+42d', 'storm has not stopped. relay is being buried. dish slipping out of alignment.'],
    ['T+71d', 'last carrier wave I heard was twelve days ago. I am calling and calling.'],
    ['T+90d', 'they are not coming.'],
  ],
};

// crashedHull pilot — calm fatalism, knew he was going down
const CRASHED_HULL_CONTENT: JournalContent = {
  title: "PILOT'S NOTEBOOK",
  subtitle: 'an old ship — older pilot',
  entries: [
    ['PRE-IMPACT', 'wing assembly compromised over the eastern dunes. I have descent control but no thrust.'],
    ['PRE-IMPACT', 'I told the kid to take the pod. he refused. so the pod left empty and we are both in the hull.'],
    ['POST-IMPACT D1', 'kid did not make it. I covered him with the foil sheet from the survival kit.'],
    ['POST-IMPACT D3', 'I have walked the perimeter of where we landed. it is empty for as far as I can see.'],
    ['POST-IMPACT D9', 'I have been a pilot for forty-one years. this is a fine place to stop.'],
  ],
};

// engineBlock engineer — technical → fearful, thermal runaway
const ENGINE_BLOCK_CONTENT: JournalContent = {
  title: 'MAINTENANCE LOG',
  subtitle: 'chief engineer — propulsion deck',
  entries: [
    ['CYCLE 1208', 'core temp creeping 4° above nominal. recalibrated the secondary coolant loop. expecting normal next watch.'],
    ['CYCLE 1209', 'temp still creeping. primary loop pressure is fine. shielding is fine. it has to be the injector.'],
    ['CYCLE 1212', 'I cannot find what is wrong. captain wants answers. I do not have any.'],
    ['CYCLE 1214', 'chamber breach in less than two minutes. I am writing this from the bell-deck access. the rest of the crew is already at the lifeboats.'],
    ['CYCLE 1214', 'I stayed because if I had left when it started maybe none of this would have happened. I owe them.'],
  ],
};

// ACBE (D1) — crash black boxes carry PER-INSTANCE procedural text (crashLog.ts), passed to
// openJournalPanel; this is only the safety default if a crash journal somehow has no content.
const CRASH_LOG_FALLBACK: JournalContent = {
  title: 'FLIGHT RECORDER',
  subtitle: 'recovered black box — data corrupted',
  entries: [['—', 'the recorder is scorched through. nothing legible remains.']],
};

// DEEPER cycle 12 — the dead explorer underground. A salvager who went down a warren
// and did not come back up. Written so each entry quietly teaches ONE true thing about
// caves without ever instructing the player or addressing them: the cold that never
// kills (cycle 11's clamped cave cold), the water that never runs out (cycle 6's pools),
// and the light budget as the real clock (cycle 11's lanterns). No cause of death is
// stated, nobody is named, nothing is addressed to the reader — the arrangement of the
// body tells the story and this is the reward for having read it.
const CAVE_EXPLORER_CONTENT: JournalContent = {
  title: 'SURVEY NOTEBOOK',
  subtitle: 'left where they sat down',
  entries: [
    ['DAY ONE',  'rope fast at the mouth, forty feet down to the first floor. it is cold in here. not the kind that kills you — the kind that just never lets up. four days of oil. three days of work.'],
    ['DAY TWO',  'standing water in the third room. black and flat and it does not move at all. drank it, filled both flasks, waited. fine. that is the only thing down here that is not running out.'],
    ['DAY FOUR', 'lost a day. there is always another room past the one you are in, and the next one is always bigger. I keep saying I will turn back at the next one.'],
    ['DAY SIX',  'last of the oil. been walking it dark with a hand on the wall, counting. forty steps from the water to the fallen roof. ninety from there to the slope. I know the way out. I just need the light for the last of it.'],
    ['—',        'sat down to rest a while. the dark down here is not like night. night has a shape to it.'],
  ],
};

const CONTENT_BY_KIND: Record<JournalKind, JournalContent> = {
  opening: OPENING_CONTENT,
  mega_ship: MEGA_SHIP_CONTENT,
  mega_wreck: MEGA_WRECK_CONTENT,
  satellite_dish: SATELLITE_DISH_CONTENT,
  crashed_hull: CRASHED_HULL_CONTENT,
  engine_block: ENGINE_BLOCK_CONTENT,
  crash_log: CRASH_LOG_FALLBACK,
  cave_explorer: CAVE_EXPLORER_CONTENT,
};

let _ctx: GameContext | null = null;
let _panel: HTMLDivElement | null = null;
let _titleEl: HTMLDivElement | null = null;
let _subtitleEl: HTMLDivElement | null = null;
let _entriesEl: HTMLDivElement | null = null;
let _open = false;

function buildPanel(): HTMLDivElement {
  const panel = document.createElement('div');
  panel.id = 'journal-panel';
  panel.className = 'overlay hidden';

  const title = document.createElement('div');
  title.className = 'title small';
  title.textContent = 'JOURNAL';
  panel.appendChild(title);
  _titleEl = title;

  const subtitle = document.createElement('div');
  subtitle.className = 'subtitle';
  subtitle.textContent = '';
  panel.appendChild(subtitle);
  _subtitleEl = subtitle;

  // Session ABF — entries container; rebuilt per openJournalPanel call so
  // each journal kind can render its own narrator's pages without
  // duplicating panel DOM.
  const entries = document.createElement('div');
  entries.className = 'journal-entries';
  panel.appendChild(entries);
  _entriesEl = entries;

  const closeBtn = document.createElement('button');
  closeBtn.className = 'menu-btn';
  closeBtn.textContent = 'close';
  closeBtn.addEventListener('mouseenter', playUiHover);
  closeBtn.addEventListener('click', () => {
    playUiClick();
    closeJournalPanel();
  });
  panel.appendChild(closeBtn);

  return panel;
}

function renderContent(content: JournalContent): void {
  if (!_titleEl || !_subtitleEl || !_entriesEl) return;
  _titleEl.textContent = content.title;
  _subtitleEl.textContent = content.subtitle;
  // Clear existing entries (rebuild — entry counts vary per kind).
  while (_entriesEl.firstChild) _entriesEl.removeChild(_entriesEl.firstChild);
  for (const [date, body] of content.entries) {
    const row = document.createElement('div');
    row.className = 'journal-entry';
    const d = document.createElement('div');
    d.className = 'journal-date';
    d.textContent = date;
    const b = document.createElement('div');
    b.className = 'journal-body';
    b.textContent = body;
    row.appendChild(d);
    row.appendChild(b);
    _entriesEl.appendChild(row);
  }
}

export function createJournalPanel(ctx: GameContext): void {
  _ctx = ctx;
  _panel = buildPanel();
  document.body.appendChild(_panel);
  // Default-render the opening content so a stray show without kind still
  // displays something. openJournalPanel rebuilds on each open anyway.
  renderContent(OPENING_CONTENT);

  // Esc closes the journal panel from anywhere. Lives on window so it
  // fires whether the pointer is locked or not.
  window.addEventListener('keydown', (e) => {
    if (!_open) return;
    if (e.code !== 'Escape') return;
    e.preventDefault();
    closeJournalPanel();
  });
}

/** Session ABF — second arg picks which journal's entries to render.
 *  Defaults to 'opening' so legacy single-arg callers (e.g. anything
 *  pre-ABF that hadn't been updated) still see the original survivor
 *  journal. */
export function openJournalPanel(ctx: GameContext, kind: JournalKind = 'opening', content?: JournalContent): void {
  if (!_panel || _open) return;
  _open = true;
  // ACBE — a per-instance `content` (a crash black box's procedural log) overrides the
  // fixed per-kind entries.
  renderContent(content ?? CONTENT_BY_KIND[kind]);
  // ABJ — C2 (v11): mark this kind as read. The HUD's hover prompt reads
  // ctx.inventory.journalReadKinds to dim already-read entries (persisted v11+). Skip for
  // crash_log: each crash's black box is unique, so a per-KIND read-flag would wrongly dim
  // every future crash after the first is read (per-instance read-state is Tier-4 save work).
  if (kind !== 'crash_log') ctx.inventory.journalReadKinds.add(kind);
  ctx.input.controls.unlock();
  _panel.classList.remove('hidden');
}

export function closeJournalPanel(): void {
  if (!_panel || !_open) return;
  _panel.classList.add('hidden');
  _open = false;
  if (_ctx && _ctx.flags.started && !_ctx.stats.dead) {
    void import('./menus.ts').then((m) => m.resumeFromPause());
  }
}

export function isJournalPanelOpen(): boolean {
  return _open;
}
