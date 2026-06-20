import { gameStateManager } from '../GameStateManager.js';
import { apiCall } from '../utils/shellBridge.js';
import { fmt } from '../utils/fmt.js';
import { toast } from '../utils/toast.js';

function getState() {
  return window.state || gameStateManager.getState();
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[ch]);
}

function callIfAvailable(name, ...args) {
  const fn = typeof window !== 'undefined' ? window[name] : null;
  if (typeof fn === 'function') {
    return fn(...args);
  }
  return undefined;
}

export async function loadEconomy() {
  const state = getState();
  const data = await apiCall('GET', '/api/kingdom/economy/overview');

  if (data.error) return toast(data.error, 'error');

  console.log('loadEconomy data:', data);

  window.econData = data;

  const el = (id) => document.getElementById(id);

  if (el('econ-farms')) el('econ-farms').textContent = String(state.bld_farms || 0);
  if (el('econ-worked-farms')) el('econ-worked-farms').textContent = fmt(data.workedFarms || 0);
  if (el('econ-production')) el('econ-production').textContent = '+' + fmt(data.farmProduction || 0);
  if (el('econ-consumption')) el('econ-consumption').textContent = '-' + fmt(data.foodConsumption || 0);

  const bal = (data.farmProduction || 0) - (data.foodConsumption || 0);
  if (el('econ-balance')) {
    el('econ-balance').textContent = (bal >= 0 ? '+' : '') + fmt(bal);
    el('econ-balance').style.color = bal >= 0 ? 'var(--green)' : 'var(--red)';
  }

  if (el('econ-shortage')) el('econ-shortage').textContent = data.food_shortage_turns || 0;

  const wpf = (window.FARM_WORKERS_PER || {})[state.race] || 10;
  if (el('econ-workers-per-farm')) el('econ-workers-per-farm').textContent = wpf;

  if (el('gran-food-stored')) el('gran-food-stored').textContent = fmt(state.food || 0) + ' bushels';
  if (el('gran-max-storage')) el('gran-max-storage').textContent = fmt(data.maxFoodStorage || 0) + ' bushels';
  if (el('gran-spoilage')) {
    const pct = ((data.foodSpoilageRate || 0) * 100).toFixed(1);
    el('gran-spoilage').textContent = fmt(data.foodSpoilageAmount || 0) + ' (' + pct + '%)';
  }
  if (el('gran-degrade-time')) {
    const dt = data.foodDegradeTurns;
    el('gran-degrade-time').textContent = dt === Infinity || dt > 1000 ? 'Stable / Growing' : dt + ' turns';
    el('gran-degrade-time').style.color = dt === Infinity || dt > 100
      ? 'var(--green)'
      : dt > 20
        ? 'var(--accent1)'
        : 'var(--red)';
  }

  if (el('econ-markets')) el('econ-markets').textContent = fmt(state.bld_markets || 0);
  if (el('econ-market-income')) el('econ-market-income').textContent = fmt(data.marketIncome || 0) + ' GC';
  if (el('econ-trade-routes')) el('econ-trade-routes').textContent = fmt(data.activeTradeRouteCount || 0);

  const tradeLocked = !(data.market_upgrades || {}).trading_post;
  if (el('econ-trade-unlocked')) {
    el('econ-trade-unlocked').textContent = tradeLocked ? 'No' : 'Yes';
    el('econ-trade-unlocked').style.color = tradeLocked ? 'var(--red)' : 'var(--green)';
  }
  if (el('trade-locked-msg')) el('trade-locked-msg').style.display = tradeLocked ? 'block' : 'none';
  if (el('trade-panel')) el('trade-panel').style.display = tradeLocked ? 'none' : 'block';

  if (el('econ-taverns')) el('econ-taverns').textContent = fmt(state.bld_taverns || 0);
  if (el('econ-entertainment')) el('econ-entertainment').textContent = '+' + fmt(data.tavernBonus || 0) + '/turn';

  callIfAvailable('renderUpgrades', 'farm', window.FARM_UPGRADES, data.farm_upgrades || {}, 'farm-upgrade-list');
  callIfAvailable('renderUpgrades', 'granary', window.GRANARY_UPGRADES, data.granary_upgrades || {}, 'granary-page-upgrade-list');
  callIfAvailable('renderUpgrades', 'market', window.MARKET_UPGRADES, data.market_upgrades || {}, 'market-upgrade-list');
  callIfAvailable('renderUpgrades', 'tavern', window.TAVERN_UPGRADES, data.tavern_upgrades || {}, 'tavern-upgrade-list');

  callIfAvailable('renderCommodityMarket', data.market_upgrades || {});
  callIfAvailable('renderActiveMercs', data.mercenaries || []);
  callIfAvailable('populateTradeTargets');
}
