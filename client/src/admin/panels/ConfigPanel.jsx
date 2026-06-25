import React, { useState, useEffect, useCallback } from 'react';

const CONFIG_CATEGORIES = [
  {
    name: 'Economy & Management',
    keys: [
      { key: 'FARM_YIELD_MULT',       label: 'Farm Yield Multipliers' },
      { key: 'FARM_WORKERS_PER',      label: 'Farm Workers (per Farm)' },
      { key: 'FOOD_CONSUMPTION_MULT', label: 'Food Consumption' },
      { key: 'MARKET_INCOME_MULT',    label: 'Market Income' },
      { key: 'TRADE_RATE_MULT',       label: 'Trade Rates' },
      { key: 'SUPPORT_CAP_RACE',      label: 'Support Unit Caps' },
      { key: 'HOUSING_CAP_BY_RACE',   label: 'Housing Limit By Race' },
      { key: 'SEASON_FARM_MULT',      label: 'Season Farm Yields' },
    ],
  },
  {
    name: 'Military & Combat',
    keys: [
      { key: 'UNIT_COST',       label: 'Base Unit Cost' },
      { key: 'XP_BASE',         label: 'Base XP Awards' },
      { key: 'XP_RACE_BONUS',   label: 'XP Race Bonuses' },
      { key: 'TROOP_RACE_BONUS',label: 'Troop Power Mods' },
      { key: 'WM_CREW_REQUIRED',label: 'War Machine Crewing' },
      { key: 'RACE_BONUSES',    label: 'Global Race Stat Mods' },
    ],
  },
  {
    name: 'Buildings & Construction',
    keys: [
      { key: 'BUILDING_COST',       label: 'Building Turn Cost' },
      { key: 'BUILDING_GOLD_COST',  label: 'Building Gold Cost' },
      { key: 'BUILDING_LAND_COST',  label: 'Building Land Cost' },
      { key: 'WALL_STRENGTH_MULT',  label: 'Wall Defense Multipliers' },
      { key: 'TOWER_DETECT_MULT',   label: 'Tower Detect Multipliers' },
      { key: 'OUTPOST_RANGER_MULT', label: 'Outpost Ranger Multipliers' },
    ],
  },
  {
    name: 'Exploration & Research',
    keys: [
      { key: 'MAX_RESEARCH',   label: 'Max Research Points' },
      { key: 'LOCATE_RACE_MULT', label: 'Discovery Multipliers' },
    ],
  },
];

function tryParseJson(str) {
  try { return { ok: true, value: JSON.parse(str) }; }
  catch { return { ok: false }; }
}

function ConfigKeyRow({ configKey, label, baseValue, overrideValue, onSave, saving }) {
  const baseStr = JSON.stringify(baseValue, null, 2) ?? 'undefined';
  const [draft, setDraft] = useState(
    overrideValue !== undefined ? JSON.stringify(overrideValue, null, 2) : ''
  );
  const [expanded, setExpanded] = useState(false);

  const parsed = draft.trim() ? tryParseJson(draft) : { ok: true, value: undefined };
  const isDirty = draft.trim() !== (overrideValue !== undefined ? JSON.stringify(overrideValue, null, 2) : '');

  return (
    <div style={{ borderBottom: '1px solid var(--border3, #2a2a2a)', padding: '8px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }} onClick={() => setExpanded(v => !v)}>
        <span style={{ fontSize: 11, color: 'var(--text3)', minWidth: 16 }}>{expanded ? 'v' : '>'}</span>
        <span style={{ fontSize: 13, color: 'var(--text2)', fontWeight: 500, flex: 1 }}>{label}</span>
        <code style={{ fontSize: 11, color: 'var(--text3)' }}>{configKey}</code>
        {overrideValue !== undefined && <span style={{ fontSize: 10, color: 'var(--gold)', border: '1px solid var(--gold)', borderRadius: 2, padding: '1px 4px' }}>overridden</span>}
      </div>
      {expanded && (
        <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div>
            <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 3 }}>Base Value</div>
            <pre style={{ ...PRE, opacity: 0.6 }}>{baseStr}</pre>
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 3 }}>
              Override Value {!parsed.ok && <span style={{ color: 'var(--red, #e55)' }}>(invalid JSON)</span>}
            </div>
            <textarea
              style={{ ...INPUT, fontFamily: 'monospace', fontSize: 12, resize: 'vertical', minHeight: 80 }}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              placeholder="Leave empty to use base value..."
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              <button
                onClick={() => onSave(configKey, parsed.value)}
                disabled={saving || !parsed.ok || !isDirty}
                style={BTN_PRIMARY}
              >
                {saving ? 'Saving...' : 'Apply Override'}
              </button>
              {draft.trim() && (
                <button onClick={() => setDraft('')} style={BTN}>Clear</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ConfigPanel({ adminFetch, onToast }) {
  const [config, setConfig]     = useState(null);
  const [overrides, setOverrides] = useState({});
  const [loading, setLoading]   = useState(true);
  const [savingKey, setSavingKey] = useState(null);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminFetch('/api/admin/config');
      if (data?.error) { onToast('Config load error: ' + data.error, 'error'); return; }
      setConfig(data.config || {});
      setOverrides(data.overrides || {});
    } catch (err) { onToast('Failed to load config: ' + (err.message || 'Unknown'), 'error'); }
    finally { setLoading(false); }
  }, [adminFetch, onToast]);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  async function handleSave(key, value) {
    setSavingKey(key);
    try {
      const overridePayload = value === undefined ? {} : { [key]: value };
      if (value === undefined) {
        onToast('Clear override: remove the entry from config_overrides.json manually on server', 'info');
        setSavingKey(null);
        return;
      }
      const data = await adminFetch('/api/admin/config', { method: 'POST', body: { overrides: overridePayload } });
      if (data?.error) { onToast('Save failed: ' + data.error, 'error'); return; }
      onToast(`Override saved for ${key}`, 'success');
      setOverrides(data.existing || {});
    } catch (err) { onToast('Save failed: ' + (err.message || 'Unknown'), 'error'); }
    finally { setSavingKey(null); }
  }

  if (loading) return <div style={{ color: 'var(--text3)', fontSize: 13 }}>Loading config...</div>;

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
        <span style={{ color: 'var(--text3)', fontSize: 13 }}>
          Click any key to expand and edit its override. Changes apply immediately in memory and persist to <code>config_overrides.json</code>.
        </span>
        <button onClick={loadConfig} style={{ ...BTN, marginLeft: 'auto' }}>Refresh</button>
      </div>

      {CONFIG_CATEGORIES.map(cat => (
        <div key={cat.name} style={{ marginBottom: 24 }}>
          <div style={{ fontFamily: 'Cinzel, serif', fontSize: 13, color: 'var(--gold)', marginBottom: 8, paddingBottom: 6, borderBottom: '1px solid var(--border2)' }}>
            {cat.name}
          </div>
          {cat.keys.map(({ key, label }) => (
            <ConfigKeyRow
              key={key}
              configKey={key}
              label={label}
              baseValue={config?.[key]}
              overrideValue={overrides?.[key]}
              onSave={handleSave}
              saving={savingKey === key}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

const INPUT = { width: '100%', padding: '6px 8px', background: 'var(--bg4)', border: '1px solid var(--border2)', borderRadius: 4, color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'Inter, sans-serif', boxSizing: 'border-box' };
const BTN = { padding: '6px 12px', background: 'var(--bg4)', border: '1px solid var(--border2)', borderRadius: 4, color: 'var(--text2)', fontSize: 13, cursor: 'pointer', fontFamily: 'Inter, sans-serif' };
const BTN_PRIMARY = { ...BTN, color: 'var(--gold)', borderColor: 'var(--gold)' };
const PRE = { margin: 0, padding: '6px 8px', background: 'var(--bg4)', border: '1px solid var(--border2)', borderRadius: 4, color: 'var(--text2)', fontSize: 11, overflowX: 'auto', maxHeight: 200, whiteSpace: 'pre-wrap', wordBreak: 'break-word' };
