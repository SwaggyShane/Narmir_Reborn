import React, { useState } from 'react';

const SEVERITIES = ['all', 'critical', 'high', 'medium', 'low', 'info'];

const SEVERITY_COLORS = {
  critical: 'var(--red, #e55)',
  high:     '#e98',
  medium:   'var(--gold)',
  low:      'var(--text2)',
  info:     'var(--text3)',
};

export default function SecurityPanel({ adminFetch, onToast }) {
  const [running, setRunning]     = useState(false);
  const [result, setResult]       = useState(null);
  const [filter, setFilter]       = useState('all');

  async function handleRunAudit() {
    if (!window.confirm('Run the security audit? This scans source files and may take up to 30 seconds.')) return;
    setRunning(true);
    setResult(null);
    try {
      const data = await adminFetch('/api/admin/security-audit', { method: 'POST', body: {} });
      if (data?.error) { onToast('Audit failed: ' + data.error, 'error'); return; }
      setResult(data);
      const s = data.summary || {};
      onToast(`Audit complete — ${s.critical || 0} critical, ${s.high || 0} high, ${s.medium || 0} medium`, data.success ? 'success' : 'error');
    } catch (err) { onToast('Audit failed: ' + (err.message || 'Unknown'), 'error'); }
    finally { setRunning(false); }
  }

  const findings = result?.findings || [];
  const filtered = filter === 'all' ? findings : findings.filter(f => (f.severity || '').toLowerCase() === filter);

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        <button onClick={handleRunAudit} disabled={running} style={{ ...BTN_PRIMARY, fontWeight: 600 }}>
          {running ? 'Running audit...' : 'Run Security Audit'}
        </button>
        {running && <span style={{ color: 'var(--text3)', fontSize: 13 }}>Scanning source files, please wait...</span>}
      </div>

      {result && (
        <>
          {/* Summary row */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
            {['critical', 'high', 'medium', 'low', 'info'].map(sev => (
              <div key={sev} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: SEVERITY_COLORS[sev] }}>{result.summary?.[sev] ?? 0}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase' }}>{sev}</div>
              </div>
            ))}
            <div style={{ marginLeft: 'auto', color: 'var(--text3)', fontSize: 11, alignSelf: 'flex-end' }}>
              {result.timestamp ? new Date(result.timestamp).toLocaleString() : ''}
            </div>
          </div>

          {/* Filter buttons */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 12, flexWrap: 'wrap' }}>
            {SEVERITIES.map(sev => (
              <button
                key={sev}
                onClick={() => setFilter(sev)}
                style={{
                  ...BTN,
                  fontSize: 11,
                  padding: '3px 10px',
                  color: filter === sev ? (SEVERITY_COLORS[sev] || 'var(--gold)') : 'var(--text3)',
                  borderColor: filter === sev ? (SEVERITY_COLORS[sev] || 'var(--gold)') : 'var(--border2)',
                }}
              >
                {sev} {sev !== 'all' ? `(${result.summary?.[sev] ?? 0})` : ''}
              </button>
            ))}
          </div>

          {/* Findings table */}
          {filtered.length === 0 ? (
            <div style={{ color: 'var(--text3)', fontSize: 13, padding: '8px 0' }}>
              {findings.length === 0 ? 'No findings.' : `No ${filter} findings.`}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={TABLE}>
                <thead><tr>
                  {['Severity', 'Type', 'File', 'Line', 'Message'].map(h => <th key={h} style={TH}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {filtered.map((f, i) => {
                    const sev = (f.severity || 'info').toLowerCase();
                    return (
                      <tr key={i}>
                        <td style={{ ...TD, color: SEVERITY_COLORS[sev] || 'var(--text2)', fontWeight: 600, textTransform: 'uppercase', fontSize: 11 }}>
                          {sev}
                        </td>
                        <td style={TD}>{f.type || f.category || '-'}</td>
                        <td style={{ ...TD, fontFamily: 'monospace', fontSize: 11 }}>{f.file || '-'}</td>
                        <td style={TD}>{f.line ?? '-'}</td>
                        <td style={{ ...TD, whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxWidth: 500 }}>
                          {f.message || f.description || '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const BTN = { padding: '6px 12px', background: 'var(--bg4)', border: '1px solid var(--border2)', borderRadius: 4, color: 'var(--text2)', fontSize: 13, cursor: 'pointer', fontFamily: 'Inter, sans-serif' };
const BTN_PRIMARY = { ...BTN, color: 'var(--gold)', borderColor: 'var(--gold)' };
const TABLE = { width: '100%', borderCollapse: 'collapse', fontSize: 12, color: 'var(--text2)' };
const TH = { padding: '6px 8px', textAlign: 'left', borderBottom: '1px solid var(--border2)', color: 'var(--text3)', fontWeight: 600, whiteSpace: 'nowrap' };
const TD = { padding: '5px 8px', borderBottom: '1px solid var(--border3, #2a2a2a)', whiteSpace: 'nowrap' };
