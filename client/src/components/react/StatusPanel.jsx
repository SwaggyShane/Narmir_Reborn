import React, { useMemo } from 'react';
import { apiCall } from '../../utils/api';
import { useGameState } from '../../hooks/useGameState';
import { repairMojibake } from '../../utils/repairMojibake';
import { applyGameMutation } from '../../utils/gameMutations.js';

const RACE_CARD_DATA = {
  human: {
    label: 'Humans of The Heartlands',
    bonus: 'Flexible all-rounder with fast population growth and balanced progress.',
  },
  orc: {
    label: 'Orcs of The Bloodplains',
    bonus: 'Blitzkrieg race with heavy military pressure and passive troop growth.',
  },
  dwarf: {
    label: 'Dwarves of The Iron Holds',
    bonus: 'Economy and fortress play with elite builders and war machines.',
  },
  dark_elf: {
    label: 'Dark Elves of The Underspire',
    bonus: 'Shadow warfare focused on covert ops, assassination, and precision.',
  },
  vampire: {
    label: 'Vampires of The Sanguine Spires',
    bonus: 'Night conquest with thralls, reanimation, and brutal temporal swings.',
  },
  dire_wolf: {
    label: 'Dire Wolves of The Ashfang Wilds',
    bonus: 'Raid-and-run domination through raw combat and fast expeditions.',
  },
  high_elf: {
    label: 'High Elves of The Silverwood',
    bonus: 'Magic dominance built on research, scrolls, and mana economy.',
  },
  wood_elf: {
    label: 'Wood Elves of The Wildwood',
    bonus: 'Exploration dominance with unmatched land discovery and speed.',
  },
  ogre: {
    label: 'Ogres of The Shattered Peaks',
    bonus: 'Brute force conquest with overwhelming fighter pressure.',
  },
};

const RACE_PORTRAITS = {
  high_elf: '/race/high_elf_male.webp',
  dwarf: '/race/dwarf_male.webp',
  human: '/race/human_male.webp',
  orc: '/race/orc_male.webp',
  dark_elf: '/race/dark_elf_male.webp',
  dire_wolf: '/race/dire_wolf_male.webp',
  vampire: '/race/vampire_male.webp',
  wood_elf: '/race/wood_elf_male.webp',
  ogre: '/race/ogre_male.webp',
};

const STATUS_CARD_CLASS = 'card rounded-2xl border border-white/5 bg-zinc-950/95 shadow-[0_16px_32px_rgba(0,0,0,0.28)]';

const toRaceKey = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');

const toRaceLabel = (value) =>
  String(value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (m) => m.toUpperCase());

const StatusPanel = () => {
  const { state } = useGameState();

  const cleanText = (value) => {
    if (value === null || value === undefined) return '';
    const text = String(value);
    return repairMojibake(text);
  };

  const updateTaxDisplay = (value) => {
    const disp = document.getElementById('strip-tax-disp');
    if (disp) disp.textContent = String(value ?? '');
  };

  const lockTax = async (elementId) => {
    const slider = document.getElementById(elementId);
    if (!slider) return;
    const tax = Number(slider.value);
    if (Number.isNaN(tax)) return;

    try {
      const result = await apiCall('/api/kingdom/options', {
        method: 'POST',
        body: { tax },
      });
      if (result.error) {
        if (typeof window !== 'undefined' && typeof toast === 'function') toast(result.error, 'error');
        return;
      }
      if (applyGameMutation) {
        applyGameMutation(result, { reason: 'tax-update' });
      } else if (result.updates) {
        applyGameMutation(result.updates, { reason: 'tax-update' });
      }
      if (typeof window !== 'undefined' && typeof toast === 'function') toast('Tax rate locked', 'success');
    } catch (err) {
      console.error('[tax] lock failed:', err);
      if (typeof window !== 'undefined' && typeof toast === 'function') toast('Failed to save tax rate', 'error');
    }
  };

  const raceKey = useMemo(() => toRaceKey(state?.race), [state?.race]);

  const raceInfo = useMemo(() => {
    const mapped = RACE_CARD_DATA[raceKey];
    if (mapped) {
      return {
        label: cleanText(mapped.label),
        bonus: cleanText(mapped.bonus),
      };
    }

    if (state?.race) {
      return {
        label: cleanText(toRaceLabel(state.race)),
        bonus: '',
      };
    }

    return {
      label: 'Unknown',
      bonus: '',
    };
  }, [raceKey, state?.race]);

  const customPortrait = state?.customPortrait;
  const gender = state?.gender || 'male';
  const raceForPortrait = raceKey || toRaceKey(state?.race);
  const portraitUrl = customPortrait || (RACE_PORTRAITS[raceForPortrait] ? `/race/${raceForPortrait}_${gender}.webp` : '');
  const isVampire = raceForPortrait === 'vampire';
  const troopLevels = state?.troop_levels || {};

  return (
    <div id="status" className="panel active w-full min-w-0">
      <div className="mb-5">
        <div
          id="race-tag-display"
          className="race-tag-block"
          onClick={() => { if (typeof window.openRaceLore === 'function') window.openRaceLore(); }}
          style={{
            cursor: 'pointer',
            padding: '16px',
            background: 'var(--bg3)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            gap: '16px',
            transition: 'border-color 0.2s ease, background-color 0.2s ease',
            width: '100%',
            boxSizing: 'border-box',
          }}
          title="Click for race lore"
        >
          {portraitUrl ? (
            <div
              style={{
                flexShrink: 0,
                width: '80px',
                height: '80px',
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
                overflow: 'hidden',
                background: '#15171e',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <img
                src={portraitUrl}
                alt={cleanText(raceInfo.label)}
                referrerPolicy="no-referrer"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: 'block',
                  transition: 'transform 0.3s ease',
                }}
                className="race-portrait"
              />
            </div>
          ) : null}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
            <div
              style={{
                fontFamily: '"Cinzel", serif',
                fontSize: '18px',
                fontWeight: '700',
                color: 'var(--gold)',
                letterSpacing: '1px',
                textTransform: 'uppercase',
              }}
            >
              {cleanText(raceInfo.label)}
            </div>
            <div
              style={{
                fontSize: '12.5px',
                color: 'var(--text2)',
                lineHeight: '1.6',
                fontFamily: 'sans-serif',
                letterSpacing: '0.3px',
                fontWeight: 'normal',
              }}
            >
              {cleanText(raceInfo.bonus)}
            </div>
          </div>
        </div>
      </div>

      <div className={STATUS_CARD_CLASS + ' p-4'} id="status-tax-card" style={{ marginTop: 0, marginBottom: '16px', display: 'none' }}>
        <div className="card-title">Tax rate</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '10px' }}>
          <input
            type="range"
            className="input"
            id="strip-tax-slider"
            min="1"
            max="100"
            step="1"
            defaultValue="42"
            onChange={(e) => updateTaxDisplay(e.target.value)}
            style={{ flex: 1 }}
          />
          <span
            style={{ fontSize: '22px', fontWeight: 700, color: 'var(--gold)', minWidth: '48px' }}
            id="strip-tax-disp"
          />
        </div>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
          <button
            className="base-btn variant-gold"
            onClick={() => lockTax('strip-tax-slider')}
            style={{ flex: 1, background: 'var(--gold)', color: '#000' }}
          >
            🔒 Lock
          </button>
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text3)', lineHeight: 1.7 }}>
          Taxing your citizens directly affects their happiness. Tax them high and they will probably leave.
          Tax them low and they will rejoice.{' '}
          <strong style={{ color: 'var(--gold)' }}>Enter a rate then press Lock to save.</strong>
        </div>
      </div>

      <div className="status-grid grid gap-5 md:grid-cols-2 xl:grid-cols-3" id="status-grid">
        <div className={STATUS_CARD_CLASS + ' p-4'}>
          <div className="card-title">
            Military &amp; support
            <span
              id="citadel-badge"
              style={{ display: 'none', marginLeft: '8px', fontSize: '11px', fontWeight: 600, color: 'var(--gold)' }}
            >
              🏰 Citadel
            </span>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '100px 1fr 52px 52px',
              gap: '4px',
              padding: '4px 0 6px',
              borderBottom: '1px solid var(--border2)',
            }}
          >
            <span style={{ fontSize: '10px', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Unit
            </span>
            <span
              style={{ fontSize: '10px', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'right' }}
            >
              Count
            </span>
            <span
              style={{ fontSize: '10px', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'center' }}
            >
              Lv
            </span>
            <span
              style={{ fontSize: '10px', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'center' }}
            >
              Role
            </span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '100px 1fr 52px 52px',
              gap: '4px',
              alignItems: 'center',
              padding: '5px 0',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <span style={{ fontSize: '13px', color: 'var(--text)' }} id="s-label-fighters">
              Fighters
            </span>
            <span style={{ fontSize: '13px', fontWeight: 600, textAlign: 'right', color: 'var(--text)' }} id="s-fighters">
              0
            </span>
            <span style={{ textAlign: 'center', fontSize: '11px', fontWeight: 600 }} id="s-lv-fighters">
              --
            </span>
            <span className="badge badge-red" style={{ textAlign: 'center', fontSize: '9px' }}>
              Combat
            </span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '100px 1fr 52px 52px',
              gap: '4px',
              alignItems: 'center',
              padding: '5px 0',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <span style={{ fontSize: '13px', color: 'var(--text)' }} id="s-label-rangers">
              Rangers
            </span>
            <span style={{ fontSize: '13px', fontWeight: 600, textAlign: 'right', color: 'var(--text)' }} id="s-rangers">
              0
            </span>
            <span style={{ textAlign: 'center', fontSize: '11px', fontWeight: 600 }} id="s-lv-rangers">
              --
            </span>
            <span className="badge badge-blue" style={{ textAlign: 'center', fontSize: '9px' }}>
              Ranged
            </span>
          </div>

          <div
            id="s-row-clerics"
            style={{
              display: isVampire ? 'none' : 'grid',
              gridTemplateColumns: '100px 1fr 52px 52px',
              gap: '4px',
              alignItems: 'center',
              padding: '5px 0',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <span style={{ fontSize: '13px', color: 'var(--text)' }} id="s-label-clerics">
              Clerics
            </span>
            <span style={{ fontSize: '13px', fontWeight: 600, textAlign: 'right', color: 'var(--text)' }} id="s-clerics">
              0
            </span>
            <span style={{ textAlign: 'center', fontSize: '11px', fontWeight: 600 }} id="s-lv-clerics">
              --
            </span>
            <span className="badge badge-green" style={{ textAlign: 'center', fontSize: '9px' }}>
              Heal
            </span>
          </div>

          <div
            id="s-row-thralls"
            style={{
              display: isVampire ? 'grid' : 'none',
              gridTemplateColumns: '100px 1fr 52px 52px',
              gap: '4px',
              alignItems: 'center',
              padding: '5px 0',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <span style={{ fontSize: '13px', color: 'var(--text)' }} id="s-label-thralls">
              Thralls
            </span>
            <span style={{ fontSize: '13px', fontWeight: 600, textAlign: 'right', color: 'var(--text)' }} id="s-thralls">
              0
            </span>
            <span style={{ textAlign: 'center', fontSize: '11px', fontWeight: 600 }} id="s-lv-thralls">
              --
            </span>
            <span className="badge badge-gray" style={{ textAlign: 'center', fontSize: '9px', background: '#444' }}>
              Defense
            </span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '100px 1fr 52px 52px',
              gap: '4px',
              alignItems: 'center',
              padding: '5px 0',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <span style={{ fontSize: '13px', color: 'var(--text)' }} id="s-label-mages">
              Mages
            </span>
            <span style={{ fontSize: '13px', fontWeight: 600, textAlign: 'right', color: 'var(--text)' }} id="s-mages">
              0
            </span>
            <span style={{ textAlign: 'center', fontSize: '11px', fontWeight: 600 }} id="s-lv-mages">
              --
            </span>
            <span className="badge badge-amber" style={{ textAlign: 'center', fontSize: '9px' }}>
              Magic
            </span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '100px 1fr 52px 52px',
              gap: '4px',
              alignItems: 'center',
              padding: '5px 0',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <span style={{ fontSize: '13px', color: 'var(--text)' }} id="s-label-thieves">
              Thieves
            </span>
            <span style={{ fontSize: '13px', fontWeight: 600, textAlign: 'right', color: 'var(--text)' }} id="s-thieves">
              0
            </span>
            <span style={{ textAlign: 'center', fontSize: '11px', fontWeight: 600 }} id="s-lv-thieves">
              --
            </span>
            <span className="badge badge-amber" style={{ textAlign: 'center', fontSize: '9px' }}>
              Covert
            </span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '100px 1fr 52px 52px',
              gap: '4px',
              alignItems: 'center',
              padding: '5px 0',
              borderBottom: '1px solid var(--border2)',
            }}
          >
            <span style={{ fontSize: '13px', color: 'var(--text)' }} id="s-label-ninjas">
              Ninjas
            </span>
            <span style={{ fontSize: '13px', fontWeight: 600, textAlign: 'right', color: 'var(--text)' }} id="s-ninjas">
              0
            </span>
            <span style={{ textAlign: 'center', fontSize: '11px', fontWeight: 600 }} id="s-lv-ninjas">
              --
            </span>
            <span className="badge badge-amber" style={{ textAlign: 'center', fontSize: '9px' }}>
              Covert
            </span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '100px 1fr 52px 52px',
              gap: '4px',
              alignItems: 'center',
              padding: '5px 0',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <span style={{ fontSize: '13px', color: 'var(--text)' }} id="s-label-engineers">
              Engineers
            </span>
            <span style={{ fontSize: '13px', fontWeight: 600, textAlign: 'right', color: 'var(--text)' }} id="s-engineers">
              0
            </span>
            <span style={{ textAlign: 'center', fontSize: '11px', color: 'var(--text3)' }} id="s-lv-engineers">
              Lv {Number(troopLevels.engineers?.level || 1)}
            </span>
            <span className="badge badge-blue" style={{ textAlign: 'center', fontSize: '9px' }}>
              Build
            </span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '100px 1fr 52px 52px',
              gap: '4px',
              alignItems: 'center',
              padding: '5px 0',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <span style={{ fontSize: '13px', color: 'var(--text)' }} id="s-label-scribes">
              Scribes
            </span>
            <span style={{ fontSize: '13px', fontWeight: 600, textAlign: 'right', color: 'var(--text)' }} id="s-scribes">
              0
            </span>
            <span style={{ textAlign: 'center', fontSize: '11px', color: 'var(--text3)' }} id="s-lv-scribes">
              Lv {Number(troopLevels.scribes?.level || 1)}
            </span>
            <span className="badge badge-blue" style={{ textAlign: 'center', fontSize: '9px' }}>
              Library
            </span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '100px 1fr 52px 52px',
              gap: '4px',
              alignItems: 'center',
              padding: '5px 0',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <span style={{ fontSize: '13px', color: 'var(--text)' }} id="s-label-researchers">
              Researchers
            </span>
            <span style={{ fontSize: '13px', fontWeight: 600, textAlign: 'right', color: 'var(--text)' }} id="s-researchers">
              0
            </span>
            <span style={{ textAlign: 'center', fontSize: '11px', color: 'var(--text3)' }} id="s-lv-researchers">
              Lv {Number(troopLevels.researchers?.level || 1)}
            </span>
            <span className="badge badge-blue" style={{ textAlign: 'center', fontSize: '9px' }}>
              Study
            </span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '100px 1fr 52px 52px',
              gap: '4px',
              alignItems: 'center',
              padding: '5px 0',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <span style={{ fontSize: '13px', color: 'var(--text)' }}>Warmachines</span>
            <span style={{ fontSize: '13px', fontWeight: 600, textAlign: 'right', color: 'var(--text)' }} id="s-war_machines">
              0
            </span>
            <span />
            <span className="badge badge-gold" style={{ textAlign: 'center', fontSize: '9px' }}>
              Siege
            </span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '100px 1fr 52px 52px',
              gap: '4px',
              alignItems: 'center',
              padding: '5px 0',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <span style={{ fontSize: '13px', color: 'var(--text)' }} id="s-label-ladders">
              Ladders
            </span>
            <span style={{ fontSize: '13px', fontWeight: 600, textAlign: 'right', color: 'var(--text)' }} id="s-ladders">
              0
            </span>
            <span />
            <span className="badge badge-gold" style={{ textAlign: 'center', fontSize: '9px' }}>
              Siege
            </span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '100px 1fr 52px 52px',
              gap: '4px',
              alignItems: 'center',
              padding: '5px 0',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <span style={{ fontSize: '13px', color: 'var(--text)' }}>Weapons</span>
            <span style={{ fontSize: '13px', fontWeight: 600, textAlign: 'right', color: 'var(--text)' }} id="s-weapons">
              0
            </span>
            <span />
            <span className="badge badge-gold" style={{ textAlign: 'center', fontSize: '9px' }}>
              Stock
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr 52px 52px', gap: '4px', alignItems: 'center', padding: '5px 0' }}>
            <span style={{ fontSize: '13px', color: 'var(--text)' }}>Armor</span>
            <span style={{ fontSize: '13px', fontWeight: 600, textAlign: 'right', color: 'var(--text)' }} id="s-armor">
              0
            </span>
            <span />
            <span className="badge badge-gold" style={{ textAlign: 'center', fontSize: '9px' }}>
              Stock
            </span>
          </div>
        </div>

        <div className={STATUS_CARD_CLASS + ' p-4'}>
          <div className="card-title">Research levels</div>
          <div className="trow">
            <span className="name">Economy</span>
            <div className="prog-wrap">
              <div className="prog-bar eco" id="pb-eco-st" style={{ width: '0%' }} />
            </div>
          </div>
          <div className="trow">
            <span className="name">Weapons</span>
            <div className="prog-wrap">
              <div className="prog-bar wep" id="pb-wep-st" style={{ width: '0%' }} />
            </div>
          </div>
          <div className="trow">
            <span className="name">Armor</span>
            <div className="prog-wrap">
              <div className="prog-bar arm" id="pb-arm-st" style={{ width: '0%' }} />
            </div>
          </div>
          <div className="trow">
            <span className="name">Military</span>
            <div className="prog-wrap">
              <div className="prog-bar mil" id="pb-mil-st" style={{ width: '0%' }} />
            </div>
          </div>
          <div className="trow">
            <span className="name">Spellbook</span>
            <div className="prog-wrap">
              <div className="prog-bar spell" id="pb-spell-st" style={{ width: '0%' }} />
            </div>
          </div>
          <div className="trow">
            <span className="name">Atk magic</span>
            <div className="prog-wrap">
              <div className="prog-bar" id="pb-atk-st" style={{ width: '0%', background: 'var(--red)' }} />
            </div>
          </div>
          <div className="trow">
            <span className="name">Defense magic</span>
            <div className="prog-wrap">
              <div className="prog-bar arm" id="pb-def-st" style={{ width: '0%' }} />
            </div>
          </div>
          <div className="trow">
            <span className="name">Mana</span>
            <div className="prog-wrap">
              <div className="prog-bar mana" id="pb-mana-s" style={{ width: '0%' }} />
            </div>
          </div>
          <div className="trow">
            <span className="name">Entertainment</span>
            <div className="prog-wrap">
              <div className="prog-bar" id="pb-ent-s" style={{ width: '0%', background: 'var(--green)' }} />
            </div>
          </div>
          <div className="trow" style={{ borderBottom: 'none' }}>
            <span className="name">Construction</span>
            <div className="prog-wrap">
              <div className="prog-bar" id="pb-con-st" style={{ width: '0%', background: 'var(--amber)' }} />
            </div>
          </div>
        </div>

        <div className={STATUS_CARD_CLASS + ' p-4'}>
          <div className="card-title">Key buildings</div>
          <div className="trow">
            <span className="name">Farm</span>
            <span className="count" id="kb-farms">0</span>
          </div>
          <div className="trow">
            <span className="name">Barracks</span>
            <span className="count" id="kb-barracks">0</span>
          </div>
          <div className="trow">
            <span className="name">Schools</span>
            <span className="count" id="kb-schools">0</span>
          </div>
          <div className="trow">
            <span className="name">Library</span>
            <span className="count" id="kb-libraries">0</span>
          </div>
          <div className="trow">
            <span className="name">Mage Towers</span>
            <span className="count" id="kb-mage_towers">0</span>
          </div>
          <div className="trow">
            <span className="name">Smithies</span>
            <span className="count" id="kb-smithies">0</span>
          </div>
          <div className="trow">
            <span className="name">Markets</span>
            <span className="count" id="kb-markets">0</span>
          </div>
          <div className="trow">
            <span className="name">Guard Towers</span>
            <span className="count" id="kb-guard_towers">0</span>
          </div>
          <div className="trow">
            <span className="name">Training Fields</span>
            <span className="count" id="kb-training">0</span>
          </div>
          <div className="trow" style={{ borderBottom: 'none' }}>
            <span className="name">Castles</span>
            <span className="count" id="kb-castles">0</span>
          </div>
        </div>
      </div>

      <div id="active-effects-bar" style={{ display: 'none', marginTop: '14px' }}>
        <div className={STATUS_CARD_CLASS + ' py-3 px-4'}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: '12px',
                color: 'var(--text3)',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginRight: '4px',
              }}
            >
              Active effects
            </span>
            <div id="active-effects-list" style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatusPanel;
