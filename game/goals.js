const { safeJsonParse, roll, rand } = require('../utils/helpers');
const config = require('./config');

const DAILY_GOALS = [
  { id: 'turn_taken', label: 'Take Turns', min: 20, max: 80, prizeStr: 'gold', prizeType: 'gold', prizeMult: 100 },
  { id: 'building_built', label: 'Construct Buildings', min: 10, max: 50, prizeStr: 'mana', prizeType: 'mana', prizeMult: 50 },
  { id: 'spell_cast', label: 'Cast Spells', min: 2, max: 6, prizeStr: 'rangers', prizeType: 'rangers', prizeMult: 10 },
  { id: 'expedition_started', label: 'Send Expeditions', min: 2, max: 5, prizeStr: 'gold', prizeType: 'gold', prizeMult: 200 }
];

const WEEKLY_GOALS = [
  { id: 'turn_taken', label: 'Take Turns', min: 200, max: 500, prizeStr: 'gold', prizeType: 'gold', prizeMult: 500 },
  { id: 'building_built', label: 'Construct Buildings', min: 100, max: 300, prizeStr: 'mana', prizeType: 'mana', prizeMult: 250 },
  { id: 'spell_cast', label: 'Cast Spells', min: 10, max: 30, prizeStr: 'researchers', prizeType: 'researchers', prizeMult: 5 },
  { id: 'attack_made', label: 'Attack Others', min: 3, max: 10, prizeStr: 'war_machines', prizeType: 'war_machines', prizeMult: 1 }
];

const MONTHLY_GOALS = [
  { id: 'expedition_started', label: 'Send Expeditions', min: 50, max: 100, prizeStr: 'world_fragment', prizeType: 'world_fragment', prizeMult: 1 },
  { id: 'attack_made', label: 'Attack Others', min: 20, max: 50, prizeStr: 'world_fragment', prizeType: 'world_fragment', prizeMult: 1 },
  { id: 'spell_cast', label: 'Cast Spells', min: 50, max: 150, prizeStr: 'world_fragment', prizeType: 'world_fragment', prizeMult: 1 },
  { id: 'building_built', label: 'Construct Buildings', min: 200, max: 500, prizeStr: 'world_fragment', prizeType: 'world_fragment', prizeMult: 1 }
];

const GOAL_COUNTS = {
  daily: { count: 3, resetMs: 24 * 60 * 60 * 1000 },
  weekly: { count: 7, resetMs: 7 * 24 * 60 * 60 * 1000 },
  monthly: { count: 4, resetMs: 30 * 24 * 60 * 60 * 1000 }
};

function generateGoals(k) {
  let goals = { daily: { expiresAt: 0, goals: [] }, weekly: { expiresAt: 0, goals: [] }, monthly: { expiresAt: 0, goals: [] } };
  try {
    if (k.goals && Object.keys(k.goals).length > 0) {
       goals = typeof k.goals === 'string' ? JSON.parse(k.goals) : k.goals;
    }
  } catch(e) {}

  if (!goals.daily) goals.daily = { expiresAt: 0, goals: [] };
  if (!goals.weekly) goals.weekly = { expiresAt: 0, goals: [] };
  if (!goals.monthly) goals.monthly = { expiresAt: 0, goals: [] };

  const now = Date.now();
  let updated = false;

  // Daily reset (24h)
  if (now > goals.daily.expiresAt) {
    goals.daily.expiresAt = now + 24 * 60 * 60 * 1000;
    goals.daily.goals = [];
    const pool = [...DAILY_GOALS].sort(() => 0.5 - Math.random());
    for(let i=0; i<3; i++) {
       const def = pool[i % pool.length];
       const target = rand(def.min, def.max);
       goals.daily.goals.push({
         id: def.id + '_' + now + '_' + i,
         type: def.id,
         label: def.label,
         target: target,
         progress: 0,
         claimed: false,
         prizeType: def.prizeType,
         prizeAmount: Math.max(1, Math.floor(target * def.prizeMult * (roll(0.5) ? 1.5 : 1)))
       });
    }
    updated = true;
  }

  // Weekly reset (7d)
  if (now > goals.weekly.expiresAt) {
    goals.weekly.expiresAt = now + 7 * 24 * 60 * 60 * 1000;
    goals.weekly.goals = [];
    const pool = [...WEEKLY_GOALS].sort(() => 0.5 - Math.random());
    for(let i=0; i<7; i++) {
       const def = pool[i % pool.length];
       const target = rand(def.min, def.max);
       goals.weekly.goals.push({
         id: def.id + '_' + now + '_' + i,
         type: def.id,
         label: def.label,
         target: target,
         progress: 0,
         claimed: false,
         prizeType: def.prizeType,
         prizeAmount: def.prizeType === 'world_fragment' ? rand(1, 2) : (def.prizeType === 'war_machines' ? rand(1, 2) : Math.max(1, Math.floor(target * def.prizeMult * (roll(0.5) ? 1.5 : 1))))
       });
    }
    updated = true;
  }

  // Monthly reset (30d)
  if (now > goals.monthly.expiresAt) {
    goals.monthly.expiresAt = now + 30 * 24 * 60 * 60 * 1000;
    goals.monthly.goals = [];
    const pool = [...MONTHLY_GOALS].sort(() => 0.5 - Math.random());
    for(let i=0; i<4; i++) {
       const def = pool[i % pool.length];
       const target = rand(def.min, def.max);
       goals.monthly.goals.push({
         id: def.id + '_' + now + '_' + i,
         type: def.id,
         label: def.label,
         target: target,
         progress: 0,
         claimed: false,
         prizeType: def.prizeType,
         prizeAmount: def.prizeType === 'world_fragment' ? rand(1, 3) : Math.max(1, Math.floor(target * def.prizeMult * (roll(0.5) ? 1.5 : 1)))
       });
    }
    updated = true;
  }

  return { goals, updated };
}

function progressGoal(k, updates, type, amount) {
  let goals = null;

  if (updates.goals) {
    goals = safeJsonParse(updates.goals, null);
  } else if (k.goals) {
    goals = safeJsonParse(k.goals, null);
  }

  const { goals: generatedGoals, updated: wasGenerated } = generateGoals({ goals: JSON.stringify(goals || {}) });
  goals = generatedGoals;

  let changed = wasGenerated;

  [goals.daily, goals.weekly, goals.monthly].forEach(period => {
    if (period && period.goals) {
      period.goals.forEach(g => {
        if (g.type === type && !g.claimed && g.progress < g.target) {
          g.progress = Math.min(g.target, g.progress + amount);
          changed = true;
        }
      });
    }
  });

  if (changed) {
    updates.goals = JSON.stringify(goals);
  }
}

function claimGoal(k, updates, events, groupId, goalId) {
   let goals = safeJsonParse(updates.goals || k.goals, null);
   if (!goals || !goals[groupId]) return { success: false, message: 'Invalid goal group' };

   const goal = goals[groupId].goals.find(g => g.id === goalId);
   if (!goal) return { success: false, message: 'Goal not found' };
   if (goal.progress < goal.target) return { success: false, message: 'Goal not yet complete' };
   if (goal.claimed) return { success: false, message: 'Already claimed' };

   goal.claimed = true;
   updates.goals = JSON.stringify(goals);

   if (goal.prizeType === 'world_fragment') {
     let frags = safeJsonParse(updates.world_fragments || k.world_fragments, []);
     const prizeAmount = goal.prizeAmount || 1;
     for(let i = 0; i < prizeAmount; i++) {
       frags.push(config.WORLD_FRAGMENTS[Math.floor(Math.random() * config.WORLD_FRAGMENTS.length)]);
     }
     updates.world_fragments = JSON.stringify(frags);
     events.push({ type: 'system', message: `Goal fulfilled: Obtained ${prizeAmount} World Fragments!` });
     return { success: true, message: `Claimed ${prizeAmount} world fragments!` };
   } else {
     updates[goal.prizeType] = (updates[goal.prizeType] || k[goal.prizeType] || 0) + goal.prizeAmount;
     events.push({ type: 'system', message: `Goal fulfilled: Gained ${goal.prizeAmount} ${goal.prizeType}!` });
     return { success: true, message: `Claimed ${goal.prizeAmount} ${goal.prizeType}!` };
   }
}

module.exports = {
  generateGoals,
  progressGoal,
  claimGoal,
  DAILY_GOALS,
  WEEKLY_GOALS,
  MONTHLY_GOALS,
  GOAL_COUNTS
};
