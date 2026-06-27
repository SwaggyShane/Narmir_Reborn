import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { devtools } from 'zustand/middleware';
import { persist } from 'zustand/middleware';
import { useShallow } from 'zustand/react';

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

        // Research focus and school management
        research_focus: [], // Array of focused disciplines [primary, secondary]
        research_allocation: {
          spellbook_mages: 0,
          school_spellbook_mages: 0,
        }, // Mage allocation across schools
        school_of_magic: null, // Researched school name or null
        school_level: 0, // School advancement level
        school_upgrades: {}, // Completed school upgrades
        researchers: 0, // Total mages/researchers available

        // ===== CLIENT-OWNED STATE (UI only) =====
        selectedDiscipline: 'warfare',
        researchAllocationUI: {}, // User's allocation form state before submitting

        // ===== ACTIONS =====

        /**
         * receiveServerSnapshot: Overwrite authoritative research state
         */
        receiveServerSnapshot: (data) => set((state) => {
          if (!data) return;
          if (data.mana !== undefined) {
            state.mana = data.mana;
          }
          if (data.mana_regen !== undefined) {
            state.mana_regen = data.mana_regen;
          }
          if (data.disciplineProgress) {
            Object.assign(state.disciplineProgress, data.disciplineProgress);
          }
          if (data.research_focus !== undefined) {
            state.research_focus = data.research_focus;
          }
          if (data.research_allocation !== undefined) {
            Object.assign(state.research_allocation, data.research_allocation);
          }
          if (data.school_of_magic !== undefined) {
            state.school_of_magic = data.school_of_magic;
          }
          if (data.school_level !== undefined) {
            state.school_level = data.school_level;
          }
          if (data.school_upgrades !== undefined) {
            Object.assign(state.school_upgrades, data.school_upgrades);
          }
          if (data.researchers !== undefined) {
            state.researchers = data.researchers;
          }
        }),

        /**
         * completeResearch: Discipline research finished, update XP/level
         */
        completeResearch: (disciplineData) => set((state) => {
          if (!disciplineData || !disciplineData.discipline) return;
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
          if (!xpData) return;
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
          state.researchAllocationUI = allocation;
        }),

        /**
         * submitResearchAllocation: Send allocation to server
         */
        submitResearchAllocation: () => set((state) => {
          // Allocation sent to server; local copy cleared
          state.researchAllocationUI = {};
        }),

        /**
         * allocateResearchers: Update mage allocation to schools
         */
        allocateResearchers: (allocation) => set((state) => {
          Object.assign(state.research_allocation, allocation);
        }),

        /**
         * setResearchFocus: Set primary and secondary research focus
         */
        setResearchFocus: (focus) => set((state) => {
          state.research_focus = Array.isArray(focus) ? focus : [];
        }),

        /**
         * updateSchoolOfMagic: Set or update researched school
         */
        updateSchoolOfMagic: (school) => set((state) => {
          state.school_of_magic = school;
        }),

        /**
         * updateSchoolLevel: Update school advancement level
         */
        updateSchoolLevel: (level) => set((state) => {
          state.school_level = Math.max(0, level);
        }),

        /**
         * updateSchoolUpgrades: Add or update school upgrades
         */
        updateSchoolUpgrades: (upgrades) => set((state) => {
          Object.assign(state.school_upgrades, upgrades);
        }),

        /**
         * updateResearchersCount: Update available researcher count
         */
        updateResearchersCount: (count) => set((state) => {
          state.researchers = Math.max(0, count);
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
  useResearchStore(useShallow((state) => state.activeResearch));

export const useSelectedDiscipline = () =>
  useResearchStore((state) => state.selectedDiscipline);

export const useResearchFocus = () =>
  useResearchStore((state) => state.research_focus);

export const useResearchAllocation = () =>
  useResearchStore((state) => state.research_allocation);

export const useSchoolOfMagic = () =>
  useResearchStore((state) => state.school_of_magic);

export const useSchoolLevel = () =>
  useResearchStore((state) => state.school_level);

export const useSchoolUpgrades = () =>
  useResearchStore((state) => state.school_upgrades);

export const useResearchersCount = () =>
  useResearchStore((state) => state.researchers);
