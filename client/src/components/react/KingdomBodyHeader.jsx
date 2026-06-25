import React, { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { useGameState } from '../../hooks/useGameState';
import { useActivePanel } from '../../hooks/useActivePanel';
import { useKingdomRank } from '../../hooks/useKingdomRank.js';
import { kingdomXpProgress } from '../../utils/xp.js';
import { fmt } from '../../utils/fmt.js';
import { getRacePortrait } from '../../utils/racePortraits.js';
import { RACE_LORE } from '../../utils/raceData.js';
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

const GAP = 8;

const toRaceKey = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');

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
          boxShadow: pct > 0 ? '0 0 6px rgba(240, 98, 2, 0.45)' : undefined,
        }}
      />
    </div>
  );
}

const KingdomBodyHeader = () => {
  const { state } = useGameState();
  const { activePanel } = useActivePanel();
  const rank = useKingdomRank();
  const [xpModalOpen, setXpModalOpen] = useState(false);
  const [portraitError, setPortraitError] = useState(false);

  const kingdomReady = Boolean(
    state?.username || state?.name || (state?.turn != null && Number(state.turn) > 0),
  );

  const raceKey = useMemo(() => toRaceKey(state?.race), [state?.race]);
  const raceLore = RACE_LORE[raceKey];
  const raceColor = raceLore?.color || 'var(--gold)';
  const portraitUrl = useMemo(() => {
    if (state?.customPortrait) return state.customPortrait;
    return getRacePortrait(raceKey, state?.gender || 'male') || '';
  }, [raceKey, state?.customPortrait, state?.gender]);

  useEffect(() => {
    setPortraitError(false);
  }, [portraitUrl]);

  if (!kingdomReady || HIDE_HEADER_PANELS.has(activePanel)) return null;

  const playerName = state.username || state.owner_name || state.owner || 'Player';
  const kingdomName = state.name || state.kingdomName || 'Kingdom';
  const level = state.level ?? 1;
  const xp = state.xp ?? 0;
  const prestige = state.prestige_level ?? 0;
  const { xpNeeded, xpIntoLevel, pct } = kingdomXpProgress(level, xp, prestige);
  const turn = state.turn ?? 0;
  const score = Math.floor(Number(state.score) || 0);
  const showPortrait = portraitUrl && !portraitError;

  return (
    <>
      <div
        id="kd-top"
        className="kd-top relative z-10 shrink-0 border-b border-white/10 px-4 py-3 shadow-[0_4px_12px_rgba(0,0,0,0.3)]"
        style={{
          background: 'linear-gradient(180deg, rgba(18,18,26,0.98) 0%, var(--bg) 100%)',
        }}
      >
        <div className="kingdom-lore-header kingdom-header">
          <div
            className={clsx(
              'kingdom-lore-portrait',
              !showPortrait && 'kingdom-lore-portrait--fallback',
            )}
          >
            {showPortrait ? (
              <img
                src={portraitUrl}
                alt={kingdomName}
                referrerPolicy="no-referrer"
                onError={() => setPortraitError(true)}
              />
            ) : (
              <span aria-hidden="true">{raceLore?.icon || '🏰'}</span>
            )}
          </div>

          <div className="kingdom-lore-title-group">
            <h2 id="kingdom-name" className="kingdom-lore-title">
              <span style={{ color: 'var(--text)' }}>{playerName}</span>
              <span
                className="font-normal italic"
                style={{ fontSize: '0.85em', color: 'var(--text3)', margin: '0 0.35em' }}
              >
                of
              </span>
              <span
                style={{
                  color: raceColor,
                  textShadow: `0 0 10px ${raceColor}55`,
                }}
              >
                {kingdomName}
              </span>
            </h2>

            <div id="kingdom-rank" className="kingdom-lore-subtitle">
              {rank != null ? (
                <>
                  World Rank <span className="font-cinzel text-text">#{rank}</span>
                </>
              ) : (
                'World Rank ...'
              )}
            </div>

            <div className="kingdom-lore-meta">
              Turn <span className="font-semibold text-text">{turn}</span>
              <span className="mx-1.5 text-text3/50">|</span>
              Score{' '}
              <span className="font-semibold" style={{ color: 'var(--gold)' }}>
                {score.toLocaleString()}
              </span>
            </div>
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