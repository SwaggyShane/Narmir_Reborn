import React, { useState, useEffect } from 'react';
import { apiCall } from '../../utils/api';
import SynergyDetailsModal from './SynergyDetailsModal';
import './SynergyStatusPanel.css';

export default function SynergyStatusPanel({ kingdom, onUpdate }) {
  const [synergyStatus, setSynergyStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSynergy, setSelectedSynergy] = useState(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    fetchSynergyStatus();
  }, [kingdom]);

  const fetchSynergyStatus = async () => {
    if (!kingdom) return;
    setLoading(true);
    setError(null);

    try {
      const data = await apiCall('/api/kingdom/synergy-status', {
        method: 'GET',
      });

      if (data.error) {
        setError(data.error);
        setSynergyStatus(null);
      } else {
        setSynergyStatus(data);
      }
    } catch (err) {
      console.error('[SynergyStatusPanel]:', err);
      setError('Failed to load synergy status');
    } finally {
      setLoading(false);
    }
  };

  const handleSynergyClick = (synergy) => {
    setSelectedSynergy(synergy);
    setShowModal(true);
  };

  const handleAbilityActivated = (result) => {
    if (window.toast) {
      window.toast('Synergy ability activated!', 'success');
    }
    setShowModal(false);
    if (onUpdate) onUpdate();
    fetchSynergyStatus();
  };

  if (loading) {
    return <div className="synergy-panel loading">Loading synergy status...</div>;
  }

  if (error) {
    return <div className="synergy-panel error">{error}</div>;
  }

  const { activeSynergy, nearActivation } = synergyStatus || {};

  return (
    <>
      <div className="synergy-panel">
        {activeSynergy ? (
          <div className="active-synergy-container">
            <div className="active-synergy-header">
              <span className="synergy-emoji">{activeSynergy.emoji}</span>
              <h2 className="synergy-name">{activeSynergy.name}</h2>
              <span className="active-badge">ACTIVE</span>
            </div>

            <p className="synergy-description">{activeSynergy.description}</p>

            <div className="passive-section">
              <h3>✦ Passive Ability</h3>
              <div className="ability-details">
                <p className="ability-name">{activeSynergy.passive?.name}</p>
                <p className="ability-desc">{activeSynergy.passive?.desc}</p>
                {activeSynergy.passive?.effects && (
                  <div className="effects-list">
                    {Object.entries(activeSynergy.passive.effects).map(([key, value]) => (
                      <div key={key} className={`effect ${value >= 0 ? 'positive' : 'negative'}`}>
                        <span className="effect-key">{formatEffectKey(key)}:</span>
                        <span className="effect-value">
                          {formatEffectValue(value, key)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="active-section">
              <h3>⚡ Active Ability</h3>
              <div className="ability-details">
                <p className="ability-name">{activeSynergy.active?.name}</p>
                <p className="ability-desc">{activeSynergy.active?.desc}</p>
                <div className="ability-meta">
                  <span className="cooldown">Cooldown: {activeSynergy.active?.cooldown_days}d</span>
                </div>
              </div>
              <button
                className="trigger-ability-btn"
                onClick={() => handleSynergyClick(activeSynergy)}
              >
                View & Activate Ability
              </button>
            </div>

            {activeSynergy.activeEffects && (Object.keys(activeSynergy.activeEffects.benefits || {}).length > 0 || Object.keys(activeSynergy.activeEffects.penalties || {}).length > 0) && (
              <div className="active-effects-section">
                <h3>🔥 Active Effects</h3>
                <div className="effects-display">
                  {activeSynergy.activeEffects.benefits && Object.keys(activeSynergy.activeEffects.benefits).length > 0 && (
                    <div className="benefit-effects">
                      <p className="effects-label">Bonuses:</p>
                      {Object.entries(activeSynergy.activeEffects.benefits).map(([key, value]) => (
                        <div key={key} className="effect-row positive">
                          <span className="effect-name">{formatEffectKey(key)}</span>
                          <span className="effect-info">
                            {formatEffectValue(value?.value, key)}
                            <span className="effect-duration"> ({value?.remainingTurns}t remaining)</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  {activeSynergy.activeEffects.penalties && Object.keys(activeSynergy.activeEffects.penalties).length > 0 && (
                    <div className="penalty-effects">
                      <p className="effects-label">Penalties:</p>
                      {Object.entries(activeSynergy.activeEffects.penalties).map(([key, value]) => (
                        <div key={key} className="effect-row negative">
                          <span className="effect-name">{formatEffectKey(key)}</span>
                          <span className="effect-info">
                            {formatEffectValue(value?.value, key)}
                            <span className="effect-duration"> ({value?.remainingTurns}t remaining)</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="no-synergy">
            <p>No synergy currently active</p>
            <p className="hint">Place all 10 world fragments on different buildings to activate a synergy</p>
          </div>
        )}

        {nearActivation && nearActivation.length > 0 && (
          <div className="near-activation-section">
            <h3>📍 Nearly Activated</h3>
            <div className="near-activation-list">
              {nearActivation.map((item) => (
                <div key={item.id} className="near-item">
                  <span className="near-emoji">{item.emoji}</span>
                  <div className="near-details">
                    <p className="near-name">{item.name}</p>
                    <p className="near-missing">
                      Missing {item.missingFragments} fragment{item.missingFragments !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <button
                    className="view-btn"
                    onClick={() => handleSynergyClick(item)}
                  >
                    View
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {showModal && selectedSynergy && (
        <SynergyDetailsModal
          synergy={selectedSynergy}
          kingdom={kingdom}
          onClose={() => {
            setShowModal(false);
            setSelectedSynergy(null);
          }}
          onAbilityActivated={handleAbilityActivated}
        />
      )}
    </>
  );
}

function formatEffectKey(key) {
  return key
    .replace(/_/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function formatEffectValue(value, key) {
  if (typeof value === 'number') {
    const isAbsolute = key === 'happiness' || key === 'stability';
    if (isAbsolute) {
      return value > 0 ? '+' + value : String(value);
    }
    if (value >= 1) return '+' + Math.round(value * 100) + '%';
    if (value > 0) return '+' + Math.round(value * 100) + '%';
    return Math.round(value * 100) + '%';
  }
  return String(value);
}
