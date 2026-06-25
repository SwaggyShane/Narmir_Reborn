import React from 'react';

const STATS = [
  { key: 'players',   label: 'Players' },
  { key: 'kingdoms',  label: 'Kingdoms' },
  { key: 'banned',    label: 'Banned',     color: 'var(--red)' },
  { key: 'combats',   label: 'Combats' },
  { key: 'messages',  label: 'Messages' },
  { key: 'lastRegen', label: 'Last regen', small: true },
];

function formatValue(key, value) {
  if (value == null) return '—';
  if (key === 'lastRegen') return new Date(value * 1000).toLocaleTimeString();
  return value.toLocaleString();
}

export default function AdminStatGrid({ stats, loading }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
      gap: 10, marginBottom: 20,
    }}>
      {STATS.map(({ key, label, color, small }) => (
        <div key={key} style={{
          background: 'var(--bg2)', border: '1px solid var(--border)',
          borderRadius: 8, padding: '12px 14px',
        }}>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text3)', marginBottom: 6 }}>
            {label}
          </div>
          <div style={{
            fontFamily: 'Cinzel, serif',
            fontSize: small ? 14 : 22,
            color: loading ? 'var(--text3)' : (color ?? 'var(--gold)'),
            lineHeight: 1.2,
          }}>
            {loading ? '—' : formatValue(key, stats?.[key])}
          </div>
        </div>
      ))}
    </div>
  );
}
