import React, { useCallback, useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { apiCall } from '../../utils/api';
import { repairMojibake } from '../../utils/repairMojibake';
import { fmt } from "../../utils/fmt";
import { toast as showToast } from '../../utils/toast.js';
import { useProfileStore, useKingdomId, useDiscoveredKingdoms } from '../../stores';
import { openKingdomProfile } from './KingdomProfileModal.jsx';
import { openDirectMessage } from '../../utils/directMessage.js';
import { selectBountyTarget } from '../../utils/bountyTarget.js';
import { targetFromRankings } from '../../utils/rankingsTarget.js';
import { switchTab } from '../../utils/panelNav.js';

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
  const [activeTab, setActiveTab] = useState('kingdoms');
  const [search, setSearch] = useState('');
  const [kingdomRows, setKingdomRows] = useState([]);
  const [allianceRows, setAllianceRows] = useState([]);
  const [loadingKingdoms, setLoadingKingdoms] = useState(true);
  const [loadingAlliances, setLoadingAlliances] = useState(true);
  const [error, setError] = useState('');
  const kingdomId = useKingdomId();
  const discoveredKingdoms = useDiscoveredKingdoms();

  const repairText = useCallback((value) => {
    const text = value === null || value === undefined ? '' : String(value);
    return repairMojibake(text);
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
      useProfileStore.getState().receiveServerSnapshot({ rankingsCache: kingdoms, allianceRankingsCache: alliances });
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
  const handleSetRankType = (type) => setActiveTab(type);
  const handleSearch = (event) => setSearch(event.target.value);
  const handleDirectMessage = (row) => openDirectMessage(row.player_id, row.name);
  const handleProfile = (row) => openKingdomProfile(row.name);
  const handleBounty = (row) => {
    selectBountyTarget(row.id);
    switchTab('bounties');
  };
  const handleTarget = (row, mode) => targetFromRankings(row.id, mode);
  const handleTrade = useCallback(async (row) => {
    try {
      const result = await apiCall('/api/kingdom/trade-routes/establish', {
        method: 'POST',
        body: { targetId: row.id },
      });
      if (result.error) {
        showToast(result.error, 'error');
        return;
      }
      showToast(result.message || 'Trade route established', 'success');
      await loadRankings();
    } catch (err) {
      console.error('[RankingsPanel] Failed to establish trade route:', err);
      showToast('Failed to establish trade route', 'error');
    }
  }, [loadRankings]);

  const renderKingdomRow = (row) => {
    const isMe = row.id === kingdomId;
    const disc = discoveredKingdoms || {};
    const isMapped = !!(disc[row.id] && disc[row.id].mapped);
    const raceKey = String(row.race || 'human');
    const raceIcon = RACE_ICONS[raceKey] || '👤';
    const rankBadge = row.rank === 1 ? '👑' : row.rank <= 3 ? '🥈' : '';
    const rankColor = row.rank === 1
      ? { color: 'var(--gold)', fontWeight: 700 }
      : row.rank <= 3
        ? { color: 'var(--amber)' }
        : { color: 'var(--text3)' };
    const nameStyle = isMe
      ? { color: 'var(--accent1)', fontWeight: 700 }
      : { color: 'var(--text)', fontWeight: 600 };
    const meTag = isMe ? <span className="text-[10px] font-normal" style={{color: 'var(--accent1)'}}> (you)</span> : null;
    const aiTag = row.is_ai ? <span className="text-[10px] text-text3"> 🤖</span> : null;
    const protTag = !isMe && (row.turn || 0) < 400
      ? <span className="text-[10px] text-green" title="Newbie protection — cannot be attacked until Turn 400"> 🛡️</span>
      : null;

    const actionBtns = isMe
      ? <button className="btn btn-accent text-[11px] px-2 py-0.5" onClick={() => handleDirectMessage(row)}>✉️ Message</button>
      : (row.turn || 0) < 400
        ? (
          <div className="flex gap-1 justify-center">
            <button className="btn text-[11px] px-2 py-0.5" title="Kingdom Profile" onClick={() => handleProfile(row)}>👤</button>
            <button className="btn btn-accent text-[11px] px-2 py-0.5" title="Send message" onClick={() => handleDirectMessage(row)}>✉️</button>
            <span className="text-[11px] text-green ml-1" title="Protected until Turn 400">🛡️</span>
          </div>
        )
        : (
          <div className="flex gap-1 justify-center">
            <button className="btn text-[11px] px-2 py-0.5" title="Kingdom Profile" onClick={() => handleProfile(row)}>👤</button>
            <button className="btn btn-accent text-[11px] px-2 py-0.5" title="Send message" onClick={() => handleDirectMessage(row)}>✉️</button>
            {isMapped ? (
              <>
                <button className="btn btn-gold text-[11px] px-2 py-0.5" title="Place Bounty" onClick={() => handleBounty(row)}>🪙</button>
                <button className="btn btn-red text-[11px] px-2 py-0.5" onClick={() => handleTarget(row, 'attack')}>⚔️</button>
                <button className="btn btn-accent text-[11px] px-2 py-0.5" onClick={() => handleTarget(row, 'spells')}>✨</button>
                <button className="btn text-[11px] px-2 py-0.5" onClick={() => handleTarget(row, 'covert')}>🕵️</button>
                <button className="btn btn-gold text-[11px] px-2 py-0.5" title="Establish Trade Route" onClick={() => handleTrade(row)}>🤝</button>
              </>
            ) : null}
          </div>
        );

    return (
      <tr key={row.id} className="border-b border-b-border">
        <td style={{ padding: '10px 6px', ...rankColor }}>{rankBadge || row.rank}</td>
        <td className="px-1.5 py-2.5 text-text2">{row.username || '—'}</td>
        <td className="px-1.5 py-2.5">
          <div className="flex items-center gap-2">
            <span className="text-xl flex-shrink-0">{raceIcon}</span>
            <div>
              <div style={nameStyle}>{repairText(row.name || 'Unknown')}{meTag}{aiTag}{protTag}</div>
              <div className="text-[11px] text-text3 capitalize" style={{marginTop: '1px'}}>{repairText(raceKey).replace(/_/g, ' ')}</div>
            </div>
          </div>
        </td>
        <td className="px-1.5 py-2.5 text-right text-gold font-semibold">{fmt(row.score !== undefined ? row.score : row.land)}</td>
        <td className="px-[6px] py-2.5 text-right text-[var(--text3)]">{row.level || 1}</td>
        <td className="px-[6px] py-2.5 text-right text-[var(--text3)]">{fmt(row.turn || 0)}</td>
        <td className="px-1.5 py-2.5 text-center text-text3 text-[11px]">{row.last_combat_at ? timeAgo(row.last_combat_at) : '—'}</td>
        <td className="text-center" style={{padding: '10px 8px'}}>{actionBtns}</td>
      </tr>
    );
  };

  const renderAllianceRow = (row) => (
    <tr key={row.id} className="border-b border-b-border">
      <td className="px-1.5 py-2.5 text-text3">{row.rank}</td>
      <td className="px-1.5 py-2.5" style={{color: 'var(--text)'}}>{repairText(row.name || '—')}</td>
      <td className="px-[6px] py-2.5 text-right text-[var(--text3)]">{fmt(row.member_count)}</td>
      <td className="px-1.5 py-2.5 text-right text-gold font-semibold">{fmt(row.total_score)}</td>
      <td className="px-[6px] py-2.5 text-right text-[var(--text3)]">{fmt(row.member_count ? row.total_score / row.member_count : 0)}</td>
      <td className="px-[6px] py-2.5 text-right text-[var(--text3)]">{fmt(row.total_pop)}</td>
    </tr>
  );

  return (
    <div id="rankings" className="panel">
      <div className="card mt-0">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-4">
            <div id="rankings-title" className="card-title m-0">Rankings</div>
            <div className="flex gap-1 p-1 rounded-lg" style={{background: 'var(--bg3)'}}>
              <button id="rank-tab-kingdoms" className={`base-btn ${activeTab === 'kingdoms' ? 'active' : ''} text-[11px] h-auto`} style={{padding: '4px 12px'}} onClick={() => handleSetRankType('kingdoms')}>Kingdoms</button>
              <button id="rank-tab-alliances" className={`base-btn ${activeTab === 'alliances' ? 'active' : ''} text-[11px] h-auto`} style={{padding: '4px 12px'}} onClick={() => handleSetRankType('alliances')}>Alliance</button>
            </div>
          </div>
          <div className="flex gap-2 items-center">
            <input type="text" id="rank-search" className="input w-[180px]" placeholder="Search..." value={search} onChange={handleSearch} />
            <button className="base-btn" onClick={handleRefresh}>↻ Refresh</button>
          </div>
        </div>

        <div id="rank-view-kingdoms" className={clsx('overflow-x-auto', activeTab === 'kingdoms' ? 'block' : 'hidden')}>
          <table className="w-full text-[13px]" style={{borderCollapse: 'collapse'}}>
            <thead>
              <tr className="text-text3 text-[11px] uppercase border-b-2 border-b-border2" style={{letterSpacing: '0.5px'}}>
                <th className="px-1.5 py-2 text-left w-[32px]">#</th>
                <th className="px-[6px] py-2 text-left">Player</th>
                <th className="px-[6px] py-2 text-left">Kingdom</th>
                <th className="px-[6px] py-2 text-right">Score</th>
                <th className="px-[6px] py-2 text-right">Level</th>
                <th className="px-[6px] py-2 text-right">Turns Taken</th>
                <th className="px-1.5 py-2 text-center">Combat</th>
                <th className="px-1.5 py-2 text-center">Action</th>
              </tr>
            </thead>
            <tbody id="rankings-list">
              {loadingKingdoms ? (
                <tr><td colSpan="8" className="text-[var(--text3)] text-[13px] text-center py-6">Loading rankings...</td></tr>
              ) : error ? (
                <tr><td colSpan="8" className="text-red text-[13px] text-center" style={{padding: '24px 0'}}>{error}</td></tr>
              ) : filteredKingdoms.length === 0 ? (
                <tr><td colSpan="8" className="text-[var(--text3)] text-[13px] text-center py-6">No kingdoms found.</td></tr>
              ) : filteredKingdoms.map(renderKingdomRow)}
            </tbody>
          </table>
        </div>

        <div id="rank-view-alliances" className={clsx('overflow-x-auto', activeTab === 'alliances' ? 'block' : 'hidden')}>
          <table className="w-full text-[13px]" style={{borderCollapse: 'collapse'}}>
            <thead>
              <tr className="text-text3 text-[11px] uppercase border-b-2 border-b-border2" style={{letterSpacing: '0.5px'}}>
                <th className="px-1.5 py-2 text-left w-[32px]">#</th>
                <th className="px-[6px] py-2 text-left">Alliance</th>
                <th className="px-[6px] py-2 text-right">Members</th>
                <th className="px-[6px] py-2 text-right">Total Score</th>
                <th className="px-[6px] py-2 text-right">Avg Score</th>
                <th className="px-[6px] py-2 text-right">Total Pop</th>
              </tr>
            </thead>
            <tbody id="alliance-rankings-list">
              {loadingAlliances ? (
                <tr><td colSpan="6" className="text-[var(--text3)] text-[13px] text-center py-6">Loading...</td></tr>
              ) : allianceRows.length === 0 ? (
                <tr><td colSpan="6" className="text-[var(--text3)] text-[13px] text-center py-6">No alliances found.</td></tr>
              ) : filteredAlliances.length === 0 ? (
                <tr><td colSpan="6" className="text-[var(--text3)] text-[13px] text-center py-6">No alliances match your search.</td></tr>
              ) : filteredAlliances.map(renderAllianceRow)}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default RankingsPanel;
