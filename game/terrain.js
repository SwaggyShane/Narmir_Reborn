// game/terrain.js - Terrain system: types, modifiers, bootstrap mapping

const TERRAIN_TYPES = {
  PLAINS: 'plains',
  FOREST: 'forest',
  MOUNTAINS: 'mountains',
  DESERT: 'desert',
  SWAMP: 'swamp',
  HILLS: 'hills',
  COAST: 'coast',
};

const TERRAIN_DATA = {
  plains: {
    displayName: 'Plains',
    color: '#556b2f',
    modifiers: {
      expSpeed: 1.12,     // +12% travel speed (faster arrival)
      combatDef: 1.00,
      combatAtk: 1.05,
      resourceYield: 1.08,
    },
  },
  forest: {
    displayName: 'Forest',
    color: '#2d4a2d',
    modifiers: {
      expSpeed: 0.92,
      combatDef: 1.12,
      combatAtk: 0.95,
      resourceYield: 1.10,
    },
  },
  mountains: {
    displayName: 'Mountains',
    color: '#5c4033',
    modifiers: {
      expSpeed: 0.80,     // -20%
      combatDef: 1.20,
      combatAtk: 0.92,
      resourceYield: 1.05,
    },
  },
  hills: {
    displayName: 'Hills',
    color: '#6b5b3f',
    modifiers: {
      expSpeed: 0.95,
      combatDef: 1.08,
      combatAtk: 1.00,
      resourceYield: 1.02,
    },
  },
  swamp: {
    displayName: 'Swamp',
    color: '#3a3f2a',
    modifiers: {
      expSpeed: 0.78,
      combatDef: 1.06,
      combatAtk: 0.90,
      resourceYield: 0.92,
    },
  },
  desert: {
    displayName: 'Desert',
    color: '#8b7355',
    modifiers: {
      expSpeed: 0.88,
      combatDef: 0.95,
      combatAtk: 1.00,
      resourceYield: 0.82,
    },
  },
  coast: {
    displayName: 'Coast',
    color: '#3a5f7a',
    modifiers: {
      expSpeed: 1.05,
      combatDef: 1.00,
      combatAtk: 1.02,
      resourceYield: 1.15,
    },
  },
};

const RACE_TO_TERRAIN = {
  dwarf: 'mountains',
  high_elf: 'forest',
  wood_elf: 'forest',
  orc: 'plains',
  human: 'plains',
  dire_wolf: 'hills',
  vampire: 'swamp',
  dark_elf: 'hills',
  ogre: 'mountains',
};

function getTerrainForRace(race) {
  return RACE_TO_TERRAIN[race] || 'plains';
}

function getTerrainModifiers(terrain) {
  const data = TERRAIN_DATA[terrain] || TERRAIN_DATA.plains;
  return { ...data.modifiers };
}

function getTerrainDisplayName(terrain) {
  return (TERRAIN_DATA[terrain] || TERRAIN_DATA.plains).displayName;
}

function getTerrainColor(terrain) {
  return (TERRAIN_DATA[terrain] || TERRAIN_DATA.plains).color;
}

module.exports = {
  TERRAIN_TYPES,
  TERRAIN_DATA,
  RACE_TO_TERRAIN,
  getTerrainForRace,
  getTerrainModifiers,
  getTerrainDisplayName,
  getTerrainColor,
};
