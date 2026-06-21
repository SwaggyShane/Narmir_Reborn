import React, { useState, useEffect } from 'react';
import HappinessGraph from './HappinessGraph';

const DEFAULT_COMPONENTS = {
  base: 50,
  food: 0,
  entertainment: 0,
  safety: 0,
  prosperity: 0,
  race: 0,
  effects: 0,
  synergy: 0,
  tax: 0,
  overcrowding: 0,
  fragments: 0
};

const toFiniteNumber = (value, fallback = 0) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
};

const HappinessPanel = () => {
  const [happiness, setHappiness] = useState(50);
  const [components, setComponents] = useState(DEFAULT_COMPONENTS);
  const [events, setEvents] = useState([]);
  const [history, setHistory] = useState([]);
  const [filter, setFilter] = useState(null); // null = all, or component name
  const [recoveryRate, setRecoveryRate] = useState(0);

  const fetchHappinessData = async () => {
    try {
      const response = await fetch('/api/kingdom/happiness-status');
      if (!response.ok) throw new Error('Failed to fetch');

      const data = await response.json();
      setHappiness(toFiniteNumber(data.happiness, 50));
      setComponents({
        ...DEFAULT_COMPONENTS,
        ...Object.fromEntries(
          Object.entries(data.components || {}).map(([key, value]) => [key, toFiniteNumber(value)])
        )
      });
      setEvents(data.recent || []);
      setHistory((data.last50Turns || []).map(point => ({
        ...point,
        happiness: toFiniteNumber(point.happiness, null)
      })).filter(point => point.happiness !== null));
      setRecoveryRate(toFiniteNumber(data.recoveryRate));
    } catch (err) {
      console.error('Happiness panel error:', err);
    }
  };

  useEffect(() => {
    fetchHappinessData();

    // Listen for game data updates via custom event
    const handleGameDataUpdate = () => {
      fetchHappinessData();
    };

    window.addEventListener('game-data-updated', handleGameDataUpdate);
    return () => {
      window.removeEventListener('game-data-updated', handleGameDataUpdate);
    };
  }, []);

  const getComponentEmoji = (name) => {
    const emojis = {
      food: '🍎',
      entertainment: '🎭',
      safety: '⚔️',
      prosperity: '💰',
      race: '👥',
      base: '=',
      effects: '*',
      synergy: '+',
      tax: '%',
      overcrowding: '!',
      fragments: '-'
    };
    return emojis[name] || '•';
  };

  const getComponentLabel = (name) => {
    const labels = {
      food: 'Food',
      entertainment: 'Entertainment',
      safety: 'Safety',
      prosperity: 'Prosperity',
      race: 'Race',
      base: 'Base',
      effects: 'Effects',
      synergy: 'Synergy',
      tax: 'Tax',
      overcrowding: 'Overcrowding',
      fragments: 'Fragments'
    };
    return labels[name] || name;
  };

  const filteredEvents = filter
    ? events.filter(e => e.component === filter)
    : events;

  return (
    <div id="happiness" className="panel">
      <div style={{ padding: '16px' }}>
        {/* Current Happiness Display */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>Current Happiness</span>
            <span style={{ fontSize: '24px', fontWeight: 700, color: 'var(--gold)', fontFamily: '"Cinzel", serif' }}>
              {happiness}/120
            </span>
          </div>
          <div style={{
            height: '24px',
            background: 'var(--bg3)',
            borderRadius: '12px',
            overflow: 'hidden',
            border: '1px solid var(--border)',
            boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.3)'
          }}>
            <div style={{
              height: '100%',
              width: `${Math.min(100, Math.max(0, (happiness / 120) * 100))}%`,
              background: happiness >= 80 ? 'var(--green)' : happiness >= 50 ? 'var(--gold)' : happiness >= 30 ? 'var(--amber)' : 'var(--red)',
              transition: 'width 0.3s ease'
            }} />
          </div>
        </div>

        {/* Happiness Graph */}
        <HappinessGraph history={history} />

        {/* Component Breakdown */}
        <div style={{ marginBottom: '24px' }}>
          <div className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-3">Component Breakdown</div>
          <div className="flex flex-col gap-2 mb-5">
            {Object.entries(components).map(([key, value]) => (
              <div
                key={key}
                className={`flex justify-between items-center p-3 bg-zinc-800 rounded border transition-all cursor-pointer ${filter === key ? 'border-orange-500 bg-orange-500/10' : 'border-zinc-700 hover:bg-zinc-700 hover:translate-x-0.5'}`}
                style={{
                  opacity: !filter || filter === key ? 1 : 0.5,
                }}
                onClick={() => setFilter(filter === key ? null : key)}
              >
                <span className="flex items-center gap-2 text-sm font-semibold text-white">
                  {getComponentEmoji(key)} {getComponentLabel(key)}
                </span>
                <span className={`font-mono text-sm font-bold min-w-[40px] text-right ${value > 0 ? 'text-green-500' : value < 0 ? 'text-red-500' : 'text-zinc-400'}`}>
                  {value > 0 ? '+' : ''}{value}
                </span>
              </div>
            ))}
            <div className="flex justify-between items-center p-2 bg-zinc-700 rounded border border-zinc-600 mt-1 font-bold">
              <span className="text-xs text-white">Recovery/turn</span>
              <span className="text-sm font-mono" style={{ color: recoveryRate >= 0 ? 'var(--gold)' : 'var(--red)' }}>
                {recoveryRate >= 0 ? '+' : ''}{recoveryRate.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Recent Changes Log */}
        <div style={{ marginBottom: '16px' }}>
          <div className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-3">
            Recent Changes {filter && `(${getComponentLabel(filter)})`}
          </div>
          <div className="max-h-[300px] overflow-y-auto bg-zinc-800 rounded border border-zinc-700">
            {filteredEvents.length === 0 ? (
              <div className="p-4 text-center text-zinc-500 text-xs">
                No changes recorded
              </div>
            ) : (
              filteredEvents.map((event, idx) => (
                <div key={idx} className="p-3 border-b border-zinc-700 text-xs text-zinc-300 leading-relaxed transition-all hover:bg-zinc-700 last:border-b-0">
                  <div className="flex justify-between mb-1 font-semibold text-white">
                    <span>Turn {event.turn}: {event.description}</span>
                    <span className={`font-mono font-bold min-w-[45px] text-right ${event.delta > 0 ? 'text-green-500' : event.delta < 0 ? 'text-red-500' : 'text-zinc-400'}`}>
                      {event.delta > 0 ? '+' : ''}{event.delta}
                    </span>
                  </div>
                  <div className="text-xs text-zinc-500 mt-1">
                    {event.old_happiness} → {event.new_happiness}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HappinessPanel;
