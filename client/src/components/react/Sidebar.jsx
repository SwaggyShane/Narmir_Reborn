import React, { useEffect, useState } from 'react';
import { gameState } from '../../main.js';

const Sidebar = () => {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // If gameState is reactive (from Vue), we might need a way to listen,
    // but in this pure React transition we can just check if window.gameState has it
    // or set a simple interval if we want to be hacky, but really it's set once on load.
    setIsAdmin(!!window.gameState?.isAdmin);
    
    // In Vue, reactive() properties were updating. In React we can poll or use event listeners.
    const interval = setInterval(() => {
      if (window.gameState?.isAdmin !== isAdmin) {
        setIsAdmin(!!window.gameState?.isAdmin);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isAdmin]);

  const handleSwitchTab = (id, e) => {
    if (window.switchTab) window.switchTab(id, e.currentTarget);
  };

  const doLogout = () => {
    if (window.doLogout) window.doLogout();
  };

  return (
    <nav className="sidebar">
      <div className="nav-section">Kingdom</div>
      <button className="nav-item active" data-tab="status" onClick={(e) => handleSwitchTab('status', e)}>
        <span className="icon" style={{ color: '#4a90e2' }}>🏰</span>Status
      </button>
      <button className="nav-item" data-tab="testing" onClick={(e) => handleSwitchTab('testing', e)}>
        <span className="icon" style={{ color: '#8b5cf6' }}>🧪</span>Testing
      </button>
      <button className="nav-item" data-tab="goals" onClick={(e) => handleSwitchTab('goals', e)}>
        <span className="icon" style={{ color: '#f59e0b' }}>📝</span>Goals
      </button>
      <button className="nav-item" data-tab="hire" onClick={(e) => handleSwitchTab('hire', e)}>
        <span className="icon" style={{ color: '#7ed321' }}>🤝</span>Hire
      </button>
      <button className="nav-item" data-tab="heroes" onClick={(e) => handleSwitchTab('heroes', e)}>
        <span className="icon" style={{ color: '#d946ef' }}>👑</span>Heroes
      </button>
      <button className="nav-item" data-tab="studies" onClick={(e) => handleSwitchTab('studies', e)}>
        <span className="icon" style={{ color: '#d0021b' }}>🏛️</span>Studies
      </button>
      <button className="nav-item" data-tab="races" onClick={(e) => handleSwitchTab('races', e)}>
        <span className="icon" style={{ color: '#bc13fe' }}>🦄</span>Races
      </button>
      <button className="nav-item" data-tab="economy" onClick={(e) => handleSwitchTab('economy', e)}>
        <span className="icon" style={{ color: '#f5a623' }}>💰</span>Economy
      </button>
      <button className="nav-item" data-tab="market" onClick={(e) => handleSwitchTab('market', e)}>
        <span className="icon" style={{ color: '#f8e71c' }}>⚖️</span>Market
      </button>
      <button className="nav-item" data-tab="build" onClick={(e) => handleSwitchTab('build', e)}>
        <span className="icon" style={{ color: '#8b572a' }}>🔨</span>Build
      </button>
      <button className="nav-item" data-tab="resources" onClick={(e) => handleSwitchTab('resources', e)}>
        <span className="icon" style={{ color: '#22c55e' }}>🌲</span>Resources
      </button>
      <button className="nav-item" data-tab="training" onClick={(e) => handleSwitchTab('training', e)}>
        <span className="icon" style={{ color: '#fbbf24' }}>🎯</span>Training
      </button>
      <button className="nav-item" data-tab="exploration" onClick={(e) => handleSwitchTab('exploration', e)}>
        <span className="icon" style={{ color: '#417505' }}>🧭</span>Exploration
      </button>

      <div className="nav-section">Warfare</div>
      <button className="nav-item" data-tab="defense" onClick={(e) => handleSwitchTab('defense', e)}>
        <span className="icon" style={{ color: '#4a4a4a' }}>🛡️</span>Defense
      </button>
      <button className="nav-item" data-tab="warfare" onClick={(e) => handleSwitchTab('warfare', e)}>
        <span className="icon" style={{ color: '#d0021b' }}>⚔️</span>Warfare
      </button>

      <div className="nav-section">Social</div>
      <button className="nav-item" data-tab="rankings" onClick={(e) => handleSwitchTab('rankings', e)}>
        <span className="icon" style={{ color: '#f8e71c' }}>🏆</span>Rankings
      </button>
      <button className="nav-item" data-tab="worldmap" onClick={(e) => handleSwitchTab('worldmap', e)}>
        <span className="icon" style={{ color: '#50e3c2' }}>🗺️</span>World Map
      </button>
      <button className="nav-item" data-tab="bounties" onClick={(e) => handleSwitchTab('bounties', e)}>
        <span className="icon" style={{ color: 'var(--gold)' }}>🪙</span>Bounties
      </button>
      <button className="nav-item" data-tab="messages" onClick={(e) => handleSwitchTab('messages', e)}>
        <span className="icon" style={{ color: 'var(--accent1)' }}>✉️</span>Messages
        <span id="msg-badge" className="nav-badge" style={{ display: 'none' }}></span>
      </button>
      <button className="nav-item" data-tab="alliances" onClick={(e) => handleSwitchTab('alliances', e)}>
        <span className="icon" style={{ color: '#bd10e0' }}>🤝</span>Alliance
      </button>
      <button id="nav-chat-item" className="nav-item" data-tab="globalchat" onClick={(e) => handleSwitchTab('globalchat', e)}>
        <span className="icon" style={{ color: '#4a90e2' }}>💬</span>Chat
        <span
          id="chat-badge"
          style={{
            display: 'none',
            background: 'var(--red)',
            color: '#fff',
            borderRadius: '10px',
            padding: '1px 6px',
            fontSize: '10px',
            marginLeft: '4px'
          }}
        >!</span>
      </button>
      <button className="nav-item" data-tab="news" onClick={(e) => handleSwitchTab('news', e)}>
        <span className="icon" style={{ color: '#9b9b9b' }}>📰</span>News
        <span id="news-badge" className="nav-badge" style={{ display: 'none' }}></span>
      </button>
      <button className="nav-item" data-tab="changelog" onClick={(e) => handleSwitchTab('changelog', e)}>
        <span className="icon" style={{ color: 'var(--green)' }}>📋</span>Changelog
      </button>
      <button className="nav-item" data-tab="options" onClick={(e) => handleSwitchTab('options', e)}>
        <span className="icon" style={{ color: '#64748b' }}>⚙️</span>Settings
      </button>

      {isAdmin && (
        <a
          id="admin-nav-link"
          className="nav-item"
          href="/admin"
          target="_blank"
          rel="noopener noreferrer"
          style={{ textDecoration: 'none' }}
        >
          <span className="icon" style={{ color: '#ff9800' }}>👑</span>Admin
        </a>
      )}

      <div style={{ flex: 1 }}></div>
      <button
        className="nav-item"
        onClick={doLogout}
        style={{ color: 'var(--red)', marginTop: '8px' }}
      >
        <span className="icon">&#10005;</span>Logout
      </button>
    </nav>
  );
};

export default Sidebar;
