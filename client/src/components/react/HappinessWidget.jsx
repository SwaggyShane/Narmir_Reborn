import React, { useEffect, useCallback } from 'react';
import { useGameMutationEvents } from '../../hooks/useGameState';
import { useHappiness, usePopulationStore } from '../../stores';

const HappinessWidget = ({ onOpenTab }) => {
  const happiness = useHappiness() ?? 50;

  const fetchHappinessData = useCallback(async () => {
    try {
      const response = await fetch('/api/kingdom/happiness-status');
      if (!response.ok) throw new Error('Failed to fetch happiness data');

      const data = await response.json();
      if (data) {
        usePopulationStore.getState().receiveServerSnapshot({
          happiness: data.happiness ?? 50,
        });
      }
    } catch (err) {
      console.error('Happiness widget error:', err);
    }
  }, []);

  useEffect(() => {
    fetchHappinessData();
  }, [fetchHappinessData]);

  // Phase 3A: Zustand-driven refetch (dual source - listener is safety net)
  useEffect(() => {
    fetchHappinessData();
  }, [happiness, fetchHappinessData]);

  useGameMutationEvents(useCallback((event) => {
    const reason = String(event?.reason || '');
    if (['turn', 'kingdom-refresh', 'server-updates', 'mutation'].includes(reason)) {
      fetchHappinessData();
    }
  }, [fetchHappinessData]));

  const getHappinessColor = (value) => {
    if (value >= 80) return 'var(--green)';
    if (value >= 50) return 'var(--gold)';
    if (value >= 30) return 'var(--amber)';
    return 'var(--red)';
  };

  const getTrend = () => '→';

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
