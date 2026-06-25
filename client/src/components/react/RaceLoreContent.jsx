import React from 'react';
import RaceLorePortrait from './RaceLorePortrait.jsx';

export default function RaceLoreContent({ lore, regionName, regionBonus, portraitUrl, repair, onHeroClick }) {
  const strengths = Array.isArray(lore.strengths) ? lore.strengths : [];
  const weaknesses = Array.isArray(lore.weaknesses) ? lore.weaknesses : [];
  const heroes = Array.isArray(lore.heroes) ? lore.heroes : [];
  const cleanedRegionName = repair(regionName || '');

  return (
    <>
      <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', marginBottom: '20px' }}>
        <RaceLorePortrait
          portraitUrl={portraitUrl}
          alt={repair(lore.title || '')}
          fallbackIcon={repair(lore.icon || '⚔')}
        />
        <div style={{ flex: 1, paddingTop: '4px' }}>
          <h2 style={{ color: lore.color || 'var(--gold)', margin: '0 0 6px', fontSize: '24px', letterSpacing: '-0.5px', fontFamily: "'Cinzel', serif", fontWeight: 700 }}>
            {repair(lore.title || 'Unknown')}
          </h2>
          {cleanedRegionName && (
            <div style={{ fontSize: '13px', color: 'var(--text2)', marginBottom: '6px', fontWeight: 600 }}>
              {cleanedRegionName} Region
            </div>
          )}
          {regionBonus && (
            <div style={{ fontSize: '12px', color: 'var(--text3)', lineHeight: 1.4 }}>
              {repair(regionBonus)}
            </div>
          )}
        </div>
      </div>

      <p style={{ fontSize: '13px', color: 'var(--text2)', lineHeight: 1.8, fontStyle: 'italic', marginBottom: '18px' }}>
        {repair(lore.lore || '')}
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
        <div style={{ background: 'rgba(76,175,130,.08)', border: '1px solid rgba(76,175,130,.2)', borderRadius: 'var(--radius)', padding: '12px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--green)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '.5px' }}>Strengths</div>
          {strengths.map((s, i) => (
            <div key={i} style={{ fontSize: '12px', color: 'var(--text2)', padding: '2px 0' }}>✓ {repair(s)}</div>
          ))}
        </div>
        <div style={{ background: 'rgba(224,92,92,.08)', border: '1px solid rgba(224,92,92,.2)', borderRadius: 'var(--radius)', padding: '12px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--red)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '.5px' }}>Weaknesses</div>
          {weaknesses.map((w, i) => (
            <div key={i} style={{ fontSize: '12px', color: 'var(--text2)', padding: '2px 0' }}>✗ {repair(w)}</div>
          ))}
        </div>
      </div>

      {lore.special && (
        <div style={{ background: 'rgba(232,184,75,.08)', border: '1px solid rgba(232,184,75,.25)', borderRadius: 'var(--radius)', padding: '12px', marginBottom: '12px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--gold)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '.5px' }}>✨ Racial mastery — unlocks at unit level 25</div>
          <div style={{ fontSize: '13px', color: 'var(--text)' }}>{repair(lore.special)}</div>
        </div>
      )}

      {heroes.length > 0 && (
        <div style={{ background: 'rgba(143,184,74,.08)', border: '1px solid rgba(143,184,74,.25)', borderRadius: 'var(--radius)', padding: '12px', marginBottom: '12px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--green)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '.5px' }}>🦻 Notable Race Heroes</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {heroes.map((h) => (
              <div
                key={h}
                onClick={() => onHeroClick(h)}
                style={{ cursor: 'pointer', fontSize: '11px', background: 'var(--bg4)', padding: '3px 8px', borderRadius: '12px', color: 'var(--text2)', border: '1px solid var(--border2)' }}
              >
                {repair(h)}
              </div>
            ))}
          </div>
        </div>
      )}

      {lore.playstyle && (
        <div style={{ background: 'var(--bg3)', borderRadius: 'var(--radius)', padding: '12px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text3)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '.5px' }}>Recommended playstyle</div>
          <div style={{ fontSize: '13px', color: 'var(--text2)' }}>{repair(lore.playstyle)}</div>
        </div>
      )}
    </>
  );
}