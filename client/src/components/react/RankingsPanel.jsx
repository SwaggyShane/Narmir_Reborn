import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { apiCall } from '../../utils/api';
import { useGameState } from '../../hooks/useGameState';

const RACE_ICONS = {
  human: '🧑',
  orc: '👹',
  dwarf: '⛏️',
  dark_elf: '🕸️',
  vampire: '🦇',
  dire_wolf: '🐺',
  high_elf: '🧝',
  wood_elf: '🌿',
  ogre: '👊',
};

const RankingsPanel = () => {
  const { state } = useGameState();
  const [activeTab, setActiveTab] = useState('kingdoms');
  const [search, setSearch] = useState('');
  const [kingdomRows, setKingdomRows] = useState([]);
  const [allianceRows, setAllianceRows] = useState([]);
  const [loadingKingdoms, setLoadingKingdoms] = useState(true);
  const [loadingAlliances, setLoadingAlliances] = useState(true);
  const [error, setError] = useState('');

  const repairText = useCallback((value) => {
    const text = value === null || value === undefined ? '' : String(value);
    return typeof window !== 'undefined' && typeof window.repairMojibake === 'function'
      ? window.repairMojibake(text)
      : text;
  }, []);

  const fmt = useCallback((value) => {
    const n = Number(value || 0);
    return Number.isFinite(n) ? Math.round(n).toLocaleString() : '0';
  }, []);

  const timeAgo = useCallback((unixTs) => {
    if (!unixTs) return '—';
    const secs = Math.floor(Date.now() / 1000) - Number(unixTs || 0);
    if (secs < 60) return 'Just now';
    if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
    if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
    return `${Math.floor(secs / 86400)}d ago`;
  }, []);

  const loadRankings = useCallback(async () => {
    setError('');
    setLoadingKingdoms(true);
    setLoadingAlliances(true);

    try {
      const [kingdomRes, allianceRes] = await Promise.all([
        apiCall('/api/kingdom/rankings'),
        apiCall('/api/kingdom/alliance-rankings'),
      ]);

      if (kingdomRes?.error) throw new Error(kingdomRes.error);
      if (allianceRes?.error) throw new Error(allianceRes.error);

      const kingdoms = Array.isArray(kingdomRes?.rankings) ? kingdomRes.rankings : [];
      const alliances = Array.isArray(allianceRes) ? allianceRes : [];

      setKingdomRows(kingdoms);
      setAllianceRows(alliances);
      window.rankingsCache = kingdoms;
      window.allianceRankingsCache = alliances;
    } catch (err) {
      console.error('[RankingsPanel] Failed to load rankings:', err);
      setError(err.message || 'Failed to load rankings');
    } finally {
      setLoadingKingdoms(false);
      setLoadingAlliances(false);
    }
  }, []);

  useEffect(() => {
    loadRankings();
  }, [loadRankings]);

  const filteredKingdoms = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return kingdomRows;
    return kingdomRows.filter((r) =>
      String(r.name || '').toLowerCase().includes(q) ||
      String(r.username || '').toLowerCase().includes(q),
    );
  }, [kingdomRows, search]);

  const filteredAlliances = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allianceRows;
    return allianceRows.filter((r) => String(r.name || '').toLowerCase().includes(q));
  }, [allianceRows, search]);

  const handleRefresh = () => loadRankings();

  const handleSetRankType = (type) => {
    setActiveTab(type);
  };

  const handleSearch = (event) => {
    setSearch(event.target.value);
  };

  const handleDirectMessage = (row) => window.openDirectMessage?.(row.player_id, row.name);
  const handleProfile = (row) => window.openKingdomProfile?.(row.name);
  const handleBounty = (row) => window.openBountyAction?.(row.id, row.name);
  const handleTarget = (row, mode) => window.targetFromRankings?.(row.id, mode);
  const handleTrade = (row) => window.establishTradeRoute?.(row.id);

  const renderKingdomRow = (row) => {
    const isMe = row.id === state?.kingdomId;
    const disc = state?.discovered_kingdoms || {};
    const isMapped = !!(disc[row.id] && disc[row.id].mapped);
    const raceKey = String(row.race || 'human');
    const raceIcon = RACE_ICONS[raceKey] || '👤';
    const raceName = repairText(raceKey).replace(/_/g, ' ');
    const rowBg = isMe ? { background: 'rgba(180, 60, 0,.08)' } : null;
    const rankBadge = row.rank === 1 ? '👑' : row.rank <= 3 ? '🥈' : '';
    const rankColor = row.rank === 1
      ? { color: 'var(--gold)', fontWeight: 700 }
      : row.rank <= 3
        ? { color: 'var(--amber)' }
        : { color: 'var(--text3)' };
    const nameColor = isMe
      ? { color: 'var(--accent1)', fontWeight: 700 }
      : { color: 'var(--text)', fontWeight: 600 };
    const meTag = isMe ? <span style={{ fontSize: '10px', color: 'var(--accent1)', fontWeight: 400 }}> (you)</span> : null;
    const aiTag = row.is_ai ? <span style={{ fontSize: '10px', color: 'var(--text3)' }}> 🤖</span> : null;
    const protTag = !isMe && (row.turn || 0) < 400
      ? <span style={{ fontSize: '10px', color: 'var(--green)' }} title="Newbie protection — cannot be attacked until Turn 400"> 🛡️</span>
      : null;

    let actionBtns = (
      <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
        <button className="btn" style={{ fontSize: '11px', padding: '3px 8px' }} title="Kingdom Profile" onClick={() => handleProfile(row)}>👤</button>
        <button className="btn btn-accent" style={{ fontSize: '11px', padding: '3px 8px' }} title="Send message" onClick={() => handleDirectMessage(row)}>✉️</button>
      </div>
    );

    if (isMe) {
      actionBtns = (
        <button className="btn btn-accent" style={{ fontSize: '11px', padding: '3px 8px' }} onClick={() => handleDirectMessage(row)}>✉️ Message</button>
      );
    } else if ((row.turn || 0) >= 400) {
      actionBtns = (
        <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
          <button className="btn" style={{ fontSize: '11px', padding: '3px 8px' }} title="Kingdom Profile" onClick={() => handleProfile(row)}>👤</button>
          <button className="btn btn-accent" style={{ fontSize: '11px', padding: '3px 8px' }} title="Send message" onClick={() => handleDirectMessage(row)}>✉️</button>
          {isMapped ? (
            <>
              <button className="btn btn-gold" style={{ fontSize: '11px', padding: '3px 8px' }} title="Place Bounty" onClick={() => handleBounty(row)}>🪙</button>
              <button className="btn btn-red" style={{ fontSize: '11px', padding: '3px 8px' }} onClick={() => handleTarget(row, 'attack')}>⚔️</button>
              <button className="btn btn-accent" style={{ fontSize: '11px', padding: '3px 8px' }} onClick={() => handleTarget(row, 'spells')}>✨</button>
              <button className="btn" style={{ fontSize: '11px', padding: '3px 8px' }} onClick={() => handleTarget(row, 'covert')}>🕵️</button>
              <button className="btn btn-gold" style={{ fontSize: '11px', padding: '3px 8px' }} title="Establish Trade Route" onClick={() => handleTrade(row)}>🤝</button>
            </>
          ) : null}
        </div>
      );
    }

    return (
      <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
        <button className="btn" style={{ fontSize: '11px', padding: '3px 8px' }} title="Kingdom Profile" onClick={() => handleProfile(row)}>👤</button>
        <button className="btn btn-accent" style={{ fontSize: '11px', padding: '3px 8px' }} title="Send message" onClick={() => handleDirectMessage(row)}>✉️</button>
        <span style={{ fontSize: '11px', color: 'var(--green)', marginLeft: '4px' }} title="Protected until Turn 400">🛡️</span>
      </div>
    );
  };

  const kingdomsTable = loadingKingdoms ? (
    <tr><td colSpan="8" style={{ color: 'var(--text3)', fontSize: '13px', textAlign: 'center', padding: '24px 0' }}>Loading rankings...</td></tr>
  ) : error ? (
    <tr><td colSpan="8" style={{ color: 'var(--red)', fontSize: '13px', textAlign: 'center', padding: '24px 0' }}>{error}</td></tr>
  ) : filteredKingdoms.length === 0 ? (
    <tr><td colSpan="8" style={{ color: 'var(--text3)', fontSize: '13px', textAlign: 'center', padding: '24px 0' }}>No kingdoms found.</td></tr>
  ) : filteredKingdoms.map((row) => (
    <tr key={row.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background .15s', ...(row.id === state?.kingdomId ? { background: 'rgba(180, 60, 0,.08)' } : {}) }}>
      <td style={{ padding: '10px 6px', ...(rankColorFor(row.rank)) }}>{row.rank === 1 ? '👑' : row.rank <= 3 ? '🥈' : row.rank}</td>
      <td style={{ padding: '10px 6px', color: 'var(--text2)' }}>{row.username || '—'}</td>
      <td style={{ padding: '10px 6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '18px', flexShrink: 0 }}>{raceIconFor(row.race)}</span>
          <div>
            <div style={{ ...(row.id === state?.kingdomId ? { color: 'var(--accent1)', fontWeight: 700 } : { color: 'var(--text)', fontWeight: 600 }) }}>{repairText(row.name || 'Unknown')}{meTagFor(row.id === state?.kingdomId)}{aiTagFor(row.is_ai)}{protTagFor(row.id !== state?.kingdomId && (row.turn || 0) < 400)}</div>
            <div style={{ fontSize: '11px', color: 'var(--text3)', textTransform: 'capitalize', marginTop: '1px' }}>{repairText(String(row.race || 'human')).replace(/_/g, ' ')}</div>
          </div>
        </div>
      </td>
      <td style={{ padding: '10px 6px', textAlign: 'right', color: 'var(--gold)', fontWeight: 600 }}>{fmt(row.score !== undefined ? row.score : row.land)}</td>
      <td style={{ padding: '10px 6px', textAlign: 'right', color: 'var(--text3)' }}>{row.level || 1}</td>
      <td style={{ padding: '10px 6px', textAlign: 'right', color: 'var(--text3)' }}>{fmt(row.turn || 0)}</td>
      <td style={{ padding: '10px 6px', textAlign: 'center', color: 'var(--text3)', fontSize: '11px' }}>{row.last_combat_at ? timeAgo(row.last_combat_at) : '—'}</td>
      <td style={{ padding: '10px 8px', textAlign: 'center' }}>{actionBtnsFor(row)}</td>
    </tr>
  ));

  function rankColorFor(rank) {
    return rank === 1
      ? { color: 'var(--gold)', fontWeight: 700 }
      : rank <= 3
        ? { color: 'var(--amber)' }
        : { color: 'var(--text3)' };
  }

  function raceIconFor(race) {
    return RACE_ICONS[String(race || 'human')] || '👤';
  }

  function meTagFor(isMe) {
    return isMe ? <span style={{ fontSize: '10px', color: 'var(--accent1)', fontWeight: 400 }}> (you)</span> : null;
  }

  function aiTagFor(isAi) {
    return isAi ? <span style={{ fontSize: '10px', color: 'var(--text3)' }}> 🤖</span> : null;
  }

  function protTagFor(show) {
    return show ? <span style={{ fontSize: '10px', color: 'var(--green)' }} title="Newbie protection — cannot be attacked until Turn 400"> 🛡️</span> : null;
  }

  function actionBtnsFor(row) {
    const isMe = row.id === state?.kingdomId;
    const disc = state?.discovered_kingdoms || {};
    const isMapped = !!(disc[row.id] && disc[row.id].mapped);
    if (isMe) {
      return <button className="btn btn-accent" style={{ fontSize: '11px', padding: '3px 8px' }} onClick={() => handleDirectMessage(row)}>✉️ Message</button>;
    }
    if ((row.turn || 0) < 400) {
      return (
        <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
          <button className="btn" style={{ fontSize: '11px', padding: '3px 8px' }} title="Kingdom Profile" onClick={() => handleProfile(row)}>👤</button>
          <button className="btn btn-accent" style={{ fontSize: '11px', padding: '3px 8px' }} title="Send message" onClick={() => handleDirectMessage(row)}>✉️</button>
          <span style={{ fontSize: '11px', color: 'var(--green)', marginLeft: '4px' }} title="Protected until Turn 400">🛡️</span>
        </div>
      );
    }
    return (
      <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
        <button className="btn" style={{ fontSize: '11px', padding: '3px 8px' }} title="Kingdom Profile" onClick={() => handleProfile(row)}>👤</button>
        <button className="btn btn-accent" style={{ fontSize: '11px', padding: '3px 8px' }} title="Send message" onClick={() => handleDirectMessage(row)}>✉️</button>
        {isMapped ? (
          <>
            <button className="btn btn-gold" style={{ fontSize: '11px', padding: '3px 8px' }} title="Place Bounty" onClick={() => handleBounty(row)}>🪙</button>
            <button className="btn btn-red" style={{ fontSize: '11px', padding: '3px 8px' }} onClick={() => handleTarget(row, 'attack')}>⚔️</button>
            <button className="btn btn-accent" style={{ fontSize: '11px', padding: '3px 8px' }} onClick={() => handleTarget(row, 'spells')}>✨</button>
            <button className="btn" style={{ fontSize: '11px', padding: '3px 8px' }} onClick={() => handleTarget(row, 'covert')}>🕵️</button>
            <button className="btn btn-gold" style={{ fontSize: '11px', padding: '3px 8px' }} title="Establish Trade Route" onClick={() => handleTrade(row)}>🤝</button>
          </>
        ) : null}
      </div>
    );
  }

  const allianceTable = loadingAlliances ? (
    <tr><td colSpan="6" style={{ color: 'var(--text3)', fontSize: '13px', textAlign: 'center', padding: '24px 0' }}>Loading...</td></tr>
  ) : allianceRows.length === 0 ? (
    <tr><td colSpan="6" style={{ color: 'var(--text3)', fontSize: '13px', textAlign: 'center', padding: '24px 0' }}>No alliances found.</td></tr>
  ) : filteredAlliances.length === 0 ? (
    <tr><td colSpan="6" style={{ color: 'var(--text3)', fontSize: '13px', textAlign: 'center', padding: '24px 0' }}>No alliances match your search.</td></tr>
  ) : filteredAlliances.map((row) => (
    <tr key={row.id} style={{ borderBottom: '1px solid var(--border)' }}>
      <td style={{ padding: '10px 6px', color: 'var(--text3)' }}>{row.rank}</td>
      <td style={{ padding: '10px 6px', color: 'var(--text)' }}>{repairText(row.name || '—')}</td>
      <td style={{ padding: '10px 6px', textAlign: 'right', color: 'var(--text3)' }}>{fmt(row.member_count)}</td>
      <td style={{ padding: '10px 6px', textAlign: 'right', color: 'var(--gold)', fontWeight: 600 }}>{fmt(row.total_score)}</td>
      <td style={{ padding: '10px 6px', textAlign: 'right', color: 'var(--text3)' }}>{fmt(row.member_count ? row.total_score / row.member_count : 0)}</td>
      <td style={{ padding: '10px 6px', textAlign: 'right', color: 'var(--text3)' }}>{fmt(row.total_pop)}</td>
    </tr>
  ));

  return (
    <div id="rankings" className="panel" style={{ display: 'none' }}>
      <div className="card" style={{ marginTop: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div id="rankings-title" className="card-title" style={{ margin: 0 }}>
              Rankings
            </div>
            <div style={{ display: 'flex', gap: '4px', background: 'var(--bg3)', padding: '4px', borderRadius: '8px' }}>
              <button id="rank-tab-kingdoms" className={`base-btn ${activeTab === 'kingdoms' ? 'active' : ''}`} style={{ padding: '4px 12px', fontSize: '11px', height: 'auto' }} onClick={() => handleSetRankType('kingdoms')}>Kingdoms</button>
              <button id="rank-tab-alliances" className={`base-btn ${activeTab === 'alliances' ? 'active' : ''}`} style={{ padding: '4px 12px', fontSize: '11px', height: 'auto' }} onClick={() => handleSetRankType('alliances')}>Alliance</button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input type="text" id="rank-search" className="input" placeholder="Search..." style={{ width: '180px' }} value={search} onChange={handleSearch} />
            <button className="base-btn" onClick={handleRefresh}>↻ Refresh</button>
          </div>
        </div>

        <div id="rank-view-kingdoms" style={{ overflowX: 'auto', display: activeTab === 'kingdoms' ? 'block' : 'none' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ color: 'var(--text3)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '2px solid var(--border2)' }}>
                <th style={{ padding: '8px 6px', textAlign: 'left', width: '32px' }}>#</th>
                <th style={{ padding: '8px 6px', textAlign: 'left' }}>Player</th>
                <th style={{ padding: '8px 6px', textAlign: 'left' }}>Kingdom</th>
                <th style={{ padding: '8px 6px', textAlign: 'right' }}>Score</th>
                <th style={{ padding: '8px 6px', textAlign: 'right' }}>Level</th>
                <th style={{ padding: '8px 6px', textAlign: 'right' }}>Turns Taken</th>
                <th style={{ padding: '8px 6px', textAlign: 'center' }}>Combat</th>
                <th style={{ padding: '8px 6px', textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody id="rankings-list">
              {kingdomRows.length || loadingKingdoms || error ? kingdomTable : kingdomTable}
            </tbody>
          </table>
        </div>

        <div id="rank-view-alliances" style={{ overflowX: 'auto', display: activeTab === 'alliances' ? 'block' : 'none' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ color: 'var(--text3)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '2px solid var(--border2)' }}>
                <th style={{ padding: '8px 6px', textAlign: 'left', width: '32px' }}>#</th>
                <th style={{ padding: '8px 6px', textAlign: 'left' }}>Alliance</th>
                <th style={{ padding: '8px 6px', textAlign: 'right' }}>Members</th>
                <th style={{ padding: '8px 6px', textAlign: 'right' }}>Total Score</th>
                <th style={{ padding: '8px 6px', textAlign: 'right' }}>Avg Score</th>
                <th style={{ padding: '8px 6px', textAlign: 'right' }}>Total Pop</th>
              </tr>
            </thead>
            <tbody id="alliance-rankings-list">
              {allianceTable}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default RankingsPanel;
