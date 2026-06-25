import React, { useCallback, useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { useGameState } from '../../hooks/useGameState';
import { apiCall } from '../../utils/api.mjs';
import { fmt } from "../../utils/fmt";
import LoreModal from './LoreModal.jsx';
import { repairMojibake } from '../../utils/repairMojibake.js';
import { toast as showToast } from '../../utils/toast.js';
import { switchTab } from '../../utils/switchTab.js';
import EmptyState from './EmptyState.jsx';


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
        <div className="col-span-full">
          <EmptyState
            icon="👑"
            title="No heroes yet"
            description="Build a Castle to unlock hero recruitment and lead your kingdom with a champion."
            actionLabel="Open Build"
            onAction={() => switchTab('build')}
          />
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
          className="card m-0 flex gap-3 items-start border border-[var(--border2)] bg-gradient-to-br from-[var(--bg2)] to-[var(--bg3)]"
        >
          <img
            src={heroPortrait(h.class)}
            width="56"
            height="56"
            className="rounded-[8px] object-cover flex-shrink-0"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
            alt={cls}
          />
          <div className="flex-1 min-w-0">
            <div className="text-[16px] font-bold text-[var(--gold)] mb-0.5">{repairMojibake(h.name || '')}</div>
            <div className="text-[12px] mb-2">
              <span className="text-[var(--red)] font-semibold">{cls}</span>
              <span className="text-[var(--text3)]"> | Level {h.level}</span>
            </div>
            <div className="flex flex-col mb-2">
              {unlockedAbilities.length ? unlockedAbilities.map((a, i) => {
                const label = typeof a === 'object' && a !== null ? a.name : a;
                const desc = typeof a === 'object' && a !== null ? a.description : '';
                const isLatest = i === unlockedAbilities.length - 1;
                return (
                  <div key={`${h.id || h.name}-${label}`} className="text-[11px] mb-1 leading-[1.3]">
                    <strong className={isLatest ? 'text-[var(--accent1)]' : 'text-[var(--gold)]'}>✨ {label}:</strong>
                    <span className="text-[var(--text2)]"> {desc}</span>
                  </div>
                );
              }) : <span className="text-[10px] text-[var(--text3)]">No abilities yet</span>}
            </div>
            {isMaxLevel ? (
              <div className="text-[10px] text-[var(--text3)] mb-0.75">Max Level Reached</div>
            ) : levelReady ? (
              <div className="text-[10px] text-[var(--green)] mb-0.75 font-semibold">⬆ Ready to level up!</div>
            ) : (
              <div className="text-[10px] text-[var(--text3)] mb-0.75">
                XP: {fmt(xpIntoLevel)} / {fmt(xpNeeded)} to Lv{(h.level || 1) + 1} ({xpPct}%)
              </div>
            )}
            <div className="h-1 bg-[var(--bg3)] rounded-[2px] overflow-hidden">
              <div
                className="h-full rounded-[2px]"
                style={{
                  width: `${isMaxLevel ? 100 : xpPct}%`,
                  background: isMaxLevel ? 'var(--gold)' : levelReady ? 'var(--green)' : 'var(--gold)',
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
        <div className="text-center px-5 py-5 text-[13px] text-[var(--text3)]">
          No more heroes available to recruit.
        </div>
      );
    }

    return recruitableClasses.map(([id, c]) => (
      <div
        key={id}
        className="hero-class-opt flex flex-col gap-2.5 cursor-pointer p-3 bg-[var(--bg3)] rounded-[var(--radius)] border transition"
        onClick={() => selectHeroClass(id)}
        style={{
          borderColor: selectedHeroClass === id ? 'var(--accent1)' : 'var(--border)',
        }}
      >
        <div className="flex w-full items-center justify-between">
          <div className="flex gap-2.5 items-center">
            <img
              src={heroPortrait(id)}
              width="40"
              height="40"
              className="rounded-[6px] object-cover block flex-shrink-0"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
              alt={c.name}
            />
            <div>
              <div className="text-[14px] font-bold text-[var(--gold)]">{c.name}</div>
              <div className="text-[11px] text-[var(--text3)]">
                Cost: {fmt(c.recruitCost)} GC | {fmt(c.recruitMana)} Mana
              </div>
            </div>
          </div>
          <input
            type="radio"
            name="hero-class"
            value={id}
            checked={selectedHeroClass === id}
            onChange={() => selectHeroClass(id)}
            className="m-0"
          />
        </div>

        <div className="text-[12px] text-[var(--text2)] mt-1">{c.description}</div>

        <div className="text-[11px] text-[var(--text)] mt-2">
          <div className="font-bold mb-0.5 text-[var(--text3)] text-[10px] uppercase tracking-[0.5px]">
            Abilities
          </div>
          {(c.abilities || []).map((a, idx) => {
            const unlockLvl = idx === 0 ? 1 : idx === 1 ? 5 : 10;
            return (
              <div key={`${id}-${a.name}`} className="mb-0.5">
                ✨ <strong className="text-[var(--text)]">{a.name}:</strong> <span className="text-[var(--text2)]">{a.description}</span>
                {unlockLvl === 1 ? null : <span className="text-[var(--text3)] text-[9px]"> (Unlocks at Lvl {unlockLvl})</span>}
              </div>
            );
          })}
        </div>
        <button
          className="base-btn text-[11px] px-2.5 py-0.75 mt-1.5 self-start"
          onClick={(e) => { e.stopPropagation(); setHeroLoreKey(id); }}
        >
          📖 View Lore
        </button>
      </div>
    ));
  }, [fmt, recruitableClasses, selectedHeroClass]);

  return (
    <div id="heroes" className="panel">
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
              <div className="mb-1.5 flex items-center justify-between text-[11px]"><span className="text-[var(--text2)]">Leveling</span><span className="text-[var(--accent1)] cursor-pointer underline" onClick={openHeroXpModal}>View XP Table</span></div>
            </div>

            <div className="mb-4">
              <label className="mb-1 block text-[11px] font-bold text-[var(--text)]">Select Class</label>
              <div className="flex flex-col gap-2">{heroClassOptions}</div>
            </div>

            <button className="base-btn variant-accent w-full px-2.5 py-2.5 font-bold bg-[var(--accent1)]" id="btn-recruit-hero" onClick={recruitHeroAction}>
              Recruit Hero
            </button>
          </div>

          <div className="card rounded-2xl border border-[var(--border)] bg-[var(--bg2)] p-5">
            <div className="card-title mb-2">Hero Slots</div>
            <div className="mt-2 flex items-center justify-between"><span className="text-[13px] text-[var(--text2)]">Occupied</span><span id="hero-slots-used" className="font-bold text-[var(--text)]">{heroes.length}</span></div>
            <div className="mt-1 flex items-center justify-between"><span className="text-[13px] text-[var(--text2)]">Total available</span><span id="hero-slots-total" className="font-bold text-[var(--gold)]">{maxHeroes}</span></div>
            <div className="mt-2.5 h-1.5 overflow-hidden rounded-[3px] bg-[var(--bg3)]"><div id="hero-slots-bar" className="h-full bg-[var(--accent1)]" style={{ width: `${maxHeroes > 0 ? Math.min(100, (heroes.length / maxHeroes) * 100) : 0}%`, transition: 'width 0.3s' }} /></div>
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
              <div className="mb-5 text-center">
                <div className="hero-lore-portrait-frame">
                  <img
                    src={heroPortrait(heroLoreKey)}
                    className="hero-lore-portrait"
                    onError={(e) => { e.currentTarget.parentElement.style.display = 'none'; }}
                    alt={cls.name || ''}
                  />
                </div>
                <div className="text-[20px] font-bold text-[var(--text)]">{cls.name || ''}</div>
                <div className="text-[12px] text-[var(--text3)] uppercase tracking-[1px]">Legendary Hero Class</div>
              </div>
              {abilities.length > 0 && (
                <div className="mb-5">
                  <div className="text-[11px] font-bold text-[var(--gold)] mb-2.5 uppercase tracking-[1px]">Signature Abilities</div>
                  <div className="flex flex-col gap-2.5">
                    {abilities.map((a, i) => (
                      <div key={i} className="bg-white/[0.02] border border-[var(--border)] rounded-[8px] p-2.5">
                        <div className="text-[13px] font-semibold text-[var(--text)] mb-0.5">{a.name || ''}</div>
                        <div className="text-[12px] text-[var(--text3)]">{a.description || ''}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="bg-[var(--bg4)] rounded-[8px] p-2.5 text-center">
                  <div className="text-[10px] text-[var(--text3)] uppercase">Recruit Cost</div>
                  <div className="text-[14px] font-bold text-[var(--gold)]">{fmt(cls.recruitCost)} GC</div>
                </div>
                <div className="bg-[var(--bg4)] rounded-[8px] p-2.5 text-center">
                  <div className="text-[10px] text-[var(--text3)] uppercase">Mana Cost</div>
                  <div className="text-[14px] font-bold text-[var(--blue)]">{fmt(cls.recruitMana)} ✨</div>
                </div>
              </div>
            </>
          );
        })()}
      </LoreModal>

    </div>
  );
};

export default HeroesPanel;
