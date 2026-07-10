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
      <div className="fixed inset-0 bg-black/80 z-modal backdrop-blur-sm flex items-center justify-center p-5" onClick={onClose}>
        <div className="rounded-xl border-2 border-[var(--accent1)] bg-gradient-to-br from-zinc-900 to-white/5 max-w-[900px] w-full max-h-[90vh] shadow-2xl flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
          <div className="p-8 border-b border-white/10 bg-gradient-to-br from-orange-500/5 to-transparent">
            <div className="flex items-center gap-4 mb-3">
              <span className="text-5xl leading-none">✨</span>
              <h2 className="text-2xl font-bold m-0 text-white">World Fragments</h2>
            </div>
            <p className="text-zinc-300 text-sm m-0 mt-2 italic">Select a building to attune with discovered fragments</p>
          </div>

          {error && <div className="bg-red/10 border-b border-red text-red px-8 py-3 text-xs m-0">{error}</div>}

          <div className="flex-1 overflow-y-auto p-8">
            {loading ? (
              <div className="text-center text-zinc-400 py-12">Loading available buildings...</div>
            ) : buildings.length === 0 ? (
              <div className="text-center text-zinc-400 py-12">
                <p>⚠️ All buildings already have fragments applied</p>
              </div>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-4">
                {buildings.map((building) => (
                  <div
                    key={building.buildingType}
                    onClick={() => handleSelectBuilding(building)}
                    className="bg-white/[0.03] border border-white/10 rounded-lg p-5 cursor-pointer transition-all hover:bg-white/5 hover:border-white/20 hover:shadow-lg hover:-translate-y-1"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="m-0 text-base font-semibold text-white">{building.name}</h3>
                      <span className="bg-white/10 rounded px-2 py-1 text-xs font-semibold text-zinc-300">
                        {building.count}
                      </span>
                    </div>

                    <div className="mb-3">
                      <p className="text-sm font-semibold text-orange-400 m-0 mb-1">✨ {building.bonus?.name}</p>
                      <p className="text-xs text-zinc-400 m-0 leading-relaxed">{building.bonus?.desc}</p>
                    </div>

                    {building.bonus?.passive && Object.keys(building.bonus.passive).length > 0 && (
                      <div className="text-xs text-zinc-500 space-y-1">
                        {Object.entries(building.bonus.passive).map(([key, value]) => (
                          <div key={key} className="flex justify-between">
                            <span>{key.replace(/_/g, ' ')}:</span>
                            <span className={value > 0 ? 'text-green' : 'text-red'}>
                              {value > 0 ? '+' : ''}{Math.round(value * 100)}%
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-4 border-t border-white/10 bg-white/[0.02] flex justify-end gap-3">
            <button
              className="bg-transparent border border-zinc-600 text-zinc-400 px-5 py-2 rounded text-sm font-medium cursor-pointer transition-all hover:border-zinc-400 hover:text-white"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Confirmation stage
  if (stage === 'confirm' && selected) {
    return (
      <div className="fixed inset-0 bg-black/80 z-modal backdrop-blur-sm flex items-center justify-center p-5" onClick={onClose}>
        <div className="rounded-xl border-2 border-[var(--accent1)] bg-gradient-to-br from-zinc-900 to-white/5 max-w-[700px] w-full max-h-[90vh] shadow-2xl flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
          <div className="p-8 border-b border-white/10 bg-gradient-to-br from-red-500/5 to-transparent">
            <h2 className="text-2xl font-bold m-0 text-white">⚠️ Confirm Fragment Application</h2>
            <p className="text-zinc-300 text-sm m-0 mt-2">This action is permanent and cannot be undone</p>
          </div>

          <div className="flex-1 overflow-y-auto p-8 space-y-6">
            <div className="bg-red/10 border border-red/30 rounded-lg p-5">
              <p className="text-sm text-zinc-300 m-0">
                You are about to attune <span className="font-bold text-orange-400">{selected.name}</span> (have: <span className="font-bold text-white">{selected.count}</span>) with a discovered fragment.
              </p>
            </div>

            <div className="bg-white/[0.03] border border-white/10 rounded-lg p-5">
              <h3 className="m-0 mb-3 text-sm font-semibold uppercase tracking-wider text-orange-400">Fragment Bonus</h3>
              <h4 className="m-0 text-base font-semibold text-white mb-2">✨ {selected.bonus?.name}</h4>
              <p className="text-zinc-300 text-sm m-0 leading-relaxed mb-4">{selected.bonus?.desc}</p>

              {selected.bonus?.passive && Object.keys(selected.bonus.passive).length > 0 && (
                <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-2">
                  {Object.entries(selected.bonus.passive).map(([key, value]) => (
                    <div key={key} className={`flex flex-col items-center p-3 bg-white/5 rounded border-l-4 text-center ${value >= 0 ? 'border-green' : 'border-red'}`}>
                      <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-1">
                        {key.replace(/_/g, ' ')}
                      </span>
                      <span className={`text-base font-bold ${value >= 0 ? 'text-green' : 'text-red'}`}>
                        {value > 0 ? '+' : ''}{Math.round(value * 100)}%
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-5">
              <h4 className="m-0 mb-3 text-sm font-semibold uppercase tracking-wider text-orange-400">Costs & Requirements</h4>
              <div className="space-y-1 text-sm">
                <p className="text-zinc-300 m-0">💰 Cost: <span className="font-bold text-yellow-400">500,000 Gold</span></p>
                <p className="text-zinc-300 m-0">✨ Cost: <span className="font-bold text-blue-400">100,000 Mana</span></p>
              </div>
            </div>

            <div className="bg-red/10 border border-red/30 rounded-lg p-5 space-y-3">
              <h4 className="m-0 text-sm font-semibold uppercase tracking-wider text-red">⛔ Critical Warning</h4>
              <p className="text-sm text-zinc-300 m-0">
                <span className="font-bold text-white">This choice is PERMANENT</span> and cannot be undone. Once applied to this building, the fragment cannot be moved or removed.
              </p>

              <label className="flex items-center gap-2 cursor-pointer mt-4">
                <input
                  type="checkbox"
                  checked={checkboxes.understand}
                  onChange={(e) => setCheckboxes(prev => ({ ...prev, understand: e.target.checked }))}
                  className="w-4 h-4"
                />
                <span className="text-sm text-zinc-300">I understand this cannot be undone</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={checkboxes.permanent}
                  onChange={(e) => setCheckboxes(prev => ({ ...prev, permanent: e.target.checked }))}
                  className="w-4 h-4"
                />
                <span className="text-sm text-zinc-300">I confirm this is permanent</span>
              </label>
            </div>

            {error && <div className="bg-red/10 border border-red text-red px-4 py-3 text-xs rounded">{error}</div>}
          </div>

          <div className="p-4 border-t border-white/10 bg-white/[0.02] flex justify-end gap-3">
            <button
              className="bg-transparent border border-zinc-600 text-zinc-400 px-5 py-2 rounded text-sm font-medium cursor-pointer transition-all hover:border-zinc-400 hover:text-white"
              onClick={handleBack}
            >
              Back
            </button>
            <button
              className="bg-gradient-to-r from-green-600 to-green-700 text-white border-0 rounded px-6 py-2 text-sm font-semibold cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-green-600/40 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleConfirm}
              disabled={!checkboxes.understand || !checkboxes.permanent || confirming}
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
