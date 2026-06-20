// ACBE (D1) — procedural black-box log generator. Keyed on (seed, role) so each crash's
// recovered flight recorder tells a short, distinct, evocative final story: who they were,
// what failed, what they carried, and the aftermath. Tone: Long-Dark / Dune restraint —
// NO bodies. The crew is GONE — evacuated, scattered, walked off into the dunes — implied
// through the log + the empty flight-suits left in the hull, never a corpse.

import type { JournalContent, JournalEntry } from './journal.ts';
import { makeRng } from '../core/rng.ts';
import type { CrashRole } from './meteorCrash.ts';

interface RoleLore {
  title: string;
  ships: string[];
  authors: string[];   // "<role> <name>"
  cargo: string[];
  cause: string[];     // what went wrong
  end: string[];       // the crew's fate (aftermath — no bodies)
  last: string[];      // the author's final line
}

const LORE: Record<CrashRole, RoleLore> = {
  freighter: {
    title: 'CARGO RECORDER',
    ships: ['the Dusthauler', 'the Long Ledger', 'bulk-tug Ovrik', 'the Saltwind', 'freighter Mell-9'],
    authors: ['cargo-master Renn', 'loadmaster Visse', 'first mate Otho', 'quartermaster Dell'],
    cargo: ['salt-flour and seed-stock', 'scrap alloy and water cells', 'ore drums bound for the relay', 'bonded machine parts, all sealed'],
    cause: ['the portside engine flamed out and never relit', 'we lost the heading computer in the storm wall', 'a coolant line let go over the deep dunes'],
    end: ['the crew took the lifeboat at altitude — the manifest says all but me got clear', 'I waved the others down the ramp before she rolled; their tracks went south', 'we set down hard but whole, and they walked for the relay at first light'],
    last: ['if you are reading this, the cargo is yours — I have no more use for a ledger', 'there is water on the flats if you walk far enough. take what you can carry.', 'I am going to follow their tracks while there is still light'],
  },
  liner: {
    title: 'PASSENGER LOG',
    ships: ['the Meridian Star', 'liner Aubretia', 'the Cassiel', 'passenger-clipper Wren'],
    authors: ['purser Halid', 'steward Marn', 'flight attendant Ceyle', 'the ship steward'],
    cargo: ['ninety souls and their luggage', 'a wedding party, bound coreward', 'forty passengers and a hold of mail', 'a colony charter and its families'],
    cause: ['cabin pressure failed across the upper deck', 'the storm took both starboard fans', 'we struck debris and lost the forward trim'],
    end: ['we walked them out through the breach in twos; the last of them made the ridge by dusk', 'the passengers shed their flight-suits and went on foot for the rocks', 'they took the water and the children and left — I stayed to log it'],
    last: ['the seats are empty now and the wind sits in them', 'I kept everyone calm. that was the whole of my job, and I did it.', 'tell them the steward stayed until the cabin was empty'],
  },
  military: {
    title: 'COMBAT RECORDER',
    ships: ['patrol cutter Inflictor', 'the Vael Resolute', 'gunship Harrow', 'corvette Stane'],
    authors: ['cmdr. K. Selene', 'lt. Ardo', 'gunnery chief Pell', 'the watch officer'],
    cargo: ['a weapons locker and sealed ordnance', 'patrol rations and a munitions rack', 'a prisoner manifest, since voided', 'sidearms, ammo, and field kit'],
    cause: ['maincore went down and the backup with it', 'we were holed amidships and bled the reactor', 'the helm locked over and would not answer'],
    end: ['the squad bailed to the surface and formed up east — orders were to scatter and regroup', 'I sent them out armed and in pairs; the rendezvous was the far ridge', 'crew abandoned to the dunes on my command. good crew. wrong orders.'],
    last: ['the record will show it was not the enemy that took us down', 'lock the armory behind you. some things should stay buried out here.', 'a soldier obeys. that is the comfort and the curse of it.'],
  },
  science: {
    title: 'RESEARCH RECORDER',
    ships: ['survey vessel Thale', 'the Quiet Ledger', 'research barque Orrin', 'the Sable Iris'],
    authors: ['dr. Ferris', 'field-lead Okonkwo', 'specimen officer Vey', 'the chief researcher'],
    cargo: ['sealed sample cases and a core drill', 'instrument arrays and a data vault', 'a live specimen hold, now cold', 'survey charts and a relic, catalogued'],
    cause: ['an instrument fire spread to the trim controls', 'the storm fried the navigation suite', 'we overflew the search window and ran the tanks dry'],
    end: ['the team grabbed the data vault and went overland for the relay', 'they took the samples and left the ship to the sand', 'the others struck out at dawn — I stayed to seal the find'],
    last: ['the find is in the aft case. it was worth the crossing. it was not worth this.', 'whatever we pulled from the deep flats, leave it where it lies', 'forty years a scientist. the desert keeps better records than I do.'],
  },
  mining: {
    title: 'RIG RECORDER',
    ships: ['the drill-tender Bohr', 'mining rig Cudgel', 'the Ore-Mother', 'extractor Hask'],
    authors: ['rig-boss Tam', 'driller Oksana', 'shift-lead Burrow', 'the rig foreman'],
    cargo: ['a full hopper of raw ore', 'cutting heads and fuel rods', 'a strike worth of refined metal', 'the drill string and spare bits'],
    cause: ['a fuel cell ruptured in the engine bay', 'the storm clogged the intakes and we starved', 'the drill rig shifted in flight and tore the spine'],
    end: ['the crew rode the cargo sled down and made for the flats', 'they cut the ore loose and walked, light, for the rocks', 'I sent the shift out on foot; I keep the rig until the fires die'],
    last: ['the ore is in the hopper. it cost more than it will ever buy.', 'a strike like this, and the desert takes it back anyway', 'I have dug a thousand holes. funny, to be buried in this one.'],
  },
};

export function generateCrashLog(seed: number, role: CrashRole): JournalContent {
  const L = LORE[role] ?? LORE.freighter;
  const rng = makeRng((seed ^ 0x5c0f1a) >>> 0);
  const pick = (arr: string[]): string => arr[Math.floor(rng() * arr.length)] ?? arr[0];
  const ship = pick(L.ships);
  const author = pick(L.authors);
  const entries: JournalEntry[] = [
    ['LOG OPEN', `${ship}, on the long crossing. all nominal. ${pick(L.cargo)} aboard.`],
    ['FAULT', `${pick(L.cause)}.`],
    ['DESCENT', 'no thrust, some control. putting her down on the flats. recorder running.'],
    ['AFTER', `${pick(L.end)}.`],
    ['RECORDER ENDS', pick(L.last)],
  ];
  return { title: L.title, subtitle: `${author} — ${ship}`, entries };
}
