import React, { useState, useEffect } from 'react';
import HappinessGraph from './HappinessGraph';
import '../../css/happiness.css';

const HappinessPanel = () => {
  const [happiness, setHappiness] = useState(50);
  const [components, setComponents] = useState({
    food: 0,
    entertainment: 0,
    safety: 0,
    prosperity: 0,
    race: 0
  });
  const [events, setEvents] = useState([]);
  const [history, setHistory] = useState([]);
  const [filter, setFilter] = useState(null); // null = all, or component name
  const [recoveryRate, setRecoveryRate] = useState(0);

  const fetchHappinessData = async () => {
    try {
      const response = await fetch('/api/kingdom/happiness-status');
      if (!response.ok) throw new Error('Failed to fetch');

      const data = await response.json();
      setHappiness(data.happiness || 50);
      setComponents(prev => ({ ...prev, ...(data.components || {}) }));
      setEvents(data.recent || []);
      setHistory(data.last50Turns || []);
      setRecoveryRate(data.recoveryRate || 0);
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
      race: '👥'
    };
    return emojis[name] || '•';
  };

  const getComponentLabel = (name) => {
    const labels = {
      food: 'Food',
      entertainment: 'Entertainment',
      safety: 'Safety',
      prosperity: 'Prosperity',
      race: 'Race'
    };
    return labels[name] || name;
  };

  const filteredEvents = filter
    ? events.filter(e => e.component === filter)
    : events;

  return (
    <div id="happiness-panel" className="panel">
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
              width: `${(happiness / 120) * 100}%`,
              background: happiness >= 80 ? 'var(--green)' : happiness >= 50 ? 'var(--gold)' : happiness >= 30 ? 'var(--amber)' : 'var(--red)',
              transition: 'width 0.3s ease'
            }} />
          </div>
        </div>

        {/* Happiness Graph */}
        <HappinessGraph history={history} />

        {/* Component Breakdown */}
        <div style={{ marginBottom: '24px' }}>
          <div className="happiness-graph-label">Component Breakdown</div>
          <div className="happiness-components">
            {Object.entries(components).map(([key, value]) => (
              <div
                key={key}
                className={`happiness-component-row ${filter === key ? 'active' : ''}`}
                style={{
                  opacity: !filter || filter === key ? 1 : 0.5,
                }}
                onClick={() => setFilter(filter === key ? null : key)}
              >
                <span className="happiness-component-name">
                  {getComponentEmoji(key)} {getComponentLabel(key)}
                </span>
                <span className={`happiness-component-value ${value > 0 ? 'positive' : value < 0 ? 'negative' : 'neutral'}`}>
                  {value > 0 ? '+' : ''}{value}
                </span>
              </div>
            ))}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '8px',
              background: 'var(--bg2)',
              borderRadius: '8px',
              border: '1px solid var(--border2)',
              marginTop: '4px',
              fontWeight: 700
            }}>
              <span style={{ fontSize: '13px', color: 'var(--text)' }}>Recovery/turn</span>
              <span style={{ fontSize: '14px', color: 'var(--gold)', fontFamily: 'monospace' }}>+{recoveryRate.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Recent Changes Log */}
        <div style={{ marginBottom: '16px' }}>
          <div className="happiness-graph-label">
            Recent Changes {filter && `(${getComponentLabel(filter)})`}
          </div>
          <div className="happiness-events-log">
            {filteredEvents.length === 0 ? (
              <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text3)', fontSize: '12px' }}>
                No changes recorded
              </div>
            ) : (
              filteredEvents.map((event, idx) => (
                <div key={idx} className="happiness-event-item">
                  <div className="happiness-event-turn">
                    <span>Turn {event.turn}: {event.description}</span>
                    <span className={`happiness-event-delta ${event.delta > 0 ? 'positive' : event.delta < 0 ? 'negative' : 'neutral'}`}>
                      {event.delta > 0 ? '+' : ''}{event.delta}
                    </span>
                  </div>
                  <div className="happiness-event-transition">
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
