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

// M7-R (2026-07-13, user) — the SKYFALL freighter's captain's log tells a specific
// story: the captain ordered the crew to EVACUATE IN THE DROP PODS as she went down,
// then rode her down alone. Same Long-Dark/Dune restraint — NO bodies; the captain's
// fate is left to the sand (the empty pods fell west; the wreck is what's left). The
// drop-pod evac echoes the player's own crashed pod — the world telling you what
// happened by what it left behind. Reuses the freighter flavor (ships/cargo/cause) +
// bespoke captains + evac beats. Deterministic per seed.
const SKYFALL_CAPTAINS = ['captain Vharo', 'master Idris', 'old captain Sel', 'the master, Renwick', 'captain Oduya'];
const SKYFALL_LAST = [
  'if you found the pods first, tell the crew the old ship set them down gentle — then take what you like from her. she is done carrying.',
  'there is a canteen in the aft locker and a long walk west, if you have the legs. that is the way the pods fell.',
  'I brought her down whole and clear of them. that was the last thing I owed this crew. the desert can have the rest.',
  'six pods, six good hands, all away before she hit. a captain could ask for a worse last count.',
];
export function generateSkyfallLog(seed: number): JournalContent {
  const F = LORE.freighter;
  const rng = makeRng((seed ^ 0x5c1fa1) >>> 0);
  const pick = (arr: string[]): string => arr[Math.floor(rng() * arr.length)] ?? arr[0];
  const ship = pick(F.ships);
  const captain = pick(SKYFALL_CAPTAINS);
  const entries: JournalEntry[] = [
    ['LOG OPEN', `${ship}, heavy on the long crossing. ${pick(F.cargo)} in the holds, all sealed. a dull run — the way I like them.`],
    ['FAULT', `${pick(F.cause)}. she is losing the sky and will not answer the helm. coming down on the flats, and coming down hard.`],
    ['EVAC ORDER', 'gave the order every captain dreads: all hands to the drop pods. I counted them off the rack myself — pod by pod, hand by hand — and watched them light and fall away west, small as sparks against the dust.'],
    ['ALONE AT THE HELM', 'the pods are gone and the cabin has gone quiet. someone rides her down so she lands clean and does not chase the crew across the sand. the chair is mine. it always was.'],
    ['RECORDER ENDS', pick(SKYFALL_LAST)],
  ];
  return { title: 'CARGO RECORDER', subtitle: `${captain} — ${ship}`, entries };
}
