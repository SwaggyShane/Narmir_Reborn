// game/terrain.js - Terrain system: types, modifiers, bootstrap mapping

const TERRAIN_TYPES = {
  PLAINS: 'plains',
  FOREST: 'forest',
  MOUNTAINS: 'mountains',
  DESERT: 'desert',
  SWAMP: 'swamp',
  HILLS: 'hills',
  COAST: 'coast',
  TUNDRA: 'tundra',
  VOLCANIC: 'volcanic',
  LAKE: 'lake',
  OCEAN: 'ocean',
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
  tundra: {
    displayName: 'Tundra',
    color: '#7a8a94',
    modifiers: {
      expSpeed: 0.75,     // -25%, harsh polar travel
      combatDef: 1.10,
      combatAtk: 0.90,
      resourceYield: 0.75,
    },
  },
  volcanic: {
    displayName: 'Volcanic',
    color: '#7a2e1a',
    modifiers: {
      expSpeed: 0.70,     // -30%, hazardous terrain
      combatDef: 0.95,
      combatAtk: 1.10,
      resourceYield: 1.25, // rich but dangerous, matches "ancient artifacts" flavor
    },
  },
  lake: {
    displayName: 'Lake',
    color: '#2a5f8a',
    modifiers: {
      expSpeed: 0.60,     // land expeditions crossing water, heavily slowed
      combatDef: 1.15,    // natural barrier at a defender's back
      combatAtk: 0.85,
      resourceYield: 1.20, // fishing
    },
  },
  ocean: {
    displayName: 'Ocean',
    color: '#0d3a5c',
    modifiers: {
      expSpeed: 0.55,     // open sea, slowest of all for land-based expeditions
      combatDef: 1.05,
      combatAtk: 0.85,
      resourceYield: 1.10,
    },
  },
};

// Climate-band terrains (tundra, volcanic, ocean) are not tied to any race —
// they appear at fixed map latitudes regardless of who lives there. Lake is
// placed once per region (see WorldmapRenderer.jsx buildHexGrid), not
// randomly mixed in like the others. No RACE_TO_TERRAIN entry needed for any
// of these four.

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

/**
 * Generate a mix of terrains for a region, weighted toward the dominant race terrain.
 * Returns an array of terrain types to be distributed as patches within the region.
 * @param {string} race - Kingdom race
 * @param {number} patchCount - Number of terrain patches to generate (default 5-8)
 * @returns {array} Array of terrain types for the region
 */
function generateMixedBiomes(race, patchCount = 0) {
  if (patchCount === 0) {
    patchCount = 5 + Math.floor(Math.random() * 4); // 5-8 patches
  }

  const dominantTerrain = getTerrainForRace(race);
  const complementaryTerrains = {
    mountains: ['hills', 'forest', 'tundra'],
    forest: ['hills', 'plains', 'swamp'],
    plains: ['hills', 'coast', 'forest'],
    hills: ['plains', 'forest', 'mountains'],
    swamp: ['forest', 'plains', 'lake'],
  };

  const companions = complementaryTerrains[dominantTerrain] || ['plains', 'hills'];
  const biomes = [dominantTerrain]; // Always start with dominant

  // Fill remaining patches (60% dominant, 40% mixed)
  const dominantCount = Math.ceil(patchCount * 0.6);
  for (let i = 1; i < patchCount; i++) {
    if (i < dominantCount) {
      biomes.push(dominantTerrain);
    } else {
      biomes.push(companions[Math.floor(Math.random() * companions.length)]);
    }
  }

  // Shuffle for natural distribution
  return biomes.sort(() => Math.random() - 0.5);
}

module.exports = {
  TERRAIN_TYPES,
  TERRAIN_DATA,
  RACE_TO_TERRAIN,
  getTerrainForRace,
  getTerrainModifiers,
  getTerrainDisplayName,
  getTerrainColor,
  generateMixedBiomes,
};
