// game/event-listeners.js
// Slice 5: Event-driven system coordination for Phase 2 decoupling (Tier 4).
// Systems emit events; other systems listen and react.
// Decouples Scout system from Visibility system.

const eventBus = require('./event-bus');

/**
 * Initialize event listeners for system-to-system coordination.
 * Called once at boot to wire up all event handlers.
 */
function initializeEventListeners() {
  // Scout → Visibility coordination
  // When scout ring completes, visibility system reveals hexes
  eventBus.on('ring-completed', (data) => {
    handleRingCompleted(data);
  });

  // Combat → XP coordination
  // When combat resolves, XP system awards experience
  eventBus.on('combat-resolved', (data) => {
    handleCombatResolved(data);
  });

  // Research → Level coordination
  // When research completes, level system recalculates levels
  eventBus.on('research-xp-awarded', (data) => {
    handleResearchXpAwarded(data);
  });

  // Expedition → Reward coordination
  // When expedition completes, reward system grants loot
  eventBus.on('expedition-completed', (data) => {
    handleExpeditionCompleted(data);
  });
}

// ── Scout → Visibility ──
/**
 * Handle ring completion event.
 * Scout system emits this; Visibility system listens.
 */
function handleRingCompleted(data) {
  const { kingdomId, ringNumber, hexes } = data;
  // Visibility system would:
  // 1. Load kingdom's current visibility bitmap
  // 2. Add hexes to seen_cells
  // 3. Store in database
  // 4. Emit 'visibility-updated' event for client sync
  console.log(`[visibility] Ring ${ringNumber} for kingdom ${kingdomId}: reveal ${hexes?.length || 0} hexes`);
  eventBus.emit('visibility-updated', { kingdomId, ringNumber });
}

// ── Combat → XP ──
/**
 * Handle combat resolution event.
 * Combat system emits this; XP system listens.
 */
function handleCombatResolved(data) {
  const { attackerId, defenderId, attacker_damage, defender_damage } = data;
  // XP system would:
  // 1. Award XP to attacker based on damage
  // 2. Award XP to defender if surviving
  // 3. Update xp_sources tracking
  // 4. Emit 'xp-awarded' event
  console.log(`[xp] Combat: attacker=${attackerId} dealt ${attacker_damage}, defender=${defenderId} took ${defender_damage}`);
  eventBus.emit('xp-awarded', { attackerId, defenderId, xp: Math.floor(attacker_damage / 10) });
}

// ── Research → Level ──
/**
 * Handle research XP award event.
 * Research system emits this; Level system listens.
 */
function handleResearchXpAwarded(data) {
  const { kingdomId, xpAmount } = data;
  // Level system would:
  // 1. Add XP to kingdom's total XP
  // 2. Check for level-up
  // 3. Award milestones if level increased
  // 4. Emit 'level-changed' event if applicable
  console.log(`[level] Kingdom ${kingdomId}: award ${xpAmount} XP for research`);
  // Would trigger level-up checks here
}

// ── Expedition → Reward ──
/**
 * Handle expedition completion event.
 * Expedition system emits this; Reward system listens.
 */
function handleExpeditionCompleted(data) {
  const { kingdomId, expeditionId, expeditionType } = data;
  // Reward system would:
  // 1. Look up expedition rewards table based on type
  // 2. Generate loot (gold, resources, items, etc.)
  // 3. Add to kingdom inventory
  // 4. Create news event
  // 5. Emit 'loot-received' event
  console.log(`[rewards] Expedition ${expeditionId} (${expeditionType}) completed for kingdom ${kingdomId}`);
  eventBus.emit('loot-received', { kingdomId, expeditionId });
}

module.exports = {
  initializeEventListeners,
};
