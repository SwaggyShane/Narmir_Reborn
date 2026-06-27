import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { devtools } from 'zustand/middleware';
import { persist } from 'zustand/middleware';

/**
 * UI State Store — Panel visibility, modals, UI preferences
 *
 * IMPORTANT: Stores persistent UI state only (panel visibility, sort order, filters)
 * Transient state (hoveredItem, form inputs) stays in component-level useState
 *
 * Persistence strategy: UI state persists across page reloads;
 * never persist game metrics (server is authoritative)
 */

export const useUIStore = create(
  persist(
    devtools(
      immer((set, _get) => ({
        // ===== PANEL STATE =====
        activePanel: 'economy',

        // Per-panel UI preferences (persisted)
        panelState: {
          build: {
            sortBy: 'time',
            filter: 'all',
            selectedItem: null,
            visibleColumns: ['name', 'level', 'progress'],
          },
          warfare: {
            selectedDefense: null,
            showReports: false,
            sortBy: 'strength',
          },
          economy: {
            sortBy: 'profit',
            showMarket: false,
          },
          research: {
            selectedDiscipline: 'warfare',
            sortBy: 'progress',
          },
          alliances: {
            sortBy: 'reputation',
            filter: 'all',
          },
        },

        // ===== MODAL STATE =====
        openModals: {
          'confirm-attack': false,
          'trade-dialog': false,
          'settings': false,
          'help': false,
          'unit-info': false,
        },

        // ===== SEARCH/FILTER STATE (persisted) =====
        searchText: '',

        // ===== ACTIONS =====

        /**
         * setActivePanel: Switch visible panel
         */
        setActivePanel: (panelName) => set((state) => {
          state.activePanel = panelName;
        }),

        /**
         * setPanelState: Update panel's local UI preferences
         * Immer allows direct mutation; automatically immutable
         */
        setPanelState: (panelName, updates) => set((state) => {
          if (state.panelState[panelName]) {
            Object.assign(state.panelState[panelName], updates);
          }
        }),

        /**
         * updatePanelNested: Deep update for nested panel state
         * Example: state.panelState.build.visibleColumns
         */
        updatePanelNested: (panelName, path, value) => set((state) => {
          if (!state.panelState[panelName]) return;

          const keys = path.split('.');
          let current = state.panelState[panelName];

          for (let i = 0; i < keys.length - 1; i++) {
            if (!current[keys[i]]) {
              current[keys[i]] = {};
            }
            current = current[keys[i]];
          }

          current[keys[keys.length - 1]] = value;
        }),

        /**
         * clearPanelState: Reset panel to defaults
         */
        clearPanelState: (panelName) => set((state) => {
          // Define defaults per panel
          const defaults = {
            build: {
              sortBy: 'time',
              filter: 'all',
              selectedItem: null,
              visibleColumns: ['name', 'level', 'progress'],
            },
            warfare: {
              selectedDefense: null,
              showReports: false,
              sortBy: 'strength',
            },
            economy: {
              sortBy: 'profit',
              showMarket: false,
            },
            research: {
              selectedDiscipline: 'warfare',
              sortBy: 'progress',
            },
            alliances: {
              sortBy: 'reputation',
              filter: 'all',
            },
          };

          if (defaults[panelName]) {
            state.panelState[panelName] = defaults[panelName];
          }
        }),

        // ===== MODAL MANAGEMENT =====

        /**
         * toggleModal: Open/close modal by name
         */
        toggleModal: (modalName) => set((state) => {
          if (state.openModals[modalName] !== undefined) {
            state.openModals[modalName] = !state.openModals[modalName];
          }
        }),

        /**
         * openModal: Explicitly open modal
         */
        openModal: (modalName) => set((state) => {
          if (state.openModals[modalName] !== undefined) {
            state.openModals[modalName] = true;
          }
        }),

        /**
         * closeModal: Explicitly close modal
         */
        closeModal: (modalName) => set((state) => {
          if (state.openModals[modalName] !== undefined) {
            state.openModals[modalName] = false;
          }
        }),

        /**
         * closeAllModals: Close all open modals
         */
        closeAllModals: () => set((state) => {
          Object.keys(state.openModals).forEach((key) => {
            state.openModals[key] = false;
          });
        }),

        // ===== SEARCH/FILTER STATE =====

        /**
         * setSearchText: Update search input (persisted)
         */
        setSearchText: (text) => set((state) => {
          state.searchText = text;
        }),

        /**
         * clearSearch: Reset search
         */
        clearSearch: () => set((state) => {
          state.searchText = '';
        }),
      })),
      { name: 'ui' }
    ),
    {
      name: 'ui-store',
      partialize: (state) => ({
        // Persist panel and UI preferences
        activePanel: state.activePanel,
        panelState: state.panelState,
        searchText: state.searchText,
        // Don't persist modals (transient state)
        // Don't persist openModals (user wouldn't expect modals to persist)
      }),
    }
  )
);

/**
 * SELECTORS
 */

export const useActivePanel = () => useUIStore((state) => state.activePanel);

export const usePanelState = (panelName) =>
  useUIStore((state) => state.panelState[panelName]);

export const useOpenModals = () => useUIStore((state) => state.openModals);

export const useModal = (modalName) =>
  useUIStore((state) => state.openModals[modalName] || false);

export const useSearchText = () => useUIStore((state) => state.searchText);

/**
 * UTILITIES: Direct state access for imperative scenarios
 * Example: useUIStore.getState().closeAllModals() from event handlers
 */
export const getUIState = () => useUIStore.getState();
