// game/command-handler.js
// P0 architecture: Route → CommandHandler → Engine boundary.
// Slice 1: core mutators + correct signatures.
// Slice 2: expeditions, hero recruit, forge-tools, remaining route wiring.

'use strict';

/** @typedef {{ type: string, [key: string]: any }} GameCommand */
/** @typedef {{ kingdom?: object, db?: object }} CommandContext */

/**
 * Canonical mutating command types (Narmir-shaped, not entity MOVE).
 * Keep in sync with handle() switch and test/command-handler.test.js.
 */
const COMMAND_TYPES = Object.freeze([
  'turn',
  'expeditions',
  'combat',
  'spell',
  'covert-spy',
  'covert-loot',
  'covert-assassinate',
  'covert-sabotage',
  'hire-units',
  'hire-mercenaries',
  'recruit-hero',
  'queue-buildings',
  'demolish-building',
  'study-discipline',
  'select-school',
  'purchase-upgrade',
  'prestige', // deliberately fenced — handlePrestige() throws; real path is POST /rebirth (atomic wipe TX)
  'calculate-score',
  'raid-trade-route',
  'forge-tools',
  'award-xp',
  'award-troop-xp',
]);

// Canonical home: game/lib/assert-serializable.js (leaf — breaks command-handler ↔ safe-socket-emit cycle)
const { assertSerializable } = require('./lib/assert-serializable');

class CommandHandler {
  /**
   * @param {object|null} engineImpl - Injectable engine for tests. Default: live game/engine.
   */
  constructor(engineImpl = null) {
    this.engine = engineImpl || require('./engine');
  }

  /** @returns {readonly string[]} */
  listCommands() {
    return COMMAND_TYPES;
  }

  /**
   * @param {GameCommand} command
   * @param {CommandContext} [context]
   */
  async handle(command, context) {
    if (!command || typeof command !== 'object' || !command.type) {
      throw new Error('Command must have a type property');
    }

    const { type, ...payload } = command;
    const { kingdom, db } = context || {};

    switch (type) {
      case 'turn':
        return this.handleTurn(kingdom, db);

      case 'expeditions':
        return this.handleExpeditions(kingdom, db);

      case 'combat':
        return this.handleCombat(kingdom, payload);

      case 'spell':
        return this.handleSpell(kingdom, payload);

      case 'covert-spy':
      case 'covert-loot':
      case 'covert-assassinate':
      case 'covert-sabotage':
        return this.handleCovertOp(type, kingdom, payload);

      case 'hire-units':
        return this.handleHireUnits(kingdom, payload);

      case 'hire-mercenaries':
        return this.handleHireMercenaries(kingdom, payload);

      case 'recruit-hero':
        return this.handleRecruitHero(kingdom, db, payload);

      case 'queue-buildings':
        return this.handleQueueBuildings(kingdom, payload);

      case 'demolish-building':
        return this.handleDemolishBuilding(kingdom, payload);

      case 'study-discipline':
        return this.handleStudyDiscipline(kingdom, payload);

      case 'select-school':
        return this.handleSelectSchool(kingdom, payload);

      case 'purchase-upgrade':
        return this.handlePurchaseUpgrade(kingdom, payload);

      case 'prestige':
        return this.handlePrestige(kingdom);

      case 'calculate-score':
        return this.handleCalculateScore(kingdom);

      case 'raid-trade-route':
        return this.handleRaidTradeRoute(kingdom, payload);

      case 'forge-tools':
        return this.handleForgeTools(kingdom, payload);

      case 'award-xp':
        return this.handleAwardXp(kingdom, payload);

      case 'award-troop-xp':
        return this.handleAwardTroopXp(kingdom, payload);

      default:
        throw new Error(`Unknown command type: ${type}`);
    }
  }

  // ── Turn ──────────────────────────────────────────────────────────────────
  handleTurn(kingdom, db) {
    return this.engine.processTurn(kingdom, db);
  }

  // ── Expeditions (turn-adjacent) ───────────────────────────────────────────
  async handleExpeditions(kingdom, db) {
    const expeditionEvents = await this.engine.resolveExpeditions(db, kingdom, this.engine);
    const harvestEvents = await this.engine.resolveResourceHarvests(db, kingdom);
    return expeditionEvents.concat(harvestEvents);
  }

  // ── Combat — matches routes/kingdom-warfare.js ────────────────────────────
  // engine.resolveMilitaryAttack(attacker, defender, sentUnits, attackerHeroes, defenderHeroes)
  handleCombat(kingdom, payload) {
    const {
      target,
      sentUnits = {},
      attackerHeroes = [],
      defenderHeroes = [],
    } = payload;
    if (!target) {
      throw new Error('combat command requires payload.target (defender kingdom row)');
    }
    return this.engine.resolveMilitaryAttack(
      kingdom,
      target,
      sentUnits,
      attackerHeroes,
      defenderHeroes,
    );
  }

  // ── Spells — castSpell(caster, target, spellId, obscure) ──────────────────
  handleSpell(kingdom, payload) {
    const { target, spellId, obscure = false } = payload;
    if (!spellId) {
      throw new Error('spell command requires payload.spellId');
    }
    if (!target) {
      throw new Error('spell command requires payload.target (kingdom row)');
    }
    return this.engine.castSpell(kingdom, target, spellId, !!obscure);
  }

  // ── Covert — real signatures from game/covert.js ──────────────────────────
  handleCovertOp(type, kingdom, payload) {
    const { target } = payload;
    if (!target) {
      throw new Error(`${type} requires payload.target`);
    }
    const opType = type.replace('covert-', '');

    switch (opType) {
      case 'spy': {
        const unitsSent = payload.unitsSent;
        return this.engine.covertSpy(kingdom, target, unitsSent);
      }
      case 'loot': {
        const { lootType, thievesSent } = payload;
        return this.engine.covertLoot(kingdom, target, lootType, thievesSent);
      }
      case 'assassinate': {
        const { ninjasSent, unitType } = payload;
        return this.engine.covertAssassinate(kingdom, target, ninjasSent, unitType);
      }
      case 'sabotage': {
        const { ninjasSent, bldType } = payload;
        return this.engine.covertSabotage(kingdom, target, ninjasSent, bldType);
      }
      default:
        throw new Error(`Unknown covert operation: ${opType}`);
    }
  }

  // ── Units ─────────────────────────────────────────────────────────────────
  // hireUnits(k, unit, amount) — no db
  handleHireUnits(kingdom, payload) {
    const { unitType, quantity } = payload;
    return this.engine.hireUnits(kingdom, unitType, quantity);
  }

  // hireMercenaries(k, unitType, tier, count)
  handleHireMercenaries(kingdom, payload) {
    const { unitType, tier, quantity } = payload;
    return this.engine.hireMercenaries(kingdom, unitType, tier, quantity);
  }

  // recruitHero(k, heroName, heroClass) — no db
  handleRecruitHero(kingdom, _db, payload) {
    const { name, heroClass } = payload;
    if (!heroClass) {
      throw new Error('recruit-hero requires payload.heroClass');
    }
    return this.engine.recruitHero(kingdom, name, heroClass);
  }

  // forgeTools(k, toolType, quantity)
  handleForgeTools(kingdom, payload) {
    const { toolType, quantity } = payload;
    return this.engine.forgeTools(kingdom, toolType, quantity);
  }

  // awardXp(k, activity, amount)
  handleAwardXp(kingdom, payload) {
    const { activity, amount } = payload;
    return this.engine.awardXp(kingdom, activity, amount);
  }

  // awardTroopXp(k, unit, xpAmount)
  handleAwardTroopXp(kingdom, payload) {
    const { unitType, amount } = payload;
    return this.engine.awardTroopXp(kingdom, unitType, amount);
  }

  // ── Construction ──────────────────────────────────────────────────────────
  handleQueueBuildings(kingdom, payload) {
    const { orders } = payload;
    return this.engine.queueBuildings(kingdom, orders);
  }

  // demolishBuilding(k, buildingKey, amount) — no db
  handleDemolishBuilding(kingdom, payload) {
    const { buildingType, amount } = payload;
    return this.engine.demolishBuilding(kingdom, buildingType, amount);
  }

  // ── Research / upgrades ───────────────────────────────────────────────────
  // studyDiscipline(k, discipline, researchersAssigned)
  handleStudyDiscipline(kingdom, payload) {
    const { discipline, allocation } = payload;
    return this.engine.studyDiscipline(kingdom, discipline, allocation);
  }

  handleSelectSchool(kingdom, payload) {
    const { school } = payload;
    return this.engine.selectSchool(kingdom, school);
  }

  handlePurchaseUpgrade(kingdom, payload) {
    const { category, upgradeKey } = payload;
    return this.engine.purchaseUpgrade(kingdom, category, upgradeKey);
  }

  // Prestige rebirth is atomic only via POST /api/kingdom/rebirth (FOR UPDATE TX +
  // applyUpdates + side effects + news after commit). Pure processPrestige here
  // would return wipe updates without applying them — refuse.
  handlePrestige() {
    throw new Error(
      'Prestige rebirth must use POST /api/kingdom/rebirth (atomic wipe). CommandHandler prestige is disabled.',
    );
  }

  handleCalculateScore(kingdom) {
    return this.engine.calculateScore(kingdom);
  }

  handleRaidTradeRoute(kingdom, payload) {
    const { target, thievesSent } = payload;
    if (!target) {
      throw new Error('raid-trade-route requires payload.target');
    }
    return this.engine.raidTradeRoute(kingdom, target, thievesSent);
  }

  // ── Constants surface (read-only) ─────────────────────────────────────────
  getConstants() {
    return {
      SPELL_DEFS: this.engine.SPELL_DEFS,
      HERO_CLASSES: this.engine.HERO_CLASSES,
      BUILDING_COST: this.engine.BUILDING_COST,
      UNIT_COST: this.engine.UNIT_COST,
      BUILDING_LAND_COST: this.engine.BUILDING_LAND_COST,
      FARM_UPGRADES: this.engine.FARM_UPGRADES,
      GRANARY_UPGRADES: this.engine.GRANARY_UPGRADES,
      BANK_UPGRADES: this.engine.BANK_UPGRADES,
      VAULT_UPGRADES: this.engine.VAULT_UPGRADES,
      SCHOOL_UPGRADES: this.engine.SCHOOL_UPGRADES,
      SHRINE_UPGRADES: this.engine.SHRINE_UPGRADES,
      LIBRARY_UPGRADES: this.engine.LIBRARY_UPGRADES,
      MAUSOLEUM_UPGRADES: this.engine.MAUSOLEUM_UPGRADES,
      TOWER_UPGRADES: this.engine.TOWER_UPGRADES,
      TOWER_DEF_UPGRADES: this.engine.TOWER_DEF_UPGRADES,
      WALL_UPGRADES: this.engine.WALL_UPGRADES,
      OUTPOST_UPGRADES: this.engine.OUTPOST_UPGRADES,
      MARKET_UPGRADES: this.engine.MARKET_UPGRADES,
      TAVERN_UPGRADES: this.engine.TAVERN_UPGRADES,
      MAGIC_SCHOOLS: this.engine.MAGIC_SCHOOLS,
      TRADE_ROUTE_MAX: this.engine.TRADE_ROUTE_MAX,
      FARM_WORKERS_PER: this.engine.FARM_WORKERS_PER,
      CITADEL_REQ: this.engine.CITADEL_REQ,
      FOOD_CONSUMPTION_MULT: this.engine.FOOD_CONSUMPTION_MULT,
    };
  }

  // Socket.io instance, set once at boot (lib/setup-routes.js: `engine.io = io`).
  // Routes need this to push real-time notifications (A4-6) without requiring
  // engine.js directly, which check-command-boundary forbids.
  getIo() {
    return this.engine.io;
  }

  // ── Read helpers used by routes for validation ────────────────────────────
  getAvailableUnits(kingdom, unitType) {
    return this.engine.getAvailableUnits(kingdom, unitType);
  }

  calculateBuildCost(building, level) {
    return this.engine.calculateBuildCost(building, level);
  }

  calculateBuildTime(kingdomOrBuilding, tierOrLevel) {
    return this.engine.calculateBuildTime(kingdomOrBuilding, tierOrLevel);
  }

  calculateHappiness(kingdom) {
    return this.engine.calculateHappiness(kingdom);
  }

  goldPerTurn(kingdom) {
    return this.engine.goldPerTurn(kingdom);
  }

  manaPerTurn(kingdom) {
    return this.engine.manaPerTurn(kingdom);
  }

  farmProduction(kingdom) {
    return this.engine.farmProduction(kingdom);
  }

  foodConsumption(kingdom) {
    return this.engine.foodConsumption(kingdom);
  }

  raceBonus(kingdom) {
    return this.engine.raceBonus(kingdom);
  }

  /** Race string or kingdom-like object — matches engine.assignRegion */
  assignRegion(raceOrKingdom) {
    return this.engine.assignRegion(raceOrKingdom);
  }

  getBuildingLandCost(configKey) {
    const table = this.engine.BUILDING_LAND_COST || {};
    return table[configKey] || 0;
  }

  defenseRating(kingdom) {
    return this.engine.defenseRating(kingdom);
  }

  wallDefensePower(kingdom) {
    return this.engine.wallDefensePower(kingdom);
  }

  towerDetectionPower(kingdom) {
    return this.engine.towerDetectionPower(kingdom);
  }

  outpostRangerPower(kingdom) {
    return this.engine.outpostRangerPower(kingdom);
  }

  unitLevelMult(kingdom, unitType) {
    return this.engine.unitLevelMult(kingdom, unitType);
  }

  // validateSpellTarget(caster, target, spellId)
  validateSpellTarget(kingdom, target, spellId) {
    return this.engine.validateSpellTarget(kingdom, target, spellId);
  }

  canPrestige(kingdom) {
    return this.engine.canPrestige(kingdom);
  }

  totalHiredUnits(kingdom) {
    return this.engine.totalHiredUnits(kingdom);
  }

  awardHeroXp(hero, amount) {
    return this.engine.awardHeroXp(hero, amount);
  }

  applyHeroTurnBonuses(hero, kingdom, updates, events) {
    return this.engine.applyHeroTurnBonuses(hero, kingdom, updates, events);
  }

  marketIncomeFull(kingdom) {
    return this.engine.marketIncomeFull(kingdom);
  }

  tavernEntertainmentBonus(kingdom) {
    return this.engine.tavernEntertainmentBonus(kingdom);
  }

  /** Convenience: FOOD_CONSUMPTION_MULT[race] with fallback */
  foodConsumptionMult(race) {
    const table = this.engine.FOOD_CONSUMPTION_MULT || {};
    return table[race] || 1.0;
  }
}

function createCommandHandler(engineImpl) {
  return new CommandHandler(engineImpl);
}

// Production singleton
const defaultHandler = new CommandHandler();

module.exports = defaultHandler;
module.exports.CommandHandler = CommandHandler;
module.exports.createCommandHandler = createCommandHandler;
module.exports.COMMAND_TYPES = COMMAND_TYPES;
module.exports.assertSerializable = assertSerializable;
