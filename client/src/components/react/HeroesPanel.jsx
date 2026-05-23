import React from 'react';

const HeroesPanel = () => {
  const loadHeroes = () => {
    if (window.loadHeroes) window.loadHeroes();
  };
  const recruitHeroAction = () => {
    if (window.recruitHeroAction) window.recruitHeroAction();
  };
  const openHeroXpModal = () => {
    if (window.openHeroXpModal) window.openHeroXpModal();
  };

  return (
    <div id="heroes" className="panel" style={{ display: 'none' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
        <div className="card-title">👑 Heroes</div>
        <button className="base-btn" onClick={loadHeroes}>↻ Refresh</button>
      </div>

      <div className="r-grid-sidebar">
        <div>
          <div className="card" style={{ marginTop: 0 }}>
            <div className="card-title" style={{ marginBottom: '12px' }}>Your Heroes</div>
            <div id="hero-list" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
              <div style={{ color: 'var(--text3)', fontSize: '13px', padding: '20px', textAlign: 'center', gridColumn: '1/-1' }}>
                No heroes recruited yet. Build a Castle to recruit your first hero!
              </div>
            </div>
          </div>
        </div>

        <div style={{ position: 'sticky', top: 0 }}>
          <div className="card" style={{ marginTop: 0 }}>
            <div className="card-title" style={{ marginBottom: '12px' }}>Recruit Hero</div>
            <div style={{ fontSize: '12px', color: 'var(--text3)', lineHeight: 1.6, marginBottom: '14px' }}>
              Heroes are powerful unique units that provide passive bonuses to
              your kingdom and lead your armies in battle. You can recruit your
              <strong>1st</strong> hero with 1 Castle, the <strong>2nd</strong> at
              10 Castles, and the <strong>3rd</strong> at 50 Castles.
            </div>

            {/* Hero Advancement Info */}
            <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '8px', padding: '12px', marginBottom: '14px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: '8px' }}>
                Hero Advancement
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
                <span style={{ color: 'var(--text2)' }}>Combat Win</span>
                <span style={{ color: 'var(--gold)' }}>500 XP</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
                <span style={{ color: 'var(--text2)' }}>Combat Loss</span>
                <span style={{ color: 'var(--gold)' }}>100 XP</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
                <span style={{ color: 'var(--text2)' }}>Leveling</span>
                <span style={{ color: 'var(--accent1)', cursor: 'pointer', textDecoration: 'underline' }} onClick={openHeroXpModal}>
                  View XP Table
                </span>
              </div>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ fontSize: '11px', color: 'var(--text)', fontWeight: 700, display: 'block', marginBottom: '6px' }}>
                Select Class
              </label>
              <div id="hero-class-options" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {/* Class options injected here */}
              </div>
            </div>

            <button className="base-btn variant-accent w-full" id="btn-recruit-hero" style={{ padding: '10px', fontWeight: 700, width: '100%', background: 'var(--accent1)' }} onClick={recruitHeroAction}>
              Recruit Hero
            </button>
          </div>

          <div className="card">
            <div className="card-title" style={{ fontSize: '14px' }}>Hero Slots</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px' }}>
              <span style={{ fontSize: '13px', color: 'var(--text2)' }}>Occupied</span>
              <span id="hero-slots-used" style={{ fontWeight: 700, color: 'var(--text)' }}>0</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px' }}>
              <span style={{ fontSize: '13px', color: 'var(--text2)' }}>Total available</span>
              <span id="hero-slots-total" style={{ fontWeight: 700, color: 'var(--gold)' }}>1</span>
            </div>
            <div style={{ height: '6px', background: 'var(--bg3)', borderRadius: '3px', marginTop: '10px', overflow: 'hidden' }}>
              <div id="hero-slots-bar" style={{ height: '100%', width: '0%', background: 'var(--accent1)', transition: 'width 0.3s' }}></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HeroesPanel;
