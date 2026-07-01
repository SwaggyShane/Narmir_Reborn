export const NODE_TYPE_META = {
  wood: { label: 'Wood', fill: '#2f6b2c', stroke: '#7ddf7d', icon: '🌲' },
  stone: { label: 'Stone', fill: '#5a5a68', stroke: '#c5c5d4', icon: '⛰️' },
  iron: { label: 'Iron', fill: '#6b3a1f', stroke: '#e09050', icon: '⚙️' },
  gold: { label: 'Gold', fill: '#8a6a12', stroke: '#ffd76a', icon: '✦' },
};

export function getNodeRadius(richness = 1) {
  return 4 + Math.min(5, Math.max(1, Number(richness) || 1)) * 1.1;
}

export function formatNodeDistance(seconds) {
  const total = Math.max(0, Number(seconds) || 0);
  if (total < 3600) return `${Math.round(total / 60)}m travel`;
  const hours = total / 3600;
  if (hours < 48) return `${hours.toFixed(1)}h travel`;
  return `${Math.round(hours / 24)}d travel`;
}