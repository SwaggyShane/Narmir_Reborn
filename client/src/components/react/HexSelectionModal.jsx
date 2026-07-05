import React, { useCallback, useState } from 'react';
import { toast } from '../../utils/toast.js';

const HexSelectionModal = ({ isOpen, context, onHexSelected, onClose }) => {
  const [selectedHex, setSelectedHex] = useState(null);

  const contextLabels = {
    hunting: { icon: '🦌', name: 'Hunting Expedition' },
    prospecting: { icon: '⛏️', name: 'Prospecting Expedition' },
    land_expansion: { icon: '🗺️', name: 'Land Expansion' },
    epic_trek: { icon: '🛤️', name: 'Epic Trek' },
  };

  const contextLabel = contextLabels[context?.type] || { icon: '🗺️', name: 'Target Selection' };
  const durationLabel = context?.duration ? `${context.duration} turns` : 'Target Selection';

  const handleConfirm = useCallback(() => {
    const x = selectedHex?.x;
    const y = selectedHex?.y;
    if (x === undefined || y === undefined || x === '' || y === '') {
      if (typeof window !== 'undefined' && typeof toast === 'function') {
        toast('Please enter both X and Y coordinates', 'warn');
      }
      return;
    }
    onHexSelected({ x: parseInt(x, 10), y: parseInt(y, 10) });
    setSelectedHex(null);
  }, [selectedHex, onHexSelected]);

  const handleCancel = useCallback(() => {
    setSelectedHex(null);
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="rounded-lg border border-[var(--border)] bg-[var(--bg)] p-4 shadow-2xl" style={{ maxWidth: '90vw', maxHeight: '90vh', width: '1000px' }}>
        {/* Header */}
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[24px]">{contextLabel.icon}</span>
            <div>
              <div className="font-semibold text-[var(--text)]">{contextLabel.name}</div>
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

        {/* Map container placeholder */}
        <div className="mb-3 rounded-md border border-[var(--border)] bg-[rgba(255,255,255,0.02)] p-4">
          <div className="aspect-video flex flex-col items-center justify-center rounded bg-[rgba(0,0,0,0.3)]">
            <div className="text-center">
              <div className="text-[14px] font-semibold text-[var(--text)]">Worldmap</div>
              <div className="mt-2 text-[12px] text-[var(--text3)]">
                Click a hex to select target, or enter coordinates below
              </div>
              {selectedHex && (
                <div className="mt-3 rounded bg-[var(--accent2)]/10 px-2 py-1 text-[12px] text-[var(--accent2)]">
                  Selected: ({selectedHex.x}, {selectedHex.y})
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Coordinate input */}
        <div className="mb-4 grid grid-cols-3 gap-2">
          <div>
            <label className="block text-[11px] text-[var(--text3)] mb-1">Target X</label>
            <input
              type="number"
              className="input w-full"
              value={selectedHex?.x ?? ''}
              onChange={(e) => setSelectedHex(prev => ({ ...prev, x: e.target.value === '' ? '' : parseInt(e.target.value, 10) || 0 }))}
              placeholder="0-1999"
              min="0"
              max="1999"
            />
          </div>
          <div>
            <label className="block text-[11px] text-[var(--text3)] mb-1">Target Y</label>
            <input
              type="number"
              className="input w-full"
              value={selectedHex?.y ?? ''}
              onChange={(e) => setSelectedHex(prev => ({ ...prev, y: e.target.value === '' ? '' : parseInt(e.target.value, 10) || 0 }))}
              placeholder="0-1379"
              min="0"
              max="1379"
            />
          </div>
          <div className="flex items-end">
            <button
              className="base-btn w-full"
              onClick={() => setSelectedHex(null)}
            >
              Clear
            </button>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <button
            className="base-btn flex-1 variant-accent"
            onClick={handleConfirm}
            disabled={!selectedHex || selectedHex.x === undefined || selectedHex.x === '' || selectedHex.y === undefined || selectedHex.y === ''}
          >
            Confirm Target
          </button>
          <button
            className="base-btn flex-1"
            onClick={handleCancel}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default HexSelectionModal;
