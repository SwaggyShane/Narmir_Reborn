import React, { useCallback, useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { apiCall } from '../../utils/api';
import { useGameState, useGameMutationEvents } from '../../hooks/useGameState';
import { applyGameMutation } from '../../utils/gameMutations.js';
import { syncUI } from '../../utils/shellBridge.js';
import { gameStateManager } from '../../GameStateManager.js';
import { fmt } from '../../utils/fmt.js';
import { fmtShort } from '../../utils/numberFormat.js';
import { toast } from '../../utils/toast.js';
import { playGameSound } from '../../utils/audio.js';
import { FARM_WORKERS_PER, COMMODITY_VALUES, COMMODITY_RACE_DISCOUNT } from '../../utils/economyConstants.js';
import UpgradesList from './UpgradesList.jsx';
import {
  FARM_UPGRADES,
  GRANARY_UPGRADES,
  MARKET_UPGRADES,
  TAVERN_UPGRADES,
} from '../../utils/economyUpgrades.js';

function getState() {
  return gameStateManager.getState();
}

function escapeHtmlValue(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[ch]);
}

// Kept for DefensePanel which imports this directly.
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
        ' - ' +
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

// Kept on window.buyUpgrade via main.js.
export async function buyUpgrade(category, key) {
  const endpoint = category === 'mausoleum'
    ? '/api/kingdom/buy-mausoleum-upgrade'
    : '/api/kingdom/economy/upgrade';

  const result = await apiCall(endpoint, {
    method: 'POST',
    body: { category, upgradeKey: key },
  });

  if (result.error) return toast(result.error, 'error');

  playGameSound('upgrade_purchased');

  if (result.updates) {
    applyGameMutation(result, { reason: 'economy-upgrade' });
  }

  syncUI();
  toast('Upgrade purchased! Refresh the panel to see the next upgrade.', 'success');
}

const MERC_COST = { rabble: 50, sellsword: 125, veteran: 250, elite: 500 };
const MERC_TURNS = { rabble: 10, sellsword: 25, veteran: 35, elite: 50 };

const COMMODITY_ITEMS = ['food', 'weapons', 'armor', 'mana', 'maps', 'blueprints', 'war_machines', 'ballistae', 'land'];

const EconomyPanel = () => {
  const { state } = useGameState();
  const [activeTab, setActiveTab] = useState('farms');

  const [econData, setEconData] = useState(null);
  const [receivedOffers, setReceivedOffers] = useState([]);
  const [sentOffers, setSentOffers] = useState([]);
  const [tradeRoutes, setTradeRoutes] = useState([]);

  const [taxValue, setTaxValue] = useState(state?.tax ?? 42);
  const [tradeOfferItem, setTradeOfferItem] = useState('food');
  const [tradeOfferQty, setTradeOfferQty] = useState('');
  const [tradeRequestItem, setTradeRequestItem] = useState('gold');
  const [tradeRequestQty, setTradeRequestQty] = useState('');
  const [tradeTargetId, setTradeTargetId] = useState('');
  const [mercUnit, setMercUnit] = useState('fighters');
  const [mercTier, setMercTier] = useState('rabble');
  const [mercCount, setMercCount] = useState('');
  const [bankAmount, setBankAmount] = useState('');
  const [bankTermIndex, setBankTermIndex] = useState('0');
  const [tradeRouteTargetId, setTradeRouteTargetId] = useState('');

  const tradeTargets = useMemo(
    () => (Array.isArray(state?.targets) ? state.targets : []),
    [state?.targets],
  );

  const mercPreview = useMemo(() => {
    const price = MERC_COST[mercTier] || 50;
    const turns = MERC_TURNS[mercTier] || 10;
    const count = Number(mercCount) || 0;
    const total = price * count;
    return `${fmtShort(total)} GC - ${turns} turns - ${count > 0 ? `${count} ${mercUnit}` : 'select a contract size'}`;
  }, [mercTier, mercCount, mercUnit]);

  const tradeLocked = !econData?.market_upgrades?.trading_post;

  const loadEconData = useCallback(async () => {
    const data = await apiCall('/api/kingdom/economy/overview');
    if (data?.error) return;
    setEconData(data);
    if (data.tax != null) setTaxValue(data.tax);
  }, []);

  const loadTradeOffers = useCallback(async () => {
    const result = await apiCall('/api/kingdom/economy/trade/list');
    if (result?.error) { toast(result.error, 'error'); return; }
    setReceivedOffers(result.received || []);
    setSentOffers(result.sent || []);
  }, []);

  const loadTradeRoutes = useCallback(async () => {
    const res = await apiCall('/api/kingdom/trade-routes/list');
    if (res?.error) { toast(`Failed to load trade routes: ${res.error}`, 'error'); return; }
    setTradeRoutes(res.routes || []);
  }, []);

  useEffect(() => { loadEconData(); }, [loadEconData]);

  useEffect(() => {
    if (activeTab === 'markets') loadTradeOffers();
    else if (activeTab === 'trade-routes') loadTradeRoutes();
  }, [activeTab, loadTradeOffers, loadTradeRoutes]);

  useGameMutationEvents(useCallback((event) => {
    const reason = String(event?.reason || '');
    if (['turn', 'economy-upgrade', 'hire-mercs', 'bank-deposit', 'kingdom-refresh', 'mutation'].includes(reason)) {
      loadEconData();
    }
    if (['accept-trade', 'decline-trade'].includes(reason)) {
      loadTradeOffers();
    }
  }, [loadEconData, loadTradeOffers]));

  const handleLockTax = useCallback(async () => {
    const tax = Number(taxValue);
    if (Number.isNaN(tax)) return;
    try {
      const result = await apiCall('/api/kingdom/options', { method: 'POST', body: { tax } });
      if (result.error) { toast(result.error, 'error'); return; }
      applyGameMutation(result, { reason: 'tax-update' });
      toast('Tax rate locked', 'success');
    } catch (err) {
      console.error('[tax] lock failed:', err);
      toast('Failed to save tax rate', 'error');
    }
  }, [taxValue]);

  const handleSendTradeOffer = useCallback(async () => {
    if (!tradeTargetId) return toast('Select a target kingdom', 'error');
    const oQty = parseInt(tradeOfferQty, 10) || 0;
    const rQty = parseInt(tradeRequestQty, 10) || 0;
    if (oQty <= 0 || rQty <= 0) { toast('Enter quantities', 'error'); return; }
    const result = await apiCall('/api/kingdom/economy/trade/send', {
      method: 'POST',
      body: { targetId: tradeTargetId, offer: { [tradeOfferItem]: oQty }, request: { [tradeRequestItem]: rQty } },
    });
    if (result?.error) return toast(result.error, 'error');
    applyGameMutation(result, { reason: 'send-trade-offer' });
    syncUI();
    toast('Trade offer sent!', 'success');
    setTradeOfferQty('');
    setTradeRequestQty('');
    setTradeTargetId('');
    await loadTradeOffers();
  }, [tradeTargetId, tradeOfferItem, tradeOfferQty, tradeRequestItem, tradeRequestQty, loadTradeOffers]);

  const handleAcceptTrade = useCallback(async (offerId) => {
    const result = await apiCall('/api/kingdom/economy/trade/accept', { method: 'POST', body: { offerId } });
    if (result.error) return toast(result.error, 'error');
    applyGameMutation(result, { reason: 'accept-trade' });
    syncUI();
    toast('Trade accepted!', 'success');
    await loadTradeOffers();
  }, [loadTradeOffers]);

  const handleDeclineTrade = useCallback(async (offerId) => {
    const result = await apiCall('/api/kingdom/economy/trade/decline', { method: 'POST', body: { offerId } });
    if (result.error) return toast(result.error, 'error');
    toast('Trade declined.', 'info');
    await loadTradeOffers();
  }, [loadTradeOffers]);

  const handleClearTradeLogs = useCallback(async () => {
    if (!confirm('Clear all completed/expired trade logs?')) return;
    try {
      const res = await apiCall('/api/kingdom/trade/clear-logs', { method: 'POST' });
      if (res.error) { toast(res.error, 'error'); return; }
      toast('Trade logs cleared', 'success');
      await loadTradeOffers();
    } catch (err) {
      toast('Failed to clear logs', 'error');
    }
  }, [loadTradeOffers]);

  const handleHireMercs = useCallback(async () => {
    const count = Number(mercCount) || 0;
    if (count <= 0) { toast('Enter a valid mercenary count', 'error'); return; }
    try {
      const result = await apiCall('/api/kingdom/economy/hire-mercs', {
        method: 'POST',
        body: { unitType: mercUnit, tier: mercTier, count },
      });
      if (result.error) { toast(result.error, 'error'); return; }
      applyGameMutation(result, { reason: 'hire-mercs' });
      toast(`Hired ${result.hired?.count || count} mercenaries`, 'success');
      setMercCount('');
    } catch (err) {
      console.error('[economy] hire mercs failed:', err);
      toast('Failed to hire mercenaries', 'error');
    }
  }, [mercUnit, mercTier, mercCount]);

  const handleMakeBankDeposit = useCallback(async () => {
    const amount = Number(bankAmount) || 0;
    if (amount <= 0) { toast('Enter a valid deposit amount', 'error'); return; }
    try {
      const result = await apiCall('/api/kingdom/economy/bank-deposit', {
        method: 'POST',
        body: { amount, termIndex: Number(bankTermIndex) },
      });
      if (result.error) { toast(result.error, 'error'); return; }
      applyGameMutation(result, { reason: 'bank-deposit' });
      toast(result.message || 'Deposit successful', 'success');
      setBankAmount('');
    } catch (err) {
      console.error('[economy] bank deposit failed:', err);
      toast('Failed to create bank deposit', 'error');
    }
  }, [bankAmount, bankTermIndex]);

  const handleEstablishTradeRoute = useCallback(async () => {
    if (!tradeRouteTargetId) return;
    try {
      const result = await apiCall('/api/kingdom/trade-routes/establish', {
        method: 'POST',
        body: { targetId: tradeRouteTargetId },
      });
      if (result.error) { toast(result.error, 'error'); return; }
      applyGameMutation(result, { reason: 'establish-trade-route' });
      syncUI();
      toast(result.message || 'Trade route established', 'success');
      setTradeRouteTargetId('');
      await loadTradeRoutes();
    } catch (err) {
      console.error('[economy] establish trade route failed:', err);
      toast('Failed to establish trade route', 'error');
    }
  }, [tradeRouteTargetId, loadTradeRoutes]);

  const handleCancelTradeRoute = useCallback(async (routeId) => {
    try {
      const result = await apiCall('/api/kingdom/trade-routes/cancel', {
        method: 'POST',
        body: { routeId },
      });
      if (result.error) { toast(result.error, 'error'); return; }
      toast('Trade route cancelled', 'success');
      await loadTradeRoutes();
    } catch (err) {
      console.error('[economy] cancel trade route failed:', err);
      toast('Failed to cancel trade route', 'error');
    }
  }, [loadTradeRoutes]);

  const setMaxTradeOfferQty = useCallback(() => {
    const val = Number(state?.[tradeOfferItem] || 0);
    setTradeOfferQty(String(Math.max(0, val)));
  }, [state, tradeOfferItem]);

  const setMaxMercCount = useCallback(() => {
    const price = MERC_COST[mercTier] || 50;
    const max = Math.floor(Number(state?.gold || 0) / price);
    setMercCount(String(Math.max(0, max)));
  }, [state, mercTier]);

  const race = state?.race || 'human';
  const racDisc = COMMODITY_RACE_DISCOUNT[race] || {};
  const wpf = FARM_WORKERS_PER[race] || 10;

  const bal = (econData?.farmProduction || 0) - (econData?.foodConsumption || 0);
  const dt = econData?.foodDegradeTurns;
  const dtLabel = dt == null ? '—' : (dt === Infinity || dt > 1000 ? 'Stable / Growing' : `${dt} turns`);
  const dtColor = dt == null || dt === Infinity || dt > 100 ? 'var(--green)' : dt > 20 ? 'var(--accent1)' : 'var(--red)';

  return (
    <div id="economy" className="panel hidden">
      <div className="card flex-shrink-0">
        <div className="flex justify-between items-baseline">
          <div className="card-title">Tax policy</div>
          <div id="tax-metrics" className="text-[12px] text-[var(--text3)] flex gap-3">
            <span>Income: <strong id="econ-income" className="text-[var(--green)]">+0</strong></span>
            <span>Upkeep: <strong id="econ-upkeep" className="text-[var(--red)]">-0</strong></span>
            <span>Net: <strong id="econ-net" className="text-[var(--gold)]">0</strong></span>
          </div>
        </div>
        <div className="flex items-center gap-3.5 my-3 tax-slider-container">
          <input
            type="range"
            id="tax-slider"
            className="input flex-1 min-w-[120px]"
            min="1"
            max="100"
            step="1"
            value={taxValue}
            onChange={(e) => setTaxValue(Number(e.target.value))}
          />
          <span className="text-[22px] font-bold text-[var(--gold)] min-w-[48px]">{taxValue}</span>
        </div>
        <div className="flex gap-2 mb-2.5">
          <button
            className="base-btn variant-gold flex-1 p-2 bg-[var(--gold)] text-black"
            onClick={handleLockTax}
          >
            🔒 Lock changes
          </button>
        </div>
        <div className="text-[12px] text-[var(--text3)] leading-relaxed">
          Taxing your citizens directly affects their happiness. Tax them high and
          they will probably leave. Tax them low and they will rejoice. Net income
          is calculated per turn spent.
        </div>
      </div>

      {/* FINANCIAL LEDGER */}
      <div className="card flex-shrink-0">
        <div className="card-title mb-2">Financial Ledger</div>
        <div className="grid [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))] gap-4 text-[13px]">
          <div>
            <div className="font-bold text-[var(--green)] mb-1 border-b border-[var(--border)] pb-0.5">Income / Turn</div>
            <div className="flex justify-between"><span className="text-[var(--text3)]">Taxes</span><span id="ledger-tax" className="text-[var(--green)]">0</span></div>
            <div className="flex justify-between"><span className="text-[var(--text3)]">Markets</span><span id="ledger-markets" className="text-[var(--green)]">0</span></div>
            <div className="flex justify-between"><span className="text-[var(--text3)]">Trade Routes</span><span id="ledger-trade" className="text-[var(--green)]">0</span></div>
            <div className="flex justify-between font-bold border-t border-[var(--border)] mt-1 pt-0.5">
              <span className="text-text2">Total Income</span><span id="ledger-income-total" className="text-[var(--green)]">0</span>
            </div>
          </div>
          <div>
            <div className="font-bold text-[var(--red)] mb-1 border-b border-[var(--border)] pb-0.5">Expenses / Turn</div>
            <div className="flex justify-between"><span className="text-[var(--text3)]">Troop Upkeep</span><span id="ledger-upkeep" className="text-[var(--red)]">0</span></div>
            <div className="flex justify-between font-bold border-t border-[var(--border)] mt-1 pt-0.5">
              <span className="text-text2">Total Expenses</span><span id="ledger-expense-total" className="text-[var(--red)]">0</span>
            </div>
          </div>
        </div>
        <div className="mt-2 text-center font-bold p-1 bg-bg2 rounded-sm">
          Net Balance: <span id="ledger-net">0</span>
        </div>
      </div>

      {/* Tab nav */}
      <div className="flex flex-wrap gap-1 mb-4 border-b-2 border-[var(--border2)] pb-0">
        {[
          ['farms', '🌾 Farm'],
          ['granary', '🌾 Granary'],
          ['markets', '🏪 Market'],
          ['tavern', '🍺 Tavern'],
          ['bank', '🏦 Bank'],
          ['trade-routes', '🤝 Trade Routes'],
        ].map(([tab, label]) => (
          <button
            key={tab}
            className={clsx('base-btn admin-tab rounded-none', activeTab === tab && 'active')}
            onClick={() => setActiveTab(tab)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* FARMS TAB */}
      <div className={clsx(activeTab === 'farms' ? 'block' : 'hidden')}>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="card m-0">
            <div className="card-title mb-2.5">Farm overview</div>
            <div className="trow"><span className="name">Farms</span><span className="count">{fmt(state?.bld_farms || 0)}</span></div>
            <div className="trow"><span className="name">Worked farms</span><span className="count" style={{ color: 'var(--green)' }}>{fmt(econData?.workedFarms || 0)}</span></div>
            <div className="trow"><span className="name">Production</span><span className="count" style={{ color: 'var(--green)' }}>+{fmt(econData?.farmProduction || 0)}</span></div>
            <div className="trow"><span className="name">Consumption</span><span className="count" style={{ color: 'var(--red)' }}>-{fmt(econData?.foodConsumption || 0)}</span></div>
            <div className="trow" style={{ borderTop: '1px solid var(--border2)' }}>
              <span className="name">Balance</span>
              <span className="count" style={{ fontWeight: 700, color: bal >= 0 ? 'var(--green)' : 'var(--red)' }}>
                {(bal >= 0 ? '+' : '') + fmt(bal)}
              </span>
            </div>
            <div className="trow"><span className="name">Shortage turns</span><span className="count">{econData?.food_shortage_turns || 0}</span></div>
          </div>
          <div className="card" style={{ margin: 0 }}>
            <div className="card-title" style={{ marginBottom: '10px' }}>Farm upgrades</div>
            <div style={{ fontSize: '12px', color: 'var(--text3)', marginBottom: '12px' }}>
              Instant gold purchase — applies to all farms.
            </div>
            <UpgradesList category="farm" defs={FARM_UPGRADES} owned={econData?.farm_upgrades || {}} state={state || {}} />
          </div>
        </div>
        <div className="card">
          <div className="card-title" style={{ marginBottom: '8px' }}>Food rules</div>
          <div style={{ fontSize: '12px', color: 'var(--text3)', lineHeight: 1.9 }}>
            Each farm needs <strong style={{ color: 'var(--text)' }}>{wpf}</strong> free population to work it. Unworked farms produce nothing.<br />
            Shortage grace: <strong style={{ color: 'var(--amber)' }}>2 turns</strong> → happiness penalty → population flight → desertion.
          </div>
        </div>
      </div>

      {/* GRANARY TAB */}
      <div className={clsx(activeTab === 'granary' ? 'block' : 'hidden')}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
          <div className="card" style={{ margin: 0 }}>
            <div className="card-title" style={{ marginBottom: '10px' }}>Storage overview</div>
            <div className="trow"><span className="name">Food stored</span><span className="count">{fmt(state?.food || 0)} bushels</span></div>
            <div className="trow"><span className="name">Max storage</span><span className="count">{fmt(econData?.maxFoodStorage || 0)} bushels</span></div>
            <div className="trow" style={{ borderTop: '1px solid var(--border2)' }}>
              <span className="name">Spoilage / turn</span>
              <span className="count" style={{ color: 'var(--red)' }}>
                {fmt(econData?.foodSpoilageAmount || 0)} ({((econData?.foodSpoilageRate || 0) * 100).toFixed(1)}%)
              </span>
            </div>
            <div className="trow"><span className="name">Time to degrade</span><span className="count" style={{ color: dtColor }}>{dtLabel}</span></div>
          </div>
          <div className="card" style={{ margin: 0 }}>
            <div className="card-title" style={{ marginBottom: '10px' }}>Granary upgrades</div>
            <div style={{ fontSize: '12px', color: 'var(--text3)', marginBottom: '12px' }}>
              Enhances granaries to store more food and reduce rot.
            </div>
            <UpgradesList category="granary" defs={GRANARY_UPGRADES} owned={econData?.granary_upgrades || {}} state={state || {}} />
          </div>
        </div>
        <div className="card">
          <div className="card-title" style={{ marginBottom: '8px' }}>Storage rules</div>
          <div style={{ fontSize: '12px', color: 'var(--text3)', lineHeight: 1.9 }}>
            Food cannot be stored indefinitely and decays every turn based on the
            current spoilage rate. Upgrades can lower this rate and improve the
            base amount of food you can securely store per granary. Baseline
            storage without granaries has been removed.
          </div>
        </div>
      </div>

      {/* MARKETS TAB */}
      <div className={clsx(activeTab === 'markets' ? 'block' : 'hidden')}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
          <div className="card" style={{ margin: 0 }}>
            <div className="card-title" style={{ marginBottom: '10px' }}>Market overview</div>
            <div className="trow"><span className="name">Markets</span><span className="count">{fmt(state?.bld_markets || 0)}</span></div>
            <div className="trow"><span className="name">Market income/turn</span><span className="count" style={{ color: 'var(--gold)' }}>{fmt(econData?.marketIncome || 0)} GC</span></div>
            <div className="trow"><span className="name">Trade routes</span><span className="count">{fmt(econData?.activeTradeRouteCount || 0)}</span></div>
            <div className="trow">
              <span className="name">Trading unlocked</span>
              <span className="count" style={{ color: tradeLocked ? 'var(--red)' : 'var(--green)' }}>
                {tradeLocked ? 'No' : 'Yes'}
              </span>
            </div>
          </div>
          <div className="card" style={{ margin: 0 }}>
            <div className="card-title" style={{ marginBottom: '10px' }}>Market upgrades</div>
            <UpgradesList category="market" defs={MARKET_UPGRADES} owned={econData?.market_upgrades || {}} state={state || {}} />
          </div>
        </div>

        {/* Commodity market */}
        <div className="card" id="commodity-market-card">
          <div className="card-title" style={{ marginBottom: '8px' }}>📦 Commodity market</div>
          <div style={{ fontSize: '12px', color: 'var(--text3)', marginBottom: '12px' }}>
            Base prices - your race modifiers applied - prices fluctuate by supply
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 60px', gap: '4px', padding: '4px 0', borderBottom: '1px solid var(--border2)' }}>
            <span style={{ fontSize: '10px', color: 'var(--text3)', textTransform: 'uppercase' }}>Item</span>
            <span style={{ fontSize: '10px', color: 'var(--text3)', textTransform: 'uppercase', textAlign: 'right' }}>Base</span>
            <span style={{ fontSize: '10px', color: 'var(--text3)', textTransform: 'uppercase', textAlign: 'right' }}>Your price</span>
          </div>
          {COMMODITY_ITEMS.map((item) => {
            const base = COMMODITY_VALUES[item] || 1;
            const disc = racDisc[item] || racDisc._all || 1.0;
            const yours = Math.max(1, Math.round(base * disc));
            return (
              <div key={item} style={{ display: 'grid', gridTemplateColumns: '1fr 60px 60px', gap: '4px', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: '13px', color: 'var(--text)' }}>{item.charAt(0).toUpperCase() + item.slice(1)}</span>
                <span style={{ fontSize: '13px', textAlign: 'right', color: 'var(--text3)' }}>{base} GC</span>
                <span style={{ fontSize: '13px', textAlign: 'right', color: 'var(--gold)', fontWeight: 600 }}>
                  {yours} GC{yours < base ? ' ↓' : yours > base ? ' ↑' : ''}
                </span>
              </div>
            );
          })}
        </div>

        {/* Trade offers */}
        <div className="card" id="trade-offers-card">
          <div className="card-title" style={{ marginBottom: '8px' }}>🤝 Trade offers</div>
          {tradeLocked ? (
            <div style={{ fontSize: '13px', color: 'var(--text3)' }}>
              Build a <strong>Trading Post</strong> to send and receive trade offers.
            </div>
          ) : (
            <div>
              <div style={{ marginBottom: '14px' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text2)', marginBottom: '8px' }}>Send a trade offer</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '10px' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text3)', marginBottom: '4px' }}>I offer</div>
                    <select className="input" style={{ width: '100%', marginBottom: '6px' }} value={tradeOfferItem} onChange={(e) => setTradeOfferItem(e.target.value)}>
                      <option value="food">Food</option>
                      <option value="gold">Gold</option>
                      <option value="mana">Mana</option>
                      <option value="weapons">Weapons</option>
                      <option value="armor">Armor</option>
                      <option value="maps">Maps</option>
                    </select>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <input type="number" className="input" min="1" value={tradeOfferQty} onChange={(e) => setTradeOfferQty(e.target.value)} style={{ textAlign: 'right', width: '100%', flex: 1 }} placeholder="Qty" />
                      <button className="base-btn" style={{ fontSize: '10px', padding: '3px 6px' }} onClick={setMaxTradeOfferQty}>Max</button>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text3)', marginBottom: '4px' }}>I want</div>
                    <select className="input" style={{ width: '100%', marginBottom: '6px' }} value={tradeRequestItem} onChange={(e) => setTradeRequestItem(e.target.value)}>
                      <option value="gold">Gold</option>
                      <option value="food">Food</option>
                      <option value="mana">Mana</option>
                      <option value="weapons">Weapons</option>
                      <option value="armor">Armor</option>
                      <option value="maps">Maps</option>
                    </select>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <input type="number" className="input" min="1" value={tradeRequestQty} onChange={(e) => setTradeRequestQty(e.target.value)} style={{ textAlign: 'right', width: '100%', flex: 1 }} placeholder="Qty" />
                    </div>
                  </div>
                </div>
                <select className="input" style={{ width: '100%', marginBottom: '8px' }} value={tradeTargetId} onChange={(e) => setTradeTargetId(e.target.value)}>
                  <option value="">— select kingdom —</option>
                  {tradeTargets.map((t) => (
                    <option key={t.id || t.kingdom_id} value={t.id || t.kingdom_id}>{t.name || t.kingdom_name}</option>
                  ))}
                </select>
                <button className="base-btn variant-green w-full" style={{ background: 'var(--green)', color: '#000', width: '100%' }} onClick={handleSendTradeOffer}>
                  📦 Send trade offer
                </button>
              </div>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text2)', marginBottom: '6px' }}>Incoming offers</div>
                {receivedOffers.length === 0 ? (
                  <div style={{ color: 'var(--text3)', fontSize: '13px' }}>No pending offers.</div>
                ) : receivedOffers.map((o) => {
                  const offer = typeof o.offer === 'string' ? JSON.parse(o.offer) : (o.offer || {});
                  const request = typeof o.request === 'string' ? JSON.parse(o.request) : (o.request || {});
                  const offerStr = Object.entries(offer).map(([item, qty]) => `${qty} ${item}`).join(', ');
                  const requestStr = Object.entries(request).map(([item, qty]) => `${qty} ${item}`).join(', ');
                  return (
                    <div key={o.id} style={{ background: 'var(--bg3)', borderRadius: 'var(--radius)', padding: '10px', marginBottom: '8px' }}>
                      <div style={{ fontSize: '13px', color: 'var(--text)', marginBottom: '4px' }}>
                        <strong>{o.sender_name}</strong> offers{' '}
                        <span style={{ color: 'var(--green)' }}>{offerStr}</span> for{' '}
                        <span style={{ color: 'var(--amber)' }}>{requestStr}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                        <button className="btn btn-green" style={{ fontSize: '11px', padding: '3px 10px' }} onClick={() => handleAcceptTrade(o.id)}>✅ Accept</button>
                        <button className="btn btn-red" style={{ fontSize: '11px', padding: '3px 10px' }} onClick={() => handleDeclineTrade(o.id)}>❌ Decline</button>
                      </div>
                    </div>
                  );
                })}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '12px 0 6px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text2)' }}>Sent offers</div>
                  <button className="base-btn variant-red" style={{ fontSize: '10px', padding: '2px 8px', background: 'var(--red)' }} onClick={handleClearTradeLogs}>Clear Logs</button>
                </div>
                {sentOffers.length === 0 ? (
                  <div style={{ color: 'var(--text3)', fontSize: '13px' }}>No sent offers.</div>
                ) : sentOffers.map((o) => {
                  const offer = typeof o.offer === 'string' ? JSON.parse(o.offer) : (o.offer || {});
                  const request = typeof o.request === 'string' ? JSON.parse(o.request) : (o.request || {});
                  const offerStr = Object.entries(offer).map(([item, qty]) => `${qty} ${item}`).join(', ');
                  const requestStr = Object.entries(request).map(([item, qty]) => `${qty} ${item}`).join(', ');
                  const statusColor = o.status === 'accepted' ? 'var(--green)' : o.status === 'declined' ? 'var(--red)' : 'var(--amber)';
                  return (
                    <div key={o.id} style={{ fontSize: '12px', color: 'var(--text3)', padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
                      To <strong style={{ color: 'var(--text)' }}>{o.receiver_name}</strong>: {offerStr} for {requestStr}{' '}
                      <span style={{ color: statusColor }}>[{o.status}]</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* TAVERN TAB */}
      <div className={clsx(activeTab === 'tavern' ? 'block' : 'hidden')}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
          <div className="card" style={{ margin: 0 }}>
            <div className="card-title" style={{ marginBottom: '10px' }}>Tavern overview</div>
            <div className="trow"><span className="name">Taverns</span><span className="count">{fmt(state?.bld_taverns || 0)}</span></div>
          </div>
          <div className="card" style={{ margin: 0 }}>
            <div className="card-title" style={{ marginBottom: '10px' }}>Tavern upgrades</div>
            <UpgradesList category="tavern" defs={TAVERN_UPGRADES} owned={econData?.tavern_upgrades || {}} state={state || {}} />
          </div>
        </div>

        <div className="card">
          <div className="card-title" style={{ marginBottom: '8px' }}>⚔️ Mercenary board</div>
          <div style={{ fontSize: '12px', color: 'var(--text3)', marginBottom: '14px' }}>
            Mercenaries fight at a fixed level. They do not advance, do not use
            your weapon/armor stockpile, and leave when their contract expires.
            They count toward anti-bully ratios.
          </div>
          <div className="merc-board-grid" style={{ marginBottom: '12px' }}>
            <select className="input" style={{ fontSize: '12px' }} value={mercUnit} onChange={(e) => setMercUnit(e.target.value)}>
              <option value="fighters">Fighters</option>
              <option value="rangers">Rangers</option>
              <option value="mages">Mages</option>
              <option value="clerics">Clerics</option>
              <option value="thieves">Thieves</option>
              <option value="ninjas">Ninjas</option>
            </select>
            <select className="input" style={{ fontSize: '12px' }} value={mercTier} onChange={(e) => setMercTier(e.target.value)}>
              <option value="rabble">Rabble (Lv 5–10)</option>
              <option value="sellsword">Sellsword (Lv 15–25)</option>
              <option value="veteran">Veteran (Lv 30–45)</option>
              <option value="elite">Elite (Lv 50–65)</option>
            </select>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <input type="number" className="input" min="1" value={mercCount} onChange={(e) => setMercCount(e.target.value)} style={{ textAlign: 'right', width: '100%', flex: 1 }} placeholder="Qty" />
              <button className="base-btn" style={{ fontSize: '10px', padding: '3px 6px' }} onClick={setMaxMercCount}>Max</button>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text3)' }}>{mercPreview}</div>
            <div className="merc-btn-col">
              <button className="base-btn variant-amber w-full" style={{ background: '#d97706', color: '#fff', width: '100%' }} onClick={handleHireMercs}>Hire</button>
            </div>
          </div>
          {!econData?.mercenaries?.length ? (
            <div style={{ color: 'var(--text3)', fontSize: '13px', textAlign: 'center', padding: '12px' }}>
              No mercenaries under contract.
            </div>
          ) : econData.mercenaries.map((m, i) => {
            const served = (state?.turn || 0) - (m.hired_at_turn || 0);
            const remaining = Math.max(0, m.duration_turns - served);
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', color: 'var(--text)', fontWeight: 600 }}>{m.count} {m.tier} {m.unit_type}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text3)' }}>Remaining: {remaining} turns</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* BANK TAB */}
      <div className={clsx(activeTab === 'bank' ? 'block' : 'hidden')}>
        <div id="bank-locked-msg" style={{ display: (state?.bld_vaults || 0) >= 25 ? 'none' : 'block', padding: '24px', textAlign: 'center', color: 'var(--text2)', background: 'var(--bg2)', borderRadius: '8px' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>🏦</div>
          <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '8px' }}>Bank Locked</div>
          <div style={{ fontSize: '14px' }}>Construct at least 25 Vaults to access the Royal Bank.</div>
        </div>
        <div id="bank-content" style={{ display: (state?.bld_vaults || 0) >= 25 ? 'block' : 'none' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div className="card" style={{ margin: 0 }}>
              <div className="card-title">Fixed-Term Deposits</div>
              <div style={{ color: 'var(--text3)', fontSize: '12px', marginBottom: '12px' }}>
                Deposit your gold to earn a guaranteed return over time. You cannot withdraw early.
              </div>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                <input type="number" className="input" placeholder="Amount" min="1" style={{ flex: 1 }} value={bankAmount} onChange={(e) => setBankAmount(e.target.value)} />
                <select className="input" style={{ flex: 1 }} value={bankTermIndex} onChange={(e) => setBankTermIndex(e.target.value)}>
                  <option value="0">10 Turns (2% yield)</option>
                  <option value="1">25 Turns (7% yield)</option>
                  <option value="2">50 Turns (15% yield)</option>
                  <option value="3">150 Turns (25% yield)</option>
                  <option value="4">300 Turns (60% yield)</option>
                </select>
              </div>
              <button className="base-btn variant-gold w-full" style={{ background: 'var(--gold)', color: '#000', width: '100%' }} onClick={handleMakeBankDeposit}>
                Deposit Gold
              </button>
            </div>
            <div className="card" style={{ margin: 0 }}>
              <div className="card-title">Bank Upgrades</div>
              <div id="bank-upgrades-list"></div>
            </div>
          </div>
          <div className="card" style={{ margin: 0 }}>
            <div className="card-title">Active Deposits</div>
            <div id="bank-deposits-list"></div>
          </div>
        </div>
      </div>

      {/* TRADE ROUTES TAB */}
      <div className={clsx(activeTab === 'trade-routes' ? 'block' : 'hidden')}>
        <div className="card" style={{ marginTop: 0, marginBottom: '20px' }}>
          <div className="card-title">Establish New Route</div>
          <div style={{ fontSize: '12px', color: 'var(--text3)', marginBottom: '12px' }}>
            Requires: 10,000 GC. Permanent routes provide steady income and improve with stability.
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <select className="input" style={{ flex: 1 }} value={tradeRouteTargetId} onChange={(e) => setTradeRouteTargetId(e.target.value)}>
              <option value="">— Select Target Kingdom —</option>
              {tradeTargets.map((t) => (
                <option key={t.id || t.kingdom_id} value={t.id || t.kingdom_id}>{t.name || t.kingdom_name}</option>
              ))}
            </select>
            <button className="base-btn variant-gold" style={{ background: 'var(--gold)', color: '#000' }} onClick={handleEstablishTradeRoute}>
              Establish 🤝
            </button>
          </div>
        </div>
        <div className="card" style={{ marginTop: 0 }}>
          <div className="card-title">Active Trade Routes</div>
          <div style={{ fontSize: '12px', color: 'var(--text3)', marginBottom: '16px' }}>
            Established connections with other kingdoms provide steady gold income each turn. Stability increases over time, improving efficiency.
          </div>
          {tradeRoutes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text3)' }}>
              No active trade routes. Discover other kingdoms and establish routes to earn gold!
            </div>
          ) : tradeRoutes.map((r) => (
            <div key={r.id} className="card" style={{ marginBottom: '8px', border: '1px solid var(--border1)', padding: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--gold)' }}>🤝 {r.partner_name}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text3)' }}>{String(r.partner_race || 'unknown').replace(/_/g, ' ')} - {fmtShort(r.partner_land)} acres</div>
                </div>
                <div style={{ textAlign: 'right', margin: '0 16px' }}>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--green)' }}>+{fmtShort(Math.floor((r.stability || 0) * 2.5))} GC / turn</div>
                  <div style={{ fontSize: '10px', color: 'var(--text3)' }}>Stability: {r.stability}%</div>
                </div>
                <button className="btn btn-red" style={{ fontSize: '11px', padding: '4px 8px' }} onClick={() => handleCancelTradeRoute(r.id)}>Cancel</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @media (min-width: 768px) {
          .tax-slider-container { max-width: 600px; }
        }
      `}</style>
    </div>
  );
};

export default EconomyPanel;
