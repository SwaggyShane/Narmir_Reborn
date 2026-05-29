import React from 'react';

const HirePanel = () => {
  const isVampire = window.gameState?.race === 'vampire';
  const setMaxValue = (inputId, type) => {
    if (window.setMaxValue) window.setMaxValue(inputId, type);
  };
  const hire = (type) => {
    if (window.hire) window.hire(type);
  };
  const fire = (type) => {
    if (window.fire) window.fire(type);
  };

  return (
    <div id="hire" className="panel" style={{ display: 'none' }}>
      <div className="card" style={{ marginTop: 0 }}>
        <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Hire units</span>
          <span style={{ color: 'var(--text2)', textTransform: 'none', display: 'flex', gap: '14px', alignItems: 'center' }}>
            <span>Gold: <strong id="hire-strip-gold" style={{ color: 'var(--gold)' }}>0</strong></span>
            <span>Population: <strong id="hire-pop" style={{ color: 'var(--gold)' }}>0</strong></span>
          </span>
        </div>

        <div id="hire-caps-container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '8px', marginBottom: '20px', background: 'rgba(0, 0, 0, 0.2)', padding: '10px', borderRadius: '12px', border: '1px solid var(--border)' }}>
          <div style={{ padding: '4px 8px' }}>
            <div style={{ fontSize: '9px', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '1px' }}>Barracks</div>
            <div style={{ fontSize: '13px', fontWeight: 700 }}>
              <span id="hire-barracks-used">0</span> <span style={{ color: 'var(--text3)', fontWeight: 400 }}>/</span> <span id="hire-barracks-cap" style={{ color: 'var(--gold)' }}>0</span>
            </div>
          </div>
          <div style={{ padding: '4px 8px' }}>
            <div style={{ fontSize: '9px', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '1px' }}>Schools</div>
            <div style={{ fontSize: '13px', fontWeight: 700 }}>
              <span id="hire-school-used">0</span> <span style={{ color: 'var(--text3)', fontWeight: 400 }}>/</span> <span id="hire-school-cap" style={{ color: 'var(--gold)' }}>0</span>
            </div>
          </div>
          <div style={{ padding: '4px 8px' }}>
            <div style={{ fontSize: '9px', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '1px' }}>Smithies</div>
            <div style={{ fontSize: '13px', fontWeight: 700 }}>
              <span id="hire-smithy-used">0</span> <span style={{ color: 'var(--text3)', fontWeight: 400 }}>/</span> <span id="hire-smithy-cap" style={{ color: 'var(--gold)' }}>0</span>
            </div>
          </div>
          <div style={{ padding: '4px 8px' }}>
            <div style={{ fontSize: '9px', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '1px' }}>Library</div>
            <div style={{ fontSize: '13px', fontWeight: 700 }}>
              <span id="hire-library-used">0</span> <span style={{ color: 'var(--text3)', fontWeight: 400 }}>/</span> <span id="hire-library-cap" style={{ color: 'var(--gold)' }}>0</span>
            </div>
          </div>
        </div>

        {/* Header row */}
        <div className="hire-row hire-header" style={{ borderBottom: '2px solid var(--border2)', fontSize: '10px', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', paddingBottom: '8px', marginBottom: '8px' }}>
          <span>Unit</span>
          <span>In service</span>
          <span>Price</span>
          <span>Action</span>
        </div>

        {/* Unit rows */}
        <div className="hire-row">
          <div>
             <div className="hname">⚔️ Fighters</div>
             <div className="hdesc">Combat · defense</div>
          </div>
          <div className="hcount" id="h-fighters">0</div>
          <div className="hprice" id="hp-fighters">250 GC</div>
          <div className="hbtns" style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end' }}>
             <input type="number" className="input" id="hire-fighters" min="0" defaultValue="0" style={{ textAlign: 'right', width: '60px' }} placeholder="Qty" />
             <button className="base-btn" style={{ fontSize: '10px', padding: '3px 6px' }} onClick={() => setMaxValue('hire-fighters', 'gold')}>Max</button>
             <button className="base-btn variant-gold" style={{ fontSize: '10px', padding: '3px 8px', background: 'var(--gold)', color: '#000' }} onClick={() => hire('fighters')}>Hire</button>
             <button className="base-btn variant-red" style={{ fontSize: '10px', padding: '3px 8px', background: 'var(--red)' }} onClick={() => fire('fighters')}>Fire</button>
          </div>
        </div>

        <div className="hire-row">
          <div>
             <div className="hname">🏹 Rangers</div>
             <div className="hdesc">Scout · ranged · explore</div>
          </div>
          <div className="hcount" id="h-rangers">0</div>
          <div className="hprice" id="hp-rangers">250 GC</div>
          <div className="hbtns" style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end' }}>
             <input type="number" className="input" id="hire-rangers" min="0" defaultValue="0" style={{ textAlign: 'right', width: '60px' }} placeholder="Qty" />
             <button className="base-btn" style={{ fontSize: '10px', padding: '3px 6px' }} onClick={() => setMaxValue('hire-rangers', 'gold')}>Max</button>
             <button className="base-btn variant-gold" style={{ fontSize: '10px', padding: '3px 8px', background: 'var(--gold)', color: '#000' }} onClick={() => hire('rangers')}>Hire</button>
             <button className="base-btn variant-red" style={{ fontSize: '10px', padding: '3px 8px', background: 'var(--red)' }} onClick={() => fire('rangers')}>Fire</button>
          </div>
        </div>

        <div className="hire-row" id="hire-row-clerics" style={{ display: isVampire ? 'none' : undefined }}>
          <div>
             <div className="hname">💚 Clerics</div>
             <div className="hdesc">Heal · morale aura · shrine</div>
          </div>
          <div className="hcount" id="h-clerics">0</div>
          <div className="hprice" id="hp-clerics">250 GC</div>
          <div className="hbtns" style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end' }}>
             <input type="number" className="input" id="hire-clerics" min="0" defaultValue="0" style={{ textAlign: 'right', width: '60px' }} placeholder="Qty" />
             <button className="base-btn" style={{ fontSize: '10px', padding: '3px 6px' }} onClick={() => setMaxValue('hire-clerics', 'gold')}>Max</button>
             <button className="base-btn variant-gold" style={{ fontSize: '10px', padding: '3px 8px', background: 'var(--gold)', color: '#000' }} onClick={() => hire('clerics')}>Hire</button>
             <button className="base-btn variant-red" style={{ fontSize: '10px', padding: '3px 8px', background: 'var(--red)' }} onClick={() => fire('clerics')}>Fire</button>
          </div>
        </div>

        <div className="hire-row">
          <div>
             <div className="hname">✨ Mages</div>
             <div className="hdesc">Spells · tower · library</div>
          </div>
          <div className="hcount" id="h-mages">0</div>
          <div className="hprice" id="hp-mages">250 GC</div>
          <div className="hbtns" style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end' }}>
             <input type="number" className="input" id="hire-mages" min="0" defaultValue="0" style={{ textAlign: 'right', width: '60px' }} placeholder="Qty" />
             <button className="base-btn" style={{ fontSize: '10px', padding: '3px 6px' }} onClick={() => setMaxValue('hire-mages', 'gold')}>Max</button>
             <button className="base-btn variant-gold" style={{ fontSize: '10px', padding: '3px 8px', background: 'var(--gold)', color: '#000' }} onClick={() => hire('mages')}>Hire</button>
             <button className="base-btn variant-red" style={{ fontSize: '10px', padding: '3px 8px', background: 'var(--red)' }} onClick={() => fire('mages')}>Fire</button>
          </div>
        </div>

        <div className="hire-row">
          <div>
             <div className="hname">🗝️ Thieves</div>
             <div className="hdesc">Covert ops · loot · spy</div>
          </div>
          <div className="hcount" id="h-thieves">0</div>
          <div className="hprice" id="hp-thieves">250 GC</div>
          <div className="hbtns" style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end' }}>
             <input type="number" className="input" id="hire-thieves" min="0" defaultValue="0" style={{ textAlign: 'right', width: '60px' }} placeholder="Qty" />
             <button className="base-btn" style={{ fontSize: '10px', padding: '3px 6px' }} onClick={() => setMaxValue('hire-thieves', 'gold')}>Max</button>
             <button className="base-btn variant-gold" style={{ fontSize: '10px', padding: '3px 8px', background: 'var(--gold)', color: '#000' }} onClick={() => hire('thieves')}>Hire</button>
             <button className="base-btn variant-red" style={{ fontSize: '10px', padding: '3px 8px', background: 'var(--red)' }} onClick={() => fire('thieves')}>Fire</button>
          </div>
        </div>

        <div className="hire-row">
          <div>
             <div className="hname">🕵️ Ninjas</div>
             <div className="hdesc">Assassinate · sabotage</div>
          </div>
          <div className="hcount" id="h-ninjas">0</div>
          <div className="hprice" id="hp-ninjas">250 GC</div>
          <div className="hbtns" style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end' }}>
             <input type="number" className="input" id="hire-ninjas" min="0" defaultValue="0" style={{ textAlign: 'right', width: '60px' }} placeholder="Qty" />
             <button className="base-btn" style={{ fontSize: '10px', padding: '3px 6px' }} onClick={() => setMaxValue('hire-ninjas', 'gold')}>Max</button>
             <button className="base-btn variant-gold" style={{ fontSize: '10px', padding: '3px 8px', background: 'var(--gold)', color: '#000' }} onClick={() => hire('ninjas')}>Hire</button>
             <button className="base-btn variant-red" style={{ fontSize: '10px', padding: '3px 8px', background: 'var(--red)' }} onClick={() => fire('ninjas')}>Fire</button>
          </div>
        </div>

        <div className="hire-row">
          <div>
             <div className="hname">📚 Researchers</div>
             <div className="hdesc">Advance disciplines · school</div>
          </div>
          <div className="hcount" id="h-researchers">0</div>
          <div className="hprice" id="hp-researchers">250 GC</div>
          <div className="hbtns" style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end' }}>
             <input type="number" className="input" id="hire-researchers" min="0" defaultValue="0" style={{ textAlign: 'right', width: '60px' }} placeholder="Qty" />
             <button className="base-btn" style={{ fontSize: '10px', padding: '3px 6px' }} onClick={() => setMaxValue('hire-researchers', 'gold')}>Max</button>
             <button className="base-btn variant-gold" style={{ fontSize: '10px', padding: '3px 8px', background: 'var(--gold)', color: '#000' }} onClick={() => hire('researchers')}>Hire</button>
             <button className="base-btn variant-red" style={{ fontSize: '10px', padding: '3px 8px', background: 'var(--red)' }} onClick={() => fire('researchers')}>Fire</button>
          </div>
        </div>

        <div className="hire-row">
          <div>
             <div className="hname">📜 Scribes</div>
             <div className="hdesc">Maps · blueprints · library</div>
          </div>
          <div className="hcount" id="h-scribes">0</div>
          <div className="hprice" id="hp-scribes">250 GC</div>
          <div className="hbtns" style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end' }}>
             <input type="number" className="input" id="hire-scribes" min="0" defaultValue="0" style={{ textAlign: 'right', width: '60px' }} placeholder="Qty" />
             <button className="base-btn" style={{ fontSize: '10px', padding: '3px 6px' }} onClick={() => setMaxValue('hire-scribes', 'gold')}>Max</button>
             <button className="base-btn variant-gold" style={{ fontSize: '10px', padding: '3px 8px', background: 'var(--gold)', color: '#000' }} onClick={() => hire('scribes')}>Hire</button>
             <button className="base-btn variant-red" style={{ fontSize: '10px', padding: '3px 8px', background: 'var(--red)' }} onClick={() => fire('scribes')}>Fire</button>
          </div>
        </div>

        <div className="hire-row" style={{ borderBottom: 'none' }}>
          <div>
             <div className="hname">⚙️ Engineers</div>
             <div className="hdesc">Build · war machines · smithy</div>
          </div>
          <div className="hcount" id="h-engineers">0</div>
          <div className="hprice" id="hp-engineers">250 GC</div>
          <div className="hbtns" style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end' }}>
             <input type="number" className="input" id="hire-engineers" min="0" defaultValue="0" style={{ textAlign: 'right', width: '60px' }} placeholder="Qty" />
             <button className="base-btn" style={{ fontSize: '10px', padding: '3px 6px' }} onClick={() => setMaxValue('hire-engineers', 'gold')}>Max</button>
             <button className="base-btn variant-gold" style={{ fontSize: '10px', padding: '3px 8px', background: 'var(--gold)', color: '#000' }} onClick={() => hire('engineers')}>Hire</button>
             <button className="base-btn variant-red" style={{ fontSize: '10px', padding: '3px 8px', background: 'var(--red)' }} onClick={() => fire('engineers')}>Fire</button>
          </div>
        </div>
      </div>
      <div style={{ fontSize: '12px', color: 'var(--text3)', padding: '0 4px' }}>
        Hired units are subtracted from the population pool. Population returns
        over time based on morale and entertainment.
      </div>
    </div>
  );
};

export default HirePanel;
