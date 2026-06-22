import React, { useState } from 'react';
import { useGameState } from '../../hooks/useGameState';
import { logout } from './AuthModal.jsx';
import { switchTab } from '../../utils/switchTab.js';

const Sidebar = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  const { state } = useGameState();

  React.useEffect(() => {
    setIsAdmin(!!state?.isAdmin);
  }, [state?.isAdmin]);

  const handleSwitchTab = (id, e) => {
    switchTab(id, e.currentTarget);
  };

  return (
    <nav className="sidebar">
      <div className="nav-section">Kingdom</div>
      <button className="nav-item active" data-tab="status" onClick={(e) => handleSwitchTab('status', e)}>
        <span className="icon text-[#4a90e2]">🏰</span>Status
      </button>
      <button className="nav-item" data-tab="happiness" onClick={(e) => handleSwitchTab('happiness', e)}>
        <span className="icon text-[#f59e0b]">😊</span>Happiness
      </button>
      <button className="nav-item" data-tab="studies" onClick={(e) => handleSwitchTab('studies', e)}>
        <span className="icon text-[#d0021b]">🏛️</span>Studies
      </button>
      <button className="nav-item" data-tab="build" onClick={(e) => handleSwitchTab('build', e)}>
        <span className="icon text-[#8b572a]">🔨</span>Build
      </button>
      <button className="nav-item" data-tab="exploration" onClick={(e) => handleSwitchTab('exploration', e)}>
        <span className="icon text-[#417505]">🧭</span>Exploration
      </button>

      <div className="nav-section">Wherewithal</div>
      <button className="nav-item" data-tab="economy" onClick={(e) => handleSwitchTab('economy', e)}>
        <span className="icon text-[#f5a623]">💰</span>Economy
      </button>
      <button className="nav-item" data-tab="market" onClick={(e) => handleSwitchTab('market', e)}>
        <span className="icon text-[#f8e71c]">⚖️</span>Market
      </button>
      <button className="nav-item" data-tab="resources" onClick={(e) => handleSwitchTab('resources', e)}>
        <span className="icon text-[#22c55e]">🌲</span>Resources
      </button>

      <div className="nav-section">Warfare</div>
      <button className="nav-item" data-tab="rankings" onClick={(e) => handleSwitchTab('rankings', e)}>
        <span className="icon text-[#f8e71c]">🏆</span>Rankings
      </button>
      <button className="nav-item" data-tab="hire" onClick={(e) => handleSwitchTab('hire', e)}>
        <span className="icon text-[#7ed321]">🤝</span>Hire
      </button>
      <button className="nav-item" data-tab="warfare" onClick={(e) => handleSwitchTab('warfare', e)}>
        <span className="icon text-[#d0021b]">⚔️</span>Offense
      </button>
      <button className="nav-item" data-tab="defense" onClick={(e) => handleSwitchTab('defense', e)}>
        <span className="icon text-[#4a4a4a]">🛡️</span>Defense
      </button>
      <button className="nav-item" data-tab="bounties" onClick={(e) => handleSwitchTab('bounties', e)}>
        <span className="icon text-[var(--gold)]">🪙</span>Bounties
      </button>
      <button className="nav-item" data-tab="training" onClick={(e) => handleSwitchTab('training', e)}>
        <span className="icon text-[#fbbf24]">🎯</span>Training
      </button>
      <button className="nav-item" data-tab="heroes" onClick={(e) => handleSwitchTab('heroes', e)}>
        <span className="icon text-[#d946ef]">👑</span>Heroes
      </button>
      <button className="nav-item" data-tab="worldmap" onClick={(e) => handleSwitchTab('worldmap', e)}>
        <span className="icon text-[#50e3c2]">🗺️</span>World Map
      </button>
      <button className="nav-item" data-tab="alliances" onClick={(e) => handleSwitchTab('alliances', e)}>
        <span className="icon text-[#bd10e0]">🤝</span>Alliance
      </button>

      <div className="nav-section">Social</div>
      <button className="nav-item" data-tab="messages" onClick={(e) => handleSwitchTab('messages', e)}>
        <span className="icon text-[var(--accent1)]">✉️</span>Messages
        <span id="msg-badge" className="nav-badge hidden" />
      </button>
      <button className="nav-item" data-tab="forum" onClick={(e) => handleSwitchTab('forum', e)}>
        <span className="icon text-[#8b5cf6]">📚</span>Forum
      </button>
      <button id="nav-chat-item" className="nav-item" data-tab="globalchat" onClick={(e) => handleSwitchTab('globalchat', e)}>
        <span className="icon text-[#4a90e2]">💬</span>Chat
        <span
          id="chat-badge"
          className="ml-1 hidden rounded-[10px] bg-[var(--red)] px-1.5 py-px text-[10px] text-white"
        >!</span>
      </button>
      <button className="nav-item" data-tab="news" onClick={(e) => handleSwitchTab('news', e)}>
        <span className="icon text-[#9b9b9b]">📰</span>News
        <span id="news-badge" className="nav-badge hidden" />
      </button>

      <div className="nav-section">Information</div>
      <button className="nav-item" data-tab="goals" onClick={(e) => handleSwitchTab('goals', e)}>
        <span className="icon text-[#f59e0b]">📝</span>Goals
      </button>
      <button className="nav-item" data-tab="races" onClick={(e) => handleSwitchTab('races', e)}>
        <span className="icon text-[#bc13fe]">🦄</span>Races
      </button>
      <button className="nav-item" data-tab="changelog" onClick={(e) => handleSwitchTab('changelog', e)}>
        <span className="icon text-[var(--green)]">📋</span>Changelog
      </button>
      <button className="nav-item" data-tab="testing" onClick={(e) => handleSwitchTab('testing', e)}>
        <span className="icon text-[#8b5cf6]">🧪</span>Testing
      </button>
      <button className="nav-item" data-tab="options" onClick={(e) => handleSwitchTab('options', e)}>
        <span className="icon text-[#64748b]">⚙️</span>Settings
      </button>

      {isAdmin && (
        <a
          id="admin-nav-link"
          className="nav-item no-underline"
          href="/admin"
          target="_blank"
          rel="noopener noreferrer"
        >
          <span className="icon text-[#ff9800]">👑</span>Admin
        </a>
      )}

      <div className="flex-1" />
      <button
        onClick={logout}
        className="nav-item mt-2 text-[var(--red)]"
      >
        <span className="icon">&#10005;</span>Logout
      </button>
    </nav>
  );
};

export default Sidebar;
