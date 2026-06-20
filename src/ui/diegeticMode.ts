// M6 ④ (C40) — single source of truth for whether DIEGETIC SURVIVAL mode is active:
// the compile-time `FEATURES.diegeticSurvival` master flag AND the player's pause-menu
// opt-in (`settings.diegeticSurvival`, default-ON when the flag is on). Set by
// menus.applySettings on boot + on every settings change; read by `hud.ts` (hide the
// stat bars) and `statVignette.ts` (gate the heat/hunger/low-health tells + audio).
//
// A tiny shared module so neither `hud` nor `statVignette` has to import `menus`
// (which would be a heavy/circular dependency) just to learn the effective mode.

let _active = false;

/** Set the effective diegetic-survival state (flag AND player opt-in). */
export function setDiegeticActive(active: boolean): void {
  _active = active;
}

/** True when the HUD stat bars are hidden and survival is felt via diegetic tells. */
export function isDiegeticActive(): boolean {
  return _active;
}
