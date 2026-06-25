import React, { useState, useEffect, useCallback } from 'react';

const LORE_CATEGORIES = ['general', 'race', 'history', 'magic', 'religion', 'geography', 'bestiary', 'other'];

const BLANK_LORE = { key_id: '', category: 'general', title: '', content: '' };

function LoreForm({ initial, onSave, onCancel, busy }) {
  const [f, setF] = useState(initial);
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  return (
    <div style={MODAL_OVERLAY} onClick={onCancel}>
      <div style={MODAL_BOX} onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 16px', fontFamily: 'Cinzel, serif', fontSize: 15, color: 'var(--gold)' }}>
          {initial.id ? 'Edit Lore Entry' : 'New Lore Entry'}
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <Field label="Key ID"><input style={INPUT} value={f.key_id} onChange={e => set('key_id', e.target.value)} /></Field>
          <Field label="Category">
            <select style={INPUT} value={f.category} onChange={e => set('category', e.target.value)}>
              {LORE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Title" style={{ gridColumn: '1 / -1' }}><input style={INPUT} value={f.title} onChange={e => set('title', e.target.value)} /></Field>
        </div>
        <Field label="Content">
          <textarea style={{ ...INPUT, resize: 'vertical' }} rows={6} value={f.content} onChange={e => set('content', e.target.value)} />
        </Field>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button onClick={onCancel} style={BTN}>Cancel</button>
          <button onClick={() => onSave(f)} disabled={busy || !f.title.trim()} style={BTN_PRIMARY}>
            {busy ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

function EventPoolSection({ title, endpoint, adminFetch, onToast }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newContent, setNewContent] = useState('');
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminFetch(`/api/admin/${endpoint}`);
      if (data?.error) { onToast(`${title} load error: ` + data.error, 'error'); return; }
      if (Array.isArray(data?.list)) setItems(data.list);
    } catch (err) { onToast(`Failed to load ${title}: ` + (err.message || 'Unknown'), 'error'); }
    finally { setLoading(false); }
  }, [adminFetch, onToast, endpoint, title]);

  useEffect(() => { load(); }, [load]);

  async function handleAdd() {
    if (!newContent.trim()) return;
    setAdding(true);
    try {
      const data = await adminFetch(`/api/admin/${endpoint}`, { method: 'POST', body: { content: newContent.trim() } });
      if (data?.error) { onToast('Add failed: ' + data.error, 'error'); return; }
      onToast('Entry added', 'success');
      setNewContent('');
      load();
    } catch (err) { onToast('Add failed: ' + (err.message || 'Unknown'), 'error'); }
    finally { setAdding(false); }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this entry?')) return;
    try {
      const data = await adminFetch(`/api/admin/${endpoint}/${id}`, { method: 'DELETE' });
      if (data?.error) { onToast('Delete failed: ' + data.error, 'error'); return; }
      onToast('Entry deleted', 'success');
      setItems(prev => prev.filter(i => i.id !== id));
    } catch (err) { onToast('Delete failed: ' + (err.message || 'Unknown'), 'error'); }
  }

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text1)' }}>{title}</span>
        <button onClick={load} style={{ ...BTN, fontSize: 11, padding: '3px 8px' }} disabled={loading}>
          {loading ? '...' : 'Refresh'}
        </button>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <textarea
          style={{ ...INPUT, flex: 1, resize: 'vertical' }}
          rows={2}
          placeholder="New entry content..."
          value={newContent}
          onChange={e => setNewContent(e.target.value)}
        />
        <button onClick={handleAdd} disabled={adding || !newContent.trim()} style={{ ...BTN_PRIMARY, alignSelf: 'flex-end' }}>
          {adding ? '...' : 'Add'}
        </button>
      </div>
      {items.length === 0 ? (
        <div style={{ color: 'var(--text3)', fontSize: 12, padding: '4px 0' }}>{loading ? 'Loading...' : 'No entries.'}</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={TABLE}>
            <thead><tr>
              <th style={TH}>ID</th>
              <th style={{ ...TH, width: '100%' }}>Content</th>
              <th style={TH}></th>
            </tr></thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id}>
                  <td style={TD}>{item.id}</td>
                  <td style={{ ...TD, whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxWidth: 500 }}>{item.content}</td>
                  <td style={TD}>
                    <button onClick={() => handleDelete(item.id)} style={{ ...BTN, padding: '3px 8px', fontSize: 11, color: 'var(--red, #e55)', borderColor: 'var(--red, #e55)' }}>Del</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function LorePanel({ adminFetch, onToast }) {
  const [tab, setTab] = useState('lore');
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [filterCat, setFilterCat] = useState('');

  const loadEntries = useCallback(async () => {
    try {
      const data = await adminFetch('/api/admin/lore');
      if (data?.error) { onToast('Lore load error: ' + data.error, 'error'); return; }
      if (Array.isArray(data?.list)) setEntries(data.list);
    } catch (err) { onToast('Failed to load lore: ' + (err.message || 'Unknown'), 'error'); }
  }, [adminFetch, onToast]);

  useEffect(() => {
    setLoading(true);
    loadEntries().finally(() => setLoading(false));
  }, [loadEntries]);

  async function handleSave(f) {
    setSaving(true);
    try {
      let data;
      if (f.id) {
        data = await adminFetch(`/api/admin/lore/${f.id}`, { method: 'PUT', body: f });
      } else {
        data = await adminFetch('/api/admin/lore', { method: 'POST', body: f });
      }
      if (data?.error) { onToast('Save failed: ' + data.error, 'error'); return; }
      onToast(f.id ? 'Lore updated' : 'Lore created', 'success');
      setEditing(null);
      loadEntries();
    } catch (err) { onToast('Save failed: ' + (err.message || 'Unknown'), 'error'); }
    finally { setSaving(false); }
  }

  async function handleDelete(entry) {
    if (!window.confirm(`Delete lore entry "${entry.title}"?`)) return;
    try {
      const data = await adminFetch(`/api/admin/lore/${entry.id}`, { method: 'DELETE' });
      if (data?.error) { onToast('Delete failed: ' + data.error, 'error'); return; }
      onToast('Lore deleted', 'success');
      setEntries(prev => prev.filter(e => e.id !== entry.id));
    } catch (err) { onToast('Delete failed: ' + (err.message || 'Unknown'), 'error'); }
  }

  const filtered = filterCat ? entries.filter(e => e.category === filterCat) : entries;

  return (
    <div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, flexWrap: 'wrap' }}>
        {[['lore', 'Lore Entries'], ['random', 'Random Events'], ['junk', 'Junk Events'], ['tax', 'Tax Events']].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{ ...BTN, color: tab === id ? 'var(--gold)' : 'var(--text3)', borderColor: tab === id ? 'var(--gold)' : 'var(--border2)' }}>
            {label}
          </button>
        ))}
        {tab === 'lore' && (
          <button onClick={() => { setLoading(true); loadEntries().finally(() => setLoading(false)); }} style={{ ...BTN, marginLeft: 'auto' }} disabled={loading}>
            {loading ? '...' : 'Refresh'}
          </button>
        )}
      </div>

      {tab === 'lore' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
            <button onClick={() => setEditing({ ...BLANK_LORE })} style={BTN_PRIMARY}>+ New Entry</button>
            <select style={{ ...INPUT, maxWidth: 160 }} value={filterCat} onChange={e => setFilterCat(e.target.value)}>
              <option value="">All categories</option>
              {LORE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={TABLE}>
              <thead><tr>
                {['ID', 'Key', 'Category', 'Title', 'Content (preview)', ''].map(h => <th key={h} style={TH}>{h}</th>)}
              </tr></thead>
              <tbody>
                {filtered.map(e => (
                  <tr key={e.id}>
                    <td style={TD}>{e.id}</td>
                    <td style={TD}>{e.key_id || '-'}</td>
                    <td style={TD}>{e.category}</td>
                    <td style={TD}>{e.title}</td>
                    <td style={{ ...TD, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {(e.content || '').substring(0, 80)}{e.content?.length > 80 ? '...' : ''}
                    </td>
                    <td style={TD}>
                      <button onClick={() => setEditing({ ...e })} style={{ ...BTN, padding: '3px 8px', fontSize: 11 }}>Edit</button>
                      {' '}
                      <button onClick={() => handleDelete(e)} style={{ ...BTN, padding: '3px 8px', fontSize: 11, color: 'var(--red, #e55)', borderColor: 'var(--red, #e55)' }}>Del</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && !loading && <div style={{ color: 'var(--text3)', fontSize: 13, padding: '8px 0' }}>No lore entries.</div>}
          </div>
        </div>
      )}

      {tab === 'random' && <EventPoolSection title="Random Events" endpoint="random_events" adminFetch={adminFetch} onToast={onToast} />}
      {tab === 'junk'   && <EventPoolSection title="Junk Events"   endpoint="junk_events"   adminFetch={adminFetch} onToast={onToast} />}
      {tab === 'tax'    && <EventPoolSection title="Tax Events"    endpoint="tax_events"    adminFetch={adminFetch} onToast={onToast} />}

      {editing && (
        <LoreForm
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
const MODAL_OVERLAY = { position: 'fixed', inset: 0, zIndex: 10002, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const MODAL_BOX = { background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 8, padding: '24px 28px', maxWidth: 600, width: '92%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.6)' };
