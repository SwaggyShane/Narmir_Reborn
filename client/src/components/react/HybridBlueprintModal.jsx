import React, { useState, useEffect } from 'react';
import './HybridBlueprintModal.css';

/**
 * HybridBlueprintModal
 * Displays available buildings for fragment bonus application with double confirmation
 */
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

  // Fetch available buildings
  useEffect(() => {
    const fetchBuildings = async () => {
      try {
        const res = await fetch('/api/kingdom/hybrid-blueprint/get-buildings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ blueprintId }),
        });

        if (!res.ok) {
          const data = await res.json();
          setError(data.error || 'Failed to load buildings');
          return;
        }

        const data = await res.json();
        setBuildings(data.availableBuildings);
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

  const handleConfirmAssignment = async () => {
    if (!checkboxes.understand || !checkboxes.permanent) {
      setError('You must acknowledge both warnings');
      return;
    }

    setConfirming(true);

    try {
      const res = await fetch('/api/kingdom/hybrid-blueprint/confirm-assignment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blueprintId,
          buildingType: selected.buildingType,
          confirmed: true,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to apply bonus');
        setConfirming(false);
        return;
      }

      const data = await res.json();
      if (data.ok && onSuccess) {
        onSuccess(data);
      }
    } catch (err) {
      setError('Network error: ' + err.message);
      setConfirming(false);
    }
  };

  const handleBack = () => {
    setStage('select');
    setSelected(null);
    setError(null);
  };

  // Selection stage
  if (stage === 'select') {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content hybrid-modal" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h2>⚡ Select Building for {fragmentName}</h2>
            <button className="modal-close" onClick={onClose}>✕</button>
          </div>

          {error && <div className="error-message">{error}</div>}

          {loading ? (
            <div className="loading">Loading buildings...</div>
          ) : buildings.length === 0 ? (
            <div className="no-buildings">
              <p>⚠️ All buildings already have fragments applied</p>
            </div>
          ) : (
            <div className="buildings-grid">
              {buildings.map(building => (
                <BuildingCard
                  key={building.buildingType}
                  building={building}
                  onSelect={handleSelectBuilding}
                />
              ))}
            </div>
          )}

          <div className="modal-footer">
            <button className="btn-cancel" onClick={onClose}>Cancel</button>
          </div>
        </div>
      </div>
    );
  }

  // Confirmation stage
  if (stage === 'confirm' && selected) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content confirmation-modal" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h2>⚠️ CONFIRM IRREVERSIBLE CHOICE</h2>
            <button className="modal-close" onClick={handleBack}>✕</button>
          </div>

          <div className="confirmation-content">
            <div className="warning-box">
              <h3>You are about to apply:</h3>
              <p className="bold">{fragmentName}</p>
              <p className="text-center">to</p>
              <p className="bold">{selected.name} (have: {selected.count})</p>
            </div>

            <div className="bonus-details">
              <h4>✨ {selected.bonus.name}</h4>
              <p className="bonus-desc">{selected.bonus.desc}</p>

              {Object.keys(selected.bonus.passive).length > 0 && (
                <div className="passive-bonuses">
                  <h5>Passive Bonuses:</h5>
                  <ul>
                    {Object.entries(selected.bonus.passive).map(([key, value]) => (
                      <li key={key}>
                        <span className="stat-name">{formatStat(key)}:</span>
                        <span className={`stat-value ${value > 0 ? 'positive' : 'negative'}`}>
                          {value > 0 ? '+' : ''}{(value * 100).toFixed(0)}%
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="cost-box">
              <p>💰 Cost: <strong>500,000 Gold</strong></p>
              <p>✨ Cost: <strong>100,000 Mana</strong></p>
            </div>

            <div className="danger-zone">
              <h4>⛔ WARNING ⛔</h4>
              <p>This choice is <strong>PERMANENT</strong> and <strong>CANNOT BE UNDONE</strong></p>
              <p>Once applied, this fragment cannot be moved or removed from this building.</p>
            </div>

            {error && <div className="error-message">{error}</div>}

            <div className="checkboxes">
              <label>
                <input
                  type="checkbox"
                  checked={checkboxes.understand}
                  onChange={e => setCheckboxes({ ...checkboxes, understand: e.target.checked })}
                />
                <span>I understand this choice is permanent</span>
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={checkboxes.permanent}
                  onChange={e => setCheckboxes({ ...checkboxes, permanent: e.target.checked })}
                />
                <span>I confirm I want to apply this fragment</span>
              </label>
            </div>
          </div>

          <div className="modal-footer">
            <button
              className="btn-cancel"
              onClick={handleBack}
              disabled={confirming}
            >
              Back
            </button>
            <button
              className="btn-danger"
              onClick={handleConfirmAssignment}
              disabled={!checkboxes.understand || !checkboxes.permanent || confirming}
            >
              {confirming ? 'Applying...' : 'APPLY FRAGMENT'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

/**
 * Building Card Component
 */
function BuildingCard({ building, onSelect }) {
  return (
    <div className="building-card" onClick={() => onSelect(building)}>
      <div className="card-header">
        <h3>{building.name}</h3>
        <span className="building-count">×{building.count}</span>
      </div>

      <div className="card-body">
        <div className="bonus-name">✨ {building.bonus.name}</div>
        <p className="bonus-desc">{building.bonus.desc}</p>

        {Object.keys(building.bonus.passive).length > 0 && (
          <div className="passive-preview">
            {Object.entries(building.bonus.passive).slice(0, 2).map(([key, value]) => (
              <span key={key} className="bonus-chip">
                {formatStat(key)}: {value > 0 ? '+' : ''}{(value * 100).toFixed(0)}%
              </span>
            ))}
            {Object.keys(building.bonus.passive).length > 2 && (
              <span className="bonus-chip">+{Object.keys(building.bonus.passive).length - 2} more</span>
            )}
          </div>
        )}
      </div>

      <div className="card-footer">
        <button className="btn-select">Select Building →</button>
      </div>
    </div>
  );
}

/**
 * Format stat names for display
 */
function formatStat(stat) {
  return stat
    .replace(/_/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
