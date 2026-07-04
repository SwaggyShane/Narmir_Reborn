import React, { useCallback, useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { apiCall } from '../../utils/api';
import { useGameMutationEvents } from '../../hooks/useGameState';
import { applyGameMutation } from '../../utils/gameMutations.js';
import {
  useTax,
  useTradeTargets,
  useRace,
  useGold,
  useBuildCount,
  useFood,
  useWeaponsStockpile,
  useArmorStockpile,
  useBankUpgrades,
  useFarmUpgrades,
  useGranaryUpgrades,
  useMarketUpgrades,
  useTavernUpgrades,
  useKingdomId,
  useTurn,
  useWood,
  useStone,
  useIron,
  useMaps,
} from '../../stores';

import { fmt } from '../../utils/fmt.js';
import { fmtShort } from '../../utils/numberFormat.js';
import { toast } from '../../utils/toast.js';
import { FARM_WORKERS_PER, COMMODITY_VALUES, COMMODITY_RACE_DISCOUNT } from '../../utils/economyConstants.js';
import UpgradesList from './UpgradesList.jsx';
import {
  FARM_UPGRADES,
  GRANARY_UPGRADES,
  MARKET_UPGRADES,
  TAVERN_UPGRADES,
} from '../../utils/economyUpgrades.js';
import { BANK_UPGRADES } from '../../utils/studiesUpgrades.js';
import { parseOwnedUpgrades } from '../../utils/upgradeUtils.js';

const MERC_COST = { rabble: 50, sellsword: 125, veteran: 250, elite: 500 };
const MERC_TURNS = { rabble: 10, sellsword: 25, veteran: 35, elite: 50 };

const COMMODITY_ITEMS = ['food', 'weapons', 'armor', 'mana', 'maps', 'blueprints', 'war_machines', 'ballistae', 'land'];
const COMMODITY_GRID_CLASS = 'grid grid-cols-[1fr_60px_60px] gap-1';
const COMMODITY_HEADER_CELL_CLASS = 'text-[10px] uppercase text-[var(--text3)]';
const COMMODITY_VALUE_CLASS = 'text-right text-[13px]';
const TRADE_LABEL_CLASS = 'mb-1 text-[11px] text-[var(--text3)]';
const TRADE_TWO_COL_CLASS = 'mb-2.5 grid grid-cols-2 gap-3';
const TRADE_INPUT_ROW_CLASS = 'flex items-center gap-1';
const TRADE_MAX_BUTTON_CLASS = 'base-btn px-1.5 py-[3px] text-[10px]';
const TRADE_STATUS_HEADING_CLASS = 'mb-1.5 text-[12px] font-bold text-[var(--text2)]';
const TRADE_CARD_CLASS = 'mb-2 rounded-[var(--radius)] bg-[var(--bg3)] p-2.5';
const TRADE_ACTION_ROW_CLASS = 'mt-1.5 flex gap-1.5';
const TRADE_ACTION_BUTTON_CLASS = 'px-2.5 py-[3px] text-[11px]';
const TWO_COL_PANEL_CLASS = 'mb-4 grid grid-cols-2 gap-3';
const PANEL_COPY_CLASS = 'mb-3.5 text-[12px] text-[var(--text3)]';
const INPUT_ROW_CLASS = 'flex items-center gap-1';
const MAX_BUTTON_CLASS = 'base-btn px-1.5 py-[3px] text-[10px]';
const PRIMARY_GOLD_BUTTON_CLASS = 'base-btn variant-gold text-black bg-[var(--gold)]';
const RELAXED_COPY_CLASS = 'text-[12px] leading-[1.9] text-[var(--text3)]';
const BANK_LOCKED_PANEL_CLASS = 'rounded-[8px] bg-[var(--bg2)] p-6 text-center text-[var(--text2)]';

const EconomyPanel = () => {
  const [activeTab, setActiveTab] = useState('farms');
  const tax = useTax();
  const tradeTargets = useTradeTargets();
  const race = useRace();
  const kingdomId = useKingdomId();
  const gold = useGold();
  const turn = useTurn();
  const wood = useWood();
  const stone = useStone();
  const iron = useIron();
  const maps = useMaps();
  const vaults = useBuildCount('vaults');
  const food = useFood();
  const weaponsStockpile = useWeaponsStockpile();
  const armorStockpile = useArmorStockpile();
  const bldFarms = useBuildCount('farms');
  const bldMarkets = useBuildCount('markets');
  const bldTaverns = useBuildCount('taverns');
  const bankUpgrades = useBankUpgrades();
  const farmUpgrades = useFarmUpgrades();
  const granaryUpgrades = useGranaryUpgrades();
  const marketUpgrades = useMarketUpgrades();
  const tavernUpgrades = useTavernUpgrades();

  const [econData, setEconData] = useState(null);
  const [receivedOffers, setReceivedOffers] = useState([]);
  const [sentOffers, setSentOffers] = useState([]);
  const [tradeRoutes, setTradeRoutes] = useState([]);

  const [taxValue, setTaxValue] = useState(tax);
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


  const mercPreview = useMemo(() => {
    const price = MERC_COST[mercTier] || 50;
    const turns = MERC_TURNS[mercTier] || 10;
    const count = Number(mercCount) || 0;
    const total = price * count;
    return `${fmtShort(total)} GC - ${turns} turns - ${count > 0 ? `${count} ${mercUnit}` : 'select a contract size'}`;
  }, [mercTier, mercCount, mercUnit]);

  const tradeLocked = !econData?.market_upgrades?.trading_post;

  const syncUpgradeOwned = useCallback((category, nextOwned) => {
    const key = `${category}_upgrades`;
    setEconData((prev) => (prev ? { ...prev, [key]: nextOwned } : prev));
  }, []);

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
    if (tax != null) setTaxValue(tax);
  }, [tax]);

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
    let val = 0;
    if (tradeOfferItem === 'weapons') {
      val = weaponsStockpile;
    } else if (tradeOfferItem === 'armor') {
      val = armorStockpile;
    } else if (tradeOfferItem === 'gold') {
      val = gold;
    } else if (tradeOfferItem === 'food') {
      val = food;
    } else {
      const resourceMap = {
        wood,
        stone,
        iron,
        maps,
      };
      val = Number(resourceMap[tradeOfferItem] || 0);
    }
    setTradeOfferQty(String(Math.max(0, val)));
  }, [tradeOfferItem, weaponsStockpile, armorStockpile, gold, food, wood, stone, iron, maps]);

  const upgradeState = useMemo(() => ({
    id: kingdomId,
    kingdomId,
    race,
    gold,
    wood,
    stone,
    iron,
    bld_vaults: vaults,
  }), [kingdomId, race, gold, wood, stone, iron, vaults]);

  const setMaxMercCount = useCallback(() => {
    const price = MERC_COST[mercTier] || 50;
    const max = Math.floor(Number(gold || 0) / price);
    setMercCount(String(Math.max(0, max)));
  }, [gold, mercTier]);

  const racDisc = COMMODITY_RACE_DISCOUNT[race || 'human'] || {};
  const wpf = FARM_WORKERS_PER[race] || 10;

  const bal = (econData?.farmProduction || 0) - (econData?.foodConsumption || 0);
  const dt = econData?.foodDegradeTurns;
  const dtLabel = dt == null ? '—' : (dt === Infinity || dt > 1000 ? 'Stable / Growing' : `${dt} turns`);
  const dtColorClass = dt == null || dt === Infinity || dt > 100 ? 'text-[var(--green)]' : dt > 20 ? 'text-[var(--accent1)]' : 'text-[var(--red)]';

  return (
    <div id="economy" className="panel">
      <div className="card flex-shrink-0">
        <div className="flex justify-between items-baseline">
          <div className="card-title !mb-0">Tax policy</div>
          <div id="tax-metrics" className="text-[12px] text-[var(--text3)] flex gap-3">
            <span>Income: <strong className="text-[var(--green)]">+{fmt(econData?.totalIncome || 0)}</strong></span>
            <span>Upkeep: <strong className="text-[var(--red)]">-{fmt(econData?.troopUpkeep || 0)}</strong></span>
            <span>Net: <strong className={(econData?.netIncome || 0) >= 0 ? 'text-[var(--green)]' : 'text-[var(--red)]'}>{(econData?.netIncome || 0) >= 0 ? '+' : ''}{fmt(econData?.netIncome || 0)}</strong></span>
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
            <div className="flex justify-between"><span className="text-[var(--text3)]">Taxes</span><span className="text-[var(--green)]">{fmt(econData?.taxIncome || 0)}</span></div>
            <div className="flex justify-between"><span className="text-[var(--text3)]">Markets</span><span className="text-[var(--green)]">{fmt(econData?.marketIncome || 0)}</span></div>
            <div className="flex justify-between"><span className="text-[var(--text3)]">Trade Routes</span><span className="text-[var(--green)]">{fmt(econData?.tradeRouteIncome || 0)}</span></div>
            <div className="flex justify-between font-bold border-t border-[var(--border)] mt-1 pt-0.5">
              <span className="text-text2">Total Income</span><span className="text-[var(--green)]">{fmt(econData?.totalIncome || 0)}</span>
            </div>
          </div>
          <div>
            <div className="font-bold text-[var(--red)] mb-1 border-b border-[var(--border)] pb-0.5">Expenses / Turn</div>
            <div className="flex justify-between"><span className="text-[var(--text3)]">Troop Upkeep</span><span className="text-[var(--red)]">{fmt(econData?.troopUpkeep || 0)}</span></div>
            <div className="flex justify-between font-bold border-t border-[var(--border)] mt-1 pt-0.5">
              <span className="text-text2">Total Expenses</span><span className="text-[var(--red)]">{fmt(econData?.troopUpkeep || 0)}</span>
            </div>
          </div>
        </div>
        <div className="mt-2 text-center font-bold p-1 bg-bg2 rounded-sm">
          Net Balance: <span className={(econData?.netIncome || 0) >= 0 ? 'text-[var(--green)]' : 'text-[var(--red)]'}>{(econData?.netIncome || 0) >= 0 ? '+' : ''}{fmt(econData?.netIncome || 0)}</span>
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
            <div className="trow"><span className="name">Farms</span><span className="count">{fmt(bldFarms || 0)}</span></div>
            <div className="trow"><span className="name">Worked farms</span><span className="count text-[var(--green)]">{fmt(econData?.workedFarms || 0)}</span></div>
            <div className="trow"><span className="name">Production</span><span className="count text-[var(--green)]">+{fmt(econData?.farmProduction || 0)}</span></div>
            <div className="trow"><span className="name">Consumption</span><span className="count text-[var(--red)]">-{fmt(econData?.foodConsumption || 0)}</span></div>
            <div className="trow border-t border-[var(--border2)]">
              <span className="name">Balance</span>
              <span className={'count font-bold ' + (bal >= 0 ? 'text-[var(--green)]' : 'text-[var(--red)]')}>
                {(bal >= 0 ? '+' : '') + fmt(bal)}
              </span>
            </div>
            <div className="trow"><span className="name">Shortage turns</span><span className="count">{econData?.food_shortage_turns || 0}</span></div>
          </div>
          <div className="card m-0">
            <div className="card-title !mb-2.5">Farm upgrades</div>
            <div className="text-[12px] text-[var(--text3)] mb-3">
              Instant gold purchase — applies to all farms.
            </div>
            <UpgradesList
              category="farm"
              defs={FARM_UPGRADES}
              owned={parseOwnedUpgrades(farmUpgrades)}
              state={upgradeState}
              onPurchased={(_, nextOwned) => syncUpgradeOwned('farm', nextOwned)}
            />
          </div>
        </div>
        <div className="card">
          <div className="card-title !mb-2">Food rules</div>
          <div className={RELAXED_COPY_CLASS}>
            Each farm needs <strong className="text-[var(--text)]">{wpf}</strong> free population to work it. Unworked farms produce nothing.<br />
            Shortage grace: <strong className="text-[var(--amber)]">2 turns</strong> → happiness penalty → population flight → desertion.
          </div>
        </div>
      </div>

      {/* GRANARY TAB */}
      <div className={clsx(activeTab === 'granary' ? 'block' : 'hidden')}>
        <div className={TWO_COL_PANEL_CLASS}>
          <div className="card m-0">
            <div className="card-title !mb-2.5">Storage overview</div>
            <div className="trow"><span className="name">Food stored</span><span className="count">{fmt(food || 0)} bushels</span></div>
            <div className="trow"><span className="name">Max storage</span><span className="count">{fmt(econData?.maxFoodStorage || 0)} bushels</span></div>
            <div className="trow border-t border-[var(--border2)]">
              <span className="name">Spoilage / turn</span>
              <span className="count text-[var(--red)]">
                {fmt(econData?.foodSpoilageAmount || 0)} ({((econData?.foodSpoilageRate || 0) * 100).toFixed(1)}%)
              </span>
            </div>
            <div className="trow"><span className="name">Time to degrade</span><span className={'count ' + dtColorClass}>{dtLabel}</span></div>
          </div>
          <div className="card m-0">
            <div className="card-title !mb-2.5">Granary upgrades</div>
            <div className="text-[12px] text-[var(--text3)] mb-3">
              Enhances granaries to store more food and reduce rot.
            </div>
            <UpgradesList
              category="granary"
              defs={GRANARY_UPGRADES}
              owned={parseOwnedUpgrades(granaryUpgrades)}
              state={upgradeState}
              onPurchased={(_, nextOwned) => syncUpgradeOwned('granary', nextOwned)}
            />
          </div>
        </div>
        <div className="card">
          <div className="card-title !mb-2">Storage rules</div>
          <div className={RELAXED_COPY_CLASS}>
            Food cannot be stored indefinitely and decays every turn based on the
            current spoilage rate. Upgrades can lower this rate and improve the
            base amount of food you can securely store per granary. Baseline
            storage without granaries has been removed.
          </div>
        </div>
      </div>

      {/* MARKETS TAB */}
      <div className={clsx(activeTab === 'markets' ? 'block' : 'hidden')}>
        <div className={TWO_COL_PANEL_CLASS}>
          <div className="card m-0">
            <div className="card-title !mb-2.5">Market overview</div>
            <div className="trow"><span className="name">Markets</span><span className="count">{fmt(bldMarkets || 0)}</span></div>
            <div className="trow"><span className="name">Market income/turn</span><span className="count text-[var(--gold)]">{fmt(econData?.marketIncome || 0)} GC</span></div>
            <div className="trow"><span className="name">Trade routes</span><span className="count">{fmt(econData?.activeTradeRouteCount || 0)}</span></div>
            <div className="trow">
              <span className="name">Trading unlocked</span>
              <span className={'count ' + (tradeLocked ? 'text-[var(--red)]' : 'text-[var(--green)]')}>
                {tradeLocked ? 'No' : 'Yes'}
              </span>
            </div>
          </div>
          <div className="card m-0">
            <div className="card-title !mb-2.5">Market upgrades</div>
            <UpgradesList
              category="market"
              defs={MARKET_UPGRADES}
              owned={parseOwnedUpgrades(marketUpgrades)}
              state={upgradeState}
              onPurchased={(_, nextOwned) => syncUpgradeOwned('market', nextOwned)}
            />
          </div>
        </div>

        {/* Commodity market */}
        <div className="card" id="commodity-market-card">
          <div className="card-title !mb-2">📦 Commodity market</div>
          <div className="text-[12px] text-[var(--text3)] mb-3">
            Base prices - your race modifiers applied - prices fluctuate by supply
          </div>
          <div className={`${COMMODITY_GRID_CLASS} border-b border-[var(--border2)] py-1`}>
            <span className={COMMODITY_HEADER_CELL_CLASS}>Item</span>
            <span className={`${COMMODITY_HEADER_CELL_CLASS} text-right`}>Base</span>
            <span className={`${COMMODITY_HEADER_CELL_CLASS} text-right`}>Your price</span>
          </div>
          {COMMODITY_ITEMS.map((item) => {
            const base = COMMODITY_VALUES[item] || 1;
            const disc = racDisc[item] || racDisc._all || 1.0;
            const yours = Math.max(1, Math.round(base * disc));
            return (
              <div key={item} className={`${COMMODITY_GRID_CLASS} items-center border-b border-[var(--border)] py-1.5`}>
                <span className="text-[13px] text-[var(--text)]">{item.charAt(0).toUpperCase() + item.slice(1)}</span>
                <span className={`${COMMODITY_VALUE_CLASS} text-[var(--text3)]`}>{base} GC</span>
                <span className={`${COMMODITY_VALUE_CLASS} font-semibold text-[var(--gold)]`}>
                  {yours} GC{yours < base ? ' ↓' : yours > base ? ' ↑' : ''}
                </span>
              </div>
            );
          })}
        </div>

        {/* Trade offers */}
        <div className="card" id="trade-offers-card">
          <div className="card-title !mb-2">🤝 Trade offers</div>
          {tradeLocked ? (
            <div className="text-[13px] text-[var(--text3)]">
              Build a <strong>Trading Post</strong> to send and receive trade offers.
            </div>
          ) : (
            <div>
              <div className="mb-3.5">
                <div className="text-[12px] font-bold text-[var(--text2)] mb-2">Send a trade offer</div>
                <div className={TRADE_TWO_COL_CLASS}>
                  <div>
                    <div className={TRADE_LABEL_CLASS}>I offer</div>
                    <select className="input mb-1.5 w-full" value={tradeOfferItem} onChange={(e) => setTradeOfferItem(e.target.value)}>
                      <option value="food">Food</option>
                      <option value="gold">Gold</option>
                      <option value="mana">Mana</option>
                      <option value="weapons">Weapons</option>
                      <option value="armor">Armor</option>
                      <option value="maps">Maps</option>
                    </select>
                    <div className={TRADE_INPUT_ROW_CLASS}>
                      <input type="number" className="input flex-1 text-right" min="1" value={tradeOfferQty} onChange={(e) => setTradeOfferQty(e.target.value)} placeholder="Qty" />
                      <button className={TRADE_MAX_BUTTON_CLASS} onClick={setMaxTradeOfferQty}>Max</button>
                    </div>
                  </div>
                  <div>
                    <div className={TRADE_LABEL_CLASS}>I want</div>
                    <select className="input mb-1.5 w-full" value={tradeRequestItem} onChange={(e) => setTradeRequestItem(e.target.value)}>
                      <option value="gold">Gold</option>
                      <option value="food">Food</option>
                      <option value="mana">Mana</option>
                      <option value="weapons">Weapons</option>
                      <option value="armor">Armor</option>
                      <option value="maps">Maps</option>
                    </select>
                    <div className={TRADE_INPUT_ROW_CLASS}>
                      <input type="number" className="input flex-1 text-right" min="1" value={tradeRequestQty} onChange={(e) => setTradeRequestQty(e.target.value)} placeholder="Qty" />
                    </div>
                  </div>
                </div>
                <select className="input mb-2 w-full" value={tradeTargetId} onChange={(e) => setTradeTargetId(e.target.value)}>
                  <option value="">— select kingdom —</option>
                  {tradeTargets.map((t) => (
                    <option key={t.id || t.kingdom_id} value={t.id || t.kingdom_id}>{t.name || t.kingdom_name}</option>
                  ))}
                </select>
                <button className="base-btn variant-green w-full bg-[var(--green)] text-black" onClick={handleSendTradeOffer}>
                  📦 Send trade offer
                </button>
              </div>
              <div>
                <div className={TRADE_STATUS_HEADING_CLASS}>Incoming offers</div>
                {receivedOffers.length === 0 ? (
                  <div className="text-[13px] text-[var(--text3)]">No pending offers.</div>
                ) : receivedOffers.map((o) => {
                  const offer = typeof o.offer === 'string' ? JSON.parse(o.offer) : (o.offer || {});
                  const request = typeof o.request === 'string' ? JSON.parse(o.request) : (o.request || {});
                  const offerStr = Object.entries(offer).map(([item, qty]) => `${qty} ${item}`).join(', ');
                  const requestStr = Object.entries(request).map(([item, qty]) => `${qty} ${item}`).join(', ');
                  return (
                    <div key={o.id} className={TRADE_CARD_CLASS}>
                      <div className="mb-1 text-[13px] text-[var(--text)]">
                        <strong>{o.sender_name}</strong> offers{' '}
                        <span className="text-[var(--green)]">{offerStr}</span> for{' '}
                        <span className="text-[var(--amber)]">{requestStr}</span>
                      </div>
                      <div className={TRADE_ACTION_ROW_CLASS}>
                        <button className={`btn btn-green ${TRADE_ACTION_BUTTON_CLASS}`} onClick={() => handleAcceptTrade(o.id)}>✅ Accept</button>
                        <button className={`btn btn-red ${TRADE_ACTION_BUTTON_CLASS}`} onClick={() => handleDeclineTrade(o.id)}>❌ Decline</button>
                      </div>
                    </div>
                  );
                })}
                <div className="my-3 flex items-center justify-between">
                  <div className={TRADE_STATUS_HEADING_CLASS}>Sent offers</div>
                  <button className="base-btn variant-red bg-[var(--red)] px-2 py-0.5 text-[10px]" onClick={handleClearTradeLogs}>Clear Logs</button>
                </div>
                {sentOffers.length === 0 ? (
                  <div className="text-[13px] text-[var(--text3)]">No sent offers.</div>
                ) : sentOffers.map((o) => {
                  const offer = typeof o.offer === 'string' ? JSON.parse(o.offer) : (o.offer || {});
                  const request = typeof o.request === 'string' ? JSON.parse(o.request) : (o.request || {});
                  const offerStr = Object.entries(offer).map(([item, qty]) => `${qty} ${item}`).join(', ');
                  const requestStr = Object.entries(request).map(([item, qty]) => `${qty} ${item}`).join(', ');
                  const statusColorClass = o.status === 'accepted' ? 'text-[var(--green)]' : o.status === 'declined' ? 'text-[var(--red)]' : 'text-[var(--amber)]';
                  return (
                    <div key={o.id} className="border-b border-[var(--border)] py-1 text-[12px] text-[var(--text3)]">
                      To <strong className="text-[var(--text)]">{o.receiver_name}</strong>: {offerStr} for {requestStr}{' '}
                      <span className={statusColorClass}>[{o.status}]</span>
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
        <div className={TWO_COL_PANEL_CLASS}>
          <div className="card m-0">
            <div className="card-title !mb-2.5">Tavern overview</div>
            <div className="trow"><span className="name">Taverns</span><span className="count">{fmt(bldTaverns || 0)}</span></div>
          </div>
          <div className="card m-0">
            <div className="card-title !mb-2.5">Tavern upgrades</div>
            <UpgradesList
              category="tavern"
              defs={TAVERN_UPGRADES}
              owned={parseOwnedUpgrades(tavernUpgrades)}
              state={upgradeState}
              onPurchased={(_, nextOwned) => syncUpgradeOwned('tavern', nextOwned)}
            />
          </div>
        </div>

        <div className="card">
          <div className="card-title !mb-2">⚔️ Mercenary board</div>
          <div className={PANEL_COPY_CLASS}>
            Mercenaries fight at a fixed level. They do not advance, do not use
            your weapon/armor stockpile, and leave when their contract expires.
            They count toward anti-bully ratios.
          </div>
          <div className="merc-board-grid mb-3">
            <select className="input text-[12px]" value={mercUnit} onChange={(e) => setMercUnit(e.target.value)}>
              <option value="fighters">Fighters</option>
              <option value="rangers">Rangers</option>
              <option value="mages">Mages</option>
              <option value="clerics">Clerics</option>
              <option value="thieves">Thieves</option>
              <option value="ninjas">Ninjas</option>
            </select>
            <select className="input text-[12px]" value={mercTier} onChange={(e) => setMercTier(e.target.value)}>
              <option value="rabble">Rabble (Lv 5–10)</option>
              <option value="sellsword">Sellsword (Lv 15–25)</option>
              <option value="veteran">Veteran (Lv 30–45)</option>
              <option value="elite">Elite (Lv 50–65)</option>
            </select>
            <div className={INPUT_ROW_CLASS}>
              <input type="number" className="input flex-1 text-right" min="1" value={mercCount} onChange={(e) => setMercCount(e.target.value)} placeholder="Qty" />
              <button className={MAX_BUTTON_CLASS} onClick={setMaxMercCount}>Max</button>
            </div>
            <div className="text-[11px] text-[var(--text3)]">{mercPreview}</div>
            <div className="merc-btn-col">
              <button className="base-btn variant-amber w-full bg-amber-600 text-white" onClick={handleHireMercs}>Hire</button>
            </div>
          </div>
          {!econData?.mercenaries?.length ? (
            <div className="p-3 text-center text-[13px] text-[var(--text3)]">
              No mercenaries under contract.
            </div>
          ) : econData.mercenaries.map((m, i) => {
            const served = (turn || 0) - (m.hired_at_turn || 0);
            const remaining = Math.max(0, m.duration_turns - served);
            return (
              <div key={i} className="flex items-center gap-2 border-b border-[var(--border)] py-2">
                <div className="flex-1">
                  <div className="text-[13px] font-semibold text-[var(--text)]">{m.count} {m.tier} {m.unit_type}</div>
                  <div className="text-[11px] text-[var(--text3)]">Remaining: {remaining} turns</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* BANK TAB */}
      <div className={clsx(activeTab === 'bank' ? 'block' : 'hidden')}>
        <div id="bank-locked-msg" className={BANK_LOCKED_PANEL_CLASS + ' ' + ((vaults || 0) >= 25 ? 'hidden' : 'block')}>
          <div className="mb-3 text-[32px]">🏦</div>
          <div className="mb-2 text-[16px] font-bold">Bank Locked</div>
          <div className="text-[14px]">Construct at least 25 Vaults to access the Royal Bank.</div>
        </div>
        <div id="bank-content" className={(vaults || 0) >= 25 ? 'block' : 'hidden'}>
          <div className={TWO_COL_PANEL_CLASS}>
            <div className="card m-0">
              <div className="card-title !mb-2.5">Fixed-Term Deposits</div>
              <div className="mb-3 text-[12px] text-[var(--text3)]">
                Deposit your gold to earn a guaranteed return over time. You cannot withdraw early.
              </div>
              <div className="mb-3 flex gap-2">
                <input type="number" className="input flex-1" placeholder="Amount" min="1" value={bankAmount} onChange={(e) => setBankAmount(e.target.value)} />
                <select className="input flex-1" value={bankTermIndex} onChange={(e) => setBankTermIndex(e.target.value)}>
                  <option value="0">10 Turns (2% yield)</option>
                  <option value="1">25 Turns (7% yield)</option>
                  <option value="2">50 Turns (15% yield)</option>
                  <option value="3">150 Turns (25% yield)</option>
                  <option value="4">300 Turns (60% yield)</option>
                </select>
              </div>
              <button className={`${PRIMARY_GOLD_BUTTON_CLASS} w-full`} onClick={handleMakeBankDeposit}>
                Deposit Gold
              </button>
            </div>
            <div className="card m-0">
              <div className="card-title !mb-2.5">Bank Upgrades</div>
              <UpgradesList
                category="bank"
                defs={BANK_UPGRADES}
                owned={parseOwnedUpgrades(bankUpgrades)}
                state={upgradeState}
                onPurchased={(_, nextOwned) => syncUpgradeOwned('bank', nextOwned)}
              />
            </div>
          </div>
          <div className="card m-0">
            <div className="card-title !mb-2.5">Active Deposits</div>
            <div id="bank-deposits-list"></div>
          </div>
        </div>
      </div>

      {/* TRADE ROUTES TAB */}
      <div className={clsx(activeTab === 'trade-routes' ? 'block' : 'hidden')}>
        <div className="card mt-0 mb-5">
          <div className="card-title !mb-2.5">Establish New Route</div>
          <div className="text-[12px] text-[var(--text3)] mb-3">
            Requires: 10,000 GC. Permanent routes provide steady income and improve with stability.
          </div>
          <div className="flex gap-2">
            <select className="input flex-1" value={tradeRouteTargetId} onChange={(e) => setTradeRouteTargetId(e.target.value)}>
              <option value="">— Select Target Kingdom —</option>
              {tradeTargets.map((t) => (
                <option key={t.id || t.kingdom_id} value={t.id || t.kingdom_id}>{t.name || t.kingdom_name}</option>
              ))}
            </select>
            <button className={PRIMARY_GOLD_BUTTON_CLASS} onClick={handleEstablishTradeRoute}>
              Establish 🤝
            </button>
          </div>
        </div>
        <div className="card mt-0">
          <div className="card-title !mb-2.5">Active Trade Routes</div>
          <div className="mb-4 text-[12px] text-[var(--text3)]">
            Established connections with other kingdoms provide steady gold income each turn. Stability increases over time, improving efficiency.
          </div>
          {tradeRoutes.length === 0 ? (
            <div className="p-5 text-center text-[var(--text3)]">
              No active trade routes. Discover other kingdoms and establish routes to earn gold!
            </div>
          ) : tradeRoutes.map((r) => (
            <div key={r.id} className="card mb-2 border border-[var(--border1)] p-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-bold text-[var(--gold)]">🤝 {r.partner_name}</div>
                  <div className="text-[11px] text-[var(--text3)]">{String(r.partner_race || 'unknown').replace(/_/g, ' ')} - {fmtShort(r.partner_land)} acres</div>
                </div>
                <div className="mx-4 text-right">
                  <div className="text-[14px] font-bold text-[var(--green)]">+{fmtShort(Math.floor((r.stability || 0) * 2.5))} GC / turn</div>
                  <div className="text-[10px] text-[var(--text3)]">Stability: {r.stability}%</div>
                </div>
                <button className="btn btn-red px-2 py-1 text-[11px]" onClick={() => handleCancelTradeRoute(r.id)}>Cancel</button>
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
