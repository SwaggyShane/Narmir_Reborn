import React, { useState, useEffect } from 'react';
import { apiCall } from '../../utils/api';

export default function HybridBlueprintModal({ blueprintId, fragmentName, onClose, onSuccess }) {
  const [buildings, setBuildings] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stage, setStage] = useState('select'); // 'select' or 'confirm'
  const [confirming, setConfirming] = useState(false);
  const [checkboxes, setCheckboxes] = useState({
    understand: false,
    permanent: false,
  });

  useEffect(() => {
    const fetchBuildings = async () => {
      try {
        const data = await apiCall('/api/kingdom/hybrid-blueprint/get-buildings', {
          method: 'POST',
          body: { blueprintId },
        });

        if (data.error) {
          setError(data.error || 'Failed to load buildings');
          return;
        }

        setBuildings(data.availableBuildings || []);
      } catch (err) {
        setError('Network error: ' + err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchBuildings();
  }, [blueprintId]);

  const handleSelectBuilding = (building) => {
    setSelected(building);
    setStage('confirm');
    setCheckboxes({ understand: false, permanent: false });
  };

  const handleConfirm = async () => {
    if (!checkboxes.understand || !checkboxes.permanent) return;

    setConfirming(true);
    setError(null);

    try {
      const data = await apiCall('/api/kingdom/hybrid-blueprint/assign', {
        method: 'POST',
        body: {
          blueprintId,
          buildingType: selected.buildingType,
          confirmed: true,
        },
      });

      if (data.error) {
        setError(data.error);
        setConfirming(false);
        return;
      }

      if (onSuccess) onSuccess(data);
      onClose();
    } catch (err) {
      setError('Failed to apply fragment: ' + err.message);
      setConfirming(false);
    }
  };

  const handleBack = () => {
    setStage('select');
    setSelected(null);
    setCheckboxes({ understand: false, permanent: false });
  };

  // Selection stage
  if (stage === 'select') {
    return (
      <div
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        className="fixed inset-0 z-[9000] flex items-start justify-center bg-black/40 p-4 pt-20"
      >
        <div className="flex w-full max-h-[80vh] max-w-[680px] flex-col rounded-sm border-2 border-[var(--accent1)] bg-bg2 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
          <div className="flex items-center justify-between border-b border-white/5 px-4.5 py-3.5">
            <span className="text-[14px] font-bold text-text">✨ World Fragments</span>
            <button
              onClick={onClose}
              className="p-1 text-[18px] text-text3 cursor-pointer leading-none"
            >✕</button>
          </div>

          <div className="flex-1 overflow-y-auto px-4.5 py-4">
            {error && (
              <div className="mb-4 rounded-sm border border-red bg-red/10 p-3 text-[12px] text-red">
                {error}
              </div>
            )}

            {loading ? (
              <div className="p-6 text-center text-text3">Loading available buildings...</div>
            ) : buildings.length === 0 ? (
              <div className="p-6 text-center text-text3">
                <p>⚠️ All buildings already have fragments applied</p>
              </div>
            ) : (
              <div className="grid gap-2 auto-fill [grid-template-columns:repeat(auto-fill,minmax(200px,1fr))]">
                {buildings.map((building) => (
                  <div
                    key={building.buildingType}
                    onClick={(e) => { e.stopPropagation(); handleSelectBuilding(building); }}
                    className="cursor-pointer rounded-sm border border-white/5 bg-bg3 p-2.5 text-[11px] text-text transition-all hover:border-white/10 hover:bg-white/5"
                  >
                    <div className="mb-1 flex items-start justify-between gap-1.5">
                      <div>
                        <div className="font-semibold text-text">{building.name}</div>
                        <div className="mt-0.5 text-text3">Count: {building.count}</div>
                      </div>
                    </div>
                    {building.bonus && (
                      <div className="mt-1 border-t border-white/5 pt-1">
                        <div className="font-semibold text-gold">✨ {building.bonus.name}</div>
                        <div className="mt-0.5 text-[10px] text-text3">{building.bonus.desc}</div>
                        {building.bonus.passive && Object.keys(building.bonus.passive).length > 0 && (
                          <div className="mt-1 text-[10px] text-text3">
                            {Object.entries(building.bonus.passive).map(([k, v]) => v ? (
                              <div key={k}>{k.replace(/_/g, ' ')}: <span className="text-text">+{v}</span></div>
                            ) : null)}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Confirmation stage
  if (stage === 'confirm' && selected) {
    return (
      <div
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        className="fixed inset-0 z-[9000] flex items-start justify-center bg-black/40 p-4 pt-20"
      >
        <div className="flex w-full max-h-[80vh] max-w-[680px] flex-col rounded-sm border-2 border-[var(--accent1)] bg-bg2 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
          <div className="flex items-center justify-between border-b border-white/5 px-4.5 py-3.5">
            <span className="text-[14px] font-bold text-text">⚠️ Confirm Fragment Application</span>
            <button
              onClick={onClose}
              className="p-1 text-[18px] text-text3 cursor-pointer leading-none"
            >✕</button>
          </div>

          <div className="flex-1 overflow-y-auto px-4.5 py-4">
            {error && (
              <div className="mb-4 rounded-sm border border-red bg-red/10 p-3 text-[12px] text-red">
                {error}
              </div>
            )}

            <div className="mb-4 rounded-sm border border-red bg-red/10 p-3">
              <div className="text-[12px] text-text3">
                <p className="m-0 mb-2">You are about to attune:</p>
                <p className="m-0 mb-1 text-center font-bold text-text">{selected.name}</p>
                <p className="m-0 text-center text-text3">Have: {selected.count}</p>
              </div>
            </div>

            <div className="mb-4 rounded-sm border border-gold/30 bg-gold/5 p-3">
              <div className="mb-2 text-[12px] font-semibold text-gold uppercase tracking-wider">✨ Fragment Bonus</div>
              <div className="text-[11px] text-text">
                <div className="font-semibold text-gold">{selected.bonus?.name}</div>
                <p className="m-0 mt-1 text-text3">{selected.bonus?.desc}</p>
                {selected.bonus?.passive && Object.keys(selected.bonus.passive).length > 0 && (
                  <div className="mt-2 border-t border-white/5 pt-2">
                    <div className="text-[10px] font-semibold text-gold mb-1">Passive Bonuses:</div>
                    <div className="text-text3">
                      {Object.entries(selected.bonus.passive).map(([k, v]) => v ? (
                        <div key={k}>{k.replace(/_/g, ' ')}: <span className="text-text">+{v}</span></div>
                      ) : null)}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="mb-4 rounded-sm border border-white/10 bg-white/[0.03] p-3">
              <div className="mb-2 text-[12px] font-semibold text-text uppercase tracking-wider">Costs</div>
              <div className="text-[11px] text-text3">
                <p className="m-0">💰 Cost: <span className="font-bold text-gold">500,000 Gold</span></p>
                <p className="m-0 mt-1">✨ Cost: <span className="font-bold text-blue">100,000 Mana</span></p>
              </div>
            </div>

            <div className="rounded-sm border border-red bg-red/10 p-3">
              <div className="mb-2 text-[12px] font-semibold text-red uppercase tracking-wider">⛔ WARNING</div>
              <div className="text-[11px] text-text3">
                <p className="m-0 mb-2">This choice is <span className="font-bold text-text">PERMANENT</span> and <span className="font-bold text-text">CANNOT BE UNDONE</span></p>
                <p className="m-0">Once applied, this fragment cannot be moved or removed from this building.</p>
              </div>

              <div className="mt-3 space-y-2 border-t border-red/30 pt-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checkboxes.understand}
                    onChange={(e) => setCheckboxes(prev => ({ ...prev, understand: e.target.checked }))}
                    className="cursor-pointer"
                  />
                  <span className="text-[11px] text-text3">I understand this cannot be undone</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checkboxes.permanent}
                    onChange={(e) => setCheckboxes(prev => ({ ...prev, permanent: e.target.checked }))}
                    className="cursor-pointer"
                  />
                  <span className="text-[11px] text-text3">I confirm this is permanent</span>
                </label>
              </div>
            </div>
          </div>

          <div className="flex gap-2 border-t border-white/5 px-4.5 py-3.5">
            <button
              onClick={handleBack}
              className="flex-1 rounded-sm border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-text transition-all hover:bg-white/10"
            >
              Back
            </button>
            <button
              onClick={handleConfirm}
              disabled={!checkboxes.understand || !checkboxes.permanent || confirming}
              className="flex-1 rounded-sm border border-green bg-green/20 px-3 py-1.5 text-[11px] font-semibold text-green transition-all hover:bg-green/30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {confirming ? 'Applying...' : 'Apply Fragment'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
