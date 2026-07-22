// game/lib/turn-upkeep-flavor.js
// processTurn phases 6 / 6b: troop upkeep, low-tax flavor, happiness thresholds.
// Engine extract plan S05. Mutates ctx in place. Order is load-bearing.

'use strict';

const config = require('../config');
const fragmentBonusManager = require('../fragment-bonus-manager');

const { SUPPORT_CAP_RACE } = config;

/**
 * @param {import('./turn-context').TurnContext} ctx
 * @returns {void}
 */
function runUpkeepAndFlavor(ctx) {
  const { k, updates, events } = ctx;

  // ── 6. Troop upkeep ───────────────────────────────────────────────────────────
  // Researchers, engineers, scribes are exempt if housed in their buildings.
  // Overflow (unhomed) units pay normal upkeep.

  const capRace = SUPPORT_CAP_RACE[k.race] || {
    researcher: 1.0,
    engineer: 1.0,
    scribe: 1.0,
  };

  // Capacity per building (base × race multiplier)
  const researcherCap = Math.floor(
    k.bld_schools * 100 * capRace.researcher,
  );
  const engineerCap = Math.floor(k.bld_smithies * 50 * capRace.engineer);
  const scribeCap = Math.floor(k.bld_libraries * 20 * capRace.scribe);

  // Overflow = units beyond capacity → pay upkeep; housed units are free
  const researcherOverflow = Math.max(0, k.researchers - researcherCap);
  const engineerOverflow = Math.max(0, k.engineers - engineerCap);
  const scribeOverflow = Math.max(0, k.scribes - scribeCap);

  // Combat/support troops always pay upkeep
  const upkeepMult =
    {
      high_elf: 1.0,
      dwarf: 0.85,
      dire_wolf: 1.2,
      dark_elf: 1.1,
      human: 1.0,
      orc: 1.15,
    }[k.race] || 1.0;

  const combatTroops =
    k.fighters +
    k.rangers +
    k.clerics +
    k.mages +
    k.thieves +
    k.ninjas;
  const supportOverflow =
    researcherOverflow + engineerOverflow + scribeOverflow;
  const totalTroops = combatTroops + supportOverflow;

  const barracksTrainingMult = fragmentBonusManager.getBonusMultiplier(k, 'barracks', 'training');
  const barrackDiscount = Math.min(
    0.5,
    Math.floor(k.bld_barracks / 2) * 0.01 * barracksTrainingMult,
  );
  const upkeep = Math.floor(totalTroops * upkeepMult * (1 - barrackDiscount));

  // Build housing status message for support units
  const housedResearchers = Math.min(k.researchers, researcherCap);
  const housedEngineers = Math.min(k.engineers, engineerCap);
  const housedScribes = Math.min(k.scribes, scribeCap);
  const totalHoused = housedResearchers + housedEngineers + housedScribes;

  if (upkeep > 0) {
    updates.gold = (updates.gold || k.gold) - upkeep;
    if (updates.gold < 0) updates.gold = 0;
    let msg = `⚙️ Troop upkeep: -${upkeep.toLocaleString()} gold (${totalTroops.toLocaleString()} billable`;
    if (totalHoused > 0)
      msg += `, ${totalHoused.toLocaleString()} support units housed free`;
    if (barrackDiscount > 0) msg += `, barracks discount applied`;
    msg += `).`;
    events.push({ type: 'system', message: msg });
  } else if (totalHoused > 0) {
    events.push({
      type: 'system',
      message: `✅ All support units housed — no upkeep cost this turn.`,
    });
  }

  // ── 6. Low Tax Event (flavor bonus) ──────────────────────────────────────────────
  // Happiness math itself lives entirely in calculateHappiness (game/happiness.js) —
  // this is just a random gold/food perk for keeping taxes low, not a second
  // happiness system.
  {
    const currentTax = k.tax || 42;
    if (currentTax < 20 && Math.random() < 0.05) {
      const taxEvents = config.TAX_EVENTS || [];
      if (taxEvents.length > 0) {
        const msg = taxEvents[Math.floor(Math.random() * taxEvents.length)];
        let bonusStr = '';
        if (Math.random() < 0.5) {
          const goldBonus = Math.floor(100 + Math.random() * 900);
          updates.gold = (updates.gold || k.gold) + goldBonus;
          bonusStr = `+${goldBonus} Gold`;
        } else {
          const foodBonus = Math.floor(100 + Math.random() * 400);
          updates.food = (updates.food || k.food) + foodBonus;
          bonusStr = `+${foodBonus} Food`;
        }
        events.push({
          type: 'system',
          message: `🌟 Low Tax Event: ${msg} (${bonusStr})`,
        });
      }
    }
  }

  // ── 6b. Happiness Threshold Events ───────────────────────────────────────────────
  const currentHappinessThreshold =
    updates.happiness !== undefined
      ? updates.happiness
      : k.happiness !== undefined && k.happiness !== null
        ? k.happiness
        : 100;

  if (currentHappinessThreshold <= 0) {
    // RIOTS
    const currentPop =
      updates.population !== undefined ? updates.population : k.population;
    const popLossPct = 0.02 + Math.random() * 0.03; // 2% to 5%
    const popLost = Math.floor(currentPop * popLossPct);

    const currentGold = updates.gold !== undefined ? updates.gold : k.gold;
    const goldLost = Math.floor(500 + Math.random() * 1500); // 500 to 2000

    updates.population = Math.max(10, currentPop - popLost);
    updates.gold = Math.max(0, currentGold - goldLost);

    // Destroy 1 random building (farm, market, barracks, shrine, or tavern)
    const bldTypes = [];
    if (
      (updates.bld_farms !== undefined ? updates.bld_farms : k.bld_farms) >
      0
    )
      bldTypes.push('bld_farms');
    if (
      (updates.bld_markets !== undefined
        ? updates.bld_markets
        : k.bld_markets) > 0
    )
      bldTypes.push('bld_markets');
    if (
      (updates.bld_barracks !== undefined
        ? updates.bld_barracks
        : k.bld_barracks) > 0
    )
      bldTypes.push('bld_barracks');
    if (
      (updates.bld_shrines !== undefined
        ? updates.bld_shrines
        : k.bld_shrines) > 0
    )
      bldTypes.push('bld_shrines');
    if (
      (updates.bld_taverns !== undefined
        ? updates.bld_taverns
        : k.bld_taverns) > 0
    )
      bldTypes.push('bld_taverns');

    let destBldStr = '';
    if (bldTypes.length > 0) {
      const typeToDest = bldTypes[Math.floor(Math.random() * bldTypes.length)];
      const curType =
        updates[typeToDest] !== undefined
          ? updates[typeToDest]
          : k[typeToDest] || 0;
      updates[typeToDest] = Math.max(0, curType - 1);
      const typeLabel = typeToDest.replace('bld_', '');
      destBldStr = `, and 1 ${typeLabel} was destroyed`;
    }

    const _oldM = updates.happiness !== undefined ? updates.happiness : k.happiness;
    updates.happiness = 5; // Reset happiness
    events.push({
      type: 'system',
      message: `RIOTS! Citizens revolt! ${popLost.toLocaleString()} citizens fled/died, ${goldLost.toLocaleString()} gold looted${destBldStr}. Happiness has been reset to 5.`,
    });
  } else if (currentHappinessThreshold > 0 && currentHappinessThreshold < 25) {
    // Critical Unrest (40% chance)
    if (Math.random() < 0.4) {
      const roll = Math.random();
      if (roll < 0.33) {
        // Crime wave
        const currentGold =
          updates.gold !== undefined ? updates.gold : k.gold;
        const goldLost = Math.floor(currentGold * 0.05);
        updates.gold = Math.max(0, currentGold - goldLost);
        events.push({
          type: 'system',
          message: `Critical Unrest: Crime wave spreads! ${goldLost.toLocaleString()} gold lost.`,
        });
      } else if (roll < 0.66) {
        // Desertion
        const curFighters =
          updates.fighters !== undefined ? updates.fighters : k.fighters;
        const curRangers =
          updates.rangers !== undefined ? updates.rangers : k.rangers;
        const fLost = Math.floor(curFighters * 0.03);
        const rLost = Math.floor(curRangers * 0.03);
        updates.fighters = Math.max(0, curFighters - fLost);
        updates.rangers = Math.max(0, curRangers - rLost);
        events.push({
          type: 'system',
          message: `Critical Unrest: Desertion! ${fLost.toLocaleString()} fighters and ${rLost.toLocaleString()} rangers fled the ranks.`,
        });
      } else {
        // Arson
        const blds = [
          'bld_farms',
          'bld_markets',
          'bld_barracks',
          'bld_shrines',
          'bld_taverns',
          'bld_housing',
          'bld_smithies',
        ];
        const availBlds = blds.filter(
          (b) => (updates[b] !== undefined ? updates[b] : k[b] || 0) > 0,
        );
        if (availBlds.length > 0) {
          const bToDest =
            availBlds[Math.floor(Math.random() * availBlds.length)];
          updates[bToDest] = Math.max(
            0,
            (updates[bToDest] !== undefined
              ? updates[bToDest]
              : k[bToDest] || 0) - 1,
          );
          events.push({
            type: 'system',
            message: `Critical Unrest: Arson! 1 ${bToDest.replace('bld_', '')} was burned down.`,
          });
        } else {
          events.push({
            type: 'system',
            message: `Critical Unrest: Rioting citizens caused chaos in the streets.`,
          });
        }
      }
    }
  } else if (currentHappinessThreshold >= 25 && currentHappinessThreshold < 50) {
    // Troubled (20% chance)
    if (Math.random() < 0.2) {
      if (Math.random() < 0.5) {
        // Tax evasion
        const currentGold =
          updates.gold !== undefined ? updates.gold : k.gold;
        const goldLost = Math.floor(currentGold * 0.03);
        updates.gold = Math.max(0, currentGold - goldLost);
        events.push({
          type: 'system',
          message: `Troubled times: Widespread tax evasion. ${goldLost.toLocaleString()} gold lost.`,
        });
      } else {
        // Flavor only
        const flavors = [
          'Citizens are complaining openly in the town square.',
          'Merchants are grumbling about the state of the kingdom.',
          'Graffiti mocking your leadership has appeared on the castle walls.',
          'A minor brawl erupted in the tavern over political disagreements.',
        ];
        events.push({
          type: 'system',
          message: `😒 Unrest: ${flavors[Math.floor(Math.random() * flavors.length)]}`,
        });
      }
    }
  }
}

module.exports = {
  runUpkeepAndFlavor,
};
