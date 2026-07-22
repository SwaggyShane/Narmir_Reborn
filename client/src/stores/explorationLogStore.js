import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { devtools } from 'zustand/middleware';
import { persist } from 'zustand/middleware';

/**
 * Exploration Log Store — "live" instant expedition-log entries (launch
 * confirmations, instant find results).
 *
 * Not server-backed at all, unlike activeExpeditions/completedExpeditions
 * (which ExplorationPanel re-fetches from /expedition/list on mount and so
 * survive fine on their own). This store exists specifically so the log
 * survives switching away from and back to the Exploration panel —
 * GameShell fully unmounts the inactive panel on every switch
 * (`switch (activePanel) { case 'exploration': ... }`), which was wiping a
 * component-local useState array on every navigation.
 *
 * Deliberately in-memory only (partialize returns {}): survives panel
 * switches because the store itself is a module-level singleton untouched
 * by component mount/unmount, but does not persist to localStorage across
 * a full page reload — these are live/ephemeral entries, not
 * server-authoritative history.
 */

const MAX_ENTRIES = 50;

export const useExplorationLogStore = create(
  persist(
    devtools(
      immer((set) => ({
        instantEntries: [],

        /** Prepend a new entry, capped at MAX_ENTRIES (matches prior useState behavior). */
        addInstantEntry: (entry) => set((state) => {
          state.instantEntries.unshift(entry);
          if (state.instantEntries.length > MAX_ENTRIES) {
            state.instantEntries.length = MAX_ENTRIES;
          }
        }),

        clearInstantEntries: () => set((state) => {
          state.instantEntries = [];
        }),
      })),
      { name: 'exploration-log' }
    ),
    {
      name: 'exploration-log-store',
      partialize: () => ({}),
    }
  )
);

/**
 * SELECTORS
 */

export const useInstantEntries = () => useExplorationLogStore((state) => state.instantEntries);

export const useAddInstantEntry = () => useExplorationLogStore((state) => state.addInstantEntry);

export const useClearInstantEntries = () => useExplorationLogStore((state) => state.clearInstantEntries);
