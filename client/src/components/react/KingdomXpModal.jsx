import React, { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { fmt } from '../../utils/fmt.js';
import { kingdomXpProgress, xpForLevel } from '../../utils/xp.js';
import { useLevel, useXp, usePrestige, useRace, useXpSources, useMilestoneBonuses, useMilestoneTitle } from '../../stores';
import {
  formatMilestoneBonusSummary,
  KINGDOM_XP_MILESTONES,
  parseMilestoneBonuses,
  parseXpSources,
  RACE_REWARD_MODIFIERS,
  RACE_XP_BONUSES,
  XP_SOURCE_ROWS,
} from '../../utils/kingdomXpData.js';

function XpSourceBar({ label, earned, total, barClass, textClass = 'text-white' }) {
  const pct = total > 0 ? (earned / total) * 100 : 0;
  const width = total > 0 ? Math.max(earned > 0 ? 1 : 0, pct) : 0;

  return (
    <div className="flex items-center gap-2">
      <div className="w-[120px] shrink-0 text-xs text-text3">{label}</div>
      <div className="min-w-0 flex-1">
        <div className="h-5 overflow-hidden rounded bg-bg3">
          <div
            className={clsx('h-full rounded bg-gradient-to-r transition-all', barClass, textClass)}
            style={{ width: `${width}%` }}
            title={total > 0 ? `${Math.round(pct)}%` : '0%'}
          />
        </div>
      </div>
    </div>
  );
}

export default function KingdomXpModal({ open, onClose }) {
  const level = useLevel();
  const xp = useXp();
  const prestige = usePrestige();
  const race = useRace() || 'human';
  const xpSourcesData = useXpSources();
  const milestoneBonusesData = useMilestoneBonuses();
  const msTitle = useMilestoneTitle();

  const { xpNeeded, xpIntoLevel, pct } = useMemo(
    () => kingdomXpProgress(level, xp, prestige),
    [level, xp, prestige],
  );

  const xpSources = useMemo(() => parseXpSources(xpSourcesData), [xpSourcesData]);
  const totalEarned = useMemo(
    () => Object.values(xpSources).reduce((sum, val) => sum + (Number(val) || 0), 0),
    [xpSources],
  );

  const msBonuses = useMemo(
    () => parseMilestoneBonuses(milestoneBonusesData),
    [milestoneBonusesData],
  );
  const raceMod = RACE_REWARD_MODIFIERS[race] || '';

  useEffect(() => {
    if (!open || typeof document === 'undefined') return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9000] overflow-y-auto bg-black/70 backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="relative mx-auto my-10 w-full max-w-[520px] rounded-xl border-2 border-[var(--accent1)] bg-bg2 p-6 shadow-[0_8px_32px_rgba(0,0,0,0.6)]">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-3 border-none bg-transparent text-xl leading-none text-text3"
          aria-label="Close"
        >
          ✕
        </button>

        <div className="mb-1 text-lg font-bold text-gold">🌟 Kingdom Level</div>
        <div className="mb-1.5 font-cinzel text-5xl font-black leading-none text-text">{level}</div>
        <div className="mb-2 text-sm text-text3">{fmt(xp)} XP total</div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="rounded-md border border-purple-500/30 bg-purple-500/15 px-2.5 py-1 text-sm font-bold text-accent1">
            {msTitle}
          </span>
          <span className="text-xs text-green">{formatMilestoneBonusSummary(msBonuses)}</span>
        </div>

        <div className="mb-5">
          <div className="mb-1.5 flex justify-between text-xs text-text3">
            <span>Progress to next level</span>
            <span>{pct}%</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-md bg-[var(--bg4)]">
            <div
              className="h-full rounded-md bg-gradient-to-r from-[var(--accent1)] to-[var(--gold)] transition-[width] duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="mt-1 flex justify-between text-[11px] text-text3">
            <span>{fmt(xpIntoLevel)} / {fmt(xpNeeded)} XP</span>
            <span>{fmt(xpNeeded - xpIntoLevel)} XP to level {level + 1}</span>
          </div>
        </div>

        <div className="mb-2 border-b border-white/5 pb-1.5 text-sm font-semibold text-text2">
          XP sources
        </div>
        <div className="mb-5 flex flex-col gap-2">
          {XP_SOURCE_ROWS.map((row) => (
            <XpSourceBar
              key={row.key}
              label={row.label}
              earned={Number(xpSources[row.key]) || 0}
              total={totalEarned}
              barClass={row.barClass}
              textClass={row.textClass}
            />
          ))}
        </div>

        <div className="mb-5 rounded-lg border border-purple-500/30 bg-purple-500/10 p-2.5 text-xs">
          <span className="text-text3">Race XP bonus: </span>
          <span className="font-semibold text-accent1">{RACE_XP_BONUSES[race] || 'None'}</span>
        </div>

        <div className="mb-2 border-b border-white/5 pb-1.5 text-sm font-semibold text-text2">
          Level milestones &amp; caps
        </div>
        <p className="mb-3 text-xs text-text3">
          Higher levels unlock larger building caps and stronger troops.
        </p>

        <div className="grid max-h-[280px] grid-cols-[auto_1fr_auto] items-center gap-x-4 gap-y-2 overflow-y-auto pr-1 text-xs">
          {KINGDOM_XP_MILESTONES.map((milestone, index) => {
            const reached = level >= milestone.level;
            const nextMilestone = KINGDOM_XP_MILESTONES[index + 1];
            const isCurrent = reached && (nextMilestone ? level < nextMilestone.level : true);
            const xpReq = xpForLevel(milestone.level, prestige);

            return (
              <React.Fragment key={milestone.level}>
                <div className={clsx('font-medium', reached ? 'text-gold' : 'text-text3', isCurrent && 'font-bold')}>
                  {reached ? '✓' : '○'} Lv {milestone.level}
                </div>
                <div className={clsx(reached ? 'text-text' : 'text-text3', isCurrent && 'font-semibold')}>
                  {milestone.label}
                  {isCurrent ? <span className="ml-1 text-[10px] text-green">(current)</span> : null}
                  <div className="text-[11px] text-text3">
                    {milestone.note}
                    {milestone.level > 1 && raceMod ? (
                      <div className="mt-0.5 text-[10px] text-accent1">{raceMod}</div>
                    ) : null}
                  </div>
                </div>
                <div className="text-right text-text3">
                  {milestone.level === 1 ? '—' : `${fmt(xpReq)} XP`}
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>,
    document.body,
  );
}