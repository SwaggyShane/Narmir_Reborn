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
  const width = Math.max(pct > 0 ? 2 : 0, pct);
  return (
    <div
      style={{
        height: 8,
        minWidth: 120,
        maxWidth: 160,
        flex: '1 1 120px',
        background: 'var(--bg4)',
        borderRadius: 4,
        overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
      aria-hidden="true"
    >
      <div
        id="xp-bar"
        style={{
          height: '100%',
          width: `${width}%`,
          borderRadius: 4,
          transition: 'width 0.4s ease',
          background: 'linear-gradient(90deg, var(--accent1), var(--gold))',
          boxShadow: pct > 0 ? '0 0 8px rgba(240, 98, 2, 0.5)' : undefined,
        }}
      />
    </div>
  );
}

const KingdomBodyHeader = () => {
  const { state } = useGameState();
  const { activePanel } = useActivePanel();
  const [xpModalOpen, setXpModalOpen] = useState(false);

  const kingdomReady = Boolean(
    state?.username || state?.name || (state?.turn != null && Number(state.turn) > 0),
  );

  if (!kingdomReady || HIDE_HEADER_PANELS.has(activePanel)) return null;

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
        className="kd-top sticky top-0 z-20 shrink-0 border-b border-white/10 bg-bg px-4 py-3 shadow-[0_4px_12px_rgba(0,0,0,0.35)]"
        style={{
          background: 'linear-gradient(180deg, rgba(18,18,26,0.98) 0%, var(--bg) 100%)',
        }}
      >
        <div className="kingdom-header flex flex-wrap items-start justify-between gap-3">
          <h1
            id="kingdom-name"
            className="min-w-0 flex-1 font-cinzel text-[18px] font-bold leading-tight"
            style={{ color: 'var(--text)' }}
          >
            <span style={{ color: 'var(--text)' }}>{playerName}</span>
            <span
              className="mx-1.5 font-normal italic"
              style={{ fontSize: '0.75em', color: 'var(--text3)' }}
            >
              of
            </span>
            <span
              style={{
                color: 'var(--gold)',
                fontWeight: 700,
                textShadow: '0 0 12px rgba(240, 98, 2, 0.4)',
              }}
            >
              {kingdomName}
            </span>
          </h1>

          <div className="ml-auto shrink-0 text-right" style={{ fontSize: 11, color: 'var(--text2)' }}>
            <div style={{ lineHeight: 1.5 }}>
              Turn{' '}
              <span id="turn-num" style={{ color: 'var(--text)', fontWeight: 600, fontSize: 13 }}>
                {turn}
              </span>
            </div>
            <div style={{ lineHeight: 1.5 }}>
              Score{' '}
              <span id="kingdom-score-disp" style={{ color: 'var(--gold)', fontWeight: 600, fontSize: 13 }}>
                {score.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setXpModalOpen(true)}
          title="Click for XP breakdown"
          className="mt-2.5 flex w-full cursor-pointer flex-wrap items-center justify-end gap-2 rounded-md border border-transparent bg-transparent px-1 py-1.5 transition hover:bg-[rgba(255,255,255,0.03)]"
          style={{ maxWidth: '100%' }}
        >
          <span style={{ fontSize: 11, color: 'var(--text3)', flexShrink: 0 }}>
            Level{' '}
            <span
              id="kingdom-level"
              style={{
                color: 'var(--gold)',
                fontWeight: 700,
                fontSize: 13,
                textDecoration: 'underline',
                textDecorationStyle: 'dotted',
                textUnderlineOffset: 2,
              }}
            >
              {level}
            </span>
          </span>
          <XpBar pct={pct} />
          <span id="xp-label" style={{ fontSize: 10, color: 'var(--text3)', flexShrink: 0 }}>
            {fmt(xpIntoLevel)} / {fmt(xpNeeded)} XP
          </span>
        </button>
      </div>

      <KingdomXpModal open={xpModalOpen} onClose={() => setXpModalOpen(false)} />
    </>
  );
};

export default KingdomBodyHeader;