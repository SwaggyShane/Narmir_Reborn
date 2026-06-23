import { fmt } from './fmt.js';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[ch]);
}

function getRaceIcon(race) {
  const icons = {
    human: '👤',
    dwarf: '⛏️',
    orc: '🪓',
    high_elf: '🧝',
    dark_elf: '🕷️',
    undead: '💀',
    vampire: '🩸',
  };
  return icons[race] || '📍';
}

export function renderTargets(list, containerId, selectFn) {
  const el = document.getElementById(containerId);
  if (!el) return;

  const targets = Array.isArray(list) ? list : [];
  if (!targets.length) {
    el.innerHTML = '<div style="color:var(--text3);font-size:12px;padding:8px 0">No targets available.</div>';
    return;
  }

  el.innerHTML = targets
    .map((target) => {
      const icon = target.is_location ? '📍' : getRaceIcon(target.race);
      const raceLabel = target.is_location ? 'Discovered site' : String(target.race || 'unknown').replace(/_/g, ' ');
      const rank = target.rank || '?';
      const land = target.is_location ? '???' : fmt(target.land || 0) + ' ac';
      const handler = selectFn ? `${selectFn}('${String(target.id).replace(/'/g, "\\'")}', '${containerId}')` : '';
      return `
        <div class="target-row" style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-bottom:1px solid var(--border);${selectFn ? 'cursor:pointer;' : ''}" ${selectFn ? `onclick="${handler}"` : ''}>
          <div style="font-size:18px;line-height:1">${icon}</div>
          <div style="flex:1;min-width:0">
            <div style="color:var(--text);font-weight:600;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(target.name || 'Unknown')}</div>
            <div style="color:var(--text3);font-size:10px">${escapeHtml(raceLabel)}</div>
          </div>
          <div style="text-align:right">
            <div style="color:var(--gold);font-weight:600;font-size:12px">${escapeHtml(String(land))}</div>
            <div style="color:var(--text3);font-size:10px">#${escapeHtml(String(rank))}</div>
          </div>
        </div>`;
    })
    .join('');
}
