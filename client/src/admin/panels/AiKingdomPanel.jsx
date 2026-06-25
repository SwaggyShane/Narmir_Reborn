import React, { useState, useCallback } from 'react';
import { AI_PRESETS } from '../lib/aiPresets.js';

const COLS = [
  { key: 'name',        label: 'Kingdom' },
  { key: 'race',        label: 'Race' },
  { key: 'land',        label: 'Land' },
  { key: 'population',  label: 'Pop' },
  { key: 'gold',        label: 'Gold' },
  { key: 'food',        label: 'Food' },
  { key: 'fighters',    label: 'Fighters' },
  { key: 'mages',       label: 'Mages' },
  { key: 'ninjas',      label: 'Ninjas' },
  { key: 'turns_stored',label: 'Turns' },
  { key: 'wins',        label: 'W' },
  { key: 'losses',      label: 'L' },
  { key: 'level',       label: 'Lvl' },
  { key: 'top_build',   label: 'Top Build' },
  { key: 'top_research',label: 'Top Research' },
];

export default function AiKingdomPanel({ adminFetch, onToast }) {
  const [synopsis, setSynopsis]     = useState([]);
  const [loading, setLoading]       = useState(false);
  const [seeding, setSeeding]       = useState(false);
  const [resetting, setResetting]   = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [applying, setApplying]     = useState(false);

  const loadSynopsis = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminFetch('/api/admin/ai/synopsis');
      if (data?.error) { onToast('Synopsis error: ' + data.error, 'error'); return; }
      if (Array.isArray(data)) setSynopsis(data);
    } catch (err) {
      onToast('Failed to load AI synopsis: ' + (err.message || 'Unknown error'), 'error');
    } finally {
      setLoading(false);
    }
  }, [adminFetch, onToast]);

  async function handleSeed() {
    setSeeding(true);
    try {
      const data = await adminFetch('/api/admin/ai/seed', { method: 'POST' });
      if (data?.error) { onToast('Seed failed: ' + data.error, 'error'); return; }
      onToast(`AI seed complete: ${data.created} created, ${data.total} total`, 'success');
      loadSynopsis();
    } catch (err) {
      onToast('Seed failed: ' + (err.message || 'Unknown error'), 'error');
    } finally {
      setSeeding(false);
    }
  }

  async function handleReset() {
    if (!window.confirm('Reset ALL AI kingdoms to starting stats? This wipes troops, resources, and buildings.')) return;
    setResetting(true);
    try {
      const data = await adminFetch('/api/admin/ai/reset', { method: 'POST' });
      if (data?.error) { onToast('Reset failed: ' + data.error, 'error'); return; }
      onToast(`AI reset complete: ${data.reset} kingdoms reset`, 'success');
      loadSynopsis();
    } catch (err) {
      onToast('Reset failed: ' + (err.message || 'Unknown error'), 'error');
    } finally {
      setResetting(false);
    }
  }

  async function handleApplyPreset(presetId) {
    if (!selectedId) {
      onToast('Select an AI kingdom row first', 'error');
      return;
    }
    const target = synopsis.find(r => r.id === selectedId);
    const preset = AI_PRESETS.find(p => p.id === presetId);
    if (!target || !preset) return;

    setApplying(true);
    try {
      const data = await adminFetch('/api/admin/ai/apply-preset', {
        method: 'POST',
        body: { kingdomId: selectedId, presetId },
      });
      if (data?.error) { onToast('Preset failed: ' + data.error, 'error'); return; }
      onToast(`Applied "${preset.label}" to ${target.name} (${data.fieldsUpdated} fields)`, 'success');
      loadSynopsis();
    } catch (err) {
      onToast('Preset failed: ' + (err.message || 'Unknown error'), 'error');
    } finally {
      setApplying(false);
    }
  }

  const selectedKingdom = synopsis.find(r => r.id === selectedId);

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text1)' }}>AI Kingdoms</span>
        <button onClick={loadSynopsis} style={BTN} disabled={loading}>
          {loading ? '...' : 'Refresh Synopsis'}
        </button>
        <button onClick={handleSeed} style={BTN} disabled={seeding}>
          {seeding ? '...' : 'Seed AI'}
        </button>
        <button onClick={handleReset} style={{ ...BTN, color: 'var(--red, #e55)' }} disabled={resetting}>
          {resetting ? '...' : 'Reset AI'}
        </button>
      </div>

      {/* Preset buttons */}
      <div style={{ marginBottom: 10 }}>
        <span style={{ fontSize: 12, color: 'var(--text3)', marginRight: 8 }}>
          {selectedKingdom
            ? `Presets for: ${selectedKingdom.name} (${selectedKingdom.race})`
            : 'Select a row then apply a preset:'}
        </span>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
          {AI_PRESETS.map(p => (
            <button
              key={p.id}
              onClick={() => handleApplyPreset(p.id)}
              disabled={applying || !selectedId}
              title={p.description}
              style={{
                ...BTN,
                opacity: selectedId ? 1 : 0.5,
                fontSize: 11,
                padding: '4px 8px',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Synopsis table */}
      {synopsis.length === 0 ? (
        <div style={{ color: 'var(--text3)', fontSize: 13, padding: '8px 0' }}>
          {loading ? 'Loading...' : 'No AI kingdoms found. Click "Seed AI" to create them, then "Refresh Synopsis".'}
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={TABLE_STYLE}>
            <thead>
              <tr>
                {COLS.map(c => (
                  <th key={c.key} style={TH}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {synopsis.map(row => (
                <tr
                  key={row.id}
                  onClick={() => setSelectedId(row.id === selectedId ? null : row.id)}
                  style={{
                    cursor: 'pointer',
                    background: row.id === selectedId ? 'var(--bg5, #333)' : 'transparent',
                  }}
                >
                  {COLS.map(c => (
                    <td key={c.key} style={TD}>
                      {row[c.key] == null ? '-' : String(row[c.key])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const BTN = {
  padding: '6px 12px', background: 'var(--bg4)',
  border: '1px solid var(--border2)', borderRadius: 4,
  color: 'var(--text2)', fontSize: 13, cursor: 'pointer',
  fontFamily: 'Inter, sans-serif',
};

const TABLE_STYLE = {
  width: '100%', borderCollapse: 'collapse', fontSize: 12,
  color: 'var(--text2)',
};

const TH = {
  padding: '6px 8px', textAlign: 'left', whiteSpace: 'nowrap',
  borderBottom: '1px solid var(--border2)', color: 'var(--text3)', fontWeight: 600,
};

const TD = {
  padding: '5px 8px', whiteSpace: 'nowrap',
  borderBottom: '1px solid var(--border3, #2a2a2a)',
};
