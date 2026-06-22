import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { apiCall } from '../../utils/api.js';
import { repairMojibake } from '../../utils/repairMojibake.js';
import { fmt } from '../../utils/fmt.js';
import LoreModal from './LoreModal.jsx';
import { registerOpenRaceLore } from '../../utils/openRaceLore.js';

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
    <>
      <div className="mb-5 text-center">
        <img
          src={heroPortraitUrl(heroKey)}
          width="240"
          height="240"
          className="mx-auto mb-3 block h-auto max-w-full rounded-lg object-cover"
          onError={(e) => { e.currentTarget.classList.add('hidden'); }}
          alt={repair(hero.name || '')}
        />
        <div className="text-xl font-bold text-[var(--text)]">
          {repair(hero.name || '')}
        </div>
        <div className="text-xs uppercase tracking-[1px] text-[var(--text3)]">
          Legendary Hero Class
        </div>
      </div>

      {abilities.length > 0 && (
        <div className="mb-5">
          <div className="mb-2.5 text-[11px] font-bold uppercase tracking-[1px] text-[var(--gold)]">
            Signature Abilities
          </div>
          <div className="flex flex-col gap-2.5">
            {abilities.map((a, i) => (
              <div key={i} className="rounded-lg border border-[var(--border)] bg-white/[0.02] p-2.5">
                <div className="mb-0.5 text-[13px] font-semibold text-[var(--text)]">
                  {repair(a.name || '')}
                </div>
                <div className="text-xs text-[var(--text3)]">
                  {repair(a.description || '')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <div className="rounded-lg bg-[var(--bg4)] p-2.5 text-center">
          <div className="text-[10px] uppercase text-[var(--text3)]">Recruit Cost</div>
          <div className="text-sm font-bold text-[var(--gold)]">{fmt(hero.recruitCost)} GC</div>
        </div>
        <div className="rounded-lg bg-[var(--bg4)] p-2.5 text-center">
          <div className="text-[10px] uppercase text-[var(--text3)]">Mana Cost</div>
          <div className="text-sm font-bold text-[var(--blue)]">{fmt(hero.recruitMana)} ?</div>
        </div>
      </div>
    </>
  );
}

function RaceLoreContent({ rKey, lore, regionName, regionBonus, portraitUrl, repair, onHeroClick }) {
  const [hasPortraitError, setHasPortraitError] = useState(false);
  const strengths = Array.isArray(lore.strengths) ? lore.strengths : [];
  const weaknesses = Array.isArray(lore.weaknesses) ? lore.weaknesses : [];
  const heroes = Array.isArray(lore.heroes) ? lore.heroes : [];
  const cleanedRegionName = repair(regionName || '');

  return (
    <>
      <div className="mb-5 flex flex-col gap-5 sm:flex-row sm:items-start">
        <div className="shrink-0">
          {portraitUrl && !hasPortraitError ? (
            <div className="flex h-[140px] w-[140px] items-center justify-center overflow-hidden rounded-2xl bg-[#15171e] shadow-[0_6px_16px_rgba(0,0,0,0.5)]">
              <img
                src={portraitUrl}
                className="block h-full w-full object-cover"
                alt={repair(lore.title || '')}
                onError={() => setHasPortraitError(true)}
              />
            </div>
          ) : (
            <div className="flex h-[140px] w-[140px] items-center justify-center rounded-2xl bg-[var(--bg3)] text-[60px]">
              {repair(lore.icon || '⚔')}
            </div>
          )}
        </div>
        <div className="flex-1 pt-1">
          <h2 className="mb-1.5 text-2xl font-bold tracking-[-0.5px] [font-family:'Cinzel',serif]" style={{ color: lore.color || 'var(--gold)' }}>
            {repair(lore.title || 'Unknown')}
          </h2>
          {cleanedRegionName && (
            <div className="mb-1.5 text-[13px] font-semibold text-[var(--text2)]">
              {cleanedRegionName} Region
            </div>
          )}
          {regionBonus && (
            <div className="text-xs leading-snug text-[var(--text3)]">
              {repair(regionBonus)}
            </div>
          )}
        </div>
      </div>

      <p className="mb-4 text-[13px] italic leading-7 text-[var(--text2)]">
        {repair(lore.lore || '')}
      </p>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-[var(--radius)] border border-[rgba(76,175,130,.2)] bg-[rgba(76,175,130,.08)] p-3">
          <div className="mb-2 text-[11px] font-bold uppercase tracking-[.5px] text-[var(--green)]">Strengths</div>
          {strengths.map((s, i) => (
            <div key={i} className="py-0.5 text-xs text-[var(--text2)]">? {repair(s)}</div>
          ))}
        </div>
        <div className="rounded-[var(--radius)] border border-[rgba(224,92,92,.2)] bg-[rgba(224,92,92,.08)] p-3">
          <div className="mb-2 text-[11px] font-bold uppercase tracking-[.5px] text-[var(--red)]">Weaknesses</div>
          {weaknesses.map((w, i) => (
            <div key={i} className="py-0.5 text-xs text-[var(--text2)]">? {repair(w)}</div>
          ))}
        </div>
      </div>

      {lore.special && (
        <div className="mb-3 rounded-[var(--radius)] border border-[rgba(232,184,75,.25)] bg-[rgba(232,184,75,.08)] p-3">
          <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[.5px] text-[var(--gold)]">? Racial mastery ? unlocks at unit level 25</div>
          <div className="text-[13px] text-[var(--text)]">{repair(lore.special)}</div>
        </div>
      )}

      {heroes.length > 0 && (
        <div className="mb-3 rounded-[var(--radius)] border border-[rgba(143,184,74,.25)] bg-[rgba(143,184,74,.08)] p-3">
          <div className="mb-2 text-[11px] font-bold uppercase tracking-[.5px] text-[var(--green)]">?? Notable Race Heroes</div>
          <div className="flex flex-wrap gap-1.5">
            {heroes.map((h) => (
              <div
                key={h}
                onClick={() => onHeroClick(h)}
                className="cursor-pointer rounded-full border border-[var(--border2)] bg-[var(--bg4)] px-2 py-0.5 text-[11px] text-[var(--text2)]"
              >
                {repair(h)}
              </div>
            ))}
          </div>
        </div>
      )}

      {lore.playstyle && (
        <div className="rounded-[var(--radius)] bg-[var(--bg3)] p-3">
          <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[.5px] text-[var(--text3)]">Recommended playstyle</div>
          <div className="text-[13px] text-[var(--text2)]">{repair(lore.playstyle)}</div>
        </div>
      )}
    </>
  );
}

function RaceCardPortrait({ portraitUrl, icon, alt }) {
  const [failed, setFailed] = useState(false);
  if (!portraitUrl || failed) {
    return (
      <div className="mb-3 flex aspect-[3/4] max-h-[180px] w-full items-center justify-center rounded-[var(--radius)] bg-[var(--bg3)] text-[56px]">
        {repairMojibake(String(icon ?? '⚔'))}
      </div>
    );
  }

  return (
    <img
      src={portraitUrl}
      alt={alt}
      className="mb-3 block aspect-[3/4] max-h-[180px] w-full object-contain"
      onError={() => setFailed(true)}
    />
  );
}

const RacesPanel = () => {
  const [selectedRace, setSelectedRace] = useState(null);
  const [heroLoreKey, setHeroLoreKey] = useState(null);
  const [cachedHeroClasses, setCachedHeroClasses] = useState(null);

  const raceLore = useMemo(() => window.RACE_LORE || {}, []);
  const regionMeta = useMemo(() => window.REGION_META || {}, []);
  const regionBonuses = useMemo(() => window.REGION_BONUSES || {}, []);

  const repair = useCallback((v) => repairMojibake(String(v ?? '')), []);

  const getRacePortrait = useCallback((key) =>
    typeof window.getRacePortrait === 'function' ? window.getRacePortrait(key, 'male') : '',
  []);

  const openHeroLore = useCallback(async (heroName) => {
    let classes = cachedHeroClasses;
    if (!classes) {
      try {
        const result = await apiCall('/api/hero/all-classes');
        if (result && !result.error) {
          classes = result;
          setCachedHeroClasses(result);
        }
      } catch (e) {
        console.error('[RacesPanel] Failed to load hero classes:', e);
        return;
      }
    }
    const found = Object.entries(classes || {}).find(([, c]) => c?.name === heroName);
    if (found) setHeroLoreKey(found[0]);
  }, [cachedHeroClasses]);

  useEffect(() => registerOpenRaceLore((race) => setSelectedRace(race || null)), []);

  const raceEntries = useMemo(
    () => Object.entries(raceLore).filter(([, r]) => r.lore),
    [raceLore],
  );

  const selectedLore = selectedRace ? raceLore[selectedRace] : null;
  const heroLoreData = heroLoreKey && cachedHeroClasses ? cachedHeroClasses[heroLoreKey] : null;

  return (
    <div id="races" className="panel hidden">
      <div className="card mt-0">
        <div className="card-title">🦄 Race Information</div>
        <div className="mb-4 text-[13px] leading-6 text-[var(--text2)]">
          Learn about the various races of Narmir, their history, and their unique passives and abilities.
        </div>
        <div className="flex flex-col gap-5">
          {raceEntries.map(([key, r]) => {
            const portraitUrl = getRacePortrait(key);
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
                  onClick={() => setSelectedRace(key)}
                  className="mb-2 flex cursor-pointer items-center gap-1.5 text-base font-bold text-[var(--gold)]"
                  title="Click for detailed lore & details"
                >
                  {repair(r.icon || '⚔')} {repair(r.title || r.label || key)}
                  <span className="font-normal font-sans text-[11px] opacity-55 underline">(View details)</span>
                </div>
                <div className="mb-3 text-[13px] leading-6 text-[var(--text2)]">
                  {repair(r.lore || r.bonus || '')}
                </div>
                {r.special && (
                  <div className="mb-3 text-xs text-[var(--gold)]">
                    🌸 <strong>Special:</strong> {repair(r.special)}
                  </div>
                )}
                <div className="flex flex-wrap gap-5 text-xs">
                  {strengths.length > 0 && (
                    <div className="min-w-[100px] flex-1">
                      <strong className="mb-1 block text-[var(--green)]">Strengths</strong>
                      <ul className="m-0 pl-4 text-[var(--text3)]">
                        {strengths.map((s, i) => (
                          <li key={i} className="py-0.5">{repair(s)}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {weaknesses.length > 0 && (
                    <div className="min-w-[100px] flex-1">
                      <strong className="mb-1 block text-[var(--red)]">Weaknesses</strong>
                      <ul className="m-0 pl-4 text-[var(--text3)]">
                        {weaknesses.map((w, i) => (
                          <li key={i} className="py-0.5">{repair(w)}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {heroes.length > 0 && (
                    <div className="min-w-[100px] flex-1">
                      <strong className="mb-1 block text-[var(--gold)]">Notable Heroes</strong>
                      <div className="flex flex-wrap gap-1">
                        {heroes.map((h) => (
                          <span
                            key={h}
                            onClick={() => openHeroLore(h)}
                            className="cursor-pointer rounded border border-[rgba(255,255,255,0.1)] bg-white/[0.05] px-1.5 py-0.5 text-[10px] text-[var(--text2)]"
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

      <LoreModal
        isOpen={!!selectedRace}
        onClose={() => setSelectedRace(null)}
        title={selectedLore ? `${repair(selectedLore.icon || '')} ${repair(selectedLore.title || '')}` : ''}
      >
        {selectedLore && (
          <RaceLoreContent
            rKey={selectedRace}
            lore={selectedLore}
            regionName={repair((regionMeta[selectedRace] || {}).name || '')}
            regionBonus={regionBonuses[selectedRace] || ''}
            portraitUrl={getRacePortrait(selectedRace)}
            repair={repair}
            onHeroClick={(name) => {
              setSelectedRace(null);
              openHeroLore(name);
            }}
          />
        )}
      </LoreModal>

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
