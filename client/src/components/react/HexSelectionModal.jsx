import React, { useCallback, useState, useRef, useEffect, useMemo } from 'react';
import { toast } from '../../utils/toast.js';
import { pixelToHex, hexCenter, hexCorners, HEX_SIZE } from '../../utils/hexUtils.js';
import { buildHexGrid, TERRAIN_COLORS, seedToInt32 } from '../../utils/terrainUtils.js';

const WORLD_WIDTH = 900;
const WORLD_HEIGHT = 650;
const WORLD_MAX_COL = 1999;
const WORLD_MAX_ROW = 1379;

const HexSelectionModal = ({ isOpen, context, onHexSelected, onClose }) => {
  const [selectedHex, setSelectedHex] = useState(null);
  const [worldSeed, setWorldSeed] = useState(null);
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

  // Fetch worldSeed on mount
  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;
    const fetchWorldSeed = async () => {
      try {
        const res = await fetch('/api/world-map');
        if (res.ok) {
          const data = await res.json();
          if (mounted) {
            setWorldSeed(data.worldSeed || 0);
          }
        } else if (mounted) {
          // Fallback to seed 0 if fetch fails
          setWorldSeed(0);
        }
      } catch (err) {
        console.error('Failed to fetch world seed:', err);
        if (mounted) {
          // Fallback to seed 0 on error
          setWorldSeed(0);
        }
      }
    };

    fetchWorldSeed();
    return () => { mounted = false; };
  }, [isOpen]);

  // Build hex grid with terrain once worldSeed is available
  const hexGrid = useMemo(() => {
    if (!isOpen || worldSeed === undefined || worldSeed === null) return null;
    return buildHexGrid(WORLD_WIDTH, WORLD_HEIGHT, worldSeed);
  }, [isOpen, worldSeed]);

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

    const rect = svg.getBoundingClientRect();
    const svgX = e.clientX - rect.left - panX;
    const svgY = e.clientY - rect.top - panY;
    const { col, row } = pixelToHex(svgX, svgY);
    handleHexClick(col, row);
  };

  if (!isOpen) return null;

  // Build SVG elements from terrain grid
  const hexElements = [];
  const borderElements = [];

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
