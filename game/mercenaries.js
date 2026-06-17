/**
 * Mercenary System
 * Handles mercenary recruitment, upkeep, and contract expiry
 */

const { safeJsonParse } = require("../utils/helpers");
const { MERC_TIERS } = require("./config");

function processMercenaries(k, events) {
  const updates = {};
  const mercs = safeJsonParse(
    k.mercenaries,
    [],
    "processMercenaries:mercenaries",
  );
  if (!mercs.length) return updates;

  const currentTurn = k.turn;
  let gold = k.gold;
  const active = [];
  let totalUpkeepPaid = 0;

  for (const m of mercs) {
    const served = currentTurn - (m.hired_at_turn || 0);
    const upkeep = m.upkeep_per_turn || 0;
    if (served >= m.duration_turns) {
      updates[m.unit_type] = Math.max(
        0,
        (updates[m.unit_type] ?? (k[m.unit_type] || 0)) - m.count,
      );
      events.push({
        type: "system",
        message: `🔶 ⚔️ ${m.count} ${m.tier} ${m.unit_type} completed their contract and departed.`,
      });
    } else if (gold >= upkeep) {
      gold -= upkeep;
      totalUpkeepPaid += upkeep;
      active.push(m);
    } else {
      updates[m.unit_type] = Math.max(
        0,
        (updates[m.unit_type] ?? (k[m.unit_type] || 0)) - m.count,
      );
      events.push({
        type: "system",
        message: `🔶 ⚔️ ${m.count} ${m.tier} ${m.unit_type} left — upkeep unpaid.`,
      });
    }
  }

  if (totalUpkeepPaid > 0) {
    events.push({
      type: "system",
      message: `🔶 ⚔️ Mercenary upkeep: -${totalUpkeepPaid.toLocaleString()} gold.`,
    });
  }

  updates.mercenaries = JSON.stringify(active);
  updates.gold = gold;
  return updates;
}

function hireMercenaries(k, unitType, tier, count) {
  const tierDef = MERC_TIERS[tier];
  if (!tierDef) return { error: "Invalid tier" };
  const cnt = Math.floor(Number(count));
  if (isNaN(cnt) || cnt <= 0) return { error: "Invalid count" };
  count = cnt;
  const tavUpgrades = safeJsonParse(
    k.tavern_upgrades,
    {},
    "hireMercenaries:tavern_upgrades",
  );
  if (tierDef.requires && !tavUpgrades[tierDef.requires])
    return { error: `Requires ${tierDef.requires.replace("_", " ")} upgrade` };
  if (!(k.bld_taverns > 0)) return { error: "Need at least 1 tavern" };

  const level =
    tierDef.levelMin +
    Math.floor(Math.random() * (tierDef.levelMax - tierDef.levelMin + 1));
  const cost = tierDef.costPer * count;
  const upkeep = Math.ceil((cost * tierDef.upkeepPct) / tierDef.duration);
  if (k.gold < cost)
    return { error: `Need ${cost.toLocaleString()} gold` };

  const mercs = safeJsonParse(k.mercenaries, [], "hireMercenaries:mercenaries");
  mercs.push({
    unit_type: unitType,
    tier,
    level,
    count,
    hired_at_turn: k.turn,
    duration_turns: tierDef.duration,
    upkeep_per_turn: upkeep,
  });

  return {
    updates: {
      gold: k.gold - cost,
      [unitType]: (k[unitType] || 0) + count,
      mercenaries: JSON.stringify(mercs),
    },
    hired: {
      tier,
      level,
      count,
      unitType,
      duration: tierDef.duration,
      upkeep,
      cost,
    },
  };
}

module.exports = {
  processMercenaries,
  hireMercenaries,
};
