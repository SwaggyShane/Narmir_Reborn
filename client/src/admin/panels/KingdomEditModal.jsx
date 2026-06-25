import React, { useState, useEffect, useCallback } from 'react';
import {
  FragmentsWidget, AttunementWidget, TroopLevelsWidget, InjuredCountsWidget,
  EffectsWidget, MercenariesWidget, KvNumbersWidget, ItemsWidget, FortifiedWidget,
} from '../lib/KingdomWidgets.jsx';

const JSON_FIELDS = new Set([
  'world_fragments', 'fragment_bonuses', 'hybrid_blueprints', 'fortified_buildings',
  'active_effects', 'troop_levels', 'injured_troops', 'research_allocation',
  'build_queue', 'build_progress', 'build_allocation', 'scrolls',
  'alliance_buffs', 'items', 'mercenaries',
]);

const EDIT_SECTIONS = [
  {
    label: 'Attributes',
    fields: [
      { key: 'name',            label: 'Name',            type: 'text' },
      { key: 'race',            label: 'Race',            type: 'text' },
      { key: 'region',          label: 'Region',          type: 'text' },
      { key: 'gender',          label: 'Gender',          type: 'text' },
      { key: 'description',     label: 'Description',     type: 'text' },
      { key: 'school_of_magic', label: 'School of Magic', type: 'text' },
      { key: 'milestone_title', label: 'Milestone Title', type: 'text' },
      { key: 'prestige_level',  label: 'Prestige' },
    ],
  },
  {
    label: 'Resources',
    fields: [
      { key: 'gold',         label: 'Gold' },
      { key: 'mana',         label: 'Mana' },
      { key: 'land',         label: 'Land' },
      { key: 'population',   label: 'Population' },
      { key: 'food',         label: 'Food' },
      { key: 'happiness',    label: 'Happiness' },
      { key: 'tax',          label: 'Tax rate' },
      { key: 'turn',         label: 'Turn #' },
      { key: 'turns_stored', label: 'Turns stored' },
      { key: 'xp',           label: 'XP' },
      { key: 'level',        label: 'Level' },
    ],
  },
  {
    label: 'Units',
    fields: [
      { key: 'fighters',          label: 'Fighters' },
      { key: 'rangers',           label: 'Rangers' },
      { key: 'clerics',           label: 'Clerics' },
      { key: 'mages',             label: 'Mages' },
      { key: 'thieves',           label: 'Thieves' },
      { key: 'ninjas',            label: 'Ninjas' },
      { key: 'thralls',           label: 'Thralls' },
      { key: 'ladders',           label: 'Ladders' },
      { key: 'researchers',       label: 'Researchers' },
      { key: 'engineers',         label: 'Engineers' },
      { key: 'scribes',           label: 'Scribes' },
      { key: 'war_machines',      label: 'War Machines' },
      { key: 'ballistae',         label: 'Ballistae' },
      { key: 'weapons_stockpile', label: 'Weapons Stockpile' },
      { key: 'armor_stockpile',   label: 'Armor Stockpile' },
    ],
  },
  {
    label: 'Buildings',
    fields: [
      { key: 'bld_farms',         label: 'Farms' },
      { key: 'bld_granaries',     label: 'Granaries' },
      { key: 'bld_barracks',      label: 'Barracks' },
      { key: 'bld_outposts',      label: 'Outposts' },
      { key: 'bld_guard_towers',  label: 'Guard Towers' },
      { key: 'bld_walls',         label: 'Walls' },
      { key: 'bld_schools',       label: 'Schools' },
      { key: 'bld_armories',      label: 'Armories' },
      { key: 'bld_vaults',        label: 'Vaults' },
      { key: 'bld_smithies',      label: 'Smithies' },
      { key: 'bld_markets',       label: 'Markets' },
      { key: 'bld_mage_towers',   label: 'Mage Towers' },
      { key: 'bld_training',      label: 'Training Fields' },
      { key: 'bld_taverns',       label: 'Taverns' },
      { key: 'bld_shrines',       label: 'Shrines' },
      { key: 'bld_castles',       label: 'Castles' },
      { key: 'bld_libraries',     label: 'Libraries' },
      { key: 'bld_housing',       label: 'Housing' },
      { key: 'bld_mausoleums',    label: 'Mausoleums' },
      { key: 'bld_woodyard',      label: 'Woodyards' },
      { key: 'bld_lumber_camp',   label: 'Lumber Camps' },
      { key: 'bld_sawmill',       label: 'Sawmills' },
      { key: 'bld_gravel_pit',    label: 'Gravel Pits' },
      { key: 'bld_blockfield',    label: 'Blockfields' },
      { key: 'bld_stone_quarry',  label: 'Stone Quarries' },
      { key: 'bld_open_pit',      label: 'Open Pits' },
      { key: 'bld_strip_mine',    label: 'Strip Mines' },
      { key: 'bld_deep_mine',     label: 'Deep Mines' },
      { key: 'wood',              label: 'Wood' },
      { key: 'stone',             label: 'Stone' },
      { key: 'iron',              label: 'Iron' },
      { key: 'coal',              label: 'Coal' },
      { key: 'steel',             label: 'Steel' },
      { key: 'maps',              label: 'Maps' },
      { key: 'blueprints_stored', label: 'Blueprints' },
      { key: 'scaffolding_stored',label: 'Scaffolding' },
      { key: 'hammers_stored',    label: 'Hammers' },
    ],
  },
  {
    label: 'Research',
    fields: [
      { key: 'res_economy',       label: 'Economy' },
      { key: 'res_weapons',       label: 'Weapons' },
      { key: 'res_armor',         label: 'Armor' },
      { key: 'res_military',      label: 'Military' },
      { key: 'res_attack_magic',  label: 'Attack Magic' },
      { key: 'res_defense_magic', label: 'Defense Magic' },
      { key: 'res_entertainment', label: 'Entertainment' },
      { key: 'res_construction',  label: 'Construction' },
      { key: 'res_war_machines',  label: 'War Machines' },
      { key: 'res_spellbook',     label: 'Spellbook' },
    ],
  },
  {
    label: 'Misc',
    fields: [
      { key: 'wall_hp',                 label: 'Wall HP' },
      { key: 'wall_defense_type',       label: 'Wall Defense Type', type: 'text' },
      { key: 'racial_bonuses_unlocked', label: 'Racial Bonuses Unlocked' },
      { key: 'divine_sanctuary_used',   label: 'Divine Sanctuary Used' },
    ],
  },
  {
    label: 'Fragments',
    fields: [
      { key: 'world_fragments',     label: 'World Fragments',     widgetType: 'fragments' },
      { key: 'fragment_bonuses',    label: 'Attunements',         widgetType: 'attunements' },
      { key: 'hybrid_blueprints',   label: 'Hybrid Blueprints',   widgetType: 'kv-numbers' },
      { key: 'fortified_buildings', label: 'Fortified Buildings', widgetType: 'fortified' },
    ],
  },
  {
    label: 'Troops',
    fields: [
      { key: 'troop_levels',   label: 'Troop Levels',   widgetType: 'troop-levels' },
      { key: 'injured_troops', label: 'Injured Troops', widgetType: 'injured' },
      { key: 'mercenaries',    label: 'Mercenaries',    widgetType: 'mercenaries' },
    ],
  },
  {
    label: 'Effects',
    fields: [
      { key: 'active_effects', label: 'Active Effects', widgetType: 'effects' },
      { key: 'scrolls',        label: 'Scrolls',        widgetType: 'kv-numbers' },
      { key: 'items',          label: 'Items',          widgetType: 'items' },
    ],
  },
  {
    label: 'Construction',
    fields: [
      { key: 'research_allocation', label: 'Research Allocation', widgetType: 'kv-numbers' },
      { key: 'build_queue',         label: 'Build Queue',         widgetType: 'kv-numbers' },
      { key: 'build_progress',      label: 'Build Progress',      widgetType: 'kv-numbers' },
      { key: 'build_allocation',    label: 'Build Allocation',    widgetType: 'kv-numbers' },
      { key: 'alliance_buffs',      label: 'Alliance Buffs',      widgetType: 'kv-numbers' },
    ],
  },
];

function WidgetForType({ widgetType, value, onChange }) {
  switch (widgetType) {
    case 'fragments':    return <FragmentsWidget    value={value} onChange={onChange} />;
    case 'attunements':  return <AttunementWidget   value={value} onChange={onChange} />;
    case 'troop-levels': return <TroopLevelsWidget  value={value} onChange={onChange} />;
    case 'injured':      return <InjuredCountsWidget value={value} onChange={onChange} />;
    case 'effects':      return <EffectsWidget      value={value} onChange={onChange} />;
    case 'mercenaries':  return <MercenariesWidget  value={value} onChange={onChange} />;
    case 'kv-numbers':   return <KvNumbersWidget    value={value} onChange={onChange} />;
    case 'items':        return <ItemsWidget        value={value} onChange={onChange} />;
    case 'fortified':    return <FortifiedWidget    value={value} onChange={onChange} />;
    default:
      return (
        <textarea rows={3} value={value}
          onChange={e => onChange(e.target.value)}
          style={TEXTAREA} spellCheck={false} />
      );
  }
}

export default function KingdomEditModal({ kingdomRow, adminFetch, onClose, onSaved }) {
  const [detail, setDetail]   = useState(null);
  const [loadErr, setLoadErr] = useState('');
  const [form, setForm]       = useState({});
  const [saving, setSaving]   = useState(false);
  const [saveErr, setSaveErr] = useState('');
  const [activeSection, setActiveSection] = useState(0);

  const loadDetail = useCallback(async () => {
    setDetail(null);
    setLoadErr('');
    try {
      const data = await adminFetch(`/api/admin/kingdom-detail/${kingdomRow.id}`);
      if (data?.error) { setLoadErr(data.error); return; }
      if (!data?.id)   { setLoadErr('Kingdom not found'); return; }
      setDetail(data);
      const init = {};
      EDIT_SECTIONS.forEach(sec => {
        sec.fields.forEach(({ key }) => {
          const raw = data[key];
          if (JSON_FIELDS.has(key)) {
            try {
              const parsed = typeof raw === 'string' ? JSON.parse(raw || 'null') : raw;
              init[key] = JSON.stringify(parsed, null, 2);
            } catch {
              init[key] = raw ?? '';
            }
          } else {
            init[key] = raw ?? '';
          }
        });
      });
      setForm(init);
    } catch (err) {
      setLoadErr(err.message || 'Failed to load kingdom');
    }
  }, [adminFetch, kingdomRow.id]);

  useEffect(() => { loadDetail(); }, [loadDetail]);

  async function handleSave() {
    setSaveErr('');
    setSaving(true);
    for (const key of JSON_FIELDS) {
      const val = form[key];
      if (val === '' || val == null) continue;
      try { JSON.parse(val); } catch {
        setSaveErr(`Invalid JSON in "${key}"`);
        setSaving(false);
        return;
      }
    }
    const fields = {};
    EDIT_SECTIONS.forEach(sec => {
      sec.fields.forEach(({ key, type }) => {
        const raw = detail[key];
        let formVal = form[key];
        if (formVal === undefined) return;

        if (JSON_FIELDS.has(key)) {
          const normalized = (formVal + '').trim();
          let origStr;
          try {
            const parsed = typeof raw === 'string' ? JSON.parse(raw || 'null') : raw;
            origStr = JSON.stringify(parsed);
          } catch {
            origStr = String(raw ?? '');
          }
          let newStr;
          try { newStr = JSON.stringify(JSON.parse(normalized)); } catch { newStr = normalized; }
          if (newStr !== origStr) fields[key] = normalized;
        } else if (type === 'text') {
          if (String(formVal) !== String(raw ?? '')) fields[key] = formVal;
        } else {
          if (formVal === '') {
            if (raw !== null && raw !== undefined) fields[key] = '';
          } else {
            const num = Number(formVal);
            if (num !== (raw ?? null)) fields[key] = num;
          }
        }
      });
    });

    if (Object.keys(fields).length === 0) {
      setSaveErr('No changes to save.');
      setSaving(false);
      return;
    }

    try {
      const data = await adminFetch('/api/admin/set-kingdom', {
        method: 'POST',
        body: { kingdomId: detail.id, fields },
      });
      if (data?.error) { setSaveErr(data.error); return; }
      onSaved(`Saved ${Object.keys(fields).length} field(s) for ${detail.name}`);
      onClose();
    } catch (err) {
      setSaveErr(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  const section = EDIT_SECTIONS[activeSection];
  const hasWidgets = section.fields.some(f => f.widgetType);

  return (
    <div style={OVERLAY} onClick={onClose}>
      <div style={MODAL} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={HEADER}>
          <div>
            <div style={{ fontFamily: 'Cinzel, serif', color: 'var(--gold)', fontSize: 16, fontWeight: 700 }}>
              Edit Kingdom
            </div>
            {detail && (
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                {detail.name} | {detail.username} | {(detail.race || '').replace(/_/g, ' ')} | {(detail.land || 0).toLocaleString()} land
              </div>
            )}
          </div>
          <button onClick={onClose} style={CLOSE_BTN}>X</button>
        </div>

        {loadErr && (
          <div style={{ padding: '20px 24px', color: 'var(--red)', fontSize: 13 }}>Error: {loadErr}</div>
        )}

        {!detail && !loadErr && (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Loading...</div>
        )}

        {detail && (
          <>
            {/* Section tabs */}
            <div style={SECTION_TABS}>
              {EDIT_SECTIONS.map((sec, i) => (
                <button key={sec.label} onClick={() => setActiveSection(i)} style={{
                  ...SEC_TAB,
                  borderBottom: i === activeSection ? '2px solid var(--gold)' : '2px solid transparent',
                  color: i === activeSection ? 'var(--gold)' : 'var(--text3)',
                }}>
                  {sec.label}
                </button>
              ))}
            </div>

            {/* Fields area */}
            <div style={FIELDS_AREA}>
              {hasWidgets ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  {section.fields.map(({ key, label, widgetType }) => (
                    <div key={key}>
                      <label style={LABEL}>{label}</label>
                      <WidgetForType
                        widgetType={widgetType}
                        value={form[key] ?? ''}
                        onChange={val => setForm(f => ({ ...f, [key]: val }))}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div style={GRID}>
                  {section.fields.map(({ key, label, type }) => (
                    <div key={key}>
                      <label style={LABEL}>{label}</label>
                      <input
                        type={type === 'text' ? 'text' : 'number'}
                        value={form[key] ?? ''}
                        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                        style={INPUT}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={FOOTER}>
              {saveErr && <span style={{ color: 'var(--red)', fontSize: 13 }}>{saveErr}</span>}
              <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
                <button onClick={onClose} style={BTN_CANCEL}>Cancel</button>
                <button onClick={handleSave} disabled={saving} style={BTN_SAVE}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const OVERLAY = {
  position: 'fixed', inset: 0, zIndex: 10000,
  background: 'rgba(0,0,0,0.75)',
  display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
  padding: '40px 16px', overflowY: 'auto',
};

const MODAL = {
  background: 'var(--bg2)', border: '1px solid var(--border2)',
  borderRadius: 10, width: '100%', maxWidth: 760,
  boxShadow: '0 12px 48px rgba(0,0,0,0.7)',
  display: 'flex', flexDirection: 'column',
};

const HEADER = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
  padding: '18px 24px 12px', borderBottom: '1px solid var(--border)',
};

const CLOSE_BTN = {
  background: 'none', border: 'none', color: 'var(--text3)',
  fontSize: 18, cursor: 'pointer', padding: '0 4px', lineHeight: 1,
};

const SECTION_TABS = {
  display: 'flex', overflowX: 'auto', gap: 0,
  borderBottom: '1px solid var(--border2)',
  scrollbarWidth: 'none',
};

const SEC_TAB = {
  flexShrink: 0, padding: '8px 12px',
  background: 'none', border: 'none',
  fontSize: 12, fontFamily: 'Inter, sans-serif',
  cursor: 'pointer', whiteSpace: 'nowrap',
  transition: 'color 0.1s',
};

const FIELDS_AREA = {
  padding: '20px 24px', overflowY: 'auto', maxHeight: '55vh',
};

const GRID = {
  display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px 16px',
};

const LABEL = {
  display: 'block', fontSize: 11, color: 'var(--text3)',
  textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4,
};

const INPUT = {
  width: '100%', padding: '6px 8px', background: 'var(--bg4)',
  border: '1px solid var(--border2)', borderRadius: 4,
  color: 'var(--text)', fontSize: 13, fontFamily: 'Inter, sans-serif',
  outline: 'none', boxSizing: 'border-box',
};

const TEXTAREA = {
  width: '100%', padding: '6px 8px', background: 'var(--bg4)',
  border: '1px solid var(--border2)', borderRadius: 4,
  color: 'var(--text)', fontSize: 12, fontFamily: 'monospace',
  outline: 'none', boxSizing: 'border-box', resize: 'vertical',
};

const FOOTER = {
  display: 'flex', alignItems: 'center', gap: 12,
  padding: '14px 24px', borderTop: '1px solid var(--border)',
  flexWrap: 'wrap',
};

const BTN_BASE = { padding: '7px 16px', borderRadius: 4, fontSize: 13, fontFamily: 'Inter, sans-serif', cursor: 'pointer', border: '1px solid' };
const BTN_CANCEL = { ...BTN_BASE, background: 'var(--bg4)', borderColor: 'var(--border2)', color: 'var(--text2)' };
const BTN_SAVE   = { ...BTN_BASE, background: 'var(--gold)', borderColor: 'var(--gold)', color: '#09090b', fontWeight: 600 };
