import React from 'react';
import { useGameState } from '../../hooks/useGameState';

const TrainingPanel = () => {
  const { state } = useGameState();
  const isVampire = state?.race === 'vampire';
  const fmt = (value) => Number(value || 0).toLocaleString();
  const getTroopLevel = (unit) => state?.troop_levels?.[unit] || { level: 1, xp: 0 };
  const getTroopXpView = (unit) => {
    const data = getTroopLevel(unit);
    const xpNeeded = 100;
    const xpInLevel = Math.max(0, Number(data.xp || 0) - ((Number(data.level || 1) - 1) * 100));
    const pct = Math.min(100, Math.floor((xpInLevel / xpNeeded) * 100));
    return {
      level: Number(data.level || 1),
      xpText: `${fmt(xpInLevel)} / ${fmt(xpNeeded)} XP`,
      barWidth: `${pct}%`,
    };
  };
  const distributeTrainingEvenly = () => {
    if (window.distributeTrainingEvenly) window.distributeTrainingEvenly();
  };
  const releaseAllTraining = () => {
    if (window.releaseAllTraining) window.releaseAllTraining();
  };
  const saveTrainingAllocation = () => {
    if (window.saveTrainingAllocation) window.saveTrainingAllocation();
  };
  const setTrainingMax = (type) => {
    if (window.setTrainingMax) window.setTrainingMax(type);
  };
  const engineerXpView = getTroopXpView('engineers');
  const scribeXpView = getTroopXpView('scribes');
  const researcherXpView = getTroopXpView('researchers');
  const fighterXpView = getTroopXpView('fighters');
  const rangerXpView = getTroopXpView('rangers');
  const clericXpView = getTroopXpView('clerics');
  const mageXpView = getTroopXpView('mages');
  const thiefXpView = getTroopXpView('thieves');
  const ninjaXpView = getTroopXpView('ninjas');

  return (
    <div id="training" className="panel" style={{ display: 'none' }}>
      <div className="card" style={{ marginTop: 0 }}>
        <div className="card-title">Support levels</div>
        <div style={{ fontSize: '12px', color: 'var(--text3)', marginBottom: '10px' }}>
          These units level through their work each turn — not just training
          fields.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '10px' }}>
          <div style={{ background: 'var(--bg3)', borderRadius: 'var(--radius)', padding: '10px', textAlign: 'center' }}>
            <div style={{ fontSize: '11px', color: 'var(--text3)', marginBottom: '3px' }}>ENGINEERS</div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text)' }} id="sup-count-engineers">{fmt(state?.engineers)}</div>
            <div id="sup-lv-engineers" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text3)', marginTop: '2px' }}>Lv {engineerXpView.level}</div>
            <div id="sup-xp-engineers" style={{ fontSize: '10px', color: 'var(--text3)', marginTop: '2px' }}>{engineerXpView.xpText}</div>
          </div>
          <div style={{ background: 'var(--bg3)', borderRadius: 'var(--radius)', padding: '10px', textAlign: 'center' }}>
            <div style={{ fontSize: '11px', color: 'var(--text3)', marginBottom: '3px' }}>SCRIBES</div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text)' }} id="sup-count-scribes">{fmt(state?.scribes)}</div>
            <div id="sup-lv-scribes" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text3)', marginTop: '2px' }}>Lv {scribeXpView.level}</div>
            <div id="sup-xp-scribes" style={{ fontSize: '10px', color: 'var(--text3)', marginTop: '2px' }}>{scribeXpView.xpText}</div>
          </div>
          <div style={{ background: 'var(--bg3)', borderRadius: 'var(--radius)', padding: '10px', textAlign: 'center' }}>
            <div style={{ fontSize: '11px', color: 'var(--text3)', marginBottom: '3px' }}>RESEARCHERS</div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text)' }} id="sup-count-researchers">{fmt(state?.researchers)}</div>
            <div id="sup-lv-researchers" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text3)', marginTop: '2px' }}>Lv {researcherXpView.level}</div>
            <div id="sup-xp-researchers" style={{ fontSize: '10px', color: 'var(--text3)', marginTop: '2px' }}>{researcherXpView.xpText}</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <div className="card-title" style={{ marginBottom: '2px' }}>
              Troop Training
              <span id="racial-gift-badge" className="badge badge-gold" style={{ display: 'none', marginLeft: '8px' }}>✨ Racial Gift</span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text3)' }}>
              Training fields: <span id="tr-fields" style={{ color: 'var(--text)' }}>0</span> · Capacity: <span id="tr-capacity" style={{ color: 'var(--gold)' }}>0</span> troops/turn · Weapons: <span id="tr-weapons" style={{ color: 'var(--text)' }}>0</span> · Armor: <span id="tr-armor" style={{ color: 'var(--text)' }}>0</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="base-btn variant-accent" onClick={distributeTrainingEvenly} style={{ whiteSpace: 'nowrap', background: 'var(--accent1)' }}>Distribute evenly</button>
            <button className="base-btn variant-red" onClick={releaseAllTraining} style={{ whiteSpace: 'nowrap', background: 'var(--red)' }}>Release all</button>
            <button className="base-btn variant-gold" onClick={saveTrainingAllocation} style={{ whiteSpace: 'nowrap', background: 'var(--gold)', color: '#000' }}>Save allocation</button>
          </div>
        </div>

        <div style={{ fontSize: '12px', color: 'var(--text3)', marginBottom: '12px', lineHeight: 1.6 }}>
          Assign troops to training fields each turn. Troops need weapons and
          armor equipped to train effectively. Race bonuses apply — troops
          associated with your race's strengths train faster and can exceed Level
          100.
        </div>

        <div
          id="racial-gift-banner"
          style={{
            display: 'none',
            background: 'linear-gradient(90deg, rgba(232, 184, 75, 0.15), rgba(232, 120, 0, 0.1))',
            border: '1px solid var(--gold)',
            borderRadius: 'var(--radius)',
            padding: '10px 14px',
            marginBottom: '14px',
            fontSize: '13px',
            color: 'var(--gold)',
          }}
        >
          ✨ <strong>Racial gift active</strong> — <span id="racial-gift-text"></span>
        </div>

        {/* Training Rows */}
        <div className="trow">
          <span className="name">Fighters</span>
          <div className="prog-wrap">
             <div id="tr-bar-fighters" className="prog-bar mil" style={{ width: fighterXpView.barWidth }}></div>
          </div>
          <span id="tr-level-fighters" className="count" style={{ minWidth: '70px' }}>Lv {fighterXpView.level}</span>
          <span id="tr-xp-fighters" style={{ fontSize: '11px', color: 'var(--text3)', minWidth: '80px' }}>{fighterXpView.xpText}</span>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
             <input type="number" className="input" id="ta-fighters" min="0" defaultValue="0" style={{ textAlign: 'right', flex: 1 }} placeholder="Qty" />
             <button className="base-btn" onClick={() => setTrainingMax('fighters')} style={{ padding: '4px 8px', fontSize: '10px', marginLeft: '4px' }}>Max</button>
          </div>
        </div>
        
        <div className="trow">
          <span className="name">Rangers</span>
          <div className="prog-wrap">
             <div id="tr-bar-rangers" className="prog-bar" style={{ width: rangerXpView.barWidth, background: 'var(--blue)' }}></div>
          </div>
          <span id="tr-level-rangers" className="count" style={{ minWidth: '70px' }}>Lv {rangerXpView.level}</span>
          <span id="tr-xp-rangers" style={{ fontSize: '11px', color: 'var(--text3)', minWidth: '80px' }}>{rangerXpView.xpText}</span>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
             <input type="number" className="input" id="ta-rangers" min="0" defaultValue="0" style={{ textAlign: 'right', flex: 1 }} placeholder="Qty" />
             <button className="base-btn" onClick={() => setTrainingMax('rangers')} style={{ padding: '4px 8px', fontSize: '10px', marginLeft: '4px' }}>Max</button>
          </div>
        </div>

        <div className="trow" id="training-row-clerics" style={{ display: isVampire ? 'none' : undefined }}>
          <span className="name">Clerics</span>
          <div className="prog-wrap">
             <div id="tr-bar-clerics" className="prog-bar" style={{ width: clericXpView.barWidth, background: 'var(--green)' }}></div>
          </div>
          <span id="tr-level-clerics" className="count" style={{ minWidth: '70px' }}>Lv {clericXpView.level}</span>
          <span id="tr-xp-clerics" style={{ fontSize: '11px', color: 'var(--text3)', minWidth: '80px' }}>{clericXpView.xpText}</span>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
             <input type="number" className="input" id="ta-clerics" min="0" defaultValue="0" style={{ textAlign: 'right', flex: 1 }} placeholder="Qty" />
             <button className="base-btn" onClick={() => setTrainingMax('clerics')} style={{ padding: '4px 8px', fontSize: '10px', marginLeft: '4px' }}>Max</button>
          </div>
        </div>

        <div className="trow">
          <span className="name">Mages</span>
          <div className="prog-wrap">
             <div id="tr-bar-mages" className="prog-bar spell" style={{ width: mageXpView.barWidth }}></div>
          </div>
          <span id="tr-level-mages" className="count" style={{ minWidth: '70px' }}>Lv {mageXpView.level}</span>
          <span id="tr-xp-mages" style={{ fontSize: '11px', color: 'var(--text3)', minWidth: '80px' }}>{mageXpView.xpText}</span>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
             <input type="number" className="input" id="ta-mages" min="0" defaultValue="0" style={{ textAlign: 'right', flex: 1 }} placeholder="Qty" />
             <button className="base-btn" onClick={() => setTrainingMax('mages')} style={{ padding: '4px 8px', fontSize: '10px', marginLeft: '4px' }}>Max</button>
          </div>
        </div>

        <div className="trow">
          <span className="name">Thieves</span>
          <div className="prog-wrap">
             <div id="tr-bar-thieves" className="prog-bar" style={{ width: thiefXpView.barWidth, background: 'var(--amber)' }}></div>
          </div>
          <span id="tr-level-thieves" className="count" style={{ minWidth: '70px' }}>Lv {thiefXpView.level}</span>
          <span id="tr-xp-thieves" style={{ fontSize: '11px', color: 'var(--text3)', minWidth: '80px' }}>{thiefXpView.xpText}</span>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
             <input type="number" className="input" id="ta-thieves" min="0" defaultValue="0" style={{ textAlign: 'right', flex: 1 }} placeholder="Qty" />
             <button className="base-btn" onClick={() => setTrainingMax('thieves')} style={{ padding: '4px 8px', fontSize: '10px', marginLeft: '4px' }}>Max</button>
          </div>
        </div>

        <div className="trow" style={{ borderBottom: 'none' }}>
          <span className="name">Ninjas</span>
          <div className="prog-wrap">
             <div id="tr-bar-ninjas" className="prog-bar" style={{ width: ninjaXpView.barWidth, background: 'var(--red)' }}></div>
          </div>
          <span id="tr-level-ninjas" className="count" style={{ minWidth: '70px' }}>Lv {ninjaXpView.level}</span>
          <span id="tr-xp-ninjas" style={{ fontSize: '11px', color: 'var(--text3)', minWidth: '80px' }}>{ninjaXpView.xpText}</span>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
             <input type="number" className="input" id="ta-ninjas" min="0" defaultValue="0" style={{ textAlign: 'right', flex: 1 }} placeholder="Qty" />
             <button className="base-btn" onClick={() => setTrainingMax('ninjas')} style={{ padding: '4px 8px', fontSize: '10px', marginLeft: '4px' }}>Max</button>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 0 }}>
        <div className="card-title">Race training bonus</div>
        <div id="tr-race-bonus" style={{ fontSize: '13px', color: 'var(--text2)', lineHeight: 1.8 }}>
          —
        </div>
      </div>
    </div>
  );
};

export default TrainingPanel;
