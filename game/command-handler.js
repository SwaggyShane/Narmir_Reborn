// game/command-handler.js
// Command handler abstraction layer for Slice 1 of Phase 2.
// Routes dispatch commands here instead of calling engine directly.
// This decouples routes from game logic implementation details.

const engine = require('./engine');

class CommandHandler {
  constructor() {
    // Engine is a singleton, imported once
    this.engine = engine;
  }

  /**
   * Route a command to the appropriate handler.
   * @param {object} command - { type, ...payload }
   * @param {object} context - { kingdom, db }
   * @returns {object} { updates, events } or command-specific result
   */
  async handle(command, context) {
    if (!command || !command.type) {
      throw new Error('Command must have a type property');
    }

    const { type, ...payload } = command;
    const { kingdom, db } = context || {};

    // Route to handler based on command type
    switch (type) {
      // Core turn processing
      case 'turn':
        return this.handleTurn(kingdom, db);

      // Expeditions
      case 'expeditions':
        return this.handleExpeditions(kingdom, db);

      // Combat
      case 'combat':
        return this.handleCombat(kingdom, db, payload);

      // Spells
      case 'spell':
        return this.handleSpell(kingdom, db, payload);

      // Covert operations
      case 'covert-spy':
      case 'covert-loot':
      case 'covert-assassinate':
      case 'covert-sabotage':
        return this.handleCovertOp(type, kingdom, db, payload);

      // Unit hiring
      case 'hire-units':
        return this.handleHireUnits(kingdom, db, payload);

      case 'hire-mercenaries':
        return this.handleHireMercenaries(kingdom, db, payload);

      case 'recruit-hero':
        return this.handleRecruitHero(kingdom, db, payload);

      // Construction
      case 'queue-buildings':
        return this.handleQueueBuildings(kingdom, db, payload);

      case 'demolish-building':
        return this.handleDemolishBuilding(kingdom, db, payload);

      case 'process-build-queue':
        return this.handleProcessBuildQueue(kingdom, db, payload);

      // Research
      case 'study-discipline':
        return this.handleStudyDiscipline(kingdom, db, payload);

      case 'select-school':
        return this.handleSelectSchool(kingdom, db, payload);

      // Prestige
      case 'prestige':
        return this.handlePrestige(kingdom, db, payload);

      // Scoring and calculations (non-mutating)
      case 'calculate-score':
        return this.handleCalculateScore(kingdom);

      default:
        throw new Error(`Unknown command type: ${type}`);
    }
  }

  // ── Turn Processing ──
  handleTurn(kingdom, db) {
    return this.engine.processTurn(kingdom, db);
  }

  // ── Expeditions ──
  handleExpeditions(kingdom, db) {
    return this.engine.resolveExpeditions(db, kingdom, this.engine);
  }

  // ── Combat ──
  handleCombat(kingdom, db, payload) {
    const { targetId, ...rest } = payload;
    return this.engine.resolveMilitaryAttack(kingdom, targetId, db, rest);
  }

  // ── Spells ──
  handleSpell(kingdom, db, payload) {
    const { spellId, targetId } = payload;
    return this.engine.castSpell(kingdom, spellId, targetId, db);
  }

  // ── Covert Operations ──
  handleCovertOp(type, kingdom, db, payload) {
    const { targetId } = payload;
    const opType = type.replace('covert-', '');

    switch (opType) {
      case 'spy':
        return this.engine.covertSpy(kingdom, targetId, db);
      case 'loot':
        return this.engine.covertLoot(kingdom, targetId, db);
      case 'assassinate':
        return this.engine.covertAssassinate(kingdom, targetId, db);
      case 'sabotage':
        return this.engine.covertSabotage(kingdom, targetId, db);
      default:
        throw new Error(`Unknown covert operation: ${opType}`);
    }
  }

  // ── Unit Hiring ──
  handleHireUnits(kingdom, db, payload) {
    const { unitType, quantity } = payload;
    return this.engine.hireUnits(kingdom, unitType, quantity, db);
  }

  handleHireMercenaries(kingdom, db, payload) {
    const { tier, quantity } = payload;
    return this.engine.hireMercenaries(kingdom, tier, quantity, db);
  }

  handleRecruitHero(kingdom, db, payload) {
    const { heroClass } = payload;
    return this.engine.recruitHero(kingdom, heroClass, db);
  }

  // ── Construction ──
  handleQueueBuildings(kingdom, db, payload) {
    const { orders } = payload;
    return this.engine.queueBuildings(kingdom, orders);
  }

  handleDemolishBuilding(kingdom, db, _payload) {
    const { buildingType } = _payload;
    return this.engine.demolishBuilding(kingdom, buildingType, db);
  }

  handleProcessBuildQueue(kingdom, db) {
    return this.engine.processBuildQueue(kingdom, db);
  }

  // ── Research ──
  handleStudyDiscipline(kingdom, db, payload) {
    const { discipline, allocation } = payload;
    return this.engine.studyDiscipline(kingdom, discipline, allocation, db);
  }

  handleSelectSchool(kingdom, db, payload) {
    const { school } = payload;
    return this.engine.selectSchool(kingdom, school);
  }

  // ── Prestige ──
  handlePrestige(kingdom, db) {
    return this.engine.processPrestige(kingdom, db);
  }

  // ── Non-Mutating Calculations ──
  handleCalculateScore(kingdom) {
    return this.engine.calculateScore(kingdom);
  }

  // ── Pass-through for Constants (used by routes for data, not commands) ──
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

  // ── Helper methods for routes that use engine functions for calculations ──
  getAvailableUnits(kingdom, unitType) {
    return this.engine.getAvailableUnits(kingdom, unitType);
  }

  calculateBuildCost(building, level) {
    return this.engine.calculateBuildCost(building, level);
  }

  calculateBuildTime(building, level) {
    return this.engine.calculateBuildTime(building, level);
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

  assignRegion(kingdom) {
    return this.engine.assignRegion(kingdom);
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

  validateSpellTarget(kingdom, spellId, targetId) {
    return this.engine.validateSpellTarget(kingdom, spellId, targetId);
  }

  canPrestige(kingdom) {
    return this.engine.canPrestige(kingdom);
  }
}

// Export singleton instance
module.exports = new CommandHandler();
