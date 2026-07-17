/**
 * Epic Trek path discovery & loot (P0 §3b)
 *
 * Per hex on the completed path:
 * - Kingdom discovery signal (~30% seeded) — resolved against real kingdoms in resolveEpicTrek
 * - Loot roll (~12% seeded) — real persisted resources/maps/troops, NOT flavor-only "locations"
 *
 * Honesty rule: never emit reward text for finds that do not mutate kingdom state.
 */

'use strict';

const EPIC_TREK_DISCOVERY = Object.freeze({
  KINGDOM_CHANCE: 0.3,
  LOOT_CHANCE: 0.12,
  /** Weighted loot outcomes when loot triggers */
  LOOT_OUTCOMES: Object.freeze([
    { type: 'gold', weight: 28, min: 40, max: 180 },
    { type: 'wood', weight: 16, min: 15, max: 50 },
    { type: 'stone', weight: 16, min: 15, max: 50 },
    { type: 'mana', weight: 14, min: 10, max: 40 },
    { type: 'maps', weight: 10, amount: 1 },
    { type: 'food', weight: 8, min: 30, max: 100 },
    { type: 'troops', weight: 5, unit: 'rangers', min: 1, max: 4 },
    { type: 'land', weight: 2, min: 1, max: 1 },
    { type: 'artifact', weight: 2 }, // rare path artifact → kingdom items
  ]),
});

/** Catalog of trek artifacts (persist via items JSON). */
const TREK_ARTIFACTS = Object.freeze([
  { id: 'trek_carved_totem', name: 'Carved Path Totem' },
  { id: 'trek_weathered_compass', name: 'Weathered Compass' },
  { id: 'trek_ancient_coin', name: 'Ancient Coin' },
  { id: 'trek_trail_map_scrap', name: 'Trail Map Scrap' },
  { id: 'trek_ranger_badge', name: 'Lost Ranger Badge' },
]);

// Roadmap B: dragon_egg is trek-primary only (EVOLUTION.md). Separate from config ancient_dragon_egg.
let _eggBalance = null;
function getEggBalance() {
  if (!_eggBalance) {
    try {
      _eggBalance = require('./evolution/balance');
    } catch {
      _eggBalance = {
        DRAGON_EGG_ITEM_ID: 'dragon_egg',
        DRAGON_EGG_ITEM_NAME: 'Dragon Egg',
        EGG_TREK_ARTIFACT_WEIGHT: 1,
      };
    }
  }
  return _eggBalance;
}

/**
 * Deterministic pseudo-random in [0, 1) from integer seed material.
 * @param {number} a
 * @param {number} b
 * @param {number} c
 */
function seededUnit(a, b, c) {
  const seed = (Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 1274126177)) >>> 0;
  // xorshift-ish mix
  let x = seed || 1;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return (x >>> 0) / 4294967296;
}

/**
 * @param {number} hexCol
 * @param {number} hexRow
 * @param {object} kingdom
 * @returns {object|null}
 */
function rollKingdomDiscovery(hexCol, hexRow, kingdom) {
  if (!kingdom || !kingdom.id) return null;
  const rand = seededUnit(hexCol, hexRow, kingdom.id);
  if (rand >= EPIC_TREK_DISCOVERY.KINGDOM_CHANCE) return null;
  return {
    type: 'kingdom',
    hex_col: hexCol,
    hex_row: hexRow,
    discovered_turn: kingdom.turn || 0,
  };
}

/**
 * Roll real loot for a hex (replaces non-persisting "location" flavor).
 * @param {number} hexCol
 * @param {number} hexRow
 * @param {object} kingdom
 * @returns {object|null} { type: 'loot', lootType, amount?, unit? }
 */
function rollLootDiscovery(hexCol, hexRow, kingdom) {
  if (!kingdom || !kingdom.id) return null;
  const hit = seededUnit(hexCol + 17, hexRow + 31, kingdom.id * 7 + 3);
  if (hit >= EPIC_TREK_DISCOVERY.LOOT_CHANCE) return null;

  const outcomes = EPIC_TREK_DISCOVERY.LOOT_OUTCOMES;
  const totalW = outcomes.reduce((s, o) => s + o.weight, 0);
  let pick = seededUnit(hexCol + 99, hexRow + 41, kingdom.id * 11) * totalW;
  let chosen = outcomes[outcomes.length - 1];
  for (const o of outcomes) {
    pick -= o.weight;
    if (pick < 0) {
      chosen = o;
      break;
    }
  }

  if (chosen.type === 'artifact') {
    const eggBal = getEggBalance();
    // Endgame egg: small fraction of artifact rolls (not equal-weight catalog entry)
    const eggChance =
      Number(eggBal.EGG_ARTIFACT_ROLL_CHANCE) ||
      Number(eggBal.EGG_TREK_ARTIFACT_WEIGHT) ||
      0.05;
    const eggRoll = seededUnit(hexCol + 5, hexRow + 9, kingdom.id * 17);
    let art;
    if (eggChance > 0 && eggRoll < eggChance) {
      art = { id: eggBal.DRAGON_EGG_ITEM_ID, name: eggBal.DRAGON_EGG_ITEM_NAME };
      console.log(
        `[evolution] dragon_egg trek drop (endgame) kingdom=${kingdom.id} hex=${hexCol},${hexRow} turn=${kingdom.turn || 0}`,
      );
    } else {
      const idx = Math.floor(
        seededUnit(hexCol + 6, hexRow + 10, kingdom.id * 19) * TREK_ARTIFACTS.length,
      );
      art = TREK_ARTIFACTS[Math.min(Math.max(0, idx), TREK_ARTIFACTS.length - 1)];
    }
    return {
      type: 'loot',
      lootType: 'artifact',
      artifactId: art.id,
      artifactName: art.name,
      amount: 1,
      hex_col: hexCol,
      hex_row: hexRow,
      discovered_turn: kingdom.turn || 0,
    };
  }
  if (chosen.type === 'maps') {
    return {
      type: 'loot',
      lootType: 'maps',
      amount: chosen.amount || 1,
      hex_col: hexCol,
      hex_row: hexRow,
      discovered_turn: kingdom.turn || 0,
    };
  }
  if (chosen.type === 'troops') {
    const span = (chosen.max || 1) - (chosen.min || 1) + 1;
    const amount = (chosen.min || 1) + Math.floor(seededUnit(hexCol, hexRow + 7, kingdom.id) * span);
    return {
      type: 'loot',
      lootType: 'troops',
      unit: chosen.unit || 'rangers',
      amount,
      hex_col: hexCol,
      hex_row: hexRow,
      discovered_turn: kingdom.turn || 0,
    };
  }
  const span = (chosen.max || 1) - (chosen.min || 1) + 1;
  const amount = (chosen.min || 1) + Math.floor(seededUnit(hexCol + 3, hexRow, kingdom.id * 3) * span);
  return {
    type: 'loot',
    lootType: chosen.type,
    amount,
    hex_col: hexCol,
    hex_row: hexRow,
    discovered_turn: kingdom.turn || 0,
  };
}

/**
 * @deprecated Use rollLootDiscovery — kept name alias only for callers that still say "location"
 */
function rollLocationDiscovery(hexCol, hexRow, kingdom) {
  return rollLootDiscovery(hexCol, hexRow, kingdom);
}

/**
 * @param {Array<{col:number,row:number}>} pathHexes
 * @param {object} kingdom
 * @returns {Array}
 */
function processPathDiscoveries(pathHexes, kingdom) {
  if (!Array.isArray(pathHexes) || pathHexes.length === 0) {
    return [];
  }

  const discoveries = [];
  for (const hex of pathHexes) {
    if (hex == null || hex.col === undefined || hex.row === undefined) continue;
    const kingdomDisc = rollKingdomDiscovery(hex.col, hex.row, kingdom);
    if (kingdomDisc) discoveries.push(kingdomDisc);
    const lootDisc = rollLootDiscovery(hex.col, hex.row, kingdom);
    if (lootDisc) discoveries.push(lootDisc);
  }
  return discoveries;
}

/**
 * Apply loot discoveries onto updates; build honest reward lines.
 * Does not handle kingdom matching (needs DB) — only loot.
 *
 * @param {object} kingdom
 * @param {Array} discoveries
 * @returns {{ updates: object, rewards: Array<{text:string}>, lootCount: number }}
 */
function applyLootDiscoveries(kingdom, discoveries) {
  const updates = {};
  const rewards = [];
  const loots = (discoveries || []).filter((d) => d && d.type === 'loot');
  if (loots.length === 0) {
    return { updates, rewards, lootCount: 0 };
  }

  const { addItemToInventory, initItemsArray } = require('./lib/items');
  const { safeJsonParse } = require('../utils/helpers');

  const add = (key, amount) => {
    const base = updates[key] !== undefined
      ? updates[key]
      : (kingdom[key] || 0);
    updates[key] = base + amount;
  };

  // Aggregate by resource for cleaner player-facing messages
  const totals = {
    gold: 0,
    wood: 0,
    stone: 0,
    mana: 0,
    food: 0,
    maps: 0,
    land: 0,
    rangers: 0,
  };
  const artifactNames = [];

  let itemsArr = null;

  for (const loot of loots) {
    switch (loot.lootType) {
      case 'gold':
      case 'wood':
      case 'stone':
      case 'mana':
      case 'food':
      case 'land':
        add(loot.lootType, loot.amount || 0);
        totals[loot.lootType] += loot.amount || 0;
        break;
      case 'maps':
        add('maps', loot.amount || 1);
        totals.maps += loot.amount || 1;
        break;
      case 'troops': {
        const unit = loot.unit || 'rangers';
        add(unit, loot.amount || 0);
        if (unit === 'rangers') totals.rangers += loot.amount || 0;
        else {
          rewards.push({
            text: `Along the path: +${loot.amount} ${unit}`,
          });
        }
        break;
      }
      case 'artifact': {
        if (!itemsArr) {
          itemsArr = initItemsArray(
            safeJsonParse(updates.items || kingdom.items, [], 'epic-trek:items'),
          );
        }
        addItemToInventory(itemsArr, loot.artifactId, loot.artifactName, loot.amount || 1);
        artifactNames.push(loot.artifactName);
        break;
      }
      default:
        break;
    }
  }

  if (itemsArr) {
    updates.items = JSON.stringify(itemsArr);
  }

  if (totals.gold) rewards.push({ text: `Path loot: +${totals.gold.toLocaleString()} gold` });
  if (totals.wood) rewards.push({ text: `Path loot: +${totals.wood.toLocaleString()} wood` });
  if (totals.stone) rewards.push({ text: `Path loot: +${totals.stone.toLocaleString()} stone` });
  if (totals.mana) rewards.push({ text: `Path loot: +${totals.mana.toLocaleString()} mana` });
  if (totals.food) rewards.push({ text: `Path loot: +${totals.food.toLocaleString()} food` });
  if (totals.land) rewards.push({ text: `Path loot: +${totals.land} land` });
  if (totals.maps) rewards.push({ text: `Path loot: +${totals.maps} map${totals.maps !== 1 ? 's' : ''}` });
  if (totals.rangers) rewards.push({ text: `Path loot: +${totals.rangers} rangers` });
  for (const name of artifactNames) {
    rewards.push({ text: `Path artifact: ${name}` });
  }

  return { updates, rewards, lootCount: loots.length };
}

/**
 * Find regional dungeon/mountain locations whose hex sits on the trek path.
 * Pure filter — caller marks discovered + race unlock turns.
 *
 * @param {Array<{col:number,row:number}>} pathHexes
 * @param {string} race - kingdom race (region)
 * @param {function(string,string): object|null} getLocation - getLocationByRegionAndType
 * @param {function(number,number): {col:number,row:number}} pixelToHexFn
 * @returns {Array<{type:string, location: object}>}
 */
function findRegionalLocationsOnPath(pathHexes, race, getLocation, pixelToHexFn) {
  if (!Array.isArray(pathHexes) || !race || typeof getLocation !== 'function' || typeof pixelToHexFn !== 'function') {
    return [];
  }
  const pathKeys = new Set(
    pathHexes
      .filter((h) => h && h.col !== undefined && h.row !== undefined)
      .map((h) => `${h.col},${h.row}`),
  );
  const found = [];
  for (const locType of ['dungeon', 'mountain']) {
    const location = getLocation(race, locType);
    if (!location || location.x == null || location.y == null) continue;
    const hex = pixelToHexFn(location.x, location.y);
    if (!hex) continue;
    if (!pathKeys.has(`${hex.col},${hex.row}`)) continue;
    found.push({ type: locType, location });
  }
  return found;
}

module.exports = {
  EPIC_TREK_DISCOVERY,
  TREK_ARTIFACTS,
  seededUnit,
  rollKingdomDiscovery,
  rollLootDiscovery,
  rollLocationDiscovery,
  processPathDiscoveries,
  applyLootDiscoveries,
  findRegionalLocationsOnPath,
};
