// game/expeditions.js
// Expedition domain -- resource expeditions orchestration, rewards, loot rolls.
// Extracted from game/engine.js (Phase 6). engine.js re-exports all symbols
// via module.exports for backward compatibility.

const config = require("./config");
const { safeJsonParse, roll, rand, devLog } = require('../utils/helpers');
const { unitLevelMult, racialUnitBonus, effectiveTroopLevel, awardTroopXp } = require('./lib/troops');
const { addItemToInventory } = require('./lib/items');
const { awardXp } = require('./xp');
const { calcDiscoveryChance, checkAchievements } = require('./turn');

const {
  EXPEDITION_TURNS,
  WORLD_FRAGMENTS,
  JUNK_PRIZES,
  INVENTORY_ITEMS,
  ULTRA_RARE_PRIZES,
  THRONE_OF_NAZDREG,
} = config;

function computeExpeditionTransitions(expeditions, now) {
  const transitions = [];
  for (const exp of expeditions) {
    if (exp.status === 'outbound' && now >= exp.arrive_at) {
      const harvestDuration = exp._harvestDuration || 3600; // fallback
      transitions.push({ id: exp.id, newStatus: 'harvesting', harvest_ends_at: now + harvestDuration, ...exp });
    } else if (exp.status === 'harvesting' && exp.harvest_ends_at && now >= exp.harvest_ends_at) {
      transitions.push({ id: exp.id, newStatus: 'returning', ...exp });
    } else if (exp.status === 'returning' && exp.return_at && now >= exp.return_at) {
      transitions.push({ id: exp.id, newStatus: 'completed', ...exp });
    }
  }
  return transitions;
}

function junkPrize(k, updates) {
  if (!JUNK_PRIZES || JUNK_PRIZES.length === 0)
    return "a particularly shiny pebble";
  const eventsCollected = safeJsonParse(
    updates.collected_events || k.collected_events,
    [],
    "junkPrize",
  );
  const lastId = updates.last_event_id || k.last_event_id;

  let available = JUNK_PRIZES.filter((p) => p.id !== lastId);
  if (available.length === 0) available = JUNK_PRIZES;
  const ev = available[Math.floor(Math.random() * available.length)];

  if (ev) {
    if (!eventsCollected.includes(ev.id)) {
      eventsCollected.push(ev.id);
      updates.collected_events = JSON.stringify(eventsCollected);

      if (eventsCollected.length >= 50) {
        updates._collector_unlocked = true;
      }
    }
    updates.last_event_id = ev.id;

    // Add item to inventory
    let inventory = safeJsonParse(updates.items || k.items, [], "junkPrize:items");
    if (!Array.isArray(inventory)) inventory = [];

    const existingItem = inventory.find((i) => i.id === ev.id);
    if (existingItem) {
      existingItem.qty = (existingItem.qty || 0) + 1;
    } else {
      // Get item name from INVENTORY_ITEMS if available
      const itemDef = INVENTORY_ITEMS?.[ev.id];
      inventory.push({ id: ev.id, name: itemDef?.name || ev.id, qty: 1 });
    }
    updates.items = JSON.stringify(inventory);

    // Check for 100 suspicious rocks achievement (only trigger once)
    if (ev.id === "suspicious_rock") {
      const rockCount = (existingItem?.qty || 0) + 1;
      if (rockCount >= 100) {
        let achievements = safeJsonParse(updates.achievements || k.achievements, [], "junkPrize:achievements");
        if (!achievements.includes("suspicious_rocks_100")) {
          achievements.push("suspicious_rocks_100");
          updates.achievements = JSON.stringify(achievements);
          updates.stone = (updates.stone ?? k.stone ?? 0) + 1000;
          updates._suspicious_rocks_achievement = true;
        }
      }
    }

    return ev.msg || ev.content || "a mysterious rock";
  }
  return "a strange pebble";
}


function expeditionRewards(type, rangers, fighters, k) {
  const tacBonus = 1 + k.res_military / 2000;

  // Race exploration bonus ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â affects all reward quantities
  const exploreBonus =
    {
      dire_wolf: 1.4,
      dark_elf: 1.25,
      human: 1.1,
      orc: 1.05,
      dwarf: 0.9,
      high_elf: 0.95,
    }[k.race] || 1.0;

  // Ranger level bonus ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â higher level rangers are better scouts
  const rangerLvBonus = unitLevelMult(k, "rangers");

  // Attrition reduced for skilled explorer races
  const attritionMult = { dire_wolf: 0.5, dark_elf: 0.6 }[k.race] || 1.0;
  const rewards = [];
  const events = [];
  const updates = {};

  // Attrition ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â skilled explorer races lose fewer rangers
  const attritionPct = type === "dungeon" ? rand(0, 3) : rand(0, 2);
  const lost = Math.floor(((rangers * attritionPct) / 100) * attritionMult);
  const returned = rangers - lost;
  if (lost > 0)
    rewards.push({
      text: `${lost} ranger${lost > 1 ? "s" : ""} did not return from the expedition`,
    });
  // Rangers returned stored separately so resolveExpeditions can use SQL increment
  updates._rangers_returned = returned;

  const expTurns = EXPEDITION_TURNS[type] || 10;

  // Gold base = forage rate (rangers ÃƒÆ’Ã¢â‚¬â€ 12 ÃƒÆ’Ã¢â‚¬â€ tacBonus) ÃƒÆ’Ã¢â‚¬â€ turns ÃƒÆ’Ã¢â‚¬â€ race bonus ÃƒÆ’Ã¢â‚¬â€ random 5ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Å“30% bonus
  const foragePerTurn = rangers * 2 * tacBonus * exploreBonus * rangerLvBonus;
  const randomBonus = 1 + rand(5, 30) / 100;
  const goldBase = Math.floor(foragePerTurn * expTurns * randomBonus);

  if (type === "scout") {
    rewards.push({ text: `+${goldBase.toLocaleString()} gold from foraging` });
    updates.gold = k.gold + goldBase;

    // Resource Yield: Wood
    const rollWood = Math.random() * 100;
    let woodGained = 0;
    if (rollWood < 0.5) {
      woodGained = 25;
    } else if (rollWood < 5.5) {
      woodGained = 5;
    } else if (rollWood < 30.5) {
      woodGained = 2;
    } else if (rollWood < 80.5) {
      woodGained = 1;
    }

    if (woodGained > 0) {
      updates.wood = (updates.wood !== undefined ? updates.wood : k.wood || 0) + woodGained;
      rewards.push({ text: `ÃƒÂ°Ã…Â¸Ã‚ÂªÃ‚Âµ +${woodGained} wood discovered` });
    }

    const land = Math.max(
      1,
      Math.floor(rand(rangers * 0.01, rangers * 0.03) * exploreBonus),
    );
    rewards.push({
      text: `+${land} acre${land > 1 ? "s" : ""} of unclaimed land`,
    });
    updates.land = k.land + land;

    if (roll(0.3)) {
      const mana = rand(
        Math.floor(rangers * 0.2 * exploreBonus),
        Math.floor(rangers * 0.8 * exploreBonus),
      );
      rewards.push({ text: `+${mana} mana from a hidden shrine` });
      updates.mana = k.mana + mana;
    }
    if (roll(0.1)) {
      const troops = rand(
        2,
        Math.max(3, Math.floor(rangers * 0.02 * exploreBonus)),
      );
      if (k.race === "vampire") {
        rewards.push({
          text: `Your troops captured ${troops} wandering souls and bound them as Thralls`,
        });
        updates.clerics = k.clerics + troops;
      } else {
        rewards.push({
          text: `${troops} wandering fighter${troops > 1 ? "s" : ""} pledge allegiance to your kingdom`,
        });
        updates.fighters = k.fighters + troops;
      }
    }
    if (roll(0.03)) {
      const bonus = rand(
        Math.floor(rangers * 0.03 * exploreBonus),
        Math.floor(rangers * 0.08 * exploreBonus),
      );
      rewards.push({
        text: `An ancient map reveals ${bonus} additional acres ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â scouts claim them!`,
      });
      updates.land = (updates.land || k.land) + bonus;
    }
    if (roll(0.45))
      rewards.push({
        text: `Your rangers also found ${junkPrize(k, updates)}`,
      });

    // Map drop ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â 5% chance on scout
    if (roll(0.05)) {
      updates.maps = k.maps + 1;
      rewards.push({
        text: `ÃƒÂ°Ã…Â¸Ã¢â‚¬â€Ã‚ÂºÃƒÂ¯Ã‚Â¸Ã‚Â A map was found ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â you can now interact with other kingdoms`,
      });
    }

    // DISCOVERY: Chance to find another kingdom
    if (roll(calcDiscoveryChance(k))) {
      updates._find_kingdom = true;
    }
  } else if (type === "deep") {
    rewards.push({
      text: `+${goldBase.toLocaleString()} gold from deep wilderness caches`,
    });
    updates.gold = k.gold + goldBase;

    // Resource Yield: Wood and Stone
    const rollDeep = Math.random() * 100;
    let deepWood = 0;
    let deepStone = 0;
    if (rollDeep < 0.5) {
      deepWood = 25;
      deepStone = 25;
    } else if (rollDeep < 5.5) {
      deepWood = 5;
      deepStone = 5;
    } else if (rollDeep < 30.5) {
      deepWood = 2;
      deepStone = 2;
    } else if (rollDeep < 80.5) {
      deepWood = 1;
      deepStone = 1;
    }

    if (deepWood > 0) {
      updates.wood = (updates.wood !== undefined ? updates.wood : k.wood || 0) + deepWood;
      updates.stone = (updates.stone !== undefined ? updates.stone : k.stone || 0) + deepStone;
      rewards.push({ text: `ÃƒÂ°Ã…Â¸Ã‚ÂªÃ‚Âµ +${deepWood} wood and ÃƒÂ°Ã…Â¸Ã‚ÂªÃ‚Â¨ +${deepStone} stone unearthed` });
    }

    const land = Math.max(
      2,
      Math.floor(rand(rangers * 0.04, rangers * 0.1) * exploreBonus),
    );
    rewards.push({ text: `+${land} acres of fertile territory` });
    updates.land = k.land + land;

    if (roll(0.55)) {
      const mana = rand(
        Math.floor(rangers * 0.5 * exploreBonus),
        Math.floor(rangers * 2 * exploreBonus),
      );
      rewards.push({
        text: `+${mana} mana from ley lines discovered deep in the wilderness`,
      });
      updates.mana = k.mana + mana;
    }
    if (roll(0.25)) {
      const disc = [
        "res_economy",
        "res_weapons",
        "res_armor",
        "res_military",
        "res_entertainment",
      ][rand(0, 4)];
      const boost = rand(1, Math.max(2, Math.floor(5 * exploreBonus)));
      const discLabel = disc.replace("res_", "").replace("_", " ");
      rewards.push({
        text: `A research scroll found ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â ${discLabel} +${boost}%`,
      });
      updates[disc] = (k[disc] || 0) + boost;
    }
    if (roll(0.2)) {
      const troops = rand(
        Math.floor(rangers * 0.03 * exploreBonus),
        Math.floor(rangers * 0.08 * exploreBonus),
      );
      const ttype = roll(0.5) ? "fighters" : "rangers";
      if (troops > 0) {
        if (k.race === "vampire") {
          rewards.push({
            text: `${troops} mercenaries were subdued and turned into Thralls`,
          });
          updates.clerics = k.clerics + troops;
        } else {
          rewards.push({
            text: `${troops} mercenary ${ttype} join your cause`,
          });
          updates[ttype] = (k[ttype] || 0) + troops;
        }
      }
    }
    if (roll(0.08)) {
      const bonus = rand(
        Math.floor(rangers * 0.05 * exploreBonus),
        Math.floor(rangers * 0.15 * exploreBonus),
      );
      rewards.push({
        text: `Ruins of an abandoned kingdom found ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â you claim ${bonus} acres of its former territory`,
      });
      updates.land = (updates.land || k.land) + bonus;
    }
    if (roll(0.02)) {
      const disc = [
        "res_spellbook",
        "res_attack_magic",
        "res_defense_magic",
        "res_war_machines",
        "res_construction",
      ][rand(0, 4)];
      const boost = rand(
        Math.floor(5 * exploreBonus),
        Math.floor(15 * exploreBonus),
      );
      const discLabel = disc.replace("res_", "").replace("_", " ");
      rewards.push({
        text: `ÃƒÂ¢Ã…Â¡Ã‚Â¡ An ancient artifact of ${discLabel} ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â permanent +${boost}%`,
      });
      updates[disc] = (k[disc] || 0) + boost;
    }

    if (roll(calcDiscoveryChance(k))) {
      updates._find_kingdom = true;
    }
    if (roll(0.6))
      rewards.push({
        text: `Hidden deep in the wilderness, your rangers also discovered ${junkPrize(k, updates)}`,
      });

    // Map drop ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â 15% chance on deep
    if (roll(0.15)) {
      updates.maps = (updates.maps || k.maps) + 1;
      rewards.push({ text: `ÃƒÂ°Ã…Â¸Ã¢â‚¬â€Ã‚ÂºÃƒÂ¯Ã‚Â¸Ã‚Â A map was discovered in the deep wilderness` });
    }

    if (roll(0.05)) {
      updates._find_world_fragment = true;
    }
  } else if (type === "dungeon") {
    const power = (rangers + fighters * 2) * tacBonus * exploreBonus;
    const successChance = Math.min(0.9, 0.25 + power / 24000);
    const success = roll(successChance);

    if (!success) {
      const fLost = Math.min(
        fighters,
        rand(Math.floor(fighters * 0.05), Math.floor(fighters * 0.15)),
      );
      const fReturned = fighters - fLost;
      if (fReturned > 0) updates._fighters_returned = fReturned;
      rewards.push({
        text: `The dungeon proved too dangerous ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â ${fLost} fighters lost in retreat`,
      });
      events.push({
        type: "attack",
        message: `ÃƒÂ°Ã…Â¸Ã¢â‚¬â„¢Ã¢â€šÂ¬ Dungeon raid FAILED ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â your forces were overwhelmed. ${fLost.toLocaleString()} fighters lost.`,
      });
    } else {
      updates._fighters_returned = fighters;

      const dungeonMult =
        { orc: 2.0, dire_wolf: 1.5, high_elf: 0.5 }[k.race] || 1.0;

      const dungeonGold = Math.floor(
        fighters *
          rand(8, 12) *
          tacBonus *
          exploreBonus *
          randomBonus *
          dungeonMult,
      );
      rewards.push({
        text: `+${dungeonGold.toLocaleString()} gold plundered from the dungeon`,
      });
      updates.gold = k.gold + dungeonGold;

      // Resource Yield: Iron only (on success)
      const rollDungeon = Math.random() * 100;
      let ironGained = 0;
      if (rollDungeon < 0.5) {
        ironGained = 150;
      } else if (rollDungeon < 5.5) {
        ironGained = 50;
      } else if (rollDungeon < 30.5) {
        ironGained = 10;
      } else if (rollDungeon < 80.5) {
        ironGained = 2;
      }

      if (ironGained > 0) {
        updates.iron = (updates.iron !== undefined ? updates.iron : k.iron || 0) + ironGained;
        rewards.push({ text: `ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ¢â‚¬â€ +${ironGained} iron plundered` });
      }

      const mana = Math.floor(
        rand(
          Math.floor(rangers * 1 * exploreBonus),
          Math.floor(rangers * 4 * exploreBonus),
        ) * dungeonMult,
      );
      rewards.push({ text: `+${mana} mana from dungeon ley stones` });
      updates.mana = k.mana + mana;

      const disc = [
        "res_weapons",
        "res_armor",
        "res_military",
        "res_attack_magic",
        "res_spellbook",
      ][rand(0, 4)];
      const boost = Math.floor(
        rand(3, Math.floor(12 * exploreBonus)) * dungeonMult,
      );
      const discLabel = disc.replace("res_", "").replace("_", " ");
      rewards.push({
        text: `Dungeon tome found ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â ${discLabel} permanently +${boost}%`,
      });
      updates[disc] = (k[disc] || 0) + boost;

      if (roll(0.12)) {
        const wm = Math.max(
          1,
          Math.floor(
            rand(1, Math.max(2, Math.floor((fighters / 500) * exploreBonus))) *
              dungeonMult,
          ),
        );
        rewards.push({
          text: `ÃƒÂ¢Ã…Â¡Ã‚Â¡ Ancient war machine${wm > 1 ? "s" : ""} recovered from the dungeon depths ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â +${wm}`,
        });
        updates.war_machines = k.war_machines + wm;
      }
      if (roll(0.06)) {
        const boost2 = Math.floor(
          rand(10, Math.floor(40 * exploreBonus)) * dungeonMult,
        );
        rewards.push({
          text: `ÃƒÂ¢Ã…Â¡Ã‚Â¡ The dungeon's heart pulsed with ancient magic ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â spellbook permanently +${boost2}`,
        });
        updates.res_spellbook =
          (updates.res_spellbook || k.res_spellbook) + boost2;
      }
      if (roll(0.5))
        rewards.push({
          text: `Amid the carnage, someone pocketed ${junkPrize(k, updates)}`,
        });

      // Map drop ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â 25% chance on dungeon
      if (roll(0.25)) {
        updates.maps = (updates.maps || k.maps) + 1;
        rewards.push({ text: `ÃƒÂ°Ã…Â¸Ã¢â‚¬â€Ã‚ÂºÃƒÂ¯Ã‚Â¸Ã‚Â A map was found among the dungeon spoils` });
      }
      // Blueprint drop ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â 20% chance on dungeon
      if (roll(0.2)) {
        const smithyCap = k.bld_smithies * 25;
        const curBP =
          updates.blueprints_stored !== undefined
            ? updates.blueprints_stored
            : k.blueprints_stored;
        if (smithyCap === 0 || curBP < smithyCap) {
          updates.blueprints_stored = curBP + 1;
          rewards.push({
            text: `ÃƒÂ¢Ã…Â¡Ã¢â€žÂ¢ÃƒÂ¯Ã‚Â¸Ã‚Â A blueprint was recovered from the dungeon depths`,
          });
        }
      }

      if (roll(0.1)) {
        updates._find_world_fragment = true;
      }
    }
  } else if (type === "mountain") {
    // Mountain Expedition: Rangers only, balanced high-risk/high-reward attrition
    const mountainMult = { dire_wolf: 0.8, human: 1.0, dwarf: 1.1 }[k.race] || 1.0;
    const rangerLevel = effectiveTroopLevel(k, "rangers");

    // Avalanche attrition per turn: random between 0 and level-based max (targeting ~75% total attrition)
    const expTurns = EXPEDITION_TURNS["mountain"] || 100;
    let totalArriving = rangers;
    const attritionLog = [];

    for (let turn = 1; turn <= expTurns; turn++) {
      // Determine max loss % based on ranger level (BALANCED: 0-8/6/5/4% per turn)
      let maxLoss = 8;
      if (rangerLevel >= 21 && rangerLevel <= 30) maxLoss = 6;
      else if (rangerLevel >= 31 && rangerLevel <= 40) maxLoss = 5;
      else if (rangerLevel >= 41) maxLoss = 4;

      // Roll between 0 and maxLoss (always allows zero-loss outcome)
      const lossPercent = rand(0, maxLoss);
      const lostThisTurn = Math.ceil((totalArriving * lossPercent) / 100);
      totalArriving -= lostThisTurn;

      if (lostThisTurn > 0) {
        attritionLog.push(lostThisTurn);
      }
    }

    const survived = totalArriving;
    const totalLost = rangers - survived;
    const casualtyRate = (totalLost / rangers * 100).toFixed(1);

    if (totalLost > 0) {
      rewards.push({
        text: `Avalanches claimed ${totalLost.toLocaleString()} rangers (${casualtyRate}%) ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â ${survived.toLocaleString()} returned`,
      });
    } else {
      rewards.push({
        text: `Against the odds, all ${rangers.toLocaleString()} rangers navigated the mountain unscathed`,
      });
    }

    updates._rangers_returned = survived;

    // Apply casualty losses to kingdom ranger count
    updates.rangers = Math.max(0, (k.rangers || 0) - totalLost);

    // Mountain rewards only granted if rangers survived the expedition
    if (survived > 0) {
      // Gold scaled to troop count and level (200-500 per ranger)
      const goldPerRanger = rand(200, 500);
      const mountainGold = Math.floor(
        rangers * goldPerRanger * tacBonus * exploreBonus * mountainMult * (1 + rand(5, 30) / 100)
      );
      rewards.push({
        text: `+${mountainGold.toLocaleString()} gold from mountain artifacts`,
      });
      updates.gold = k.gold + mountainGold;

      // Mana from ley lines (scaled)
      const mountainMana = Math.floor(
        rand(rangers * 10, rangers * 50) * mountainMult * exploreBonus
      );
      rewards.push({
        text: `+${mountainMana} mana from ancient ley lines`,
      });
      updates.mana = k.mana + mountainMana;

      // Research boost from ancient knowledge (scaled)
      const res = ["res_weapons", "res_armor", "res_construction"][rand(0, 2)];
      const resBoost = Math.floor(rand(50, 150) * mountainMult);
      rewards.push({
        text: `Ancient runes revealed ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â ${res.replace("res_", "").replace("_", " ")} +${resBoost}`,
      });
      updates[res] = (k[res] || 0) + resBoost;

      // Junk prizes more frequent on mountain (60% chance per turn) ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â consolidated summary
      let junkCount = 0;
      for (let t = 0; t < expTurns; t++) {
        if (roll(0.6)) {
          junkPrize(k, updates);
          junkCount++;
        }
      }
      if (junkCount > 0) {
        rewards.push({
          text: `Rangers discovered ${junkCount} artifacts in the mountain passes`,
        });
      }
    }

    // No land rewards from mountain ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â focus purely on artifacts/magic
    // (explicitly 0 land)
  }

  // ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Ultra-rare prizes ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
  // deep: 0.5%, dungeon success: 1%, mountain: 2.5% per turn (MAX 1 per expedition for mountain)
  const ultraChance = type === "dungeon" ? 0.01 : type === "deep" ? 0.005 : type === "mountain" ? 0.025 : 0;

  // For mountain expeditions, track if we already got an ultra-rare during the 100 turns
  if (type === "mountain" && updates._rangers_returned > 0) {
    let ultraRareObtained = false;
    const mountainUltraRares = ULTRA_RARE_PRIZES.filter(p =>
      ["iceflow_crown", "snowpeak_chalice", "frostbind_amulet", "avalanche_heart", "stormcaller_gem"].includes(p.id)
    );
    for (let turn = 1; turn <= (EXPEDITION_TURNS["mountain"] || 100); turn++) {
      if (!ultraRareObtained && roll(ultraChance)) {
        if (mountainUltraRares.length > 0) {
          const prize = mountainUltraRares[Math.floor(Math.random() * mountainUltraRares.length)];
          prize.effect(k, updates);
          rewards.push({ text: `ÃƒÂ¢Ã…â€œÃ‚Â¨ÃƒÂ¢Ã…â€œÃ‚Â¨ÃƒÂ¢Ã…â€œÃ‚Â¨ ULTRA RARE: ${prize.text}` });

          // Add ultra-rare item to inventory
          let inventory = safeJsonParse(updates.items || k.items, [], "expeditionRewards:ultra_rare_items");
          if (!Array.isArray(inventory)) inventory = [];
          const itemDef = INVENTORY_ITEMS?.[prize.id];
          addItemToInventory(inventory, prize.id, itemDef?.name || prize.id, 1);
          updates.items = JSON.stringify(inventory);

          ultraRareObtained = true; // Prevent more ultra-rares this expedition
        }
      }
    }
  } else if (ultraChance > 0 && roll(ultraChance)) {
    // Non-mountain expeditions: regular ultra-rare drop (can be multiple)
    const prize =
      ULTRA_RARE_PRIZES[Math.floor(Math.random() * ULTRA_RARE_PRIZES.length)];
    prize.effect(k, updates);
    rewards.push({ text: `ÃƒÂ¢Ã…â€œÃ‚Â¨ÃƒÂ¢Ã…â€œÃ‚Â¨ÃƒÂ¢Ã…â€œÃ‚Â¨ ULTRA RARE: ${prize.text}` });

    // Add ultra-rare item to inventory
    let inventory = safeJsonParse(updates.items || k.items, [], "expeditionRewards:ultra_rare_items");
    if (!Array.isArray(inventory)) inventory = [];
    const itemDef = INVENTORY_ITEMS?.[prize.id];
    addItemToInventory(inventory, prize.id, itemDef?.name || prize.id, 1);
    updates.items = JSON.stringify(inventory);
  }

  // ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Throne of Nazdreg (0.1% on deep/dungeon, unique forever) ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
  const throneChance = type === "deep" || type === "dungeon" ? 0.001 : 0;
  if (throneChance > 0 && roll(throneChance)) {
    updates._check_throne = true; // resolveExpeditions will check server_state and apply if unclaimed
  }

  // ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Air Fragment (rare mountain drop, ~1-2% chance, only if rangers survive) ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
  if (type === "mountain" && updates._rangers_returned > 0 && roll(0.015)) {
    // Add air fragment to inventory
    let inventory = safeJsonParse(updates.items || k.items, [], "expeditionRewards:air_fragment");
    if (!Array.isArray(inventory)) inventory = [];
    const itemDef = INVENTORY_ITEMS?.["air_fragment"];
    addItemToInventory(inventory, "air_fragment", itemDef?.name || "Air Fragment", 1);
    updates.items = JSON.stringify(inventory);
    rewards.push({
      text: `ÃƒÂ°Ã…Â¸Ã…â€™Ã‚Â¬ÃƒÂ¯Ã‚Â¸Ã‚Â An Air Fragment pulses with the fury of ancient storms ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â a collectible of immense power`,
    });
  }

  const preAchLength = events.length;
  checkAchievements(k, updates, events);
  for (let i = preAchLength; i < events.length; i++) {
    rewards.push({ text: events[i].message });
  }

  return { rewards, updates, events };
}


async function resolveExpeditions(db, k, engine) {
  // Pick up active ones AND unclaimed ones (turns_left=0 but rewards_claimed=0)
  const exps = await db.all(
    "SELECT * FROM expeditions WHERE kingdom_id = ? AND (turns_left > 0 OR (turns_left = 0 AND rewards_claimed = 0))",
    [k.id],
  );
  devLog(
    `[expedition] kingdom=${k.id} active/unclaimed: ${exps.map((e) => `${e.type}(${e.turns_left}t, claimed=${e.rewards_claimed})`).join(", ") || "none"}`,
  );

  // Fetch fresh kingdom state once instead of once per expedition
  const freshK = (await db.get("SELECT * FROM kingdoms WHERE id = ?", [k.id])) || k;

  const expeditionEvents = [];

  // ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ BATCH PROCESSING: Collect updates before executing ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
  // This reduces database round-trips from O(exps*turns) to O(turns)
  const tickDowns = [];  // { id, newTurns }
  const completions = []; // ids that complete this turn
  const retries = [];     // ids already completed, retrying claim
  const expsByState = {}; // track by id for later reward processing

  for (const exp of exps) {
    if (exp.turns_left > 0) {
      const direWolfBonus = racialUnitBonus(freshK, "rangers");
      const tickDown = direWolfBonus.earlyReturn ? 2 : 1;
      const newTurns = Math.max(0, exp.turns_left - tickDown);
      devLog(
        `[expedition] kingdom=${k.id} id=${exp.id} type=${exp.type} turns_left=${exp.turns_left} ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ ${newTurns}`,
      );

      if (newTurns > 0) {
        tickDowns.push({ id: exp.id, newTurns });
        expsByState[exp.id] = { ...exp, turns_left: newTurns, mustProcess: false };
      } else {
        completions.push(exp.id);
        expsByState[exp.id] = { ...exp, turns_left: 0, mustProcess: true };
        devLog(`[expedition] COMPLETING kingdom=${k.id} id=${exp.id} type=${exp.type}`);
      }
    } else {
      retries.push(exp.id);
      expsByState[exp.id] = { ...exp, mustProcess: true };
      devLog(`[expedition] RETRYING completion for kingdom=${k.id} id=${exp.id} type=${exp.type}`);
    }
  }

  // ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Execute batched updates ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬

  // Batch update: ALL tick-downs in ONE statement using CASE/WHEN
  if (tickDowns.length > 0) {
    const ids = tickDowns.map(t => t.id);
    const caseWhen = tickDowns
      .map(({ id, newTurns }) => `WHEN ${id} THEN ${newTurns}`)
      .join(" ");
    const updateSql = `UPDATE expeditions SET turns_left = CASE id ${caseWhen} END WHERE id = ANY($1)`;
    const result = await db.run(updateSql, [ids]);
    devLog(`[expedition] Batched ${result.changes} turn decrements in single UPDATE`);
  }

  // Batch update: all completions in one statement
  if (completions.length > 0) {
    const placeholders = completions.map(() => "?").join(",");
    const markResult = await db.run(
      `UPDATE expeditions SET turns_left = 0, rewards_claimed = 1 WHERE id IN (${placeholders}) AND rewards_claimed = 0`,
      completions,
    );
    devLog(`[expedition] Batched completion claim: ${markResult.changes} expeditions marked complete`);
  }

  // Batch update: all retry claims in one statement
  if (retries.length > 0) {
    const placeholders = retries.map(() => "?").join(",");
    const claimResult = await db.run(
      `UPDATE expeditions SET rewards_claimed = 1 WHERE id IN (${placeholders}) AND rewards_claimed = 0`,
      retries,
    );
    devLog(`[expedition] Batched retry claim: ${claimResult.changes} expeditions claimed`);
  }

  // ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Process reward claims for expeditions that completed ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
  for (const exp of exps) {
    const expState = expsByState[exp.id];
    if (!expState || !expState.mustProcess) continue;

    try {
      // Use pre-fetched kingdom state to avoid stale merged values
      const { rewards, updates, events } = expeditionRewards(
        exp.type,
        exp.rangers,
        exp.fighters,
        freshK,
        db,
      );

      // ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Throne of Nazdreg check ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
      if (updates._check_throne) {
        delete updates._check_throne;
        // Atomic claim: a single conditional insert decides the winner. The row
        // count tells us whether THIS expedition seized the unique drop. This
        // closes the read-then-write race where two kingdoms finishing in the
        // same tick could both observe the throne as unclaimed across the await
        // boundary and each award it.
        const claim = await db.run(
          "INSERT INTO server_state (key, value) VALUES ('throne_found', '1') ON CONFLICT (key) DO NOTHING",
        );
        if (claim && claim.changes === 1) {
          THRONE_OF_NAZDREG.effect(freshK, updates);
          rewards.unshift({ text: THRONE_OF_NAZDREG.text });
          events.push({
            type: "system",
            message: `ÃƒÂ°Ã…Â¸Ã¢â‚¬ËœÃ¢â‚¬Ëœ ${freshK.name} has found the Throne of Nazdreg Grishnak. May his memory endure forever.`,
          });
          updates._server_announce = `ÃƒÂ°Ã…Â¸Ã¢â‚¬ËœÃ¢â‚¬Ëœ The Throne of Nazdreg Grishnak has been found by ${freshK.name}. His name is remembered.`;
        }
      }

      if (updates._find_kingdom) {
        delete updates._find_kingdom;
        const other = await db.get(
          "SELECT id, name FROM kingdoms WHERE id != ? ORDER BY RANDOM() LIMIT 1",
          [freshK.id],
        );
        if (other) {
          let disc = {};
          try {
            disc = safeJsonParse(freshK.discovered_kingdoms, {}, "auto:discovered_kingdoms");
          } catch {}
          if (!disc[other.id]) {
            disc[other.id] = { found: true, name: other.name };
            updates.discovered_kingdoms = JSON.stringify(disc);
            rewards.push({
              text: `ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ‚Â­ Your rangers discovered the kingdom of ${other.name}!`,
            });
          }
        }
      }

      if (updates._find_world_fragment) {
        delete updates._find_world_fragment;
        let frags = [];
        try {
          frags = safeJsonParse(freshK.world_fragments, [], "auto:world_fragments");
        } catch {}
        const frag =
          WORLD_FRAGMENTS[Math.floor(Math.random() * WORLD_FRAGMENTS.length)];
        frags.push(frag);
        updates.world_fragments = JSON.stringify(frags);
        rewards.push({
          text: `ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ‚Â® Your rangers recovered a World Fragment: ${frag}`,
        });
        events.push({
          type: "system",
          message: `ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ‚Â® A World Fragment (${frag}) was discovered during the expedition.`,
        });
      }

      if (updates._suspicious_rocks_achievement) {
        delete updates._suspicious_rocks_achievement;
        rewards.unshift({
          text: `ÃƒÂ°Ã…Â¸Ã‚ÂÃ¢â‚¬Â  ACHIEVEMENT UNLOCKED: Found 100 mysterious rocks! +1000 stone awarded.`,
        });
        events.push({
          type: "system",
          message: `ÃƒÂ°Ã…Â¸Ã‚ÂÃ¢â‚¬Â  ACHIEVEMENT: ${freshK.name} collected 100 mysterious rocks and was rewarded with 1000 stone!`,
        });
      }

      const serverAnnounce = updates._server_announce || null;
      delete updates._server_announce;
      delete updates._ultra_rare;

      const label = {
        scout: "ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ‚Â­ Scout",
        deep: "ÃƒÂ°Ã…Â¸Ã…â€™Ã‚Â² Deep",
        dungeon: "ÃƒÂ¢Ã…Â¡Ã¢â‚¬ÂÃƒÂ¯Ã‚Â¸Ã‚Â Dungeon",
        mountain: "ÃƒÂ°Ã…Â¸Ã‚ÂÃ¢â‚¬ÂÃƒÂ¯Ã‚Â¸Ã‚Â Mountain",
      }[exp.type];

      // Apply kingdom updates
      const rangersReturned =
        updates._rangers_returned !== undefined ? updates._rangers_returned : 0;
      const fightersReturned =
        updates._fighters_returned !== undefined
          ? updates._fighters_returned
          : 0;
      delete updates._rangers_returned;
      delete updates._fighters_returned;

      const VALID_KINGDOM_COLS = new Set([
        "gold",
        "mana",
        "land",
        "population",
        "morale",
        "food",
        "fighters",
        "rangers",
        "clerics",
        "mages",
        "thieves",
        "ninjas",
        "researchers",
        "engineers",
        "war_machines",
        "weapons_stockpile",
        "armor_stockpile",
        "res_economy",
        "res_weapons",
        "res_armor",
        "res_military",
        "res_attack_magic",
        "res_defense_magic",
        "res_entertainment",
        "res_construction",
        "res_war_machines",
        "res_spellbook",
        "bld_farms",
        "bld_barracks",
        "bld_markets",
        "bld_mage_towers",
        "blueprints_stored",
        "certified_blueprints_stored",
        "maps",
        "troop_levels",
        "xp",
        "level",
        "xp_sources",
        "discovered_kingdoms",
        "world_fragments",
        "collected_events",
        "last_event_id",
        "achievements",
        "items",
      ]);

      // Award XP
      const expXpAmount = { scout: 8, deep: 20, dungeon: 40, mountain: 100 }[exp.type] || 8;
      const rXp = awardTroopXp(freshK, "rangers", expXpAmount * exp.rangers);
      updates.troop_levels = rXp.troop_levels;
      if (exp.type === "dungeon" && exp.fighters > 0) {
        const fXp = awardTroopXp(
          { ...freshK, troop_levels: updates.troop_levels },
          "fighters",
          40 * exp.fighters,
        );
        updates.troop_levels = fXp.troop_levels;
      }

      // Award kingdom-level exploration XP (divide by XP_BASE.exploration=5 to get final amounts matching stated values)
      const kingdomXpBase = { scout: 1, deep: 4, dungeon: 8, mountain: 20 }[exp.type] || 1;
      const kingdomXp = awardXp(freshK, "exploration", kingdomXpBase * (exp.rangers + (exp.fighters || 0)));
      updates.xp = kingdomXp.xp;
      updates.level = kingdomXp.level;
      updates.xp_sources = JSON.stringify(kingdomXp.xp_sources);
      if (kingdomXp.events.length > 0) {
        events.push(...kingdomXp.events);
      }

      if (updates._achievement_unlocked) {
        rewards.push({
          text: "ÃƒÂ°Ã…Â¸Ã‚ÂÃ¢â‚¬Â  ACHIEVEMENT UNLOCKED: " + updates._achievement_unlocked,
        });
        events.push({
          type: "system",
          message: "ÃƒÂ°Ã…Â¸Ã‚ÂÃ¢â‚¬Â  ACHIEVEMENT UNLOCKED: " + updates._achievement_unlocked,
        });
        delete updates._achievement_unlocked;
      }

      // Handle location revelation for Field Collector achievement
      if (updates._reveal_all_locations) {
        try {
          let disc = safeJsonParse(updates.discovered_kingdoms || k.discovered_kingdoms, {}, "reveal_all:discovered_kingdoms");
          disc._all_revealed = true;
          updates.discovered_kingdoms = JSON.stringify(disc);
        } catch (err) {
          console.error("[resolveExpeditions] Error revealing all locations:", err);
        }
        delete updates._reveal_all_locations;
      }

      const safeUpdates = Object.fromEntries(
        Object.entries(updates).filter(
          ([k2, v]) =>
            VALID_KINGDOM_COLS.has(k2) && v !== undefined && v !== null,
        ),
      );
      if (Object.keys(safeUpdates).length > 0) {
        const cols = Object.keys(safeUpdates)
          .map((c) => `${c} = ?`)
          .join(", ");
        await db.run(`UPDATE kingdoms SET ${cols} WHERE id = ?`, [
          ...Object.values(safeUpdates),
          k.id,
        ]);
        // Update in-memory freshK so next expedition sees the changes
        Object.assign(freshK, safeUpdates);
      }
      if (rangersReturned > 0)
        await db.run(
          "UPDATE kingdoms SET rangers  = rangers  + ? WHERE id = ?",
          [rangersReturned, k.id],
        );
      if (fightersReturned > 0)
        await db.run(
          "UPDATE kingdoms SET fighters = fighters + ? WHERE id = ?",
          [fightersReturned, k.id],
        );

      // Update in-memory freshK for returned units
      if (rangersReturned > 0) freshK.rangers = (freshK.rangers || 0) + rangersReturned;
      if (fightersReturned > 0) freshK.fighters = (freshK.fighters || 0) + fightersReturned;

      // ONE news line only ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â rewards go to expedition log, not news feed
      const completionMsg = `${label} expedition returned ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â check the Explore tab for rewards.`;
      expeditionEvents.push({ type: "system", message: completionMsg });

      // Throne broadcast only
      if (serverAnnounce) {
        const allKingdoms = await db.all("SELECT id FROM kingdoms");
        if (allKingdoms.length > 0) {
          const placeholders = allKingdoms.map((_, i) => `($${i + 1},'system',$${allKingdoms.length + 1},$${allKingdoms.length + 2})`).join(',');
          const values = [...allKingdoms.map(ak => ak.id), serverAnnounce, k.turn];
          await db.run(
            `INSERT INTO news (kingdom_id, type, message, turn_num) VALUES ${placeholders}`,
            values,
          );
        }
        if (engine.io)
          engine.io.emit("chat:system", {
            message: serverAnnounce,
            ts: Date.now(),
          });
      }

      // Save rewards to expedition row for log display
      const rewardJson = JSON.stringify(rewards.map((r) => r.text));
      await db.run("UPDATE expeditions SET rewards = ? WHERE id = ?", [
        rewardJson,
        exp.id,
      ]);
      console.log(
        `[expedition] completed kingdom=${k.id} type=${exp.type} rewards=${rewards.length}`,
      );
    } catch (err) {
      // Rewards failed ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â expedition is already marked complete (turns_left=0), troops return, no reward
      console.error(
        `[expedition] reward error kingdom=${k.id} id=${exp.id} type=${exp.type}:`,
        err.message,
        err.stack,
      );
      // Still return troops so they're not lost
      await db.run("UPDATE kingdoms SET rangers = rangers + ? WHERE id = ?", [
        exp.rangers,
        k.id,
      ]);
      if (exp.fighters > 0)
        await db.run(
          "UPDATE kingdoms SET fighters = fighters + ? WHERE id = ?",
          [exp.fighters, k.id],
        );
      const errMsg = `${exp.type} expedition returned ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â an error occurred calculating rewards (troops returned safely).`;
      await db.run("UPDATE expeditions SET rewards = ? WHERE id = ?", [
        JSON.stringify([errMsg]),
        exp.id,
      ]);
      await db.run(
        "INSERT INTO news (kingdom_id, type, message, turn_num) VALUES (?, ?, ?, ?)",
        [k.id, "system", errMsg, k.turn],
      );
      expeditionEvents.push({ type: "system", message: errMsg });
    }
  }
  return expeditionEvents;
}


module.exports = {
  computeExpeditionTransitions,
  junkPrize,
  expeditionRewards,
  resolveExpeditions,
};
