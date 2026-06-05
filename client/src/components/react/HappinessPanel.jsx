import React, { useState, useEffect } from 'react';
import HappinessGraph from './HappinessGraph';
import '../css/happiness.css';

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
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState(null); // null = all, or component name
  const [recoveryRate, setRecoveryRate] = useState(0);

  const fetchHappinessData = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/kingdom/happiness-status');
      if (!response.ok) throw new Error('Failed to fetch');

      const data = await response.json();
      setHappiness(data.happiness || 50);
      setComponents(data.components || {});
      setEvents(data.recent || []);
      setHistory(data.last50Turns || []);
      setRecoveryRate(data.recoveryRate || 0);
    } catch (err) {
      console.error('Happiness panel error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHappinessData();
    const interval = setInterval(fetchHappinessData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
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
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>
            Component Breakdown
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {Object.entries(components).map(([key, value]) => (
              <div key={key} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px',
                background: 'var(--bg3)',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                cursor: filter === key ? 'pointer' : 'default',
                opacity: !filter || filter === key ? 1 : 0.5,
                transition: 'all 0.2s'
              }} onClick={() => setFilter(filter === key ? null : key)}>
                <span style={{ fontSize: '13px', color: 'var(--text)', fontWeight: 600 }}>
                  {getComponentEmoji(key)} {getComponentLabel(key)}
                </span>
                <span style={{
                  fontSize: '14px',
                  fontWeight: 700,
                  color: value > 0 ? 'var(--green)' : value < 0 ? 'var(--red)' : 'var(--text3)',
                  fontFamily: 'monospace'
                }}>
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
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>
            Recent Changes {filter && `(${getComponentLabel(filter)})`}
          </div>
          <div style={{
            maxHeight: '240px',
            overflowY: 'auto',
            background: 'var(--bg3)',
            borderRadius: '8px',
            border: '1px solid var(--border)'
          }}>
            {filteredEvents.length === 0 ? (
              <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text3)', fontSize: '12px' }}>
                No changes recorded
              </div>
            ) : (
              filteredEvents.map((event, idx) => (
                <div key={idx} style={{
                  padding: '8px 12px',
                  borderBottom: idx < filteredEvents.length - 1 ? '1px solid var(--border)' : 'none',
                  fontSize: '12px',
                  color: 'var(--text2)',
                  lineHeight: '1.4'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                    <span>Turn {event.turn}: {event.description}</span>
                    <span style={{
                      color: event.delta > 0 ? 'var(--green)' : event.delta < 0 ? 'var(--red)' : 'var(--text3)',
                      fontWeight: 600,
                      fontFamily: 'monospace'
                    }}>
                      {event.delta > 0 ? '+' : ''}{event.delta}
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text3)' }}>
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
