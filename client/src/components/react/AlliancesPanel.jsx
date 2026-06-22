import React, { useState } from 'react';
import clsx from 'clsx';

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
    <div id="alliances" className="panel panel-immersive min-h-0 w-full overflow-y-auto px-4 pb-5 hidden">
      {/* Not in alliance */}
      <div id="ally-none" className="hidden">
        <div className="card mb-4 rounded-2xl border border-white/10 bg-zinc-950/80">
          <div className="card-title">Found an Alliance</div>
          <div className="mb-3 text-[13px] text-[var(--text2)]">
            Create a new Alliance and become its leader. Up to 6 members.
          </div>
          <input
            type="text"
            className="input mb-2 w-full px-3 py-2 text-left"
            id="new-ally-name"
            placeholder="Alliance name..."
            maxLength="40"
          />
          <button className="base-btn variant-gold w-full bg-[var(--gold)] text-black" onClick={foundAlliance}>
            Found Alliance
          </button>
        </div>
        <div className="card mb-4 rounded-2xl border border-white/10 bg-zinc-950/80">
          <div className="card-title">Open Alliances</div>
          <div className="mb-2.5 text-[13px] text-[var(--text2)]">
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
        className="hidden flex h-full flex-col gap-4"
      >
        {/* Alliance Summary Card (Prominent Header) */}
        <div
          className="card rounded-2xl border border-white/10 border-l-4 border-l-[var(--accent1)] bg-zinc-950/80"
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <span className="text-[12px] font-extrabold uppercase tracking-[1px] text-[var(--text3)]">
              🛡️ Alliance Overview
            </span>
            <button
              className="base-btn variant-gold bg-[var(--gold)] px-3 py-1 text-[11px] text-black"
              onClick={loadAllianceInfo}
            >
              ↻ Refresh
            </button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div
                className="mb-1 text-[22px] font-extrabold text-[var(--text)]"
                id="ally-name"
              >
                —
              </div>
              <div className="flex gap-3 text-[13px] text-[var(--text3)]">
                <span>
                  👥 <strong className="text-[var(--text2)]" id="ally-member-count">0</strong> members
                </span>
                <span>
                  🗺️ <strong className="text-[var(--gold)]" id="ally-combined-land">0</strong> acres
                </span>
              </div>
            </div>
            <button
              className="base-btn variant-red bg-[var(--red)] text-[12px]"
              onClick={leaveAlliance}
            >
              Leave Alliance
            </button>
          </div>
        </div>

        {/* Tabs Content Container */}
        <div className="card flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/80 p-0">
          <div className="flex shrink-0 gap-0 border-b border-[var(--border)] bg-[var(--bg3)]">
            <button
              className={clsx('base-btn admin-tab flex-1 rounded-none', activeTab === 'members' && 'active')}
              onClick={() => handleTabClick('members')}
            >
              📋 Members
            </button>
            <button
              className={clsx('base-btn admin-tab flex-1 rounded-none', activeTab === 'vault' && 'active')}
              onClick={() => handleTabClick('vault')}
            >
              🏦 Vault
            </button>
            <button
              className={clsx('base-btn admin-tab flex-1 rounded-none', activeTab === 'board' && 'active')}
              onClick={() => handleTabClick('board')}
            >
              💬 Chat
            </button>
            <button
              className={clsx('base-btn admin-tab flex-1 rounded-none', activeTab === 'pledge' && 'active')}
              onClick={() => handleTabClick('pledge')}
            >
              🛡️ Pledge
            </button>
            <button
              className={clsx('base-btn admin-tab flex-1 rounded-none hidden', activeTab === 'manage' && 'active')}
              onClick={() => handleTabClick('manage')}
              id="ally-manage-tab"
            >
              ⚙️ Manage
            </button>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">
            {/* MEMBERS TAB */}
            <div className={clsx(activeTab === 'members' ? 'block' : 'hidden', 'ally-tab-content')}>
              <div className="card-title mb-4">
                Alliance Members List
              </div>
              <div id="ally-list"></div>
            </div>

            {/* VAULT TAB */}
            <div className={clsx(activeTab === 'vault' ? 'block' : 'hidden', 'ally-tab-content')}>
              <div className="flex flex-wrap gap-4">
                <div className="min-w-0 flex-[1_1_300px]">
                  <div className="card-title mb-2">
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
                      className="input flex-1"
                      id="ally-deposit-amount"
                      placeholder="Gold amount..."
                      style={{ minWidth: 0 }}
                    />
                    <button className="base-btn variant-gold shrink-0 bg-[var(--gold)] text-black" onClick={allianceDeposit}>
                      Deposit
                    </button>
                  </div>
                  <div className="mt-4 max-h-[200px] overflow-y-auto text-[12px]" id="ally-vault-log">
                    {/* Vault log renders here */}
                  </div>
                </div>
                <div className="min-w-0 flex-[1_1_300px]">
                  <div className="card-title mb-2">
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
              className={clsx(activeTab === 'board' ? 'flex' : 'hidden', 'ally-tab-content flex-col flex-1 min-h-0')}
            >
              <div className="card-title mb-3">
                Alliance Communication
              </div>
              <div
                id="alliance-chat"
                className="flex-1 overflow-y-auto overflow-x-hidden p-3 bg-[var(--bg3)] rounded-[12px] flex flex-col gap-2 border border-[var(--border)] min-h-0"
              >
                <div className="text-center text-[var(--text3)] py-5">
                  Loading messages...
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <input
                  type="text"
                  className="input flex-1 w-auto"
                  id="ally-msg"
                  placeholder="Message your alliance..."
                  maxLength="300"
                  onKeyDown={handleAllyMsgKeydown}
                />
                <button className="base-btn variant-accent bg-[var(--accent1)]" onClick={sendAllyMsg}>
                  Send
                </button>
              </div>
            </div>

            {/* PLEDGE TAB */}
            <div id="ally-tab-pledge" className={clsx(activeTab === 'pledge' ? 'block' : 'hidden', 'ally-tab-content')}>
              <div className="card-title mb-2.5">
                Defense Pledge Settings
              </div>
              <div className="mb-3 text-[13px] leading-7 text-[var(--text2)]">
                When an ally is attacked, this % of your troops auto-deploy to their defense.
              </div>
              <div className="mb-4 flex items-center gap-4 rounded-xl border border-[var(--border)] bg-[var(--bg3)] p-4">
                <input
                  type="range"
                  className="input flex-1"
                  id="pledge-slider"
                  min="0"
                  max="10"
                  step="1"
                  defaultValue="3"
                  onChange={(e) => updatePledge(e.target.value)}
                />
                <span id="pledge-val" className="min-w-[50px] text-center text-[20px] font-extrabold text-[var(--gold)]">
                  3%
                </span>
              </div>
              <div className="mb-4 text-[12px] text-[var(--text3)]" id="pledge-desc">
                At 3%: your fighters deploy to defend allies when attacked.
              </div>
              <button className="base-btn variant-accent w-full bg-[var(--accent1)]" onClick={savePledge}>
                Save Pledge Changes
              </button>
            </div>

            {/* MANAGE TAB */}
            <div id="ally-tab-manage" className={clsx(activeTab === 'manage' ? 'block' : 'hidden', 'ally-tab-content')}>
              <div className="card-title mb-3">
                Invite Members
              </div>
              <div className="mb-6 flex gap-2">
                <input
                  type="text"
                  className="input flex-1 w-auto"
                  id="invite-name"
                  placeholder="Kingdom name..."
                />
                <button className="base-btn variant-gold bg-[var(--gold)] text-black" onClick={inviteAlly}>
                  Invite
                </button>
              </div>

              <div className="card-title mb-3">
                Dismiss Member
              </div>
              <div className="flex gap-2">
                <select
                  id="dismiss-sel"
                  className="input flex-1 bg-[var(--bg3)] text-[13px]"
                  style={{ border: '1px solid var(--border2)', borderRadius: 'var(--radius)', color: 'var(--text)', padding: '8px 12px' }}
                >
                  <option>— no members —</option>
                </select>
                <button className="base-btn variant-red bg-[var(--red)]" onClick={dismissAlly}>
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
