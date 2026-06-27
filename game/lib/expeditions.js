// game/lib/expeditions.js
// Expedition utilities: location mapping and transition state machine.
// Pure functions with no external dependencies (except helpers).

const { safeJsonParse } = require('../../utils/helpers');

function processLocationMapsWip(k, events) {
  const updates = {};
  const wip = safeJsonParse(
    k.location_maps_wip,
    [],
    "processLocationMapsWip:location_maps_wip",
  );
  if (!wip.length) return updates;

  const scribesAvail = k.scribes;
  let scribesUsed = 0;
  const completed = [];
  const remaining = [];

  for (const item of wip) {
    const cost = 10; // scribes required
    if (scribesUsed + cost > scribesAvail) {
      remaining.push(item);
      continue;
    }
    scribesUsed += cost;
    item.turns_remaining = (item.turns_remaining || 5) - 1;
    if (item.turns_remaining <= 0) {
      completed.push(item);
      const disc = safeJsonParse(
        k.discovered_kingdoms,
        {},
        "processLocationMapsWip:discovered_kingdoms",
      );
      disc[item.target_id] = { found: true, mapped: true };
      updates.discovered_kingdoms = JSON.stringify(disc);
      events.push({
        type: "system",
        message: `🗺️ Scribes have completed a location map for ${item.target_name}. You may now interact with them.`,
      });
    } else {
      remaining.push(item);
    }
  }

  updates.location_maps_wip = JSON.stringify(remaining);
  return updates;
}

function computeExpeditionTransitions(expeditions, now) {
  const transitions = [];
  for (const exp of expeditions) {
    if (exp.status === 'outbound' && now >= exp.arrive_at) {
      const harvestDuration = exp._harvestDuration || 3600;
      transitions.push({ id: exp.id, newStatus: 'harvesting', harvest_ends_at: now + harvestDuration, ...exp });
    } else if (exp.status === 'harvesting' && exp.harvest_ends_at && now >= exp.harvest_ends_at) {
      transitions.push({ id: exp.id, newStatus: 'returning', ...exp });
    } else if (exp.status === 'returning' && exp.return_at && now >= exp.return_at) {
      transitions.push({ id: exp.id, newStatus: 'completed', ...exp });
    }
  }
  return transitions;
}

module.exports = {
  processLocationMapsWip,
  computeExpeditionTransitions,
};
