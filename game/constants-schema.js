// Game constants metadata and validation schema
// Defines which constants are editable, their types, ranges, and descriptions

const EDITABLE_CONSTANTS = {
  gameplay: {
    unitCost: {
      key: 'UNIT_COST',
      label: 'Unit Hiring Cost',
      type: 'number',
      min: 100,
      max: 5000,
      step: 50,
      description: 'Gold cost to recruit one fighter, ranger, cleric, mage, thief, or ninja',
      editable: true,
    },
    maxResearch: {
      key: 'MAX_RESEARCH',
      label: 'Max Research per Discipline',
      type: 'number',
      min: 500,
      max: 5000,
      step: 100,
      description: 'Hard cap for any single research discipline',
      editable: true,
    },
    maxPopulation: {
      key: 'MAX_POPULATION',
      label: 'Max Population Capacity',
      type: 'number',
      min: 10000,
      max: 500000,
      step: 5000,
      description: 'Maximum population a kingdom can have',
      editable: true,
    },
    moveArmy: {
      key: 'MOVE_ARMY',
      label: 'Move Army Turn Cost',
      type: 'number',
      min: 1,
      max: 50,
      step: 1,
      description: 'Turns required to move army between locations',
      editable: true,
    },
  },
  expeditions: {
    baseSpeed: {
      key: 'EXPEDITION_BASE_SPEED',
      label: 'Base Expedition Speed',
      type: 'number',
      min: 1,
      max: 100,
      step: 1,
      description: 'Base distance traveled per tick (lower = faster)',
      editable: true,
    },
    yieldMultiplier: {
      key: 'EXPEDITION_YIELD_MULT',
      label: 'Expedition Yield Multiplier',
      type: 'number',
      min: 0.5,
      max: 10,
      step: 0.1,
      description: 'Multiplier for resource yields from expeditions',
      editable: true,
    },
  },
  combat: {
    baseAttackCost: {
      key: 'COMBAT_CONSTANTS.baseAttackCost',
      label: 'Base Attack Turn Cost',
      type: 'number',
      min: 1,
      max: 50,
      step: 1,
      description: 'Turns required for a normal attack',
      editable: true,
    },
    defenseDifficulty: {
      key: 'COMBAT_CONSTANTS.defenseDifficulty',
      label: 'Defense Difficulty Multiplier',
      type: 'number',
      min: 0.5,
      max: 3,
      step: 0.1,
      description: 'Multiplier affecting defense success rate',
      editable: true,
    },
  },
  goals: {
    dailyResetHours: {
      key: 'GOAL_RESET_HOURS.daily',
      label: 'Daily Goal Reset Hours',
      type: 'number',
      min: 1,
      max: 48,
      step: 1,
      description: 'Hours between daily goal resets',
      editable: true,
    },
    weeklyResetHours: {
      key: 'GOAL_RESET_HOURS.weekly',
      label: 'Weekly Goal Reset Hours',
      type: 'number',
      min: 24,
      max: 336,
      step: 24,
      description: 'Hours between weekly goal resets (7 days = 168)',
      editable: true,
    },
    monthlyResetHours: {
      key: 'GOAL_RESET_HOURS.monthly',
      label: 'Monthly Goal Reset Hours',
      type: 'number',
      min: 336,
      max: 1200,
      step: 24,
      description: 'Hours between monthly goal resets (~30 days = 720)',
      editable: true,
    },
  },
};

// Immutable constants (read-only in admin panel)
const IMMUTABLE_CONSTANTS = {
  raceNames: {
    key: 'RACE_NAMES',
    label: 'Race Names',
    description: 'Core game races (read-only)',
    editable: false,
  },
  raceBonuses: {
    key: 'RACE_BONUSES',
    label: 'Race Bonuses',
    description: 'Race-specific gameplay bonuses (read-only)',
    editable: false,
  },
  regionData: {
    key: 'REGION_DATA',
    label: 'Region Data',
    description: 'World region definitions (read-only)',
    editable: false,
  },
};

// Validate a constant value against its schema
function validateConstant(section, key, value) {
  const sectionDefs = EDITABLE_CONSTANTS[section];
  if (!sectionDefs) {
    return { valid: false, error: `Invalid section: ${section}` };
  }

  const def = Object.values(sectionDefs).find(d => d.key === key);
  if (!def) {
    return { valid: false, error: `Constant not found: ${key}` };
  }

  if (!def.editable) {
    return { valid: false, error: `Constant is read-only: ${key}` };
  }

  const numValue = parseFloat(value);
  if (isNaN(numValue)) {
    return { valid: false, error: `Invalid number: ${value}` };
  }

  if (numValue < def.min || numValue > def.max) {
    return {
      valid: false,
      error: `Value must be between ${def.min} and ${def.max}`,
    };
  }

  return { valid: true, value: numValue };
}

// Get schema definition for a constant
function getConstantSchema(section, key) {
  const sectionDefs = EDITABLE_CONSTANTS[section];
  if (!sectionDefs) return null;
  return Object.values(sectionDefs).find(d => d.key === key) || null;
}

// Get all editable constants for a section
function getSectionConstants(section) {
  return EDITABLE_CONSTANTS[section] || {};
}

module.exports = {
  EDITABLE_CONSTANTS,
  IMMUTABLE_CONSTANTS,
  validateConstant,
  getConstantSchema,
  getSectionConstants,
};
