import React, { useState, useEffect } from 'react';

const HappinessWidget = ({ onOpenTab }) => {
  const [happiness, setHappiness] = useState(50);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchHappinessData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/kingdom/happiness-status');
      if (!response.ok) throw new Error('Failed to fetch happiness data');

      const data = await response.json();
      setHappiness(data.happiness || 50);
      setHistory(data.last50Turns || []);
    } catch (err) {
      console.error('Happiness widget error:', err);
      setError('Failed to load happiness');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHappinessData();
  }, []);

  // Watch for turn increments to refresh data
  useEffect(() => {
    const originalFetch = window.fetchGameData;
    if (originalFetch) {
      window.fetchGameData = function(...args) {
        const result = originalFetch.apply(this, args);
        if (result instanceof Promise) {
          result.then(() => fetchHappinessData());
        }
        return result;
      };
    }

    return () => {
      if (originalFetch) {
        window.fetchGameData = originalFetch;
      }
    };
  }, []);

  const getHappinessColor = (value) => {
    if (value >= 80) return 'var(--green)';
    if (value >= 50) return 'var(--gold)';
    if (value >= 30) return 'var(--amber)';
    return 'var(--red)';
  };

  const getTrend = () => {
    if (history.length < 2) return '→';
    const current = history[history.length - 1]?.happiness_value || happiness;
    const previous = history[Math.max(0, history.length - 6)]?.happiness_value || current;
    if (current > previous) return '📈';
    if (current < previous) return '📉';
    return '→';
  };

  const barWidth = (happiness / 120) * 100;

  return (
    <div className="happiness-widget card" style={{ marginBottom: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          😊 Happiness
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text3)' }}>
          {happiness}/120
        </div>
      </div>

      {/* Happiness bar */}
      <div style={{
        height: '16px',
        background: 'var(--bg3)',
        borderRadius: '8px',
        overflow: 'hidden',
        marginBottom: '8px',
        border: '1px solid var(--border)'
      }}>
        <div style={{
          height: '100%',
          width: `${barWidth}%`,
          background: getHappinessColor(happiness),
          transition: 'width 0.3s ease',
          borderRadius: '7px'
        }} />
      </div>

      {/* Trend and details */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: 'var(--text3)' }}>
        <span>{getTrend()} Trending</span>
        <button
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--gold)',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 600,
            padding: '2px 6px',
            borderRadius: '4px',
            transition: 'background 0.2s'
          }}
          onMouseEnter={(e) => e.target.style.background = 'var(--bg3)'}
          onMouseLeave={(e) => e.target.style.background = 'none'}
          onClick={onOpenTab}
        >
          View Details →
        </button>
      </div>
    </div>
  );
};

export default HappinessWidget;
