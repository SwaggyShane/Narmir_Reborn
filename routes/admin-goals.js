'use strict';

// Goal definitions (daily/weekly/monthly) admin CRUD — split out of
// routes/admin.js (A2-9, 2026-07-19). Exports refreshInMemoryGoals for
// lib/boot.js, which calls it once at server startup to apply any DB
// overrides on top of the game/goals.js defaults.
// requireAdmin + CSRF are applied once by the composer (routes/admin.js)
// before this router is mounted.

const express = require('express');
const { DAILY_GOALS, WEEKLY_GOALS, MONTHLY_GOALS } = require('../game/goals');

const ALLOWED_PRIZE_TYPES = ['gold', 'mana', 'rangers', 'researchers', 'war_machines', 'world_fragment'];

let ORIGINAL_DAILY_GOALS = [];
let ORIGINAL_WEEKLY_GOALS = [];
let ORIGINAL_MONTHLY_GOALS = [];

async function refreshInMemoryGoals(db) {
  try {
    if (ORIGINAL_DAILY_GOALS.length === 0) {
      ORIGINAL_DAILY_GOALS = DAILY_GOALS.map(g => ({ ...g }));
      ORIGINAL_WEEKLY_GOALS = WEEKLY_GOALS.map(g => ({ ...g }));
      ORIGINAL_MONTHLY_GOALS = MONTHLY_GOALS.map(g => ({ ...g }));
    }

    const overrides = await db.all(
      `SELECT tier, goal_id, label, min_target, max_target, prize_type, prize_multiplier, active
       FROM admin_goal_definitions ORDER BY tier, goal_id`
    );

    DAILY_GOALS.length = 0;
    DAILY_GOALS.push(...ORIGINAL_DAILY_GOALS.map(g => ({ ...g })));

    WEEKLY_GOALS.length = 0;
    WEEKLY_GOALS.push(...ORIGINAL_WEEKLY_GOALS.map(g => ({ ...g })));

    MONTHLY_GOALS.length = 0;
    MONTHLY_GOALS.push(...ORIGINAL_MONTHLY_GOALS.map(g => ({ ...g })));

    for (const override of overrides) {
      const tier = override.tier;
      const pool = tier === 'daily' ? DAILY_GOALS : tier === 'weekly' ? WEEKLY_GOALS : tier === 'monthly' ? MONTHLY_GOALS : null;
      if (!pool) continue;

      const idx = pool.findIndex(g => g.id === override.goal_id);

      if (override.active === 0) {
        if (idx !== -1) {
          pool.splice(idx, 1);
        }
      } else {
        if (idx !== -1) {
          pool[idx] = {
            ...pool[idx],
            label: override.label,
            min: override.min_target,
            max: override.max_target,
            prizeStr: override.prize_type,
            prizeType: override.prize_type,
            prizeMult: override.prize_multiplier
          };
        } else {
          pool.push({
            id: override.goal_id,
            label: override.label,
            min: override.min_target,
            max: override.max_target,
            prizeStr: override.prize_type,
            prizeType: override.prize_type,
            prizeMult: override.prize_multiplier
          });
        }
      }
    }
  } catch (err) {
    console.error("[admin] Error refreshing goals:", err.message);
  }
}

const router = express.Router();

module.exports = function (db) {

  router.get("/goals", async (_req, res) => {
    res.json({
      daily: DAILY_GOALS,
      weekly: WEEKLY_GOALS,
      monthly: MONTHLY_GOALS
    });
  });

  router.post("/goals/edit", async (req, res) => {
    const { tier, goalId, label, minTarget, maxTarget, prizeType, prizeMultiplier } = req.body;

    if (!tier || !goalId) {
      return res.status(400).json({ error: "tier and goalId required" });
    }

    const validTiers = ['daily', 'weekly', 'monthly'];
    if (!validTiers.includes(tier)) {
      return res.status(400).json({ error: "Invalid tier (daily/weekly/monthly)" });
    }

    // Validation
    if (minTarget !== undefined && (minTarget < 1 || minTarget > 500)) {
      return res.status(400).json({ error: "minTarget must be between 1 and 500" });
    }
    if (maxTarget !== undefined && (maxTarget < 2 || maxTarget > 1000)) {
      return res.status(400).json({ error: "maxTarget must be between 2 and 1000" });
    }
    if (prizeMultiplier !== undefined && (prizeMultiplier < 0.5 || prizeMultiplier > 100)) {
      return res.status(400).json({ error: "prizeMultiplier must be between 0.5 and 100" });
    }
    if (prizeType !== undefined && !ALLOWED_PRIZE_TYPES.includes(prizeType)) {
      return res.status(400).json({ error: `Invalid prizeType. Allowed: ${ALLOWED_PRIZE_TYPES.join(', ')}` });
    }

    try {
      const existing = await db.get(
        `SELECT min_target, max_target FROM admin_goal_definitions WHERE tier = $1 AND goal_id = $2 AND active = 1`,
        [tier, goalId]
      );

      const defaultsPool = tier === 'daily' ? DAILY_GOALS : tier === 'weekly' ? WEEKLY_GOALS : tier === 'monthly' ? MONTHLY_GOALS : [];
      const defaultGoal = defaultsPool.find(g => g.id === goalId);
      if (!existing && !defaultGoal) {
        return res.status(404).json({ error: "Goal not found in defaults or overrides" });
      }

      const currentMin = existing ? existing.min_target : defaultGoal.min;
      const currentMax = existing ? existing.max_target : defaultGoal.max;
      const finalMin = minTarget !== undefined ? minTarget : currentMin;
      const finalMax = maxTarget !== undefined ? maxTarget : currentMax;

      if (finalMin >= finalMax) {
        return res.status(400).json({ error: "minTarget must be less than maxTarget" });
      }

      if (existing) {
        await db.run(
          `UPDATE admin_goal_definitions
           SET label = COALESCE($1, label),
               min_target = COALESCE($2, min_target),
               max_target = COALESCE($3, max_target),
               prize_type = COALESCE($4, prize_type),
               prize_multiplier = COALESCE($5, prize_multiplier),
               updated_at = CURRENT_TIMESTAMP
           WHERE tier = $6 AND goal_id = $7 AND active = 1`,
          [
            label !== undefined ? label : null,
            minTarget !== undefined ? minTarget : null,
            maxTarget !== undefined ? maxTarget : null,
            prizeType !== undefined ? prizeType : null,
            prizeMultiplier !== undefined ? prizeMultiplier : null,
            tier,
            goalId
          ]
        );
      } else {
        await db.run(
          `INSERT INTO admin_goal_definitions (tier, goal_id, label, min_target, max_target, prize_type, prize_multiplier, active)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 1)`,
          [
            tier,
            goalId,
            label !== undefined ? label : defaultGoal.label,
            minTarget !== undefined ? minTarget : defaultGoal.min,
            maxTarget !== undefined ? maxTarget : defaultGoal.max,
            prizeType !== undefined ? prizeType : defaultGoal.prizeType,
            prizeMultiplier !== undefined ? prizeMultiplier : defaultGoal.prizeMult
          ]
        );
      }

      await refreshInMemoryGoals(db);
      res.json({ ok: true, message: "Goal updated successfully" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post("/goals/add", async (req, res) => {
    const { tier, goalId, label, minTarget, maxTarget, prizeType, prizeMultiplier } = req.body;

    if (!tier || !goalId || !label || minTarget === undefined || maxTarget === undefined || !prizeType || prizeMultiplier === undefined) {
      return res.status(400).json({ error: "All fields required: tier, goalId, label, minTarget, maxTarget, prizeType, prizeMultiplier" });
    }

    const validTiers = ['daily', 'weekly', 'monthly'];
    if (!validTiers.includes(tier)) {
      return res.status(400).json({ error: "Invalid tier (daily/weekly/monthly)" });
    }

    // Validation
    if (minTarget < 1 || minTarget > 500) {
      return res.status(400).json({ error: "minTarget must be between 1 and 500" });
    }
    if (maxTarget < 2 || maxTarget > 1000) {
      return res.status(400).json({ error: "maxTarget must be between 2 and 1000" });
    }
    if (minTarget >= maxTarget) {
      return res.status(400).json({ error: "minTarget must be less than maxTarget" });
    }
    if (prizeMultiplier < 0.5 || prizeMultiplier > 10000) {
      return res.status(400).json({ error: "prizeMultiplier must be between 0.5 and 10000" });
    }
    if (!['gold', 'mana', 'rangers', 'researchers', 'war_machines', 'world_fragment'].includes(prizeType)) {
      return res.status(400).json({ error: `Invalid prizeType. Allowed: ${['gold', 'mana', 'rangers', 'researchers', 'war_machines', 'world_fragment'].join(', ')}` });
    }

    try {
      await db.run(
        `INSERT INTO admin_goal_definitions (tier, goal_id, label, min_target, max_target, prize_type, prize_multiplier, active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 1)
         ON CONFLICT (tier, goal_id) DO UPDATE SET
           label = EXCLUDED.label,
           min_target = EXCLUDED.min_target,
           max_target = EXCLUDED.max_target,
           prize_type = EXCLUDED.prize_type,
           prize_multiplier = EXCLUDED.prize_multiplier,
           active = 1,
           updated_at = CURRENT_TIMESTAMP`,
        [tier, goalId, label, minTarget, maxTarget, prizeType, prizeMultiplier]
      );
      await refreshInMemoryGoals(db);
      res.json({ ok: true, message: "Goal added successfully" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post("/goals/remove", async (req, res) => {
    const { tier, goalId } = req.body;

    if (!tier || !goalId) {
      return res.status(400).json({ error: "tier and goalId required" });
    }

    const validTiers = ['daily', 'weekly', 'monthly'];
    if (!validTiers.includes(tier)) {
      return res.status(400).json({ error: "Invalid tier (daily/weekly/monthly)" });
    }

    try {
      const existing = await db.get(
        `SELECT 1 FROM admin_goal_definitions WHERE tier = $1 AND goal_id = $2`,
        [tier, goalId]
      );

      if (existing) {
        await db.run(
          `UPDATE admin_goal_definitions SET active = 0, updated_at = CURRENT_TIMESTAMP WHERE tier = $1 AND goal_id = $2`,
          [tier, goalId]
        );
      } else {
        const defaultsPool = tier === 'daily' ? DAILY_GOALS : tier === 'weekly' ? WEEKLY_GOALS : tier === 'monthly' ? MONTHLY_GOALS : [];
        const defaultGoal = defaultsPool.find(g => g.id === goalId);
        if (!defaultGoal) {
          return res.status(404).json({ error: "Goal not found" });
        }

        await db.run(
          `INSERT INTO admin_goal_definitions (tier, goal_id, label, min_target, max_target, prize_type, prize_multiplier, active)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 0)`,
          [tier, goalId, defaultGoal.label, defaultGoal.min, defaultGoal.max, defaultGoal.prizeType, defaultGoal.prizeMult]
        );
      }

      await refreshInMemoryGoals(db);
      res.json({ ok: true, message: "Goal removed successfully" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};

module.exports.refreshInMemoryGoals = refreshInMemoryGoals;
