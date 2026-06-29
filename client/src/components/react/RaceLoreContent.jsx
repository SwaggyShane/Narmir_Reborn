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
          <h2 className="font-cinzel m-0 mb-1.5 text-2xl font-bold tracking-tight" style={{ color: lore.color || 'var(--gold)' }}>
            {repair(lore.title || 'Unknown')}
          </h2>
          {cleanedRegionName && (
            <div className="mb-1.5 text-sm font-semibold text-gray-400">
              {cleanedRegionName} Region
            </div>
          )}
          {regionBonus && (
            <div className="text-xs text-gray-500 leading-relaxed">
              {repair(regionBonus)}
            </div>
          )}
        </div>
      </div>

      <p className="mb-4 text-sm text-gray-400 leading-loose italic">
        {repair(lore.lore || '')}
      </p>

      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-green-900 bg-green-950 p-3">
          <div className="mb-2 text-xs font-bold uppercase tracking-wider text-green-500">Strengths</div>
          {strengths.map((s, i) => (
            <div key={i} className="py-0.5 text-xs text-gray-400">✓ {repair(s)}</div>
          ))}
        </div>
        <div className="rounded-lg border border-red-900 bg-red-950 p-3">
          <div className="mb-2 text-xs font-bold uppercase tracking-wider text-red-500">Weaknesses</div>
          {weaknesses.map((w, i) => (
            <div key={i} className="py-0.5 text-xs text-gray-400">✗ {repair(w)}</div>
          ))}
        </div>
      </div>

      {lore.special && (
        <div className="mb-3 rounded-lg border border-yellow-900 bg-yellow-950 p-3">
          <div className="mb-1.5 text-xs font-bold uppercase tracking-wider text-yellow-500">✨ Racial mastery — unlocks at unit level 25</div>
          <div className="text-sm text-gray-100">{repair(lore.special)}</div>
        </div>
      )}

      {heroes.length > 0 && (
        <div className="mb-3 rounded-lg border border-green-900 bg-green-950 p-3">
          <div className="mb-2 text-xs font-bold uppercase tracking-wider text-green-500">🦻 Notable Race Heroes</div>
          <div className="flex flex-wrap gap-1.5">
            {heroes.map((h) => (
              <div
                key={h}
                onClick={() => onHeroClick(h)}
                className="cursor-pointer rounded-full border border-gray-600 bg-gray-800 px-2 py-0.5 text-xs text-gray-400 hover:text-gray-300 transition-colors"
              >
                {repair(h)}
              </div>
            ))}
          </div>
        </div>
      )}

      {lore.playstyle && (
        <div className="rounded-lg bg-gray-800 p-3">
          <div className="mb-1.5 text-xs font-bold uppercase tracking-wider text-gray-500">Recommended playstyle</div>
          <div className="text-sm text-gray-400">{repair(lore.playstyle)}</div>
        </div>
      )}
    </>
  );
}