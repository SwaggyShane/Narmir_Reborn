// game/lib/happiness-logging.js
// Happiness history and event logging — async DB operations for tracking happiness changes.

async function recordHappinessHistory(db, kingdomId, turn, happinessData) {
  try {
    await db.run(
      `INSERT INTO happiness_history
       (kingdom_id, turn, happiness_value, food_component, entertainment_component, safety_component, prosperity_component, race_modifier, tax_component, overcrowding_component, recovery_rate, effects_component, synergy_component, fragment_component)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       ON CONFLICT(kingdom_id, turn) DO UPDATE SET
       happiness_value = EXCLUDED.happiness_value,
       food_component = EXCLUDED.food_component,
       entertainment_component = EXCLUDED.entertainment_component,
       safety_component = EXCLUDED.safety_component,
       prosperity_component = EXCLUDED.prosperity_component,
       race_modifier = EXCLUDED.race_modifier,
       tax_component = EXCLUDED.tax_component,
       overcrowding_component = EXCLUDED.overcrowding_component,
       recovery_rate = EXCLUDED.recovery_rate,
       effects_component = EXCLUDED.effects_component,
       synergy_component = EXCLUDED.synergy_component,
       fragment_component = EXCLUDED.fragment_component`,
      [
        kingdomId,
        turn,
        happinessData.happiness,
        happinessData.components.food || 0,
        happinessData.components.entertainment || 0,
        happinessData.components.safety || 0,
        happinessData.components.prosperity || 0,
        happinessData.components.race || 0,
        happinessData.components.tax || 0,
        happinessData.components.overcrowding || 0,
        happinessData.recovery || 0,
        happinessData.components.effects || 0,
        happinessData.components.synergy || 0,
        happinessData.components.fragments || 0
      ]
    );
  } catch (err) {
    console.error(`[happiness] recordHappinessHistory error: ${err.message}`);
  }
}

async function logHappinessEvent(db, kingdomId, turn, eventData) {
  try {
    await db.run(
      `INSERT INTO happiness_events
       (kingdom_id, turn, event_type, old_happiness, new_happiness, component, delta, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        kingdomId,
        turn,
        eventData.event_type,
        eventData.old_happiness,
        eventData.new_happiness,
        eventData.component,
        eventData.delta,
        eventData.description
      ]
    );
  } catch (err) {
    console.error(`[happiness] logHappinessEvent error: ${err.message}`);
  }
}

module.exports = {
  recordHappinessHistory,
  logHappinessEvent,
};
