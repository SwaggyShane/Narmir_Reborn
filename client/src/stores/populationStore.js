import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { devtools } from 'zustand/middleware';
import { persist } from 'zustand/middleware';

/**
 * Population Store — Population, happiness, growth, special events
 */

export const usePopulationStore = create(
  persist(
    devtools(
      immer((set, _get) => ({
        // ===== AUTHORITATIVE STATE (from server) =====
        population: 1000,
        happiness: 50,

        // Happiness components (for detailed UI breakdown)
        happinessBreakdown: {
          food_component: 10,
          entertainment_component: 10,
          safety_component: 10,
          prosperity_component: 15,
          overcrowding_component: 5,
        },

        // Growth rate (happiness-dependent)
        growthRate: 0.01,

        // Rebellion state
        rebellionActive: false,
        rebellionTurnsRemaining: 0,

        // ===== CLIENT-OWNED STATE (UI only) =====
        showHappinessBreakdown: false,

        // ===== ACTIONS =====

        /**
         * receiveServerSnapshot: Overwrite authoritative population state
         */
        receiveServerSnapshot: (data) => set((state) => {
          if (data.population !== undefined) {
            state.population = data.population;
          }
          if (data.happiness !== undefined) {
            state.happiness = data.happiness;
          }
          if (data.happinessBreakdown) {
            Object.assign(state.happinessBreakdown, data.happinessBreakdown);
          }
          if (data.growthRate !== undefined) {
            state.growthRate = data.growthRate;
          }
          if (data.rebellionActive !== undefined) {
            state.rebellionActive = data.rebellionActive;
          }
          if (data.rebellionTurnsRemaining !== undefined) {
            state.rebellionTurnsRemaining = data.rebellionTurnsRemaining;
          }
        }),

        /**
         * receiveTurnUpdate: Population growth, happiness changes
         */
        receiveTurnUpdate: (turnData) => set((state) => {
          if (turnData.populationGrowth) {
            state.population += turnData.populationGrowth;
          }
          if (turnData.happinessChange !== undefined) {
            state.happiness = Math.max(-50, Math.min(120, state.happiness + turnData.happinessChange));
          }
          if (turnData.happinessBreakdown) {
            Object.assign(state.happinessBreakdown, turnData.happinessBreakdown);
          }
          if (turnData.growthRate !== undefined) {
            state.growthRate = turnData.growthRate;
          }
        }),

        /**
         * updateHappiness: Direct happiness update (e.g., from combat results)
         */
        updateHappiness: (happinessData) => set((state) => {
          if (happinessData.delta !== undefined) {
            state.happiness = Math.max(-50, Math.min(120, state.happiness + happinessData.delta));
          }
          if (happinessData.breakdown) {
            Object.assign(state.happinessBreakdown, happinessData.breakdown);
          }
        }),

        /**
         * applyCombatResult: Combat affects happiness
         */
        applyCombatResult: (combatResult) => set((state) => {
          if (combatResult.happinessChange !== undefined) {
            state.happiness = Math.max(-50, Math.min(120, state.happiness + combatResult.happinessChange));
          }
        }),

        /**
         * triggerRebellion: Start a rebellion event
         */
        triggerRebellion: (rebellionData) => set((state) => {
          state.rebellionActive = true;
          state.rebellionTurnsRemaining = rebellionData.duration || 10;
        }),

        /**
         * endRebellion: Rebellion resolved
         */
        endRebellion: () => set((state) => {
          state.rebellionActive = false;
          state.rebellionTurnsRemaining = 0;
        }),

        /**
         * toggleHappinessBreakdown: UI toggle for showing component breakdown
         */
        toggleHappinessBreakdown: () => set((state) => {
          state.showHappinessBreakdown = !state.showHappinessBreakdown;
        }),
      })),
      { name: 'population' }
    ),
    {
      name: 'population-store',
      partialize: (state) => ({
        // Persist UI state only
        showHappinessBreakdown: state.showHappinessBreakdown,
      }),
    }
  )
);

/**
 * SELECTORS
 */

export const usePopulation = () => usePopulationStore((state) => state.population);

export const useHappiness = () => usePopulationStore((state) => state.happiness);

export const useHappinessBreakdown = () =>
  usePopulationStore((state) => state.happinessBreakdown);

export const useGrowthRate = () => usePopulationStore((state) => state.growthRate);

export const useRebellionState = () =>
  usePopulationStore((state) => ({
    active: state.rebellionActive,
    turnsRemaining: state.rebellionTurnsRemaining,
  }));

export const useShowHappinessBreakdown = () =>
  usePopulationStore((state) => state.showHappinessBreakdown);
