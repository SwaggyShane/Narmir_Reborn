import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useGameActions } from '../../hooks/useGameActions.js';
import { useGameState } from '../../hooks/useGameState.js';
import { switchTab } from '../../utils/switchTab.js';
import { PANEL_META } from '../../utils/panelMeta.js';

const PANEL_ENTRIES = Object.entries(PANEL_META).map(([id, meta]) => ({ id, ...meta }));

const CommandPalette = () => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const { state } = useGameState();
  const { takeTurn, loading } = useGameActions();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return PANEL_ENTRIES;
    return PANEL_ENTRIES.filter((entry) => {
      const hay = [entry.label, entry.section, ...(entry.keywords || [])].join(' ').toLowerCase();
      return hay.includes(q) || entry.id.includes(q);
    });
  }, [query]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
    setHighlight(0);
  }, []);

  const run = useCallback((entry) => {
    if (!entry) return;
    close();
    switchTab(entry.id);
  }, [close]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((prev) => !prev);
        setQuery('');
        setHighlight(0);
        return;
      }
      if (!open) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
        return;
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setHighlight((idx) => Math.min(idx + 1, Math.max(0, filtered.length - 1)));
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setHighlight((idx) => Math.max(idx - 1, 0));
        return;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        run(filtered[highlight]);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, filtered, highlight, close, run]);

  useEffect(() => {
    setHighlight(0);
  }, [query]);

  if (!open) return null;

  const turns = state?.turns_stored ?? 0;

  return (
    <div
      className="command-palette-overlay fixed inset-0 z-[12000] flex items-start justify-center bg-black/60 px-4 pt-[12vh] backdrop-blur-[2px]"
      onClick={close}
      role="presentation"
    >
      <div
        className="command-palette w-full max-w-lg overflow-hidden rounded-xl border border-ember-900/50 bg-void-950/98 shadow-panel"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Command palette"
      >
        <input
          autoFocus
          type="search"
          className="w-full border-b border-white/10 bg-transparent px-4 py-3 text-[15px] text-text outline-none placeholder:text-text3"
          placeholder="Jump to panel or type a keyword…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="max-h-[50vh] overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <div className="px-4 py-6 text-center text-[13px] text-text3">No matching panels</div>
          ) : filtered.map((entry, idx) => (
            <button
              key={entry.id}
              type="button"
              className={[
                'flex w-full items-center gap-3 px-4 py-2.5 text-left text-[13px] transition',
                idx === highlight ? 'bg-ember-500/15 text-text' : 'text-text2 hover:bg-white/5',
              ].join(' ')}
              onMouseEnter={() => setHighlight(idx)}
              onClick={() => run(entry)}
            >
              <span className="text-lg leading-none">{entry.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="font-semibold text-text">{entry.label}</span>
                <span className="ml-2 text-[11px] text-text3">{entry.section}</span>
              </span>
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-white/10 px-4 py-2 text-[11px] text-text3">
          <span>Ctrl+K | arrow keys | Enter | Esc</span>
          <button
            type="button"
            className="turn-btn !px-3 !py-1 !text-[12px]"
            disabled={loading.takeTurn || turns < 1}
            onClick={() => {
              close();
              void takeTurn();
            }}
          >
            {loading.takeTurn ? 'Processing…' : `Take Turn (${turns})`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;