import React, { useState, useEffect, useCallback } from 'react';
import { apiCall } from '../../utils/api';
import { useGameState } from '../../hooks/useGameState.js';

const REFRESH_INTERVAL_MS = 2 * 60 * 1000;

const GoalsPanel = () => {
  const gs = useGameState();
  const [loading, setLoading] = useState(true);
  const [goalsData, setGoalsData] = useState({});
  const [now, setNow] = useState(Date.now());

  const fetchGoals = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiCall('/api/kingdom/goals');
      if (res && res.error) {
        if (window.toast) window.toast(res.error, 'error');
      } else if (res) {
        setGoalsData(res);
      }
    } catch(e) {
      if (window.toast) window.toast('Failed to fetch goals', 'error');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchGoals();
    const clockTimer = setInterval(() => setNow(Date.now()), 1000);
    const refreshTimer = setInterval(fetchGoals, REFRESH_INTERVAL_MS);
    window.refreshGoalsPanel = fetchGoals;
    return () => {
      clearInterval(clockTimer);
      clearInterval(refreshTimer);
      delete window.refreshGoalsPanel;
    };
  }, [fetchGoals]);

  // Re-fetch goals whenever game state changes (turn taken, goal completed, etc.)
  useEffect(() => {
    fetchGoals();
  }, [gs.turn, gs.xp, gs.level, fetchGoals]);

  const claimGoal = async (groupId, goalId) => {
    try {
      const res = await apiCall('/api/kingdom/goals/claim', { method: 'POST', body: { groupId, goalId } });
      if (res && res.ok) {
        if (window.toast) window.toast(res.message, "success");
        // Find and mark claimed locally
        const newGoalsData = { ...goalsData };
        const goal = newGoalsData[groupId].goals.find(g => g.id === goalId);
        if (goal) goal.claimed = true;
        setGoalsData(newGoalsData);
        if (window.refreshKingdomParams) window.refreshKingdomParams();
      } else if (res && res.error) {
        if (window.toast) window.toast(res.error, "error");
      }
    } catch(e) {
      if (window.toast) window.toast(e.message || "Failed to claim goal", "error");
    }
  };

  const formatPrize = (type) => {
    if (!type) return '';
    return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
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

  return (
    <div id="goals" className="panel">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <h2 style={{ margin: 0 }}>📝 Goals</h2>
        <button className="base-btn" onClick={fetchGoals} style={{ fontSize: '11px', padding: '4px 10px' }}>↻ Refresh</button>
      </div>
      <p>Complete daily and weekly goals to earn powerful rewards!</p>

      {loading ? (
        <div className="text-center p-4">Loading goals...</div>
      ) : (
        <div>
          {goalsData.daily && (
            <div className="goal-group">
              <h3>Daily Goals</h3>
              <p className="subtext">Resets in {timeUntil(goalsData.daily.expiresAt)}</p>
              <div className="goal-list">
                {goalsData.daily.goals.map((goal) => (
                  <div key={goal.id} className={`goal-card ${goal.claimed ? 'claimed' : ''}`}>
                    <div className="goal-info">
                      <div className="goal-title">{goal.label}</div>
                      <div className="goal-progress">
                        <div className="progress-bar-bg">
                          <div
                            className="progress-bar-fill"
                            style={{ width: `${Math.min(100, (goal.progress / goal.target) * 100)}%` }}
                          ></div>
                        </div>
                        <span className="progress-text">{goal.progress} / {goal.target}</span>
                      </div>
                    </div>
                    <div className="goal-action">
                      <div className="goal-prize">{goal.prizeAmount} {formatPrize(goal.prizeType)}</div>
                      {!goal.claimed ? (
                        <button
                          onClick={() => claimGoal('daily', goal.id)}
                          disabled={goal.progress < goal.target}
                          className={`base-btn ${goal.progress >= goal.target ? 'ready' : ''}`}
                        >
                          {goal.progress >= goal.target ? 'Claim' : 'Incomplete'}
                        </button>
                      ) : (
                        <span className="claimed-text">Claimed ✔</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {goalsData.weekly && (
            <div className="goal-group mt-4">
              <h3>Weekly Goals</h3>
              <p className="subtext">Resets in {timeUntil(goalsData.weekly.expiresAt)}</p>
              <div className="goal-list">
                {goalsData.weekly.goals.map((goal) => (
                  <div key={goal.id} className={`goal-card ${goal.claimed ? 'claimed' : ''}`}>
                    <div className="goal-info">
                      <div className="goal-title">{goal.label}</div>
                      <div className="goal-progress">
                        <div className="progress-bar-bg">
                          <div
                            className="progress-bar-fill"
                            style={{ width: `${Math.min(100, (goal.progress / goal.target) * 100)}%` }}
                          ></div>
                        </div>
                        <span className="progress-text">{goal.progress} / {goal.target}</span>
                      </div>
                    </div>
                    <div className="goal-action">
                      <div className="goal-prize">{goal.prizeAmount} {formatPrize(goal.prizeType)}</div>
                      {!goal.claimed ? (
                        <button
                          onClick={() => claimGoal('weekly', goal.id)}
                          disabled={goal.progress < goal.target}
                          className={`base-btn ${goal.progress >= goal.target ? 'ready' : ''}`}
                        >
                          {goal.progress >= goal.target ? 'Claim' : 'Incomplete'}
                        </button>
                      ) : (
                        <span className="claimed-text">Claimed ✔</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
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
        .mt-4 { margin-top: 16px; }
      `}</style>
    </div>
  );
};

export default GoalsPanel;
