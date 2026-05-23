import React, { useState } from 'react';

const StatusPanel = () => {
  const lockTax = (elementId) => {
    if (window.lockTax) window.lockTax(elementId);
  };
  const updateTax = (value) => {
    if (window.updateTax) window.updateTax(value);
  };

  const [raceInfo, setRaceInfo] = useState({ label: '—', bonus: '', key: '' });

  React.useEffect(() => {
    const update = () => {
      if (window.currentRace) {
        setRaceInfo({
          label: window.currentRace.label || '—',
          bonus: window.currentRace.bonus || '',
          key: window.currentRace.key || ''
        });
      } else if (window.currentRaceHtml) {
        const temp = document.createElement('div');
        temp.innerHTML = window.currentRaceHtml;
        const label = temp.querySelector('strong')?.textContent || temp.textContent || '—';
        const parts = temp.textContent.split(' · ');
        const bonus = parts.length > 1 ? parts.slice(1).join(' · ') : '';
        setRaceInfo({
          label,
          bonus: bonus || (temp.textContent.replace(label, '').replace(/^\s*·\s*/, '').trim()),
          key: ''
        });
      }
    };
    update();
    window.updateRaceTagHtml = update;
  }, []);

  const RACE_PORTRAITS = {
    high_elf: '/heroes/lunar_sentinel.png',
    dwarf: '/heroes/siegebreaker.png',
    human: '/heroes/grand_chancellor.png',
    orc: '/heroes/high_chieftain.png',
    dark_elf: '/heroes/shadowmaster.png',
    dire_wolf: '/heroes/warshaman.png',
    vampire: '/heroes/void_weaver.png',
  };

  const currentRaceKey = (raceInfo.key || '') || (raceInfo.label || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_');
  const portraitUrl = RACE_PORTRAITS[currentRaceKey] || '';
  const isVampire = currentRaceKey === 'vampire' || (window.gameState && window.gameState.race === 'vampire');

  return (
    <div id="status" className="panel active">
      <div style={{ marginBottom: '20px' }}>
        <div
          id="race-tag-display"
          className="race-tag-block"
          onClick={() => { if (window.openRaceLore) window.openRaceLore(); }}
          style={{ 
            cursor: 'pointer',
            padding: '16px',
            background: 'var(--bg3)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            gap: '16px',
            transition: 'border-color 0.2s ease, background-color 0.2s ease',
            width: '100%',
            boxSizing: 'border-box'
          }}
          title="Click for race lore"
        >
          {portraitUrl && (
            <div style={{
              flexShrink: 0,
              width: '80px',
              height: '80px',
              borderRadius: '8px',
              border: '2px solid var(--gold)',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
              overflow: 'hidden',
              background: '#15171e',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <img 
                src={portraitUrl} 
                alt={raceInfo.label}
                referrerPolicy="no-referrer"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: 'block',
                  transition: 'transform 0.3s ease',
                }}
                className="race-portrait"
              />
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
            <div style={{ 
              fontFamily: '"Cinzel", serif', 
              fontSize: '18px', 
              fontWeight: '700', 
              color: 'var(--gold)', 
              letterSpacing: '1px',
              textTransform: 'uppercase'
            }}>
              {raceInfo.label}
            </div>
            <div style={{ 
              fontSize: '12.5px', 
              color: 'var(--text2)', 
              lineHeight: '1.6',
              fontFamily: 'sans-serif',
              letterSpacing: '0.3px',
              fontWeight: 'normal'
            }}>
              {raceInfo.bonus}
            </div>
          </div>
        </div>
      </div>
      <div className="card" id="status-tax-card" style={{ marginTop: 0, marginBottom: '16px', display: 'none' }}>
        <div className="card-title">Tax rate</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '10px' }}>
          <input
            type="range"
            className="input"
            id="strip-tax-slider"
            min="1"
            max="100"
            step="1"
            defaultValue="42"
            onChange={(e) => updateTax(e.target.value)}
            style={{ flex: 1 }}
          />
          <span style={{ fontSize: '22px', fontWeight: 700, color: 'var(--gold)', minWidth: '48px' }} id="strip-tax-disp"></span>
        </div>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
          <button className="base-btn variant-gold" onClick={() => lockTax('strip-tax-slider')} style={{ flex: 1, background: 'var(--gold)', color: '#000' }}>
            🔒 Lock
          </button>
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text3)', lineHeight: 1.7 }}>
          Taxing your citizens directly affects their morale. Tax them high and
          they will probably leave. Tax them low and they will rejoice.{' '}
          <strong style={{ color: 'var(--gold)' }}>Enter a rate then press Lock to save.</strong>
        </div>
      </div>
      <div className="three-col" id="status-grid">
        {/* Col 1: Military & support */}
        <div className="card">
          <div className="card-title">
            Military &amp; support
            <span id="citadel-badge" style={{ display: 'none', marginLeft: '8px', fontSize: '11px', fontWeight: 600, color: 'var(--gold)' }}>🏰 Citadel</span>
          </div>
          {/* Header row */}
          <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr 52px 52px', gap: '4px', padding: '4px 0 6px', borderBottom: '1px solid var(--border2)' }}>
            <span style={{ fontSize: '10px', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Unit</span>
            <span style={{ fontSize: '10px', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'right' }}>Count</span>
            <span style={{ fontSize: '10px', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'center' }}>Lv</span>
            <span style={{ fontSize: '10px', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'center' }}>Role</span>
          </div>
          {/* Combat units */}
          <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr 52px 52px', gap: '4px', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: '13px', color: 'var(--text)' }} id="s-label-fighters">Fighters</span>
            <span style={{ fontSize: '13px', fontWeight: 600, textAlign: 'right', color: 'var(--text)' }} id="s-fighters">0</span>
            <span style={{ textAlign: 'center', fontSize: '11px', fontWeight: 600 }} id="s-lv-fighters">—</span>
            <span className="badge badge-red" style={{ textAlign: 'center', fontSize: '9px' }}>Combat</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr 52px 52px', gap: '4px', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: '13px', color: 'var(--text)' }} id="s-label-rangers">Rangers</span>
            <span style={{ fontSize: '13px', fontWeight: 600, textAlign: 'right', color: 'var(--text)' }} id="s-rangers">0</span>
            <span style={{ textAlign: 'center', fontSize: '11px', fontWeight: 600 }} id="s-lv-rangers">—</span>
            <span className="badge badge-blue" style={{ textAlign: 'center', fontSize: '9px' }}>Ranged</span>
          </div>
          <div id="s-row-clerics" style={{ display: isVampire ? 'none' : 'grid', gridTemplateColumns: '100px 1fr 52px 52px', gap: '4px', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: '13px', color: 'var(--text)' }} id="s-label-clerics">Clerics</span>
            <span style={{ fontSize: '13px', fontWeight: 600, textAlign: 'right', color: 'var(--text)' }} id="s-clerics">0</span>
            <span style={{ textAlign: 'center', fontSize: '11px', fontWeight: 600 }} id="s-lv-clerics">—</span>
            <span className="badge badge-green" style={{ textAlign: 'center', fontSize: '9px' }}>Heal</span>
          </div>
          <div id="s-row-thralls" style={{ display: isVampire ? 'grid' : 'none', gridTemplateColumns: '100px 1fr 52px 52px', gap: '4px', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: '13px', color: 'var(--text)' }} id="s-label-thralls">Thralls</span>
            <span style={{ fontSize: '13px', fontWeight: 600, textAlign: 'right', color: 'var(--text)' }} id="s-thralls">0</span>
            <span style={{ textAlign: 'center', fontSize: '11px', fontWeight: 600 }} id="s-lv-thralls">—</span>
            <span className="badge badge-gray" style={{ textAlign: 'center', fontSize: '9px', background: '#444' }}>Defense</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr 52px 52px', gap: '4px', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: '13px', color: 'var(--text)' }} id="s-label-mages">Mages</span>
            <span style={{ fontSize: '13px', fontWeight: 600, textAlign: 'right', color: 'var(--text)' }} id="s-mages">0</span>
            <span style={{ textAlign: 'center', fontSize: '11px', fontWeight: 600 }} id="s-lv-mages">—</span>
            <span className="badge badge-amber" style={{ textAlign: 'center', fontSize: '9px' }}>Magic</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr 52px 52px', gap: '4px', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: '13px', color: 'var(--text)' }} id="s-label-thieves">Thieves</span>
            <span style={{ fontSize: '13px', fontWeight: 600, textAlign: 'right', color: 'var(--text)' }} id="s-thieves">0</span>
            <span style={{ textAlign: 'center', fontSize: '11px', fontWeight: 600 }} id="s-lv-thieves">—</span>
            <span className="badge badge-amber" style={{ textAlign: 'center', fontSize: '9px' }}>Covert</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr 52px 52px', gap: '4px', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid var(--border2)' }}>
            <span style={{ fontSize: '13px', color: 'var(--text)' }} id="s-label-ninjas">Ninjas</span>
            <span style={{ fontSize: '13px', fontWeight: 600, textAlign: 'right', color: 'var(--text)' }} id="s-ninjas">0</span>
            <span style={{ textAlign: 'center', fontSize: '11px', fontWeight: 600 }} id="s-lv-ninjas">—</span>
            <span className="badge badge-amber" style={{ textAlign: 'center', fontSize: '9px' }}>Covert</span>
          </div>
          {/* Support units — no level shown */}
          <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr 52px 52px', gap: '4px', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: '13px', color: 'var(--text)' }} id="s-label-engineers">Engineers</span>
            <span style={{ fontSize: '13px', fontWeight: 600, textAlign: 'right', color: 'var(--text)' }} id="s-engineers">0</span>
            <span style={{ textAlign: 'center', fontSize: '11px', color: 'var(--text3)' }} id="s-lv-engineers">—</span>
            <span className="badge badge-blue" style={{ textAlign: 'center', fontSize: '9px' }}>Build</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr 52px 52px', gap: '4px', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: '13px', color: 'var(--text)' }} id="s-label-scribes">Scribes</span>
            <span style={{ fontSize: '13px', fontWeight: 600, textAlign: 'right', color: 'var(--text)' }} id="s-scribes">0</span>
            <span style={{ textAlign: 'center', fontSize: '11px', color: 'var(--text3)' }} id="s-lv-scribes">—</span>
            <span className="badge badge-blue" style={{ textAlign: 'center', fontSize: '9px' }}>Library</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr 52px 52px', gap: '4px', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: '13px', color: 'var(--text)' }} id="s-label-researchers">Researchers</span>
            <span style={{ fontSize: '13px', fontWeight: 600, textAlign: 'right', color: 'var(--text)' }} id="s-researchers">0</span>
            <span style={{ textAlign: 'center', fontSize: '11px', color: 'var(--text3)' }} id="s-lv-researchers">—</span>
            <span className="badge badge-blue" style={{ textAlign: 'center', fontSize: '9px' }}>Study</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr 52px 52px', gap: '4px', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: '13px', color: 'var(--text)' }}>Warmachines</span>
            <span style={{ fontSize: '13px', fontWeight: 600, textAlign: 'right', color: 'var(--text)' }} id="s-war_machines">0</span>
            <span></span>
            <span className="badge badge-gold" style={{ textAlign: 'center', fontSize: '9px' }}>Siege</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr 52px 52px', gap: '4px', alignItems: 'center', padding: '5px 0' }}>
            <span style={{ fontSize: '13px', color: 'var(--text)' }} id="s-label-ladders">Ladders</span>
            <span style={{ fontSize: '13px', fontWeight: 600, textAlign: 'right', color: 'var(--text)' }} id="s-ladders">0</span>
            <span></span>
            <span className="badge badge-gold" style={{ textAlign: 'center', fontSize: '9px' }}>Siege</span>
          </div>
        </div>

        {/* Col 2: Research levels */}
        <div className="card">
          <div className="card-title">Research levels</div>
          <div className="trow">
            <span className="name">Economy</span>
            <div className="prog-wrap">
              <div className="prog-bar eco" id="pb-eco-st" style={{ width: '0%' }}></div>
            </div>
          </div>
          <div className="trow">
            <span className="name">Weapons</span>
            <div className="prog-wrap">
              <div className="prog-bar wep" id="pb-wep-st" style={{ width: '0%' }}></div>
            </div>
          </div>
          <div className="trow">
            <span className="name">Armor</span>
            <div className="prog-wrap">
              <div className="prog-bar arm" id="pb-arm-st" style={{ width: '0%' }}></div>
            </div>
          </div>
          <div className="trow">
            <span className="name">Military</span>
            <div className="prog-wrap">
              <div className="prog-bar mil" id="pb-mil-st" style={{ width: '0%' }}></div>
            </div>
          </div>
          <div className="trow">
            <span className="name">Spellbook</span>
            <div className="prog-wrap">
              <div className="prog-bar spell" id="pb-spell-st" style={{ width: '0%' }}></div>
            </div>
          </div>
          <div className="trow">
            <span className="name">Atk magic</span>
            <div className="prog-wrap">
              <div className="prog-bar" id="pb-atk-st" style={{ width: '0%', background: 'var(--red)' }}></div>
            </div>
          </div>
          <div className="trow">
            <span className="name">Defense magic</span>
            <div className="prog-wrap">
              <div className="prog-bar arm" id="pb-def-st" style={{ width: '0%' }}></div>
            </div>
          </div>
          <div className="trow">
            <span className="name">Mana</span>
            <div className="prog-wrap">
              <div className="prog-bar mana" id="pb-mana-s" style={{ width: '0%' }}></div>
            </div>
          </div>
          <div className="trow">
            <span className="name">Entertainment</span>
            <div className="prog-wrap">
              <div className="prog-bar" id="pb-ent-s" style={{ width: '0%', background: 'var(--green)' }}></div>
            </div>
          </div>
          <div className="trow" style={{ borderBottom: 'none' }}>
            <span className="name">Construction</span>
            <div className="prog-wrap">
              <div className="prog-bar" id="pb-con-st" style={{ width: '0%', background: 'var(--amber)' }}></div>
            </div>
          </div>
        </div>

        {/* Col 3: Key buildings */}
        <div className="card">
          <div className="card-title">Key buildings</div>
          <div className="trow">
            <span className="name">Farm</span><span className="count" id="kb-farms">0</span>
          </div>
          <div className="trow">
            <span className="name">Barracks</span><span className="count" id="kb-barracks">0</span>
          </div>
          <div className="trow">
            <span className="name">Schools</span><span className="count" id="kb-schools">0</span>
          </div>
          <div className="trow">
            <span className="name">Library</span><span className="count" id="kb-libraries">0</span>
          </div>
          <div className="trow">
            <span className="name">Mage Towers</span><span className="count" id="kb-mage_towers">0</span>
          </div>
          <div className="trow">
            <span className="name">Smithies</span><span className="count" id="kb-smithies">0</span>
          </div>
          <div className="trow">
            <span className="name">Markets</span><span className="count" id="kb-markets">0</span>
          </div>
          <div className="trow">
            <span className="name">Guard Towers</span><span className="count" id="kb-guard_towers">0</span>
          </div>
          <div className="trow">
            <span className="name">Training Fields</span><span className="count" id="kb-training">0</span>
          </div>
          <div className="trow" style={{ borderBottom: 'none' }}>
            <span className="name">Castles</span><span className="count" id="kb-castles">0</span>
          </div>
        </div>
      </div>



      {/* Active effects */}
      <div id="active-effects-bar" style={{ display: 'none', marginTop: '14px' }}>
        <div className="card" style={{ padding: '12px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginRight: '4px' }}>Active effects</span>
            <div id="active-effects-list" style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatusPanel;
