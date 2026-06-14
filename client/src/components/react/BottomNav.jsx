import React, { useEffect, useState } from 'react';
import { gameState } from '../../main.js';

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

  const handleSwitchTabMobile = (id, e) => {
    if (window.switchTabMobile) window.switchTabMobile(id, e.currentTarget);
  };

  const doLogout = () => {
    if (window.doLogout) window.doLogout();
  };

  return (
    <nav className="bottom-nav" id="bottom-nav">
      <button className="bnav-item active" data-tab="status" onClick={(e) => handleSwitchTabMobile('status', e)}>
        <span className="bicon" style={{ color: '#4a90e2' }}>🏰</span>Status
      </button>
      <button className="bnav-item" data-tab="happiness" onClick={(e) => handleSwitchTabMobile('happiness', e)}>
        <span className="bicon" style={{ color: '#f59e0b' }}>😊</span>Happiness
      </button>

      <button className="bnav-item" data-tab="economy" onClick={(e) => handleSwitchTabMobile('economy', e)}>
        <span className="bicon" style={{ color: '#f5a623' }}>💰</span>Economy
      </button>
      <button className="bnav-item" data-tab="market" onClick={(e) => handleSwitchTabMobile('market', e)}>
        <span className="bicon" style={{ color: '#f8e71c' }}>⚖️</span>Market
      </button>
      <button className="bnav-item" data-tab="resources" onClick={(e) => handleSwitchTabMobile('resources', e)}>
        <span className="bicon" style={{ color: '#22c55e' }}>🌲</span>Resources
      </button>

      <button className="bnav-item" data-tab="rankings" onClick={(e) => handleSwitchTabMobile('rankings', e)}>
        <span className="bicon" style={{ color: '#f8e71c' }}>🏆</span>Ranks
      </button>
      <button className="bnav-item" data-tab="hire" onClick={(e) => handleSwitchTabMobile('hire', e)}>
        <span className="bicon" style={{ color: '#7ed321' }}>🤝</span>Hire
      </button>
      <button className="bnav-item" data-tab="warfare" onClick={(e) => handleSwitchTabMobile('warfare', e)}>
        <span className="bicon" style={{ color: '#d0021b' }}>⚔️</span>Offense
      </button>
      <button className="bnav-item" data-tab="defense" onClick={(e) => handleSwitchTabMobile('defense', e)}>
        <span className="bicon" style={{ color: '#4a4a4a' }}>🛡️</span>Defense
      </button>
      <button className="bnav-item" data-tab="bounties" onClick={(e) => handleSwitchTabMobile('bounties', e)}>
        <span className="bicon" style={{ color: 'var(--gold)' }}>🪙</span>Bounties
      </button>
      <button className="bnav-item" data-tab="training" onClick={(e) => handleSwitchTabMobile('training', e)}>
        <span className="bicon" style={{ color: '#fbbf24' }}>🎯</span>Train
      </button>
      <button className="bnav-item" data-tab="heroes" onClick={(e) => handleSwitchTabMobile('heroes', e)}>
        <span className="bicon" style={{ color: '#d946ef' }}>👑</span>Heroes
      </button>
      <button className="bnav-item" data-tab="worldmap" onClick={(e) => handleSwitchTabMobile('worldmap', e)}>
        <span className="bicon" style={{ color: '#22d3ee' }}>🌎</span>Map
      </button>
      <button className="bnav-item" data-tab="alliances" onClick={(e) => handleSwitchTabMobile('alliances', e)}>
        <span className="bicon" style={{ color: '#bd10e0' }}>🤝</span>Alliance
      </button>

      <button className="bnav-item" data-tab="messages" onClick={(e) => handleSwitchTabMobile('messages', e)}>
        <span className="bicon" style={{ color: 'var(--accent1)' }}>✉️</span>Msgs<span id="bnav-msg-badge" className="bnav-badge" style={{ display: 'none' }}></span>
      </button>
      <button className="bnav-item" data-tab="forum" onClick={(e) => handleSwitchTabMobile('forum', e)}>
        <span className="bicon" style={{ color: '#8b5cf6' }}>📚</span>Forum
      </button>
      <button id="bnav-chat-item" className="bnav-item" data-tab="globalchat" onClick={(e) => handleSwitchTabMobile('globalchat', e)}>
        <span className="bicon" style={{ color: '#f472b6' }}>💬</span>Chat
      </button>
      <button className="bnav-item" data-tab="news" onClick={(e) => handleSwitchTabMobile('news', e)}>
        <span className="bicon" style={{ color: '#fbbf24' }}>🗞️</span>News<span id="bnav-news-badge" className="bnav-badge" style={{ display: 'none' }}></span>
      </button>

      <button className="bnav-item" data-tab="goals" onClick={(e) => handleSwitchTabMobile('goals', e)}>
        <span className="bicon" style={{ color: '#f59e0b' }}>📝</span>Goals
      </button>
      <button className="bnav-item" data-tab="races" onClick={(e) => handleSwitchTabMobile('races', e)}>
        <span className="bicon" style={{ color: '#bc13fe' }}>🦄</span>Races
      </button>
      <button className="bnav-item" data-tab="changelog" onClick={(e) => handleSwitchTabMobile('changelog', e)}>
        <span className="bicon" style={{ color: 'var(--green)' }}>📋</span>Changelog
      </button>
      <button className="bnav-item" data-tab="testing" onClick={(e) => handleSwitchTabMobile('testing', e)}>
        <span className="bicon" style={{ color: '#8b5cf6' }}>🧪</span>Testing
      </button>
      <button className="bnav-item" data-tab="options" onClick={(e) => handleSwitchTabMobile('options', e)}>
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

      <button className="bnav-item" onClick={doLogout} style={{ color: 'var(--red)' }}>
        <span className="bicon">🚪</span>Logout
      </button>
    </nav>
  );
};

export default BottomNav;
