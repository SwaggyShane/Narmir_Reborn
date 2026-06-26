import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { apiCall } from '../../utils/api.mjs';
import { fmt } from '../../utils/fmt';
import { toast } from '../../utils/toast.js';
import { AppEvent, emitAppEvent } from '../../utils/appEvents.js';
import { useAppEvent } from '../../hooks/useAppEvent.js';
import { repairMojibake } from '../../utils/repairMojibake.js';
import { loadKingdom } from './AuthModal.jsx';
import { useActivePanel } from '../../hooks/useActivePanel.js';
import {
  getSocket,
  loadAllianceChatHistory,
  sendAllianceChat,
} from '../../socket-client.js';
import {
  mapHistoryMessages,
  normalizeSocketMessage,
  upsertChatMessage,
} from '../../utils/chatMessages.js';
import ChatMessageRow from './ChatMessageRow.jsx';

const MAX_MEMBERS = 6;

const ALLIANCE_PROJECTS = [
  { id: 'merchant_guild', label: 'Merchant Guild', desc: '+5% economy per level' },
  { id: 'shadow_network', label: 'Shadow Network', desc: '+2% stealth per level' },
  { id: 'mercenary_subsidy', label: 'Mercenary Subsidy', desc: 'Cheaper mercenary contracts' },
  { id: 'fortress_walls', label: 'Fortress Walls', desc: 'Alliance-wide defense bonus' },
];

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

function parseJsonField(value, fallback) {
  if (value == null || value === '') return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function pledgeDescription(value) {
  const pledge = Number(value) || 0;
  if (pledge <= 0) {
    return 'At 0%: you will not auto-deploy troops to defend allies.';
  }
  return `At ${pledge}%: your fighters deploy to defend allies when attacked.`;
}

const AlliancesPanel = () => {
  const { activePanel } = useActivePanel();
  const [activeTab, setActiveTab] = useState('members');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [allianceData, setAllianceData] = useState(null);
  const [openAlliances, setOpenAlliances] = useState([]);
  const [newAllianceName, setNewAllianceName] = useState('');

  const [depositAmount, setDepositAmount] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [pledge, setPledge] = useState(3);
  const [inviteName, setInviteName] = useState('');
  const [dismissTargetId, setDismissTargetId] = useState('');

  const chatRef = useRef(null);
  const panelVisible = activePanel === 'alliances';

  const inAlliance = !!allianceData?.alliance;
  const alliance = allianceData?.alliance || null;
  const members = allianceData?.members || [];
  const isLeader = !!allianceData?.isLeader;

  const combinedLand = useMemo(
    () => members.reduce((sum, member) => sum + Number(member.land || 0), 0),
    [members],
  );

  const vaultGold = Number(alliance?.vault_gold || 0);
  const vaultLog = useMemo(
    () => parseJsonField(alliance?.vault_log, []),
    [alliance?.vault_log],
  );
  const projects = useMemo(
    () => parseJsonField(alliance?.projects, {}),
    [alliance?.projects],
  );

  const dismissCandidates = useMemo(
    () => members.filter((member) => !isLeader || member.id !== alliance?.leader_id),
    [members, isLeader, alliance?.leader_id],
  );

  const scrollChatToBottom = useCallback(() => {
    const el = chatRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, []);

  const loadOpenAlliances = useCallback(async () => {
    const rows = await apiCall('/api/alliance/list');
    if (rows?.error) {
      setOpenAlliances([]);
      return rows;
    }
    const list = Array.isArray(rows) ? rows : [];
    setOpenAlliances(list.filter((row) => Number(row.member_count || 0) < MAX_MEMBERS));
    return rows;
  }, []);

  const loadMyAlliance = useCallback(async () => {
    setError('');
    const res = await apiCall('/api/alliance/my');
    if (res?.error) {
      setError(res.error);
      setAllianceData(null);
      return null;
    }
    setAllianceData(res);
    setPledge(Number(res?.myPledge ?? 3));
    return res;
  }, []);

  const refreshAlliance = useCallback(async () => {
    setLoading(true);
    try {
      const res = await loadMyAlliance();
      if (!res?.alliance) {
        await loadOpenAlliances();
      }
    } finally {
      setLoading(false);
    }
  }, [loadMyAlliance, loadOpenAlliances]);

  const loadChat = useCallback(async (allianceId) => {
    if (!allianceId) return;
    setChatLoading(true);
    try {
      const rows = await loadAllianceChatHistory(allianceId);
      setChatMessages(mapHistoryMessages(rows));
      requestAnimationFrame(scrollChatToBottom);
    } catch (err) {
      console.warn('[alliances] Failed to load chat:', err);
    } finally {
      setChatLoading(false);
    }
  }, [scrollChatToBottom]);

  useEffect(() => {
    refreshAlliance().catch((err) => {
      console.warn('[alliances] Initial load failed:', err);
      setLoading(false);
    });
  }, [refreshAlliance]);

  const onAllianceRefresh = useCallback(() => {
    refreshAlliance().catch(() => {});
  }, [refreshAlliance]);

  useAppEvent(AppEvent.ALLIANCE_REFRESH, onAllianceRefresh);

  useEffect(() => {
    if (!inAlliance || !alliance?.id) return;
    if (activeTab === 'board' || panelVisible) {
      loadChat(alliance.id).catch(() => {});
    }
  }, [inAlliance, alliance?.id, activeTab, panelVisible, loadChat]);

  useEffect(() => {
    if (!inAlliance) return undefined;

    let cancelled = false;
    let socket = null;

    const onSocketMessage = (data) => {
      if (data?.room !== 'alliance') return;
      const normalized = normalizeSocketMessage(data);
      if (!normalized) return;
      setChatMessages((prev) => upsertChatMessage(prev, normalized));
      requestAnimationFrame(scrollChatToBottom);
    };

    const boot = async () => {
      try {
        socket = await getSocket();
        if (cancelled) return;
        socket.on('chat:message', onSocketMessage);
      } catch (err) {
        console.warn('[alliances] Socket hookup failed:', err);
      }
    };

    boot();

    return () => {
      cancelled = true;
      if (socket) socket.off('chat:message', onSocketMessage);
    };
  }, [inAlliance, scrollChatToBottom]);

  useEffect(() => {
    if (!dismissCandidates.length) {
      setDismissTargetId('');
      return;
    }
    if (!dismissCandidates.some((member) => String(member.id) === String(dismissTargetId))) {
      setDismissTargetId(String(dismissCandidates[0].id));
    }
  }, [dismissCandidates, dismissTargetId]);

  const runAction = useCallback(async (action) => {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (err) {
      const message = err?.message || 'Action failed';
      setError(message);
      toast(message, 'error');
    } finally {
      setBusy(false);
    }
  }, []);

  const handleFoundAlliance = () => {
    const name = newAllianceName.trim();
    if (!name) {
      toast('Alliance name is required', 'error');
      return;
    }
    runAction(async () => {
      const res = await apiCall('/api/alliance/create', { method: 'POST', body: { name } });
      if (res?.error) throw new Error(res.error);
      setNewAllianceName('');
      toast('Alliance founded', 'success');
      await refreshAlliance();
    });
  };

  const handleLeaveAlliance = () => {
    if (!window.confirm('Leave your alliance? Leaders disband the entire alliance.')) return;
    runAction(async () => {
      const res = await apiCall('/api/alliance/leave', { method: 'POST' });
      if (res?.error) throw new Error(res.error);
      setChatMessages([]);
      toast('Left alliance', 'success');
      await refreshAlliance();
      await loadKingdom();
    });
  };

  const handleDeposit = () => {
    const amount = parseInt(depositAmount, 10);
    if (!amount || amount <= 0) {
      toast('Enter a valid gold amount', 'error');
      return;
    }
    runAction(async () => {
      const res = await apiCall('/api/alliance/vault/deposit', {
        method: 'POST',
        body: { amount },
      });
      if (res?.error) throw new Error(res.error);
      setDepositAmount('');
      toast(`Deposited ${fmt(amount)} gold`, 'success');
      await refreshAlliance();
      await loadKingdom();
    });
  };

  const handleFundProject = (projectId) => {
    runAction(async () => {
      const res = await apiCall('/api/alliance/vault/project', {
        method: 'POST',
        body: { project: projectId },
      });
      if (res?.error) throw new Error(res.error);
      toast('Project funded', 'success');
      await refreshAlliance();
      emitAppEvent(AppEvent.ALLIANCE_REFRESH);
    });
  };

  const handleSavePledge = () => {
    runAction(async () => {
      const res = await apiCall('/api/alliance/pledge', {
        method: 'POST',
        body: { pledge },
      });
      if (res?.error) throw new Error(res.error);
      toast('Pledge saved', 'success');
      await refreshAlliance();
    });
  };

  const handleInvite = () => {
    const name = inviteName.trim();
    if (!name) {
      toast('Kingdom name is required', 'error');
      return;
    }
    runAction(async () => {
      const rankings = await apiCall('/api/kingdom/rankings');
      if (rankings?.error) throw new Error(rankings.error);
      const rows = Array.isArray(rankings?.rankings) ? rankings.rankings : [];
      const match = rows.find(
        (row) => String(row.name || '').toLowerCase() === name.toLowerCase(),
      );
      if (!match?.id) throw new Error('Kingdom not found in rankings');

      const res = await apiCall('/api/alliance/invite', {
        method: 'POST',
        body: { targetKingdomId: match.id },
      });
      if (res?.error) throw new Error(res.error);
      setInviteName('');
      toast(`Invited ${repairMojibake(match.name)}`, 'success');
      await refreshAlliance();
    });
  };

  const handleDismiss = () => {
    const targetId = parseInt(dismissTargetId, 10);
    if (!targetId) {
      toast('Select a member to dismiss', 'error');
      return;
    }
    runAction(async () => {
      const res = await apiCall('/api/alliance/dismiss', {
        method: 'POST',
        body: { targetKingdomId: targetId },
      });
      if (res?.error) throw new Error(res.error);
      toast('Member dismissed', 'success');
      await refreshAlliance();
    });
  };

  const handleSendChat = () => {
    const message = chatInput.trim();
    if (!message) return;
    runAction(async () => {
      const res = await sendAllianceChat(message);
      if (res?.error) throw new Error(res.error);
      setChatInput('');
    });
  };

  if (loading) {
    return (
      <div className="panel panel-immersive flex flex-1 items-center justify-center text-text3">
        Loading alliance data...
      </div>
    );
  }

  if (!inAlliance) {
    return (
      <div className="panel panel-immersive min-h-0 w-full overflow-y-auto px-4 pb-5">
        {error ? (
          <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        ) : null}

        <div className="card mb-4 rounded-2xl border border-white/10 bg-zinc-950/80">
          <div className="card-title">Found an Alliance</div>
          <div className="mb-3 text-[13px] text-text2">
            Create a new Alliance and become its leader. Up to {MAX_MEMBERS} members.
          </div>
          <input
            type="text"
            className="input mb-2 w-full px-3 py-2 text-left"
            placeholder="Alliance name..."
            maxLength={40}
            value={newAllianceName}
            onChange={(e) => setNewAllianceName(e.target.value)}
          />
          <button
            type="button"
            className="base-btn variant-gold w-full bg-gold text-black"
            onClick={handleFoundAlliance}
            disabled={busy}
          >
            Found Alliance
          </button>
        </div>

        <div className="card mb-4 rounded-2xl border border-white/10 bg-zinc-950/80">
          <div className="card-title">Join an Alliance</div>
          <div className="mb-2.5 text-[13px] text-text2">
            Ask a leader to invite you, or browse alliances with open slots.
          </div>
          <div className="max-h-[220px] overflow-y-auto text-[13px] text-text3">
            {openAlliances.length ? (
              <div className="flex flex-col gap-2">
                {openAlliances.map((row) => (
                  <div
                    key={row.id}
                    className="rounded-xl border border-white/10 bg-void-900/70 px-3 py-2"
                  >
                    <div className="font-semibold text-text">{repairMojibake(row.name)}</div>
                    <div className="text-[12px] text-text3">
                      Leader: {repairMojibake(row.leader_name)} | {row.member_count}/{MAX_MEMBERS} members
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-4 text-center">No alliances with open slots.</div>
            )}
          </div>
          <button
            type="button"
            className="base-btn mt-2.5 w-full"
            onClick={() => loadOpenAlliances()}
            disabled={busy}
          >
            Refresh List
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="panel panel-immersive flex h-full min-h-0 w-full flex-col gap-4 overflow-hidden px-4 pb-5">
      {error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      <div className="card rounded-2xl border border-white/10 border-l-4 border-l-accent1 bg-zinc-950/80">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <span className="text-[12px] font-extrabold uppercase tracking-[1px] text-text3">
            Alliance Overview
          </span>
          <button
            type="button"
            className="base-btn variant-gold bg-gold px-3 py-1 text-[11px] text-black"
            onClick={() => refreshAlliance()}
            disabled={busy}
          >
            Refresh
          </button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="mb-1 text-[22px] font-extrabold text-text">
              {repairMojibake(alliance?.name || 'Alliance')}
            </div>
            <div className="flex gap-3 text-[13px] text-text3">
              <span>
                Members: <strong className="text-text2">{members.length}</strong>
              </span>
              <span>
                Land: <strong className="text-gold">{fmt(combinedLand)}</strong> acres
              </span>
            </div>
          </div>
          <button
            type="button"
            className="base-btn variant-red bg-red text-[12px]"
            onClick={handleLeaveAlliance}
            disabled={busy}
          >
            Leave Alliance
          </button>
        </div>
      </div>

      <div className="card flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/80 p-0">
        <div className="flex shrink-0 gap-0 border-b border-white/10 bg-void-900/80">
          {[
            { id: 'members', label: 'Members' },
            { id: 'vault', label: 'Vault' },
            { id: 'board', label: 'Chat' },
            { id: 'pledge', label: 'Pledge' },
            ...(isLeader ? [{ id: 'manage', label: 'Manage' }] : []),
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={clsx('base-btn admin-tab flex-1 rounded-none', activeTab === tab.id && 'active')}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
          {activeTab === 'members' ? (
            <div>
              <div className="card-title mb-4">Alliance Members</div>
              <div className="flex flex-col gap-2">
                {members.map((member) => (
                  <div
                    key={member.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-void-900/70 px-3 py-2"
                  >
                    <div>
                      <div className="font-semibold text-text">
                        {RACE_ICONS[member.race] || ''} {repairMojibake(member.name)}
                      </div>
                      <div className="text-[12px] text-text3">
                        Lv {member.level || 1} | {fmt(member.land)} land | {fmt(member.fighters)} fighters
                      </div>
                    </div>
                    <div className="text-[12px] text-gold">Pledge {member.pledge ?? 0}%</div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {activeTab === 'vault' ? (
            <div className="flex flex-wrap gap-4">
              <div className="min-w-0 flex-[1_1_300px]">
                <div className="card-title mb-2">Alliance Vault</div>
                <div className="mb-3 text-[13px] text-text2">
                  Fund massive alliance projects collectively. All members benefit.
                </div>
                <div className="mb-3 rounded-xl border border-white/10 bg-void-900/70 p-3">
                  <div className="text-[12px] uppercase text-text3">Vault Balance</div>
                  <div className="text-[24px] font-bold text-gold">{fmt(vaultGold)} GC</div>
                </div>
                <div className="flex gap-2">
                  <input
                    type="number"
                    className="input min-w-0 flex-1"
                    placeholder="Gold amount..."
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                  />
                  <button
                    type="button"
                    className="base-btn variant-gold shrink-0 bg-gold text-black"
                    onClick={handleDeposit}
                    disabled={busy}
                  >
                    Deposit
                  </button>
                </div>
                <div className="mt-4 max-h-[200px] overflow-y-auto text-[12px]">
                  {vaultLog.length ? (
                    vaultLog.map((entry, index) => (
                      <div key={`${entry.date || index}-${entry.type}`} className="border-b border-white/5 py-1.5 text-text3">
                        {entry.type === 'deposit'
                          ? `${repairMojibake(entry.kingdom)} deposited ${fmt(entry.amount)} GC`
                          : `${repairMojibake(entry.name)} upgraded to Lv ${entry.level} (${fmt(entry.cost)} GC)`}
                        {entry.date ? ` | ${entry.date}` : ''}
                      </div>
                    ))
                  ) : (
                    <div className="text-text3">No vault activity yet.</div>
                  )}
                </div>
              </div>

              <div className="min-w-0 flex-[1_1_300px]">
                <div className="card-title mb-2">Active Projects</div>
                <div className="flex flex-col gap-2">
                  {ALLIANCE_PROJECTS.map((project) => {
                    const level = Number(projects[project.id] || 0);
                    const nextCost = 50000 * (level + 1);
                    const maxed = level >= 10;
                    return (
                      <div
                        key={project.id}
                        className="rounded-xl border border-white/10 bg-void-900/70 px-3 py-2"
                      >
                        <div className="font-semibold text-text">{project.label}</div>
                        <div className="text-[12px] text-text3">{project.desc}</div>
                        <div className="mt-1 text-[12px] text-text2">
                          Level {level}/10
                          {!maxed ? ` | Next: ${fmt(nextCost)} GC` : ' | Maxed'}
                        </div>
                        {isLeader && !maxed ? (
                          <button
                            type="button"
                            className="base-btn mt-2 w-full"
                            onClick={() => handleFundProject(project.id)}
                            disabled={busy || vaultGold < nextCost}
                          >
                            Fund Upgrade
                          </button>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : null}

          {activeTab === 'board' ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="card-title mb-3">Alliance Communication</div>
              <div
                ref={chatRef}
                className="flex min-h-[240px] flex-1 flex-col gap-2 overflow-y-auto overflow-x-hidden rounded-xl border border-white/10 bg-void-900/70 p-3"
              >
                {chatLoading ? (
                  <div className="py-5 text-center text-text3">Loading messages...</div>
                ) : chatMessages.length ? (
                  chatMessages.map((message) => (
                    <ChatMessageRow key={message.key} message={message} />
                  ))
                ) : (
                  <div className="py-5 text-center text-text3">No alliance messages yet.</div>
                )}
              </div>
              <div className="mt-3 flex gap-2">
                <input
                  type="text"
                  className="input min-w-0 flex-1"
                  placeholder="Message your alliance..."
                  maxLength={300}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSendChat();
                  }}
                />
                <button
                  type="button"
                  className="base-btn variant-accent bg-accent1"
                  onClick={handleSendChat}
                  disabled={busy}
                >
                  Send
                </button>
              </div>
            </div>
          ) : null}

          {activeTab === 'pledge' ? (
            <div>
              <div className="card-title mb-2.5">Defense Pledge Settings</div>
              <div className="mb-3 text-[13px] leading-7 text-text2">
                When an ally is attacked, this percent of your troops auto-deploy to their defense.
              </div>
              <div className="mb-4 flex items-center gap-4 rounded-xl border border-white/10 bg-void-900/70 p-4">
                <input
                  type="range"
                  className="input flex-1"
                  min={0}
                  max={10}
                  step={1}
                  value={pledge}
                  onChange={(e) => setPledge(Number(e.target.value))}
                />
                <span className="min-w-[50px] text-center text-[20px] font-extrabold text-gold">
                  {pledge}%
                </span>
              </div>
              <div className="mb-4 text-[12px] text-text3">{pledgeDescription(pledge)}</div>
              <button
                type="button"
                className="base-btn variant-accent w-full bg-accent1"
                onClick={handleSavePledge}
                disabled={busy}
              >
                Save Pledge Changes
              </button>
            </div>
          ) : null}

          {activeTab === 'manage' && isLeader ? (
            <div>
              <div className="card-title mb-3">Invite Members</div>
              <div className="mb-6 flex gap-2">
                <input
                  type="text"
                  className="input min-w-0 flex-1"
                  placeholder="Kingdom name..."
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                />
                <button
                  type="button"
                  className="base-btn variant-gold bg-gold text-black"
                  onClick={handleInvite}
                  disabled={busy}
                >
                  Invite
                </button>
              </div>

              <div className="card-title mb-3">Dismiss Member</div>
              <div className="flex gap-2">
                <select
                  className="input min-w-0 flex-1 bg-void-900/70 text-[13px]"
                  value={dismissTargetId}
                  onChange={(e) => setDismissTargetId(e.target.value)}
                >
                  {dismissCandidates.length ? (
                    dismissCandidates.map((member) => (
                      <option key={member.id} value={member.id}>
                        {repairMojibake(member.name)}
                      </option>
                    ))
                  ) : (
                    <option value="">No members to dismiss</option>
                  )}
                </select>
                <button
                  type="button"
                  className="base-btn variant-red bg-red"
                  onClick={handleDismiss}
                  disabled={busy || !dismissCandidates.length}
                >
                  Dismiss
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default AlliancesPanel;