// Attunement domain: per-turn per-building fragment attunement effects.
// Each processXxxAttunements function applies the active fragment bonus for
// that building type, returning an updates object (and pushing to events).
//
// applyFragmentHappinessPenalty is a shared helper used by the Cursed
// Bloodstone and Void Essence attunements to accumulate persistent penalties.

const { safeJsonParse, roll } = require('../utils/helpers');
const fragmentBonusManager = require('./fragment-bonus-manager');
const config = require('./config');
const { CAPS, PRESTIGE_MODIFIERS } = config;

function levelCap(base, max, level, capLevel = 1000) {
  const lv = Math.max(1, Math.min(capLevel, level || 1));
  const range = capLevel - 1;
  if (range <= 0) return max;
  return Math.floor(base + ((max - base) * (lv - 1)) / range);
}

function getCap(field, level, prestigeLevel = 0) {
  const c = CAPS[field];
  if (!c) return Infinity;
  let baseCap = levelCap(c.base, c.max, level, c.capLevel || 1000);
  if (prestigeLevel > 0 && field.startsWith('bld_')) {
    const tier = PRESTIGE_MODIFIERS[Math.min(prestigeLevel, 5)];
    if (tier) {
      baseCap = Math.floor(baseCap * tier.bldCap);
    }
  }
  return baseCap;
}

// Accumulates -1 to active_effects.fragment_happiness_penalty (persistent across turns).
// calculateHappiness reads and applies the penalty; it decays +1/turn in the turn loop.
function applyFragmentHappinessPenalty(k, updates) {
  const existingEffectsStr = updates.active_effects !== undefined ? updates.active_effects : k.active_effects;
  const effects = safeJsonParse(existingEffectsStr, {}, 'fragment_penalty:active_effects');
  effects.fragment_happiness_penalty = (effects.fragment_happiness_penalty || 0) - 1;
  updates.active_effects = JSON.stringify(effects);
}

function processGranaryAttunements(k, events) {
  const updates = {};
  const granaryAttune = fragmentBonusManager.getFragmentForBuilding(k, 'granaries');

  if (!granaryAttune) {
    return updates;
  }

  const fragmentName = granaryAttune.fragment;
  let foodChange = 0;

  switch (fragmentName) {
    case 'Tears of the World Tree':
      // +2% food self-replication per turn based on current food stored
      foodChange = Math.floor((k.food || 0) * 0.02);
      if (foodChange > 0) {
        events.push({
          type: 'system',
          message: `💧 Tears of the World Tree: +${foodChange.toLocaleString()} food replicated from stored reserves.`
        });
      }
      break;

    case 'Void Essence':
      // 5% chance per turn food vanishes based on current food stored
      if (Math.random() < 0.05 && (k.food || 0) > 0) {
        const voidLoss = Math.floor((k.food || 0) * (0.1 + Math.random() * 0.3));
        foodChange = -voidLoss;
        events.push({
          type: 'system',
          message: `🌌 Void Essence: ${voidLoss.toLocaleString()} food consumed by the void!`
        });
      }
      break;

    case 'Celestial Feather': {
      // Portion of reserves distributed to boost happiness on unstable turns
      const happiness = k.happiness !== undefined && k.happiness !== null ? k.happiness : 50;
      if (happiness < 30 && (k.food || 0) > 0) {
        const happinessFoodCost = Math.max(1, Math.floor((k.food || 0) * 0.05));
        const happinessBoost = 10; // +10 happiness
        foodChange = -happinessFoodCost;
        events.push({
          type: 'system',
          message: `🪶 Manna Manifestation: ${happinessFoodCost.toLocaleString()} food distributed to raise happiness (+10).`
        });
        updates.happiness = Math.min(120, happiness + happinessBoost);
      }
      break;
    }

    case 'Cursed Bloodstone':
      // Vampiric Silos: dark elixir distillation spikes chaos, 10% chance -1 happiness
      if (roll(0.10)) {
        applyFragmentHappinessPenalty(k, updates);
        events.push({
          type: 'system',
          message: `🩸 Vampiric Silos: spoiled-food elixir distillation spikes local chaos (-1 happiness).`
        });
      }
      break;

    // Other fragments with passive-only abilities don't trigger special events
    // (Geothermal, Ancient Elven Wood, Dragon Scale, Abyssal Crystal, etc.)
  }

  if (foodChange !== 0) {
    const newFood = Math.max(0, (k.food || 0) + foodChange);
    updates.food = newFood;
  }

  return updates;
}

function processVaultAttunements(k, events = []) {
  const updates = {};
  if (!k.bld_vaults) return updates;

  const vaultAttune = fragmentBonusManager.getFragmentForBuilding(k, 'vaults');
  if (!vaultAttune) return updates;

  const fragmentName = vaultAttune.fragment;
  switch (fragmentName) {
    case 'Tears of the World Tree': {
      // Yggdrasil Resin Casings: amber resin compounds financial growth (+5 gold/vault/turn)
      const goldGain = k.bld_vaults * 5;
      updates.gold = (k.gold || 0) + goldGain;
      events.push({
        type: 'system',
        message: `💧 Yggdrasil Resin Casings: amber-preserved reserves grew by ${goldGain.toLocaleString()} gold.`
      });
      break;
    }

    case 'Cursed Bloodstone': {
      // Sanguine Vault Tax: dark alchemical currency, 10% chance civic instability (-1 happiness)
      if (roll(0.10)) {
        applyFragmentHappinessPenalty(k, updates);
        events.push({
          type: 'system',
          message: `🩸 Sanguine Vault Tax: dark alchemical currency spikes instability (-1 happiness).`
        });
      }
      break;
    }

    case 'Void Essence': {
      // Dimensional Pocket Vaults: 15% chance spatial lag from dimensional banking unsettles citizens
      if (roll(0.15)) {
        applyFragmentHappinessPenalty(k, updates);
        events.push({
          type: 'system',
          message: `🌌 Dimensional Pocket Vaults: spatial lag from sub-dimensional banking unsettles citizens (-1 happiness).`
        });
      }
      break;
    }
  }

  return updates;
}

function processWallsAttunements(k, events = []) {
  const updates = {};
  if (!k.bld_walls) return updates;

  const wallsAttune = fragmentBonusManager.getFragmentForBuilding(k, 'walls');
  if (!wallsAttune) return updates;

  const fragmentName = wallsAttune.fragment;
  switch (fragmentName) {
    case 'Dwarven Star-Metal': {
      // Geared Self-Construction: clockwork auto-repairs 1 wall per turn (capped at level cap)
      const wallCap = getCap('bld_walls', k.level || 1, k.prestige_level || 0);
      if ((k.bld_walls || 0) < wallCap) {
        updates.bld_walls = (k.bld_walls || 0) + 1;
        events.push({
          type: 'system',
          message: `⚙️ Geared Self-Construction: clockwork cog-wheels auto-repaired 1 wall section.`
        });
      }
      break;
    }

    case 'Cursed Bloodstone': {
      // Sanguine Blood-Thorns: dark magic thorns, 10% chance civic unrest (-1 happiness)
      if (roll(0.10)) {
        applyFragmentHappinessPenalty(k, updates);
        events.push({
          type: 'system',
          message: `🩸 Sanguine Blood-Thorns: bloodstone thorns creep beyond the walls, unsettling citizens (-1 happiness).`
        });
      }
      break;
    }
  }

  return updates;
}

function processGuardTowerAttunements(k, events = []) {
  const updates = {};
  if (!k.bld_guard_towers) return updates;

  const towerAttune = fragmentBonusManager.getFragmentForBuilding(k, 'guard_towers');
  if (!towerAttune) return updates;

  const fragmentName = towerAttune.fragment;
  switch (fragmentName) {
    case 'Cursed Bloodstone': {
      // Brimstone Signal Fire: crimson haze induces horror in the populace, 10% chance -1 happiness
      if (roll(0.10)) {
        applyFragmentHappinessPenalty(k, updates);
        events.push({
          type: 'system',
          message: `🩸 Brimstone Signal Fire: crimson haze from watch-towers induces horror (-1 happiness).`
        });
      }
      break;
    }

    case 'Void Essence': {
      // Astral Sight Rifts: spatial vertigo from shifted sentry platforms, 15% chance -1 happiness
      if (roll(0.15)) {
        applyFragmentHappinessPenalty(k, updates);
        events.push({
          type: 'system',
          message: `🌌 Astral Sight Rifts: spatial vertigo from sub-dimensional sentry platforms unsettles the populace (-1 happiness).`
        });
      }
      break;
    }
  }

  return updates;
}

function processOutpostAttunements(k, events = []) {
  const updates = {};
  if (!k.bld_outposts) return updates;

  const outpostAttune = fragmentBonusManager.getFragmentForBuilding(k, 'outposts');
  if (!outpostAttune) return updates;

  const fragmentName = outpostAttune.fragment;
  switch (fragmentName) {
    case 'Cursed Bloodstone': {
      // Sanguine Warning Totems: impaled sacrifices deteriorate scout sanity, 10% chance -1 happiness
      if (roll(0.10)) {
        applyFragmentHappinessPenalty(k, updates);
        events.push({
          type: 'system',
          message: `🩸 Sanguine Warning Totems: necrotic runes deteriorate scout sanity (-1 happiness).`
        });
      }
      break;
    }
  }

  return updates;
}

function processTrainingAttunements(k, events = []) {
  const updates = {};
  if (!k.bld_training) return updates;

  const trainingAttune = fragmentBonusManager.getFragmentForBuilding(k, 'training');
  if (!trainingAttune) return updates;

  const fragmentName = trainingAttune.fragment;
  switch (fragmentName) {
    case 'Cursed Bloodstone': {
      // Crucible Agony Training: chaotic blood rites reduce tactical compliance, 10% chance -1 happiness
      if (roll(0.10)) {
        applyFragmentHappinessPenalty(k, updates);
        events.push({
          type: 'system',
          message: `🩸 Crucible Agony Training: chaotic blood rites reduce tactical compliance (-1 happiness).`
        });
      }
      break;
    }

    case 'Void Essence': {
      // Dimensional Slip Sparring: sensory displacement from phase-slip drills, 15% chance -1 happiness
      if (roll(0.15)) {
        applyFragmentHappinessPenalty(k, updates);
        events.push({
          type: 'system',
          message: `🌌 Dimensional Slip Sparring: sensory displacement from phase-slip drills unsettles troops (-1 happiness).`
        });
      }
      break;
    }
  }

  return updates;
}

function processBarracksAttunements(k, events = []) {
  const updates = {};
  if (!k.bld_barracks) return updates;

  const barracksAttune = fragmentBonusManager.getFragmentForBuilding(k, 'barracks');
  if (!barracksAttune) return updates;

  const fragmentName = barracksAttune.fragment;
  switch (fragmentName) {
    case 'Cursed Bloodstone': {
      // Sanguine Ritual Circles: blood rituals multiply recruit rates but civil unrest risks -1 happiness (10%)
      if (roll(0.10)) {
        applyFragmentHappinessPenalty(k, updates);
        events.push({
          type: 'system',
          message: `🩸 Sanguine Ritual Circles: dark blood rites spark civil unrest (-1 happiness).`
        });
      }
      break;
    }
  }

  return updates;
}

function processCastleAttunements(k, events = []) {
  const updates = {};
  if (!k.bld_castles) return updates;

  const castleAttune = fragmentBonusManager.getFragmentForBuilding(k, 'castles');
  if (!castleAttune) return updates;

  const fragmentName = castleAttune.fragment;
  switch (fragmentName) {
    case 'Tears of the World Tree': {
      // Elder Sap Tapestries: living sap tapestries boost tax yields (+3 gold per castle)
      const gain = (k.bld_castles || 0) * 3;
      updates.gold = (k.gold || 0) + gain;
      events.push({
        type: 'system',
        message: `🌿 Elder Sap Tapestries: living sap tapestries boost tax yields (+${gain} gold).`
      });
      break;
    }

    case 'Cursed Bloodstone': {
      // Blood-Sacrifice Vaults: dark blood rites scare away foreign envoys, 10% chance -1 happiness
      if (roll(0.10)) {
        applyFragmentHappinessPenalty(k, updates);
        events.push({
          type: 'system',
          message: `🩸 Blood-Sacrifice Vaults: dark blood rites frighten foreign envoys (-1 happiness).`
        });
      }
      break;
    }

    case 'Void Essence': {
      // Astral Phasing Throne: void instability unsettles castle residents, 15% chance -1 happiness
      if (roll(0.15)) {
        applyFragmentHappinessPenalty(k, updates);
        events.push({
          type: 'system',
          message: `🌌 Astral Phasing Throne: void instability unsettles castle residents (-1 happiness).`
        });
      }
      break;
    }
  }

  return updates;
}

function processMausoleumAttunements(k, events = []) {
  const updates = {};
  if (!k.bld_mausoleums) return updates;

  const mausAttune = fragmentBonusManager.getFragmentForBuilding(k, 'mausoleums');
  if (!mausAttune) return updates;

  const fragmentName = mausAttune.fragment;
  switch (fragmentName) {
    case 'Cursed Bloodstone': {
      // Cruor Coils: triples reanimation yields but causes local panic, 10% chance -1 happiness
      if (roll(0.10)) {
        applyFragmentHappinessPenalty(k, updates);
        events.push({
          type: 'system',
          message: `🩸 Cruor Coils: bloodstone reanimation channels cause local populations to panic (-1 happiness).`
        });
      }
      break;
    }

    case 'Void Essence': {
      // Shattered Portal Sarcophagi: void tear-rifts cause mild local disorientation, 15% chance -1 happiness
      if (roll(0.15)) {
        applyFragmentHappinessPenalty(k, updates);
        events.push({
          type: 'system',
          message: `🌌 Shattered Portal Sarcophagi: void tear-rifts disorient local populations (-1 happiness).`
        });
      }
      break;
    }
  }

  return updates;
}

function processLibraryAttunements(k, events = []) {
  const updates = {};
  if (!k.bld_libraries) return updates;

  const libAttune = fragmentBonusManager.getFragmentForBuilding(k, 'libraries');
  if (!libAttune) return updates;

  const fragmentName = libAttune.fragment;
  switch (fragmentName) {
    case 'Cursed Bloodstone': {
      // Sanguine Cartography: blood-drawn maps cause intense psychological stress, 10% chance -1 happiness
      if (roll(0.10)) {
        applyFragmentHappinessPenalty(k, updates);
        events.push({
          type: 'system',
          message: `🩸 Sanguine Cartography: blood-drawn maps cause intense psychological stress (-1 happiness).`
        });
      }
      break;
    }

    case 'Void Essence': {
      // Void Codex: unpredictable research chaos unsettles scholars, 15% chance -1 happiness
      if (roll(0.15)) {
        applyFragmentHappinessPenalty(k, updates);
        events.push({
          type: 'system',
          message: `🌌 Void Codex: chaotic research regression unsettles library scholars (-1 happiness).`
        });
      }
      break;
    }
  }

  return updates;
}

function processMageTowerAttunements(k, events = []) {
  const updates = {};
  if (!k.bld_mage_towers) return updates;

  const mtAttune = fragmentBonusManager.getFragmentForBuilding(k, 'mage_towers');
  if (!mtAttune) return updates;

  const fragmentName = mtAttune.fragment;
  switch (fragmentName) {
    case 'Cursed Bloodstone': {
      // Sanguine Battery: feeding citizen lifeforce to spellpools causes unrest, 10% chance -1 happiness
      if (roll(0.10)) {
        applyFragmentHappinessPenalty(k, updates);
        events.push({
          type: 'system',
          message: `🩸 Sanguine Battery: draining citizen lifeforce into spellpools sparks unrest (-1 happiness).`
        });
      }
      break;
    }

    case 'Void Essence': {
      // Portal Conduits: local portal leaks disorient citizens, 15% chance -1 happiness
      if (roll(0.15)) {
        applyFragmentHappinessPenalty(k, updates);
        events.push({
          type: 'system',
          message: `🌌 Portal Conduits: void portal leaks disorient local citizens (-1 happiness).`
        });
      }
      break;
    }
  }

  return updates;
}

function processSchoolAttunements(k, events = []) {
  const updates = {};
  if (!k.bld_schools) return updates;

  const schoolAttune = fragmentBonusManager.getFragmentForBuilding(k, 'schools');
  if (!schoolAttune) return updates;

  const fragmentName = schoolAttune.fragment;
  switch (fragmentName) {
    case 'Cursed Bloodstone': {
      // Taboo Alchemical Arts: forbidden experiments raise local chaos, 10% chance -1 happiness
      if (roll(0.10)) {
        applyFragmentHappinessPenalty(k, updates);
        events.push({
          type: 'system',
          message: `🩸 Taboo Alchemical Arts: forbidden humors experiments spark local chaos (-1 happiness).`
        });
      }
      break;
    }

    case 'Void Essence': {
      // Quantum Paradoxes: multi-dimensional absences cause unrest, 15% chance -1 happiness
      if (roll(0.15)) {
        applyFragmentHappinessPenalty(k, updates);
        events.push({
          type: 'system',
          message: `🌌 Quantum Paradoxes: unexplained student absences unsettle the population (-1 happiness).`
        });
      }
      break;
    }
  }

  return updates;
}

function processFarmAttunements(k, events = []) {
  const updates = {};
  if (!k.bld_farms) return updates;

  const farmAttune = fragmentBonusManager.getFragmentForBuilding(k, 'farms');
  if (!farmAttune) return updates;

  const fragmentName = farmAttune.fragment;
  switch (fragmentName) {
    case 'Cursed Bloodstone': {
      // Bloodsoaked Fields: unstable cursed harvests cause periodic unrest, 10% chance -1 happiness
      if (roll(0.10)) {
        applyFragmentHappinessPenalty(k, updates);
        events.push({
          type: 'system',
          message: `🩸 Bloodsoaked Fields: cursed harvests trigger peasant unrest (-1 happiness).`
        });
      }
      break;
    }

    case 'Void Essence': {
      // Void Crops: 20% chance crops either yield a bonus or fail catastrophically
      if (roll(0.20)) {
        const bounty = roll(0.50);
        const change = (k.bld_farms || 0) * 10;
        if (bounty) {
          updates.food = (k.food || 0) + change;
          events.push({
            type: 'system',
            message: `🌌 Void Crops: void-touched fields yield a massive surplus (+${change} food).`
          });
        } else {
          updates.food = Math.max(0, (k.food || 0) - change);
          events.push({
            type: 'system',
            message: `🌌 Void Crops: void instability causes crop failure (-${change} food).`
          });
        }
      }
      break;
    }
  }

  return updates;
}

function processSmithyAttunements(k, events = []) {
  const updates = {};
  if (!k.bld_smithies) return updates;

  const smithyAttune = fragmentBonusManager.getFragmentForBuilding(k, 'smithies');
  if (!smithyAttune) return updates;

  const fragmentName = smithyAttune.fragment;
  switch (fragmentName) {
    case 'Cursed Bloodstone': {
      // Sanguine Crucible: lifeforce sacrificed into crucibles causes local chaos, 10% chance -1 happiness
      if (roll(0.10)) {
        applyFragmentHappinessPenalty(k, updates);
        events.push({
          type: 'system',
          message: `🩸 Sanguine Crucible: lifeforce sacrifices into crucibles cause local chaos (-1 happiness).`
        });
      }
      break;
    }

    case 'Void Essence': {
      // Quantum Portal Anvils: spatial lag from dimensional duplication unsettles workers, 15% chance -1 happiness
      if (roll(0.15)) {
        applyFragmentHappinessPenalty(k, updates);
        events.push({
          type: 'system',
          message: `🌌 Quantum Portal Anvils: spatial lag from dimensional forging unsettles workers (-1 happiness).`
        });
      }
      break;
    }
  }

  return updates;
}

function processMarketAttunements(k, events = []) {
  const updates = {};
  if (!k.bld_markets) return updates;

  const marketAttune = fragmentBonusManager.getFragmentForBuilding(k, 'markets');
  if (!marketAttune) return updates;

  const fragmentName = marketAttune.fragment;
  switch (fragmentName) {
    case 'Cursed Bloodstone': {
      // Sanguine Auction Guilds: forbidden life contracts spike chaos, 10% chance -1 happiness
      if (roll(0.10)) {
        applyFragmentHappinessPenalty(k, updates);
        events.push({
          type: 'system',
          message: `🩸 Sanguine Auction Guilds: forbidden life-contract auctions spike civil chaos (-1 happiness).`
        });
      }
      break;
    }

    case 'Void Essence': {
      // Quantum Shopping Matrix: multi-planar trade causes temporary citizen absences, 15% chance -1 happiness
      if (roll(0.15)) {
        applyFragmentHappinessPenalty(k, updates);
        events.push({
          type: 'system',
          message: `🌌 Quantum Shopping Matrix: citizens temporarily lost to inter-planar trade channels (-1 happiness).`
        });
      }
      break;
    }
  }

  return updates;
}

function processShrineAttunements(k, events = []) {
  const updates = {};
  if (!k.bld_shrines) return updates;

  const shrineAttune = fragmentBonusManager.getFragmentForBuilding(k, 'shrines');
  if (!shrineAttune) return updates;

  const fragmentName = shrineAttune.fragment;
  switch (fragmentName) {
    case 'Cursed Bloodstone': {
      // Sanguine Transfusion: dark lifeforce transmutation raises chaotic corruption, 10% chance -1 happiness
      if (roll(0.10)) {
        applyFragmentHappinessPenalty(k, updates);
        events.push({
          type: 'system',
          message: `🩸 Sanguine Transfusion: dark lifeforce transmutation raises chaotic corruption (-1 happiness).`
        });
      }
      break;
    }

    case 'Void Essence': {
      // Telescopic Epiphany: cosmic rift knowledge drives scholars to eccentricity, 15% chance -1 happiness
      if (roll(0.15)) {
        applyFragmentHappinessPenalty(k, updates);
        events.push({
          type: 'system',
          message: `🌌 Telescopic Epiphany: cosmic rift visions drive shrine scholars to eccentricity (-1 happiness).`
        });
      }
      break;
    }
  }

  return updates;
}

function processTavernAttunements(k, events = []) {
  const updates = {};
  if (!k.bld_taverns) return updates;

  const tavernAttune = fragmentBonusManager.getFragmentForBuilding(k, 'taverns');
  if (!tavernAttune) return updates;

  const fragmentName = tavernAttune.fragment;
  switch (fragmentName) {
    case 'Cursed Bloodstone': {
      // The Cruor Blood Club: forbidden nectar spikes civil chaos index, 10% chance -1 happiness
      if (roll(0.10)) {
        applyFragmentHappinessPenalty(k, updates);
        events.push({
          type: 'system',
          message: `🩸 The Cruor Blood Club: forbidden nectar brews spike civil chaos (-1 happiness).`
        });
      }
      break;
    }

    case 'Void Essence': {
      // The Singularity Saloon: brief spatial absences from interdimensional taprooms, 15% chance -1 happiness
      if (roll(0.15)) {
        applyFragmentHappinessPenalty(k, updates);
        events.push({
          type: 'system',
          message: `🌌 The Singularity Saloon: brief spatial absences from interdimensional tap-rooms unsettle citizens (-1 happiness).`
        });
      }
      break;
    }
  }

  return updates;
}

function processHousingAttunements(k, events = []) {
  const updates = {};
  if (!k.bld_housing) return updates;

  const housingAttune = fragmentBonusManager.getFragmentForBuilding(k, 'housing');
  if (!housingAttune) return updates;

  const fragmentName = housingAttune.fragment;
  switch (fragmentName) {
    case 'Cursed Bloodstone': {
      // Blood Pact Lodgings: dark covenant instability causes periodic civil unrest, 10% chance -1 happiness
      if (roll(0.10)) {
        applyFragmentHappinessPenalty(k, updates);
        events.push({
          type: 'system',
          message: `🩸 Blood Pact Lodgings: dark covenant instability sparks civil unrest (-1 happiness).`
        });
      }
      break;
    }

    case 'Void Essence': {
      // Void Pocket Lofts: dimensional disorientation unsettles residents, 15% chance -1 happiness
      if (roll(0.15)) {
        applyFragmentHappinessPenalty(k, updates);
        events.push({
          type: 'system',
          message: `🌌 Void Pocket Lofts: dimensional disorientation unsettles residents (-1 happiness).`
        });
      }
      break;
    }
  }

  return updates;
}

module.exports = {
  applyFragmentHappinessPenalty,
  processGranaryAttunements,
  processVaultAttunements,
  processWallsAttunements,
  processGuardTowerAttunements,
  processOutpostAttunements,
  processTrainingAttunements,
  processBarracksAttunements,
  processCastleAttunements,
  processMausoleumAttunements,
  processLibraryAttunements,
  processMageTowerAttunements,
  processSchoolAttunements,
  processFarmAttunements,
  processSmithyAttunements,
  processMarketAttunements,
  processShrineAttunements,
  processTavernAttunements,
  processHousingAttunements,
};
