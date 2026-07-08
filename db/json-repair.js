// Extracted from db/schema.js for modularity (M2-4)

function cloneJsonFallback(value) {
  return JSON.parse(JSON.stringify(value));
}

function parseJsonCandidate(raw) {
  if (raw === null || raw === undefined) return null;
  let current = raw;
  let depth = 0;
  while (typeof current === 'string' && depth < 3) {
    const text = current.trim();
    if (!text) return null;
    try {
      current = JSON.parse(text);
    } catch {
      return null;
    }
    depth += 1;
  }
  return current;
}

function normalizeJsonForRepair(raw, spec) {
  const fallback = cloneJsonFallback(spec.fallback);

  if (raw === null || raw === undefined) return JSON.stringify(fallback);

  const parsed = parseJsonCandidate(raw);
  if (parsed === null) return JSON.stringify(fallback);

  const matchesKind = spec.kind === 'array'
    ? Array.isArray(parsed)
    : spec.kind === 'object'
      ? parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      : true;

  if (!matchesKind) return JSON.stringify(fallback);

  try {
    const normalized = JSON.stringify(parsed);
    if (!normalized) return JSON.stringify(fallback);
    return normalized;
  } catch {
    return JSON.stringify(fallback);
  }
}

const JSON_REPAIR_SPECS = {
  kingdoms: {
    alliance_buffs: { kind: 'object', fallback: {} },
    goals: { kind: 'object', fallback: {} },
    research_allocation: { kind: 'object', fallback: {} },
    build_queue: { kind: 'object', fallback: {} },
    build_progress: { kind: 'object', fallback: {} },
    research_progress: { kind: 'object', fallback: {} },
    mage_research_progress: { kind: 'object', fallback: {} },
    build_allocation: { kind: 'object', fallback: {} },
    resource_build_allocation: { kind: 'object', fallback: {} },
    xp_sources: {
      kind: 'object',
      fallback: { turn: 0, gold: 0, combat_win: 0, combat_loss: 0, research: 0, construction: 0, exploration: 0, spell_cast: 0, covert_op: 0 }
    },
    troop_levels: { kind: 'object', fallback: {} },
    equipment_levels: { kind: 'object', fallback: {} },
    training_allocation: { kind: 'object', fallback: {} },
    library_allocation: { kind: 'object', fallback: {} },
    wounded_troops: { kind: 'object', fallback: {} },
    library_progress: { kind: 'object', fallback: {} },
    tower_progress: { kind: 'object', fallback: {} },
    scrolls: { kind: 'object', fallback: {} },
    active_effects: { kind: 'object', fallback: {} },
    collected_lore: { kind: 'array', fallback: [] },
    collected_events: { kind: 'array', fallback: [] },
    achievements: { kind: 'array', fallback: [] },
    active_trade_routes: { kind: 'array', fallback: [] },
    milestones_claimed: { kind: 'object', fallback: {} },
    milestone_bonuses: { kind: 'object', fallback: {} },
    injured_troops: { kind: 'object', fallback: {} },
    smithy_allocation: { kind: 'object', fallback: {} },
    racial_bonuses_unlocked: { kind: 'object', fallback: {} },
    mage_tower_allocation: { kind: 'object', fallback: {} },
    shrine_allocation: { kind: 'object', fallback: {} },
    granary_upgrades: { kind: 'object', fallback: {} },
    world_fragments: { kind: 'array', fallback: [] },
    hybrid_blueprints: { kind: 'object', fallback: {} },
    fragment_bonuses: { kind: 'object', fallback: {} },
    fortified_buildings: { kind: 'object', fallback: {} },
    wall_upgrades: { kind: 'object', fallback: {} },
    tower_def_upgrades: { kind: 'object', fallback: {} },
    outpost_upgrades: { kind: 'object', fallback: {} },
    defense_upgrades: { kind: 'object', fallback: {} },
    tower_upgrades: { kind: 'object', fallback: {} },
    school_upgrades: { kind: 'object', fallback: {} },
    shrine_upgrades: { kind: 'object', fallback: {} },
    library_upgrades: { kind: 'object', fallback: {} },
    research_focus: { kind: 'array', fallback: [] },
    farm_upgrades: { kind: 'object', fallback: {} },
    market_upgrades: { kind: 'object', fallback: {} },
    tavern_upgrades: { kind: 'object', fallback: {} },
    bank_upgrades: { kind: 'object', fallback: {} },
    bank_deposits: { kind: 'array', fallback: [] },
    ledger: { kind: 'array', fallback: [] },
    mausoleum_upgrades: { kind: 'object', fallback: {} },
    mausoleum_allocation: { kind: 'object', fallback: {} },
    mercenaries: { kind: 'array', fallback: [] },
    active_event: { kind: 'object', fallback: {} },
    discovered_kingdoms: { kind: 'object', fallback: {} },
    location_maps_wip: { kind: 'array', fallback: [] },
    items: { kind: 'array', fallback: [] },
    resource_sequence: { kind: 'object', fallback: {} },
    visibility: { kind: 'object', fallback: { seen_cells: '0', current_cells: '0', version: 1 } }
  },
  alliances: {
    projects: { kind: 'object', fallback: {} },
    vault_log: { kind: 'array', fallback: [] }
  },
  heroes: {
    abilities: { kind: 'array', fallback: [] }
  },
  resource_expeditions: {
    loot: { kind: 'object', fallback: {} }
  }
};

module.exports = {
  JSON_REPAIR_SPECS,
  cloneJsonFallback,
  parseJsonCandidate,
  normalizeJsonForRepair
};
