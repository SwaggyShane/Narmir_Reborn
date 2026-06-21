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
    <>
      <div style={{ marginBottom: '20px', textAlign: 'center' }}>
        <img
          src={heroPortraitUrl(heroKey)}
          width="240"
          height="240"
          style={{ maxWidth: '100%', height: 'auto', objectFit: 'cover', display: 'block', margin: '0 auto 12px auto', borderRadius: '8px' }}
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
          alt={repair(hero.name || '')}
        />
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

function RaceLoreContent({ rKey, lore, regionName, regionBonus, portraitUrl, repair, onHeroClick }) {
  const strengths = Array.isArray(lore.strengths) ? lore.strengths : [];
  const weaknesses = Array.isArray(lore.weaknesses) ? lore.weaknesses : [];
  const heroes = Array.isArray(lore.heroes) ? lore.heroes : [];

  return (
    <>
      <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', marginBottom: '20px' }}>
        <div style={{ flexShrink: 0 }}>
          {portraitUrl ? (
            <div style={{ width: '140px', height: '140px', borderRadius: '16px', boxShadow: '0 6px 16px rgba(0,0,0,0.5)', overflow: 'hidden', background: '#15171e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img
                src={portraitUrl}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                alt={repair(lore.title || '')}
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            </div>
          ) : (
            <div style={{ width: '140px', height: '140px', borderRadius: '16px', background: 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '60px' }}>
              {repair(lore.icon || '⚔')}
            </div>
          )}
        </div>
        <div style={{ flex: 1, paddingTop: '4px' }}>
          <h2 style={{ color: lore.color || 'var(--gold)', margin: '0 0 6px', fontSize: '24px', letterSpacing: '-0.5px', fontFamily: "'Cinzel', serif", fontWeight: 700 }}>
            {repair(lore.title || 'Unknown')}
          </h2>
          {regionName && (
            <div style={{ fontSize: '13px', color: 'var(--text2)', marginBottom: '6px', fontWeight: 600 }}>
              {regionName} Region
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
    const found = Object.entries(classes || {}).find(([, c]) => c.name === heroName);
    if (found) setHeroLoreKey(found[0]);
  }, [cachedHeroClasses]);

  const raceEntries = useMemo(
    () => Object.entries(raceLore).filter(([, r]) => r.lore),
    [raceLore],
  );

  const selectedLore = selectedRace ? raceLore[selectedRace] : null;
  const heroLoreData = heroLoreKey && cachedHeroClasses ? cachedHeroClasses[heroLoreKey] : null;

  return (
    <div id="races" className="panel" style={{ display: 'none' }}>
      <div className="card" style={{ marginTop: 0 }}>
        <div className="card-title">🦄 Race Information</div>
        <div style={{ fontSize: '13px', color: 'var(--text2)', lineHeight: 1.6, marginBottom: '16px' }}>
          Learn about the various races of Narmir, their history, and their unique passives and abilities.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {raceEntries.map(([key, r]) => {
            const portraitUrl = getRacePortrait(key);
            const cardStyle = r.color
              ? { background: `${r.color}15`, borderLeft: `3px solid ${r.color}`, padding: '16px', borderRadius: 'var(--radius)' }
              : { background: 'var(--bg3)', padding: '16px', borderRadius: 'var(--radius)' };
            const strengths = Array.isArray(r.strengths) ? r.strengths : [];
            const weaknesses = Array.isArray(r.weaknesses) ? r.weaknesses : [];
            const heroes = Array.isArray(r.heroes) ? r.heroes : [];
            return (
              <div key={key} style={cardStyle}>
                {portraitUrl && (
                  <img
                    src={portraitUrl}
                    alt={repair(r.title || key)}
                    style={{ width: '100%', maxHeight: '180px', aspectRatio: '3 / 4', objectFit: 'contain', marginBottom: '12px', display: 'block' }}
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                )}
                <div
                  onClick={() => setSelectedRace(key)}
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
        isOpen={!!selectedRace}
        onClose={() => setSelectedRace(null)}
        title={selectedLore ? `${repair(selectedLore.icon || '')} ${repair(selectedLore.title || '')}` : ''}
      >
        {selectedLore && (
          <RaceLoreContent
            rKey={selectedRace}
            lore={selectedLore}
            regionName={(regionMeta[selectedRace] || {}).name || ''}
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
