import { gameStateManager } from '../GameStateManager.js';
import { fmt } from '../utils/fmt.js';

function getState() {
  return window.state || gameStateManager.getState();
}

export function renderUpgrades(category, defs, owned, containerId) {
  const el = document.getElementById(containerId);
  if (!el) {
    console.warn('renderUpgrades: Container not found: ' + containerId);
    return;
  }

  if (!defs || typeof defs !== 'object') {
    console.error('renderUpgrades: Invalid defs for ' + category);
    el.innerHTML = '<div style="color:var(--red);font-size:12px">Error loading upgrade data</div>';
    return;
  }

  console.log('Rendering upgrades for ' + category, { defs, owned });

  const state = getState();
  const entries = Object.entries(defs);
  if (entries.length === 0) {
    el.innerHTML = '<div style="color:var(--text3);font-size:12px;padding:8px 0">No upgrades available in this category.</div>';
    return;
  }

  el.innerHTML = entries
    .map((e) => {
      const key = e[0];
      const def = e[1];
      const have = !!owned[key];
      const hasReq = !def.requires || !!owned[def.requires];
      const raceOk = !def.raceOnly || state.race === def.raceOnly;
      const canBuy =
        !have && hasReq && raceOk &&
        (state.gold || 0) >= (def.cost || 0) &&
        (state.wood || 0) >= (def.costWood || 0) &&
        (state.stone || 0) >= (def.costStone || 0) &&
        (state.iron || 0) >= (def.costIron || 0);

      const statusBadge = have
        ? '<span style="color:var(--green);font-size:11px">✅ Owned</span>'
        : !hasReq
          ? '<span style="color:var(--text3);font-size:11px">🔒 Need ' + String(def.requires || '').replace(/_/g, ' ') + '</span>'
          : !raceOk
            ? '<span style="color:var(--text3);font-size:11px">🔒 Race locked</span>'
            : '';

      let costStr = fmt(def.cost) + ' GC';
      const extraCosts = [];
      if (def.costWood > 0) extraCosts.push(fmt(def.costWood) + ' wood');
      if (def.costStone > 0) extraCosts.push(fmt(def.costStone) + ' stone');
      if (def.costIron > 0) extraCosts.push(fmt(def.costIron) + ' iron');
      if (extraCosts.length > 0) costStr += ' + ' + extraCosts.join(', ');

      return (
        '<div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--border)">' +
        '<div style="flex:1"><div style="font-size:13px;color:var(--text);font-weight:600">' +
        def.name +
        '</div>' +
        '<div style="font-size:11px;color:var(--text3)">' +
        def.desc +
        ' · ' +
        costStr +
        '</div></div>' +
        statusBadge +
        (!have && hasReq && raceOk
          ? '<button class="btn btn-gold" style="font-size:11px;padding:3px 10px;' +
            (!canBuy ? 'opacity:.5' : '') +
            `" onclick="buyUpgrade('${category}','${key}')" ` +
            (!canBuy ? 'disabled' : '') +
            '>Buy</button>'
          : '') +
        '</div>'
      );
    })
    .join('');
}
