import React from 'react';
import RaceLorePortrait from './RaceLorePortrait.jsx';

export default function RaceLoreContent({ lore, regionName, regionBonus, portraitUrl, repair, onHeroClick }) {
  const strengths = Array.isArray(lore.strengths) ? lore.strengths : [];
  const weaknesses = Array.isArray(lore.weaknesses) ? lore.weaknesses : [];
  const heroes = Array.isArray(lore.heroes) ? lore.heroes : [];
  const cleanedRegionName = repair(regionName || '');

  return (
    <>
      <div className="mb-5 flex flex-col items-center gap-5 sm:flex-row sm:items-start">
        <RaceLorePortrait
          portraitUrl={portraitUrl}
          alt={repair(lore.title || '')}
          fallbackIcon={repair(lore.icon || '⚔')}
        />
        <div className="w-full flex-1 pt-0 text-center sm:pt-1 sm:text-left">
          <h2 className="font-cinzel m-0 mb-1.5 text-2xl font-bold tracking-tight" style={{ color: lore.color || 'var(--gold)', fontFamily: "'Cinzel', serif" }}>
            {repair(lore.title || 'Unknown')}
          </h2>
          {cleanedRegionName && (
            <div className="mb-1.5 text-sm font-semibold text-[var(--text2)]">
              {cleanedRegionName} Region
            </div>
          )}
          {regionBonus && (
            <div className="text-xs text-[var(--text3)] leading-relaxed">
              {repair(regionBonus)}
            </div>
          )}
        </div>
      </div>

      <p className="mb-4 text-sm text-[var(--text2)] leading-loose italic">
        {repair(lore.lore || '')}
      </p>

      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-[var(--green-border)] bg-[var(--green-bg)] p-3">
          <div className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--green)]">Strengths</div>
          {strengths.map((s, i) => (
            <div key={i} className="py-0.5 text-xs text-[var(--text2)]">✓ {repair(s)}</div>
          ))}
        </div>
        <div className="rounded-lg border border-[var(--red-border)] bg-[var(--red-bg)] p-3">
          <div className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--red)]">Weaknesses</div>
          {weaknesses.map((w, i) => (
            <div key={i} className="py-0.5 text-xs text-[var(--text2)]">✗ {repair(w)}</div>
          ))}
        </div>
      </div>

      {lore.special && (
        <div className="mb-3 rounded-lg border border-[var(--gold-border)] bg-[var(--gold-bg)] p-3">
          <div className="mb-1.5 text-xs font-bold uppercase tracking-wider text-[var(--gold)]">✨ Racial mastery — unlocks at unit level 25</div>
          <div className="text-sm text-[var(--text)]">{repair(lore.special)}</div>
        </div>
      )}

      {heroes.length > 0 && (
        <div className="mb-3 rounded-lg border border-[var(--green-border)] bg-[var(--green-bg)] p-3">
          <div className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--green)]">🦻 Notable Race Heroes</div>
          <div className="flex flex-wrap gap-1.5">
            {heroes.map((h) => (
              <div
                key={h}
                onClick={() => onHeroClick(h)}
                className="cursor-pointer rounded-full border border-[var(--border)] bg-[var(--bg3)] px-2 py-0.5 text-xs text-[var(--text2)] hover:text-[var(--text)] transition-colors"
              >
                {repair(h)}
              </div>
            ))}
          </div>
        </div>
      )}

      {lore.playstyle && (
        <div className="rounded-lg bg-[var(--bg3)] p-3">
          <div className="mb-1.5 text-xs font-bold uppercase tracking-wider text-[var(--text3)]">Recommended playstyle</div>
          <div className="text-sm text-[var(--text2)]">{repair(lore.playstyle)}</div>
        </div>
      )}
    </>
  );
}