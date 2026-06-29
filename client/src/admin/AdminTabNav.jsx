import React from 'react';

export const ADMIN_TABS = [
  { id: 'manage',    label: 'Manage',         icon: '⚙️' },
  { id: 'kingdoms',  label: 'Kingdoms',        icon: '🏰' },
  { id: 'events',    label: 'Events',          icon: '📅' },
  { id: 'config',    label: 'Config',          icon: '🛠️' },
  { id: 'sounds',    label: 'Sounds',          icon: '🎵' },
  { id: 'prestige',  label: 'Prestige',        icon: '✨' },
  { id: 'lore',      label: 'Lore & Trips',    icon: '📖' },
  { id: 'changelog', label: 'Evolution',       icon: '🧬' },
  { id: 'fragments', label: 'Detailed Lists',  icon: '📊' },
  { id: 'goals',     label: 'Goals',           icon: '🎯' },
  { id: 'security',  label: 'Security Audit',  icon: '🔒' },
  { id: 'audits',    label: 'Audit Schedules', icon: '📋' },
];

export default function AdminTabNav({ activeTab, onTabChange }) {
  return (
    <div style={{
      display: 'flex', overflowX: 'auto', gap: 4,
      borderBottom: '1px solid var(--border2)', marginBottom: 20,
      paddingBottom: 0,
      /* prevent page scroll on iOS when swiping the tab strip */
      WebkitOverflowScrolling: 'touch',
      scrollbarWidth: 'none',
    }}>
      {ADMIN_TABS.map(({ id, label, icon }) => {
        const active = activeTab === id;
        return (
          <button
            key={id}
            onClick={() => onTabChange(id)}
            style={{
              flexShrink: 0,
              padding: '10px 14px',
              background: 'none', border: 'none',
              borderBottom: active ? '2px solid var(--gold)' : '2px solid transparent',
              color: active ? 'var(--gold)' : 'var(--text3)',
              fontSize: 13, fontFamily: 'Inter, sans-serif',
              cursor: 'pointer', whiteSpace: 'nowrap',
              transition: 'color 0.15s, border-color 0.15s',
              marginBottom: -1,
            }}
          >
            <span style={{ marginRight: 5 }}>{icon}</span>
            {label}
          </button>
        );
      })}
    </div>
  );
}
