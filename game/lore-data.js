'use strict';

/**
 * Static lore seed data (shape only for now; actual content lives in lore_entries table).
 * Extracted to break circular dependency between game/config.js and game/lore.js.
 * Used as fallback + by db schema seed guard.
 */
const LORE_SEED = {
  high_elf: [],
  dwarf: [],
  dire_wolf: [],
  human: [],
  dark_elf: [],
  orc: [],
  vampire: [],
  narmir: [],
  general: []
};

module.exports = { LORE_SEED };
