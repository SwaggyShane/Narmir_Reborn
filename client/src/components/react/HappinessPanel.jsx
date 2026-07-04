import React, { useState, useEffect, useCallback } from 'react';
import clsx from 'clsx';
import HappinessGraph from './HappinessGraph';
import { useGameMutationEvents } from '../../hooks/useGameState';
import { useHappiness } from '../../stores';

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
  const happiness = toFiniteNumber(useHappiness(), 50);
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
  }, []);

  useGameMutationEvents(useCallback((event) => {
    const reason = String(event?.reason || '');
    if (['turn', 'kingdom-refresh', 'server-updates', 'mutation'].includes(reason)) {
      fetchHappinessData();
    }
  }, []));

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

  const happinessBarColorClass =
    happiness >= 80
      ? 'bg-[var(--green)]'
      : happiness >= 50
        ? 'bg-[var(--gold)]'
        : happiness >= 30
          ? 'bg-[var(--amber)]'
          : 'bg-[var(--red)]';

  return (
    <div id="happiness" className="panel">
      <div className="space-y-6 p-4 md:p-5">
        <section className="rounded-2xl border border-white/5 bg-bg p-4 shadow-[0_18px_40px_rgba(0,0,0,0.28)]">
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="text-[14px] font-semibold text-text">Current Happiness</span>
            <span className="font-serif text-[24px] font-bold text-gold">{happiness}/120</span>
          </div>
          <div className="overflow-hidden rounded-full border border-white/5 bg-bg3 shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)]">
            <div
              className={`h-6 transition-[width] duration-300 ${happinessBarColorClass}`}
              style={{
                width: `${Math.min(100, Math.max(0, (happiness / 120) * 100))}%`,
              }}
            />
          </div>
        </section>

        <section className="rounded-2xl border border-white/5 bg-bg p-4 shadow-[0_18px_40px_rgba(0,0,0,0.28)]">
          <HappinessGraph history={history} />
        </section>

        {/* Component Breakdown */}
        <div className="mb-6">
          <div className="text-xs font-semibold text-text3 uppercase tracking-widest mb-3">Component Breakdown</div>
          <div className="flex flex-col gap-2 mb-5">
            {Object.entries(components).map(([key, value]) => (
              <button
                key={key}
                className={clsx('flex justify-between items-center p-3 rounded border transition-all cursor-pointer', filter === key ? 'border-gold bg-gold/10' : 'border-white/10 bg-bg2 hover:bg-bg3 hover:translate-x-0.5', !filter || filter === key ? 'opacity-100' : 'opacity-50')}
                onClick={() => setFilter(filter === key ? null : key)}
                aria-pressed={filter === key}
              >
                <span className="flex items-center gap-2 text-sm font-semibold text-text">
                  {getComponentEmoji(key)} {getComponentLabel(key)}
                </span>
                <span className={clsx('font-mono text-sm font-bold min-w-[40px] text-right', value > 0 ? 'text-green' : value < 0 ? 'text-red' : 'text-text3')}>
                  {value > 0 ? '+' : ''}{value}
                </span>
              </button>
            ))}
            <div className="flex justify-between items-center p-2 bg-bg3 rounded border border-white/10 mt-1 font-bold">
              <span className="text-xs text-text">Recovery/turn</span>
              <span className={clsx('text-sm font-mono', recoveryRate >= 0 ? 'text-gold' : 'text-red')}>
                {recoveryRate >= 0 ? '+' : ''}{recoveryRate.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Recent Changes Log */}
        <div className="mb-4">
          <div className="text-xs font-semibold text-text3 uppercase tracking-widest mb-3">
            Recent Changes {filter && `(${getComponentLabel(filter)})`}
          </div>
          <div className="max-h-[300px] overflow-y-auto bg-bg2 rounded border border-white/10">
            {filteredEvents.length === 0 ? (
              <div className="p-4 text-center text-text3 text-xs">
                No changes recorded
              </div>
            ) : (
              filteredEvents.map((event, idx) => (
                <div key={idx} className="p-3 border-b border-white/10 text-xs text-text2 leading-relaxed transition-all hover:bg-bg3 last:border-b-0">
                  <div className="flex justify-between mb-1 font-semibold text-text">
                    <span>Turn {event.turn}: {event.description}</span>
                    <span className={clsx('font-mono font-bold min-w-[45px] text-right', event.delta > 0 ? 'text-green' : event.delta < 0 ? 'text-red' : 'text-text3')}>
                      {event.delta > 0 ? '+' : ''}{event.delta}
                    </span>
                  </div>
                  <div className="text-xs text-text3 mt-1">
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
