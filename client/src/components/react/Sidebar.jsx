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
    <nav className="sidebar game-panel">
      <div className="nav-section">Kingdom</div>
      <button className="nav-item active" data-tab="status" onClick={(e) => handleSwitchTab('status', e)}>
        <span className="icon text-blue">🏰</span>Status
      </button>
      <button className="nav-item" data-tab="happiness" onClick={(e) => handleSwitchTab('happiness', e)}>
        <span className="icon text-amber">😊</span>Happiness
      </button>
      <button className="nav-item" data-tab="studies" onClick={(e) => handleSwitchTab('studies', e)}>
        <span className="icon text-red">🏛️</span>Studies
      </button>
      <button className="nav-item" data-tab="build" onClick={(e) => handleSwitchTab('build', e)}>
        <span className="icon text-amber">🔨</span>Build
      </button>
      <button className="nav-item" data-tab="exploration" onClick={(e) => handleSwitchTab('exploration', e)}>
        <span className="icon text-green">🧭</span>Exploration
      </button>

      <div className="nav-section">Wherewithal</div>
      <button className="nav-item" data-tab="economy" onClick={(e) => handleSwitchTab('economy', e)}>
        <span className="icon text-amber">💰</span>Economy
      </button>
      <button className="nav-item" data-tab="market" onClick={(e) => handleSwitchTab('market', e)}>
        <span className="icon text-gold">⚖️</span>Market
      </button>
      <button className="nav-item" data-tab="resources" onClick={(e) => handleSwitchTab('resources', e)}>
        <span className="icon text-green">🌲</span>Resources
      </button>

      <div className="nav-section">Warfare</div>
      <button className="nav-item" data-tab="rankings" onClick={(e) => handleSwitchTab('rankings', e)}>
        <span className="icon text-gold">🏆</span>Rankings
      </button>
      <button className="nav-item" data-tab="hire" onClick={(e) => handleSwitchTab('hire', e)}>
        <span className="icon text-green">🤝</span>Hire
      </button>
      <button className="nav-item" data-tab="warfare" onClick={(e) => handleSwitchTab('warfare', e)}>
        <span className="icon text-red">⚔️</span>Offense
      </button>
      <button className="nav-item" data-tab="defense" onClick={(e) => handleSwitchTab('defense', e)}>
        <span className="icon text-text3">🛡️</span>Defense
      </button>
      <button className="nav-item" data-tab="bounties" onClick={(e) => handleSwitchTab('bounties', e)}>
        <span className="icon text-gold">🪙</span>Bounties
      </button>
      <button className="nav-item" data-tab="training" onClick={(e) => handleSwitchTab('training', e)}>
        <span className="icon text-amber">🎯</span>Training
      </button>
      <button className="nav-item" data-tab="heroes" onClick={(e) => handleSwitchTab('heroes', e)}>
        <span className="icon text-accent2">👑</span>Heroes
      </button>
      <button className="nav-item" data-tab="worldmap" onClick={(e) => handleSwitchTab('worldmap', e)}>
        <span className="icon text-blue">🗺️</span>World Map
      </button>
      <button className="nav-item" data-tab="alliances" onClick={(e) => handleSwitchTab('alliances', e)}>
        <span className="icon text-accent2">🤝</span>Alliance
      </button>

      <div className="nav-section">Social</div>
      <button className="nav-item" data-tab="messages" onClick={(e) => handleSwitchTab('messages', e)}>
        <span className="icon text-accent1">✉️</span>Messages
        <span id="msg-badge" className="nav-badge hidden" />
      </button>
      <button className="nav-item" data-tab="forum" onClick={(e) => handleSwitchTab('forum', e)}>
        <span className="icon text-accent2">📚</span>Forum
      </button>
      <button id="nav-chat-item" className="nav-item" data-tab="globalchat" onClick={(e) => handleSwitchTab('globalchat', e)}>
        <span className="icon text-blue">💬</span>Chat
        <span
          id="chat-badge"
          className="ml-1 hidden rounded-md bg-red px-1.5 py-px text-xs text-white"
        >!</span>
      </button>
      <button className="nav-item" data-tab="news" onClick={(e) => handleSwitchTab('news', e)}>
        <span className="icon text-text3">📰</span>News
        <span id="news-badge" className="nav-badge hidden" />
      </button>

      <div className="nav-section">Information</div>
      <button className="nav-item" data-tab="goals" onClick={(e) => handleSwitchTab('goals', e)}>
        <span className="icon text-amber">📝</span>Goals
      </button>
      <button className="nav-item" data-tab="races" onClick={(e) => handleSwitchTab('races', e)}>
        <span className="icon text-accent2">🦄</span>Races
      </button>
      <button className="nav-item" data-tab="changelog" onClick={(e) => handleSwitchTab('changelog', e)}>
        <span className="icon text-green">📋</span>Changelog
      </button>
      <button className="nav-item" data-tab="testing" onClick={(e) => handleSwitchTab('testing', e)}>
        <span className="icon text-accent2">🧪</span>Testing
      </button>
      <button className="nav-item" data-tab="options" onClick={(e) => handleSwitchTab('options', e)}>
        <span className="icon text-text3">⚙️</span>Settings
      </button>

      {isAdmin && (
        <a
          id="admin-nav-link"
          className="nav-item no-underline"
          href="/admin"
          target="_blank"
          rel="noopener noreferrer"
        >
          <span className="icon text-amber">👑</span>Admin
        </a>
      )}

      <div className="flex-1" />
      <button
        onClick={logout}
        className="nav-item mt-2 text-red"
      >
        <span className="icon">&#10005;</span>Logout
      </button>
    </nav>
  );
};

export default Sidebar;
