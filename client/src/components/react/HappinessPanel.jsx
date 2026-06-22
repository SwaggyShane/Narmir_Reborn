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
  fragments: 0,
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
  const [filter, setFilter] = useState(null);
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
        ),
      });
      setEvents(data.recent || []);
      setHistory(
        (data.last50Turns || [])
          .map((point) => ({
            ...point,
            happiness: toFiniteNumber(point.happiness, null),
          }))
          .filter((point) => point.happiness !== null)
      );
      setRecoveryRate(toFiniteNumber(data.recoveryRate));
    } catch (err) {
      console.error('Happiness panel error:', err);
    }
  };

  useEffect(() => {
    fetchHappinessData();

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
      fragments: '-',
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
      fragments: 'Fragments',
    };
    return labels[name] || name;
  };

  const filteredEvents = filter ? events.filter((e) => e.component === filter) : events;
  const happinessBarClass =
    happiness >= 80 ? 'bg-[var(--green)]' :
    happiness >= 50 ? 'bg-[var(--gold)]' :
    happiness >= 30 ? 'bg-[var(--amber)]' :
    'bg-[var(--red)]';

  return (
    <div id="happiness" className="panel min-h-0 w-full overflow-y-auto">
      <div className="space-y-6 p-4 md:p-5">
        <section className="rounded-2xl border border-white/5 bg-zinc-950/95 p-4 shadow-[0_18px_40px_rgba(0,0,0,0.28)]">
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="text-[14px] font-semibold text-[var(--text)]">Current Happiness</span>
            <span className="font-serif text-[24px] font-bold text-[var(--gold)]">{happiness}/120</span>
          </div>
          <div className="overflow-hidden rounded-full border border-white/5 bg-[var(--bg3)] shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)]">
            <div
              className={`h-6 transition-[width] duration-300 ${happinessBarClass}`}
              style={{ width: `${Math.min(100, Math.max(0, (happiness / 120) * 100))}%` }}
            />
          </div>
        </section>

        <section className="rounded-2xl border border-white/5 bg-zinc-950/95 p-4 shadow-[0_18px_40px_rgba(0,0,0,0.28)]">
          <HappinessGraph history={history} />
        </section>

        {/* Component Breakdown */}
        <div className="mb-6">
          <div className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-3">Component Breakdown</div>
          <div className="flex flex-col gap-2 mb-5">
            {Object.entries(components).map(([key, value]) => (
              <button
                key={key}
                className={`flex items-center justify-between rounded border bg-zinc-800 p-3 text-left transition-all cursor-pointer ${filter === key ? 'border-orange-500 bg-orange-500/10' : 'border-zinc-700 hover:bg-zinc-700 hover:translate-x-0.5'} ${!filter || filter === key ? 'opacity-100' : 'opacity-50'}`}
                onClick={() => setFilter(filter === key ? null : key)}
                aria-pressed={filter === key}
              >
                <span className="flex items-center gap-2 text-sm font-semibold text-white">
                  {getComponentEmoji(key)} {getComponentLabel(key)}
                </span>
                <span className={`font-mono text-sm font-bold min-w-[40px] text-right ${value > 0 ? 'text-green' : value < 0 ? 'text-red' : 'text-zinc-400'}`}>
                  {value > 0 ? '+' : ''}{value}
                </span>
              </button>
            ))}
            <div className="flex justify-between items-center p-2 bg-zinc-700 rounded border border-zinc-600 mt-1 font-bold">
              <span className="text-xs text-white">Recovery/turn</span>
              <span className={`text-sm font-mono ${recoveryRate >= 0 ? 'text-gold' : 'text-red'}`}>
                {recoveryRate >= 0 ? '+' : ''}{recoveryRate.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Recent Changes Log */}
        <div className="mb-4">
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
                    <span className={`font-mono font-bold min-w-[45px] text-right ${event.delta > 0 ? 'text-green' : event.delta < 0 ? 'text-red' : 'text-zinc-400'}`}>
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
