import { REGION_META, REGION_BONUSES } from '../../utils/raceData.js';
import { escapeHtml } from '../../utils/escapeHtml.js';
import { NODE_TYPE_META, getNodeRadius } from '../../utils/worldMapNodeMeta.js';

function regionOpacity(race, highlightedRace, dim = '0.3') {
  if (!highlightedRace) return '1';
  return race === highlightedRace ? '1' : dim;
}

const DEFAULT_LAYERS = {
  kingdoms: true,
  nodes: true,
  routes: true,
  expeditions: true,
  terrain: true,
};

// Bootstrap race -> dominant biome mapping — kept in sync with game/terrain.js RACE_TO_TERRAIN.
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

const TERRAIN_COLORS = {
  plains: '#556b2f',
  forest: '#2d4a2d',
  mountains: '#5c4033',
  hills: '#6b5b3f',
  swamp: '#3a3f2a',
  desert: '#8b7355',
  coast: '#3a5f7a',
  tundra: '#7a8a94',
  volcanic: '#7a2e1a',
};

const TERRAIN_DISPLAY_NAMES = {
  plains: 'Plains',
  forest: 'Forest',
  mountains: 'Mountains',
  hills: 'Hills',
  swamp: 'Swamp',
  desert: 'Desert',
  coast: 'Coast',
  tundra: 'Tundra',
  volcanic: 'Volcanic',
};

// Expedition speed modifier per terrain — kept in sync with game/terrain.js TERRAIN_DATA.
// Shown in the map tooltip since it's the modifier Phase 2 actually wires into gameplay.
const TERRAIN_EXP_SPEED = {
  plains: 1.12,
  forest: 0.92,
  mountains: 0.80,
  hills: 0.95,
  swamp: 0.78,
  desert: 0.88,
  coast: 1.05,
  tundra: 0.75,
  volcanic: 0.70,
};

function terrainTooltip(terrain) {
  const name = TERRAIN_DISPLAY_NAMES[terrain] || 'Plains';
  const speed = TERRAIN_EXP_SPEED[terrain] ?? 1.0;
  const pct = Math.round((speed - 1) * 100);
  const speedLabel = pct === 0 ? 'no change' : `${pct > 0 ? '+' : ''}${pct}% expedition speed`;
  return `${name} — ${speedLabel}`;
}

function layerVisibilityStyle(enabled) {
  return enabled ? '' : 'opacity:0;pointer-events:none';
}

// Blends a hex color toward white by `amount` (0-1). Used so the terrain-off
// region fill is a visibly lighter shade of the race color, distinct from the
// brighter, unlightened stroke color used for borders. Only handles literal
// #rrggbb strings (all REGION_META fill colors are); anything else (e.g. a
// CSS var used for some stroke colors) is returned unchanged.
function lightenHexColor(hex, amount) {
  const match = /^#([0-9a-f]{6})$/i.exec(hex || '');
  if (!match) return hex;
  const num = parseInt(match[1], 16);
  const channels = [(num >> 16) & 0xff, (num >> 8) & 0xff, num & 0xff]
    .map((c) => Math.round(c + (255 - c) * amount));
  return '#' + channels.map((c) => c.toString(16).padStart(2, '0')).join('');
}

// ── World map region layout ─────────────────────────────────────────────────
// Every race's "home" seed point on the 900x650 canvas. The hex grid below
// assigns each tile to whichever race's home is nearest, so regions tile the
// whole map with no gaps or overlaps by construction. To add a future race:
// add one entry here, one to RACE_TO_TERRAIN above, and one to REGION_META /
// REGION_BONUSES in raceData.js — no other changes needed.
const RACE_HOMES = {
  dwarf: { x: 180, y: 230 },
  high_elf: { x: 520, y: 160 },
  wood_elf: { x: 720, y: 220 },
  vampire: { x: 420, y: 330 },
  ogre: { x: 800, y: 390 },
  dark_elf: { x: 560, y: 430 },
  orc: { x: 700, y: 490 },
  human: { x: 300, y: 430 },
  dire_wolf: { x: 130, y: 400 },
};

// Regions where a dominant biome, when it isn't chosen, can plausibly bleed
// into an adjacent patch instead (keeps mixed biomes thematically coherent
// rather than fully random).
const BIOME_MIX_ALTERNATES = {
  mountains: ['hills', 'forest'],
  forest: ['hills', 'swamp'],
  plains: ['hills', 'coast'],
  hills: ['plains', 'forest', 'mountains'],
  swamp: ['forest', 'coast'],
  desert: ['hills', 'volcanic'],
  coast: ['plains', 'swamp'],
};

const HEX_SIZE = 34; // center-to-corner radius
const HEX_W = Math.sqrt(3) * HEX_SIZE;
const HEX_VERT = HEX_SIZE * 1.5;
const NORTH_BAND_FRAC = 0.15; // top strip of the map -> tundra only
const SOUTH_BAND_FRAC = 0.15; // bottom strip of the map -> desert/volcanic

// Deterministic per-cell "random" value so the map's biome mix is stable
// across re-renders instead of reshuffling on every data refresh.
function hexSeededRandom(col, row, salt) {
  let t = (col * 374761393 + row * 668265263 + salt * 2654435761) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function hexCenter(col, row) {
  const x = col * HEX_W + (row % 2 !== 0 ? HEX_W / 2 : 0);
  const y = row * HEX_VERT;
  return { x, y };
}

function hexCorners(cx, cy, size) {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    pts.push([
      Math.round((cx + size * Math.cos(angle)) * 10) / 10,
      Math.round((cy + size * Math.sin(angle)) * 10) / 10,
    ]);
  }
  return pts;
}

function hexPath(cx, cy, size) {
  const pts = hexCorners(cx, cy, size);
  return 'M' + pts.map((p) => p.join(',')).join('L') + 'Z';
}

// odd-r offset neighbor directions (pointy-top hexes), indexed by row parity.
// Direction order is E, NE, NW, W, SW, SE — this order is fixed regardless of
// row parity, which is what makes DIRECTION_EDGE_CORNERS below valid for both.
const ODDR_DIRECTIONS = [
  [[1, 0], [0, -1], [-1, -1], [-1, 0], [-1, 1], [0, 1]],
  [[1, 0], [1, -1], [0, -1], [-1, 0], [0, 1], [1, 1]],
];

// For hexCorners' angle formula (60*i - 30), corner i is: 0=E-ish upper,
// 1=lower-right, 2=bottom, 3=lower-left, 4=upper-left, 5=top. Each of the six
// neighbor directions above corresponds to exactly one edge (pair of adjacent
// corners) — this lets us draw only the true shared edge between two
// differently-raced cells instead of a whole hex ring per border cell.
const DIRECTION_EDGE_CORNERS = [
  [0, 1], // E
  [5, 0], // NE
  [4, 5], // NW
  [3, 4], // W
  [2, 3], // SW
  [1, 2], // SE
];

function hexNeighborKeys(col, row) {
  const parity = row & 1;
  return ODDR_DIRECTIONS[parity].map(([dc, dr]) => `${col + dc},${row + dr}`);
}

function nearestRaceHome(x, y) {
  let best = null;
  let bestDist = Infinity;
  Object.entries(RACE_HOMES).forEach(([race, home]) => {
    const dx = x - home.x;
    const dy = y - home.y;
    const dist = dx * dx + dy * dy;
    if (dist < bestDist) {
      bestDist = dist;
      best = race;
    }
  });
  return best || 'human';
}

// Builds the full hex tessellation: every cell gets a race (for border/legend
// coloring) and a terrain (dominant race biome, an occasional mixed-in
// alternate, or a forced tundra/desert/volcanic band at the map's edges).
function buildHexGrid(W, H) {
  const cols = Math.ceil(W / HEX_W) + 2;
  const rows = Math.ceil(H / HEX_VERT) + 2;
  const cells = [];
  const cellMap = new Map();

  for (let row = -1; row < rows; row++) {
    for (let col = -1; col < cols; col++) {
      const { x, y } = hexCenter(col, row);
      if (x < -HEX_W || x > W + HEX_W || y < -HEX_VERT || y > H + HEX_VERT) continue;

      const race = nearestRaceHome(x, y);
      let terrain;
      if (y < H * NORTH_BAND_FRAC) {
        terrain = 'tundra';
      } else if (y > H * (1 - SOUTH_BAND_FRAC)) {
        terrain = hexSeededRandom(col, row, 3) < 0.55 ? 'desert' : 'volcanic';
      } else {
        const dominant = RACE_TO_TERRAIN[race] || 'plains';
        if (hexSeededRandom(col, row, 1) < 0.7) {
          terrain = dominant;
        } else {
          const alternates = BIOME_MIX_ALTERNATES[dominant] || ['plains'];
          terrain = alternates[Math.floor(hexSeededRandom(col, row, 2) * alternates.length)];
        }
      }

      const cell = { col, row, x, y, race, terrain };
      cells.push(cell);
      cellMap.set(`${col},${row}`, cell);
    }
  }

  return { cells, cellMap };
}

export function renderWorldMap(
  kingdoms,
  routes = [],
  highlightedRace = null,
  kingdomId = null,
  options = {},
) {
  const nodes = options.nodes || [];
  const expeditions = options.expeditions || [];
  const layers = { ...DEFAULT_LAYERS, ...(options.layers || {}) };
  const state = {
    kingdomId,
  };

        var W = 900,

          H = 650;

        var bg = "url(#oceanGrad)";



        // Build SVG

        var svg =

          '<svg viewBox="0 0 ' +

          W +

          " " +

          H +

          '" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block;border-radius:12px;box-shadow:inset 0 0 40px rgba(0,0,0,0.8), 0 0 10px rgba(0,0,0,0.5); background:#040710;">';
        // Defs - filters and gradients
        svg +=

          "<defs>" +

          '<linearGradient id="oceanGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#050a18"/><stop offset="50%" stop-color="#091225"/><stop offset="100%" stop-color="#03050c"/></linearGradient>' +

          '<radialGradient id="vignette" cx="50%" cy="50%" r="75%"><stop offset="40%" stop-color="transparent"/><stop offset="100%" stop-color="rgba(0,0,0,0.85)"/></radialGradient>' +

          '<filter id="glow"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>' +

          '<filter id="softglow"><feGaussianBlur stdDeviation="6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>' +

          '<filter id="uiShadow"><feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000" flood-opacity="0.9"/></filter>' +

          "</defs>";



        // Background

        svg += '<rect width="' + W + '" height="' + H + '" fill="' + bg + '"/>';



        svg += '<g stroke="rgba(255,255,255,0.03)" stroke-width="1">';

        for (var gx = 0; gx < W; gx += 60)

          svg +=

            '<line x1="' + gx + '" y1="0" x2="' + gx + '" y2="' + H + '"/>';

        for (var gy = 0; gy < H; gy += 60)

          svg +=

            '<line x1="0" y1="' + gy + '" x2="' + W + '" y2="' + gy + '"/>';

        svg += "</g>";



        var rhumbs = [

          [W * 0.15, H * 0.2],

          [W * 0.85, H * 0.25],

          [W * 0.5, H * 0.85],

        ];

        rhumbs.forEach(function (pt) {

          svg +=

            '<circle cx="' +

            pt[0] +

            '" cy="' +

            pt[1] +

            '" r="800" stroke="rgba(255,255,255,0.015)" stroke-width="1" fill="none"/>';

          svg +=

            '<circle cx="' +

            pt[0] +

            '" cy="' +

            pt[1] +

            '" r="400" stroke="rgba(255,255,255,0.015)" stroke-width="1" fill="none"/>';

          for (var i = 0; i < 20; i++) {

            var a = (i * Math.PI) / 4;

            svg +=

              '<line x1="' +

              pt[0] +

              '" y1="' +

              pt[1] +

              '" x2="' +

              (pt[0] + Math.cos(a) * W) +

              '" y2="' +

              (pt[1] + Math.sin(a) * W) +

              '" stroke="rgba(255,255,255,0.02)" stroke-width="1"/>';

          }

        });



        // Non-overlapping hex tessellation covering the whole map. Every cell
        // belongs to exactly one race (by nearest RACE_HOMES point) and one
        // terrain (dominant race biome, an occasional mixed alternate, or a
        // forced tundra/desert/volcanic band at the map's far north/south).
        var hexGrid = buildHexGrid(W, H);

        // Terrain layer: the fill of every hex. Toggling "terrain" off shows
        // flat race-identity colors — lightened so the fill reads as its own
        // shade, distinct from the (brighter, unlightened) border color below.
        // Always visible: this layer now doubles as the flat race-color fill
        // when the terrain toggle is off, so it must never be hidden outright
        // (the toggle switches its fill color, not its visibility).
        svg += '<g class="wm-layer wm-layer-terrain">';
        hexGrid.cells.forEach(function (cell) {
          var meta = REGION_META[cell.race] || {};
          var fill = (layers.terrain !== false)
            ? (TERRAIN_COLORS[cell.terrain] || TERRAIN_COLORS.plains)
            : lightenHexColor(meta.color || TERRAIN_COLORS.plains, 0.35);
          svg += '<path d="' + hexPath(cell.x, cell.y, HEX_SIZE + 0.6) + '" fill="' + fill + '" class="terrain-shape" data-terrain="' + escapeHtml(cell.terrain) + '" data-race="' + escapeHtml(cell.race) + '" style="transform-box:fill-box;transform-origin:center;cursor:default" pointer-events="none"><title>' + escapeHtml(terrainTooltip(cell.terrain)) + '</title></path>';
        });
        svg += '</g>';

        // Region layer: each cell draws its OWN edge, inset slightly toward
        // its own center, wherever that edge faces a different race (or the
        // map's outer boundary). At an internal seam, both neighboring cells
        // draw their own inset edge in their own color, producing two
        // distinct parallel lines (one per side) instead of a single shared
        // line that has to arbitrarily pick one color. A dark underline is
        // drawn first so each line reads clearly against any biome color.
        svg += '<g class="wm-layer wm-layer-regions">';
        var BORDER_INSET = 4;
        var borderSegments = [];
        hexGrid.cells.forEach(function (cell) {
          var neighborKeys = hexNeighborKeys(cell.col, cell.row);
          var corners = hexCorners(cell.x, cell.y, HEX_SIZE - BORDER_INSET);
          neighborKeys.forEach(function (key, dirIndex) {
            var neighbor = hexGrid.cellMap.get(key);
            if (neighbor && neighbor.race === cell.race) return;
            var edge = DIRECTION_EDGE_CORNERS[dirIndex];
            var p1 = corners[edge[0]];
            var p2 = corners[edge[1]];
            borderSegments.push({ race: cell.race, p1: p1, p2: p2 });
          });
        });
        borderSegments.forEach(function (seg) {
          svg += '<line x1="' + seg.p1[0] + '" y1="' + seg.p1[1] + '" x2="' + seg.p2[0] + '" y2="' + seg.p2[1] + '" stroke="#000" stroke-width="4.5" stroke-linecap="round" opacity="0.5" pointer-events="none"/>';
        });
        borderSegments.forEach(function (seg) {
          var meta = REGION_META[seg.race] || {};
          svg += '<line x1="' + seg.p1[0] + '" y1="' + seg.p1[1] + '" x2="' + seg.p2[0] + '" y2="' + seg.p2[1] + '" stroke="' + (meta.stroke || '#fff') + '" stroke-width="2.25" stroke-linecap="round" class="region-shape wm-region" data-race="' + escapeHtml(seg.race) + '" style="transition:opacity 0.3s;opacity:' + regionOpacity(seg.race, highlightedRace) + '" pointer-events="none"/>';
        });
        svg += '</g>';

        // Region labels, one per race, centered on its home seed point.
        svg += '<g class="wm-layer wm-layer-region-labels">';
        Object.entries(REGION_META).forEach(function (e) {
          var race = e[0];
          var meta = e[1];
          var home = RACE_HOMES[race];
          if (!home) return;
          var cx = home.x;
          var cy = home.y;

          svg += '<g class="wm-region-label" filter="url(#uiShadow)" style="transition:opacity 0.3s;opacity:' + regionOpacity(race, highlightedRace) + '">';
          svg +=
            '<text x="' + cx + '" y="' + (cy - 8) +
            '" text-anchor="middle" font-family="Georgia,serif" font-weight="700" font-size="20" fill="#ffffff" opacity="0.9" pointer-events="none" style="text-transform:uppercase;letter-spacing:2px;">' +
            escapeHtml(meta.name || '') +
            "</text>";
          svg +=
            '<text x="' + cx + '" y="' + (cy + 12) +
            '" text-anchor="middle" font-family="sans-serif" font-weight="600" font-size="11" fill="' + meta.stroke +
            '" opacity="0.95" pointer-events="none">' +
            escapeHtml(REGION_BONUSES[race] || "") +
            "</text>";
          svg += "</g>";
        });
        svg += '</g>';

        // Grid lines - subtle
        for (gx = 0; gx < W; gx += 80) {

          svg +=

            '<line x1="' +

            gx +

            '" y1="0" x2="' +

            gx +

            '" y2="' +

            H +

            '" stroke="#ffffff" stroke-width="0.3" opacity="0.04"/>';

        }

        for (gy = 0; gy < H; gy += 80) {

          svg +=

            '<line x1="0" y1="' +

            gy +

            '" x2="' +

            W +

            '" y2="' +

            gy +

            '" stroke="#ffffff" stroke-width="0.3" opacity="0.04"/>';

        }



        // Kingdom dots — jittered around the kingdom's race's home seed point
        // (the same point the hex tessellation above uses), so dots land
        // inside their matching territory without a separate seed table.

        var kdCoords = {};

        kingdoms.forEach(function (k, i) {

          if (Number.isFinite(Number(k.map_x)) && Number.isFinite(Number(k.map_y))) {

            kdCoords[k.id] = { x: Number(k.map_x), y: Number(k.map_y) };

            return;

          }

          var home = RACE_HOMES[k.race] || { x: W / 2, y: H / 2 };

          kdCoords[k.id] = {

            x: home.x + (((i * 17 + 3) % 140) - 70),

            y: home.y + (((i * 13 + 7) % 140) - 70),

          };

        });



        svg += '<g class="wm-layer wm-layer-expeditions" style="' + layerVisibilityStyle(layers.expeditions !== false) + '">';

        if (expeditions.length) {

          var homeCoords = kdCoords[state.kingdomId];

          expeditions.forEach(function (exp) {

            if (!homeCoords || !Number.isFinite(Number(exp.map_x)) || !Number.isFinite(Number(exp.map_y))) return;

            svg +=

              '<line class="wm-expedition-line" x1="' +

              homeCoords.x +

              '" y1="' +

              homeCoords.y +

              '" x2="' +

              Number(exp.map_x) +

              '" y2="' +

              Number(exp.map_y) +

              '" stroke="#7ec8ff" stroke-width="1.5" stroke-dasharray="6 4" opacity="0.55" />';

          });

        }

        svg += '</g>';



        svg += '<g class="wm-layer wm-layer-nodes" style="' + layerVisibilityStyle(layers.nodes !== false) + '">';

        if (nodes.length) {

          nodes.forEach(function (node) {

            if (!Number.isFinite(Number(node.map_x)) || !Number.isFinite(Number(node.map_y))) return;

            var meta = NODE_TYPE_META[node.type] || NODE_TYPE_META.wood;

            var nx = Number(node.map_x);

            var ny = Number(node.map_y);

            var nr = getNodeRadius(node.richness);

            var activeExp = expeditions.some(function (exp) {

              return String(exp.node_id) === String(node.id);

            });

            var strokeWidth = activeExp ? 2.5 : 1.5;

            svg += '<g class="wm-node-group map-node-group" data-node-id="' + escapeHtml(String(node.id)) + '" transform="translate(' + nx + ',' + ny + ')">';

            // larger hit area for easier clicking, transparent
            svg += '<circle cx="0" cy="0" r="' + (nr + 8) + '" fill="transparent" style="pointer-events:visiblePainted" data-node-id="' + escapeHtml(String(node.id)) + '"/>';

            svg +=

              '<circle class="wm-node-halo" cx="0" cy="0" r="' +

              (nr + 3) +

              '" fill="' +

              meta.fill +

              '" opacity="0.18"/>';

            svg +=

              '<circle class="wm-node map-node" cx="0" cy="0" r="' +

              nr +

              '" fill="' +

              (node.terrain ? (TERRAIN_COLORS[node.terrain] || TERRAIN_COLORS.plains) : meta.fill) +

              '" stroke="' +

              meta.stroke +

              '" stroke-width="' +

              strokeWidth +

              '" data-base-stroke="' +

              strokeWidth +

              '" data-node-id="' +

              escapeHtml(String(node.id)) +

              '" data-node-type="' +

              escapeHtml(String(node.type || '')) +

              '" style="cursor:pointer" filter="' +

              (activeExp ? 'url(#glow)' : 'url(#uiShadow)') +

              '"/>';

            svg +=

              '<text class="wm-node-icon" x="0" y="4" text-anchor="middle" font-size="9" pointer-events="none">' +

              escapeHtml(meta.icon) +

              '</text>';

            svg += '</g>';

          });

        }

        svg += '</g>';



        svg += '<g class="wm-layer wm-layer-routes" style="' + layerVisibilityStyle(layers.routes !== false) + '">';

        routes.forEach(function (r) {

          var p1 = kdCoords[r.kingdom_id];

          var p2 = kdCoords[r.partner_id];

          if (p1 && p2) {

            svg +=

              '<line class="wm-trade-line" x1="' +

              p1.x +

              '" y1="' +

              p1.y +

              '" x2="' +

              p2.x +

              '" y2="' +

              p2.y +

              '" stroke="var(--gold)" stroke-width="1.5" stroke-dasharray="4 4" opacity="0.4" />';

          }

        });

        svg += '</g>';



        svg += '<g class="wm-layer wm-layer-kingdoms" style="' + layerVisibilityStyle(layers.kingdoms !== false) + '">';

        var sortedKingdoms = kingdoms.slice().sort(function (a, b) {

          return b.land - a.land;

        });

        sortedKingdoms.forEach(function (k, i) {

          var coords = kdCoords[k.id] || { x: 0, y: 0 };

          var jx = coords.x;

          var jy = coords.y;

          var isMe = k.id === state.kingdomId;

          var dotColor = REGION_META[k.race]

            ? REGION_META[k.race].stroke

            : "#ffffff";

          var r = isMe

            ? 7

            : Math.max(4.5, Math.min(8, 3.5 + Math.floor(k.land / 4000)));



          svg +=

            '<circle cx="' +

            jx +

            '" cy="' +

            (jy + 2) +

            '" r="' +

            r +

            '" fill="#000" opacity="0.6"/>';



          if (isMe) {

            svg +=

              '<circle class="wm-kingdom-ring" cx="' +

              jx +

              '" cy="' +

              jy +

              '" r="10" fill="none" stroke="#e8b84b" stroke-width="1.5" opacity="0.55" />';

          }



          svg +=

            '<circle cx="' +

            jx +

            '" cy="' +

            jy +

            '" r="' +

            r +

            '" fill="' +

            (isMe ? "#e8b84b" : dotColor) +

            '" stroke="' +

            (isMe ? "#fff" : "#111") +

            '" stroke-width="' +

            (isMe ? 2 : 1) +

            '" class="kd-dot wm-kingdom" data-race="' +

            k.race +

            '" data-kingdom-id="' + escapeHtml(String(k.id)) +

            '" style="cursor:pointer;transition:opacity 0.3s;opacity:' + regionOpacity(k.race, highlightedRace, '0.2') + '" filter="' +

            (isMe ? "url(#glow)" : "url(#uiShadow)") +

            '"/>';



          if (isMe || k.land > 5000 || k.rank <= 3) {

            svg +=

              '<text class="wm-kingdom-label" x="' +

              jx +

              '" y="' +

              (jy - r - 5) +

              '" text-anchor="middle" font-family="sans-serif" font-size="' +

              (isMe ? 12 : 9) +

              '" font-weight="' +

              (isMe ? 800 : 600) +

              '" fill="' +

              (isMe ? "#e8b84b" : "#fff") +

              '" filter="url(#uiShadow)" pointer-events="none">' +

              escapeHtml(k.name.slice(0, 10)) +

              "</text>";

          }

        });

        svg += '</g>';



        // Title

        svg +=

          '<text x="' +

          W / 2 +

          '" y="35" text-anchor="middle" font-family="Georgia,serif" font-size="18" fill="#e8b84b" filter="url(#glow)" font-weight="bold" letter-spacing="4" style="text-shadow: 0 4px 10px #000">NARMIR REBORN</text>';



        // Compass rose

        svg +=

          '<g transform="translate(' +

          (W - 90) +

          ", " +

          (H - 90) +

          ') scale(0.9)">' +

          '<circle cx="0" cy="0" r="45" fill="none" stroke="rgba(232, 184, 75, 0.4)" stroke-width="1.5" stroke-dasharray="4 4"/>' +

          '<circle cx="0" cy="0" r="35" fill="rgba(6, 8, 16, 0.5)" stroke="rgba(232, 184, 75, 0.6)" stroke-width="2"/>' +

          '<path d="M0,-30 L8,-8 L30,0 L8,8 L0,30 L-8,8 L-30,0 L-8,-8 Z" fill="rgba(232, 184, 75, 0.15)" stroke="#e8b84b" stroke-width="1"/>' +

          '<path d="M0,-30 L0,30 M-30,0 L30,0" stroke="#e8b84b" stroke-width="1.5" opacity="0.6"/>' +

          '<text x="0" y="-40" text-anchor="middle" font-family="Georgia,serif" font-size="16" fill="#e8b84b" font-weight="bold" filter="url(#glow)">N</text>' +

          "</g>";



        // Vignette over everything

        svg +=

          '<rect width="' +

          W +

          '" height="' +

          H +

          '" fill="url(#vignette)" pointer-events="none"/>';



        svg += "</svg>";

        return svg;
      }
