import React, { useState, useEffect, useCallback } from 'react';
import { apiCall } from '../../utils/api';

const REFRESH_INTERVAL_MS = 2 * 60 * 1000;

const goalGroupClass = 'rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg2)] p-4';
const goalListClass = 'flex flex-col gap-3';
const goalCardClass =
  'flex items-center justify-between rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg3)] p-3 transition-opacity';
const goalInfoClass = 'flex-1 pr-4';
const goalTitleClass = 'mb-2 font-bold text-[var(--text)]';
const goalProgressClass = 'flex items-center';
const progressBarBgClass = 'mr-3 h-2 flex-1 overflow-hidden rounded bg-[var(--bg)]';
const progressBarFillClass = 'h-full bg-[var(--gold)] transition-[width] duration-300';
const progressTextClass = 'whitespace-nowrap text-xs text-[var(--text2)]';
const goalActionClass = 'min-w-[120px] text-right';
const goalPrizeClass = 'mb-2 text-[13px] font-bold text-[var(--gold)]';
const goalButtonBaseClass = 'base-btn px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-50';
const goalButtonReadyClass = 'bg-[var(--green)] text-white';
const claimedTextClass = 'font-bold text-[var(--green)]';

const GoalsPanel = () => {
  const [loading, setLoading] = useState(true);
  const [goalsData, setGoalsData] = useState({});
  const [now, setNow] = useState(Date.now());

  const fetchGoals = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiCall('/api/kingdom/goals');
      if (res && res.error) {
        if (typeof window !== 'undefined' && typeof toast === 'function') toast(res.error, 'error');
      } else if (res) {
        setGoalsData(res);
      }
    } catch (e) {
      if (typeof window !== 'undefined' && typeof toast === 'function') toast('Failed to fetch goals', 'error');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchGoals();
    const clockTimer = setInterval(() => setNow(Date.now()), 1000);
    const refreshTimer = setInterval(fetchGoals, REFRESH_INTERVAL_MS);
    return () => {
      clearInterval(clockTimer);
      clearInterval(refreshTimer);
    };
  }, [fetchGoals]);

  const claimGoal = async (groupId, goalId) => {
    try {
      const res = await apiCall('/api/kingdom/goals/claim', { method: 'POST', body: { groupId, goalId } });
      if (res && res.ok) {
        if (typeof window !== 'undefined' && typeof toast === 'function') toast(res.message, 'success');
        const newGoalsData = { ...goalsData };
        const goal = newGoalsData[groupId].goals.find((g) => g.id === goalId);
        if (goal) goal.claimed = true;
        setGoalsData(newGoalsData);
      } else if (res && res.error) {
        if (typeof window !== 'undefined' && typeof toast === 'function') toast(res.error, 'error');
      }
    } catch (e) {
      if (typeof window !== 'undefined' && typeof toast === 'function') toast(e.message || 'Failed to claim goal', 'error');
    }
  };

  const formatPrize = (type) => {
    if (!type) return '';
    return type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const timeUntil = (ms) => {
    const diff = ms - now;
    if (diff <= 0) return 'Resetting soon...';
    const hrs = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const d = Math.floor(hrs / 24);
    if (d > 0) return `${d}d ${hrs % 24}h ${mins}m`;
    return `${hrs}h ${mins}m`;
  };

  const renderGoal = (groupId, goal) => (
    <div key={goal.id} className={`${goalCardClass} ${goal.claimed ? 'opacity-60' : ''}`}>
      <div className={goalInfoClass}>
        <div className={goalTitleClass}>{goal.label}</div>
        <div className={goalProgressClass}>
          <div className={progressBarBgClass}>
            <div className={progressBarFillClass} style={{ width: `${Math.min(100, (goal.progress / goal.target) * 100)}%` }} />
          </div>
          <span className={progressTextClass}>
            {goal.progress} / {goal.target}
          </span>
        </div>
      </div>
      <div className={goalActionClass}>
        <div className={goalPrizeClass}>
          {goal.prizeAmount} {formatPrize(goal.prizeType)}
        </div>
        {!goal.claimed ? (
          <button
            onClick={() => claimGoal(groupId, goal.id)}
            disabled={goal.progress < goal.target}
            className={`${goalButtonBaseClass} ${goal.progress >= goal.target ? goalButtonReadyClass : ''}`}
          >
            {goal.progress >= goal.target ? 'Claim' : 'Incomplete'}
          </button>
        ) : (
          <span className={claimedTextClass}>Claimed ✔</span>
        )}
      </div>
    </div>
  );

  return (
    <div id="goals" className="panel">
      <div className="mb-2 flex items-center justify-between">
        <h2 style={{ margin: 0 }}>📝 Goals</h2>
        <button className="base-btn" onClick={fetchGoals} style={{ fontSize: '11px', padding: '4px 10px' }}>↻ Refresh</button>
      </div>
      <p>Complete daily and weekly goals to earn powerful rewards!</p>

      {loading ? (
        <div className="p-4 text-center">Loading goals...</div>
      ) : (
        <div>
          {goalsData.daily && (
            <div className={goalGroupClass}>
              <h3>Daily Goals</h3>
              <p className="-mt-2 mb-3 text-xs text-[var(--text3)]">Resets in {timeUntil(goalsData.daily.expiresAt)}</p>
              <div className={goalListClass}>{goalsData.daily.goals.map((goal) => renderGoal('daily', goal))}</div>
            </div>
          )}

          {goalsData.weekly && (
            <div className={`${goalGroupClass} mt-4`}>
              <h3>Weekly Goals</h3>
              <p className="-mt-2 mb-3 text-xs text-[var(--text3)]">Resets in {timeUntil(goalsData.weekly.expiresAt)}</p>
              <div className={goalListClass}>{goalsData.weekly.goals.map((goal) => renderGoal('weekly', goal))}</div>
            </div>
          )}
        </div>
      )}
      <style>{`
        .goal-group {
          background: var(--bg2);
          border: 1px solid var(--border);
          padding: 16px;
          border-radius: var(--radius);
        }
        .subtext {
          font-size: 12px;
          color: var(--text3);
          margin-top: -8px;
          margin-bottom: 12px;
        }
        .goal-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .goal-card {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: var(--bg3);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 12px;
        }
        .goal-card.claimed {
          opacity: 0.6;
        }
        .goal-info {
          flex: 1;
          padding-right: 16px;
        }
        .goal-title {
          font-weight: bold;
          color: var(--text);
          margin-bottom: 8px;
        }
        .progress-bar-bg {
          background: var(--bg);
          height: 8px;
          border-radius: 4px;
          flex: 1;
          overflow: hidden;
          margin-right: 12px;
        }
        .progress-bar-fill {
          background: var(--gold);
          height: 100%;
          transition: width 0.3s;
        }
        .goal-progress {
          display: flex;
          align-items: center;
        }
        .progress-text {
          font-size: 12px;
          color: var(--text2);
          white-space: nowrap;
        }
        .goal-action {
          text-align: right;
          min-width: 120px;
        }
        .goal-prize {
          font-size: 13px;
          color: var(--gold);
          margin-bottom: 8px;
          font-weight: bold;
        }
        .base-btn {
          background: var(--bg-hover);
          color: var(--text);
          border: 1px solid var(--border);
          padding: 6px 12px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
        }
        .base-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .base-btn.ready {
          background: var(--green) !important;
          color: white !important;
        }
        .claimed-text {
          color: var(--green);
          font-weight: bold;
        }
      `}</style>
    </div>
  );
};

export default GoalsPanel;
