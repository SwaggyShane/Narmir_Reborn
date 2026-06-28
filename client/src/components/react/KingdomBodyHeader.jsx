import React, { useState } from 'react';
import { useActivePanel } from '../../hooks/useActivePanel';
import { kingdomXpProgress } from '../../utils/xp.js';
import { fmt } from '../../utils/fmt.js';
import {
  usePlayerName,
  useKingdomName,
  useLevel,
  useXp,
  usePrestige,
  useTurn,
  useScore,
  useRank,
  useKingdomMetadata,
  useProfileStore,
} from '../../stores';
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
  const { activePanel } = useActivePanel();
  const rank = useRank();
  const [xpModalOpen, setXpModalOpen] = useState(false);

  // Use Zustand selectors for each field (prevents re-renders on unrelated changes)
  const playerName = usePlayerName();
  const kingdomName = useKingdomName();
  const level = useLevel();
  const xp = useXp();
  const prestige = usePrestige();
  const turn = useTurn();
  const score = useScore();
  const metadata = useKingdomMetadata();

  // Check if kingdom is ready by accessing store state
  const kingdomReady = useProfileStore(
    (state) =>
      Boolean(state.username || state.name || (state.turn != null && Number(state.turn) > 0))
  );

  if (!kingdomReady || HIDE_KINGDOM_HEADER_PANELS.has(activePanel)) return null;

  const { xpNeeded, xpIntoLevel, pct } = kingdomXpProgress(level, xp, prestige);
  const displayScore = Math.floor(Number(score) || 0);

  return (
    <>
      <div
        id="kd-top"
        className="kd-top shell-lore-box relative z-10 mb-2 mt-2 box-border min-w-0 w-full max-w-full shrink-0 overflow-hidden px-2 sm:mb-3 sm:mt-3 sm:px-4"
      >
        <div
          className="kingdom-header flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
          style={{ gap: GAP }}
        >
          <div className="flex min-w-0 w-full flex-wrap items-center sm:flex-1" style={{ gap: GAP }}>
            <h1
              id="kingdom-name"
              className="min-w-0 break-words font-cinzel text-base font-bold leading-snug sm:text-lg md:text-xl text-[var(--text)]"
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

          <div className="flex w-full shrink-0 flex-wrap items-center justify-start sm:w-auto sm:justify-end" style={{ gap: GAP }}>
            <Stat label="Turn" value={turn} />
            <Stat label="Score" value={displayScore.toLocaleString()} valueStyle={{ color: 'var(--gold)' }} />
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
            <button
              type="button"
              onClick={() => setXpModalOpen(true)}
              title="Click for XP breakdown"
              className="border-none bg-transparent p-0 transition hover:opacity-90"
              style={{ display: 'flex', gap: GAP, alignItems: 'center', flexShrink: 0 }}
            >
              <XpBar pct={pct} />
              <span id="xp-label" className="hidden xs:inline" style={{ fontSize: 10, color: 'var(--text3)', flexShrink: 0 }}>
                {fmt(xpIntoLevel)}/{fmt(xpNeeded)} XP
              </span>
            </button>
          </div>
        </div>

        {(metadata.local_time || metadata.vampire_countdown || metadata.season) && (
          <div className="flex w-full shrink-0 flex-wrap items-center justify-start sm:w-auto sm:justify-end" style={{ gap: GAP, marginTop: GAP }}>
            {metadata.local_time && <Stat label="Time" value={metadata.local_time} />}
            {metadata.vampire_countdown && <Stat label="Vampire" value={metadata.vampire_countdown} />}
            {metadata.season && <Stat label="Season" value={metadata.season} />}
          </div>
        )}
      </div>

      <KingdomXpModal open={xpModalOpen} onClose={() => setXpModalOpen(false)} />
    </>
  );
};

export default KingdomBodyHeader;