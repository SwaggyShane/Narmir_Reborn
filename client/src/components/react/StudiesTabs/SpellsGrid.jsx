import React from 'react';

export const SpellsGrid = ({ title, icon, level, magesAssigned, spellsByTier }) => {
  return (
    <div className="flex flex-col gap-3">
      <div className="card m-0 p-4">
        <div className="text-6xl mb-2">{icon}</div>
        <div className="card-title !mb-0.5 text-base">{title}</div>
        <div className="text-2xs text-[var(--text3)] mb-3">
          {icon === '📖' ? 'Mages continuing study' : 'Mages specializing'}
        </div>

        <div className="trow">
          <span className="name">Level</span>
          <span className="count">{level}%</span>
        </div>
        <div className="trow">
          <span className="name">Progress</span>
          <span className="count">—</span>
        </div>
        <div className="trow">
          <span className="name">Mages assigned</span>
          <span className="count">{magesAssigned}</span>
        </div>

        <div className="mt-3 text-2xs text-[var(--text3)]">
          Turns to next level: —
        </div>
      </div>

      <div className="card m-0">
        <div className="card-title !mb-3 capitalize">{title}</div>
        <div className="flex flex-col gap-4">
          {Object.keys(spellsByTier).length > 0 ? (
            Object.keys(spellsByTier)
              .map(Number)
              .sort((a, b) => a - b)
              .map(tier => (
                <div key={`tier-${tier}`}>
                  <div className="text-xs font-semibold text-[var(--text)] mb-2">
                    Tier {tier}
                    {tier > 1 && ` (requires ${(tier - 1) * 20}% spellbook)`}
                  </div>
                  <div className="flex flex-col gap-1.5 ml-3">
                    {spellsByTier[tier].map(spell => {
                      const isFullyRevealed = spell.reveals.revealedCount === spell.reveals.totalLetters;
                      return (
                        <div
                          key={spell.id}
                          className="text-xs"
                          style={{
                            color: isFullyRevealed ? 'var(--text2)' : 'var(--text3)',
                            fontFamily: 'Noto Sans Runic, sans-serif',
                          }}
                        >
                          <span className="mr-2">{isFullyRevealed ? '✨' : '⬜'}</span>
                          <strong>{spell.runeDisplay}</strong>
                          {isFullyRevealed && <> — {spell.desc}</>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
          ) : (
            <div className="text-xs text-[var(--text3)]">Loading spell structure...</div>
          )}
        </div>
      </div>
    </div>
  );
};
