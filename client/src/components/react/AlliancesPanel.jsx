import React, { useState } from 'react';

const AlliancesPanel = () => {
  const [activeTab, setActiveTab] = useState('members');

  const handleTabClick = (tabId) => {
    setActiveTab(tabId);
  };

  const foundAlliance = () => {
    if (window.foundAlliance) window.foundAlliance();
  };
  const loadAllianceSearch = () => {
    if (window.loadAllianceSearch) window.loadAllianceSearch();
  };
  const loadAllianceInfo = () => {
    if (window.loadAllianceInfo) window.loadAllianceInfo();
  };
  const leaveAlliance = () => {
    if (window.leaveAlliance) window.leaveAlliance();
  };
  const allianceDeposit = () => {
    if (window.allianceDeposit) window.allianceDeposit();
  };
  const sendAllyMsg = () => {
    if (window.sendAllyMsg) window.sendAllyMsg();
  };
  const handleAllyMsgKeydown = (event) => {
    if (event.key === "Enter") {
      sendAllyMsg();
    }
  };
  const updatePledge = (val) => {
    if (window.updatePledge) window.updatePledge(val);
  };
  const savePledge = () => {
    if (window.savePledge) window.savePledge();
  };
  const inviteAlly = () => {
    if (window.inviteAlly) window.inviteAlly();
  };
  const dismissAlly = () => {
    if (window.dismissAlly) window.dismissAlly();
  };

  return (
    <div id="alliances" className="panel panel-immersive min-h-0 w-full overflow-y-auto px-4 pb-5" style={{ display: 'none' }}>
      {/* Not in alliance */}
      <div id="ally-none" style={{ display: 'none' }}>
        <div className="card mb-4 rounded-2xl border border-white/10 bg-zinc-950/80">
          <div className="card-title">Found an Alliance</div>
          <div className="mb-3 text-[13px] text-[var(--text2)]">
            Create a new Alliance and become its leader. Up to 6 members.
          </div>
          <input
            type="text"
            className="input"
            id="new-ally-name"
            placeholder="Alliance name..."
            className="mb-2 w-full px-3 py-2 text-left"
            maxLength="40"
          />
          <button className="base-btn variant-gold w-full bg-[var(--gold)] text-black" onClick={foundAlliance}>
            Found Alliance
          </button>
        </div>
        <div className="card mb-4 rounded-2xl border border-white/10 bg-zinc-950/80">
          <div className="card-title">Open Alliances</div>
          <div style={{ fontSize: '13px', color: 'var(--text2)', marginBottom: '10px' }}>
            Ask a leader to invite you, or find Alliances accepting members.
          </div>
          <div
            id="ally-search-list"
            className="max-h-[180px] overflow-y-auto text-[13px] text-[var(--text3)]"
          >
            No alliances found.
          </div>
          <button
            className="base-btn mt-2.5 w-full"
            onClick={loadAllianceSearch}
          >
            &#8635; Refresh
          </button>
        </div>
      </div>

      {/* In alliance */}
      <div
        id="ally-active"
        className="flex h-full flex-col gap-4" style={{ display: 'none' }}
      >
        {/* Alliance Summary Card (Prominent Header) */}
        <div
          className="card rounded-2xl border border-white/10 border-l-4 border-l-[var(--accent1)] bg-zinc-950/80"
        >
          <div
            className="mb-3 flex flex-wrap items-center justify-between gap-3"
          >
            <span
              className="text-[12px] font-extrabold uppercase tracking-[1px] text-[var(--text3)]"
            >
              🛡️ Alliance Overview
            </span>
            <button
              className="base-btn variant-gold"
              className="base-btn variant-gold bg-[var(--gold)] px-3 py-1 text-[11px] text-black"
              onClick={loadAllianceInfo}
            >
              ↻ Refresh
            </button>
          </div>
          <div
            className="flex flex-wrap items-center justify-between gap-4"
          >
            <div>
              <div
                className="mb-1 text-[22px] font-extrabold text-[var(--text)]"
                id="ally-name"
              >
                —
              </div>
              <div className="flex gap-3 text-[13px] text-[var(--text3)]">
                <span>
                  👥 <strong style={{ color: 'var(--text2)' }} id="ally-member-count">0</strong> members
                </span>
                <span>
                  🗺️ <strong style={{ color: 'var(--gold)' }} id="ally-combined-land">0</strong> acres
                </span>
              </div>
            </div>
            <button
              className="base-btn variant-red"
              className="base-btn variant-red bg-[var(--red)] text-[12px]"
              onClick={leaveAlliance}
            >
              Leave Alliance
            </button>
          </div>
        </div>

        {/* Tabs Content Container */}
        <div
          className="card"
          className="card flex min-h-0 flex-1 flex-col overflow-hidden p-0 rounded-2xl border border-white/10 bg-zinc-950/80"
        >
          <div className="flex shrink-0 gap-0 border-b border-[var(--border)] bg-[var(--bg3)]">
            <button
              className={`base-btn admin-tab flex-1 rounded-none ${activeTab === 'members' ? 'active' : ''}`}
              onClick={() => handleTabClick('members')}
            >
              📋 Members
            </button>
            <button
              className={`base-btn admin-tab flex-1 rounded-none ${activeTab === 'vault' ? 'active' : ''}`}
              onClick={() => handleTabClick('vault')}
            >
              🏦 Vault
            </button>
            <button
              className={`base-btn admin-tab flex-1 rounded-none ${activeTab === 'board' ? 'active' : ''}`}
              onClick={() => handleTabClick('board')}
            >
              💬 Chat
            </button>
            <button
              className={`base-btn admin-tab flex-1 rounded-none ${activeTab === 'pledge' ? 'active' : ''}`}
              onClick={() => handleTabClick('pledge')}
            >
              🛡️ Pledge
            </button>
            <button
              className={`base-btn admin-tab flex-1 rounded-none ${activeTab === 'manage' ? 'active' : ''}`}
              onClick={() => handleTabClick('manage')}
              id="ally-manage-tab"
              style={{ display: 'none' }}
            >
              ⚙️ Manage
            </button>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">
            {/* MEMBERS TAB */}
            <div style={{ display: activeTab === 'members' ? 'block' : 'none' }} className="ally-tab-content">
              <div className="card-title" className="mb-4">
                Alliance Members List
              </div>
              <div id="ally-list"></div>
            </div>

            {/* VAULT TAB */}
            <div style={{ display: activeTab === 'vault' ? 'block' : 'none' }} className="ally-tab-content">
              <div className="flex flex-wrap gap-4">
                <div className="min-w-0 flex-[1_1_300px]">
                  <div className="card-title" className="mb-2">
                    🏦 Alliance Vault
                  </div>
                  <div className="mb-3 text-[13px] text-[var(--text2)]">
                    Fund massive alliance projects collectively. All members benefit.
                  </div>
                  <div className="mb-3 rounded-xl border border-white/10 bg-[var(--bg2)] p-3">
                    <div className="text-[12px] uppercase text-[var(--text3)]">
                      Vault Balance
                    </div>
                    <div className="text-[24px] font-bold text-[var(--gold)]">
                      <span id="ally-vault-gold">0</span> GC
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      className="input"
                      id="ally-deposit-amount"
                      placeholder="Gold amount..."
                      style={{ flex: 1, minWidth: 0 }}
                    />
                    <button className="base-btn variant-gold" className="shrink-0 bg-[var(--gold)] text-black" onClick={allianceDeposit}>
                      Deposit
                    </button>
                  </div>
                  <div className="mt-4 max-h-[200px] overflow-y-auto text-[12px]" id="ally-vault-log">
                    {/* Vault log renders here */}
                  </div>
                </div>
                <div className="min-w-0 flex-[1_1_300px]">
                  <div className="card-title" className="mb-2">
                    🏗️ Active Projects
                  </div>
                  <div id="ally-projects-list" className="flex flex-col gap-2">
                    {/* Projects render here */}
                  </div>
                </div>
              </div>
            </div>

            {/* CHAT TAB */}
            <div
              id="ally-tab-board"
              className="ally-tab-content"
              style={{ display: activeTab === 'board' ? 'flex' : 'none', flexDirection: 'column', flex: 1, minHeight: 0 }}
            >
              <div className="card-title" className="mb-3">
                Alliance Communication
              </div>
              <div
                id="alliance-chat"
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  overflowX: 'hidden',
                  padding: '12px',
                  background: 'var(--bg3)',
                  borderRadius: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  border: '1px solid var(--border)',
                  minHeight: 0
                }}
              >
                <div style={{ textAlign: 'center', color: 'var(--text3)', padding: '20px 0' }}>
                  Loading messages...
                </div>
              </div>
              <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  className="input"
                  id="ally-msg"
                  placeholder="Message your alliance..."
                  className="w-auto flex-1"
                  maxLength="300"
                  onKeyDown={handleAllyMsgKeydown}
                />
                <button className="base-btn variant-accent" style={{ background: 'var(--accent1)' }} onClick={sendAllyMsg}>
                  Send
                </button>
              </div>
            </div>

            {/* PLEDGE TAB */}
            <div id="ally-tab-pledge" className="ally-tab-content" style={{ display: activeTab === 'pledge' ? 'block' : 'none' }}>
              <div className="card-title" style={{ marginBottom: '10px' }}>
                Defense Pledge Settings
              </div>
              <div className="mb-3 text-[13px] leading-7 text-[var(--text2)]">
                When an ally is attacked, this % of your troops auto-deploy to their defense.
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  marginBottom: '16px',
                  background: 'var(--bg3)',
                  padding: '16px',
                  borderRadius: '12px',
                  border: '1px solid var(--border)'
                }}
              >
                <input
                  type="range"
                  className="input"
                  id="pledge-slider"
                  min="0"
                  max="10"
                  step="1"
                  defaultValue="3"
                  onChange={(e) => updatePledge(e.target.value)}
                  className="flex-1"
                />
                <span id="pledge-val" className="min-w-[50px] text-center text-[20px] font-extrabold text-[var(--gold)]">
                  3%
                </span>
              </div>
              <div className="mb-4 text-[12px] text-[var(--text3)]" id="pledge-desc">
                At 3%: your fighters deploy to defend allies when attacked.
              </div>
              <button className="base-btn variant-accent w-full" className="w-full bg-[var(--accent1)]" onClick={savePledge}>
                Save Pledge Changes
              </button>
            </div>

            {/* MANAGE TAB */}
            <div id="ally-tab-manage" className="ally-tab-content" style={{ display: activeTab === 'manage' ? 'block' : 'none' }}>
              <div className="card-title" className="mb-3">
                Invite Members
              </div>
              <div className="mb-6 flex gap-2">
                <input
                  type="text"
                  className="input"
                  id="invite-name"
                  placeholder="Kingdom name..."
                  className="w-auto flex-1"
                />
                <button className="base-btn variant-gold" className="bg-[var(--gold)] text-black" onClick={inviteAlly}>
                  Invite
                </button>
              </div>

              <div className="card-title" className="mb-3">
                Dismiss Member
              </div>
              <div className="flex gap-2">
                <select
                  id="dismiss-sel"
                  className="input"
                  style={{
                    flex: 1,
                    background: 'var(--bg3)',
                    border: '1px solid var(--border2)',
                    borderRadius: 'var(--radius)',
                    color: 'var(--text)',
                    padding: '8px 12px',
                    fontSize: '13px'
                  }}
                >
                  <option>— no members —</option>
                </select>
                <button className="base-btn variant-red" className="bg-[var(--red)]" onClick={dismissAlly}>
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AlliancesPanel;
