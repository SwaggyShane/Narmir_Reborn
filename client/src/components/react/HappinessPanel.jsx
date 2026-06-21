import React, { useState, useEffect } from 'react';
import HappinessGraph from './HappinessGraph';
import '../../css/happiness.css';

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
              className="h-6 transition-[width] duration-300"
              style={{
                width: `${Math.min(100, Math.max(0, (happiness / 120) * 100))}%`,
                background:
                  happiness >= 80
                    ? 'var(--green)'
                    : happiness >= 50
                      ? 'var(--gold)'
                      : happiness >= 30
                        ? 'var(--amber)'
                        : 'var(--red)',
              }}
            />
          </div>
        </section>

        <section className="rounded-2xl border border-white/5 bg-zinc-950/95 p-4 shadow-[0_18px_40px_rgba(0,0,0,0.28)]">
          <HappinessGraph history={history} />
        </section>

        <section className="rounded-2xl border border-white/5 bg-zinc-950/95 p-4 shadow-[0_18px_40px_rgba(0,0,0,0.28)]">
          <div className="happiness-graph-label mb-3">Component Breakdown</div>
          <div className="space-y-2">
            {Object.entries(components).map(([key, value]) => (
              <button
                key={key}
                type="button"
                className={`flex w-full items-center justify-between rounded-xl border border-white/5 bg-zinc-950/80 px-3 py-2 text-left transition-colors ${filter === key ? 'ring-1 ring-[var(--gold)]' : ''}`}
                style={{ opacity: !filter || filter === key ? 1 : 0.5 }}
                onClick={() => setFilter(filter === key ? null : key)}
                aria-pressed={filter === key}
              >
                <span className="happiness-component-name">
                  {getComponentEmoji(key)} {getComponentLabel(key)}
                </span>
                <span className={`happiness-component-value ${value > 0 ? 'positive' : value < 0 ? 'negative' : 'neutral'}`}>
                  {value > 0 ? '+' : ''}
                  {value}
                </span>
              </button>
            ))}
            <div className="mt-2 flex items-center justify-between rounded-xl border border-white/5 bg-zinc-900/80 px-3 py-2 font-bold">
              <span className="text-[13px] text-[var(--text)]">Recovery/turn</span>
              <span className="font-mono text-[14px]" style={{ color: recoveryRate >= 0 ? 'var(--gold)' : 'var(--red)' }}>
                {recoveryRate >= 0 ? '+' : ''}
                {recoveryRate.toFixed(2)}
              </span>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-white/5 bg-zinc-950/95 p-4 shadow-[0_18px_40px_rgba(0,0,0,0.28)]">
          <div className="happiness-graph-label mb-3">
            Recent Changes {filter && `(${getComponentLabel(filter)})`}
          </div>
          <div className="space-y-2">
            {filteredEvents.length === 0 ? (
              <div className="rounded-xl border border-white/5 bg-zinc-950/80 px-4 py-4 text-center text-[12px] text-[var(--text3)]">
                No changes recorded
              </div>
            ) : (
              filteredEvents.map((event, idx) => (
                <article key={idx} className="rounded-xl border border-white/5 bg-zinc-950/80 px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <span>
                      Turn {event.turn}: {event.description}
                    </span>
                    <span
                      className={`happiness-event-delta ${event.delta > 0 ? 'positive' : event.delta < 0 ? 'negative' : 'neutral'}`}
                    >
                      {event.delta > 0 ? '+' : ''}
                      {event.delta}
                    </span>
                  </div>
                  <div className="mt-1 text-[12px] text-[var(--text3)]">
                    {event.old_happiness}
                    {' -> '}
                    {event.new_happiness}
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default HappinessPanel;
