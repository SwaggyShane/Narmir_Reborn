import React, { useState, useEffect, useCallback } from 'react';
import { useGameMutationEvents } from '../../hooks/useGameState';

const HappinessWidget = ({ onOpenTab }) => {
  const [happiness, setHappiness] = useState(50);
  const [history, setHistory] = useState([]);

  const fetchHappinessData = async () => {
    try {
      const response = await fetch('/api/kingdom/happiness-status');
      if (!response.ok) throw new Error('Failed to fetch happiness data');

      const data = await response.json();
      setHappiness(data.happiness || 50);
      setHistory(data.last50Turns || []);
    } catch (err) {
      console.error('Happiness widget error:', err);
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

  const getHappinessColor = (value) => {
    if (value >= 80) return 'var(--green)';
    if (value >= 50) return 'var(--gold)';
    if (value >= 30) return 'var(--amber)';
    return 'var(--red)';
  };

  const getTrend = () => {
    if (history.length < 2) return '→';
    const current = history[history.length - 1]?.happiness || happiness;
    const previous = history[Math.max(0, history.length - 6)]?.happiness || current;
    if (current > previous) return '📈';
    if (current < previous) return '📉';
    return '→';
  };

  const barWidth = (happiness / 120) * 100;
  const barColor =
    happiness >= 80 ? 'bg-[var(--green)]' :
    happiness >= 50 ? 'bg-[var(--gold)]' :
    happiness >= 30 ? 'bg-[var(--amber)]' :
    'bg-[var(--red)]';

  return (
    <div className="happiness-widget card mb-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[13px] font-semibold uppercase tracking-[0.5px] text-[var(--gold)]">
          😊 Happiness
        </div>
        <div className="text-[12px] text-[var(--text3)]">{happiness}/120</div>
      </div>

      <div className="mb-2 h-4 overflow-hidden rounded-full border border-[var(--border)] bg-[var(--bg3)]">
        <div
          className={`h-full rounded-[7px] transition-[width] duration-300 ${barColor}`}
          style={{ width: `${barWidth}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-[12px] text-[var(--text3)]">
        <span>{getTrend()} Trending</span>
        <button
          className="rounded px-1.5 py-0.5 text-[12px] font-semibold text-[var(--gold)] transition hover:bg-[var(--bg3)]"
          onClick={onOpenTab}
        >
          View Details →
        </button>
      </div>
    </div>
  );
};

export default HappinessWidget;
