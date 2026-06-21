import React, { useState, useEffect } from 'react';
import { apiCall } from '../../utils/api';

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
    <div className="fixed inset-0 bg-black/80 z-[2000] backdrop-blur-sm flex items-center justify-center p-5" onClick={onClose}>
      <div className="rounded-xl border border-white/10 bg-gradient-to-br from-zinc-900 to-white/5 max-w-[800px] w-full max-h-[90vh] shadow-2xl flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="p-8 border-b border-white/10 bg-gradient-to-br from-orange-500/5 to-transparent">
          <div className="flex items-center gap-4 mb-3">
            <span className="text-6xl leading-none">{synergy.emoji}</span>
            <h2 className="text-2xl font-bold m-0 text-white">{synergy.name}</h2>
          </div>
          <p className="text-zinc-300 text-sm m-0 mt-2 italic">{synergy.description}</p>
        </div>

        {error && <div className="bg-red-500/10 border-b border-red-500 text-red-500 px-8 py-3 text-xs m-0">{error}</div>}

        <div className="flex-1 overflow-y-auto p-8 flex flex-col gap-6">
          {/* Passive Ability */}
          <div className="bg-white/3 border border-white/10 rounded-lg p-5">
            <h3 className="m-0 mb-4 text-sm font-semibold uppercase tracking-wider text-green-500">✦ Passive Ability (Always Active)</h3>
            <div className="flex flex-col gap-3">
              <h4 className="m-0 text-base font-semibold text-white">{synergy.passive?.name}</h4>
              <p className="text-zinc-300 text-sm m-0 leading-relaxed">{synergy.passive?.desc}</p>

              {synergy.passive?.effects && (
                <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-2 mt-3">
                  {Object.entries(synergy.passive.effects).map(([key, value]) => (
                    <div key={key} className={`flex flex-col items-center p-3 bg-white/5 rounded border-l-4 text-center ${value >= 0 ? 'border-green-500' : 'border-red-500'}`}>
                      <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-1">{formatKey(key)}</span>
                      <span className={`text-base font-bold ${value >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {formatValue(value, key)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Active Ability */}
          <div className="bg-white/3 border border-white/10 rounded-lg p-5">
            <h3 className="m-0 mb-4 text-sm font-semibold uppercase tracking-wider text-orange-500">⚡ Active Ability (Player Triggered)</h3>
            <div className="flex flex-col gap-3">
              <h4 className="m-0 text-base font-semibold text-white">{synergy.active?.name}</h4>
              <p className="text-zinc-300 text-sm m-0 leading-relaxed">{synergy.active?.desc}</p>

              <div className="bg-white/2 border border-white/5 rounded p-3 flex flex-col gap-2">
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-400 font-medium">Cooldown:</span>
                  <span className="text-white font-semibold">{synergy.active?.cooldown_days} day{synergy.active?.cooldown_days !== 1 ? 's' : ''}</span>
                </div>

                {synergy.active?.cost && (
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-400 font-medium">Cost:</span>
                    <span className="text-white font-semibold">{formatCost(synergy.active.cost)}</span>
                  </div>
                )}

                {synergy.active?.penalty && (
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-400 font-medium">Penalty:</span>
                    <span className="text-white font-semibold">{formatPenalty(synergy.active.penalty)} for {synergy.active?.penalty_duration_days}d</span>
                  </div>
                )}
              </div>

              {synergy.active?.benefit && (
                <div className="bg-green-500/8 border border-green-500/20 rounded p-3">
                  <p className="m-0 mb-2 text-xs font-semibold text-green-500 uppercase tracking-wider">Benefits:</p>
                  <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-2">
                    {Object.entries(synergy.active.benefit).map(([key, value]) => (
                      <div key={key} className="flex flex-col items-center p-3 bg-white/5 rounded border-l-4 border-green-500 text-center">
                        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-1">{formatKey(key)}</span>
                        <span className="text-base font-bold text-green-500">{formatValue(value, key)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Activation Button */}
          <div className="mt-2">
            {isOnCooldown ? (
              <div className="text-center p-4 bg-orange-500/10 border border-orange-500/30 rounded text-orange-500">
                <p className="m-0 text-sm font-semibold">Ability on cooldown</p>
                <p className="m-0 mt-1 text-lg font-bold">{formatCooldownTime(cooldownRemaining)}</p>
              </div>
            ) : (
              <button
                className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white border-0 rounded p-3 text-sm font-semibold cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-orange-500/40 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleActivateAbility}
                disabled={activating}
              >
                {activating ? 'Activating...' : 'Activate Ability'}
              </button>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-white/10 bg-white/2 flex justify-end gap-3">
          <button className="bg-transparent border border-zinc-600 text-zinc-400 px-5 py-2 rounded text-sm font-medium cursor-pointer transition-all hover:border-zinc-400 hover:text-white" onClick={onClose}>Close</button>
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
