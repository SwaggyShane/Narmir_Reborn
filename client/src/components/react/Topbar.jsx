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
    <header className="topbar flex h-14 items-center justify-between gap-2 border-b border-white/5 bg-zinc-950/95 px-3 backdrop-blur-md md:px-4">
      <div className="logo-container min-w-0">
        <div className="logo truncate font-serif text-[13px] font-black uppercase tracking-[0.12em] text-[var(--gold)] md:text-[14px]">NARMIR REBORN</div>
        <div className="tagline truncate text-[11px] text-[var(--text2)] md:text-[12px]">Pure. Damn. Evil.</div>
      </div>
      <div className="topbar-stats flex min-w-0 items-center gap-2 md:gap-3">
        <div className="tstat hide-sm hidden shrink-0 md:block">
          <div className="val" id="top-rank">—</div>
          <div className="lbl">Rank</div>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right font-serif leading-none">
            <div className="flex items-center gap-1.5">
              <span className="hide-xs text-[11px] uppercase tracking-[0.5px] text-[var(--text3)]">
                Turns:
              </span>
              <span id="turns-stored-disp" className="text-[16px] font-bold text-[var(--gold)]">
                {turnsStored}
              </span>
              <span className="hide-xs text-[11px] text-[var(--text3)]">
                / 400
              </span>
            </div>
            <div className="countdown text-[10px] font-sans text-[var(--text3)]">
              +7 in <span id="regen-countdown">25:00</span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <span
                className="cursor-pointer text-[11px] text-[var(--text3)]"
                onClick={openXpModal}
                title="Click for XP breakdown"
              >
                Level
                <span
                  id="kingdom-level"
                  className="text-[13px] font-bold text-[var(--gold)] underline decoration-dotted underline-offset-2"
                >
                  {level}
                </span>
              </span>
              <div
                className="min-w-[80px] max-w-[150px] flex-1 cursor-pointer"
                onClick={openXpModal}
                title="Click for XP breakdown"
              >
                <div className="h-[3px] overflow-hidden rounded-[1.5px] bg-[var(--bg4)]">
                  <div
                    id="xp-bar"
                    className="h-[3px] rounded-[1.5px] transition-[width] duration-300"
                    style={{ width: `${xpPct}%`, background: 'linear-gradient(90deg, var(--accent1), var(--gold))' }}
                  />
                </div>
              </div>
              <span
                id="xp-label"
                className="cursor-pointer text-[9px] text-[var(--text3)]"
                onClick={openXpModal}
              >
                {xpNeeded > 0 ? `${xpInLevel.toLocaleString()} / ${xpNeeded.toLocaleString()} XP` : 'Max Level'}
              </span>
            </div>
          </div>
          <button
            className="turn-btn shrink-0 px-3.5 py-1.5 text-[12px] leading-none"
            style={{ opacity: loading.takeTurn ? 0.6 : 1 }}
            onClick={takeTurn}
            disabled={loading.takeTurn}
          >
            Take Turn
          </button>
          <button className="btn ml-2 shrink-0 whitespace-nowrap px-2.5 py-1.5 text-[12px]" onClick={handleAccount}>
            {state?.username ? 'Logout' : 'Sign In'}
          </button>
        </div>
      </div>
    </header>
  );
};

export default Topbar;
