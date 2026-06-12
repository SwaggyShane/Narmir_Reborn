// XP and leveling domain: kingdom XP curve, level-up checks, milestone rewards,
// and per-activity XP awards.

const { safeJsonParse } = require('../utils/helpers');
const config = require('./config');
const { XP_RACE_BONUS, XP_BASE, MILESTONES } = config;

function xpForLevel(level, prestige = 0) {
  const targetLevel = Math.min(level, 500);
  if (targetLevel < 1) return 0;
  const base = config.XP_LEVELS[targetLevel] || 0;
  // Each prestige level requires 20% more XP per level
  const mult = 1.0 + (prestige * 0.2);
  return Math.floor(base * mult);
}

function xpToNextLevel(level, prestige = 0) {
  return xpForLevel(level + 1, prestige) - xpForLevel(level, prestige);
}

// Check all milestone levels passed between oldLevel and newLevel (inclusive).
// Grants one-time resources and accumulates permanent bonuses.
function checkMilestones(k, oldLevel, newLevel) {
  const events = [];
  let goldGrant = 0, landGrant = 0, fightersGrant = 0;
  let researchersGrant = 0, thievesGrant = 0, ninjasGrant = 0;
  let lastTitle = null;

  const claimed = safeJsonParse(k.milestones_claimed, {}, 'checkMilestones:claimed');
  const bonuses = safeJsonParse(k.milestone_bonuses, {}, 'checkMilestones:bonuses');

  // Step through each multiple of 25 that was passed this turn
  const firstMs = Math.ceil((oldLevel + 1) / 25) * 25;
  for (let lv = firstMs; lv <= newLevel; lv += 25) {
    if (claimed[lv]) continue;
    const ms = MILESTONES[lv];
    if (!ms) continue;

    const reward = ms.rewards[k.race] || ms.rewards.default || {};
    if (reward.bonus) {
      for (const [key, val] of Object.entries(reward.bonus)) {
        bonuses[key] = (bonuses[key] || 0) + val;
      }
    }

    goldGrant      += reward.gold         || 0;
    landGrant      += reward.land         || 0;
    fightersGrant  += reward.fighters     || 0;
    researchersGrant += reward.researchers || 0;
    thievesGrant   += reward.thieves      || 0;
    ninjasGrant    += reward.ninjas       || 0;
    claimed[lv] = true;
    lastTitle = ms.title;

    events.push({
      type: 'milestone',
      message: `🏆 Level ${lv} milestone — ${ms.title}! Resources granted.`,
    });
  }

  if (events.length === 0) return { updates: {}, events: [] };

  return {
    updates: {
      goldGrant, landGrant, fightersGrant,
      researchersGrant, thievesGrant, ninjasGrant,
      milestone_bonuses: JSON.stringify(bonuses),
      milestones_claimed: JSON.stringify(claimed),
      ...(lastTitle && { milestone_title: lastTitle }),
    },
    events,
  };
}

// Safe: xpForLevel(1000) = 4,990,005 — well within JS safe integer range
function levelFromXp(totalXp, prestige = 0) {
  let lo = 1,
    hi = 500;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (xpForLevel(mid, prestige) <= totalXp) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

function xpRaceBonus(k, activity) {
  const bonuses = XP_RACE_BONUS[k.race] || {};
  const base = bonuses.all || 1.0;
  return Math.max(base, bonuses[activity] || base);
}

// Award XP and check for level up — returns { xp, level, levelled, events, xp_sources }
function awardXp(k, activity, amount) {
  const currentLevel = k.level || 1;

  // Stop XP gain at level 500
  if (currentLevel >= 500) {
    const xpSources = safeJsonParse(k.xp_sources, {}, 'awardXp:xp_sources') || {};
    return { xp: k.xp || 0, level: 500, levelled: false, events: [], xp_sources: xpSources };
  }

  const mult = xpRaceBonus(k, activity);
  const cleanAmount = Number(amount) || 0;
  const earned = (XP_BASE[activity] || 10) * cleanAmount * mult;
  const newXp = Math.max(0, (k.xp || 0) + earned);
  const prestige = k.prestige_level || 0;
  const newLevel = Math.min(levelFromXp(newXp, prestige), 500);
  const levelled = newLevel > currentLevel;
  const events = [];

  if (levelled && newLevel >= 500) {
    events.push({
      type: 'system',
      message: config.STRINGS.LEVEL_500_ACHIEVED,
    });
  } else if (levelled) {
    events.push({
      type: 'system',
      message: `🌟 Kingdom reached Level ${newLevel}! (${earned.toLocaleString()} XP earned)`,
    });
  }

  // Track XP by source
  let xpSources = {};
  xpSources = safeJsonParse(k.xp_sources, {}, 'awardXp:xp_sources');
  if (!xpSources[activity]) xpSources[activity] = 0;
  xpSources[activity] += earned;

  return { xp: newXp, level: newLevel, earned, levelled, events, xp_sources: xpSources };
}

module.exports = {
  xpForLevel,
  xpToNextLevel,
  checkMilestones,
  levelFromXp,
  xpRaceBonus,
  awardXp,
};
