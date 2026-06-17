/**
 * Upgrades System
 * Handles kingdom building upgrade purchases
 */

const {
  FARM_UPGRADES,
  GRANARY_UPGRADES,
  MARKET_UPGRADES,
  TAVERN_UPGRADES,
  TOWER_UPGRADES,
  SCHOOL_UPGRADES,
  SHRINE_UPGRADES,
  MAUSOLEUM_UPGRADES,
  LIBRARY_UPGRADES,
  WALL_UPGRADES,
  TOWER_DEF_UPGRADES,
  OUTPOST_UPGRADES,
  BANK_UPGRADES,
} = require('./config');
const { safeJsonParse } = require('../utils/helpers');

function purchaseUpgrade(k, category, upgradeKey) {
  category = (category || "").toLowerCase();
  const defs = {
    farm: FARM_UPGRADES,
    granary: GRANARY_UPGRADES,
    market: MARKET_UPGRADES,
    tavern: TAVERN_UPGRADES,
    tower: TOWER_UPGRADES,
    school: SCHOOL_UPGRADES,
    shrine: SHRINE_UPGRADES,
    mausoleum: MAUSOLEUM_UPGRADES,
    library: LIBRARY_UPGRADES,
    wall: WALL_UPGRADES,
    tower_def: TOWER_DEF_UPGRADES,
    outpost: OUTPOST_UPGRADES,
    bank: BANK_UPGRADES,
  }[category];
  if (!defs) return { error: "Invalid category" };
  const def = defs[upgradeKey];
  if (!def) return { error: "Invalid upgrade" };
  const colName = `${category}_upgrades`;
  const upgrades = safeJsonParse(k[colName], {}, `purchaseUpgrade:${colName}`);
  if (upgrades[upgradeKey]) return { error: "Already purchased" };
  if (def.requires && !upgrades[def.requires])
    return { error: `Requires ${def.requires.replace(/_/g, " ")} first` };
  if (def.raceOnly && k.race !== def.raceOnly)
    return { error: `Only available to ${def.raceOnly.replace(/_/g, " ")}` };
  if (k.gold < def.cost)
    return { error: `Need ${def.cost.toLocaleString()} gold` };

  // Check resource costs
  const costWood = def.costWood || 0;
  const costStone = def.costStone || 0;
  const costIron = def.costIron || 0;

  const currentWood = k.wood || 0;
  const currentStone = k.stone || 0;
  const currentIron = k.iron || 0;

  const shortWood = Math.max(0, costWood - currentWood);
  const shortStone = Math.max(0, costStone - currentStone);
  const shortIron = Math.max(0, costIron - currentIron);

  const shortages = [];
  if (shortWood > 0) shortages.push(`${shortWood.toLocaleString()} more wood`);
  if (shortStone > 0) shortages.push(`${shortStone.toLocaleString()} more stone`);
  if (shortIron > 0) shortages.push(`${shortIron.toLocaleString()} more iron`);

  if (shortages.length > 0) {
    return { error: `Need ${shortages.join(", ")}` };
  }

  const bldCheck = {
    farm: "bld_farms",
    market: "bld_markets",
    tavern: "bld_taverns",
    tower: "bld_mage_towers",
    school: "bld_schools",
    shrine: "bld_shrines",
    mausoleum: "bld_mausoleums",
    library: "bld_libraries",
    bank: "bld_vaults",
    wall: "bld_walls",
    tower_def: "bld_guard_towers",
    outpost: "bld_outposts",
  };
  if (bldCheck[category] && !((k[bldCheck[category]] || 0) > 0))
    return { error: `Need at least 1 ${category}` };
  if (def.reqVaults && (k.bld_vaults || 0) < def.reqVaults)
    return {
      error: `Need at least ${def.reqVaults} Vaults for this bank upgrade.`,
    };

  upgrades[upgradeKey] = true;
  return {
    updates: {
      gold: k.gold - def.cost,
      ...(costWood > 0 ? { wood: currentWood - costWood } : {}),
      ...(costStone > 0 ? { stone: currentStone - costStone } : {}),
      ...(costIron > 0 ? { iron: currentIron - costIron } : {}),
      [colName]: JSON.stringify(upgrades),
    },
  };
}

module.exports = {
  purchaseUpgrade,
};
