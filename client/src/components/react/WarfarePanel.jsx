import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { apiCall } from '../../utils/api';
import WarfareIntelTab from './WarfareIntelTab';
import WarfareReportsTab from './WarfareReportsTab';

const WarfarePanel = () => {
  const [activeTab, setActiveTab] = useState('attack');
  const [wcovTargetRace, setWcovTargetRace] = useState(null);
  const [warLogRows, setWarLogRows] = useState([]);
  const [spyReports, setSpyReports] = useState([]);
  const [allianceIntel, setAllianceIntel] = useState([]);
  const [loadingWarLog, setLoadingWarLog] = useState(true);
  const [loadingSpyReports, setLoadingSpyReports] = useState(true);
  const [loadingAllianceIntel, setLoadingAllianceIntel] = useState(true);
  const [warLogError, setWarLogError] = useState('');
  const [spyError, setSpyError] = useState('');
  const [allianceError, setAllianceError] = useState('');

  const refreshAttackTargets = useCallback(async () => {
    if (window.loadRankings) await window.loadRankings(true);
    if (window.loadWarfarePanel) window.loadWarfarePanel();
  }, []);

  const loadWarLog = useCallback(async () => {
    setLoadingWarLog(true);
    setWarLogError('');
    try {
      const result = await apiCall('/api/kingdom/war-log');
      if (result?.error) throw new Error(result.error);
      const rows = Array.isArray(result) ? result : Array.isArray(result?.rows) ? result.rows : [];
      setWarLogRows(rows);
    } catch (err) {
      console.error('[WarfarePanel] Failed to load war log:', err);
      setWarLogError(err.message || 'Failed to load war log');
    } finally {
      setLoadingWarLog(false);
    }
  }, []);

  const loadSpyReports = useCallback(async () => {
    setLoadingSpyReports(true);
    setSpyError('');
    try {
      const result = await apiCall('/api/kingdom/spy-reports');
      if (result?.error) throw new Error(result.error);
      setSpyReports(Array.isArray(result) ? result : []);
      window.spyReportsCache = Array.isArray(result) ? result : [];
    } catch (err) {
      console.error('[WarfarePanel] Failed to load spy reports:', err);
      setSpyError(err.message || 'Failed to load spy reports');
    } finally {
      setLoadingSpyReports(false);
    }
  }, []);

  const loadAllianceIntel = useCallback(async () => {
    setLoadingAllianceIntel(true);
    setAllianceError('');
    try {
      const result = await apiCall('/api/kingdom/spy-reports/alliance');
      if (result?.error) throw new Error(result.error);
      setAllianceIntel(Array.isArray(result) ? result : []);
      window.allianceIntelCache = Array.isArray(result) ? result : [];
    } catch (err) {
      console.error('[WarfarePanel] Failed to load alliance intel:', err);
      setAllianceError(err.message || 'Failed to load alliance intel');
    } finally {
      setLoadingAllianceIntel(false);
    }
  }, []);

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
  }, [refreshAttackTargets]);

  useEffect(() => {
    if (activeTab === 'attack') {
      refreshAttackTargets();
    } else if (activeTab === 'wreports') {
      loadWarLog();
    } else if (activeTab === 'wintel') {
      loadSpyReports();
      loadAllianceIntel();
    }
  }, [activeTab, loadAllianceIntel, loadSpyReports, loadWarLog, refreshAttackTargets]);

  const handleTabClick = (tabId) => {
    setActiveTab(tabId);
    if (tabId === 'wspells' && window.initWspells) window.initWspells();
    if (tabId === 'wcovert' && window.initWcovert) window.initWcovert();
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
    filterWarfareTargetsUnified(val, 'atk-target-list-w');
  };

  const handleTargetSearchWsp = (event) => {
    const val = event?.target ? event.target.value : event;
    filterWarfareTargetsUnified(val, 'wsp-target-list-w');
  };

  const handleTargetSearchWco = (event) => {
    const val = event?.target ? event.target.value : event;
    filterWarfareTargetsUnified(val, 'wcov-target-list-w');
  };

  const loadWarfarePanel = () => {
    if (window.loadWarfarePanel) window.loadWarfarePanel();
  };

  const fmtDate = (value) => {
    if (!value) return 'Just now';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Just now' : date.toLocaleString();
  };

  const renderDetail = (detail) => {
    if (!detail) return null;
    if (typeof detail === 'string') return detail;
    try {
      return JSON.stringify(detail, null, 2);
    } catch {
      return String(detail);
    }
  };

  const warLogContent = useMemo(() => {
    if (loadingWarLog) {
      return <div style={{ color: 'var(--text3)', fontSize: '13px', textAlign: 'center', padding: '24px 0' }}>Loading...</div>;
    }
    if (warLogError) {
      return <div style={{ color: 'var(--red)', textAlign: 'center', padding: '20px' }}>{warLogError}</div>;
    }
    if (!warLogRows.length) {
      return (
        <div style={{ textAlign: 'center', padding: '32px 16px' }}>
          <div style={{ fontSize: '32px', marginBottom: '10px' }}>🕊️</div>
          <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text2)', marginBottom: '6px' }}>It's been a quiet day.</div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--red)' }}>BREAK SOME $#@&!</div>
        </div>
      );
    }
    return warLogRows.map((row) => {
      const icon = ({
        attack: '⚔️',
        raid: '🛶',
        spy: '🕵️',
        loot: '💰',
        assassinate: '🗡️',
        sabotage: '🧨',
      })[row.action_type] || '⚔️';
      const outcome = row.outcome === 'victory' || row.outcome === 'success'
        ? 'Success'
        : row.outcome === 'caught'
          ? 'Caught'
          : 'Repelled';
      const outcomeColor = row.outcome === 'victory' || row.outcome === 'success'
        ? 'var(--green)'
        : row.outcome === 'caught'
          ? 'var(--amber)'
          : 'var(--text3)';
      return (
        <div key={row.id} style={{ borderBottom: '1px solid var(--border)', padding: '12px 4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'baseline', flexWrap: 'wrap' }}>
            <div style={{ color: 'var(--text)', fontWeight: 700 }}>
              <span style={{ marginRight: '8px' }}>{icon}</span>
              {row.action_type || 'event'} — {row.attacker_name || 'Unknown'} vs {row.defender_name || 'Unknown'}
            </div>
            <div style={{ color: outcomeColor, fontWeight: 700 }}>{outcome}</div>
          </div>
          {row.detail ? (
            <pre style={{ margin: '8px 0 0', whiteSpace: 'pre-wrap', color: 'var(--text2)', fontSize: '12px' }}>{renderDetail(row.detail)}</pre>
          ) : null}
          <div style={{ marginTop: '6px', color: 'var(--text3)', fontSize: '11px' }}>{fmtDate(row.created_at)}</div>
        </div>
      );
    });
  }, [loadingWarLog, warLogError, warLogRows]);

  const spyReportsContent = useMemo(() => {
    if (loadingSpyReports) {
      return <div style={{ color: 'var(--text3)', padding: '20px', textAlign: 'center' }}>Loading spy reports...</div>;
    }
    if (spyError) {
      return <div style={{ color: 'var(--red)', padding: '20px', textAlign: 'center' }}>{spyError}</div>;
    }
    if (!spyReports.length) {
      return <div style={{ color: 'var(--text3)', padding: '20px', textAlign: 'center' }}>No reports yet. Send spies to gather intel.</div>;
    }
    return spyReports.map((row) => (
      <div key={row.id} style={{ border: '1px solid var(--border)', borderRadius: '12px', padding: '12px', marginBottom: '10px', background: 'var(--bg2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
          <div style={{ fontWeight: 700, color: 'var(--text)' }}>{row.target_name || 'Unknown target'}</div>
          <div style={{ color: 'var(--text3)', fontSize: '11px' }}>{fmtDate(row.created_at)}</div>
        </div>
        <div style={{ color: 'var(--text2)', fontSize: '13px', marginBottom: '8px' }}>{row.outcome || 'Unknown outcome'}</div>
        {row.report ? (
          <pre style={{ margin: 0, whiteSpace: 'pre-wrap', color: 'var(--text3)', fontSize: '12px' }}>{renderDetail(row.report)}</pre>
        ) : null}
        <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ color: row.shared_to_alliance ? 'var(--green)' : 'var(--text3)', fontSize: '11px' }}>
            {row.shared_to_alliance ? 'Shared to alliance' : 'Private report'}
          </span>
          <button
            className="btn btn-accent"
            style={{ fontSize: '11px', padding: '4px 10px' }}
            onClick={async () => {
              const res = await apiCall(`/api/kingdom/spy-reports/${row.id}/share`, { method: 'POST' });
              if (res?.error) {
                window.toast?.(res.error, 'error');
                return;
              }
              window.toast?.(res.shared ? 'Report shared to alliance' : 'Report hidden from alliance', 'success');
              loadSpyReports();
              loadAllianceIntel();
            }}
          >
            {row.shared_to_alliance ? 'Unshare' : 'Share'}
          </button>
        </div>
      </div>
    ));
  }, [loadingSpyReports, spyError, spyReports, loadAllianceIntel, loadSpyReports]);

  const allianceIntelContent = useMemo(() => {
    if (loadingAllianceIntel) {
      return <div style={{ color: 'var(--text3)', padding: '20px', textAlign: 'center' }}>Loading alliance intel...</div>;
    }
    if (allianceError) {
      return <div style={{ color: 'var(--red)', padding: '20px', textAlign: 'center' }}>{allianceError}</div>;
    }
    if (!allianceIntel.length) {
      return <div style={{ color: 'var(--text3)', padding: '20px', textAlign: 'center' }}>No shared reports in your alliance.</div>;
    }
    return allianceIntel.map((row) => (
      <div key={row.id} style={{ border: '1px solid var(--border)', borderRadius: '12px', padding: '12px', marginBottom: '10px', background: 'var(--bg2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
          <div style={{ fontWeight: 700, color: 'var(--text)' }}>{row.target_name || 'Unknown target'}</div>
          <div style={{ color: 'var(--text3)', fontSize: '11px' }}>{fmtDate(row.created_at)}</div>
        </div>
        <div style={{ color: 'var(--text2)', fontSize: '13px', marginBottom: '8px' }}>
          Shared by {row.shared_by_name || 'an ally'} · {row.outcome || 'Unknown outcome'}
        </div>
        {row.report ? (
          <pre style={{ margin: 0, whiteSpace: 'pre-wrap', color: 'var(--text3)', fontSize: '12px' }}>{renderDetail(row.report)}</pre>
        ) : null}
      </div>
    ));
  }, [allianceError, allianceIntel, loadingAllianceIntel]);

  return (
    <div id="warfare" className="panel" style={{ display: 'none' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', borderBottom: '2px solid var(--border2)', marginBottom: '16px', paddingBottom: '4px' }}>
        <button className={`base-btn admin-tab ${activeTab === 'attack' ? 'active' : ''}`} onClick={() => handleTabClick('attack')} style={{ borderRadius: 0 }}>⚔️ Attack</button>
        <button className={`base-btn admin-tab ${activeTab === 'wspells' ? 'active' : ''}`} onClick={() => handleTabClick('wspells')} style={{ borderRadius: 0 }}>✨ Spells</button>
        <button className={`base-btn admin-tab ${activeTab === 'wcovert' ? 'active' : ''}`} onClick={() => handleTabClick('wcovert')} style={{ borderRadius: 0 }}>🕵️ Covert</button>
        <button className={`base-btn admin-tab ${activeTab === 'wintel' ? 'active' : ''}`} onClick={() => handleTabClick('wintel')} style={{ borderRadius: 0 }}>📊 Intel</button>
        <button className={`base-btn admin-tab ${activeTab === 'wreports' ? 'active' : ''}`} onClick={() => handleTabClick('wreports')} style={{ borderRadius: 0 }}>📝 Reports</button>
      </div>

      <WarfareReportsTab
        isActive={activeTab === 'wreports'}
        content={warLogContent}
        onRefresh={loadWarLog}
      />

      <WarfareIntelTab
        isActive={activeTab === 'wintel'}
        spyContent={spyReportsContent}
        allianceContent={allianceIntelContent}
        onRefreshSpyReports={loadSpyReports}
        onRefreshAllianceIntel={loadAllianceIntel}
      />

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
            </div>
            <button className="btn btn-red" style={{ fontWeight: 700, marginTop: '8px' }} onClick={launchAttackW}>⚔️ Launch Attack</button>
          </div>
        </div>
      </div>

      <div style={{ display: activeTab === 'wspells' ? 'block' : 'none' }}>
        <div className="card">
          <div className="card-title">Warfare Spells</div>
          <div style={{ color: 'var(--text3)', fontSize: '13px' }}>Spell casting remains on the existing shell path for now.</div>
          <div style={{ marginTop: '12px' }}>
            <button className="base-btn" onClick={castWspell}>Prepare Spell Targeting</button>
            <button className="base-btn" style={{ marginLeft: '8px' }} onClick={updateWspellCalc}>Refresh Spell Estimates</button>
          </div>
        </div>
      </div>

      <div style={{ display: activeTab === 'wcovert' ? 'block' : 'none' }}>
        <div className="card">
          <div className="card-title">Warfare Covert Ops</div>
          <div style={{ color: 'var(--text3)', fontSize: '13px' }}>Covert targeting still uses the existing shell helpers.</div>
          <div style={{ marginTop: '12px' }}>
            <button className="base-btn" onClick={() => doWcovert('spy')}>Spy</button>
            <button className="base-btn" style={{ marginLeft: '8px' }} onClick={() => doWcovert('loot')}>Loot</button>
            <button className="base-btn" style={{ marginLeft: '8px' }} onClick={() => doWcovert('assassinate')}>Assassinate</button>
            <button className="base-btn" style={{ marginLeft: '8px' }} onClick={() => doWcovert('sabotage')}>Sabotage</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WarfarePanel;
