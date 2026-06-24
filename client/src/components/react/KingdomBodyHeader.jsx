import React from 'react';
import { useGameState } from '../../hooks/useGameState';
import { useActivePanel } from '../../hooks/useActivePanel';
import { kingdomXpProgress } from '../../utils/xp.js';
import { fmt } from '../../utils/fmt.js';
import { showKingdomXpModal } from '../../utils/showKingdomXpModal.js';

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

const KingdomBodyHeader = () => {
  const { state } = useGameState();
  const { activePanel } = useActivePanel();

  if (!state?.username || HIDE_HEADER_PANELS.has(activePanel)) return null;

  const playerName = state.username || state.owner_name || state.owner || 'Player';
  const kingdomName = state.name || state.kingdomName || 'Kingdom';
  const level = state.level ?? 1;
  const xp = state.xp ?? 0;
  const prestige = state.prestige_level ?? 0;
  const { xpNeeded, xpIntoLevel, pct } = kingdomXpProgress(level, xp, prestige);
  const turn = state.turn ?? 0;
  const score = Math.floor(Number(state.score) || 0);
  const openXpModal = () => showKingdomXpModal();

  return (
    <div
      id="kd-top"
      className="shrink-0 border-b border-white/5 bg-bg px-4 py-3 shadow-[0_4px_12px_rgba(0,0,0,0.3)]"
    >
      <div className="kingdom-header flex flex-wrap items-start justify-between gap-3">
        <h1 id="kingdom-name" className="text-lg font-bold leading-tight text-text">
          <span className="text-text">{playerName}</span>
          {' of '}
          <span className="text-gold">{kingdomName}</span>
        </h1>

        <div className="ml-auto text-right text-[11px] leading-snug text-text2">
          <div>
            Turn{' '}
            <span id="turn-num" className="font-semibold text-text">
              {turn}
            </span>
          </div>
          <div>
            Score{' '}
            <span id="kingdom-score-disp" className="font-semibold text-gold">
              {score.toLocaleString()}
            </span>
          </div>
          <button
            type="button"
            onClick={openXpModal}
            title="Click for XP breakdown"
            className="mt-1 flex w-full cursor-pointer items-center justify-end gap-1.5 border-none bg-transparent p-0 text-left"
          >
            <span className="text-[11px] text-text3">
              Lv{' '}
              <span
                id="kingdom-level"
                className="text-[13px] font-bold text-gold underline decoration-dotted decoration-gold/50 underline-offset-2"
              >
                {level}
              </span>
            </span>
            <span className="h-[3px] w-24 min-w-[80px] max-w-[150px] overflow-hidden rounded-sm bg-bg4">
              <span
                id="xp-bar"
                className="block h-full rounded-sm bg-gradient-to-r from-accent1 to-gold transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </span>
            <span id="xp-label" className="text-[9px] text-text3">
              {fmt(xpIntoLevel)} / {fmt(xpNeeded)} XP
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default KingdomBodyHeader;