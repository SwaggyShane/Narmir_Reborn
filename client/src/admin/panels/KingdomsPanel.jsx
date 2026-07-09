import React, { useState, useEffect, useCallback } from 'react';
import AdminDataTable from '../components/AdminDataTable.jsx';
import KingdomEditModal from './KingdomEditModal.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import AiKingdomPanel from './AiKingdomPanel.jsx';

export default function KingdomsPanel({ adminFetch, onToast }) {
  const [kingdoms, setKingdoms]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [hiatus, setHiatus]         = useState(false);
  const [hiatusLoading, setHiatusLoading] = useState(false);

  // Modal state
  const [editTarget, setEditTarget]   = useState(null); // kingdom row for edit modal
  const [confirm, setConfirm]         = useState(null); // { title, message, onConfirm }

  // Load kingdoms list + AI hiatus status
  const loadKingdoms = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminFetch('/api/admin/kingdoms');
      if (data?.error) { onToast('Kingdoms error: ' + data.error, 'error'); return; }
      if (Array.isArray(data)) setKingdoms(data);
    } catch (err) {
      onToast('Failed to load kingdoms: ' + (err.message || 'Unknown error'), 'error');
    } finally {
      setLoading(false);
    }
  }, [adminFetch, onToast]);

  const loadHiatus = useCallback(async () => {
    try {
      const data = await adminFetch('/api/admin/ai-hiatus');
      if (data && !data.error) setHiatus(!!data.hiatus);
    } catch { /* non-critical */ }
  }, [adminFetch]);

  useEffect(() => {
    loadKingdoms();
    loadHiatus();
  }, [loadKingdoms, loadHiatus]);

  // ─── Per-row actions ──────────────────────────────────────────────────────

  function handleEdit(k) { setEditTarget(k); }

  function handleReset(k) {
    setConfirm({
      title: 'Reset Kingdom',
      message: `Reset "${k.name}" back to starting stats? This wipes resources, troops, and buildings but preserves identity.`,
      onConfirm: async () => {
        try {
          setConfirm(null);
          const data = await adminFetch('/api/admin/reset-kingdom', { method: 'POST', body: { kingdomId: k.id } });
          if (!data) {
            onToast('Reset failed: No response from server', 'error');
            return;
          }
          if (data.error) {
            onToast('Reset failed: ' + data.error, 'error');
            return;
          }
          onToast(`Reset "${k.name}"`, 'success');
          await loadKingdoms();
        } catch (err) {
          onToast('Reset failed: ' + (err.message || 'Unknown error'), 'error');
        }
      },
    });
  }

  async function handleResetTurns(k) {
    try {
      const data = await adminFetch('/api/admin/reset-turns', { method: 'POST', body: { kingdomId: k.id } });
      if (!data) {
        onToast('+Turns failed: No response from server', 'error');
        return;
      }
      if (data.error) {
        onToast('+Turns failed: ' + data.error, 'error');
        return;
      }
      onToast(`+Turns added to "${k.name}"`, 'success');
      setKingdoms(prev => prev.map(r => r.id === k.id ? { ...r, turns_stored: 400 } : r));
    } catch (err) {
      onToast('+Turns failed: ' + (err.message || 'Unknown error'), 'error');
    }
  }

  function handleBan(k) {
    let reason = '';
    setConfirm({
      title: 'Ban Player',
      message: `Ban player "${k.username}"? This blocks their access to the game. You can unban later.`,
      input: { label: 'Reason (optional)', onChange: v => { reason = v; } },
      onConfirm: async () => {
        try {
          setConfirm(null);
          const data = await adminFetch('/api/admin/ban', { method: 'POST', body: { playerId: k.player_id, reason: reason || 'Banned by admin' } });
          if (!data) {
            onToast('Ban failed: No response from server', 'error');
            return;
          }
          if (data.error) {
            onToast('Ban failed: ' + data.error, 'error');
            return;
          }
          onToast(`Banned "${k.username}"`, 'success');
          setKingdoms(prev => prev.map(r => r.player_id === k.player_id ? { ...r, is_banned: 1 } : r));
        } catch (err) {
          onToast('Ban failed: ' + (err.message || 'Unknown error'), 'error');
        }
      },
    });
  }

  async function handleUnban(k) {
    try {
      const data = await adminFetch('/api/admin/unban', { method: 'POST', body: { playerId: k.player_id } });
      if (!data) {
        onToast('Unban failed: No response from server', 'error');
        return;
      }
      if (data.error) {
        onToast('Unban failed: ' + data.error, 'error');
        return;
      }
      onToast(`Unbanned "${k.username}"`, 'success');
      setKingdoms(prev => prev.map(r => r.player_id === k.player_id ? { ...r, is_banned: 0 } : r));
    } catch (err) {
      onToast('Unban failed: ' + (err.message || 'Unknown error'), 'error');
    }
  }

  function handleDelete(k) {
    setConfirm({
      title: 'Delete Kingdom',
      message: `Permanently delete "${k.name}" (player: ${k.username})? This cannot be undone.`,
      onConfirm: async () => {
        try {
          setConfirm(null);
          const data = await adminFetch(`/api/admin/kingdom/${k.id}`, { method: 'DELETE' });
          if (!data) {
            onToast('Delete failed: No response from server', 'error');
            return;
          }
          if (data.error) {
            onToast('Delete failed: ' + data.error, 'error');
            return;
          }
          onToast(`Deleted "${k.name}"`, 'success');
          setKingdoms(prev => prev.filter(r => r.id !== k.id));
        } catch (err) {
          onToast('Delete failed: ' + (err.message || 'Unknown error'), 'error');
        }
      },
    });
  }

  // ─── Bulk actions ─────────────────────────────────────────────────────────

  function handleResetAllTurns() {
    setConfirm({
      title: 'Reset All Turns',
      message: `Give all ${kingdoms.length} kingdoms 400 turns? This applies to every kingdom on the server.`,
      onConfirm: async () => {
        setConfirm(null);
        const data = await adminFetch('/api/admin/reset-turns-all', { method: 'POST' });
        if (data?.error) { onToast('Reset all turns failed: ' + data.error, 'error'); return; }
        onToast('All kingdoms given 400 turns', 'success');
        setKingdoms(prev => prev.map(r => ({ ...r, turns_stored: 400 })));
      },
    });
  }

  async function handleHiatusToggle() {
    setHiatusLoading(true);
    try {
      const data = await adminFetch('/api/admin/ai-hiatus', { method: 'POST', body: { hiatus: !hiatus } });
      if (data?.error) { onToast('Hiatus toggle failed: ' + data.error, 'error'); return; }
      setHiatus(!hiatus);
      onToast(`AI hiatus ${!hiatus ? 'enabled' : 'disabled'}`, 'success');
    } catch (err) {
      onToast('Hiatus toggle failed: ' + (err.message || 'Unknown error'), 'error');
    } finally {
      setHiatusLoading(false);
    }
  }

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
        <button onClick={loadKingdoms} style={BTN} disabled={loading}>
          {loading ? '…' : '↻'} Refresh
        </button>
        <button onClick={handleResetAllTurns} style={BTN} disabled={loading}>
          +Turns All
        </button>
        <button
          onClick={handleHiatusToggle}
          disabled={hiatusLoading}
          style={{ ...BTN, color: hiatus ? 'var(--amber)' : 'var(--text2)', borderColor: hiatus ? 'var(--amber)' : 'var(--border2)' }}
        >
          AI Hiatus: {hiatusLoading ? '…' : hiatus ? 'ON' : 'OFF'}
        </button>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text3)' }}>
          {kingdoms.length} kingdoms
        </span>
      </div>

      {/* Table */}
      <AdminDataTable
        kingdoms={kingdoms}
        loading={loading}
        onEdit={handleEdit}
        onReset={handleReset}
        onResetTurns={handleResetTurns}
        onBan={handleBan}
        onUnban={handleUnban}
        onDelete={handleDelete}
      />

      {/* Edit modal */}
      {editTarget && (
        <KingdomEditModal
          kingdomRow={editTarget}
          adminFetch={adminFetch}
          onClose={() => setEditTarget(null)}
          onSaved={msg => { onToast(msg, 'success'); loadKingdoms(); }}
        />
      )}

      {/* Confirm dialog */}
      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          message={confirm.message}
          input={confirm.input}
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}

      {/* AI kingdoms section */}
      <AiKingdomPanel adminFetch={adminFetch} onToast={onToast} />
    </div>
  );
}

const BTN = {
  padding: '6px 12px', background: 'var(--bg4)',
  border: '1px solid var(--border2)', borderRadius: 4,
  color: 'var(--text2)', fontSize: 13, cursor: 'pointer',
  fontFamily: 'Inter, sans-serif',
};
