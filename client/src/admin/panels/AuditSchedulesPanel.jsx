import React, { useState, useEffect } from 'react';

const FREQUENCIES = ['daily', 'weekly', 'monthly'];

function AuditSchedulesPanel({ adminFetch, onToast }) {
  const [schedules, setSchedules] = useState([]);
  const [history, setHistory] = useState([]);
  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState({ frequency: 'weekly' });

  useEffect(() => {
    if (adminFetch) {
      loadSchedules();
      loadHistory();
    }
  }, [adminFetch]);

  const loadSchedules = async () => {
    try {
      const data = await adminFetch('/api/admin/audit-schedules');
      setSchedules(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load schedules:', err);
      onToast?.('Failed to load schedules: ' + (err.message || err), 'error');
    }
  };

  const loadHistory = async () => {
    try {
      const data = await adminFetch('/api/admin/audit-history');
      setHistory(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load history:', err);
      onToast?.('Failed to load history: ' + (err.message || err), 'error');
    }
  };

  const handleCreateSchedule = async () => {
    if (!formData.frequency) return;
    setCreating(true);
    try {
      await adminFetch('/api/admin/audit-schedules', {
        method: 'POST',
        body: { frequency: formData.frequency }
      });
      setFormData({ frequency: 'weekly' });
      onToast?.('Schedule created successfully', 'success');
      await loadSchedules();
    } catch (err) {
      console.error('Failed to create schedule:', err);
      onToast?.('Failed to create schedule: ' + (err.message || err), 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleToggleSchedule = async (id, isEnabled) => {
    try {
      await adminFetch(`/api/admin/audit-schedules/${id}`, {
        method: 'PUT',
        body: { is_enabled: isEnabled ? 0 : 1 }
      });
      onToast?.(`Schedule ${isEnabled ? 'disabled' : 'enabled'} successfully`, 'success');
      await loadSchedules();
    } catch (err) {
      console.error('Failed to toggle schedule:', err);
      onToast?.('Failed to toggle schedule: ' + (err.message || err), 'error');
    }
  };

  const handleRunAudit = async (id) => {
    try {
      await adminFetch(`/api/admin/audit-schedules/${id}/run`, { method: 'POST' });
      onToast?.('Audit run triggered successfully', 'success');
      await loadSchedules();
      await loadHistory();
    } catch (err) {
      console.error('Failed to run audit:', err);
      onToast?.('Failed to run audit: ' + (err.message || err), 'error');
    }
  };

  return (
    <div style={{ padding: '16px', color: 'var(--text)' }}>
      <h2 style={{ marginTop: 0, marginBottom: '16px', fontSize: '18px' }}>📋 Audit Schedules</h2>

      {/* Create Schedule Form */}
      <div style={{
        marginBottom: '24px',
        padding: '12px',
        background: 'var(--bg2)',
        border: '1px solid var(--border2)',
        borderRadius: '6px'
      }}>
        <div style={{ marginBottom: '12px', fontSize: '13px', fontWeight: 500 }}>Create New Schedule</div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <select
            value={formData.frequency}
            onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
            style={{
              padding: '6px 8px',
              background: 'var(--bg3)',
              border: '1px solid var(--border2)',
              color: 'var(--text)',
              borderRadius: '4px',
              fontSize: '12px'
            }}
          >
            {FREQUENCIES.map(f => (
              <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>
            ))}
          </select>
          <button
            onClick={handleCreateSchedule}
            disabled={creating}
            style={{
              padding: '6px 12px',
              background: 'var(--accent1)',
              border: 'none',
              color: 'white',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 500
            }}
          >
            {creating ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>

      {/* Schedules List */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '8px' }}>Active Schedules</div>
        {schedules.length === 0 ? (
          <div style={{ fontSize: '12px', color: 'var(--text3)', padding: '12px' }}>No schedules configured</div>
        ) : (
          <div style={{ display: 'grid', gap: '8px' }}>
            {schedules.map(schedule => (
              <div
                key={schedule.id}
                style={{
                  padding: '12px',
                  background: schedule.is_enabled ? 'var(--bg2)' : 'var(--bg3)',
                  border: '1px solid var(--border2)',
                  borderRadius: '4px',
                  display: 'grid',
                  gridTemplateColumns: 'auto 1fr auto auto',
                  gap: '12px',
                  alignItems: 'center',
                  opacity: schedule.is_enabled ? 1 : 0.6
                }}
              >
                <div style={{ fontSize: '11px', color: 'var(--text3)', minWidth: '60px' }}>
                  {schedule.frequency.toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: '12px' }}>
                    Last run: {schedule.last_run_at ? new Date(schedule.last_run_at * 1000).toLocaleString() : 'Never'}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text3)' }}>
                    Next run: {schedule.next_run_at ? new Date(schedule.next_run_at * 1000).toLocaleString() : 'Pending'}
                  </div>
                </div>
                <button
                  onClick={() => handleRunAudit(schedule.id)}
                  style={{
                    padding: '4px 8px',
                    background: 'var(--gold)',
                    border: 'none',
                    color: 'black',
                    borderRadius: '3px',
                    fontSize: '11px',
                    fontWeight: 500,
                    cursor: 'pointer'
                  }}
                >
                  Run Now
                </button>
                <button
                  onClick={() => handleToggleSchedule(schedule.id, schedule.is_enabled)}
                  style={{
                    padding: '4px 8px',
                    background: schedule.is_enabled ? 'var(--red)' : 'var(--green)',
                    border: 'none',
                    color: 'white',
                    borderRadius: '3px',
                    fontSize: '11px',
                    fontWeight: 500,
                    cursor: 'pointer'
                  }}
                >
                  {schedule.is_enabled ? 'Disable' : 'Enable'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Audit History */}
      <div>
        <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '8px' }}>Recent Audit Runs</div>
        {history.length === 0 ? (
          <div style={{ fontSize: '12px', color: 'var(--text3)', padding: '12px' }}>No audit runs yet</div>
        ) : (
          <div style={{ display: 'grid', gap: '6px' }}>
            {history.map(run => (
              <div
                key={run.id}
                style={{
                  padding: '10px',
                  background: run.status === 'success' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                  border: `1px solid ${run.status === 'success' ? 'var(--green)' : 'var(--red)'}`,
                  borderRadius: '4px',
                  display: 'grid',
                  gridTemplateColumns: 'auto 1fr auto',
                  gap: '12px',
                  alignItems: 'center',
                  fontSize: '12px'
                }}
              >
                <div style={{
                  minWidth: '60px',
                  color: run.status === 'success' ? 'var(--green)' : 'var(--red)'
                }}>
                  {run.status.toUpperCase()}
                </div>
                <div>
                  <div>{new Date(run.run_at * 1000).toLocaleString()}</div>
                  {run.error_message && (
                    <div style={{ fontSize: '11px', color: 'var(--red)' }}>{run.error_message}</div>
                  )}
                  {run.findings_count > 0 && (
                    <div style={{ fontSize: '11px', color: 'var(--text3)' }}>
                      Found {run.findings_count} issues
                    </div>
                  )}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text3)' }}>
                  {run.duration_ms}ms
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default AuditSchedulesPanel;
