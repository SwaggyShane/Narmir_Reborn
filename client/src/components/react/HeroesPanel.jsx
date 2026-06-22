import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useGameState } from '../../hooks/useGameState';
import { apiCall } from '../../utils/api.js';
import { fmt } from "../../utils/fmt";
import LoreModal from './LoreModal.jsx';
import { repairMojibake } from '../../utils/repairMojibake.js';
import { toast as showToast } from '../../utils/toast.js';
import { registerShowHeroXpModal } from '../../utils/showHeroXpModal.js';

const HERO_PORTRAITS = {
  // Dwarf
  siegebreaker: '/hero/siegebreaker.webp',
  forge_lord: '/hero/forge_lord.webp',
  stonelord: '/hero/stonelord.webp',
  // High Elf
  archmage: '/hero/archmage.webp',
  lunar_sentinel: '/hero/lunar_sentinel.webp',
  mage_king: '/hero/mage_king.webp',
  // Orc
  warlord: '/hero/warlord.webp',
  high_chieftain: '/hero/high_chieftain.webp',
  warshaman: '/hero/warshaman.webp',
  // Dark Elf
  assassin: '/hero/assassin.webp',
  void_weaver: '/hero/void_weaver.webp',
  shadowmaster: '/hero/shadowmaster.webp',
  // Human
  paladin: '/hero/paladin.webp',
  grand_chancellor: '/hero/grand_chancellor.webp',
  high_consul: '/hero/grand_chancellor.webp',
  // Dire Wolf
  alpha: '/hero/warlord.webp',
  storm_howler: '/hero/warshaman.webp',
  blood_shaman: '/hero/warshaman.webp',
  // Vampire
  night_lord: '/hero/void_weaver.webp',
  sanguine_oracle: '/hero/shadowmaster.webp',
  blood_matriarch: '/hero/assassin.webp',
  _default: '/hero/siegebreaker.webp',
};

const HERO_XP_LEVELS = Array.from({ length: 19 }, (_, idx) => idx + 2);

function heroPortrait(cls) {
  return HERO_PORTRAITS[cls] || HERO_PORTRAITS._default || '';
}

function heroXpForLevelJS(level) {
  return Math.floor(1000 * (Math.pow(1.5, level - 1) - 1));
}

const HeroesPanel = () => {
  const { state, applyUpdates } = useGameState();
  const [heroes, setHeroes] = useState([]);
  const [heroClasses, setHeroClasses] = useState({});
  const [allHeroClasses, setAllHeroClasses] = useState({});
  const [selectedHeroClass, setSelectedHeroClass] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showXpModal, setShowXpModal] = useState(false);
  const [heroLoreKey, setHeroLoreKey] = useState(null);
  const [refreshTick, setRefreshTick] = useState(0);

  const loadHeroes = useCallback(async () => {
    setLoading(true);
    try {
      const [heroesRes, kingdomRes, classesRes, allClassesRes] = await Promise.all([
        apiCall('/api/hero/list'),
        apiCall('/api/kingdom/me'),
        apiCall('/api/hero/classes'),
        apiCall('/api/hero/all-classes'),
      ]);

      if (heroesRes?.error) throw new Error(heroesRes.error);
      if (kingdomRes?.error) throw new Error(kingdomRes.error);
      if (classesRes?.error) throw new Error(classesRes.error);
      if (allClassesRes?.error) throw new Error(allClassesRes.error);

      setHeroes(Array.isArray(heroesRes) ? heroesRes : []);
      setHeroClasses(classesRes || {});
      setAllHeroClasses(allClassesRes || {});
      applyUpdates(kingdomRes || {}, { reason: 'heroes/load' });
    } catch (err) {
      console.error('[heroes] load failed:', err);
      showToast(`Failed to load heroes: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [applyUpdates]);

  useEffect(() => {
    void loadHeroes();
  }, [loadHeroes, refreshTick]);

  const recruitableClasses = useMemo(() => Object.entries(heroClasses || {}), [heroClasses]);

  const maxHeroes = useMemo(() => {
    const castles = Number(state?.bld_castles || 0);
    if (castles >= 50) return 3;
    if (castles >= 10) return 2;
    if (castles >= 1) return 1;
    return 0;
  }, [state?.bld_castles]);

  const handleRefresh = () => setRefreshTick((n) => n + 1);

  const openHeroXpModal = () => setShowXpModal(true);

  useEffect(() => registerShowHeroXpModal(openHeroXpModal), [openHeroXpModal]);

  const recruitHeroAction = async () => {
    if (!selectedHeroClass) return showToast('Select a hero class first.', 'error');

    const className = heroClasses?.[selectedHeroClass]?.name || 'Hero';
    const name = window.prompt(`Enter a name for your new ${className}:`);
    if (!name) return;

    try {
      const res = await apiCall('/api/hero/recruit', {
        method: 'POST',
        body: { name, heroClass: selectedHeroClass },
      });

      if (res?.error) {
        showToast(res.error, 'error');
        return;
      }

      const kingdomRes = await apiCall('/api/kingdom/me');
      if (!kingdomRes?.error) applyUpdates(kingdomRes || {}, { reason: 'heroes/recruit' });
      setSelectedHeroClass(null);
      setRefreshTick((n) => n + 1);
      showToast(`✨ ${name} has joined your cause!`, 'success');
    } catch (err) {
      console.error('[heroes] recruit failed:', err);
      showToast('Failed to recruit hero', 'error');
    }
  };

  const selectHeroClass = (id) => {
    setSelectedHeroClass(id);
  };

  const ownedClassSet = useMemo(() => new Set(heroes.map((h) => h.class)), [heroes]);

  const heroCards = useMemo(() => {
    if (!heroes.length) {
      return (
        <div style={{ color: 'var(--text3)', fontSize: '13px', padding: '20px', textAlign: 'center', gridColumn: '1/-1' }}>
          No heroes recruited yet. Build a Castle to recruit your first hero!
        </div>
      );
    }

    return heroes.map((h) => {
      const cls = allHeroClasses?.[h.class] ? allHeroClasses[h.class].name : h.class;
      const abilityList = allHeroClasses?.[h.class]?.abilities || [];
      const unlockedAbilities = abilityList.filter((_, idx) => idx < 3 && Number(h.level || 1) >= [1, 5, 10][idx]);
      const xpThis = heroXpForLevelJS(h.level || 1);
      const xpNext = heroXpForLevelJS((h.level || 1) + 1);
      const xpIntoLevel = Math.max(0, Number(h.xp || 0) - xpThis);
      const xpNeeded = xpNext - xpThis;
      const xpPct = xpNeeded > 0 ? Math.min(100, Math.floor((xpIntoLevel / xpNeeded) * 100)) : 100;
      const levelReady = xpIntoLevel >= xpNeeded && Number(h.level || 1) < 25;
      const isMaxLevel = Number(h.level || 1) >= 25;

      return (
        <div
          key={h.id || `${h.name}-${h.class}`}
          className="card"
          style={{
            margin: 0,
            border: '1px solid var(--border2)',
            background: 'linear-gradient(135deg, var(--bg2), var(--bg3))',
            display: 'flex',
            gap: '12px',
            alignItems: 'flex-start',
          }}
        >
          <img
            src={heroPortrait(h.class)}
            width="56"
            height="56"
            style={{ borderRadius: '8px', objectFit: 'cover', flexShrink: 0 }}
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
            alt={cls}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--gold)', marginBottom: '2px' }}>{repairMojibake(h.name || '')}</div>
            <div style={{ fontSize: '12px', marginBottom: '8px' }}>
              <span style={{ color: 'var(--red)', fontWeight: 600 }}>{cls}</span>
              <span style={{ color: 'var(--text3)' }}> · Level {h.level}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '8px' }}>
              {unlockedAbilities.length ? unlockedAbilities.map((a, i) => {
                const label = typeof a === 'object' && a !== null ? a.name : a;
                const desc = typeof a === 'object' && a !== null ? a.description : '';
                const isLatest = i === unlockedAbilities.length - 1;
                return (
                  <div key={`${h.id || h.name}-${label}`} style={{ fontSize: '11px', marginBottom: '4px', lineHeight: 1.3 }}>
                    <strong style={{ color: isLatest ? 'var(--accent1)' : 'var(--gold)' }}>✨ {label}:</strong>
                    <span style={{ color: 'var(--text2)' }}> {desc}</span>
                  </div>
                );
              }) : <span style={{ fontSize: '10px', color: 'var(--text3)' }}>No abilities yet</span>}
            </div>
            {isMaxLevel ? (
              <div style={{ fontSize: '10px', color: 'var(--text3)', marginBottom: '3px' }}>Max Level Reached</div>
            ) : levelReady ? (
              <div style={{ fontSize: '10px', color: 'var(--green)', marginBottom: '3px', fontWeight: 600 }}>⬆ Ready to level up!</div>
            ) : (
              <div style={{ fontSize: '10px', color: 'var(--text3)', marginBottom: '3px' }}>
                XP: {fmt(xpIntoLevel)} / {fmt(xpNeeded)} to Lv{(h.level || 1) + 1} ({xpPct}%)
              </div>
            )}
            <div style={{ height: '4px', background: 'var(--bg3)', borderRadius: '2px', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${isMaxLevel ? 100 : xpPct}%`,
                  background: isMaxLevel ? 'var(--gold)' : levelReady ? 'var(--green)' : 'var(--gold)',
                  borderRadius: '2px',
                }}
              />
            </div>
          </div>
        </div>
      );
    });
  }, [allHeroClasses, heroes, fmt]);

  const heroClassOptions = useMemo(() => {
    if (recruitableClasses.length === 0) {
      return (
        <div style={{ color: 'var(--text3)', fontSize: '13px', padding: '20px', textAlign: 'center' }}>
          No more heroes available to recruit.
        </div>
      );
    }

    return recruitableClasses.map(([id, c]) => (
      <div
        key={id}
        className="hero-class-opt"
        onClick={() => selectHeroClass(id)}
        style={{
          display: 'flex',
          gap: '10px',
          alignItems: 'flex-start',
          background: 'var(--bg3)',
          padding: '12px',
          borderRadius: 'var(--radius)',
          border: `1px solid ${selectedHeroClass === id ? 'var(--accent1)' : 'var(--border)'}`,
          cursor: 'pointer',
          flexDirection: 'column',
        }}
      >
        <div style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <img
              src={heroPortrait(id)}
              width="40"
              height="40"
              style={{ borderRadius: '6px', objectFit: 'cover', display: 'block', flexShrink: 0 }}
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
              alt={c.name}
            />
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--gold)' }}>{c.name}</div>
              <div style={{ fontSize: '11px', color: 'var(--text3)' }}>
                Cost: {fmt(c.recruitCost)} GC · {fmt(c.recruitMana)} Mana
              </div>
            </div>
          </div>
          <input
            type="radio"
            name="hero-class"
            value={id}
            checked={selectedHeroClass === id}
            onChange={() => selectHeroClass(id)}
            style={{ margin: 0 }}
          />
        </div>

        <div style={{ fontSize: '12px', color: 'var(--text2)', marginTop: '4px' }}>{c.description}</div>

        <div style={{ fontSize: '11px', color: 'var(--text)', marginTop: '8px' }}>
          <div style={{ fontWeight: 700, marginBottom: '2px', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.5px', fontSize: '10px' }}>
            Abilities
          </div>
          {(c.abilities || []).map((a, idx) => {
            const unlockLvl = idx === 0 ? 1 : idx === 1 ? 5 : 10;
            return (
              <div key={`${id}-${a.name}`} style={{ marginBottom: '2px' }}>
                ✨ <strong style={{ color: 'var(--text)' }}>{a.name}:</strong> <span style={{ color: 'var(--text2)' }}>{a.description}</span>
                {unlockLvl === 1 ? null : <span style={{ color: 'var(--text3)', fontSize: '9px' }}> (Unlocks at Lvl {unlockLvl})</span>}
              </div>
            );
          })}
        </div>
        <button
          className="base-btn"
          style={{ fontSize: '11px', padding: '3px 10px', marginTop: '6px', alignSelf: 'flex-start' }}
          onClick={(e) => { e.stopPropagation(); setHeroLoreKey(id); }}
        >
          📖 View Lore
        </button>
      </div>
    ));
  }, [fmt, recruitableClasses, selectedHeroClass]);

  return (
    <div id="heroes" className="panel panel-immersive min-h-0 w-full overflow-y-auto px-4 pb-5" style={{ display: 'none' }}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="card-title mb-0">Heroes</div>
        <button className="base-btn" onClick={handleRefresh} disabled={loading}>
          {loading ? 'Refreshing...' : '? Refresh'}
        </button>
      </div>

      <div className="grid min-h-0 gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <div>
          <div className="card mx-auto mt-0 w-full max-w-6xl rounded-2xl border border-[var(--border)] bg-[var(--bg2)] p-5">
            <div className="card-title mb-3">Your Heroes</div>
            <div className="grid gap-3 sm:grid-cols-[repeat(auto-fill,minmax(280px,1fr))]">
              {heroCards}
            </div>
          </div>
        </div>

        <div className="xl:sticky xl:top-0">
          <div className="card mx-auto mt-0 w-full max-w-3xl rounded-2xl border border-[var(--border)] bg-[var(--bg2)] p-5">
            <div className="card-title mb-3">Recruit Hero</div>
            <div className="mb-4 text-[12px] leading-6 text-[var(--text3)]">
              Heroes are powerful unique units that provide passive bonuses to your kingdom and lead your armies in battle. You can recruit your
              <strong>1st</strong> hero with 1 Castle, the <strong>2nd</strong> at 10 Castles, and the <strong>3rd</strong> at 50 Castles.
            </div>

            <div className="mb-4 rounded-2xl border border-[var(--border)] bg-[var(--bg3)] p-3">
              <div className="mb-2 text-[11px] font-bold uppercase text-[var(--text3)]">Hero Advancement</div>
              <div className="mb-1.5 flex items-center justify-between text-[11px]"><span className="text-[var(--text2)]">Combat Win</span><span className="text-[var(--gold)]">500 XP</span></div>
              <div className="mb-1.5 flex items-center justify-between text-[11px]"><span className="text-[var(--text2)]">Combat Loss</span><span className="text-[var(--gold)]">100 XP</span></div>
              <div className="mb-1.5 flex items-center justify-between text-[11px]"><span className="text-[var(--text2)]">Leveling</span><span style={{ color: 'var(--accent1)', cursor: 'pointer', textDecoration: 'underline' }} onClick={openHeroXpModal}>View XP Table</span></div>
            </div>

            <div className="mb-4">
              <label className="mb-1 block text-[11px] font-bold text-[var(--text)]">Select Class</label>
              <div className="flex flex-col gap-2">{heroClassOptions}</div>
            </div>

            <button className="base-btn variant-accent w-full" id="btn-recruit-hero" style={{ padding: '10px', fontWeight: 700, width: '100%', background: 'var(--accent1)' }} onClick={recruitHeroAction}>
              Recruit Hero
            </button>
          </div>

          <div className="card rounded-2xl border border-[var(--border)] bg-[var(--bg2)] p-5">
            <div className="card-title mb-2 text-[14px]">Hero Slots</div>
            <div className="mt-2 flex items-center justify-between"><span className="text-[13px] text-[var(--text2)]">Occupied</span><span id="hero-slots-used" className="font-bold text-[var(--text)]">{heroes.length}</span></div>
            <div className="mt-1 flex items-center justify-between"><span className="text-[13px] text-[var(--text2)]">Total available</span><span id="hero-slots-total" className="font-bold text-[var(--gold)]">{maxHeroes}</span></div>
            <div className="mt-2.5 h-1.5 overflow-hidden rounded-[3px] bg-[var(--bg3)]"><div id="hero-slots-bar" style={{ height: '100%', width: `${maxHeroes > 0 ? Math.min(100, (heroes.length / maxHeroes) * 100) : 0}%`, background: 'var(--accent1)', transition: 'width 0.3s' }} /></div>
          </div>
        </div>
      </div>
      <LoreModal
        isOpen={!!heroLoreKey}
        onClose={() => setHeroLoreKey(null)}
      title={heroLoreKey && allHeroClasses?.[heroLoreKey] ? `${allHeroClasses[heroLoreKey].name || ''} Class Lore` : 'Hero Lore'}
      >
        {heroLoreKey && allHeroClasses?.[heroLoreKey] && (() => {
          const cls = allHeroClasses[heroLoreKey];
          const abilities = Array.isArray(cls.abilities) ? cls.abilities : [];
          return (
            <>
              <div style={{ marginBottom: '20px', textAlign: 'center' }}>
                <img
                  src={heroPortrait(heroLoreKey)}
                  width="240"
                  height="240"
                  style={{ maxWidth: '100%', height: 'auto', objectFit: 'cover', display: 'block', margin: '0 auto 12px auto', borderRadius: '8px' }}
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  alt={cls.name || ''}
                />
                <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text)' }}>{cls.name || ''}</div>
                <div style={{ fontSize: '12px', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '1px' }}>Legendary Hero Class</div>
              </div>
              {abilities.length > 0 && (
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--gold)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>Signature Abilities</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {abilities.map((a, i) => (
                      <div key={i} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px' }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '2px' }}>{a.name || ''}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text3)' }}>{a.description || ''}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div style={{ background: 'var(--bg4)', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
                  <div style={{ fontSize: '10px', color: 'var(--text3)', textTransform: 'uppercase' }}>Recruit Cost</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--gold)' }}>{fmt(cls.recruitCost)} GC</div>
                </div>
                <div style={{ background: 'var(--bg4)', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
                  <div style={{ fontSize: '10px', color: 'var(--text3)', textTransform: 'uppercase' }}>Mana Cost</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--blue)' }}>{fmt(cls.recruitMana)} ✨</div>
                </div>
              </div>
            </>
          );
        })()}
      </LoreModal>

      {showXpModal && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setShowXpModal(false); }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
        >
          <div style={{ background: 'var(--bg2)', border: '2px solid var(--purple)', borderRadius: '6px', width: '100%', maxWidth: '700px', maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 32px rgba(0,0,0,0.6)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>👑 Hero XP Progression</span>
              <button
                onClick={() => setShowXpModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: '18px', cursor: 'pointer', lineHeight: 1, padding: '0 4px' }}
              >
                ✕
              </button>
            </div>
            <div style={{ maxHeight: '60vh', overflowY: 'auto', padding: '16px 18px' }}>
              <div style={{ marginBottom: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: '40px', marginBottom: '8px' }}>👑</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text)' }}>Hero XP Progression</div>
                <div style={{ fontSize: '12px', color: 'var(--text3)' }}>Max Level is 20</div>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                <thead>
                  <tr>
                    <th style={{ padding: '8px', borderBottom: '1px solid var(--border)', color: 'var(--text3)' }}>Level</th>
                    <th style={{ padding: '8px', borderBottom: '1px solid var(--border)', color: 'var(--text3)' }}>Total XP Req.</th>
                    <th style={{ padding: '8px', borderBottom: '1px solid var(--border)', color: 'var(--text3)' }}>XP for Level</th>
                  </tr>
                </thead>
                <tbody>
                  {HERO_XP_LEVELS.map((level) => {
                    const currentTotalXp = heroXpForLevelJS(level);
                    const previousTotalXp = heroXpForLevelJS(level - 1);
                    const xpNeeded = currentTotalXp - previousTotalXp;
                    return (
                      <tr key={level}>
                        <td style={{ padding: '8px', borderBottom: '1px solid var(--border)', color: 'var(--gold)', fontWeight: 700 }}>{level}</td>
                        <td style={{ padding: '8px', borderBottom: '1px solid var(--border)', color: 'var(--text2)' }}>
                          {fmt(currentTotalXp)} <span style={{ color: 'var(--text3)', fontSize: '10px' }}>XP</span>
                        </td>
                        <td style={{ padding: '8px', borderBottom: '1px solid var(--border)', color: 'var(--text)' }}>
                          {fmt(xpNeeded)} <span style={{ color: 'var(--text3)', fontSize: '10px' }}>XP</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HeroesPanel;
