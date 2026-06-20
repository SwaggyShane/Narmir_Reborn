import React, { useEffect, useState } from 'react';
import { logout } from '../../actions/logout';

const BottomNav = () => {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    setIsAdmin(!!window.gameState?.isAdmin);
    const interval = setInterval(() => {
      if (window.gameState?.isAdmin !== isAdmin) {
        setIsAdmin(!!window.gameState?.isAdmin);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isAdmin]);

  const handleSwitchTabMobile = (id) => {
    if (window.switchTab) window.switchTab(id);
  };

  return (
    <nav className="bottom-nav" id="bottom-nav">
      <button className="bnav-item active" data-tab="status" onClick={() => handleSwitchTabMobile('status')}>
        <span className="bicon" style={{ color: '#4a90e2' }}>🏰</span>Status
      </button>
      <button className="bnav-item" data-tab="happiness" onClick={() => handleSwitchTabMobile('happiness')}>
        <span className="bicon" style={{ color: '#f59e0b' }}>😊</span>Happiness
      </button>
      <button className="bnav-item" data-tab="studies" onClick={() => handleSwitchTabMobile('studies')}>
        <span className="bicon" style={{ color: '#d0021b' }}>🏛️</span>Studies
      </button>
      <button className="bnav-item" data-tab="build" onClick={() => handleSwitchTabMobile('build')}>
        <span className="bicon" style={{ color: '#8b572a' }}>🏗️</span>Build
      </button>
      <button className="bnav-item" data-tab="exploration" onClick={() => handleSwitchTabMobile('exploration')}>
        <span className="bicon" style={{ color: '#417505' }}>🧭</span>Explore
      </button>

      <button className="bnav-item" data-tab="economy" onClick={() => handleSwitchTabMobile('economy')}>
        <span className="bicon" style={{ color: '#f5a623' }}>💰</span>Economy
      </button>
      <button className="bnav-item" data-tab="market" onClick={() => handleSwitchTabMobile('market')}>
        <span className="bicon" style={{ color: '#f8e71c' }}>⚖️</span>Market
      </button>
      <button className="bnav-item" data-tab="resources" onClick={() => handleSwitchTabMobile('resources')}>
        <span className="bicon" style={{ color: '#22c55e' }}>🌲</span>Resources
      </button>

      <button className="bnav-item" data-tab="rankings" onClick={() => handleSwitchTabMobile('rankings')}>
        <span className="bicon" style={{ color: '#f8e71c' }}>🏆</span>Ranks
      </button>
      <button className="bnav-item" data-tab="hire" onClick={() => handleSwitchTabMobile('hire')}>
        <span className="bicon" style={{ color: '#7ed321' }}>🤝</span>Hire
      </button>
      <button className="bnav-item" data-tab="warfare" onClick={() => handleSwitchTabMobile('warfare')}>
        <span className="bicon" style={{ color: '#d0021b' }}>⚔️</span>Offense
      </button>
      <button className="bnav-item" data-tab="defense" onClick={() => handleSwitchTabMobile('defense')}>
        <span className="bicon" style={{ color: '#4a4a4a' }}>🛡️</span>Defense
      </button>
      <button className="bnav-item" data-tab="bounties" onClick={() => handleSwitchTabMobile('bounties')}>
        <span className="bicon" style={{ color: 'var(--gold)' }}>🪙</span>Bounties
      </button>
      <button className="bnav-item" data-tab="training" onClick={() => handleSwitchTabMobile('training')}>
        <span className="bicon" style={{ color: '#fbbf24' }}>🎯</span>Train
      </button>
      <button className="bnav-item" data-tab="heroes" onClick={() => handleSwitchTabMobile('heroes')}>
        <span className="bicon" style={{ color: '#d946ef' }}>👑</span>Heroes
      </button>
      <button className="bnav-item" data-tab="worldmap" onClick={() => handleSwitchTabMobile('worldmap')}>
        <span className="bicon" style={{ color: '#22d3ee' }}>🌎</span>Map
      </button>
      <button className="bnav-item" data-tab="alliances" onClick={() => handleSwitchTabMobile('alliances')}>
        <span className="bicon" style={{ color: '#bd10e0' }}>🤝</span>Alliance
      </button>

      <button className="bnav-item" data-tab="messages" onClick={() => handleSwitchTabMobile('messages')}>
        <span className="bicon" style={{ color: 'var(--accent1)' }}>✉️</span>Msgs<span id="bnav-msg-badge" className="bnav-badge" style={{ display: 'none' }}></span>
      </button>
      <button className="bnav-item" data-tab="forum" onClick={() => handleSwitchTabMobile('forum')}>
        <span className="bicon" style={{ color: '#8b5cf6' }}>📚</span>Forum
      </button>
      <button id="bnav-chat-item" className="bnav-item" data-tab="globalchat" onClick={() => handleSwitchTabMobile('globalchat')}>
        <span className="bicon" style={{ color: '#f472b6' }}>💬</span>Chat
      </button>
      <button className="bnav-item" data-tab="news" onClick={() => handleSwitchTabMobile('news')}>
        <span className="bicon" style={{ color: '#fbbf24' }}>🗞️</span>News<span id="bnav-news-badge" className="bnav-badge" style={{ display: 'none' }}></span>
      </button>

      <button className="bnav-item" data-tab="goals" onClick={() => handleSwitchTabMobile('goals')}>
        <span className="bicon" style={{ color: '#f59e0b' }}>📝</span>Goals
      </button>
      <button className="bnav-item" data-tab="races" onClick={() => handleSwitchTabMobile('races')}>
        <span className="bicon" style={{ color: '#bc13fe' }}>🦄</span>Races
      </button>
      <button className="bnav-item" data-tab="changelog" onClick={() => handleSwitchTabMobile('changelog')}>
        <span className="bicon" style={{ color: 'var(--green)' }}>📋</span>Changelog
      </button>
      <button className="bnav-item" data-tab="testing" onClick={() => handleSwitchTabMobile('testing')}>
        <span className="bicon" style={{ color: '#8b5cf6' }}>🧪</span>Testing
      </button>
      <button className="bnav-item" data-tab="options" onClick={() => handleSwitchTabMobile('options')}>
        <span className="bicon" style={{ color: '#64748b' }}>⚙️</span>Settings
      </button>
      <div className="bnav-sep"></div>

      {isAdmin && (
        <a
          id="admin-bnav-link"
          className="bnav-item"
          href="/admin"
          style={{ textDecoration: 'none' }}
        >
          <span className="bicon" style={{ color: '#ff9800' }}>👑</span>Admin
        </a>
      )}

      <button className="bnav-item" onClick={logout} style={{ color: 'var(--red)' }}>
        <span className="bicon">🚪</span>Logout
      </button>
    </nav>
  );
};

export default BottomNav;
