// Hex geometry constants
export const HEX_SIZE = 34;
export const HEX_W = Math.sqrt(3) * HEX_SIZE;
export const HEX_VERT = HEX_SIZE * 1.5;

// SVG rendering constants
export const HEX_STROKE_WIDTH = 0.5;
export const HEX_STROKE_COLOR = 'rgba(255,255,255,0.1)';

// Terrain colors (as const assertion for type safety)
export const TERRAIN_COLORS = {
  plains: '#556b2f',
  forest: '#2d4a2d',
  mountains: '#5c4033',
  hills: '#6b5b3f',
  swamp: '#3a3f2a',
  desert: '#8b7355',
  coast: '#3a5f7a',
  tundra: '#7a8a94',
  volcanic: '#7a2e1a',
  lake: '#2a5f8a',
  ocean: '#0d3a5c',
} as const;

// Fog of war styling
export const FOG_COLORS = {
  unseen: 'rgb(0,0,0)',
  unseenOpacity: 0.92,
} as const;

// Z-index layers for SVG rendering
export const Z_INDEX = {
  terrain: 1,
  river: 2,
  fog: 3,
  boundary: 4,
  interactive: 5,
} as const;
