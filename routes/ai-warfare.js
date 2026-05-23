/**
 * AI Warfare Execution & Data Collection
 * Triggers AI vs AI battles across all combat types and logs detailed statistics
 */

const combatResolver = require('../game/combat-resolver');

module.exports = function (db) {
  const express = require("express");
  const router = express.Router();

  /**
   * GET /api/ai-warfare/stats - Get comprehensive battle statistics
   */
  router.get("/stats", async (req, res) => {
    try {
      // Overall stats
      const overall = await db.get(`
        SELECT
          COUNT(*) as total_battles,
          SUM(CASE WHEN outcome = 'victory' THEN 1 ELSE 0 END) as ai_wins,
          SUM(CASE WHEN outcome = 'repelled' THEN 1 ELSE 0 END) as ai_losses,
          action_type,
          COUNT(CASE WHEN action_type IS NOT NULL THEN 1 END) as action_count
        FROM war_log
        WHERE attacker_id IN (SELECT id FROM kingdoms WHERE is_ai = 1)
        GROUP BY action_type
      `);

      // By race matchup
      const raceMatchups = await db.all(`
        SELECT
          a.race as attacker_race,
          d.race as defender_race,
          COUNT(*) as battles,
          SUM(CASE WHEN w.outcome = 'victory' THEN 1 ELSE 0 END) as wins,
          ROUND(100.0 * SUM(CASE WHEN w.outcome = 'victory' THEN 1 ELSE 0 END) / COUNT(*), 1) as win_rate
        FROM war_log w
        JOIN kingdoms a ON w.attacker_id = a.id
        JOIN kingdoms d ON w.defender_id = d.id
        WHERE a.is_ai = 1 AND d.is_ai = 1
        GROUP BY a.race, d.race
        ORDER BY battles DESC
      `);

      // By combat type
      const byType = await db.all(`
        SELECT
          action_type,
          COUNT(*) as total,
          SUM(CASE WHEN outcome = 'victory' THEN 1 ELSE 0 END) as wins,
          ROUND(100.0 * SUM(CASE WHEN outcome = 'victory' THEN 1 ELSE 0 END) / COUNT(*), 1) as win_rate
        FROM war_log
        WHERE attacker_id IN (SELECT id FROM kingdoms WHERE is_ai = 1)
        GROUP BY action_type
      `);

      // By attacker
      const byAttacker = await db.all(`
        SELECT
          attacker_name,
          COUNT(*) as battles,
          SUM(CASE WHEN outcome = 'victory' THEN 1 ELSE 0 END) as wins,
          ROUND(100.0 * SUM(CASE WHEN outcome = 'victory' THEN 1 ELSE 0 END) / COUNT(*), 1) as win_rate
        FROM war_log
        WHERE attacker_id IN (SELECT id FROM kingdoms WHERE is_ai = 1)
        GROUP BY attacker_id, attacker_name
        ORDER BY battles DESC
      `);

      // Latest battles
      const latest = await db.all(`
        SELECT
          w.id,
          w.action_type,
          w.attacker_name,
          w.defender_name,
          a.race as attacker_race,
          d.race as defender_race,
          w.outcome,
          w.created_at,
          w.detail
        FROM war_log w
        JOIN kingdoms a ON w.attacker_id = a.id
        JOIN kingdoms d ON w.defender_id = d.id
        WHERE a.is_ai = 1 AND d.is_ai = 1
        ORDER BY w.created_at DESC
        LIMIT 50
      `);

      res.json({
        overall,
        raceMatchups,
        byType,
        byAttacker,
        latest,
        timestamp: Math.floor(Date.now() / 1000),
      });
    } catch (err) {
      console.error("[ai-warfare] stats error:", err.message);
      res.status(500).json({ error: "Failed to fetch AI warfare stats" });
    }
  });

  /**
   * POST /api/ai-warfare/trigger - Force immediate AI warfare round
   */
  router.post("/trigger", async (req, res) => {
    try {
      const hiatusRow = await db.get("SELECT value FROM server_state WHERE key = 'ai_hiatus'");
      if (hiatusRow && hiatusRow.value === 'true') {
        return res.json({ message: "AI is currently on hiatus. Triggering battles is disabled.", battlesTriggered: 0, results: [] });
      }

      const engine = require("../game/engine");

      // Get all AI kingdoms
      const ais = await db.all(`
        SELECT k.* FROM kingdoms k
        JOIN players p ON k.player_id = p.id
        WHERE p.is_ai = 1
        ORDER BY RANDOM()
      `);

      if (ais.length < 2) {
        return res.json({ message: "Not enough AI kingdoms", count: ais.length });
      }

      let battlesTriggered = 0;
      const results = [];

      // Each AI attacks a random other AI
      for (let i = 0; i < Math.min(ais.length, 5); i++) {
        const attacker = ais[i];
        const defenders = ais.filter((k) => k.id !== attacker.id);
        const defender = defenders[Math.floor(Math.random() * defenders.length)];

        // Random combat type
        const combatTypes = ["military", "covert", "magic"];
        const combatType = combatTypes[Math.floor(Math.random() * combatTypes.length)];

        try {
          const result = await executeAiCombat(db, engine, attacker, defender, combatType);
          if (!result.error) {
            battlesTriggered++;
            results.push({
              attacker: attacker.name,
              defender: defender.name,
              type: combatType,
              outcome: result.outcome,
            });
          }
        } catch (e) {
          console.error("[ai-warfare] combat error:", e.message);
        }
      }

      res.json({
        battlesTriggered,
        results,
        message: `Triggered ${battlesTriggered} AI battles`,
      });
    } catch (err) {
      console.error("[ai-warfare] trigger error:", err.message);
      res.status(500).json({ error: "Failed to trigger AI warfare" });
    }
  });

  return router;
};

/**
 * Execute AI combat (military, covert, or magic)
 */
async function executeAiCombat(db, engine, attacker, defender, combatType) {
  const fighters = attacker.fighters || 0;
  const mages = attacker.mages || 0;
  const ninjas = attacker.ninjas || 0;
  const thieves = attacker.thieves || 0;
  const engineers = attacker.engineers || 0;

  // Check if AI has units for this combat type
  if (combatType === "military" && fighters < 50) return { error: "insufficient_fighters" };
  if (combatType === "covert" && (ninjas + thieves) < 50) return { error: "insufficient_stealth" };
  if (combatType === "magic" && mages < 50) return { error: "insufficient_mages" };

  let result;
  let targetFocus = 'fighters'; // Default target

  if (combatType === "military") {
    // Choose random target focus for variety
    const targets = ['fighters', 'clerics', 'mages', 'rangers'];
    targetFocus = targets[Math.floor(Math.random() * targets.length)];

    // Execute new combat system
    result = await combatResolver.executeCombat(db, attacker, defender, 'military', targetFocus, engineers);
  } else if (combatType === "covert") {
    // Covert operations: ninjas assassinate, thieves sabotage
    const isAssassination = Math.random() < 0.5;
    targetFocus = isAssassination ? 'assassination' : 'sabotage';

    // Use combat resolver for covert operations
    result = await combatResolver.executeCombat(db, attacker, defender, 'covert', targetFocus, 0);
  } else if (combatType === "magic") {
    // Magic attack
    targetFocus = 'mages';
    result = await combatResolver.executeCombat(db, attacker, defender, 'magic', targetFocus, 0);
  }

  // Log to war_log with new injury data
  if (result) {
    const outcome = result.outcome;
    const detail = JSON.stringify({
      combatType,
      targetFocus,
      ...result.report,
    });

    await db.run(
      `INSERT INTO war_log (action_type, attacker_id, attacker_name, defender_id, defender_name, outcome, detail, obscured)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
      [combatType, attacker.id, attacker.name, defender.id, defender.name, outcome, detail]
    );

    // Apply updates with whitelisted columns (now includes injury tracking)
    const allowedColumns = new Set([
      'gold', 'fighters', 'population', 'mages', 'ninjas', 'thieves',
      'rangers', 'clerics', 'engineers', 'war_machines',
      'injured_troops', 'wall_hp', 'wall_defense_type'
    ]);

    if (Object.keys(result.attackerUpdates).length > 0) {
      const validKeys = Object.keys(result.attackerUpdates).filter((c) => allowedColumns.has(c));
      if (validKeys.length > 0) {
        const cols = validKeys.map((c) => `${c} = ?`);
        await db.run(`UPDATE kingdoms SET ${cols.join(", ")} WHERE id = ?`, [
          ...validKeys.map((k) => result.attackerUpdates[k]),
          attacker.id,
        ]);
      }
    }

    if (Object.keys(result.defenderUpdates).length > 0) {
      const validKeys = Object.keys(result.defenderUpdates).filter((c) => allowedColumns.has(c));
      if (validKeys.length > 0) {
        const cols = validKeys.map((c) => `${c} = ?`);
        await db.run(`UPDATE kingdoms SET ${cols.join(", ")} WHERE id = ?`, [
          ...validKeys.map((k) => result.defenderUpdates[k]),
          defender.id,
        ]);
      }
    }

    return { outcome: result.outcome, combatType };
  }

  return { error: "unknown" };
}
