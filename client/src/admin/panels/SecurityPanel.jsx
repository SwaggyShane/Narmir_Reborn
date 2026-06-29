import React, { useEffect, useState } from 'react';

const SEVERITIES = ['all', 'critical', 'high', 'medium', 'low', 'info'];

const SEVERITY_COLORS = {
  critical: 'var(--red, #e55)',
  high:     '#e98',
  medium:   'var(--gold)',
  low:      'var(--text2)',
  info:     'var(--text3)',
};

const DEFAULT_SCHEDULE = {
  enabled: true,
  frequency: 'weekly',
  dayOfWeek: 'monday',
  runTime: '03:00',
  scope: 'full-repo',
  note: 'Run the deep audit after the weekly content freeze.',
};

const SCHEDULE_KEY = 'narmir_security_audit_schedule';
const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const FREQUENCIES = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Every 2 weeks' },
  { value: 'monthly', label: 'Monthly' },
];

export default function SecurityPanel({ adminFetch, onToast }) {
  const [running, setRunning]     = useState(false);
  const [result, setResult]       = useState(null);
  const [filter, setFilter]       = useState('all');
  const [schedule, setSchedule]   = useState(DEFAULT_SCHEDULE);
  const [savedAt, setSavedAt]     = useState(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SCHEDULE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        setSchedule((prev) => ({ ...prev, ...parsed }));
        setSavedAt(parsed.savedAt || null);
      }
    } catch {
      /* ignore local draft parse issues */
    }
  }, []);

  async function handleRunAudit() {
    if (!window.confirm('Run the security audit? This scans source files and may take up to 30 seconds.')) return;
    setRunning(true);
    setResult(null);
    try {
      const data = await adminFetch('/api/admin/security-audit', { method: 'POST', body: {} });
      if (!data || data.error) { onToast('Audit failed: ' + (data?.error || 'No data returned'), 'error'); return; }
      setResult(data);
      const s = data.summary || {};
      onToast(`Audit complete — ${s.critical || 0} critical, ${s.high || 0} high, ${s.medium || 0} medium`, data.success ? 'success' : 'error');
    } catch (err) { onToast('Audit failed: ' + (err.message || 'Unknown'), 'error'); }
    finally { setRunning(false); }
  }

  function handleSaveSchedule() {
    const payload = { ...schedule, savedAt: new Date().toISOString() };
    localStorage.setItem(SCHEDULE_KEY, JSON.stringify(payload));
    setSavedAt(payload.savedAt);
    onToast('Audit schedule draft saved locally', 'success');
  }

  function handleResetSchedule() {
    localStorage.removeItem(SCHEDULE_KEY);
    setSchedule(DEFAULT_SCHEDULE);
    setSavedAt(null);
    onToast('Audit schedule draft reset', 'info');
  }

  const findings = result?.findings || [];
  const filtered = filter === 'all' ? findings : findings.filter(f => (f.severity || '').toLowerCase() === filter);
  const previewLabel = schedule.enabled
    ? `${schedule.frequency} on ${schedule.dayOfWeek} at ${schedule.runTime}`
    : 'Disabled';

  return (
    <div>
      <div style={{ marginBottom: 20, padding: 14, border: '1px solid var(--border2)', borderRadius: 8, background: 'var(--bg3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text1)' }}>Weekly Deep Audit Schedule</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
              Draft UI only for now. Backend schedule tables and cron wiring will plug into this form later.
            </div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text3)', alignSelf: 'flex-start' }}>
            {savedAt ? `Saved ${new Date(savedAt).toLocaleString()}` : 'Unsaved draft'}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 10 }}>
          <label style={FIELD}>
            <span style={LABEL}>Enabled</span>
            <input
              type="checkbox"
              checked={schedule.enabled}
              onChange={(e) => setSchedule((prev) => ({ ...prev, enabled: e.target.checked }))}
              style={{ width: 18, height: 18, accentColor: 'var(--gold)' }}
            />
          </label>
          <label style={FIELD}>
            <span style={LABEL}>Cadence</span>
            <select
              value={schedule.frequency}
              onChange={(e) => setSchedule((prev) => ({ ...prev, frequency: e.target.value }))}
              style={INPUT}
            >
              {FREQUENCIES.map((freq) => (
                <option key={freq.value} value={freq.value}>{freq.label}</option>
              ))}
            </select>
          </label>
          <label style={FIELD}>
            <span style={LABEL}>Day</span>
            <select
              value={schedule.dayOfWeek}
              onChange={(e) => setSchedule((prev) => ({ ...prev, dayOfWeek: e.target.value }))}
              style={INPUT}
            >
              {WEEKDAYS.map((day) => (
                <option key={day} value={day}>{day}</option>
              ))}
            </select>
          </label>
          <label style={FIELD}>
            <span style={LABEL}>Time</span>
            <input
              type="time"
              value={schedule.runTime}
              onChange={(e) => setSchedule((prev) => ({ ...prev, runTime: e.target.value }))}
              style={INPUT}
            />
          </label>
          <label style={FIELD}>
            <span style={LABEL}>Scope</span>
            <select
              value={schedule.scope}
              onChange={(e) => setSchedule((prev) => ({ ...prev, scope: e.target.value }))}
              style={INPUT}
            >
              <option value="full-repo">Full repo</option>
              <option value="server">Server only</option>
              <option value="client">Client only</option>
              <option value="docs">Docs only</option>
            </select>
          </label>
        </div>

        <label style={{ display: 'block', marginBottom: 10 }}>
          <span style={LABEL}>Audit note</span>
          <textarea
            value={schedule.note}
            onChange={(e) => setSchedule((prev) => ({ ...prev, note: e.target.value }))}
            style={{ ...INPUT, minHeight: 74, resize: 'vertical' }}
            placeholder="Optional note for the next audit run"
          />
        </label>

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>
            Preview: <strong style={{ color: 'var(--text2)' }}>{previewLabel}</strong>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={handleSaveSchedule} style={BTN_PRIMARY}>Save Draft</button>
            <button onClick={handleResetSchedule} style={BTN}>Reset</button>
          </div>
        </div>
      </div>

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
const FIELD = { display: 'grid', gap: 6, alignContent: 'start' };
const LABEL = { fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.04em' };
const INPUT = { width: '100%', padding: '6px 8px', background: 'var(--bg4)', border: '1px solid var(--border2)', borderRadius: 4, color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'Inter, sans-serif', boxSizing: 'border-box' };
