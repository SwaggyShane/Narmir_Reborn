import React, { useState, useEffect } from 'react';
import { apiCall } from '../../utils/api';
import './SynergyDetailsModal.css';

export default function SynergyDetailsModal({ synergy, kingdom, onClose, onAbilityActivated }) {
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState(null);
  const [cooldownInfo, setCooldownInfo] = useState(null);

  useEffect(() => {
    // Check cooldown status for this synergy
    checkCooldownStatus();
  }, [synergy]);

  const checkCooldownStatus = async () => {
    if (!synergy || !synergy.id) return;

    try {
      const data = await apiCall('/api/kingdom/synergy-cooldown?synergy_id=' + encodeURIComponent(synergy.id), {
        method: 'GET',
      });

      if (!data.error) {
        setCooldownInfo(data);
      }
    } catch (err) {
      console.error('[SynergyDetailsModal cooldown check]:', err);
    }
  };

  const handleActivateAbility = async () => {
    if (activating || !synergy) return;

    setActivating(true);
    setError(null);

    try {
      const data = await apiCall('/api/kingdom/activate-synergy-ability', {
        method: 'POST',
        body: { synergy_id: synergy.id },
      });

      if (data.error) {
        setError(data.error);
        setActivating(false);
        return;
      }

      if (data.ok) {
        if (onAbilityActivated) {
          onAbilityActivated(data);
        }
        onClose();
      }
    } catch (err) {
      console.error('[SynergyDetailsModal activate]:', err);
      setError('Failed to activate ability: ' + err.message);
      setActivating(false);
    }
  };

  if (!synergy) return null;

  const isOnCooldown = cooldownInfo?.on_cooldown || false;
  const cooldownRemaining = cooldownInfo?.cooldown_remaining_seconds || 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content synergy-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="synergy-header-top">
            <span className="synergy-emoji-large">{synergy.emoji}</span>
            <h2 className="synergy-name">{synergy.name}</h2>
          </div>
          <p className="synergy-description">{synergy.description}</p>
        </div>

        {error && <div className="error-message">{error}</div>}

        <div className="synergy-details-content">
          {/* Passive Ability */}
          <div className="ability-section passive">
            <h3>✦ Passive Ability (Always Active)</h3>
            <div className="ability-box">
              <h4>{synergy.passive?.name}</h4>
              <p className="ability-description">{synergy.passive?.desc}</p>

              {synergy.passive?.effects && (
                <div className="effects-grid">
                  {Object.entries(synergy.passive.effects).map(([key, value]) => (
                    <div key={key} className={`effect-item ${value >= 0 ? 'positive' : 'negative'}`}>
                      <span className="effect-label">{formatKey(key)}</span>
                      <span className="effect-value">
                        {formatValue(value, key)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Active Ability */}
          <div className="ability-section active">
            <h3>⚡ Active Ability (Player Triggered)</h3>
            <div className="ability-box">
              <h4>{synergy.active?.name}</h4>
              <p className="ability-description">{synergy.active?.desc}</p>

              <div className="ability-meta">
                <div className="meta-item">
                  <span className="meta-label">Cooldown:</span>
                  <span className="meta-value">{synergy.active?.cooldown_days} day{synergy.active?.cooldown_days !== 1 ? 's' : ''}</span>
                </div>

                {synergy.active?.cost && (
                  <div className="meta-item">
                    <span className="meta-label">Cost:</span>
                    <span className="meta-value">{formatCost(synergy.active.cost)}</span>
                  </div>
                )}

                {synergy.active?.penalty && (
                  <div className="meta-item">
                    <span className="meta-label">Penalty:</span>
                    <span className="meta-value">{formatPenalty(synergy.active.penalty)} for {synergy.active?.penalty_duration_days}d</span>
                  </div>
                )}
              </div>

              {synergy.active?.benefit && (
                <div className="benefit-box">
                  <p className="benefit-label">Benefits:</p>
                  <div className="effects-grid">
                    {Object.entries(synergy.active.benefit).map(([key, value]) => (
                      <div key={key} className="effect-item positive">
                        <span className="effect-label">{formatKey(key)}</span>
                        <span className="effect-value">{formatValue(value, key)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Activation Button */}
          <div className="activation-controls">
            {isOnCooldown ? (
              <div className="cooldown-info">
                <p>Ability on cooldown</p>
                <p className="cooldown-time">{formatCooldownTime(cooldownRemaining)}</p>
              </div>
            ) : (
              <button
                className="activate-ability-btn"
                onClick={handleActivateAbility}
                disabled={activating}
              >
                {activating ? 'Activating...' : 'Activate Ability'}
              </button>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button className="close-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

function formatKey(key) {
  return key
    .replace(/_/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function formatValue(value, key) {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') {
    const isAbsolute = key === 'happiness' || key === 'stability';
    if (isAbsolute) {
      return value > 0 ? '+' + value : String(value);
    }
    if (value >= 1) return '+' + Math.round(value * 100) + '%';
    if (value > 0) return '+' + Math.round(value * 100) + '%';
    if (value < 0) return Math.round(value * 100) + '%';
    return '0%';
  }
  return String(value);
}

function formatCost(cost) {
  if (typeof cost === 'object') {
    return Object.entries(cost)
      .map(([key, val]) => {
        const formattedKey = formatKey(key);
        return typeof val === 'number' && val > 0 && val < 1 ? `${formattedKey} ${Math.round(val * 100)}%` : `${formattedKey} ${val}`;
      })
      .join(', ');
  }
  return String(cost);
}

function formatPenalty(penalty) {
  if (typeof penalty === 'object') {
    return Object.entries(penalty)
      .map(([key, val]) => {
        const formattedKey = formatKey(key);
        return typeof val === 'number' && val < 1 ? `${formattedKey} ${Math.round(val * 100)}%` : `${formattedKey} ${val}`;
      })
      .join(', ');
  }
  return String(penalty);
}

function formatCooldownTime(seconds) {
  if (seconds <= 0) return 'Ready';
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.ceil(seconds / 60)}m`;
  return `${Math.ceil(seconds / 3600)}h`;
}
