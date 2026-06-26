import React, { useState, useEffect, useCallback } from 'react';
import SpellsReference from './SpellsReference.jsx';

export default function FragmentsPanel({ adminFetch, onToast }) {
  const [subTab, setSubTab] = useState('fragments');
  const [fragments, setFragments] = useState({});
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  const loadFragments = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminFetch('/api/admin/fragments');
      if (data?.error) { onToast('Fragments error: ' + data.error, 'error'); return; }
      if (data && typeof data === 'object') setFragments(data);
    } catch (err) { onToast('Failed to load fragments: ' + (err.message || 'Unknown'), 'error'); }
    finally { setLoading(false); }
  }, [adminFetch, onToast]);

  useEffect(() => {
    if (subTab === 'fragments') loadFragments();
  }, [subTab, loadFragments]);

  const names = Object.keys(fragments);

  return (
    <div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid var(--border2)', paddingBottom: 10 }}>
        {[['fragments', '✨ World Fragments'], ['spells', '🔮 Spells']].map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setSubTab(id)}
            style={{
              ...BTN,
              color: subTab === id ? 'var(--gold)' : 'var(--text3)',
              borderColor: subTab === id ? 'var(--gold)' : 'var(--border2)',
              borderBottom: subTab === id ? '2px solid var(--gold)' : '2px solid transparent',
              borderRadius: '4px 4px 0 0',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {subTab === 'spells' ? (
        <SpellsReference adminFetch={adminFetch} onToast={onToast} />
      ) : (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
            <span style={{ color: 'var(--text3)', fontSize: 13 }}>
              Read-only reference — world fragment bonuses per building type.
            </span>
            <button onClick={loadFragments} style={{ ...BTN, marginLeft: 'auto' }} disabled={loading}>
              {loading ? '...' : 'Refresh'}
            </button>
          </div>

          {loading && <div style={{ color: 'var(--text3)', fontSize: 13 }}>Loading...</div>}

          {!loading && names.length === 0 && (
            <div style={{ color: 'var(--text3)', fontSize: 13 }}>No fragment data found.</div>
          )}

          {names.map(name => {
            const frag = fragments[name];
            const isOpen = expanded === name;
            const buildings = frag?.buildings || {};
            const bldKeys = Object.keys(buildings);

            return (
              <div key={name} style={{ borderBottom: '1px solid var(--border3, #2a2a2a)', padding: '6px 0' }}>
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '4px 0' }}
                  onClick={() => setExpanded(isOpen ? null : name)}
                >
                  <span style={{ fontSize: 11, color: 'var(--text3)', minWidth: 16 }}>{isOpen ? 'v' : '>'}</span>
                  <span style={{ fontSize: 18 }}>{frag?.emoji || ''}</span>
                  <span style={{ fontSize: 13, color: 'var(--text2)', fontWeight: 500, flex: 1 }}>{name}</span>
                  <span style={{ fontSize: 12, color: 'var(--text3)' }}>{bldKeys.length} building bonus{bldKeys.length !== 1 ? 'es' : ''}</span>
                </div>
                {isOpen && (
                  <div style={{ padding: '6px 0 6px 24px' }}>
                    {frag?.description && (
                      <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8, fontStyle: 'italic' }}>{frag.description}</div>
                    )}
                    {bldKeys.length === 0 ? (
                      <div style={{ fontSize: 12, color: 'var(--text3)' }}>No building bonuses.</div>
                    ) : (
                      <div style={{ overflowX: 'auto' }}>
                        <table style={TABLE}>
                          <thead><tr>
                            <th style={TH}>Building</th>
                            <th style={TH}>Bonus</th>
                          </tr></thead>
                          <tbody>
                            {bldKeys.map(bld => (
                              <tr key={bld}>
                                <td style={TD}>{bld}</td>
                                <td style={{ ...TD, color: 'var(--gold)' }}>
                                  {typeof buildings[bld] === 'object'
                                    ? JSON.stringify(buildings[bld])
                                    : String(buildings[bld])}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

const BTN = { padding: '6px 12px', background: 'var(--bg4)', border: '1px solid var(--border2)', borderRadius: 4, color: 'var(--text2)', fontSize: 13, cursor: 'pointer', fontFamily: 'Inter, sans-serif' };
const TABLE = { borderCollapse: 'collapse', fontSize: 12, color: 'var(--text2)' };
const TH = { padding: '5px 10px', textAlign: 'left', borderBottom: '1px solid var(--border2)', color: 'var(--text3)', fontWeight: 600, whiteSpace: 'nowrap' };
const TD = { padding: '4px 10px', borderBottom: '1px solid var(--border3, #2a2a2a)', whiteSpace: 'nowrap' };