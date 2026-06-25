import React, { useState } from 'react';
import { useGameState } from '../../hooks/useGameState';
import { useActivePanel } from '../../hooks/useActivePanel';
import { useKingdomRank } from '../../hooks/useKingdomRank.js';
import { kingdomXpProgress } from '../../utils/xp.js';
import { fmt } from '../../utils/fmt.js';
import KingdomXpModal from './KingdomXpModal.jsx';

import { HIDE_KINGDOM_HEADER_PANELS } from '../../utils/panelMeta.js';

const GAP = 8;

function XpBar({ pct }) {
  const width = Math.max(pct > 0 ? 2 : 0, pct);
  return (
    <div
      style={{
        height: 6,
        width: 110,
        flexShrink: 0,
        background: 'var(--bg4)',
        borderRadius: 3,
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
          borderRadius: 3,
          transition: 'width 0.4s ease',
          background: 'linear-gradient(90deg, var(--accent1), var(--gold))',
          boxShadow: pct > 0 ? '0 0 6px rgba(var(--theme-rgb), 0.45)' : undefined,
        }}
      />
    </div>
  );
}

function Stat({ label, value, valueStyle = {} }) {
  return (
    <span className="whitespace-nowrap" style={{ fontSize: 11, color: 'var(--text2)' }}>
      {label}{' '}
      <span style={{ color: 'var(--text)', fontWeight: 600, fontSize: 12, ...valueStyle }}>
        {value}
      </span>
    </span>
  );
}

const KingdomBodyHeader = () => {
  const { state } = useGameState();
  const { activePanel } = useActivePanel();
  const rank = useKingdomRank();
  const [xpModalOpen, setXpModalOpen] = useState(false);

  const kingdomReady = Boolean(
    state?.username || state?.name || (state?.turn != null && Number(state.turn) > 0),
  );

  if (!kingdomReady || HIDE_KINGDOM_HEADER_PANELS.has(activePanel)) return null;

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
        className="kd-top shell-lore-box relative z-10 mx-4 mb-3 mt-4 shrink-0"
      >
        <div
          className="kingdom-header flex flex-wrap items-center justify-between"
          style={{ gap: GAP }}
        >
          <div className="flex min-w-0 flex-1 flex-wrap items-center" style={{ gap: GAP }}>
            <h1
              id="kingdom-name"
              className="min-w-0 font-cinzel text-lg font-bold leading-none md:text-xl"
              style={{ color: 'var(--text)' }}
            >
              <span style={{ color: 'var(--text)' }}>{playerName}</span>
              <span
                className="font-normal italic"
                style={{ fontSize: '0.75em', color: 'var(--text3)', margin: '0 0.35em' }}
              >
                of
              </span>
              <span
                style={{
                  color: 'var(--gold)',
                  fontWeight: 700,
                  textShadow: '0 0 10px rgba(var(--theme-rgb), 0.35)',
                }}
              >
                {kingdomName}
              </span>
            </h1>

            {rank != null ? (
              <span
                id="kingdom-rank"
                className="shrink-0 rounded border border-white/10 bg-void-900/80 px-2 py-0.5 text-[11px] font-semibold leading-none text-text2"
                title="Kingdom rank by score"
              >
                World Rank{' '}
                <span className="font-cinzel font-bold text-text">#{rank}</span>
              </span>
            ) : (
              <span
                id="kingdom-rank"
                className="shrink-0 text-[10px] text-text3"
                title="Loading rank"
              >
                World Rank ...
              </span>
            )}
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-end" style={{ gap: GAP }}>
            <Stat label="Turn" value={turn} />
            <Stat label="Score" value={score.toLocaleString()} valueStyle={{ color: 'var(--gold)' }} />
          </div>
        </div>

        <button
          type="button"
          onClick={() => setXpModalOpen(true)}
          title="Click for XP breakdown"
          className="flex w-full cursor-pointer items-center justify-end border-none bg-transparent p-0 transition hover:opacity-90"
          style={{ gap: GAP, marginTop: GAP }}
        >
          <span style={{ fontSize: 11, color: 'var(--text3)', flexShrink: 0 }}>
            Lv{' '}
            <span
              id="kingdom-level"
              style={{
                color: 'var(--gold)',
                fontWeight: 700,
                fontSize: 12,
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
            {fmt(xpIntoLevel)}/{fmt(xpNeeded)} XP
          </span>
        </button>
      </div>

      <KingdomXpModal open={xpModalOpen} onClose={() => setXpModalOpen(false)} />
    </>
  );
};

export default KingdomBodyHeader;