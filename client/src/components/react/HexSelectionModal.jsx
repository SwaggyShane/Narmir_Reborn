import React, { useCallback, useState, useRef, useEffect, useMemo } from 'react';
import { toast } from '../../utils/toast.js';
import { buildHexGrid, TERRAIN_COLORS, seedToInt32 } from '../../utils/terrainUtils.js';
import { useKingdomId } from '../../stores/profileStore.js';

const HEX_SIZE = 34;
const HEX_W = Math.sqrt(3) * HEX_SIZE;
const HEX_VERT = HEX_SIZE * 1.5;

function pixelToHex(x, y) {
  const r = y / HEX_VERT;
  const q = x / HEX_W - r / 2;
  const cubeX = q;
  const cubeZ = r;
  const cubeY = -cubeX - cubeZ;
  let rx = Math.round(cubeX);
  let ry = Math.round(cubeY);
  let rz = Math.round(cubeZ);
  const dx = Math.abs(rx - cubeX);
  const dy = Math.abs(ry - cubeY);
  const dz = Math.abs(rz - cubeZ);
  if (dx > dy && dx > dz) {
    rx = -ry - rz;
  } else if (dy > dz) {
    ry = -rx - rz;
  } else {
    rz = -rx - ry;
  }
  const row = rz + 0;
  const col = rx + (rz - (rz & 1)) / 2 + 0;
  return { col, row };
}

function hexCenter(col, row) {
  const x = col * HEX_W + (row % 2 !== 0 ? HEX_W / 2 : 0);
  const y = row * HEX_VERT;
  return { x, y };
}

function hexCorners(cx, cy, size = HEX_SIZE) {
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

const WORLD_WIDTH = 1999;
const WORLD_HEIGHT = 1380;
const WORLD_MAX_COL = 1999;
const WORLD_MAX_ROW = 1379;

const HexSelectionModal = ({ isOpen, context, onHexSelected, onClose }) => {
  const playerKingdomId = useKingdomId();
  const [selectedHex, setSelectedHex] = useState(null);
  const [worldSeed, setWorldSeed] = useState(null);
  const [visibility, setVisibility] = useState(null); // { seenCells, currentCells }
  const [playerKingdomHex, setPlayerKingdomHex] = useState(null); // { col, row } - player's home location (no fog)
  const svgRef = useRef(null);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState(null);

  const contextLabels = {
    hunting: { icon: '🥩', name: 'Hunting Expedition', desc: 'Click on a hex to send rangers' },
    prospecting: { icon: '⛏️', name: 'Prospecting Expedition', desc: 'Click on a hex to send engineers' },
    land_expansion: { icon: '🗺️', name: 'Land Expansion', desc: 'Click on a hex to claim lands' },
    epic_trek: { icon: '🛤️', name: 'Epic Trek', desc: 'Click on a destination hex' },
  };

  const contextLabel = contextLabels[context?.type] || { icon: '🗺️', name: 'Target Selection', desc: 'Click on a hex' };
  const durationLabel = context?.duration ? `${context.duration} turns` : 'Target Selection';

  // Fetch worldSeed and visibility on mount
  useEffect(() => {
    if (!isOpen) return;

    console.log('[HexSelectionModal] Modal opened, fetching map data. playerKingdomId:', playerKingdomId);
    let mounted = true;
    const fetchMapData = async () => {
      try {
        const res = await fetch('/api/kingdom/world-map');
        console.log('[HexSelectionModal] Fetch response status:', res.status);
        if (res.ok) {
          const data = await res.json();
          console.log('[HexSelectionModal] Data received. kingdoms count:', data.kingdoms?.length);
          if (mounted) {
            setWorldSeed(data.worldSeed || 0);
            // Parse visibility bitmaps
            try {
              const seenBig = BigInt(data.visibility?.seenCells || '0');
              const currentBig = BigInt(data.visibility?.currentCells || '0');
              setVisibility({ seenCells: seenBig, currentCells: currentBig });
            } catch (e) {
              console.error('Failed to parse visibility:', e);
              setVisibility(null);
            }
            // Get player's kingdom location (home hex, always visible - no fog)
            if (data.kingdoms && playerKingdomId) {
              const playerKingdom = data.kingdoms.find((k) => k.id === playerKingdomId);
              if (playerKingdom && playerKingdom.map_x !== undefined && playerKingdom.map_y !== undefined) {
                const homeHex = pixelToHex(playerKingdom.map_x, playerKingdom.map_y);
                console.log('[HexSelectionModal] Player kingdom:', playerKingdom.id, playerKingdom.name);
                console.log('[HexSelectionModal] Home location - map_x:', playerKingdom.map_x, 'map_y:', playerKingdom.map_y);
                console.log('[HexSelectionModal] Home hex - col:', homeHex.col, 'row:', homeHex.row);
                setPlayerKingdomHex(homeHex);
              } else {
                console.log('[HexSelectionModal] Could not find player kingdom. playerKingdomId:', playerKingdomId, 'kingdoms:', data.kingdoms?.length);
              }
            } else {
              console.log('[HexSelectionModal] No kingdoms or playerKingdomId. playerKingdomId:', playerKingdomId);
            }
          }
        } else if (mounted) {
          setWorldSeed(0);
          setVisibility(null);
        }
      } catch (err) {
        console.error('Failed to fetch map data:', err);
        if (mounted) {
          setWorldSeed(0);
          setVisibility(null);
        }
      }
    };

    fetchMapData();
    return () => { mounted = false; };
  }, [isOpen]);

  // Build hex grid with terrain once worldSeed is available
  const hexGrid = useMemo(() => {
    if (!isOpen || worldSeed === undefined || worldSeed === null) return null;
    return buildHexGrid(WORLD_WIDTH, WORLD_HEIGHT, worldSeed);
  }, [isOpen, worldSeed, visibility]);

  const handleHexClick = useCallback((col, row) => {
    if (col < 0 || col > WORLD_MAX_COL || row < 0 || row > WORLD_MAX_ROW) {
      return;
    }
    const hex = { x: col, y: row };
    setSelectedHex(hex);
    // Immediately trigger the action when hex is selected
    onHexSelected(hex);
  }, [onHexSelected]);

  const handleCancel = useCallback(() => {
    setSelectedHex(null);
    onClose();
  }, [onClose]);

  const handleSvgMouseDown = (e) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY, panX, panY });
  };

  const handleSvgMouseMove = (e) => {
    if (!isDragging || !dragStart) return;
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    setPanX(dragStart.panX + dx);
    setPanY(dragStart.panY + dy);
  };

  const handleSvgMouseUp = () => {
    setIsDragging(false);
    setDragStart(null);
  };

  const handleSvgClick = (e) => {
    if (isDragging) return;
    const svg = svgRef.current;
    if (!svg) return;

    try {
      const rect = svg.getBoundingClientRect();
      const svgX = e.clientX - rect.left - panX;
      const svgY = e.clientY - rect.top - panY;
      if (typeof pixelToHex !== 'function') {
        throw new Error('pixelToHex is not available');
      }
      const { col, row } = pixelToHex(svgX, svgY);
      handleHexClick(col, row);
    } catch (err) {
      console.error('[HexSelectionModal] Error converting pixel to hex:', err);
      toast('Unable to select hex. Please try again.', 'error');
    }
  };

  if (!isOpen) return null;

  // Client-side fog of war helpers (matches WorldmapRenderer fog logic)
  const CLIENT_CELL_INDEX_OFFSET = 8;
  const CLIENT_CELL_INDEX_STRIDE = 48;

  const clientCellIndex = (col, row) => {
    const colShifted = col + CLIENT_CELL_INDEX_OFFSET;
    const rowShifted = row + CLIENT_CELL_INDEX_OFFSET;
    if (colShifted < 0 || colShifted >= CLIENT_CELL_INDEX_STRIDE || rowShifted < 0) return -1;
    return rowShifted * CLIENT_CELL_INDEX_STRIDE + colShifted;
  };

  const isHexSeen = (col, row, seenBig) => {
    const idx = clientCellIndex(col, row);
    if (idx < 0 || !seenBig) return false;
    return (seenBig & (1n << BigInt(idx))) !== 0n;
  };

  const isHexCurrent = (col, row, currentBig) => {
    const idx = clientCellIndex(col, row);
    if (idx < 0 || !currentBig) return false;
    return (currentBig & (1n << BigInt(idx))) !== 0n;
  };

  // Build SVG elements from terrain grid
  const hexElements = [];
  const borderElements = [];
  const fogElements = [];

  if (hexGrid) {
    const { cells, cellMap } = hexGrid;
    const HEX_SIZE_RENDER = 34;
    const HEX_W = Math.sqrt(3) * HEX_SIZE_RENDER;
    const HEX_VERT = HEX_SIZE_RENDER * 1.5;

    // Render terrain hexes
    cells.forEach((cell) => {
      const { x: cx, y: cy } = hexCenter(cell.col, cell.row);
      const corners = hexCorners(cx, cy, HEX_SIZE_RENDER);
      const cornerStr = corners.map(([px, py]) => `${px},${py}`).join(' ');
      const isSelected = selectedHex && selectedHex.x === cell.col && selectedHex.y === cell.row;
      const terrainColor = TERRAIN_COLORS[cell.terrain] || '#556b2f';

      // Lighten terrain color slightly
      const baseColor = isSelected ? 'rgba(255, 200, 87, 0.8)' : terrainColor;

      hexElements.push(
        <polygon
          key={`hex-${cell.col}-${cell.row}`}
          points={cornerStr}
          fill={baseColor}
          stroke={isSelected ? 'var(--gold)' : 'rgba(255, 255, 255, 0.1)'}
          strokeWidth={isSelected ? 2 : 0.5}
          onClick={(e) => {
            e.stopPropagation();
            handleHexClick(cell.col, cell.row);
          }}
          style={{ cursor: 'pointer', transition: 'fill 0.1s' }}
        />
      );

      // Render fog overlay with three states: current (none), seen (dimmed), unseen (opaque)
      // Player's kingdom home hex is always visible (no fog)
      const isHomeHex = playerKingdomHex && cell.col === playerKingdomHex.col && cell.row === playerKingdomHex.row;
      if (isHomeHex) {
        console.log('[HexSelectionModal] Skipping fog for home hex:', cell.col, cell.row);
      }
      if (!isHomeHex) {
        const seenBig = visibility?.seenCells || 0n;
        const currentBig = visibility?.currentCells || 0n;
        let fogState = 'unseen';
        if (isHexCurrent(cell.col, cell.row, currentBig)) {
          fogState = 'current';
        } else if (isHexSeen(cell.col, cell.row, seenBig)) {
          fogState = 'seen';
        }

        if (fogState === 'seen') {
          fogElements.push(
            <polygon
              key={`fog-${cell.col}-${cell.row}`}
              points={cornerStr}
              fill="rgb(15,20,35)"
              opacity="0.65"
              stroke="none"
              pointerEvents="none"
            />
          );
        } else if (fogState === 'unseen') {
          fogElements.push(
            <polygon
              key={`fog-${cell.col}-${cell.row}`}
              points={cornerStr}
              fill="rgb(0,0,0)"
              opacity="0.92"
              stroke="none"
              pointerEvents="none"
            />
          );
        }
      }

      // Draw region boundaries (lines between hexes of different races)
      const parity = cell.row & 1;
      const neighbors = [
        [cell.col + 1, cell.row],
        [cell.col + (parity ? 0 : -1), cell.row - 1],
        [cell.col + (parity ? -1 : -1), cell.row - 1],
        [cell.col - 1, cell.row],
        [cell.col + (parity ? -1 : -1), cell.row + 1],
        [cell.col + (parity ? 0 : -1), cell.row + 1],
      ];

      neighbors.forEach((nPos, idx) => {
        const neighbor = cellMap.get(`${nPos[0]},${nPos[1]}`);
        if (neighbor && neighbor.race !== cell.race) {
          // Draw a line between shared edge corners
          const edgeCornerIndices = [
            [0, 1], [5, 0], [4, 5], [3, 4], [2, 3], [1, 2],
          ][idx];
          const [c1, c2] = edgeCornerIndices;
          const p1 = corners[c1];
          const p2 = corners[c2];
          borderElements.push(
            <line
              key={`border-${cell.col}-${cell.row}-${idx}`}
              x1={p1[0]}
              y1={p1[1]}
              x2={p2[0]}
              y2={p2[1]}
              stroke="rgba(200, 200, 200, 0.4)"
              strokeWidth="1.5"
              pointerEvents="none"
            />
          );
        }
      });
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="rounded-lg border border-[var(--border)] bg-[var(--bg)] p-4 shadow-2xl" style={{ maxWidth: '95vw', maxHeight: '95vh', width: '1200px' }}>
        {/* Header */}
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[24px]">{contextLabel.icon}</span>
            <div>
              <div className="font-semibold text-[var(--text)]">{contextLabel.name}</div>
              <div className="text-[11px] text-[var(--text3)]">{contextLabel.desc}</div>
              <div className="text-[11px] text-[var(--text3)]">{durationLabel}</div>
            </div>
          </div>
          <button
            className="base-btn px-3 py-1 text-[12px]"
            onClick={handleCancel}
          >
            ✕ Cancel
          </button>
        </div>

        {/* Selected Hex Display */}
        {selectedHex && (
          <div className="mb-3 rounded bg-[var(--accent2)]/10 px-3 py-2 text-[12px] text-[var(--accent2)]">
            ✓ Selected: ({selectedHex.x}, {selectedHex.y})
          </div>
        )}

        {/* Worldmap SVG */}
        <div
          className="relative mb-3 overflow-hidden rounded-lg border border-[var(--border)] bg-black/40"
          style={{ width: '100%', height: '600px' }}
          onMouseDown={handleSvgMouseDown}
          onMouseMove={handleSvgMouseMove}
          onMouseUp={handleSvgMouseUp}
          onMouseLeave={handleSvgMouseUp}
        >
          <svg
            ref={svgRef}
            width={WORLD_WIDTH}
            height={WORLD_HEIGHT}
            viewBox={`0 0 ${WORLD_WIDTH} ${WORLD_HEIGHT}`}
            preserveAspectRatio="xMidYMid meet"
            style={{
              cursor: isDragging ? 'grabbing' : 'grab',
              transform: `translate(${panX}px, ${panY}px)`,
              userSelect: 'none',
              maxWidth: '100%',
              height: 'auto',
            }}
            onClick={handleSvgClick}
          >
            {/* Terrain hexes */}
            {hexElements}
            {/* Region boundaries */}
            {borderElements}
            {/* Fog of war overlay */}
            {fogElements}
          </svg>
          {!hexGrid && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-[var(--text3)]">Loading map...</div>
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="mb-3 text-[12px] text-[var(--text3)]">
          Click a hex to select it and start the action. Drag to pan the map.
        </div>

        {/* Cancel button */}
        <button
          className="base-btn w-full"
          onClick={handleCancel}
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default HexSelectionModal;
