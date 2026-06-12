// Shared defense helpers — used by combat resolution AND by magic spells
// that deal building damage. Lives in lib so magic.js can import it
// without pulling in engine.js (which would create a circular dep when
// engine itself imports magic).

const { safeJsonParse } = require("../../utils/helpers");

// Master Mason Sigil (library upgrade) resists spell/warmachine damage to
// buildings. Returns a multiplier in [0.5, 1.0]:
//   - No sigil:            1.0 (full damage)
//   - Sigil only:          0.75
//   - Sigil + blueprints:  0.50
function getMasonSigilResist(k) {
  const upg = safeJsonParse(k.library_upgrades, {}, "auto:library_upgrades");
  if (!upg.mason_sigil) return 1.0;
  return k.certified_blueprints_stored > 0 ? 0.5 : 0.75;
}

// On a successful attack, war machines either damage walls (if any stand)
// or random damageable buildings. Returns an updates object with the
// changed columns; caller merges into the defender row.
function applyWarmachineDamage(attacker, defender, win) {
  const updates = {};
  if (!win) return updates;
  const walls = defender.bld_walls || 0;
  if (walls > 0) {
    const wallUpgrades = safeJsonParse(
      defender.wall_upgrades,
      {},
      "applyWarmachineDamage:wall_upgrades",
    );
    const warmachineResist = wallUpgrades.fortress_walls
      ? 0.03
      : wallUpgrades.reinforced
        ? 0.06
        : 0.1;
    const wallLost = Math.max(1, Math.floor(walls * warmachineResist));
    updates.bld_walls = Math.max(0, walls - wallLost);
  } else {
    const DAMAGEABLE = [
      "bld_farms",
      "bld_markets",
      "bld_barracks",
      "bld_schools",
      "bld_mage_towers",
      "bld_shrines",
    ];
    const target = DAMAGEABLE[Math.floor(Math.random() * DAMAGEABLE.length)];
    const current = defender[target] || 0;
    if (current > 0) {
      const dmg = Math.max(
        1,
        Math.floor(current * 0.05 * getMasonSigilResist(defender)),
      );
      updates[target] = Math.max(0, current - dmg);
    }
  }
  return updates;
}

module.exports = { getMasonSigilResist, applyWarmachineDamage };
