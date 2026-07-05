import React, { useCallback, useState, useRef, useEffect } from 'react';
import { toast } from '../../utils/toast.js';
import { pixelToHex, hexCenter, hexCorners, HEX_SIZE } from '../../utils/hexUtils.js';

const HEX_GRID_COLS = 40;
const HEX_GRID_ROWS = 40;
const WORLD_MAX_COL = 1999;
const WORLD_MAX_ROW = 1379;

const HexSelectionModal = ({ isOpen, context, onHexSelected, onClose }) => {
  const [selectedHex, setSelectedHex] = useState(null);
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

  const hexElements = [];
  for (let row = 0; row < HEX_GRID_ROWS; row++) {
    for (let col = 0; col < HEX_GRID_COLS; col++) {
      const { x: cx, y: cy } = hexCenter(col, row);
      const corners = hexCorners(cx, cy, HEX_SIZE);
      const cornerStr = corners.map(([px, py]) => `${px},${py}`).join(' ');
      const isSelected = selectedHex && selectedHex.x === col && selectedHex.y === row;

      hexElements.push(
        <polygon
          key={`hex-${col}-${row}`}
          points={cornerStr}
          fill={isSelected ? 'rgba(255, 200, 87, 0.6)' : 'rgba(255, 255, 255, 0.08)'}
          stroke={isSelected ? 'var(--gold)' : 'rgba(255, 255, 255, 0.2)'}
          strokeWidth={isSelected ? 2 : 1}
          onClick={(e) => {
            e.stopPropagation();
            handleHexClick(col, row);
          }}
          style={{ cursor: 'pointer', transition: 'fill 0.1s' }}
        />
      );

      if (col % 5 === 0 && row % 5 === 0) {
        hexElements.push(
          <text
            key={`label-${col}-${row}`}
            x={cx}
            y={cy}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="8"
            fill="rgba(255, 255, 255, 0.3)"
            pointerEvents="none"
          >
            {col},{row}
          </text>
        );
      }
    }
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

        {/* Hex Grid SVG */}
        <div
          className="relative mb-3 overflow-hidden rounded-lg border border-[var(--border)] bg-black/20"
          style={{ width: '100%', height: '600px' }}
          onMouseDown={handleSvgMouseDown}
          onMouseMove={handleSvgMouseMove}
          onMouseUp={handleSvgMouseUp}
          onMouseLeave={handleSvgMouseUp}
        >
          <svg
            ref={svgRef}
            width="100%"
            height="100%"
            style={{
              cursor: isDragging ? 'grabbing' : 'grab',
              transform: `translate(${panX}px, ${panY}px)`,
              userSelect: 'none',
            }}
            onClick={handleSvgClick}
          >
            {hexElements}
          </svg>
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
