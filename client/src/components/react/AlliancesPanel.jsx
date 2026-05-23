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
    <div id="alliances" className="panel panel-immersive" style={{ display: 'none' }}>
      {/* Not in alliance */}
      <div id="ally-none" style={{ display: 'none' }}>
        <div className="card" style={{ marginBottom: '14px' }}>
          <div className="card-title">Found an Alliance</div>
          <div style={{ fontSize: '13px', color: 'var(--text2)', marginBottom: '12px' }}>
            Create a new Alliance and become its leader. Up to 6 members.
          </div>
          <input
            type="text"
            className="input"
            id="new-ally-name"
            placeholder="Alliance name..."
            style={{ width: '100%', marginBottom: '10px', textAlign: 'left', padding: '7px 10px' }}
            maxLength="40"
          />
          <button className="base-btn variant-gold w-full" style={{ background: 'var(--gold)', color: '#000', width: '100%' }} onClick={foundAlliance}>
            Found Alliance
          </button>
        </div>
        <div className="card" style={{ marginBottom: '14px' }}>
          <div className="card-title">Open Alliances</div>
          <div style={{ fontSize: '13px', color: 'var(--text2)', marginBottom: '10px' }}>
            Ask a leader to invite you, or find Alliances accepting members.
          </div>
          <div
            id="ally-search-list"
            style={{ maxHeight: '180px', overflowY: 'auto', fontSize: '13px', color: 'var(--text3)' }}
          >
            No alliances found.
          </div>
          <button
            className="base-btn w-full"
            style={{ width: '100%', marginTop: '10px' }}
            onClick={loadAllianceSearch}
          >
            &#8635; Refresh
          </button>
        </div>
      </div>

      {/* In alliance */}
      <div
        id="ally-active"
        style={{ display: 'none', flexDirection: 'column', height: '100%' }}
      >
        {/* Alliance Summary Card (Prominent Header) */}
        <div
          className="card"
          style={{ marginBottom: '16px', borderLeft: '4px solid var(--accent1)' }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '12px',
            }}
          >
            <span
              style={{
                fontSize: '12px',
                fontWeight: 800,
                color: 'var(--text3)',
                textTransform: 'uppercase',
                letterSpacing: '1px',
              }}
            >
              🛡️ Alliance Overview
            </span>
            <button
              className="base-btn variant-gold"
              style={{ fontSize: '11px', padding: '4px 12px', background: 'var(--gold)', color: '#000' }}
              onClick={loadAllianceInfo}
            >
              ↻ Refresh
            </button>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '16px',
            }}
          >
            <div>
              <div
                style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text)', marginBottom: '4px' }}
                id="ally-name"
              >
                —
              </div>
              <div style={{ display: 'flex', gap: '12px', fontSize: '13px', color: 'var(--text3)' }}>
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
              style={{ fontSize: '12px', background: 'var(--red)' }}
              onClick={leaveAlliance}
            >
              Leave Alliance
            </button>
          </div>
        </div>

        {/* Tabs Content Container */}
        <div
          className="card"
          style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}
        >
          <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', background: 'var(--bg3)', flexShrink: 0 }}>
            <button
              className={`base-btn admin-tab ${activeTab === 'members' ? 'active' : ''}`}
              onClick={() => handleTabClick('members')}
              style={{ flex: 1, borderRadius: 0 }}
            >
              📋 Members
            </button>
            <button
              className={`base-btn admin-tab ${activeTab === 'vault' ? 'active' : ''}`}
              onClick={() => handleTabClick('vault')}
              style={{ flex: 1, borderRadius: 0 }}
            >
              🏦 Vault
            </button>
            <button
              className={`base-btn admin-tab ${activeTab === 'board' ? 'active' : ''}`}
              onClick={() => handleTabClick('board')}
              style={{ flex: 1, borderRadius: 0 }}
            >
              💬 Chat
            </button>
            <button
              className={`base-btn admin-tab ${activeTab === 'pledge' ? 'active' : ''}`}
              onClick={() => handleTabClick('pledge')}
              style={{ flex: 1, borderRadius: 0 }}
            >
              🛡️ Pledge
            </button>
            <button
              className={`base-btn admin-tab ${activeTab === 'manage' ? 'active' : ''}`}
              onClick={() => handleTabClick('manage')}
              id="ally-manage-tab"
              style={{ display: 'none', flex: 1, borderRadius: 0 }}
            >
              ⚙️ Manage
            </button>
          </div>

          <div style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {/* MEMBERS TAB */}
            <div style={{ display: activeTab === 'members' ? 'block' : 'none' }} className="ally-tab-content">
              <div className="card-title" style={{ marginBottom: '16px' }}>
                Alliance Members List
              </div>
              <div id="ally-list"></div>
            </div>

            {/* VAULT TAB */}
            <div style={{ display: activeTab === 'vault' ? 'block' : 'none' }} className="ally-tab-content">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
                <div style={{ flex: '1 1 300px', minWidth: 0 }}>
                  <div className="card-title" style={{ marginBottom: '8px' }}>
                    🏦 Alliance Vault
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text2)', marginBottom: '12px' }}>
                    Fund massive alliance projects collectively. All members benefit.
                  </div>
                  <div style={{ background: 'var(--bg2)', padding: '12px', borderRadius: '8px', marginBottom: '12px', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '12px', color: 'var(--text3)', textTransform: 'uppercase' }}>
                      Vault Balance
                    </div>
                    <div style={{ fontSize: '24px', color: 'var(--gold)', fontWeight: 'bold' }}>
                      <span id="ally-vault-gold">0</span> GC
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="number"
                      className="input"
                      id="ally-deposit-amount"
                      placeholder="Gold amount..."
                      style={{ flex: 1, minWidth: 0 }}
                    />
                    <button className="base-btn variant-gold" style={{ flexShrink: 0, background: 'var(--gold)', color: '#000' }} onClick={allianceDeposit}>
                      Deposit
                    </button>
                  </div>
                  <div style={{ marginTop: '16px', maxHeight: '200px', overflowY: 'auto', fontSize: '12px' }} id="ally-vault-log">
                    {/* Vault log renders here */}
                  </div>
                </div>
                <div style={{ flex: '1 1 300px', minWidth: 0 }}>
                  <div className="card-title" style={{ marginBottom: '8px' }}>
                    🏗️ Active Projects
                  </div>
                  <div id="ally-projects-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
              <div className="card-title" style={{ marginBottom: '12px' }}>
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
                  style={{ flex: 1, width: 'auto' }}
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
              <div style={{ fontSize: '13px', color: 'var(--text2)', marginBottom: '12px', lineHeight: 1.7 }}>
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
                  style={{ flex: 1 }}
                />
                <span id="pledge-val" style={{ color: 'var(--gold)', fontSize: '20px', fontWeight: 800, minWidth: '50px', textAlign: 'center' }}>
                  3%
                </span>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text3)', marginBottom: '16px' }} id="pledge-desc">
                At 3%: your fighters deploy to defend allies when attacked.
              </div>
              <button className="base-btn variant-accent w-full" style={{ background: 'var(--accent1)', width: '100%' }} onClick={savePledge}>
                Save Pledge Changes
              </button>
            </div>

            {/* MANAGE TAB */}
            <div id="ally-tab-manage" className="ally-tab-content" style={{ display: activeTab === 'manage' ? 'block' : 'none' }}>
              <div className="card-title" style={{ marginBottom: '12px' }}>
                Invite Members
              </div>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
                <input
                  type="text"
                  className="input"
                  id="invite-name"
                  placeholder="Kingdom name..."
                  style={{ flex: 1, width: 'auto' }}
                />
                <button className="base-btn variant-gold" style={{ background: 'var(--gold)', color: '#000' }} onClick={inviteAlly}>
                  Invite
                </button>
              </div>

              <div className="card-title" style={{ marginBottom: '12px' }}>
                Dismiss Member
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
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
                <button className="base-btn variant-red" style={{ background: 'var(--red)' }} onClick={dismissAlly}>
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
