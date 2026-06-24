import React, { useState } from 'react';
import { useGameState } from '../../hooks/useGameState';
import { useActivePanel } from '../../hooks/useActivePanel';
import { kingdomXpProgress } from '../../utils/xp.js';
import { fmt } from '../../utils/fmt.js';
import KingdomXpModal from './KingdomXpModal.jsx';

const HIDE_HEADER_PANELS = new Set([
  'globalchat',
  'defense',
  'races',
  'build',
  'heroes',
  'worldmap',
  'bounties',
  'messages',
  'forum',
]);

function XpBar({ pct }) {
  return (
    <div
      className="h-2.5 w-[140px] shrink-0 overflow-hidden rounded-full border border-white/5 bg-bg4 shadow-inner"
      aria-hidden="true"
    >
      <div
        id="xp-bar"
        className="h-full rounded-full bg-gradient-to-r from-accent1 to-gold transition-all duration-500"
        style={{
          width: `${Math.max(pct > 0 ? 2 : 0, pct)}%`,
          boxShadow: pct > 0 ? '0 0 8px rgba(240, 98, 2, 0.45)' : undefined,
        }}
      />
    </div>
  );
}

const KingdomBodyHeader = () => {
  const { state } = useGameState();
  const { activePanel } = useActivePanel();
  const [xpModalOpen, setXpModalOpen] = useState(false);

  if (!state?.username || HIDE_HEADER_PANELS.has(activePanel)) return null;

  const playerName = state.username || state.owner_name || state.owner || 'Player';
  const kingdomName = state.name || state.kingdomName || 'Kingdom';
  const level = state.level ?? 1;
  const xp = state.xp ?? 0;
  const prestige = state.prestige_level ?? 0;
  const { xpNeeded, xpIntoLevel, pct } = kingdomXpProgress(level, xp, prestige);
  const turn = state.turn ?? 0;
  const score = Math.floor(Number(state.score) || 0);

  return (
    <>
      <div
        id="kd-top"
        className="kd-top shrink-0 border-b border-ember-900/40 bg-gradient-to-b from-void-900/90 to-bg px-4 py-3 shadow-[0_4px_16px_rgba(0,0,0,0.35)]"
      >
        <div className="kingdom-header flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <h1
            id="kingdom-name"
            className="min-w-0 flex-1 font-cinzel text-xl font-black leading-tight tracking-wide"
          >
            <span className="text-text">{playerName}</span>
            <span className="mx-1.5 align-middle text-[0.75em] font-normal italic tracking-normal text-text3">
              of
            </span>
            <span
              className="text-gold"
              style={{ textShadow: '0 0 14px rgba(240, 98, 2, 0.35)' }}
            >
              {kingdomName}
            </span>
          </h1>

          <div className="ml-auto shrink-0 text-right text-[11px] leading-relaxed text-text2">
            <div>
              Turn{' '}
              <span id="turn-num" className="text-sm font-bold text-text">
                {turn}
              </span>
            </div>
            <div>
              Score{' '}
              <span id="kingdom-score-disp" className="text-sm font-bold text-gold">
                {score.toLocaleString()}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setXpModalOpen(true)}
              title="Click for XP breakdown"
              className="mt-1.5 flex cursor-pointer items-center justify-end gap-2 rounded-md border border-transparent bg-transparent px-0.5 py-1 transition hover:border-ember-900/30 hover:bg-void-900/40"
            >
              <span className="shrink-0 text-[11px] text-text3">
                Lv{' '}
                <span
                  id="kingdom-level"
                  className="text-[13px] font-bold text-gold underline decoration-dotted decoration-gold/50 underline-offset-2"
                >
                  {level}
                </span>
              </span>
              <XpBar pct={pct} />
              <span id="xp-label" className="shrink-0 text-[9px] tabular-nums text-text3">
                {fmt(xpIntoLevel)}/{fmt(xpNeeded)} XP
              </span>
            </button>
          </div>
        </div>
      </div>

      <KingdomXpModal open={xpModalOpen} onClose={() => setXpModalOpen(false)} />
    </>
  );
};

export default KingdomBodyHeader;