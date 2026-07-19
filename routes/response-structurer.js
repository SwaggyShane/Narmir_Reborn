/**
 * Structures API response updates into domain-organized format.
 * All endpoints MUST use this before returning responses with `updates`.
 *
 * Input: flat object like { gold: 100, population: 50, rangers: 20, ... }
 * Output: { economy: { gold: 100 }, population: { population: 50 },
 *           military: { troops: { rangers: 20 } }, ... }
 *
 * IMPORTANT — this is not a pure "flat key -> one domain" lookup. Verified against
 * each Zustand store's actual receiveServerSnapshot() implementation (2026-07-19),
 * not just column names, because two things turned out not to hold:
 *
 * 1. militaryStore.receiveServerSnapshot expects a NESTED shape —
 *    `{ troops: { fighters, rangers, ... } }`, not flat top-level keys. Before this
 *    fix, troop-count fields were listed in a flat military Set and reached the
 *    client, but militaryStore's own handler checks `data.troops` and silently does
 *    nothing with flat keys — so troop counts sent this way were being silently
 *    dropped on the CLIENT side even though they passed the server-side whitelist.
 * 2. A few real DB columns are genuinely consumed by more than one store
 *    (mana/mana_regen by both economy and research; researchers by both profile
 *    and research; engineers by both profile and military's troops object) — these
 *    are intentionally duplicated into more than one domain below, not a mistake.
 */

const troopFields = new Set(['fighters', 'rangers', 'mages', 'clerics', 'thieves', 'ninjas', 'engineers', 'war_machines']);

const militaryFlatFields = new Set([
  'ladders', 'thralls', 'weapons_stockpile', 'armor_stockpile',
  'troop_levels', 'tower_progress', 'wall_hp', 'wall_defense_type',
  'equipment_levels', 'wounded_troops', 'injured_troops',
]);

const profileFields = new Set([
  'turn', 'turns_stored', 'level', 'xp', 'xp_sources', 'scout_progress',
  'score', 'unread_news', 'last_turn_at', 'updated_at',
  'prestige_level', 'last_prestige_turn',
  'evolution_form', 'evolution_ritual',
  'name', 'race', 'gender', 'description',
  'engineer_level', 'engineer_xp',
  'milestone_bonuses', 'milestone_title', 'milestones_claimed',
  'scout_allocation', 'first_dungeon_found_turn', 'first_mountain_found_turn',
]);

const economyFields = new Set([
  'gold', 'food', 'mana', 'mana_regen', 'tax', 'gold_income', 'food_balance',
  'wood', 'stone', 'iron', 'steel', 'coal',
  'maps', 'scrolls', 'blueprints_stored', 'land',
  'food_surplus_turns', 'food_shortage_turns', '_spoilage',
  // Forge & Lava Industry
  'toolwright_yard', 'engineers_lodge', 'forge', 'tempered_steel', 'lava_stored',
  'steel_weapons', 'steel_armor', 'tempered_weapons', 'tempered_armor',
  'flux_barges', 'charcoal_wood_allocation',
  // Resource allocation dials
  'res_weapons', 'res_military', 'res_attack_magic', 'res_war_machines',
  'res_economy', 'res_spellbook', 'res_armor', 'res_defense_magic',
  'res_entertainment', 'res_construction',
  // Build queue / construction economy (economyStore.receiveServerSnapshot
  // explicitly consumes all of these)
  'build_allocation', 'build_progress', 'build_queue', 'training_allocation',
  'resource_build_allocation', 'hammers_stored', 'hammer_turns_used',
  'scaffolding_stored', 'tools_hammers', 'tools_scaffolding', 'tools_blueprints',
  'discovered_kingdoms',
  // Building-upgrade JSON blobs — same semantic home as the buildings they upgrade
  'bank_upgrades', 'farm_upgrades', 'granary_upgrades', 'market_upgrades',
  'tavern_upgrades', 'wall_upgrades', 'tower_def_upgrades', 'outpost_upgrades',
  'mausoleum_upgrades', 'defense_upgrades', 'tower_upgrades', 'library_upgrades',
  'smithy_allocation', 'divine_sanctuary_used',
  // Trade / bank
  'trade_routes', 'active_trade_routes', 'bank_deposits', 'ledger', 'mercenaries',
  // Fragments / items / crafting
  'world_fragments', 'hybrid_blueprints', 'fragment_bonuses', 'fortified_blueprints',
  'fortified_buildings', 'certified_blueprints_stored', 'items', 'resource_sequence',
]);

const researchFields = new Set([
  'research_focus', 'research_progress', 'research_allocation', 'library_progress',
  'school_of_magic', 'school_level', 'school_upgrades', 'mage_research_progress',
]);

const populationFields = new Set(['population', 'happiness']);

// Real kingdoms columns that legitimately have no Zustand-store consumer, so
// they're intentionally dropped here rather than surfacing as an "unmapped"
// dev warning (A3-7, 2026-07-19 — found via live audit: both fields reach
// this function through the /turn postfetch, and both were logging as
// unmapped even though the gap isn't a bug):
// - achievements: fetched on demand by LoreAndAchievements.jsx via its own
//   dedicated GET /api/kingdom/lore-and-achievements, never via the turn/
//   updates → store hydration path.
// - racial_bonuses_unlocked: player-facing feedback for this is the system
//   event message pushed when it unlocks (game/engine.js); the flag itself
//   is server-side bookkeeping (prevents re-triggering) surfaced to humans
//   only via the admin KingdomEditModal raw field editor.
// - active_effects (A4-3, 2026-07-19): active spell buffs/debuffs, written by
//   game/magic.js's casterUpdates and reachable through POST /kingdom/spell's
//   response. No Zustand store currently reads it — its only client
//   consumers are admin-only (KingdomWidgets.jsx, KingdomEditModal.jsx).
//   Surfacing active effects in the player UI would be a real feature, not
//   a normalizer wiring fix, so it's excluded here rather than invented.
// - goals (A4-6, 2026-07-19): written by game/goals.js's progressGoal, called
//   from the attack/spell/etc. routes — reachable through their responses.
//   GoalsPanel.jsx fetches goal progress on demand via its own dedicated
//   GET /api/kingdom/goals, never via the turn/updates path.
const serverInternalOnlyFields = new Set(['achievements', 'racial_bonuses_unlocked', 'active_effects', 'goals']);

/** Every kingdoms column starting with bld_ — dynamic, matches economyStore's own handling. */
function isBuildingField(key) {
  return key.startsWith('bld_');
}

/**
 * Structures flat updates object into domain-organized format.
 *
 * @param {Object} flatUpdates - Flat object like { gold: 100, population: 50, ... }
 * @param {Object} [opts]
 * @param {boolean} [opts.warnUnmapped] - Dev-mode: log any key that reaches none of
 *   the domains below, so a future gap surfaces immediately instead of silently
 *   dropping data (defaults to true outside production).
 * @returns {Object} Structured like { economy: { gold: 100 }, military: { troops: {...} } }
 */
function structureUpdates(flatUpdates, opts = {}) {
  if (!flatUpdates || typeof flatUpdates !== 'object') {
    return {};
  }
  const warnUnmapped = opts.warnUnmapped ?? (process.env.NODE_ENV !== 'production');

  const structured = {};
  const unmapped = [];

  Object.entries(flatUpdates).forEach(([key, value]) => {
    let mapped = false;

    if (troopFields.has(key)) {
      if (!structured.military) structured.military = {};
      if (!structured.military.troops) structured.military.troops = {};
      structured.military.troops[key] = value;
      mapped = true;
      // engineers is also a profile-visible support-unit count (profileStore
      // tracks it separately from militaryStore's troops object) — fall through
      // to also let it match profileFields below rather than returning early.
    }
    if (militaryFlatFields.has(key)) {
      if (!structured.military) structured.military = {};
      structured.military[key] = value;
      mapped = true;
    }
    if (profileFields.has(key) || key === 'engineers' || key === 'researchers' || key === 'scribes') {
      if (!structured.profile) structured.profile = {};
      structured.profile[key] = value;
      mapped = true;
    }
    if (economyFields.has(key) || isBuildingField(key)) {
      if (!structured.economy) structured.economy = {};
      structured.economy[key] = value;
      mapped = true;
    }
    if (researchFields.has(key) || key === 'researchers') {
      if (!structured.research) structured.research = {};
      structured.research[key] = value;
      mapped = true;
    }
    if (populationFields.has(key)) {
      if (!structured.population) structured.population = {};
      structured.population[key] = value;
      mapped = true;
    }
    if (serverInternalOnlyFields.has(key)) {
      mapped = true;
    }

    if (!mapped) unmapped.push(key);
  });

  if (warnUnmapped && unmapped.length > 0) {
    // Loud on purpose (A4-10) — this used to be a silent drop. A field showing up
    // here means either a genuinely new kingdoms column that needs a home above,
    // or a key that was never meant to be in a flat updates object (e.g. an
    // internal-only field) — both are worth seeing, not swallowing.
    console.warn(`[response-structurer] Unmapped updates key(s), dropped from response: ${unmapped.join(', ')}`);
  }

  return structured;
}

module.exports = { structureUpdates };
