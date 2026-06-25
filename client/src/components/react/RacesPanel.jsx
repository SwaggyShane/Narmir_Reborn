import React, { useState, useMemo, useCallback } from 'react';
import { repairMojibake } from '../../utils/repairMojibake.js';
import { openRaceLore } from '../../utils/openRaceLore.js';
import { showHeroLore } from '../../utils/showHeroLore.js';
import { getRacePortrait } from '../../utils/racePortraits.js';
import { RACE_LORE } from '../../utils/raceData.js';

function RaceCardPortrait({ portraitUrl, icon, alt }) {
  const [failed, setFailed] = useState(false);
  if (!portraitUrl || failed) {
    return (
      <div style={{ width: '100%', maxHeight: '180px', aspectRatio: '3 / 4', objectFit: 'contain', marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '56px', background: 'var(--bg3)', borderRadius: 'var(--radius)' }}>
        {repairMojibake(String(icon ?? '⚔'))}
      </div>
    );
  }

  return (
    <img
      src={portraitUrl}
      alt={alt}
      style={{ width: '100%', maxHeight: '180px', aspectRatio: '3 / 4', objectFit: 'contain', marginBottom: '12px', display: 'block' }}
      onError={() => setFailed(true)}
    />
  );
}

const RacesPanel = () => {
  const raceLore = RACE_LORE;

  const repair = useCallback((v) => repairMojibake(String(v ?? '')), []);

  const getPortraitUrl = useCallback((key) =>
    getRacePortrait(key, 'male') || '',
  []);

  const raceEntries = useMemo(
    () => Object.entries(raceLore).filter(([, r]) => r.lore),
    [raceLore],
  );

  return (
    <div id="races" className="panel">
      <div className="card mt-0">
        <div className="card-title">🦄 Race Information</div>
        <div style={{ fontSize: '13px', color: 'var(--text2)', lineHeight: 1.6, marginBottom: '16px' }}>
          Learn about the various races of Narmir, their history, and their unique passives and abilities.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {raceEntries.map(([key, r]) => {
            const portraitUrl = getPortraitUrl(key);
            const cardStyle = r.color
              ? { background: `color-mix(in srgb, ${r.color} 8%, transparent)`, borderLeft: `3px solid ${r.color}`, padding: '16px', borderRadius: 'var(--radius)' }
              : { background: 'var(--bg3)', padding: '16px', borderRadius: 'var(--radius)' };
            const strengths = Array.isArray(r.strengths) ? r.strengths : [];
            const weaknesses = Array.isArray(r.weaknesses) ? r.weaknesses : [];
            const heroes = Array.isArray(r.heroes) ? r.heroes : [];
            return (
              <div key={key} style={cardStyle}>
                <RaceCardPortrait portraitUrl={portraitUrl} icon={r.icon || '⚔'} alt={repair(r.title || key)} />
                <div
                  onClick={() => openRaceLore(key)}
                  style={{ cursor: 'pointer', fontSize: '16px', fontWeight: 'bold', color: 'var(--gold)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}
                  title="Click for detailed lore & details"
                >
                  {repair(r.icon || '⚔')} {repair(r.title || r.label || key)}
                  <span style={{ fontSize: '11px', opacity: 0.55, fontWeight: 'normal', fontFamily: 'sans-serif', textDecoration: 'underline' }}>(View details)</span>
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text2)', marginBottom: '12px', lineHeight: 1.5 }}>
                  {repair(r.lore || r.bonus || '')}
                </div>
                {r.special && (
                  <div style={{ fontSize: '12px', color: 'var(--gold)', marginBottom: '12px' }}>
                    🌸 <strong>Special:</strong> {repair(r.special)}
                  </div>
                )}
                <div style={{ display: 'flex', gap: '20px', fontSize: '12px', flexWrap: 'wrap' }}>
                  {strengths.length > 0 && (
                    <div style={{ flex: 1, minWidth: '100px' }}>
                      <strong style={{ color: 'var(--green)', marginBottom: '4px', display: 'block' }}>Strengths</strong>
                      <ul style={{ margin: 0, paddingLeft: '16px', color: 'var(--text3)' }}>
                        {strengths.map((s, i) => (
                          <li key={i} style={{ padding: '2px 0' }}>{repair(s)}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {weaknesses.length > 0 && (
                    <div style={{ flex: 1, minWidth: '100px' }}>
                      <strong style={{ color: 'var(--red)', marginBottom: '4px', display: 'block' }}>Weaknesses</strong>
                      <ul style={{ margin: 0, paddingLeft: '16px', color: 'var(--text3)' }}>
                        {weaknesses.map((w, i) => (
                          <li key={i} style={{ padding: '2px 0' }}>{repair(w)}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {heroes.length > 0 && (
                    <div style={{ flex: 1, minWidth: '100px' }}>
                      <strong style={{ color: 'var(--gold)', marginBottom: '4px', display: 'block' }}>Notable Heroes</strong>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {heroes.map((h) => (
                          <span
                            key={h}
                            onClick={() => showHeroLore(h)}
                            style={{ fontSize: '10px', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text2)', cursor: 'pointer' }}
                          >
                            {repair(h)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
};

export default RacesPanel;
