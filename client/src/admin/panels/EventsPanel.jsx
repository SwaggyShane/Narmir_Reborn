import React, { useState, useEffect, useCallback } from 'react';

const SEASONS = ['all', 'spring', 'summer', 'fall', 'winter'];
const EFFECT_TYPES = [
  'happiness', 'gold_production', 'food_production', 'military_bonus',
  'research_bonus', 'population_growth', 'defense_bonus', 'attack_bonus',
  'land_gain', 'experience', 'mana_regen', 'construction_speed',
  'tax_rate', 'troop_training', 'spy_bonus', 'custom',
];
const RACES = ['', 'human', 'high_elf', 'dwarf', 'dire_wolf', 'dark_elf', 'orc', 'vampire', 'wood_elf', 'ogre'];

const BLANK = { key: '', name: '', description: '', season: 'all', effect_type: 'happiness', effect_value: 0, effect_duration: 1, race_only: '', is_active: true, is_positive: true };

function EventForm({ initial, onSave, onCancel, busy }) {
  const [f, setF] = useState(initial);
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  return (
    <div style={MODAL_OVERLAY} onClick={onCancel}>
      <div style={MODAL_BOX} onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 16px', fontFamily: 'Cinzel, serif', fontSize: 15, color: 'var(--gold)' }}>
          {initial.id ? 'Edit Event' : 'New Event'}
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <Field label="Key"><input style={INPUT} value={f.key} onChange={e => set('key', e.target.value)} /></Field>
          <Field label="Name"><input style={INPUT} value={f.name} onChange={e => set('name', e.target.value)} /></Field>
          <Field label="Season">
            <select style={INPUT} value={f.season} onChange={e => set('season', e.target.value)}>
              {SEASONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Race Only (blank = all)">
            <select style={INPUT} value={f.race_only || ''} onChange={e => set('race_only', e.target.value)}>
              {RACES.map(r => <option key={r} value={r}>{r || '— all races —'}</option>)}
            </select>
          </Field>
          <Field label="Effect Type">
            <select style={INPUT} value={f.effect_type} onChange={e => set('effect_type', e.target.value)}>
              {EFFECT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Effect Value"><input style={INPUT} type="number" value={f.effect_value} onChange={e => set('effect_value', Number(e.target.value))} /></Field>
          <Field label="Effect Duration (turns)"><input style={INPUT} type="number" value={f.effect_duration} onChange={e => set('effect_duration', Number(e.target.value))} /></Field>
        </div>
        <Field label="Description">
          <textarea style={{ ...INPUT, resize: 'vertical' }} rows={3} value={f.description} onChange={e => set('description', e.target.value)} />
        </Field>
        <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
          <label style={CHECK_LABEL}>
            <input type="checkbox" checked={f.is_active} onChange={e => set('is_active', e.target.checked)} />
            Active
          </label>
          <label style={CHECK_LABEL}>
            <input type="checkbox" checked={f.is_positive} onChange={e => set('is_positive', e.target.checked)} />
            Positive effect
          </label>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button onClick={onCancel} style={BTN}>Cancel</button>
          <button onClick={() => onSave(f)} disabled={busy || !f.key.trim() || !f.name.trim()} style={BTN_PRIMARY}>
            {busy ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function EventsPanel({ adminFetch, onToast }) {
  const [tab, setTab]       = useState('log');
  const [log, setLog]       = useState([]);
  const [defs, setDefs]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null | event object | 'new'
  const [saving, setSaving] = useState(false);
  const [logSearch, setLogSearch] = useState('');

  const loadLog = useCallback(async () => {
    try {
      const data = await adminFetch('/api/admin/events/log');
      if (Array.isArray(data)) setLog(data);
      else if (data?.error) onToast('Log error: ' + data.error, 'error');
    } catch (err) { onToast('Failed to load event log: ' + (err.message || 'Unknown'), 'error'); }
  }, [adminFetch, onToast]);

  const loadDefs = useCallback(async () => {
    try {
      const data = await adminFetch('/api/admin/events/list');
      if (Array.isArray(data)) setDefs(data);
      else if (data?.error) onToast('Defs error: ' + data.error, 'error');
    } catch (err) { onToast('Failed to load event defs: ' + (err.message || 'Unknown'), 'error'); }
  }, [adminFetch, onToast]);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadLog(), loadDefs()]).finally(() => setLoading(false));
  }, [loadLog, loadDefs]);

  async function handleSave(f) {
    setSaving(true);
    try {
      const endpoint = f.id ? '/api/admin/events/update' : '/api/admin/events/create';
      const data = await adminFetch(endpoint, { method: 'POST', body: f });
      if (data?.error) { onToast('Save failed: ' + data.error, 'error'); return; }
      onToast(f.id ? 'Event updated' : 'Event created', 'success');
      setEditing(null);
      loadDefs();
    } catch (err) { onToast('Save failed: ' + (err.message || 'Unknown'), 'error'); }
    finally { setSaving(false); }
  }

  async function handleDelete(ev) {
    if (!window.confirm(`Delete event "${ev.name}"?`)) return;
    try {
      const data = await adminFetch('/api/admin/events/delete', { method: 'POST', body: { id: ev.id } });
      if (data?.error) { onToast('Delete failed: ' + data.error, 'error'); return; }
      onToast('Event deleted', 'success');
      setDefs(prev => prev.filter(d => d.id !== ev.id));
    } catch (err) { onToast('Delete failed: ' + (err.message || 'Unknown'), 'error'); }
  }

  const filteredLog = logSearch
    ? log.filter(r => JSON.stringify(r).toLowerCase().includes(logSearch.toLowerCase()))
    : log;

  return (
    <div>
      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        {[['log', 'Event Log'], ['defs', 'Definitions']].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{ ...BTN, color: tab === id ? 'var(--gold)' : 'var(--text3)', borderColor: tab === id ? 'var(--gold)' : 'var(--border2)' }}>
            {label}
          </button>
        ))}
        <button onClick={() => { loadLog(); loadDefs(); }} style={{ ...BTN, marginLeft: 'auto' }} disabled={loading}>
          {loading ? '...' : 'Refresh'}
        </button>
      </div>

      {tab === 'log' && (
        <div>
          <input
            value={logSearch} onChange={e => setLogSearch(e.target.value)}
            placeholder="Filter log..." style={{ ...INPUT, marginBottom: 10, maxWidth: 320 }}
          />
          <div style={{ overflowX: 'auto' }}>
            <table style={TABLE}>
              <thead><tr>
                {['ID', 'Kingdom', 'Event', 'Season', 'Effect', 'Value', 'Fired At'].map(h => <th key={h} style={TH}>{h}</th>)}
              </tr></thead>
              <tbody>
                {filteredLog.slice(0, 200).map(r => (
                  <tr key={r.id}>
                    <td style={TD}>{r.id}</td>
                    <td style={TD}>{r.kingdom_id ?? '-'}</td>
                    <td style={TD}>{r.event_name ?? r.event_key ?? '-'}</td>
                    <td style={TD}>{r.season ?? '-'}</td>
                    <td style={TD}>{r.effect_type ?? '-'}</td>
                    <td style={TD}>{r.effect_value ?? '-'}</td>
                    <td style={TD}>{r.fired_at ? new Date(r.fired_at * 1000).toLocaleString() : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredLog.length === 0 && <div style={{ color: 'var(--text3)', fontSize: 13, padding: '8px 0' }}>No events found.</div>}
          </div>
        </div>
      )}

      {tab === 'defs' && (
        <div>
          <button onClick={() => setEditing({ ...BLANK })} style={{ ...BTN_PRIMARY, marginBottom: 12 }}>
            + New Event
          </button>
          <div style={{ overflowX: 'auto' }}>
            <table style={TABLE}>
              <thead><tr>
                {['Key', 'Name', 'Season', 'Type', 'Value', 'Duration', 'Race', '+/-', 'Active', ''].map(h => <th key={h} style={TH}>{h}</th>)}
              </tr></thead>
              <tbody>
                {defs.map(ev => (
                  <tr key={ev.id}>
                    <td style={TD}>{ev.key}</td>
                    <td style={TD}>{ev.name}</td>
                    <td style={TD}>{ev.season}</td>
                    <td style={TD}>{ev.effect_type}</td>
                    <td style={TD}>{ev.effect_value}</td>
                    <td style={TD}>{ev.effect_duration}</td>
                    <td style={TD}>{ev.race_only || 'all'}</td>
                    <td style={TD}>{ev.is_positive ? '+' : '-'}</td>
                    <td style={TD}>{ev.is_active ? 'yes' : 'no'}</td>
                    <td style={TD}>
                      <button onClick={() => setEditing({ ...ev, is_active: !!ev.is_active, is_positive: !!ev.is_positive })} style={{ ...BTN, padding: '3px 8px', fontSize: 11 }}>Edit</button>
                      {' '}
                      <button onClick={() => handleDelete(ev)} style={{ ...BTN, padding: '3px 8px', fontSize: 11, color: 'var(--red, #e55)', borderColor: 'var(--red, #e55)' }}>Del</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {defs.length === 0 && !loading && <div style={{ color: 'var(--text3)', fontSize: 13, padding: '8px 0' }}>No event definitions.</div>}
          </div>
        </div>
      )}

      {editing && (
        <EventForm
          initial={editing}
          onSave={handleSave}
          onCancel={() => setEditing(null)}
          busy={saving}
        />
      )}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 3 }}>{label}</label>
      {children}
    </div>
  );
}

const INPUT = { width: '100%', padding: '6px 8px', background: 'var(--bg4)', border: '1px solid var(--border2)', borderRadius: 4, color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'Inter, sans-serif', boxSizing: 'border-box' };
const BTN = { padding: '6px 12px', background: 'var(--bg4)', border: '1px solid var(--border2)', borderRadius: 4, color: 'var(--text2)', fontSize: 13, cursor: 'pointer', fontFamily: 'Inter, sans-serif' };
const BTN_PRIMARY = { ...BTN, color: 'var(--gold)', borderColor: 'var(--gold)' };
const TABLE = { width: '100%', borderCollapse: 'collapse', fontSize: 12, color: 'var(--text2)' };
const TH = { padding: '6px 8px', textAlign: 'left', borderBottom: '1px solid var(--border2)', color: 'var(--text3)', fontWeight: 600, whiteSpace: 'nowrap' };
const TD = { padding: '5px 8px', borderBottom: '1px solid var(--border3, #2a2a2a)', whiteSpace: 'nowrap' };
const CHECK_LABEL = { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text2)', cursor: 'pointer' };
const MODAL_OVERLAY = { position: 'fixed', inset: 0, zIndex: 10002, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const MODAL_BOX = { background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 8, padding: '24px 28px', maxWidth: 560, width: '92%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.6)' };
