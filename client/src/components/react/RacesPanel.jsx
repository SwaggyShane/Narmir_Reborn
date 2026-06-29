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
      <div className="w-full max-h-[180px] aspect-[3/4] object-contain mb-3 flex items-center justify-center text-6xl bg-[var(--bg3)] rounded-[var(--radius)]">
        {repairMojibake(String(icon ?? '⚔'))}
      </div>
    );
  }

  return (
    <img
      src={portraitUrl}
      alt={alt}
      className="w-full max-h-[180px] aspect-[3/4] object-contain mb-3 block"
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
        <div className="text-[13px] text-[var(--text2)] leading-relaxed mb-4">
          Learn about the various races of Narmir, their history, and their unique passives and abilities.
        </div>
        <div className="flex flex-col gap-5">
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
                  className="cursor-pointer text-base font-bold text-[var(--gold)] mb-2 flex items-center gap-1.5"
                  title="Click for detailed lore & details"
                >
                  {repair(r.icon || '⚔')} {repair(r.title || r.label || key)}
                  <span className="text-[11px] opacity-55 font-normal font-sans underline">(View details)</span>
                </div>
                <div className="text-[13px] text-[var(--text2)] mb-3 leading-relaxed">
                  {repair(r.lore || r.bonus || '')}
                </div>
                {r.special && (
                  <div className="text-[12px] text-[var(--gold)] mb-3">
                    🌸 <strong>Special:</strong> {repair(r.special)}
                  </div>
                )}
                <div className="flex gap-5 text-[12px] flex-wrap">
                  {strengths.length > 0 && (
                    <div className="flex-1 min-w-[100px]">
                      <strong className="text-[var(--green)] mb-1 block">Strengths</strong>
                      <ul className="m-0 pl-4 text-[var(--text3)]">
                        {strengths.map((s, i) => (
                          <li key={i} className="py-0.5">{repair(s)}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {weaknesses.length > 0 && (
                    <div className="flex-1 min-w-[100px]">
                      <strong className="text-[var(--red)] mb-1 block">Weaknesses</strong>
                      <ul className="m-0 pl-4 text-[var(--text3)]">
                        {weaknesses.map((w, i) => (
                          <li key={i} className="py-0.5">{repair(w)}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {heroes.length > 0 && (
                    <div className="flex-1 min-w-[100px]">
                      <strong className="text-[var(--gold)] mb-1 block">Notable Heroes</strong>
                      <div className="flex flex-wrap gap-1">
                        {heroes.map((h) => (
                          <span
                            key={h}
                            onClick={() => showHeroLore(h)}
                            className="text-[10px] bg-white/5 px-1.5 py-0.5 rounded border border-white/10 text-[var(--text2)] cursor-pointer"
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
