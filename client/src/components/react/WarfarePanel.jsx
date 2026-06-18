import React, { useState, useEffect } from 'react';

const WarfarePanel = () => {
  const [activeTab, setActiveTab] = useState('attack');
  const [wcovTargetRace, setWcovTargetRace] = useState(null);

  useEffect(() => {
    const handleRaceChange = (e) => setWcovTargetRace(e.detail);
    window.addEventListener('wcovTargetRaceChange', handleRaceChange);
    window.setWarfareTab = setActiveTab;
    if (window.__pendingWarfareTab) {
      setActiveTab(window.__pendingWarfareTab);
      window.__pendingWarfareTab = null;
    }
    return () => {
      window.removeEventListener('wcovTargetRaceChange', handleRaceChange);
      delete window.setWarfareTab;
    };
  }, []);

  const handleTabClick = (tabId) => {
    setActiveTab(tabId);
    if (tabId === "wspells" && window.initWspells) window.initWspells();
    if (tabId === "wcovert" && window.initWcovert) window.initWcovert();
    if (tabId === "wreports" && window.loadWarLog) window.loadWarLog();
    if (tabId === "wintel") {
      if (window.loadSpyReports) window.loadSpyReports();
      if (window.loadAllianceIntel) window.loadAllianceIntel();
    }
  };

  const updateAtkEstimateW = () => {
    if (window.updateAtkEstimateW) window.updateAtkEstimateW();
  };

  const setMaxValue = (inputId) => {
    if (window.setMaxValue) window.setMaxValue(inputId);
  };

  const launchAttackW = () => {
    if (window.launchAttackW) window.launchAttackW();
  };

  const castWspell = () => {
    if (window.castWspell) window.castWspell();
  };

  const doWcovert = (type) => {
    if (window.doWcovert) window.doWcovert(type);
  };

  const updateWspellCalc = () => {
    if (window.updateWspellCalc) window.updateWspellCalc();
  };

  const filterWarfareTargetsUnified = (val, targetListId) => {
    if (window.filterWarfareTargetsUnified) {
      window.filterWarfareTargetsUnified(val, targetListId);
    }
  };

  const handleTargetSearchW = (event) => {
    const val = event?.target ? event.target.value : event;
    filterWarfareTargetsUnified(val, "atk-target-list-w");
  };

  const handleTargetSearchWsp = (event) => {
    const val = event?.target ? event.target.value : event;
    filterWarfareTargetsUnified(val, "wsp-target-list-w");
  };

  const handleTargetSearchWco = (event) => {
    const val = event?.target ? event.target.value : event;
    filterWarfareTargetsUnified(val, "wcov-target-list-w");
  };

  const loadWarfarePanel = () => {
    if (window.loadWarfarePanel) window.loadWarfarePanel();
  };

  const loadSpyReports = () => {
    if (window.loadSpyReports) window.loadSpyReports();
  };

  const loadAllianceIntel = () => {
    if (window.loadAllianceIntel) window.loadAllianceIntel();
  };

  return (
    <div id="warfare" className="panel" style={{ display: 'none' }}>
      {/* Tabs */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', borderBottom: '2px solid var(--border2)', marginBottom: '16px', paddingBottom: '4px' }}>
        <button className={`base-btn admin-tab ${activeTab === 'attack' ? 'active' : ''}`} onClick={() => handleTabClick('attack')} style={{ borderRadius: 0 }}>⚔️ Attack</button>
        <button className={`base-btn admin-tab ${activeTab === 'wspells' ? 'active' : ''}`} onClick={() => handleTabClick('wspells')} style={{ borderRadius: 0 }}>✨ Spells</button>
        <button className={`base-btn admin-tab ${activeTab === 'wcovert' ? 'active' : ''}`} onClick={() => handleTabClick('wcovert')} style={{ borderRadius: 0 }}>🕵️ Covert</button>
        <button className={`base-btn admin-tab ${activeTab === 'wintel' ? 'active' : ''}`} onClick={() => handleTabClick('wintel')} style={{ borderRadius: 0 }}>📊 Intel</button>
        <button className={`base-btn admin-tab ${activeTab === 'wreports' ? 'active' : ''}`} onClick={() => handleTabClick('wreports')} style={{ borderRadius: 0 }}>📜 Reports</button>
      </div>

      {/* WAR REPORTS TAB */}
      <div style={{ display: activeTab === 'wreports' ? 'block' : 'none' }}>
        <div className="card" style={{ marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>📜 War &amp; Covert Reports</span>
            <button className="base-btn" style={{ fontSize: '11px', padding: '4px 10px' }} onClick={loadWarfarePanel}>↻ Refresh</button>
          </div>
          <div id="war-log-list-warfare" style={{ maxHeight: '500px', overflowY: 'auto' }}></div>
        </div>
      </div>

      {/* INTEL TAB */}
      <div style={{ display: activeTab === 'wintel' ? 'block' : 'none' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div className="card">
            <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>🕵️ Your Spy Reports</span>
              <button className="base-btn" style={{ fontSize: '10px', padding: '2px 6px' }} onClick={loadSpyReports}>↻</button>
            </div>
            <div id="spy-reports-list" style={{ maxHeight: '500px', overflowY: 'auto', fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ color: 'var(--text3)', padding: '20px', textAlign: 'center' }}>No reports yet. Send spies to gather intel.</div>
            </div>
          </div>
          <div className="card">
            <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>🤝 Alliance Intelligence</span>
              <button className="base-btn" style={{ fontSize: '10px', padding: '2px 6px' }} onClick={loadAllianceIntel}>↻</button>
            </div>
            <div id="alliance-intel-list" style={{ maxHeight: '500px', overflowY: 'auto', fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ color: 'var(--text3)', padding: '20px', textAlign: 'center' }}>No shared reports in your alliance.</div>
            </div>
          </div>
        </div>
      </div>

      {/* ATTACK TAB */}
      <div style={{ display: activeTab === 'attack' ? 'block' : 'none' }}>
        <div className="card" id="atk-panel-w">
          <div className="card-title" style={{ marginBottom: '12px' }}>Warfare: Army Selection</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '20px' }}>
            <div className="trow">
              <span className="name" style={{ fontSize: '13px', fontWeight: 700 }}>
                ⚔️ Fighters <span id="atk-fighters-avail-w" style={{ color: 'var(--text3)', fontWeight: 400 }}></span>
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <input type="number" className="input" id="atk-fighters-w" min="0" defaultValue="0" style={{ textAlign: 'right', width: '90px', padding: '6px' }} onChange={updateAtkEstimateW} placeholder="Qty" />
                <button className="base-btn" style={{ fontSize: '10px', padding: '6px 8px' }} onClick={() => setMaxValue('atk-fighters-w')}>MAX</button>
              </div>
            </div>
            <div className="trow">
              <span className="name" style={{ fontSize: '13px', fontWeight: 700 }}>
                🏹 Rangers <span id="atk-rangers-avail-w" style={{ color: 'var(--text3)', fontWeight: 400 }}></span>
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <input type="number" className="input" id="atk-rangers-w" min="0" defaultValue="0" style={{ textAlign: 'right', width: '90px', padding: '6px' }} onChange={updateAtkEstimateW} placeholder="Qty" />
                <button className="base-btn" style={{ fontSize: '10px', padding: '6px 8px' }} onClick={() => setMaxValue('atk-rangers-w')}>MAX</button>
              </div>
            </div>
            <div className="trow">
              <span className="name" style={{ fontSize: '13px', fontWeight: 700 }}>
                ✨ Mages <span id="atk-mages-avail-w" style={{ color: 'var(--text3)', fontWeight: 400 }}></span>
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <input type="number" className="input" id="atk-mages-w" min="0" defaultValue="0" style={{ textAlign: 'right', width: '90px', padding: '6px' }} onChange={updateAtkEstimateW} placeholder="Qty" />
                <button className="base-btn" style={{ fontSize: '10px', padding: '6px 8px' }} onClick={() => setMaxValue('atk-mages-w')}>MAX</button>
              </div>
            </div>
            <div className="trow">
              <span className="name" style={{ fontSize: '13px', fontWeight: 700 }}>
                ⛪ Clerics <span id="atk-clerics-avail-w" style={{ color: 'var(--text3)', fontWeight: 400 }}></span>
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <input type="number" className="input" id="atk-clerics-w" min="0" defaultValue="0" style={{ textAlign: 'right', width: '90px', padding: '6px' }} onChange={updateAtkEstimateW} placeholder="Qty" />
                <button className="base-btn" style={{ fontSize: '10px', padding: '6px 8px' }} onClick={() => setMaxValue('atk-clerics-w')}>MAX</button>
              </div>
            </div>
            {/* Siege units */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '8px', marginTop: '4px' }}>
              <div className="trow">
                <span className="name" style={{ fontSize: '13px', fontWeight: 700 }}>
                  ⚙️ War Machines <span id="atk-wm-avail-w" style={{ color: 'var(--text3)', fontWeight: 400 }}></span>
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <input type="number" className="input" id="atk-wm-w" min="0" defaultValue="0" style={{ textAlign: 'right', width: '90px', padding: '6px' }} onChange={updateAtkEstimateW} placeholder="Qty" />
                  <button className="base-btn" style={{ fontSize: '10px', padding: '6px 8px' }} onClick={() => setMaxValue('atk-wm-w')}>MAX</button>
                </div>
              </div>
              <div className="trow">
                <span className="name" style={{ fontSize: '13px', fontWeight: 700 }}>
                  🪜 Ladders <span id="atk-ladders-avail-w" style={{ color: 'var(--text3)', fontWeight: 400 }}></span>
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <input type="number" className="input" id="atk-ladders-w" min="0" defaultValue="0" style={{ textAlign: 'right', width: '90px', padding: '6px' }} onChange={updateAtkEstimateW} placeholder="Qty" />
                  <button className="base-btn" style={{ fontSize: '10px', padding: '6px 8px' }} onClick={() => setMaxValue('atk-ladders-w')}>MAX</button>
                </div>
              </div>
            </div>
            {/* Covert units */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '8px', marginTop: '4px' }}>
              <div className="trow">
                <span className="name" style={{ fontSize: '13px', fontWeight: 700 }}>
                  🕵️ Ninjas <span id="atk-ninjas-avail-w" style={{ color: 'var(--text3)', fontWeight: 400 }}></span>
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <input type="number" className="input" id="atk-ninjas-w" min="0" defaultValue="0" style={{ textAlign: 'right', width: '90px', padding: '6px' }} onChange={updateAtkEstimateW} placeholder="Qty" />
                  <button className="base-btn" style={{ fontSize: '10px', padding: '6px 8px' }} onClick={() => setMaxValue('atk-ninjas-w')}>MAX</button>
                </div>
              </div>
              <div className="trow">
                <span className="name" style={{ fontSize: '13px', fontWeight: 700 }}>
                  🗝️ Thieves <span id="atk-thieves-avail-w" style={{ color: 'var(--text3)', fontWeight: 400 }}></span>
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <input type="number" className="input" id="atk-thieves-w" min="0" defaultValue="0" style={{ textAlign: 'right', width: '90px', padding: '6px' }} onChange={updateAtkEstimateW} placeholder="Qty" />
                  <button className="base-btn" style={{ fontSize: '10px', padding: '6px 8px' }} onClick={() => setMaxValue('atk-thieves-w')}>MAX</button>
                </div>
              </div>
            </div>
            {/* Support units */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '8px', marginTop: '4px' }}>
              <div className="trow">
                <span className="name" style={{ fontSize: '13px', fontWeight: 700 }}>
                  🛠️ Engineers <span id="atk-engineers-avail-w" style={{ color: 'var(--text3)', fontWeight: 400 }}></span>
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <input type="number" className="input" id="atk-engineers-w" min="0" defaultValue="0" style={{ textAlign: 'right', width: '90px', padding: '6px' }} onChange={updateAtkEstimateW} placeholder="Qty" />
                  <button className="base-btn" style={{ fontSize: '10px', padding: '6px 8px' }} onClick={() => setMaxValue('atk-engineers-w')}>MAX</button>
                </div>
              </div>
            </div>
          </div>

          {/* Unified Target Selector BELOW inputs */}
          <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '8px', padding: '12px', marginBottom: '16px', borderLeft: '4px solid var(--red)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700 }}>
                Target Kingdom
              </div>
              <div id="atk-target-info-w" style={{ fontSize: '11px', color: 'var(--text3)' }}></div>
            </div>
            <div id="atk-target-name-w" style={{ fontSize: '16px', fontWeight: 700, color: 'var(--gold)', marginBottom: '12px' }}>
              — none selected —
            </div>

            <input type="text" className="input" id="atk-target-search-w" placeholder="Search mapped realms..." style={{ width: '100%', marginBottom: '8px', background: 'var(--bg1)' }} onChange={handleTargetSearchW} />
            <div id="atk-target-list-w" style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--bg2)', padding: '4px' }}>
              <div style={{ color: 'var(--text3)', fontSize: '13px', textAlign: 'center', padding: '20px' }}>Loading mapped realms...</div>
            </div>
          </div>

          <div style={{ background: 'var(--bg4)', borderRadius: 'var(--radius)', padding: '10px 12px', marginBottom: '12px', fontSize: '12px', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
              <span style={{ color: 'var(--text3)' }}>Attack power</span><span id="atk-est-power-w" style={{ fontWeight: 700 }}>—</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
              <span style={{ color: 'var(--text3)' }}>Est. defense</span><span id="atk-est-def-w" style={{ color: 'var(--red)' }}>—</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
              <span style={{ color: 'var(--text3)' }}>Win probability</span><span id="atk-est-winpct-w" style={{ fontWeight: 700 }}>—</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text3)' }}>Land on win</span><span id="atk-est-land-w" style={{ color: 'var(--gold)' }}>—</span>
            </div>
            <div id="atk-bully-warn-w" style={{ display: 'none', color: 'var(--amber)', marginTop: '6px', paddingTop: '6px', borderTop: '1px solid var(--border)' }}></div>
          </div>
          <button className="base-btn variant-red w-full" style={{ fontSize: '14px', padding: '12px', fontWeight: 700, background: 'var(--red)', width: '100%' }} onClick={launchAttackW}>
            ⚔️ LAUNCH ATTACK
          </button>
        </div>
      </div>

      {/* SPELLS TAB */}
      <div style={{ display: activeTab === 'wspells' ? 'block' : 'none' }}>
        <div className="card" style={{ marginBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>
              Spellbook: <span id="wsp-sb">0</span> · Mana: <span id="wsp-mana">0</span>
            </div>
          </div>
          <div id="wsp-spell-list" style={{ maxHeight: '280px', overflowY: 'auto' }}></div>
        </div>

        <div className="card">
          <div className="card-title" style={{ marginBottom: '10px' }}>Cast Spell</div>
          {/* Unified Target Selector */}
          <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '8px', padding: '12px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700 }}>Target Realm</div>
              <div id="wsp-cast-info" style={{ fontSize: '11px', color: 'var(--text3)' }}></div>
            </div>
            <div id="wsp-cast-target" style={{ fontSize: '15px', fontWeight: 700, color: 'var(--accent1)', marginBottom: '12px' }}>
              — none selected —
            </div>
            <input type="text" className="input" id="wsp-target-search-w" placeholder="Search mapped kingdoms..." style={{ width: '100%', marginBottom: '8px', background: 'var(--bg1)' }} onChange={handleTargetSearchWsp} />
            <div id="wsp-target-list-w" style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--bg2)', padding: '4px' }}>
              <div style={{ color: 'var(--text3)', fontSize: '13px', textAlign: 'center', padding: '20px' }}>Loading mapped realms...</div>
            </div>
          </div>

          <div style={{ background: 'var(--bg3)', borderRadius: 'var(--radius)', padding: '10px 12px', marginBottom: '10px', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '11px', color: 'var(--text3)' }}>Selected spell</div>
            <div id="wsp-cast-name" style={{ fontSize: '14px', fontWeight: 600, color: 'var(--accent1)' }}>— none selected —</div>
            <div id="wsp-cast-desc" style={{ fontSize: '11px', color: 'var(--text2)', marginTop: '2px' }}></div>
          </div>
          <div style={{ marginBottom: '10px' }}>
            <div style={{ fontSize: '11px', color: 'var(--text3)', marginBottom: '4px' }}>Obscure cast (hides identity)</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input type="range" className="input" id="wsp-obscure" min="0" max="1" step="1" defaultValue="0" onChange={updateWspellCalc} />
              <span id="wsp-obscure-val" style={{ fontSize: '12px', color: 'var(--text)' }}>Off</span>
            </div>
          </div>
          <div style={{ background: 'var(--bg4)', borderRadius: 'var(--radius)', padding: '10px 12px', marginBottom: '10px', fontSize: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
              <span style={{ color: 'var(--text3)' }}>Scroll required</span><span id="wsp-scroll" style={{ color: 'var(--accent1)' }}>—</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
              <span style={{ color: 'var(--text3)' }}>Scrolls held</span><span id="wsp-scrolls-held">0</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
              <span style={{ color: 'var(--text2)' }}>Total mana cost</span><span id="wsp-total-mana" style={{ color: 'var(--gold)' }}>—</span>
            </div>
          </div>
          <button className="base-btn variant-accent w-full" style={{ padding: '10px', fontSize: '14px', width: '100%', background: 'var(--accent1)' }} onClick={castWspell}>
            ✨ Cast spell
          </button>
        </div>
      </div>

      {/* COVERT TAB */}
      <div style={{ display: activeTab === 'wcovert' ? 'block' : 'none' }}>
        <div className="card" style={{ marginBottom: '12px' }}>
          <div className="card-title" style={{ marginBottom: '12px' }}>Covert Operations Selection</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', marginBottom: '12px' }}>
            {/* Spy */}
            <div style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '12px', background: 'rgba(0, 0, 0, 0.1)', borderLeft: '3px solid var(--blue)' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '4px' }}>🔍 Spy</div>
              <div style={{ fontSize: '10px', color: 'var(--text3)', marginBottom: '8px', lineHeight: 1.2 }}>Map terrain and gather enemy stats.</div>
              <select id="wcov-spy-type" className="input" style={{ width: '100%', marginBottom: '6px', fontSize: '11px' }}>
                <option value="full">Full Report</option>
                <option value="terrain">Terrain &amp; Army</option>
                <option value="buildings">Buildings</option>
                <option value="economy">Economy</option>
              </select>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '8px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text3)', whiteSpace: 'nowrap' }}>Thieves</span>
                <input type="number" className="input" id="wcov-spy-units" min="0" defaultValue="0" style={{ textAlign: 'right', flex: 1, padding: '4px', fontSize: '12px' }} placeholder="Qty" />
                <button className="base-btn" style={{ fontSize: '10px', padding: '4px 7px' }} onClick={() => setMaxValue('wcov-spy-units')}>MAX</button>
              </div>
              <button className="base-btn w-full" style={{ fontSize: '11px', width: '100%' }} onClick={() => doWcovert('spy')}>🔍 SPY</button>
            </div>
            
            {/* Loot */}
            <div style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '12px', background: 'rgba(0, 0, 0, 0.1)', borderLeft: '3px solid var(--gold)' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '4px' }}>💰 Loot</div>
              <div style={{ fontSize: '10px', color: 'var(--text3)', marginBottom: '8px', lineHeight: 1.2 }}>Steal gold, research, or resources.</div>
              <select id="wcov-loot-type" className="input" style={{ width: '100%', marginBottom: '6px', fontSize: '11px' }}>
                <option value="gold">Gold</option>
                <option value="food">Food</option>
                <option value="war_machines">War Machines</option>
                <option value="maps">Maps</option>
                <option value="blueprints">Blueprints</option>
                <option value="hammers">Hammers</option>
                <option value="research">Research (random type)</option>
                <option value="resources">Resources (random type)</option>
                <option value="trade_routes">Trade Routes</option>
              </select>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '8px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text3)', whiteSpace: 'nowrap' }}>Thieves</span>
                <input type="number" className="input" id="wcov-loot-thieves" min="0" defaultValue="0" style={{ textAlign: 'right', flex: 1, padding: '4px', fontSize: '12px' }} placeholder="Qty" />
                <button className="base-btn" style={{ fontSize: '10px', padding: '4px 7px' }} onClick={() => setMaxValue('wcov-loot-thieves')}>MAX</button>
              </div>
              <button className="base-btn variant-gold w-full" style={{ fontSize: '11px', width: '100%', background: 'var(--gold)', color: '#000' }} onClick={() => doWcovert('loot')}>💰 RAID</button>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', marginBottom: '12px' }}>
            {/* Assassinate */}
            <div style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '12px', background: 'rgba(0, 0, 0, 0.1)', borderLeft: '3px solid var(--red)' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '4px' }}>🗡️ Assassinate</div>
              <select id="wcov-assass-type" className="input" style={{ width: '100%', marginBottom: '6px', fontSize: '11px' }}>
                <option value="fighters">Fighters</option>
                <option value="rangers">Rangers</option>
                {wcovTargetRace === 'vampire' ? <option value="thralls">Thralls</option> : <option value="clerics">Clerics</option>}
                <option value="mages">Mages</option>
                <option value="thieves">Thieves</option>
                <option value="ninjas">Ninjas</option>
                <option value="researchers">Researchers</option>
                <option value="engineers">Engineers</option>
                <option value="scribes">Scribes</option>
              </select>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '8px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text3)', whiteSpace: 'nowrap' }}>Ninjas</span>
                <input type="number" className="input" id="wcov-assn-ninjas" min="0" defaultValue="0" style={{ textAlign: 'right', flex: 1, padding: '4px', fontSize: '12px' }} placeholder="Qty" />
                <button className="base-btn" style={{ fontSize: '10px', padding: '4px 7px' }} onClick={() => setMaxValue('wcov-assn-ninjas')}>MAX</button>
              </div>
              <button className="base-btn variant-red w-full" style={{ fontSize: '11px', width: '100%', background: 'var(--red)' }} onClick={() => doWcovert('assassinate')}>🗡️ KILL</button>
            </div>

            {/* Sabotage */}
            <div style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '12px', background: 'rgba(0, 0, 0, 0.1)', borderLeft: '3px solid var(--amber)' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '4px' }}>💣 Sabotage</div>
              <select id="wcov-sab-type" className="input" style={{ width: '100%', marginBottom: '6px', fontSize: '11px' }}>
                <option value="war_machines">War Machines</option>
                <option value="farms">Farms</option>
                <option value="granaries">Granaries</option>
                <option value="barracks">Barracks</option>
                <option value="guard_towers">Guard Towers</option>
                <option value="schools">Schools</option>
                <option value="armories">Armories</option>
                <option value="vaults">Vaults</option>
                <option value="smithies">Smithies</option>
                <option value="markets">Markets</option>
                <option value="mage_towers">Mage Towers</option>
                <option value="shrines">Shrines</option>
                <option value="training">Training Grounds</option>
                <option value="castles">Castles</option>
                <option value="housing">Housing</option>
                <option value="libraries">Libraries</option>
                <option value="taverns">Taverns</option>
                <option value="mausoleums">Mausoleums</option>
                <option value="walls">Walls</option>
                <option value="outposts">Outposts</option>
              </select>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '8px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text3)', whiteSpace: 'nowrap' }}>Thieves</span>
                <input type="number" className="input" id="wcov-sab-thieves" min="0" defaultValue="0" style={{ textAlign: 'right', flex: 1, padding: '4px', fontSize: '12px' }} placeholder="Qty" />
                <button className="base-btn" style={{ fontSize: '10px', padding: '4px 7px' }} onClick={() => setMaxValue('wcov-sab-thieves')}>MAX</button>
              </div>
              <button className="base-btn variant-amber w-full" style={{ fontSize: '11px', width: '100%', background: '#d97706', color: '#fff' }} onClick={() => doWcovert('sabotage')}>💣 SABOTAGE</button>
            </div>
          </div>
          
          {/* Unified Target Selector BELOW inputs */}
          <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '8px', padding: '12px', marginBottom: '8px', borderLeft: '4px solid var(--accent1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700 }}>
                Target Kingdom
              </div>
              <div id="wcov-target-info" style={{ fontSize: '11px', color: 'var(--text3)' }}></div>
            </div>
            <div id="wcov-target-name" style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)', marginBottom: '12px' }}>— none selected —</div>
            <input type="text" className="input" id="wcov-target-search-w" placeholder="Search mapped realms..." style={{ width: '100%', marginBottom: '8px', background: 'var(--bg1)' }} onChange={handleTargetSearchWco} />
            <div id="wcov-target-list-w" style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--bg2)', padding: '4px' }}>
              <div style={{ color: 'var(--text3)', fontSize: '13px', textAlign: 'center', padding: '20px' }}>Loading mapped realms...</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WarfarePanel;
