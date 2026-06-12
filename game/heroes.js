// Heroes domain: hero recruitment, leveling, power calculation, and passive turn bonuses.
// Each hero class has unique passive abilities applied during turns and combat.

const config = require('./config');
const { HERO_CLASSES } = config;

function heroXpForLevel(level) {
  if (level <= 1) return 0;
  return Math.floor(500000 * Math.pow((level - 1) / 24, 2.5));
}

function awardHeroXp(hero, xpAmount) {
  const newXp = hero.xp + xpAmount;
  let newLevel = hero.level;
  while (newXp >= heroXpForLevel(newLevel + 1) && newLevel < 25) {
    newLevel++;
  }
  return { level: newLevel, xp: newXp };
}

function getHeroPower(hero) {
  let basePower = hero.level * 1000; // Base power for combat/expeditions
  if (hero.class === 'warlord') basePower *= 1.5;
  if (hero.class === 'siegebreaker') basePower *= 1.3;
  if (hero.class === 'paladin') basePower *= 1.2;
  if (hero.class === 'alpha') basePower *= 1.4;
  if (hero.class === 'grand_chancellor') basePower *= 0.5; // less combat focused
  if (hero.class === 'forge_lord') basePower *= 0.7;
  return basePower;
}

function applyHeroTurnBonuses(hero, k, updates, events) {
  const cls = HERO_CLASSES[hero.class];
  if (!cls || !cls.statBonus) return;

  if (hero.class === 'grand_chancellor') {
    // Golden Touch: Collect +250 gold per turn per level
    const bonus = Math.floor(hero.level * 250);
    updates.gold =
      (updates.gold !== undefined ? updates.gold : k.gold) + bonus;
    if (events)
      events.push({
        type: 'system',
        message: `👑 Grand Chancellor's Golden Touch: +${bonus.toLocaleString()} gold.`,
      });
  } else if (hero.class === 'archmage') {
    // Mana infusion: Extra mana
    const bonus = Math.floor(hero.level * 100);
    updates.mana =
      (updates.mana !== undefined ? updates.mana : k.mana) + bonus;
    if (events)
      events.push({
        type: 'system',
        message: `🧙 Archmage Mana Infusion: +${bonus.toLocaleString()} mana.`,
      });
  } else if (hero.class === 'paladin') {
    // Protective Aura: Health regeneration or morale boost
    const currentMorale =
      updates.morale !== undefined
        ? updates.morale
        : k.morale !== undefined && k.morale !== null
          ? k.morale
          : 100;
    updates.morale = Math.min(100, currentMorale + 1);
  } else if (hero.class === 'warlord') {
    // Warlord: Morale boost
    const currentMorale =
      updates.morale !== undefined
        ? updates.morale
        : k.morale !== undefined && k.morale !== null
          ? k.morale
          : 100;
    const oldMorale = currentMorale;
    updates.morale = Math.min(100, currentMorale + 2);
    const _mDelta = updates.morale - oldMorale;
  } else if (hero.class === 'forge_lord') {
    // Forge Lord: Gold income
    const bonus = Math.floor(hero.level * 300);
    updates.gold =
      (updates.gold !== undefined ? updates.gold : k.gold) + bonus;
    if (events)
      events.push({
        type: 'system',
        message: `🛠️ Forge Lord Industrialism: +${bonus.toLocaleString()} gold.`,
      });
  } else if (hero.class === 'alpha') {
    // Alpha: Food and morale
    const foodBonus = Math.floor(hero.level * 500);
    updates.food =
      (updates.food !== undefined ? updates.food : k.food) + foodBonus;
    const currentMorale =
      updates.morale !== undefined
        ? updates.morale
        : k.morale !== undefined && k.morale !== null
          ? k.morale
          : 100;
    updates.morale = Math.min(100, currentMorale + 1);
    if (events) {
      events.push({
        type: 'system',
        message: `🐺 Alpha Hunting: +${foodBonus.toLocaleString()} food.`,
      });
    }
  } else if (hero.class === 'blood_shaman') {
    // Blood Shaman: Converts population to mana
    const currentPop =
      updates.population !== undefined ? updates.population : k.population;
    if (currentPop > 1000) {
      const sacrificed = Math.floor(hero.level * 5);
      updates.population = currentPop - sacrificed;
      const manaBonus = sacrificed * 50;
      updates.mana =
        (updates.mana !== undefined ? updates.mana : k.mana) + manaBonus;
      if (events)
        events.push({
          type: 'system',
          message: `🩸 Blood Shaman Sacrifice: ${sacrificed.toLocaleString()} population consumed for +${manaBonus.toLocaleString()} mana.`,
        });
    }
  } else if (hero.class === 'mage_king') {
    // Leyline Control: Massive boost to Mana generation
    const bonus = Math.floor(hero.level * 150);
    updates.mana =
      (updates.mana !== undefined ? updates.mana : k.mana) + bonus;
    if (events)
      events.push({
        type: 'system',
        message: `✨ Mage King Leyline Control: +${bonus.toLocaleString()} mana.`,
      });
  } else if (hero.class === 'shadowmaster') {
    // Shadowmaster: Stealth income
    const bonus = Math.floor(hero.level * 200);
    updates.res_stealth =
      (updates.res_stealth !== undefined ? updates.res_stealth : k.res_stealth || 0) + bonus;
    if (events)
      events.push({
        type: 'system',
        message: `🌑 Silent Shadow Espionage: +${bonus.toLocaleString()} stealth.`,
      });
  } else if (hero.class === 'high_consul') {
    // High Consul: Diplomacy boost
    const bonus = Math.floor(hero.level * 100);
    updates.prestige =
      (updates.prestige !== undefined ? updates.prestige : k.prestige || 0) + bonus;
    if (events)
      events.push({
        type: 'system',
        message: `🤝 Diplomat Influence: +${bonus.toLocaleString()} prestige.`,
      });
  }
  // All other classes' abilities are multiplier-based and flow through
  // their statBonus via raceBonus() (military, economy, magic, research,
  // stealth, covert, defense, happiness, population, diplomacy, etc.)
}

function recruitHero(k, heroName, heroClass) {
  const cls = HERO_CLASSES[heroClass];
  if (!cls) return { error: 'Invalid hero class' };

  if (cls.races && !cls.races.includes(k.race)) {
    return { error: `The ${cls.name} class cannot be recruited by ${k.race}s` };
  }

  if (k.gold < cls.recruitCost)
    return { error: `Need ${cls.recruitCost.toLocaleString()} gold` };
  if (k.mana < cls.recruitMana)
    return { error: `Need ${cls.recruitMana.toLocaleString()} mana` };
  if (k.bld_castles < 1)
    return { error: 'Requires a Castle to house a Hero' };

  return {
    hero: {
      name: heroName,
      class: heroClass,
      level: 1,
      xp: 0,
      abilities: JSON.stringify(cls.abilities),
      hp: 200,
      max_hp: 200,
      status: 'idle',
    },
    cost: { gold: cls.recruitCost, mana: cls.recruitMana },
  };
}

module.exports = {
  heroXpForLevel,
  awardHeroXp,
  getHeroPower,
  applyHeroTurnBonuses,
  recruitHero,
};
