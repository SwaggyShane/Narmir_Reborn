import React, { useState } from 'react';
import clsx from 'clsx';
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

function XpBar({ pct }) {
  const width = Math.max(pct > 0 ? 2 : 0, pct);
  return (
    <div
      className="h-1.5 w-[110px] shrink-0 rounded-sm overflow-hidden border border-white/5 bg-[var(--bg4)]"
      aria-hidden="true"
    >
      <div
        id="xp-bar"
        className={clsx(
          'h-full rounded-sm bg-gradient-to-r from-[var(--accent1)] to-[var(--gold)] transition-all duration-400',
          pct > 0 && 'shadow-[0_0_6px_rgba(var(--theme-rgb),0.45)]',
        )}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

function Stat({ label, value, valueClass = 'text-[var(--text)]' }) {
  return (
    <span className="whitespace-nowrap text-[11px] text-[var(--text2)]">
      {label}{' '}
      <span className={clsx('font-semibold text-[12px]', valueClass)}>
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
        <div className="kingdom-header flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex min-w-0 w-full flex-wrap items-center gap-2 sm:flex-1">
            <h1
              id="kingdom-name"
              className="min-w-0 break-words font-cinzel text-base font-bold leading-snug sm:text-lg md:text-xl text-[var(--text)]"
            >
              <span className="text-[var(--text)]">{playerName}</span>
              <span
                className="font-normal italic text-[12px] text-[var(--text3)] mx-1"
              >
                of
              </span>
              <span className="font-bold text-[var(--gold)] [text-shadow:0_0_10px_rgba(var(--theme-rgb),0.35)]">
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

          <div className="flex w-full shrink-0 flex-wrap items-center justify-start gap-2 sm:w-auto sm:justify-end">
            <Stat label="Turn" value={turn} />
            <Stat label="Score" value={displayScore.toLocaleString()} valueClass="text-[var(--gold)]" />
            <span className="text-[11px] text-[var(--text3)] shrink-0">
              Lv{' '}
              <span
                id="kingdom-level"
                className="font-bold text-[12px] text-[var(--gold)] underline decoration-dotted underline-offset-1"
              >
                {level}
              </span>
            </span>
            <button
              type="button"
              onClick={() => setXpModalOpen(true)}
              title="Click for XP breakdown"
              className="border-none bg-transparent p-0 transition hover:opacity-90 flex items-center gap-2 shrink-0"
            >
              <XpBar pct={pct} />
              <span id="xp-label" className="hidden xs:inline text-[10px] text-[var(--text3)] shrink-0">
                {fmt(xpIntoLevel)}/{fmt(xpNeeded)} XP
              </span>
            </button>
          </div>
        </div>

        {(metadata.local_time || metadata.vampire_countdown || metadata.season) && (
          <div className="mt-2 flex w-full shrink-0 flex-wrap items-center justify-start gap-2 sm:w-auto sm:justify-end">
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