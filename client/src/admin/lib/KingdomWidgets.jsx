import React, { useState } from 'react';

const ALL_FRAGMENTS = [
  'Volcanic Rock', 'Ancient Elven Wood', 'Dragon Scale', 'Abyssal Crystal',
  'Celestial Feather', 'Dwarven Star-Metal', 'Cursed Bloodstone',
  'Tears of the World Tree', 'Void Essence', 'Titan Bone',
];

const TROOP_TYPES = [
  { id: 'fighters',    label: 'Fighters' },
  { id: 'rangers',     label: 'Rangers' },
  { id: 'clerics',     label: 'Clerics' },
  { id: 'mages',       label: 'Mages' },
  { id: 'thieves',     label: 'Thieves' },
  { id: 'ninjas',      label: 'Ninjas' },
  { id: 'engineers',   label: 'Engineers' },
  { id: 'researchers', label: 'Researchers' },
  { id: 'scribes',     label: 'Scribes' },
  { id: 'war_machines',label: 'War Machines' },
  { id: 'thralls',     label: 'Thralls' },
];

const ALL_BUILDING_TYPES = [
  'farms', 'granaries', 'barracks', 'outposts', 'guard_towers', 'schools',
  'armories', 'vaults', 'smithies', 'markets', 'mage_towers', 'training',
  'taverns', 'castles', 'libraries', 'shrines', 'housing', 'walls', 'mausoleums',
];

const MERC_FIELDS = [
  { f: 'unit_type',       label: 'Unit',     type: 'text',   w: 90 },
  { f: 'tier',            label: 'Tier',     type: 'text',   w: 55 },
  { f: 'level',           label: 'Lvl',      type: 'number', w: 50 },
  { f: 'count',           label: 'Count',    type: 'number', w: 65 },
  { f: 'hired_at_turn',   label: 'Hired',    type: 'number', w: 60 },
  { f: 'duration_turns',  label: 'Duration', type: 'number', w: 65 },
  { f: 'upkeep_per_turn', label: 'Upkeep',  type: 'number', w: 65 },
];

function safeParseJson(str, fallback) {
  try {
    if (str === null || str === undefined || str === '') return fallback;
    const v = typeof str === 'string' ? JSON.parse(str) : str;
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

// world_fragments: [{ type: "name", studied: bool }]
export function FragmentsWidget({ value, onChange }) {
  const frags = safeParseJson(value, []);
  const raw   = Array.isArray(frags) ? frags : [];
  const arr   = raw.map(f => typeof f === 'string' ? { type: f, studied: false } : f);
  const owned   = Object.fromEntries(arr.map(f => [f.type, true]));
  const studied = Object.fromEntries(arr.filter(f => f.studied).map(f => [f.type, true]));

  function toggle(name, field, checked) {
    let next = arr.filter(f => f.type !== name);
    if (field === 'owned') {
      if (checked) next.push({ type: name, studied: false });
    } else {
      if (owned[name]) next = [...arr.filter(f => f.type !== name), { type: name, studied: checked }];
    }
    onChange(JSON.stringify(next));
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
      {ALL_FRAGMENTS.map(name => (
        <div key={name} style={FRAG_ROW}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, cursor: 'pointer' }}>
            <input type="checkbox" checked={!!owned[name]}
              onChange={e => toggle(name, 'owned', e.target.checked)} />
            <span style={{ fontSize: 12 }}>{name}</span>
          </label>
          <label style={STUDIED_LBL}>
            <input type="checkbox" checked={!!studied[name]} disabled={!owned[name]}
              onChange={e => toggle(name, 'studied', e.target.checked)} />
            studied
          </label>
        </div>
      ))}
    </div>
  );
}

// fragment_bonuses: { building: { fragment: "name", applied_turn: N } }
// Read-only (applied in-game); admin can only delete entries.
export function AttunementWidget({ value, onChange }) {
  const parsed  = safeParseJson(value, {});
  const obj     = isPlainObj(parsed) ? parsed : {};
  const entries = Object.entries(obj);

  if (entries.length === 0) {
    return <div style={EMPTY_MSG}>No attunements set</div>;
  }

  function remove(bld) {
    const next = { ...obj };
    delete next[bld];
    onChange(JSON.stringify(next));
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {entries.map(([bld, att]) => (
        <div key={bld} style={KV_ROW}>
          <span style={{ fontSize: 11, minWidth: 110, color: 'var(--gold)' }}>{bld}</span>
          <span style={{ fontSize: 11, color: 'var(--text)', flex: 1 }}>{att?.fragment || ''}</span>
          <span style={{ fontSize: 10, color: 'var(--text3)' }}>turn {att?.applied_turn ?? '?'}</span>
          <button type="button" onClick={() => remove(bld)} style={BTN_REMOVE}>x</button>
        </div>
      ))}
    </div>
  );
}

// troop_levels: { fighters: { level: N, xp: N, count: N }, ... }
// count is preserved from original; only level/xp are editable.
export function TroopLevelsWidget({ value, onChange }) {
  const parsed = safeParseJson(value, {});
  const obj    = isPlainObj(parsed) ? parsed : {};

  function update(id, field, val) {
    const existing = obj[id] || {};
    const next = { ...obj, [id]: { ...existing, [field]: parseInt(val) || 0 } };
    onChange(JSON.stringify(next));
  }

  return (
    <div>
      <div style={TL_HEADER}><span>Unit</span><span>Level</span><span>XP</span></div>
      {TROOP_TYPES.map(({ id, label }) => {
        const d = obj[id] || {};
        return (
          <div key={id} style={TL_ROW}>
            <span style={{ fontSize: 11, color: 'var(--text)', alignSelf: 'center' }}>{label}</span>
            <input type="number" min="0" value={d.level ?? 0}
              onChange={e => update(id, 'level', e.target.value)} style={SMALL_INPUT} />
            <input type="number" min="0" value={d.xp ?? 0}
              onChange={e => update(id, 'xp', e.target.value)} style={SMALL_INPUT} />
          </div>
        );
      })}
    </div>
  );
}

// injured_troops: { fighters: [{ hp: N, max_hp: N }, ...], ... }
// Displays count; truncates/extends the underlying array.
export function InjuredCountsWidget({ value, onChange }) {
  const parsed = safeParseJson(value, {});
  const obj    = isPlainObj(parsed) ? parsed : {};

  function update(id, countStr) {
    const n = Math.max(0, parseInt(countStr) || 0);
    const existing = Array.isArray(obj[id]) ? obj[id] : [];
    const next = { ...obj };
    if (n === 0) {
      delete next[id];
    } else {
      const arr = existing.slice(0, n);
      while (arr.length < n) arr.push({ hp: 50, max_hp: 100 });
      next[id] = arr;
    }
    onChange(JSON.stringify(next));
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {TROOP_TYPES.map(({ id, label }) => (
        <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, minWidth: 110, color: 'var(--text)' }}>{label}</span>
          <input type="number" min="0"
            value={Array.isArray(obj[id]) ? obj[id].length : 0}
            onChange={e => update(id, e.target.value)}
            style={{ ...SMALL_INPUT, width: 70 }} />
          <span style={{ fontSize: 10, color: 'var(--text3)' }}>injured</span>
        </div>
      ))}
    </div>
  );
}

// active_effects: { effect_name: { turns_left: N, ...otherFields }, ... }
// Unknown fields on each effect object are preserved.
export function EffectsWidget({ value, onChange }) {
  const [newKey, setNewKey] = useState('');
  const parsed = safeParseJson(value, {});
  const obj    = isPlainObj(parsed) ? parsed : {};

  function updateTurns(key, val) {
    const existing = isPlainObj(obj[key]) ? obj[key] : {};
    onChange(JSON.stringify({ ...obj, [key]: { ...existing, turns_left: parseInt(val) || 0 } }));
  }

  function remove(key) {
    const next = { ...obj };
    delete next[key];
    onChange(JSON.stringify(next));
  }

  function add() {
    const k = newKey.trim();
    if (!k || Object.prototype.hasOwnProperty.call(obj, k)) return;
    onChange(JSON.stringify({ ...obj, [k]: { turns_left: 1 } }));
    setNewKey('');
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {Object.entries(obj).map(([key, v]) => {
        const turns = isPlainObj(v) ? (v.turns_left ?? 0) : (parseFloat(v) || 0);
        return (
          <div key={key} style={KV_ROW}>
            <span style={{ fontSize: 11, minWidth: 140, color: 'var(--text)' }}>{key}</span>
            <input type="number" min="0" value={turns}
              onChange={e => updateTurns(key, e.target.value)}
              style={{ ...SMALL_INPUT, width: 70 }} />
            <span style={{ fontSize: 10, color: 'var(--text3)' }}>turns</span>
            <button type="button" onClick={() => remove(key)} style={BTN_REMOVE}>x</button>
          </div>
        );
      })}
      <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
        <input type="text" placeholder="effect_name" value={newKey}
          onChange={e => setNewKey(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && add()}
          style={{ ...SMALL_INPUT, flex: 1 }} />
        <button type="button" onClick={add} style={BTN_ADD}>+ Add</button>
      </div>
    </div>
  );
}

// mercenaries: [{ unit_type, tier, level, count, hired_at_turn, duration_turns, upkeep_per_turn }]
export function MercenariesWidget({ value, onChange }) {
  const parsed = safeParseJson(value, []);
  const mercs  = Array.isArray(parsed) ? parsed : [];

  function update(idx, field, val) {
    const isText = field === 'unit_type' || field === 'tier';
    const next = mercs.map((m, i) =>
      i === idx ? { ...m, [field]: isText ? val : (parseInt(val) || 0) } : m
    );
    onChange(JSON.stringify(next));
  }

  function remove(idx) {
    onChange(JSON.stringify(mercs.filter((_, i) => i !== idx)));
  }

  function add() {
    onChange(JSON.stringify([
      ...mercs,
      { unit_type: '', tier: '', level: 0, count: 0, hired_at_turn: 0, duration_turns: 0, upkeep_per_turn: 0 },
    ]));
  }

  const cols = MERC_FIELDS.map(f => f.w + 'px').join(' ') + ' 28px';

  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 3, fontSize: 10, color: 'var(--text3)', marginBottom: 3 }}>
        {MERC_FIELDS.map(f => <span key={f.f}>{f.label}</span>)}
        <span />
      </div>
      {mercs.map((m, idx) => (
        <div key={idx} style={{ display: 'grid', gridTemplateColumns: cols, gap: 3, marginBottom: 3 }}>
          {MERC_FIELDS.map(({ f, type }) => (
            <input key={f} type={type}
              value={m[f] ?? (type === 'number' ? 0 : '')}
              onChange={e => update(idx, f, e.target.value)}
              style={MERC_INPUT} />
          ))}
          <button type="button" onClick={() => remove(idx)} style={BTN_REMOVE}>x</button>
        </div>
      ))}
      <button type="button" onClick={add} style={{ ...BTN_ADD, marginTop: 4 }}>+ Add Mercenary</button>
    </div>
  );
}

// Generic key->number object (scrolls, build_queue, build_progress, etc.)
export function KvNumbersWidget({ value, onChange }) {
  const [newKey, setNewKey] = useState('');
  const parsed = safeParseJson(value, {});
  const obj    = isPlainObj(parsed) ? parsed : {};

  function update(key, val) {
    onChange(JSON.stringify({ ...obj, [key]: parseFloat(val) || 0 }));
  }

  function remove(key) {
    const next = { ...obj };
    delete next[key];
    onChange(JSON.stringify(next));
  }

  function add() {
    const k = newKey.trim();
    if (!k || Object.prototype.hasOwnProperty.call(obj, k)) return;
    onChange(JSON.stringify({ ...obj, [k]: 0 }));
    setNewKey('');
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {Object.entries(obj).map(([key, val]) => (
        <div key={key} style={KV_ROW}>
          <span style={{ fontSize: 11, minWidth: 130, color: 'var(--text)' }}>{key}</span>
          <input type="number" value={parseFloat(val) || 0}
            onChange={e => update(key, e.target.value)}
            style={{ ...SMALL_INPUT, width: 80 }} />
          <button type="button" onClick={() => remove(key)} style={BTN_REMOVE}>x</button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
        <input type="text" placeholder="field_name" value={newKey}
          onChange={e => setNewKey(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && add()}
          style={{ ...SMALL_INPUT, flex: 1 }} />
        <button type="button" onClick={add} style={BTN_ADD}>+ Add</button>
      </div>
    </div>
  );
}

// items: [{ id, name, qty }]
// Items are earned in-game; only qty is editable.
export function ItemsWidget({ value, onChange }) {
  const parsed = safeParseJson(value, []);
  const items  = Array.isArray(parsed) ? parsed : [];

  if (items.length === 0) {
    return <div style={EMPTY_MSG}>No items</div>;
  }

  function updateQty(idx, val) {
    const next = items.map((it, i) => i === idx ? { ...it, qty: parseInt(val) || 0 } : it);
    onChange(JSON.stringify(next));
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {items.map((item, idx) => (
        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, minWidth: 160, color: 'var(--text)' }}>{item.name || item.id}</span>
          <input type="number" min="0" value={item.qty ?? 0}
            onChange={e => updateQty(idx, e.target.value)}
            style={{ ...SMALL_INPUT, width: 70 }} />
        </div>
      ))}
    </div>
  );
}

// fortified_buildings: { bld_name: true, ... }
export function FortifiedWidget({ value, onChange }) {
  const parsed = safeParseJson(value, {});
  const obj    = isPlainObj(parsed) ? parsed : {};

  function toggle(bld, checked) {
    const next = { ...obj };
    if (checked) next[bld] = true;
    else delete next[bld];
    onChange(JSON.stringify(next));
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 5 }}>
      {ALL_BUILDING_TYPES.map(bld => (
        <label key={bld} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, cursor: 'pointer' }}>
          <input type="checkbox" checked={!!obj[bld]} onChange={e => toggle(bld, e.target.checked)} />
          {bld.replace(/_/g, ' ')}
        </label>
      ))}
    </div>
  );
}

// -- Helpers --

function isPlainObj(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

// -- Styles --

const FRAG_ROW = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '5px 8px', background: 'var(--bg3)', borderRadius: 3,
  border: '1px solid var(--border)',
};

const STUDIED_LBL = {
  display: 'flex', alignItems: 'center', gap: 4,
  fontSize: 11, color: 'var(--text3)', cursor: 'pointer',
  whiteSpace: 'nowrap', marginLeft: 8,
};

const KV_ROW = { display: 'flex', alignItems: 'center', gap: 6 };

const TL_HEADER = {
  display: 'grid', gridTemplateColumns: '120px 70px 70px',
  gap: 4, fontSize: 10, color: 'var(--text3)', marginBottom: 4,
};

const TL_ROW = {
  display: 'grid', gridTemplateColumns: '120px 70px 70px', gap: 4, marginBottom: 3,
};

const SMALL_INPUT = {
  padding: '3px 6px', background: 'var(--bg4)', border: '1px solid var(--border2)',
  borderRadius: 3, color: 'var(--text)', fontSize: 12, fontFamily: 'Inter, sans-serif',
  outline: 'none', width: '100%', boxSizing: 'border-box',
};

const MERC_INPUT = {
  fontSize: 10, padding: '2px 4px', background: 'var(--bg4)',
  border: '1px solid var(--border2)', color: 'var(--text)', borderRadius: 3,
  width: '100%', outline: 'none',
};

export const BTN_REMOVE = {
  fontSize: 10, padding: '2px 5px',
  background: 'rgba(239,68,68,0.15)', border: '1px solid var(--red)',
  color: 'var(--red)', borderRadius: 3, cursor: 'pointer',
};

export const BTN_ADD = {
  fontSize: 11, padding: '4px 8px', background: 'var(--bg3)',
  border: '1px solid var(--border)', borderRadius: 3, cursor: 'pointer',
  color: 'var(--text2)', fontFamily: 'Inter, sans-serif',
};

const EMPTY_MSG = { fontSize: 12, color: 'var(--text3)' };
