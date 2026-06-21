import { gameStateManager } from '../GameStateManager.js';
import { fmt } from '../utils/fmt.js';

const RACE_ICONS = window.RACE_ICONS || {};

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[ch]);
}

export function filterWarfareTargetsUnified(q, containerId) {
  const state = window.state || gameStateManager.getState();
  const targets = window.targets || [];
  const filtered = q
    ? targets.filter((t) => (t.name || '').toLowerCase().includes(q.toLowerCase()))
    : targets;

  let selectFn = '';
  if (containerId === 'atk-target-list-w') selectFn = 'selectTargetW';
  else if (containerId === 'wsp-target-list-w') selectFn = 'selectWspellTarget';
  else if (containerId === 'wcov-target-list-w') selectFn = 'selectWcovTarget';

  renderKingdomCardList(filtered, containerId, selectFn);
}

export function renderKingdomCardList(list, containerId, selectFn) {
  const el = document.getElementById(containerId);
  if (!el) return;

  const state = window.state || gameStateManager.getState();
  let disc = state.discovered_kingdoms || {};

  if (typeof disc === 'string') {
    try {
      disc = JSON.parse(disc);
    } catch (e) {
      disc = {};
    }
  }

  const mapped = list.filter((t) => disc[t.id] && disc[t.id].mapped);

  Object.keys(disc).forEach((id) => {
    const d = disc[id];
    if (
      d.mapped &&
      !mapped.find((f) => String(f.id) === String(id))
    ) {
      if (String(id) === String(state.kingdomId)) return;
      mapped.push({
        id,
        name: d.name || `Kingdom #${id}`,
        race: d.race || 'unknown',
        level: d.level || 1,
        rank: d.rank || 'none',
        fighters: d.fighters || 0,
        land: d.land || 0,
        is_ai: d.is_ai || false,
        is_location: true,
      });
    }
  });

  if (containerId === 'wsp-target-list-w' || containerId === 'spell-target-list') {
    if (!mapped.some((r) => String(r.id) === String(state.kingdomId))) {
      mapped.unshift({
        id: state.kingdomId,
        name: `${state.kingdomName || state.name || 'My Kingdom'} (You)`,
        race: state.race || 'human',
        level: state.level || 1,
        rank: state.rank || '-',
        fighters: state.fighters || 0,
        land: state.land || 0,
        is_ai: false,
      });
    }
  }

  if (mapped.length === 0) {
    el.innerHTML =
      '<div style="color:var(--text3);font-size:13px;padding:20px;text-align:center">No mapped locations found.</div>';
    return;
  }

  el.innerHTML = mapped
    .map((t) => {
      const raceIcon = RACE_ICONS[t.race] || 'icon';
      const isSel =
        window.selectedTarget && String(window.selectedTarget.id) === String(t.id);
      const idValue =
        typeof t.id === 'string' && t.id.startsWith('loc_')
          ? `'${t.id}'`
          : t.id;

      return (
        '<div class="target-row' +
        (isSel ? ' selected' : '') +
        '" style="margin-bottom:4px" onclick="' +
        selectFn +
        '(' +
        idValue +
        ')">' +
        '<span style="font-size:18px;margin-right:10px">' +
        (t.is_location ? 'loc' : raceIcon) +
        '</span>' +
        '<div style="flex:1">' +
        '<div style="font-weight:600;color:var(--text)">' +
        escapeHtml(t.name) +
        (t.is_ai ? ' (AI)' : '') +
        '</div>' +
        '<div style="font-size:10px;color:var(--text3)">' +
        (t.is_location
          ? 'Discovered Site'
          : 'Lv ' + t.level + ' - ' + (t.race || '').replace('_', ' ')) +
        '</div>' +
        '</div>' +
        '<div style="text-align:right">' +
        '<div style="font-size:12px;color:var(--gold);font-weight:600">' +
        (t.is_location ? '???' : fmt(t.land)) +
        ' ac</div>' +
        '<div style="font-size:10px;color:var(--text3)">#' +
        (t.rank || '?') +
        '</div>' +
        '</div>' +
        '</div>'
      );
    })
    .join('');
}
