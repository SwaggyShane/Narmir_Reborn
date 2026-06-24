import React, { useMemo, useState } from 'react';
import clsx from 'clsx';
import { apiCall } from '../../utils/api';
import { useGameState } from '../../hooks/useGameState';
import { repairMojibake } from '../../utils/repairMojibake';
import { applyGameMutation } from '../../utils/gameMutations.js';
import { toast as showToast } from '../../utils/toast.js';
import { openRaceLore } from '../../utils/openRaceLore.js';

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

const STATUS_CARD_CLASS = 'card';

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
  const [taxDisplayValue, setTaxDisplayValue] = useState('');
  const [taxValue, setTaxValue] = useState('');

  const cleanText = (value) => {
    if (value === null || value === undefined) return '';
    const text = String(value);
    return repairMojibake(text);
  };

  const updateTaxDisplay = (value) => {
    const val = String(value ?? '');
    setTaxDisplayValue(val);
    setTaxValue(val);
  };

  const lockTax = async (taxValue) => {
    const tax = Number(taxValue);
    if (Number.isNaN(tax)) return;

    try {
      const result = await apiCall('/api/kingdom/options', {
        method: 'POST',
        body: { tax },
      });
      if (result.error) {
        showToast(result.error, 'error');
        return;
      }
      if (applyGameMutation) {
        applyGameMutation(result, { reason: 'tax-update' });
      } else if (result.updates) {
        applyGameMutation(result.updates, { reason: 'tax-update' });
      }
      showToast('Tax rate locked', 'success');
    } catch (err) {
      console.error('[tax] lock failed:', err);
      showToast('Failed to save tax rate', 'error');
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
    <div id="status" className="panel">

      {/* ── Race Banner ── */}
      <div className="mb-4">
        <div
          id="race-tag-display"
          className="race-tag-block cursor-pointer p-4 bg-void-900 border border-ember-900/50 rounded-xl flex flex-row items-center gap-4 transition-all w-full hover:border-ember-700/60 hover:bg-void-800"
          onClick={() => { openRaceLore(raceKey); }}
          title="Click for race lore"
        >
          {portraitUrl ? (
            <div className="flex-shrink-0 w-20 h-20 rounded-lg shadow-[0_4px_12px_rgba(0,0,0,0.5)] overflow-hidden bg-void-950 flex items-center justify-center">
              <img
                src={portraitUrl}
                alt={cleanText(raceInfo.label)}
                referrerPolicy="no-referrer"
                className="race-portrait w-full h-full object-cover block transition-transform"
              />
            </div>
          ) : null}
          <div className="flex flex-col gap-1.5 flex-1">
            <div className="font-cinzel text-[18px] font-bold text-gold uppercase tracking-[1px]">
              {cleanText(raceInfo.label)}
            </div>
            <button
              type="button"
              className="text-left text-[12.5px] text-text2 leading-relaxed font-normal tracking-[0.3px] underline decoration-ember-500/30 underline-offset-2 transition hover:text-text hover:decoration-ember-500/60"
              onClick={(e) => {
                e.stopPropagation();
                openRaceLore(raceKey);
              }}
            >
              {cleanText(raceInfo.bonus)}
            </button>
          </div>
          <div className="flex-shrink-0 text-ember-500/40 text-lg">›</div>
        </div>
      </div>

      <div className={clsx(STATUS_CARD_CLASS, 'hidden mb-4')} id="status-tax-card">
        <div className="card-title">Tax rate</div>
        <div className="flex items-center gap-3.5 mb-2.5">
          <input
            type="range"
            className="input flex-1"
            id="strip-tax-slider"
            min="1"
            max="100"
            step="1"
            defaultValue="42"
            onChange={(e) => updateTaxDisplay(e.target.value)}
          />
          <span
            id="strip-tax-disp"
            className="text-[22px] font-bold text-[var(--gold)] min-w-[48px]"
          >
            {taxDisplayValue}
          </span>
        </div>
        <div className="flex gap-2 mb-2.5">
          <button
            className="base-btn variant-gold flex-1 bg-[var(--gold)] text-black"
            onClick={() => lockTax(taxValue)}
          >
            🔒 Lock
          </button>
        </div>
        <div className="text-[12px] text-text3 leading-[1.7]">
          Taxing your citizens directly affects their happiness. Tax them high and they will probably leave.
          Tax them low and they will rejoice.{' '}
          <strong className="text-gold">Enter a rate then press Lock to save.</strong>
        </div>
      </div>

      <div className="status-grid w-full flex-1 grid [grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr))] gap-5 [grid-auto-rows:minmax(auto,1fr)] [align-content:space-around]" id="status-grid">
        <div className={STATUS_CARD_CLASS}>
          <div className="card-title">
            Military &amp; support
            <span
              id="citadel-badge"
              className="hidden ml-2 text-[11px] font-semibold text-gold"
            >
              🏰 Citadel
            </span>
          </div>
          <div className="grid [grid-template-columns:100px_1fr_52px_52px] gap-1 py-1 px-0 border-b border-strong">
            <span className="text-[10px] text-text3 uppercase tracking-[0.5px]">Unit</span>
            <span className="text-[10px] text-text3 uppercase tracking-[0.5px] text-right">Count</span>
            <span className="text-[10px] text-text3 uppercase tracking-[0.5px] text-center">Lv</span>
            <span className="text-[10px] text-text3 uppercase tracking-[0.5px] text-center">Role</span>
          </div>

          <div className="grid [grid-template-columns:100px_1fr_52px_52px] gap-1 items-center py-1 px-0 border-b border-white/5">
            <span className="text-[13px] text-text" id="s-label-fighters">Fighters</span>
            <span className="text-[13px] font-semibold text-right text-text" id="s-fighters">{(state?.fighters ?? 0).toLocaleString()}</span>
            <span className="text-center text-[11px] font-semibold" id="s-lv-fighters">Lv {troopLevels?.fighters?.level || 1}</span>
            <span className="badge badge-red text-center text-[9px]">Combat</span>
          </div>

          <div className="grid [grid-template-columns:100px_1fr_52px_52px] gap-1 items-center py-1 px-0 border-b border-white/5">
            <span className="text-[13px] text-text" id="s-label-rangers">Rangers</span>
            <span className="text-[13px] font-semibold text-right text-text" id="s-rangers">{(state?.rangers ?? 0).toLocaleString()}</span>
            <span className="text-center text-[11px] font-semibold" id="s-lv-rangers">Lv {troopLevels?.rangers?.level || 1}</span>
            <span className="badge badge-blue text-center text-[9px]">Ranged</span>
          </div>

          <div id="s-row-clerics" className={clsx('grid [grid-template-columns:100px_1fr_52px_52px] gap-1 items-center py-1 px-0 border-b border-white/5', isVampire && 'hidden')}>
            <span className="text-[13px] text-text" id="s-label-clerics">Clerics</span>
            <span className="text-[13px] font-semibold text-right text-text" id="s-clerics">{(state?.clerics ?? 0).toLocaleString()}</span>
            <span className="text-center text-[11px] font-semibold" id="s-lv-clerics">Lv {troopLevels?.clerics?.level || 1}</span>
            <span className="badge badge-green text-center text-[9px]">Heal</span>
          </div>

          <div id="s-row-thralls" className={clsx('grid [grid-template-columns:100px_1fr_52px_52px] gap-1 items-center py-1 px-0 border-b border-white/5', !isVampire && 'hidden')}>
            <span className="text-[13px] text-text" id="s-label-thralls">Thralls</span>
            <span className="text-[13px] font-semibold text-right text-text" id="s-thralls">{(state?.thralls ?? 0).toLocaleString()}</span>
            <span className="text-center text-[11px] font-semibold" id="s-lv-thralls">Lv {troopLevels?.thralls?.level || 1}</span>
            <span className="badge text-center text-[9px]" style={{ background: '#444' }}>Defense</span>
          </div>

          <div className="grid [grid-template-columns:100px_1fr_52px_52px] gap-1 items-center py-1 px-0 border-b border-white/5">
            <span className="text-[13px] text-text" id="s-label-mages">Mages</span>
            <span className="text-[13px] font-semibold text-right text-text" id="s-mages">{(state?.mages ?? 0).toLocaleString()}</span>
            <span className="text-center text-[11px] font-semibold" id="s-lv-mages">Lv {troopLevels?.mages?.level || 1}</span>
            <span className="badge badge-amber text-center text-[9px]">Magic</span>
          </div>

          <div className="grid [grid-template-columns:100px_1fr_52px_52px] gap-1 items-center py-1 px-0 border-b border-white/5">
            <span className="text-[13px] text-text" id="s-label-thieves">Thieves</span>
            <span className="text-[13px] font-semibold text-right text-text" id="s-thieves">{(state?.thieves ?? 0).toLocaleString()}</span>
            <span className="text-center text-[11px] font-semibold" id="s-lv-thieves">Lv {troopLevels?.thieves?.level || 1}</span>
            <span className="badge badge-amber text-center text-[9px]">Covert</span>
          </div>

          <div className="grid [grid-template-columns:100px_1fr_52px_52px] gap-1 items-center py-1 px-0 border-b border-strong">
            <span className="text-[13px] text-text" id="s-label-ninjas">Ninjas</span>
            <span className="text-[13px] font-semibold text-right text-text" id="s-ninjas">{(state?.ninjas ?? 0).toLocaleString()}</span>
            <span className="text-center text-[11px] font-semibold" id="s-lv-ninjas">Lv {troopLevels?.ninjas?.level || 1}</span>
            <span className="badge badge-amber text-center text-[9px]">Covert</span>
          </div>

          <div className="grid [grid-template-columns:100px_1fr_52px_52px] gap-1 items-center py-1 px-0 border-b border-white/5">
            <span className="text-[13px] text-text" id="s-label-engineers">Engineers</span>
            <span className="text-[13px] font-semibold text-right text-text" id="s-engineers">{(state?.engineers ?? 0).toLocaleString()}</span>
            <span className="text-center text-[11px] text-text3" id="s-lv-engineers">Lv {Number(troopLevels.engineers?.level || 1)}</span>
            <span className="badge badge-blue text-center text-[9px]">Build</span>
          </div>

          <div className="grid [grid-template-columns:100px_1fr_52px_52px] gap-1 items-center py-1 px-0 border-b border-white/5">
            <span className="text-[13px] text-text" id="s-label-scribes">Scribes</span>
            <span className="text-[13px] font-semibold text-right text-text" id="s-scribes">{(state?.scribes ?? 0).toLocaleString()}</span>
            <span className="text-center text-[11px] text-text3" id="s-lv-scribes">Lv {Number(troopLevels.scribes?.level || 1)}</span>
            <span className="badge badge-blue text-center text-[9px]">Library</span>
          </div>

          <div className="grid [grid-template-columns:100px_1fr_52px_52px] gap-1 items-center py-1 px-0 border-b border-white/5">
            <span className="text-[13px] text-text" id="s-label-researchers">Researchers</span>
            <span className="text-[13px] font-semibold text-right text-text" id="s-researchers">{(state?.researchers ?? 0).toLocaleString()}</span>
            <span className="text-center text-[11px] text-text3" id="s-lv-researchers">Lv {Number(troopLevels.researchers?.level || 1)}</span>
            <span className="badge badge-blue text-center text-[9px]">Study</span>
          </div>

          <div className="grid [grid-template-columns:100px_1fr_52px_52px] gap-1 items-center py-1 px-0 border-b border-white/5">
            <span className="text-[13px] text-text">Warmachines</span>
            <span className="text-[13px] font-semibold text-right text-text" id="s-war_machines">{(state?.war_machines ?? 0).toLocaleString()}</span>
            <span />
            <span className="badge badge-gold text-center text-[9px]">Siege</span>
          </div>

          <div className="grid [grid-template-columns:100px_1fr_52px_52px] gap-1 items-center py-1 px-0 border-b border-white/5">
            <span className="text-[13px] text-text" id="s-label-ladders">Ladders</span>
            <span className="text-[13px] font-semibold text-right text-text" id="s-ladders">{(state?.ladders ?? 0).toLocaleString()}</span>
            <span />
            <span className="badge badge-gold text-center text-[9px]">Siege</span>
          </div>

          <div className="grid [grid-template-columns:100px_1fr_52px_52px] gap-1 items-center py-1 px-0 border-b border-white/5">
            <span className="text-[13px] text-text">Weapons</span>
            <span className="text-[13px] font-semibold text-right text-text" id="s-weapons">{(state?.weapons_stockpile ?? 0).toLocaleString()}</span>
            <span />
            <span className="badge badge-gold text-center text-[9px]">Stock</span>
          </div>

          <div className="grid [grid-template-columns:100px_1fr_52px_52px] gap-1 items-center py-1 px-0">
            <span className="text-[13px] text-text">Armor</span>
            <span className="text-[13px] font-semibold text-right text-text" id="s-armor">{(state?.armor_stockpile ?? 0).toLocaleString()}</span>
            <span />
            <span className="badge badge-gold text-center text-[9px]">Stock</span>
          </div>
        </div>

        <div className={STATUS_CARD_CLASS}>
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
              <div className="prog-bar bg-red" id="pb-atk-st" style={{ width: '0%' }} />
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
              <div className="prog-bar bg-green" id="pb-ent-s" style={{ width: '0%' }} />
            </div>
          </div>
          <div className="trow border-b-0">
            <span className="name">Construction</span>
            <div className="prog-wrap">
              <div className="prog-bar bg-amber" id="pb-con-st" style={{ width: '0%' }} />
            </div>
          </div>
        </div>

        <div className={STATUS_CARD_CLASS}>
          <div className="card-title">Key buildings</div>
          <div className="trow">
            <span className="name">Farm</span>
            <span className="count" id="kb-farms">{state?.bld_farms ?? 0}</span>
          </div>
          <div className="trow">
            <span className="name">Barracks</span>
            <span className="count" id="kb-barracks">{state?.bld_barracks ?? 0}</span>
          </div>
          <div className="trow">
            <span className="name">Schools</span>
            <span className="count" id="kb-schools">{state?.bld_schools ?? 0}</span>
          </div>
          <div className="trow">
            <span className="name">Library</span>
            <span className="count" id="kb-libraries">{state?.bld_libraries ?? 0}</span>
          </div>
          <div className="trow">
            <span className="name">Mage Towers</span>
            <span className="count" id="kb-mage_towers">{state?.bld_mage_towers ?? 0}</span>
          </div>
          <div className="trow">
            <span className="name">Smithies</span>
            <span className="count" id="kb-smithies">{state?.bld_smithies ?? 0}</span>
          </div>
          <div className="trow">
            <span className="name">Markets</span>
            <span className="count" id="kb-markets">{state?.bld_markets ?? 0}</span>
          </div>
          <div className="trow">
            <span className="name">Guard Towers</span>
            <span className="count" id="kb-guard_towers">{state?.bld_guard_towers ?? 0}</span>
          </div>
          <div className="trow">
            <span className="name">Training Fields</span>
            <span className="count" id="kb-training">{state?.bld_training ?? 0}</span>
          </div>
          <div className="trow border-b-0">
            <span className="name">Castles</span>
            <span className="count" id="kb-castles">{state?.bld_castles ?? 0}</span>
          </div>
        </div>
      </div>

      <div id="active-effects-bar" className="hidden mt-3.5">
        <div className={clsx(STATUS_CARD_CLASS, 'p-3 pl-4')}>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[12px] text-text3 font-semibold uppercase tracking-[0.5px] mr-1">
              Active effects
            </span>
            <div id="active-effects-list" className="flex gap-1.5 flex-wrap" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatusPanel;
