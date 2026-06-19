import React, { useState } from 'react';
import { apiCall } from '../../utils/api';

const EconomyPanel = () => {
  const [activeTab, setActiveTab] = useState('farms');

  const handleTabClick = (tabId) => {
    setActiveTab(tabId);
    if (tabId === "markets" && window.loadTradeOffers) window.loadTradeOffers();
    if (tabId === "trade-routes" && window.loadTradeRoutes) window.loadTradeRoutes();
  };

  const updateTaxDisplay = (value) => {
    const disp = document.getElementById('tax-disp');
    if (disp) disp.textContent = String(value ?? '');
  };

  const lockTax = async (sliderId) => {
    const slider = document.getElementById(sliderId || 'tax-slider');
    if (!slider) return;
    const tax = Number(slider.value);
    if (Number.isNaN(tax)) return;
    try {
      const result = await apiCall('/api/kingdom/options', {
        method: 'POST',
        body: { tax },
      });
      if (result.error) {
        if (window.toast) window.toast(result.error, 'error');
        return;
      }
      if (window.applyGameMutation) {
        window.applyGameMutation(result, { reason: 'tax-update' });
      } else if (result.updates) {
        window.applyServerUpdates?.(result.updates, { reason: 'tax-update' });
      }
      if (window.toast) window.toast('Tax rate locked', 'success');
    } catch (err) {
      console.error('[tax] lock failed:', err);
      if (window.toast) window.toast('Failed to save tax rate', 'error');
    }
  };
  const setMaxValue = (inputId, type) => {
    if (window.setMaxValue) window.setMaxValue(inputId, type);
  };
  const sendTradeOffer = () => {
    if (window.sendTradeOffer) window.sendTradeOffer();
  };
  const clearTradeLogs = () => {
    if (window.clearTradeLogs) window.clearTradeLogs();
  };
  const updateTax = (value) => {
    updateTaxDisplay(value);
  };
  const updateMercPreview = () => {
    if (window.updateMercPreview) window.updateMercPreview();
  };
  const handleUpdateMercPreview = () => {
    updateMercPreview();
  };
  const hireMercs = () => {
    if (window.hireMercs) window.hireMercs();
  };
  const makeBankDeposit = () => {
    if (window.makeBankDeposit) window.makeBankDeposit();
  };
  const establishTradeRoute = (targetId) => {
    if (window.establishTradeRoute) window.establishTradeRoute(targetId);
  };
  const handleEstablishTradeRoute = () => {
    const el = document.getElementById("trade-target-list");
    if (el) establishTradeRoute(el.value);
  };

  return (
    <div id="economy" className="panel" style={{ display: 'none' }}>
      <div className="card" style={{ marginTop: 0, flexShrink: 0 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
          }}
        >
          <div className="card-title">Tax policy</div>
          <div
            id="tax-metrics"
            style={{ fontSize: '12px', color: 'var(--text3)', display: 'flex', gap: '12px' }}
          >
            <span>
              Income: <strong id="econ-income" style={{ color: 'var(--green)' }}>+0</strong>
            </span>
            <span>
              Upkeep: <strong id="econ-upkeep" style={{ color: 'var(--red)' }}>-0</strong>
            </span>
            <span>
              Net: <strong id="econ-net" style={{ color: 'var(--gold)' }}>0</strong>
            </span>
          </div>
        </div>
        <div
          style={{ display: 'flex', alignItems: 'center', gap: '14px', margin: '12px 0' }}
          className="tax-slider-container"
        >
          <input
            type="range"
            id="tax-slider"
            className="input"
            min="1"
            max="100"
            step="1"
            defaultValue="42"
            onChange={(e) => updateTax(e.target.value)}
            style={{ flex: 1, minWidth: '120px' }}
          />
          <span
            style={{
              fontSize: '22px',
              fontWeight: 700,
              color: 'var(--gold)',
              minWidth: '48px',
            }}
            id="tax-disp"
          ></span>
        </div>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
          <button
            className="base-btn variant-gold"
            onClick={() => lockTax('tax-slider')}
            style={{ flex: 1, padding: '8px', background: 'var(--gold)', color: '#000' }}
          >
            🔒 Lock changes
          </button>
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text3)', lineHeight: 1.6 }}>
          Taxing your citizens directly affects their happiness. Tax them high and
          they will probably leave. Tax them low and they will rejoice. Net income
          is calculated per turn spent.
        </div>
      </div>

      {/* FINANCIAL LEDGER */}
      <div className="card" style={{ flexShrink: 0 }}>
        <div className="card-title" style={{ marginBottom: '8px' }}>Financial Ledger</div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '16px',
            fontSize: '13px',
          }}
        >
          <div>
            <div
              style={{
                fontWeight: 'bold',
                color: 'var(--green)',
                marginBottom: '4px',
                borderBottom: '1px solid var(--border1)',
                paddingBottom: '2px',
              }}
            >
              Income / Turn
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="text3">Taxes</span>
              <span id="ledger-tax" className="green">0</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="text3">Markets</span>
              <span id="ledger-markets" className="green">0</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="text3">Trade Routes</span>
              <span id="ledger-trade" className="green">0</span>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontWeight: 'bold',
                borderTop: '1px solid var(--border1)',
                marginTop: '4px',
                paddingTop: '2px',
              }}
            >
              <span className="text2">Total Income</span>
              <span id="ledger-income-total" className="green">0</span>
            </div>
          </div>
          <div>
            <div
              style={{
                fontWeight: 'bold',
                color: 'var(--red)',
                marginBottom: '4px',
                borderBottom: '1px solid var(--border1)',
                paddingBottom: '2px',
              }}
            >
              Expenses / Turn
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="text3">Troop Upkeep</span>
              <span id="ledger-upkeep" className="red">0</span>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontWeight: 'bold',
                borderTop: '1px solid var(--border1)',
                marginTop: '4px',
                paddingTop: '2px',
              }}
            >
              <span className="text2">Total Expenses</span>
              <span id="ledger-expense-total" className="red">0</span>
            </div>
          </div>
        </div>
        <div
          style={{
            marginTop: '8px',
            textAlign: 'center',
            fontWeight: 'bold',
            padding: '4px',
            background: 'var(--bg2)',
            borderRadius: '4px',
          }}
        >
          Net Balance: <span id="ledger-net">0</span>
        </div>
      </div>

      {/* Tab nav */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '4px',
          marginBottom: '16px',
          borderBottom: '2px solid var(--border2)',
          paddingBottom: 0,
        }}
      >
        <button
          className={`base-btn admin-tab ${activeTab === 'farms' ? 'active' : ''}`}
          id="econ-tab-farms"
          onClick={() => handleTabClick('farms')}
          style={{ borderRadius: '0' }}
        >
          🌾 Farm
        </button>
        <button
          className={`base-btn admin-tab ${activeTab === 'granary' ? 'active' : ''}`}
          id="econ-tab-granary"
          onClick={() => handleTabClick('granary')}
          style={{ borderRadius: '0' }}
        >
          🌾 Granary
        </button>
        <button
          className={`base-btn admin-tab ${activeTab === 'markets' ? 'active' : ''}`}
          id="econ-tab-markets"
          onClick={() => handleTabClick('markets')}
          style={{ borderRadius: '0' }}
        >
          🏪 Market
        </button>
        <button
          className={`base-btn admin-tab ${activeTab === 'tavern' ? 'active' : ''}`}
          id="econ-tab-tavern"
          onClick={() => handleTabClick('tavern')}
          style={{ borderRadius: '0' }}
        >
          🍺 Tavern
        </button>
        <button
          className={`base-btn admin-tab ${activeTab === 'bank' ? 'active' : ''}`}
          id="econ-tab-bank"
          onClick={() => handleTabClick('bank')}
          style={{ borderRadius: '0' }}
        >
          🏦 Bank
        </button>
        <button
          className={`base-btn admin-tab ${activeTab === 'trade-routes' ? 'active' : ''}`}
          id="econ-tab-trade-routes"
          onClick={() => handleTabClick('trade-routes')}
          style={{ borderRadius: '0' }}
        >
          🤝 Trade Routes
        </button>
      </div>

      {/* FARMS TAB */}
      <div style={{ display: activeTab === 'farms' ? 'block' : 'none' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '12px',
            marginBottom: '16px',
          }}
        >
          <div className="card" style={{ margin: 0 }}>
            <div className="card-title" style={{ marginBottom: '10px' }}>Farm overview</div>
            <div className="trow">
              <span className="name">Farm</span>
              <span className="count" id="econ-farms">0</span>
            </div>
            <div className="trow">
              <span className="name">Worked farms</span>
              <span className="count" id="econ-worked-farms" style={{ color: 'var(--green)' }}>0</span>
            </div>
            <div className="trow">
              <span className="name">Production</span>
              <span className="count" id="econ-production" style={{ color: 'var(--green)' }}>0</span>
            </div>
            <div className="trow">
              <span className="name">Consumption</span>
              <span className="count" id="econ-consumption" style={{ color: 'var(--red)' }}>0</span>
            </div>
            <div className="trow" style={{ borderTop: '1px solid var(--border2)' }}>
              <span className="name">Balance</span>
              <span className="count" id="econ-balance" style={{ fontWeight: 700 }}>0</span>
            </div>
            <div className="trow">
              <span className="name">Shortage turns</span>
              <span className="count" id="econ-shortage">0</span>
            </div>
          </div>
          <div className="card" style={{ margin: 0 }}>
            <div className="card-title" style={{ marginBottom: '10px' }}>Farm upgrades</div>
            <div style={{ fontSize: '12px', color: 'var(--text3)', marginBottom: '12px' }}>
              Instant gold purchase — applies to all farms.
            </div>
            <div id="farm-upgrade-list"></div>
          </div>
        </div>
        <div className="card">
          <div className="card-title" style={{ marginBottom: '8px' }}>Food rules</div>
          <div style={{ fontSize: '12px', color: 'var(--text3)', lineHeight: 1.9 }}>
            Each farm needs <strong id="econ-workers-per-farm" style={{ color: 'var(--text)' }}>10</strong> free population to work it. Unworked farms produce nothing.<br />
            Shortage grace: <strong style={{ color: 'var(--amber)' }}>2 turns</strong> → happiness penalty → population flight → desertion.
          </div>
        </div>
      </div>

      {/* GRANARY TAB */}
      <div style={{ display: activeTab === 'granary' ? 'block' : 'none' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '12px',
            marginBottom: '16px',
          }}
        >
          <div className="card" style={{ margin: 0 }}>
            <div className="card-title" style={{ marginBottom: '10px' }}>Storage overview</div>
            <div className="trow">
              <span className="name">Food stored</span>
              <span className="count" id="gran-food-stored">0</span>
            </div>
            <div className="trow">
              <span className="name">Max storage</span>
              <span className="count" id="gran-max-storage">0</span>
            </div>
            <div className="trow" style={{ borderTop: '1px solid var(--border2)' }}>
              <span className="name">Spoilage / turn</span>
              <span className="count" id="gran-spoilage" style={{ color: 'var(--red)' }}>0</span>
            </div>
            <div className="trow">
              <span className="name">Time to degrade</span>
              <span className="count" id="gran-degrade-time" style={{ color: 'var(--accent1)' }}>—</span>
            </div>
          </div>
          <div className="card" style={{ margin: 0 }}>
            <div className="card-title" style={{ marginBottom: '10px' }}>Granary upgrades</div>
            <div style={{ fontSize: '12px', color: 'var(--text3)', marginBottom: '12px' }}>
              Enhances granaries to store more food and reduce rot.
            </div>
            <div id="granary-page-upgrade-list"></div>
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
      <div style={{ display: activeTab === 'markets' ? 'block' : 'none' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '12px',
            marginBottom: '16px',
          }}
        >
          <div className="card" style={{ margin: 0 }}>
            <div className="card-title" style={{ marginBottom: '10px' }}>Market overview</div>
            <div className="trow">
              <span className="name">Markets</span>
              <span className="count" id="econ-markets">0</span>
            </div>
            <div className="trow">
              <span className="name">Market income/turn</span>
              <span className="count" id="econ-market-income" style={{ color: 'var(--gold)' }}>0 GC</span>
            </div>
            <div className="trow">
              <span className="name">Trade routes</span>
              <span className="count" id="econ-trade-routes">0</span>
            </div>
            <div className="trow">
              <span className="name">Trading unlocked</span>
              <span className="count" id="econ-trade-unlocked">No</span>
            </div>
          </div>
          <div className="card" style={{ margin: 0 }}>
            <div className="card-title" style={{ marginBottom: '10px' }}>Market upgrades</div>
            <div id="market-upgrade-list"></div>
          </div>
        </div>

        {/* Commodity market */}
        <div className="card" id="commodity-market-card">
          <div className="card-title" style={{ marginBottom: '8px' }}>📦 Commodity market</div>
          <div style={{ fontSize: '12px', color: 'var(--text3)', marginBottom: '12px' }}>
            Base prices · your race modifiers applied · prices fluctuate by supply
          </div>
          <div id="commodity-list"></div>
        </div>

        {/* Trade offers */}
        <div className="card" id="trade-offers-card">
          <div className="card-title" style={{ marginBottom: '8px' }}>🤝 Trade offers</div>
          <div id="trade-locked-msg" style={{ fontSize: '13px', color: 'var(--text3)' }}>
            Build a <strong>Trading Post</strong> to send and receive trade offers.
          </div>
          <div id="trade-panel" style={{ display: 'none' }}>
            <div style={{ marginBottom: '14px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text2)', marginBottom: '8px' }}>
                Send a trade offer
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '10px' }}>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text3)', marginBottom: '4px' }}>I offer</div>
                  <select id="trade-offer-item" className="input" style={{ width: '100%', marginBottom: '6px' }}>
                    <option value="food">Food</option>
                    <option value="gold">Gold</option>
                    <option value="mana">Mana</option>
                    <option value="weapons">Weapons</option>
                    <option value="armor">Armor</option>
                    <option value="maps">Maps</option>
                  </select>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <input type="number" className="input" id="trade-offer-qty" min="1" defaultValue="0" style={{ textAlign: 'right', width: '100%', flex: 1 }} placeholder="Qty" />
                    <button className="base-btn" style={{ fontSize: '10px', padding: '3px 6px' }} onClick={() => setMaxValue('trade-offer-qty', 'gold')}>Max</button>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text3)', marginBottom: '4px' }}>I want</div>
                  <select id="trade-request-item" className="input" style={{ width: '100%', marginBottom: '6px' }}>
                    <option value="gold">Gold</option>
                    <option value="food">Food</option>
                    <option value="mana">Mana</option>
                    <option value="weapons">Weapons</option>
                    <option value="armor">Armor</option>
                    <option value="maps">Maps</option>
                  </select>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <input type="number" className="input" id="trade-request-qty" min="1" defaultValue="0" style={{ textAlign: 'right', width: '100%', flex: 1 }} placeholder="Qty" />
                    <button className="base-btn" style={{ fontSize: '10px', padding: '3px 6px' }} onClick={() => setMaxValue('trade-request-qty', 10000)}>Max</button>
                  </div>
                </div>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text3)', marginBottom: '8px' }} id="trade-value-hint"></div>
              <select id="trade-target-select" className="input" style={{ width: '100%', marginBottom: '8px' }}>
                <option value="">— select kingdom —</option>
              </select>
              <button className="base-btn variant-green w-full" style={{ background: 'var(--green)', color: '#000', width: '100%' }} onClick={sendTradeOffer}>
                📦 Send trade offer
              </button>
            </div>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text2)', marginBottom: '6px' }}>Incoming offers</div>
              <div id="trade-received-list">
                <div style={{ color: 'var(--text3)', fontSize: '13px' }}>No pending offers.</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '12px 0 6px' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text2)' }}>Sent offers</div>
                <button className="base-btn variant-red" style={{ fontSize: '10px', padding: '2px 8px', background: 'var(--red)' }} onClick={clearTradeLogs}>Clear Logs</button>
              </div>
              <div id="trade-sent-list">
                <div style={{ color: 'var(--text3)', fontSize: '13px' }}>No sent offers.</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* TAVERN TAB */}
      <div style={{ display: activeTab === 'tavern' ? 'block' : 'none' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '12px',
            marginBottom: '16px',
          }}
        >
          <div className="card" style={{ margin: 0 }}>
            <div className="card-title" style={{ marginBottom: '10px' }}>Tavern overview</div>
            <div className="trow">
              <span className="name">Taverns</span>
              <span className="count" id="econ-taverns">0</span>
            </div>
            <div className="trow" style={{ display: 'none' }}>
              <span className="name">Entertainment bonus</span>
              <span className="count" id="econ-entertainment" style={{ color: 'var(--accent1)' }}>+0/turn</span>
            </div>
          </div>
          <div className="card" style={{ margin: 0 }}>
            <div className="card-title" style={{ marginBottom: '10px' }}>Tavern upgrades</div>
            <div id="tavern-upgrade-list"></div>
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
            <select id="merc-unit" className="input" style={{ fontSize: '12px' }}>
              <option value="fighters">Fighters</option>
              <option value="rangers">Rangers</option>
              <option value="mages">Mages</option>
              <option value="clerics">Clerics</option>
              <option value="thieves">Thieves</option>
              <option value="ninjas">Ninjas</option>
            </select>
            <select id="merc-tier" className="input" style={{ fontSize: '12px' }} onChange={updateMercPreview}>
              <option value="rabble">Rabble (Lv 5–10)</option>
              <option value="sellsword">Sellsword (Lv 15–25)</option>
              <option value="veteran">Veteran (Lv 30–45)</option>
              <option value="elite">Elite (Lv 50–65)</option>
            </select>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <input type="number" className="input" id="merc-count" min="1" defaultValue="0" style={{ textAlign: 'right', width: '100%', flex: 1 }} onChange={handleUpdateMercPreview} placeholder="Qty" />
              <button className="base-btn" style={{ fontSize: '10px', padding: '3px 6px' }} onClick={() => setMaxValue('merc-count', 'gold')}>Max</button>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text3)' }} id="merc-preview">
              50 GC · 10 turns
            </div>
            <div className="merc-btn-col">
              <button className="base-btn variant-amber w-full" style={{ background: '#d97706', color: '#fff', width: '100%' }} onClick={hireMercs}>Hire</button>
            </div>
          </div>
          <div id="active-mercs-list">
            <div style={{ color: 'var(--text3)', fontSize: '13px', textAlign: 'center', padding: '12px' }}>
              No mercenaries under contract.
            </div>
          </div>
        </div>
      </div>

      {/* BANK TAB */}
      <div style={{ display: activeTab === 'bank' ? 'block' : 'none' }}>
        <div
          id="bank-locked-msg"
          style={{
            display: 'none',
            padding: '24px',
            textAlign: 'center',
            color: 'var(--text2)',
            background: 'var(--bg2)',
            borderRadius: '8px',
          }}
        >
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>🏦</div>
          <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '8px' }}>Bank Locked</div>
          <div style={{ fontSize: '14px' }}>Construct at least 25 Vaults to access the Royal Bank.</div>
        </div>

        <div id="bank-content" style={{ display: 'none' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '12px',
              marginBottom: '16px',
            }}
          >
            <div className="card" style={{ margin: 0 }}>
              <div className="card-title">Fixed-Term Deposits</div>
              <div style={{ color: 'var(--text3)', fontSize: '12px', marginBottom: '12px' }}>
                Deposit your gold to earn a guaranteed return over time. You
                cannot withdraw early.
              </div>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                <input type="number" className="input" id="bank-deposit-amount" placeholder="Amount" min="1" style={{ flex: 1 }} />
                <select id="bank-deposit-term" className="input" style={{ flex: 1 }}>
                  <option value="0">10 Turns (2% yield)</option>
                  <option value="1">25 Turns (7% yield)</option>
                  <option value="2">50 Turns (15% yield)</option>
                  <option value="3">150 Turns (25% yield)</option>
                  <option value="4" id="bank-term-iron">300 Turns (60% yield)</option>
                </select>
              </div>
              <button className="base-btn variant-gold w-full" style={{ background: 'var(--gold)', color: '#000', width: '100%' }} onClick={makeBankDeposit}>
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
      <div style={{ display: activeTab === 'trade-routes' ? 'block' : 'none' }}>
        <div className="card" style={{ marginTop: 0, marginBottom: '20px' }}>
          <div className="card-title">Establish New Route</div>
          <div style={{ fontSize: '12px', color: 'var(--text3)', marginBottom: '12px' }}>
            Requires: 10,000 GC. Permanent routes provide steady income and
            improve with stability.
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <select id="trade-target-list" className="input" style={{ flex: 1 }}>
              <option value="">— Select Target Kingdom —</option>
            </select>
            <button className="base-btn variant-gold" style={{ background: 'var(--gold)', color: '#000' }} onClick={handleEstablishTradeRoute}>
              Establish 🤝
            </button>
          </div>
        </div>
        <div className="card" style={{ marginTop: 0 }}>
          <div className="card-title">Active Trade Routes</div>
          <div style={{ fontSize: '12px', color: 'var(--text3)', marginBottom: '16px' }}>
            Established connections with other kingdoms provide steady gold income
            each turn. Stability increases over time, improving efficiency.
          </div>
          <div id="trade-routes-list">
            <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text3)' }}>
              No active trade routes. Discover other kingdoms and establish routes
              to earn gold!
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media (min-width: 768px) {
          .tax-slider-container {
            max-width: 600px;
          }
        }
      `}</style>
    </div>
  );
};

export default EconomyPanel;
