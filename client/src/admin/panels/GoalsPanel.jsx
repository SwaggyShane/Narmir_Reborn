import React, { useState, useEffect, useCallback } from 'react';

const TIERS = ['daily', 'weekly', 'monthly'];
const ALLOWED_PRIZE_TYPES = ['gold', 'mana', 'rangers', 'researchers', 'war_machines', 'world_fragment'];

const BLANK_GOAL = {
  tier: 'daily',
  goalId: '',
  label: '',
  minTarget: 1,
  maxTarget: 10,
  prizeType: 'gold',
  prizeMultiplier: 1,
};

function GoalForm({ initial, onSave, onCancel, busy, isEdit }) {
  const [f, setF] = useState(initial);
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  const valid = (f.goalId || '').trim() && (f.label || '').trim() &&
    f.minTarget >= 1 && f.maxTarget >= 2 &&
    Number(f.minTarget) < Number(f.maxTarget) &&
    f.prizeMultiplier >= 0.5 && f.prizeMultiplier <= 100;

  return (
    <div style={MODAL_OVERLAY} onClick={onCancel}>
      <div style={MODAL_BOX} onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 16px', fontFamily: 'Cinzel, serif', fontSize: 15, color: 'var(--gold)' }}>
          {isEdit ? 'Edit Goal' : 'New Goal'}
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <Field label="Tier">
            <select style={INPUT} value={f.tier} onChange={e => set('tier', e.target.value)} disabled={isEdit}>
              {TIERS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Goal ID"><input style={INPUT} value={f.goalId || ''} onChange={e => set('goalId', e.target.value)} disabled={isEdit} /></Field>
          <Field label="Label" style={{ gridColumn: '1 / -1' }}><input style={INPUT} value={f.label || ''} onChange={e => set('label', e.target.value)} /></Field>
          <Field label="Min Target"><input style={INPUT} type="number" min={1} max={500} value={f.minTarget} onChange={e => set('minTarget', Number(e.target.value))} /></Field>
          <Field label="Max Target"><input style={INPUT} type="number" min={2} max={1000} value={f.maxTarget} onChange={e => set('maxTarget', Number(e.target.value))} /></Field>
          <Field label="Prize Type">
            <select style={INPUT} value={f.prizeType} onChange={e => set('prizeType', e.target.value)}>
              {ALLOWED_PRIZE_TYPES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </Field>
          <Field label="Prize Multiplier"><input style={INPUT} type="number" step={0.5} min={0.5} max={100} value={f.prizeMultiplier} onChange={e => set('prizeMultiplier', Number(e.target.value))} /></Field>
        </div>
        {Number(f.minTarget) >= Number(f.maxTarget) && (
          <div style={{ color: 'var(--red, #e55)', fontSize: 12, marginBottom: 8 }}>Min target must be less than max target.</div>
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button onClick={onCancel} style={BTN}>Cancel</button>
          <button onClick={() => onSave(f)} disabled={busy || !valid} style={BTN_PRIMARY}>
            {busy ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

function TierTable({ tier, goals, onEdit, onRemove }) {
  if (!goals || goals.length === 0) {
    return <div style={{ color: 'var(--text3)', fontSize: 13, padding: '4px 0 12px' }}>No {tier} goals defined.</div>;
  }
  return (
    <div style={{ overflowX: 'auto', marginBottom: 16 }}>
      <table style={TABLE}>
        <thead><tr>
          {['Goal ID', 'Label', 'Min', 'Max', 'Prize Type', 'Multiplier', ''].map(h => <th key={h} style={TH}>{h}</th>)}
        </tr></thead>
        <tbody>
          {goals.map(g => (
            <tr key={g.id || g.goalId}>
              <td style={TD}>{g.goalId || g.id}</td>
              <td style={TD}>{g.label}</td>
              <td style={TD}>{g.minTarget}</td>
              <td style={TD}>{g.maxTarget}</td>
              <td style={TD}>{g.prizeType}</td>
              <td style={TD}>{g.prizeMultiplier}</td>
              <td style={TD}>
                <button onClick={() => onEdit(tier, g)} style={{ ...BTN, padding: '3px 8px', fontSize: 11 }}>Edit</button>
                {' '}
                <button onClick={() => onRemove(tier, g)} style={{ ...BTN, padding: '3px 8px', fontSize: 11, color: 'var(--red, #e55)', borderColor: 'var(--red, #e55)' }}>Remove</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function GoalsPanel({ adminFetch, onToast }) {
  const [goals, setGoals] = useState({ daily: [], weekly: [], monthly: [] });
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newTier, setNewTier] = useState('daily');

  const loadGoals = useCallback(async () => {
    try {
      const data = await adminFetch('/api/admin/goals');
      if (data?.error) { onToast('Goals load error: ' + data.error, 'error'); return; }
      setGoals({ daily: data.daily || [], weekly: data.weekly || [], monthly: data.monthly || [] });
    } catch (err) { onToast('Failed to load goals: ' + (err.message || 'Unknown'), 'error'); }
  }, [adminFetch, onToast]);

  useEffect(() => {
    setLoading(true);
    loadGoals().finally(() => setLoading(false));
  }, [loadGoals]);

  async function handleSaveEdit(f) {
    setSaving(true);
    try {
      const data = await adminFetch('/api/admin/goals/edit', { method: 'POST', body: f });
      if (data?.error) { onToast('Edit failed: ' + data.error, 'error'); return; }
      onToast('Goal updated', 'success');
      setEditing(null);
      loadGoals();
    } catch (err) { onToast('Edit failed: ' + (err.message || 'Unknown'), 'error'); }
    finally { setSaving(false); }
  }

  async function handleSaveAdd(f) {
    setSaving(true);
    try {
      const data = await adminFetch('/api/admin/goals/add', { method: 'POST', body: f });
      if (data?.error) { onToast('Add failed: ' + data.error, 'error'); return; }
      onToast('Goal added', 'success');
      setAdding(false);
      loadGoals();
    } catch (err) { onToast('Add failed: ' + (err.message || 'Unknown'), 'error'); }
    finally { setSaving(false); }
  }

  async function handleRemove(tier, g) {
    if (!window.confirm(`Remove goal "${g.label || g.goalId || g.id}"?`)) return;
    try {
      const data = await adminFetch('/api/admin/goals/remove', { method: 'POST', body: { tier, goalId: g.goalId || g.id } });
      if (data?.error) { onToast('Remove failed: ' + data.error, 'error'); return; }
      onToast('Goal removed', 'success');
      loadGoals();
    } catch (err) { onToast('Remove failed: ' + (err.message || 'Unknown'), 'error'); }
  }

  function handleEdit(tier, g) {
    setEditing({ tier, goalId: g.goalId || g.id, label: g.label, minTarget: g.minTarget, maxTarget: g.maxTarget, prizeType: g.prizeType, prizeMultiplier: g.prizeMultiplier });
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
        <button
          onClick={() => setAdding(true)}
          style={BTN_PRIMARY}
        >
          + New Goal
        </button>
        <select style={{ ...INPUT, maxWidth: 120 }} value={newTier} onChange={e => setNewTier(e.target.value)}>
          {TIERS.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <button onClick={() => { setLoading(true); loadGoals().finally(() => setLoading(false)); }} style={{ ...BTN, marginLeft: 'auto' }} disabled={loading}>
          {loading ? '...' : 'Refresh'}
        </button>
      </div>

      {TIERS.map(tier => (
        <div key={tier}>
          <div style={{ fontFamily: 'Cinzel, serif', fontSize: 13, color: 'var(--gold)', marginBottom: 6, textTransform: 'capitalize' }}>
            {tier} Goals ({(goals[tier] || []).length})
          </div>
          <TierTable tier={tier} goals={goals[tier]} onEdit={handleEdit} onRemove={handleRemove} />
        </div>
      ))}

      {editing && (
        <GoalForm
          initial={editing}
          onSave={handleSaveEdit}
          onCancel={() => setEditing(null)}
          busy={saving}
          isEdit={true}
        />
      )}

      {adding && (
        <GoalForm
          initial={{ ...BLANK_GOAL, tier: newTier }}
          onSave={handleSaveAdd}
          onCancel={() => setAdding(false)}
          busy={saving}
          isEdit={false}
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
const MODAL_BOX = { background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 8, padding: '24px 28px', maxWidth: 560, width: '92%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.6)' };
