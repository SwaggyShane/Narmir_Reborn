/**
 * Trade Routes System
 * Handles Orc trade route raids
 */

const { unitLevelMult } = require("./lib/troops");

function raidTradeRoute(attacker, defender, unitCount) {
  if (attacker.race !== "orc")
    return { error: "Only Orcs can raid trade routes" };
  const currentAttackerThieves = attacker.thieves || 0;
  if (currentAttackerThieves < 500)
    return { error: "Need at least 500 thieves to raid trade routes" };
  const defenderTradeRoutes = defender.trade_routes || 0;
  if (defenderTradeRoutes < 1)
    return { error: "Target has no trade routes to raid" };

  const count = Math.floor(Number(unitCount));
  if (isNaN(count) || count <= 0) return { error: "Invalid unit count" };
  const actualUnitCount = Math.min(count, currentAttackerThieves);
  if (actualUnitCount < 500)
    return { error: "Must send at least 500 thieves to raid trade routes" };

  const atkLvl = unitLevelMult(attacker, "thieves");
  const defLvl = unitLevelMult(defender, "thieves");
  const successChance = 0.4 + (atkLvl - defLvl) * 0.2;
  const roll = Math.random();

  if (roll < successChance) {
    const raided = Math.min(defenderTradeRoutes, Math.floor(actualUnitCount / 500));
    const loot = raided * 5000;
    const losses = Math.floor(actualUnitCount * 0.05);

    return {
      success: true,
      looted: loot,
      raidedRoutes: raided,
      attackerUpdates: {
        gold: (attacker.gold || 0) + loot,
        thieves: Math.max(0, (attacker.thieves || 0) - losses),
      },
      defenderUpdates: {
        trade_routes: Math.max(0, (defender.trade_routes || 0) - raided),
      },
      atkEvent: `🏹 ✨ SUCCESS: You raided ${raided} trade routes of ${defender.name} and looted ${loot.toLocaleString()} gold! (Losses: ${losses} thieves)`,
      defEvent: `🏹 ⚔️ RAIDED: ${attacker.name}'s Orcs raided your trade routes! You lost ${raided} routes and ${loot.toLocaleString()} gold was stolen!`,
    };
  } else {
    const losses = Math.floor(actualUnitCount * 0.15);
    return {
      success: false,
      attackerUpdates: {
        thieves: Math.max(0, (attacker.thieves || 0) - losses),
      },
      atkEvent: `🏹 ✗ FAILURE: Your raid on ${defender.name}'s trade routes failed. You lost ${losses} thieves in the ambush.`,
      defEvent: `🏹 ⚔️ ¡ 🌪️ Your guards repelled an Orc raid from ${attacker.name} on your trade routes!`,
    };
  }
}

module.exports = {
  raidTradeRoute,
};
