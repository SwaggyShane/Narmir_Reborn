import React from 'react';
import { useGameState } from '../../hooks/useGameState';
import { useGameActions } from '../../hooks/useGameActions';
import { showLoginModal, logout } from './AuthModal.jsx';
import { xpForLevel } from '../../utils/xp';

const Topbar = () => {
  const { state } = useGameState();
  const { takeTurn, loading } = useGameActions();
  const turnsStored = state?.turns_stored ?? 400;
  const level = state?.level ?? 1;
  const xp = state?.xp ?? 0;
  const prestige = state?.prestige_level ?? 0;
  const thisLvl = xpForLevel(level, prestige);
  const nextLvl = xpForLevel(level + 1, prestige);
  const xpInLevel = Math.max(0, Math.min(xp - thisLvl, nextLvl - thisLvl));
  const xpNeeded = Math.max(0, nextLvl - thisLvl);
  const xpPct = xpNeeded > 0 ? Math.min(100, Math.floor((xpInLevel / xpNeeded) * 100)) : 100;
  const openXpModal = () => window.showXpModal?.();
  const handleAccount = () => {
    if (state?.username) {
      logout();
      return;
    }
    showLoginModal();
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
                {turnsStored}
              </span>
              <span style={{ fontSize: '11px', color: 'var(--text3)' }} className="hide-xs">
                / 400
              </span>
            </div>
            <div className="countdown" style={{ fontSize: '10px', fontFamily: '"Inter", sans-serif' }}>
              +7 in <span id="regen-countdown">25:00</span>
            </div>
          </div>
          <button
            className="turn-btn"
            style={{ padding: '6px 14px', fontSize: '12px', opacity: loading.takeTurn ? 0.6 : 1 }}
            onClick={takeTurn}
            disabled={loading.takeTurn}
          >
            Take Turn
          </button>
          {!state?.username && (
            <button
              className="btn"
              style={{ padding: '6px 10px', fontSize: '12px', marginLeft: '8px', whiteSpace: 'nowrap' }}
              onClick={handleAccount}
            >
              Sign In
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

export default Topbar;
