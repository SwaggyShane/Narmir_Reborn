import React from 'react';

const Topbar = () => {
  const takeTurn = () => {
    if (window.takeTurn) window.takeTurn();
  };

  return (
    <header className="topbar">
      <div className="logo-container">
        <div className="logo">NARMIR REBORN</div>
        <div className="tagline">Pure. Damn. Evil.</div>
      </div>
      <div className="topbar-stats">
        <div className="tstat hide-sm">
          <div className="val" id="top-rank">—</div>
          <div className="lbl">Rank</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ textAlign: 'right', fontFamily: '"Cinzel", serif', lineHeight: 1.1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px' }} className="hide-xs">
                Turns:
              </span>
              <span id="turns-stored-disp" style={{ fontSize: '16px', fontWeight: 700, color: 'var(--gold)' }}>
                400
              </span>
              <span style={{ fontSize: '11px', color: 'var(--text3)' }} className="hide-xs">
                / 400
              </span>
            </div>
            <div className="countdown" style={{ fontSize: '10px', fontFamily: '"Inter", sans-serif' }}>
              +7 in <span id="regen-countdown">25:00</span>
            </div>
          </div>
          <button className="turn-btn" style={{ padding: '6px 14px', fontSize: '12px' }} onClick={takeTurn}>
            Take Turn
          </button>
        </div>
      </div>
    </header>
  );
};

export default Topbar;
