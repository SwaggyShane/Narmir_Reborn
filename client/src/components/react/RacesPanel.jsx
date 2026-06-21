import React, { useState, useMemo, useCallback } from 'react';
import { apiCall } from '../../utils/api.js';
import { repairMojibake } from '../../utils/repairMojibake.js';
import { fmt } from '../../utils/fmt.js';
import LoreModal from './LoreModal.jsx';

const HERO_PORTRAITS = {
  siegebreaker: '/hero/siegebreaker.webp',
  forge_lord: '/hero/forge_lord.webp',
  stonelord: '/hero/stonelord.webp',
  archmage: '/hero/archmage.webp',
  lunar_sentinel: '/hero/lunar_sentinel.webp',
  mage_king: '/hero/mage_king.webp',
  warlord: '/hero/warlord.webp',
  high_chieftain: '/hero/high_chieftain.webp',
  warshaman: '/hero/warshaman.webp',
  assassin: '/hero/assassin.webp',
  void_weaver: '/hero/void_weaver.webp',
  shadowmaster: '/hero/shadowmaster.webp',
  paladin: '/hero/paladin.webp',
  grand_chancellor: '/hero/grand_chancellor.webp',
  high_consul: '/hero/grand_chancellor.webp',
  alpha: '/hero/warlord.webp',
  storm_howler: '/hero/warshaman.webp',
  blood_shaman: '/hero/warshaman.webp',
  night_lord: '/hero/void_weaver.webp',
  sanguine_oracle: '/hero/shadowmaster.webp',
  blood_matriarch: '/hero/assassin.webp',
  _default: '/hero/siegebreaker.webp',
};

function heroPortraitUrl(cls) {
  return HERO_PORTRAITS[cls] || HERO_PORTRAITS._default || '';
}

function HeroLoreContent({ heroKey, hero }) {
  const repair = (v) => repairMojibake(String(v ?? ''));
  const abilities = Array.isArray(hero.abilities) ? hero.abilities : [];
  return (
    <div id="races" className="panel panel-immersive min-h-0 w-full overflow-y-auto px-4 pb-5" style={{ display: 'none' }}>
      <div className="card mx-auto mt-0 w-full max-w-6xl rounded-2xl border border-[var(--border)] bg-[var(--bg2)] p-5">
        <div className="mb-2 text-[20px] font-bold text-[var(--gold)]">🦄 Race Information</div>
        <div className="mb-4 text-[13px] leading-6 text-[var(--text2)]">
          Learn about the various races of Narmir, their history, and their unique passives and abilities.
        </div>
        <div className="flex flex-col gap-5">
          {raceEntries.map(([key, r]) => {
            const portraitUrl = getRacePortrait(key);
            const cardStyle = r.color
              ? { background: `color-mix(in srgb, ${r.color} 8%, transparent)`, borderLeft: `3px solid ${r.color}` }
              : { background: 'var(--bg3)' };
            const strengths = Array.isArray(r.strengths) ? r.strengths : [];
            const weaknesses = Array.isArray(r.weaknesses) ? r.weaknesses : [];
            const heroes = Array.isArray(r.heroes) ? r.heroes : [];
            return (
              <div key={key} className="rounded-2xl border border-[var(--border)] p-4" style={cardStyle}>
                <div className="grid gap-4 xl:grid-cols-[180px_minmax(0,1fr)]">
                  <div className="mx-auto w-full max-w-[180px]">
                    <RaceCardPortrait portraitUrl={portraitUrl} icon={r.icon || '?'} alt={repair(r.title || key)} />
                    <button
                      type="button"
                      onClick={() => setSelectedRace(key)}
                      className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--bg4)] px-3 py-2 text-left text-[15px] font-bold text-[var(--gold)]"
                      title="Click for detailed lore & details"
                    >
                      <span>{repair(r.icon || '?')}</span>
                      <span className="min-w-0 truncate">{repair(r.title || r.label || key)}</span>
                    </button>
                    <div className="mt-2 text-center text-[11px] font-normal text-[var(--text3)] underline underline-offset-2 opacity-70">
                      View details
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="mb-3 text-[13px] leading-6 text-[var(--text2)]">
                      {repair(r.lore || r.bonus || '')}
                    </div>
                    {r.special && (
                      <div className="mb-3 rounded-2xl border border-[rgba(232,184,75,.25)] bg-[rgba(232,184,75,.08)] p-3 text-[12px] text-[var(--gold)]">
                        <strong>Special:</strong> {repair(r.special)}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-5 text-[12px]">
                      {strengths.length > 0 && (
                        <div className="min-w-[100px] flex-1 rounded-2xl border border-[rgba(76,175,130,.2)] bg-[rgba(76,175,130,.08)] p-3">
                          <strong className="mb-1 block text-[var(--green)]">Strengths</strong>
                          <ul className="m-0 pl-4 text-[var(--text3)]">
                            {strengths.map((s, i) => (
                              <li key={i} className="py-0.5">{repair(s)}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {weaknesses.length > 0 && (
                        <div className="min-w-[100px] flex-1 rounded-2xl border border-[rgba(224,92,92,.2)] bg-[rgba(224,92,92,.08)] p-3">
                          <strong className="mb-1 block text-[var(--red)]">Weaknesses</strong>
                          <ul className="m-0 pl-4 text-[var(--text3)]">
                            {weaknesses.map((w, i) => (
                              <li key={i} className="py-0.5">{repair(w)}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {heroes.length > 0 && (
                        <div className="min-w-[100px] flex-1 rounded-2xl border border-[rgba(232,184,75,.2)] bg-[rgba(232,184,75,.08)] p-3">
                          <strong className="mb-1 block text-[var(--gold)]">Notable Heroes</strong>
                          <div className="flex flex-wrap gap-1">
                            {heroes.map((h) => (
                              <span
                                key={h}
                                onClick={() => openHeroLore(h)}
                                className="cursor-pointer rounded border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.05)] px-1.5 py-0.5 text-[10px] text-[var(--text2)]"
                              >
                                {repair(h)}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <LoreModal
        isOpen={!!heroLoreKey}
        onClose={() => setHeroLoreKey(null)}
        title={heroLoreData ? `${repair(heroLoreData.name || '')} Class Lore` : 'Hero Lore'}
      >
        {heroLoreData && <HeroLoreContent heroKey={heroLoreKey} hero={heroLoreData} />}
      </LoreModal>
    </div>
  );
};

export default RacesPanel;
