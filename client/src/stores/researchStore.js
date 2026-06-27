import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { devtools } from 'zustand/middleware';
import { persist } from 'zustand/middleware';

/**
 * Research Store — Disciplines, research progress, spell research
 */

export const useResearchStore = create(
  persist(
    devtools(
      immer((set, _get) => ({
        // ===== AUTHORITATIVE STATE (from server) =====
        mana: 500,
        mana_regen: 0.5,

        // Research discipline progress
        disciplineProgress: {
          warfare: { level: 1, xp: 0, xp_needed: 100 },
          economics: { level: 1, xp: 0, xp_needed: 100 },
          nature: { level: 1, xp: 0, xp_needed: 100 },
          sorcery: { level: 1, xp: 0, xp_needed: 100 },
          thievery: { level: 1, xp: 0, xp_needed: 100 },
          necromancy: { level: 1, xp: 0, xp_needed: 100 },
        },

        // Active research (normalized)
        activeResearch: {
          byId: {},
          allIds: [],
        },

        // ===== CLIENT-OWNED STATE (UI only) =====
        selectedDiscipline: 'warfare',
        researchAllocation: {}, // User's allocation before submitting

        // ===== ACTIONS =====

        /**
         * receiveServerSnapshot: Overwrite authoritative research state
         */
        receiveServerSnapshot: (data) => set((state) => {
          if (data.mana !== undefined) {
            state.mana = data.mana;
          }
          if (data.mana_regen !== undefined) {
            state.mana_regen = data.mana_regen;
          }
          if (data.disciplineProgress) {
            Object.assign(state.disciplineProgress, data.disciplineProgress);
          }
        }),

        /**
         * completeResearch: Discipline research finished, update XP/level
         */
        completeResearch: (disciplineData) => set((state) => {
          const discipline = state.disciplineProgress[disciplineData.discipline];
          if (discipline) {
            discipline.xp = disciplineData.xp || 0;
            if (disciplineData.levelUp) {
              discipline.level += 1;
              discipline.xp = 0;
              discipline.xp_needed = (discipline.xp_needed || 100) * 1.2;
            }
          }
        }),

        /**
         * spendMana: Mana spent on research, spells, etc.
         */
        spendMana: (amount, _reason) => set((state) => {
          state.mana = Math.max(0, state.mana - amount);
        }),

        /**
         * receiveManaGeneration: Mana produced each turn
         */
        receiveManaGeneration: (manaGenerated) => set((state) => {
          state.mana += manaGenerated;
        }),

        /**
         * receiveResearchXp: XP allocated to active research
         */
        receiveResearchXp: (xpData) => set((state) => {
          Object.keys(xpData).forEach((discipline) => {
            if (state.disciplineProgress[discipline]) {
              state.disciplineProgress[discipline].xp += xpData[discipline];
            }
          });
        }),

        /**
         * startResearch: Begin researching a discipline (add to activeResearch)
         */
        startResearch: (discipline, data) => set((state) => {
          const researchId = `${discipline}-${Date.now()}`;
          state.activeResearch.byId[researchId] = {
            id: researchId,
            discipline,
            progress: 0,
            ...data,
          };
          if (!state.activeResearch.allIds.includes(researchId)) {
            state.activeResearch.allIds.push(researchId);
          }
        }),

        /**
         * cancelResearch: Stop research in progress
         */
        cancelResearch: (researchId) => set((state) => {
          delete state.activeResearch.byId[researchId];
          state.activeResearch.allIds = state.activeResearch.allIds.filter(id => id !== researchId);
        }),

        /**
         * selectDiscipline: UI selection
         */
        selectDiscipline: (discipline) => set((state) => {
          state.selectedDiscipline = discipline;
        }),

        /**
         * setResearchAllocation: User input (not persisted until server accepts)
         */
        setResearchAllocation: (allocation) => set((state) => {
          state.researchAllocation = allocation;
        }),

        /**
         * submitResearchAllocation: Send allocation to server
         */
        submitResearchAllocation: () => set((state) => {
          // Allocation sent to server; local copy cleared
          state.researchAllocation = {};
        }),
      })),
      { name: 'research' }
    ),
    {
      name: 'research-store',
      partialize: (state) => ({
        // Persist UI state only
        selectedDiscipline: state.selectedDiscipline,
        // Don't persist researchAllocation (transient form state)
      }),
    }
  )
);

/**
 * SELECTORS
 */

export const useMana = () => useResearchStore((state) => state.mana);

export const useManaRegen = () => useResearchStore((state) => state.mana_regen);

export const useDisciplineProgress = () =>
  useResearchStore((state) => state.disciplineProgress);

export const useDisciplineLevel = (discipline) =>
  useResearchStore((state) => state.disciplineProgress[discipline]?.level || 1);

export const useActiveResearch = () =>
  useResearchStore((state) =>
    state.activeResearch.allIds.map(id => state.activeResearch.byId[id])
  );

export const useSelectedDiscipline = () =>
  useResearchStore((state) => state.selectedDiscipline);
