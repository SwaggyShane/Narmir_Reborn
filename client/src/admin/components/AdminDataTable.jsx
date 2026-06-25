import React, { useState, useMemo } from 'react';

const RACE_DISPLAY = r => (r || '').replace(/_/g, ' ');

export default function AdminDataTable({ kingdoms, loading, onEdit, onReset, onResetTurns, onBan, onUnban, onDelete }) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    if (!query.trim()) return kingdoms;
    const q = query.toLowerCase();
    return kingdoms.filter(k =>
      k.name.toLowerCase().includes(q) ||
      k.username.toLowerCase().includes(q) ||
      (k.race || '').toLowerCase().includes(q),
    );
  }, [kingdoms, query]);

  return (
    <div>
      <input
        type="text"
        placeholder="Search by name, user, or race…"
        value={query}
        onChange={e => setQuery(e.target.value)}
        style={SEARCH}
      />

      {loading ? (
        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text3)', fontSize: 14 }}>Loading kingdoms…</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text3)', fontSize: 14 }}>
          {kingdoms.length === 0 ? 'No kingdoms found.' : 'No results for "' + query + '"'}
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={TABLE}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border2)' }}>
                {['Kingdom', 'Player', 'Race', 'Land', 'Gold', 'Turns', 'Status', 'Actions'].map(h => (
                  <th key={h} style={TH}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(k => (
                <tr key={k.id} style={TR}>
                  <td style={{ ...TD, color: 'var(--text)', fontWeight: 500 }}>{k.name}</td>
                  <td style={TD}>
                    {k.username}
                    {k.is_admin ? <span style={BADGE_GOLD}>Admin</span> : null}
                  </td>
                  <td style={{ ...TD, color: 'var(--text3)' }}>{RACE_DISPLAY(k.race)}</td>
                  <td style={TD}>{(k.land || 0).toLocaleString()}</td>
                  <td style={{ ...TD, color: 'var(--gold)' }}>{(k.gold || 0).toLocaleString()}</td>
                  <td style={TD}>{k.turns_stored ?? 0}/400</td>
                  <td style={TD}>
                    <span style={k.is_banned ? BADGE_RED : BADGE_GREEN}>
                      {k.is_banned ? 'Banned' : 'Active'}
                    </span>
                  </td>
                  <td style={{ ...TD, whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      <button style={BTN_GOLD}  onClick={() => onEdit(k)}>Edit</button>
                      <button style={BTN_AMBER} onClick={() => onReset(k)}>Reset</button>
                      <button style={BTN}       onClick={() => onResetTurns(k)}>+Turns</button>
                      {k.is_banned
                        ? <button style={BTN_GREEN} onClick={() => onUnban(k)}>Unban</button>
                        : <button style={BTN_RED}   onClick={() => onBan(k)}>Ban</button>
                      }
                      <button style={BTN_RED} onClick={() => onDelete(k)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text3)' }}>
        {filtered.length} of {kingdoms.length} kingdoms
      </div>
    </div>
  );
}

const SEARCH = {
  width: '100%', padding: '8px 12px', background: 'var(--bg4)',
  border: '1px solid var(--border2)', borderRadius: 4,
  color: 'var(--text)', fontSize: 13, fontFamily: 'Inter, sans-serif',
  outline: 'none', boxSizing: 'border-box', marginBottom: 12,
};

const TABLE = { width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: 'Inter, sans-serif' };
const TH = { padding: '8px 10px', textAlign: 'left', color: 'var(--text3)', fontWeight: 500, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, whiteSpace: 'nowrap' };
const TD = { padding: '8px 10px', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' };
const TR = { transition: 'background 0.1s' };

const BADGE = { display: 'inline-block', padding: '2px 6px', borderRadius: 3, fontSize: 11, fontWeight: 500, marginLeft: 4 };
const BADGE_GOLD  = { ...BADGE, background: 'rgba(212,175,55,0.15)', color: 'var(--gold)', border: '1px solid var(--gold)' };
const BADGE_GREEN = { ...BADGE, background: 'rgba(34,197,94,0.15)',  color: 'var(--green)', border: '1px solid var(--green)' };
const BADGE_RED   = { ...BADGE, background: 'rgba(239,68,68,0.15)',  color: 'var(--red)',   border: '1px solid var(--red)' };

const BTN_BASE = { padding: '4px 8px', borderRadius: 3, fontSize: 12, fontFamily: 'Inter, sans-serif', cursor: 'pointer', border: '1px solid', whiteSpace: 'nowrap' };
const BTN       = { ...BTN_BASE, background: 'var(--bg4)',  borderColor: 'var(--border2)', color: 'var(--text2)' };
const BTN_GOLD  = { ...BTN_BASE, background: 'rgba(212,175,55,0.15)', borderColor: 'var(--gold)',  color: 'var(--gold)' };
const BTN_AMBER = { ...BTN_BASE, background: 'rgba(245,158,11,0.15)', borderColor: 'var(--amber)', color: 'var(--amber)' };
const BTN_GREEN = { ...BTN_BASE, background: 'rgba(34,197,94,0.15)',  borderColor: 'var(--green)', color: 'var(--green)' };
const BTN_RED   = { ...BTN_BASE, background: 'rgba(239,68,68,0.15)',  borderColor: 'var(--red)',   color: 'var(--red)' };
