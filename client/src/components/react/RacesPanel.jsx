import React, { useState, useMemo, useCallback, useEffect } from 'react';
import clsx from 'clsx';
import { apiCall } from '../../utils/api.mjs';
import { repairMojibake } from '../../utils/repairMojibake.js';
import { fmt } from '../../utils/fmt.js';
import LoreModal from './LoreModal.jsx';
import { openRaceLore } from '../../utils/openRaceLore.js';
import { registerShowHeroLore } from '../../utils/showHeroLore.js';
import { getRacePortrait } from '../../utils/racePortraits.js';
import { RACE_LORE } from '../../utils/raceData.js';

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
      <div style={{ marginBottom: '20px', textAlign: 'center' }}>
        <div className="hero-lore-portrait-frame">
          <img
            src={heroPortraitUrl(heroKey)}
            className="hero-lore-portrait"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
            alt={repair(hero.name || '')}
          />
        </div>
        <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text)' }}>
          {repair(hero.name || '')}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '1px' }}>
          Legendary Hero Class
        </div>
      </div>

      {abilities.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--gold)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>
            Signature Abilities
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {abilities.map((a, i) => (
              <div key={i} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '2px' }}>
                  {repair(a.name || '')}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text3)' }}>
                  {repair(a.description || '')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <div style={{ background: 'var(--bg4)', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
          <div style={{ fontSize: '10px', color: 'var(--text3)', textTransform: 'uppercase' }}>Recruit Cost</div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--gold)' }}>{fmt(hero.recruitCost)} GC</div>
        </div>
        <div style={{ background: 'var(--bg4)', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
          <div style={{ fontSize: '10px', color: 'var(--text3)', textTransform: 'uppercase' }}>Mana Cost</div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--blue)' }}>{fmt(hero.recruitMana)} ✨</div>
        </div>
      </div>
    </>
  );
}

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
  const [heroLoreKey, setHeroLoreKey] = useState(null);
  const [cachedHeroClasses, setCachedHeroClasses] = useState(null);

  const raceLore = RACE_LORE;

  const repair = useCallback((v) => repairMojibake(String(v ?? '')), []);

  const getPortraitUrl = useCallback((key) =>
    getRacePortrait(key, 'male') || '',
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

  useEffect(() => registerShowHeroLore(openHeroLore), [openHeroLore]);

  const raceEntries = useMemo(
    () => Object.entries(raceLore).filter(([, r]) => r.lore),
    [raceLore],
  );

  const heroLoreData = heroLoreKey && cachedHeroClasses ? cachedHeroClasses[heroLoreKey] : null;

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
                            onClick={() => openHeroLore(h)}
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
