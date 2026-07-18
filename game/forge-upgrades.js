/**
 * Forge upgrade chain — FORGE_SYSTEM.md §2.2 / §15.2 A2
 * Yard → Lodge → Forge. Chain order + effects + free barge on Forge.
 */

'use strict';

const config = require('./config');
const { safeJsonParse } = require('../utils/helpers');

const UPGRADE_ORDER = Object.freeze(
  config.FORGE_UPGRADE_ORDER || ['toolwright_yard', 'engineers_lodge', 'forge'],
);

const UPGRADE_COSTS = Object.freeze(
  config.FORGE_UPGRADE_COSTS || {
    toolwright_yard: { wood: 500, stone: 2000, iron: 1500, gold: 50000 },
    engineers_lodge: { wood: 500, stone: 2500, iron: 2000, gold: 75000 },
    forge: { wood: 800, stone: 4000, iron: 3500, gold: 150000 },
  },
);

const FLAG_COLS = Object.freeze({
  toolwright_yard: 'toolwright_yard',
  engineers_lodge: 'engineers_lodge',
  forge: 'forge',
});

function flagOn(k, name) {
  return Number(k?.[FLAG_COLS[name]] || 0) > 0;
}

/** Next installable upgrade, or null if Forge is complete. */
function nextUpgrade(k) {
  for (const name of UPGRADE_ORDER) {
    if (!flagOn(k, name)) return name;
  }
  return null;
}

function canInstall(k, upgrade) {
  if (!UPGRADE_ORDER.includes(upgrade)) {
    return { ok: false, error: 'Unknown upgrade' };
  }
  const expected = nextUpgrade(k);
  if (expected !== upgrade) {
    if (flagOn(k, upgrade)) {
      return { ok: false, error: 'Upgrade already installed' };
    }
    return {
      ok: false,
      error: expected
        ? `Install ${expected} first`
        : 'All forge upgrades complete',
    };
  }
  const cost = UPGRADE_COSTS[upgrade];
  if ((k.wood || 0) < cost.wood) {
    return { ok: false, error: `Need ${cost.wood.toLocaleString()} wood` };
  }
  if ((k.stone || 0) < cost.stone) {
    return { ok: false, error: `Need ${cost.stone.toLocaleString()} stone` };
  }
  if ((k.iron || 0) < cost.iron) {
    return { ok: false, error: `Need ${cost.iron.toLocaleString()} iron` };
  }
  if ((k.gold || 0) < cost.gold) {
    return { ok: false, error: `Need ${cost.gold.toLocaleString()} gold` };
  }
  return { ok: true, cost };
}

/** §2.2 effects */
function hammerGoldCostMult(k) {
  return flagOn(k, 'toolwright_yard')
    ? Number(config.FORGE_YARD_HAMMER_GOLD_MULT) || 0.9
    : 1.0;
}

function scaffoldUseMult(k) {
  return flagOn(k, 'toolwright_yard')
    ? Number(config.FORGE_YARD_SCAFFOLD_USE_MULT) || 0.9
    : 1.0;
}

function engineerXpMult(k) {
  return flagOn(k, 'engineers_lodge')
    ? Number(config.FORGE_LODGE_ENG_XP_MULT) || 1.15
    : 1.0;
}

function constructionSpeedMult(k) {
  return flagOn(k, 'engineers_lodge')
    ? Number(config.FORGE_LODGE_CONSTRUCT_MULT) || 1.1
    : 1.0;
}

/**
 * Stub free barge grant (A4 owns full barge module).
 * Max 3; integrity 100; status idle.
 */
function grantFreeFluxBarge(fluxBargesRaw) {
  const list = Array.isArray(fluxBargesRaw)
    ? [...fluxBargesRaw]
    : safeJsonParse(fluxBargesRaw, [], 'forge-upgrades:flux_barges');
  if (list.length >= 3) return list;
  const maxId = list.reduce((m, b) => Math.max(m, Number(b.id) || 0), 0);
  list.push({
    id: maxId + 1,
    integrity: 100,
    status: 'idle',
  });
  return list;
}

/**
 * Pure install: returns kingdom field updates or { error }.
 * Instant resource spend (handshake POST /forge/install-upgrade).
 */
function installUpgrade(k, upgrade) {
  const check = canInstall(k, upgrade);
  if (!check.ok) return { error: check.error };
  const cost = check.cost;
  const updates = {
    wood: (k.wood || 0) - cost.wood,
    stone: (k.stone || 0) - cost.stone,
    iron: (k.iron || 0) - cost.iron,
    gold: (k.gold || 0) - cost.gold,
    [FLAG_COLS[upgrade]]: 1,
    updated_at: Math.floor(Date.now() / 1000),
  };
  if (upgrade === 'forge') {
    updates.flux_barges = JSON.stringify(grantFreeFluxBarge(k.flux_barges));
  }
  return { updates, upgrade, cost };
}

function upgradeStatus(k) {
  return {
    toolwright_yard: flagOn(k, 'toolwright_yard'),
    engineers_lodge: flagOn(k, 'engineers_lodge'),
    forge: flagOn(k, 'forge'),
    next: nextUpgrade(k),
    next_cost: nextUpgrade(k) ? UPGRADE_COSTS[nextUpgrade(k)] : null,
  };
}

module.exports = {
  UPGRADE_ORDER,
  UPGRADE_COSTS,
  nextUpgrade,
  canInstall,
  installUpgrade,
  upgradeStatus,
  hammerGoldCostMult,
  scaffoldUseMult,
  engineerXpMult,
  constructionSpeedMult,
  grantFreeFluxBarge,
  flagOn,
};
