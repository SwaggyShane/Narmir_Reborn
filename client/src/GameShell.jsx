import React, { useState, useEffect } from 'react';
import { gameStateManager } from './GameStateManager';

const GameShell = () => {
  const [activePanel, setActivePanel] = useState('status');
  const [kingdom, setKingdom] = useState({});

  useEffect(() => {
    const updateKingdom = () => {
      const state = gameStateManager.getState?.() || {};
      setKingdom(state.kingdom || {});
    };

    updateKingdom();
    gameStateManager.addListener?.(updateKingdom);

    return () => gameStateManager.removeListener?.(updateKingdom);
  }, []);

  const renderPanel = () => {
    switch (activePanel) {
      case 'status':
        return <div className="text-center py-20 text-zinc-400">Status Panel (React)</div>;
      case 'studies':
        return <div className="text-center py-20 text-zinc-400">Studies Panel (React)</div>;
      default:
        return <div className="text-center py-20 text-zinc-400">Panel "{activePanel}" loaded</div>;
    }
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-void-950 text-zinc-200">
      {/* Top Bar */}
      <div className="h-14 border-b border-ember-900/50 bg-black/90 backdrop-blur-md flex items-center px-6 z-50 flex-shrink-0">
        <div className="flex items-center gap-4 flex-1">
          <div className="text-2xl font-bold tracking-widest text-ember-400">NARMIR REBORN</div>
          <div className="text-xs text-zinc-500 hidden sm:block">Pure. Damn. Evil.</div>
        </div>

        <button 
          onClick={() => gameStateManager.takeTurn?.()}
          className="ml-8 px-6 py-2 bg-gradient-to-r from-ember-500 to-orange-600 hover:from-ember-600 hover:to-orange-700 rounded-xl font-bold text-sm transition-all active:scale-95 shadow-lg"
        >
          TAKE TURN
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <div className="w-60 border-r border-ember-900/50 bg-void-900 hidden md:flex flex-col overflow-y-auto">
          <nav className="p-3 space-y-1">
            {['status', 'studies', 'economy', 'build', 'warfare', 'globalchat'].map((key) => (
              <button
                key={key}
                onClick={() => setActivePanel(key)}
                className={`w-full text-left px-4 py-3 rounded-xl flex items-center gap-3 transition-all text-sm capitalize ${
                  activePanel === key 
                    ? 'bg-ember-950 text-ember-400 border-l-2 border-ember-500 font-medium' 
                    : 'hover:bg-void-800 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {key}
              </button>
            ))}
          </nav>
        </div>

        {/* Resource Strip */}
        <div className="w-64 border-r border-ember-900/50 bg-void-900/70 hidden lg:flex flex-col overflow-y-auto p-4">
          <div className="text-xs uppercase tracking-widest text-ember-400 mb-6">RESOURCES</div>
          <div className="space-y-3 md:space-y-4 lg:space-y-6">
            <div className="bg-void-800 border border-ember-900/50 rounded-xl p-4 text-sm">
              <div className="text-amber-400 text-xs">GOLD</div>
              <div className="text-2xl font-bold text-white">38m</div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-auto p-6 bg-void-950">
            {renderPanel()}
          </div>

          {/* Footer */}
          <div className="h-10 border-t border-ember-900/50 bg-black/80 flex items-center px-6 text-xs text-zinc-500 flex-shrink-0">
            <div>● SYSTEM CLOUD SYNCED</div>
            <div className="ml-auto">UPTIME: 00h 00m 10s</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameShell;