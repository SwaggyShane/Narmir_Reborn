import React, { useState, useEffect, useCallback } from 'react';
import AdminStatGrid from './AdminStatGrid.jsx';
import AdminTabNav, { ADMIN_TABS } from './AdminTabNav.jsx';
import AdminToast from './AdminToast.jsx';
import { useAdminSession } from './hooks/useAdminSession.js';
import KingdomsPanel from './panels/KingdomsPanel.jsx';
import ManagePanel from './panels/ManagePanel.jsx';
import EventsPanel from './panels/EventsPanel.jsx';
import LorePanel from './panels/LorePanel.jsx';
import GoalsPanel from './panels/GoalsPanel.jsx';
import EvolutionPanel from './panels/EvolutionPanel.jsx';
import ConfigPanel from './panels/ConfigPanel.jsx';
import SoundsPanel from './panels/SoundsPanel.jsx';
import PrestigePanel from './panels/PrestigePanel.jsx';
import FragmentsPanel from './panels/FragmentsPanel.jsx';
import SecurityPanel from './panels/SecurityPanel.jsx';

const PHASE_LABELS = {};

export default function AdminShell({ adminUser, onLogout }) {
  const [stats, setStats]           = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [activeTab, setActiveTab]   = useState('kingdoms');
  const [toast, setToast]           = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const { adminFetch } = useAdminSession({ onUnauthorized: onLogout });

  const loadStats = useCallback(async () => {
    try {
      const data = await adminFetch('/api/admin/stats');
      if (data?.error) {
        setToast({ msg: 'Stats error: ' + data.error, type: 'error' });
      } else if (data) {
        setStats(data);
      }
    } catch (err) {
      setToast({ msg: 'Failed to load stats: ' + (err.message || 'Unknown error'), type: 'error' });
    } finally {
      setStatsLoading(false);
    }
  }, [adminFetch]);

  useEffect(() => { loadStats(); }, [loadStats]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setStatsLoading(true);
    await loadStats();
    setRefreshing(false);
  }, [loadStats]);

  const activeTabMeta = ADMIN_TABS.find(t => t.id === activeTab);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'Inter, sans-serif' }}>

      {/* Topbar */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '12px 20px', background: 'var(--bg2)',
        borderBottom: '1px solid var(--border2)', gap: 12, flexWrap: 'wrap',
      }}>
        <h1 style={{ margin: 0, fontSize: 18, fontFamily: 'Cinzel, serif', color: 'var(--gold)', letterSpacing: 2 }}>
          NARMIR ADMIN
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            style={BTN}
            title="Refresh stats"
          >
            {refreshing ? '…' : '↻'} Refresh
          </button>
          <a href="/game" style={LINK_BTN}>← Game</a>
          <span style={{ color: 'var(--text3)', fontSize: 13 }}>{adminUser}</span>
          <button onClick={onLogout} style={{ ...BTN, background: 'var(--bg4)', color: 'var(--red)', borderColor: 'var(--red)' }}>
            Logout
          </button>
        </div>
      </div>

      {/* Main content */}
      <div style={{ padding: '20px 20px 40px' }}>
        <div style={{
          marginBottom: 16, padding: '10px 14px', borderRadius: 6,
          background: 'rgba(var(--theme-rgb, 240, 98, 2), 0.08)',
          border: '1px solid var(--border2)', fontSize: 12, color: 'var(--text2)',
          display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center',
        }}>
          <span>React admin (soft cutover). Report issues or use legacy fallback:</span>
          <a href="/admin?legacy=1" style={{ color: 'var(--gold)', fontWeight: 600 }}>/admin?legacy=1</a>
        </div>
        <AdminStatGrid stats={stats} loading={statsLoading} />
        <AdminTabNav activeTab={activeTab} onTabChange={setActiveTab} />

        {/* Tab content */}
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: '20px 24px' }}>
          {activeTab === 'kingdoms' ? (
            <KingdomsPanel
              adminFetch={adminFetch}
              onToast={(msg, type) => setToast({ msg, type: type || 'info' })}
            />
          ) : activeTab === 'manage' ? (
            <ManagePanel
              adminFetch={adminFetch}
              onToast={(msg, type) => setToast({ msg, type: type || 'info' })}
            />
          ) : activeTab === 'events' ? (
            <EventsPanel
              adminFetch={adminFetch}
              onToast={(msg, type) => setToast({ msg, type: type || 'info' })}
            />
          ) : activeTab === 'lore' ? (
            <LorePanel
              adminFetch={adminFetch}
              onToast={(msg, type) => setToast({ msg, type: type || 'info' })}
            />
          ) : activeTab === 'goals' ? (
            <GoalsPanel
              adminFetch={adminFetch}
              onToast={(msg, type) => setToast({ msg, type: type || 'info' })}
            />
          ) : activeTab === 'changelog' ? (
            <EvolutionPanel
              adminFetch={adminFetch}
              onToast={(msg, type) => setToast({ msg, type: type || 'info' })}
            />
          ) : activeTab === 'config' ? (
            <ConfigPanel
              adminFetch={adminFetch}
              onToast={(msg, type) => setToast({ msg, type: type || 'info' })}
            />
          ) : activeTab === 'sounds' ? (
            <SoundsPanel
              adminFetch={adminFetch}
              onToast={(msg, type) => setToast({ msg, type: type || 'info' })}
            />
          ) : activeTab === 'prestige' ? (
            <PrestigePanel />
          ) : activeTab === 'fragments' ? (
            <FragmentsPanel
              adminFetch={adminFetch}
              onToast={(msg, type) => setToast({ msg, type: type || 'info' })}
            />
          ) : activeTab === 'security' ? (
            <SecurityPanel
              adminFetch={adminFetch}
              onToast={(msg, type) => setToast({ msg, type: type || 'info' })}
            />
          ) : (
            <div style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 14, padding: '12px 0' }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>{activeTabMeta?.icon}</div>
              <div style={{ color: 'var(--text2)', fontSize: 16, marginBottom: 6 }}>{activeTabMeta?.label}</div>
              <div>Coming in {PHASE_LABELS[activeTab] ?? 'a future phase'}.</div>
            </div>
          )}
        </div>
      </div>

      {toast && (
        <AdminToast
          message={toast.msg}
          type={toast.type}
          onDismiss={() => setToast(null)}
        />
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

const LINK_BTN = {
  padding: '6px 12px', background: 'var(--bg4)',
  border: '1px solid var(--border2)', borderRadius: 4,
  color: 'var(--text2)', fontSize: 13, textDecoration: 'none',
  fontFamily: 'Inter, sans-serif',
};
