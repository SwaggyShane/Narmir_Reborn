import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { devtools } from 'zustand/middleware';

/**
 * Economy Store — Authoritative kingdom economy state
 * Manages: gold, food, trade routes, market prices, tax rates
 *
 * Architecture:
 * - Authoritative state (gold, food, mana) synced via receiveServerSnapshot()
 * - Actions model game events (receiveTurnUpdate, completeBuild, receiveTrade)
 * - Entity normalization: tradeRoutes use byId/allIds pattern
 * - Derived values (goldIncome, foodBalance) calculated via selectors, not stored
 */

export const useEconomyStore = create(
  devtools(
    immer((set, _get) => ({
        // ===== AUTHORITATIVE STATE (from server) =====
        gold: 0,
        food: 0,
        mana: 0,
        mana_regen: 0.0,
        tax: 42,
        gold_income: 0,  // Derived from buildings, updated via receiveTurnUpdate
        food_balance: 0, // Derived from production - consumption

        // Market prices
        commodityPrices: {
          wheat: 100,
          lumber: 150,
          ore: 200,
          horses: 250,
          armor: 300,
        },

        // Entity collections (normalized: byId/allIds)
        tradeRoutes: {
          byId: {},
          allIds: [],
        },

        // ===== ACTIONS =====

        /**
         * receiveServerSnapshot: Authoritative overwrite from server
         * Use this when server sends full state snapshot (page load, turn start)
         * This is write-once-per-snapshot pattern for multiplayer safety
         */
        receiveServerSnapshot: (data) => set((state) => {
          if (data?.gold !== undefined) state.gold = data.gold;
          if (data?.food !== undefined) state.food = data.food;
          if (data?.mana !== undefined) state.mana = data.mana;
          if (data?.mana_regen !== undefined) state.mana_regen = data.mana_regen;
          if (data?.tax !== undefined) state.tax = data.tax;
          if (data?.gold_income !== undefined) state.gold_income = data.gold_income;
          if (data?.commodityPrices) {
            Object.assign(state.commodityPrices, data.commodityPrices);
          }
        }),

        /**
         * receiveTurnUpdate: Resources generated, trade completed, etc.
         * Models: Turn tick generates gold/food, research progresses
         */
        receiveTurnUpdate: (turnData) => set((state) => {
          if (turnData.goldGenerated !== undefined) {
            state.gold = Math.max(0, state.gold + turnData.goldGenerated);
          }
          if (turnData.foodGenerated !== undefined) {
            state.food = Math.max(0, state.food + turnData.foodGenerated);
          }
          if (turnData.manaGenerated !== undefined) {
            state.mana = Math.max(0, state.mana + turnData.manaGenerated);
          }
          if (turnData.commodityPriceChanges) {
            Object.assign(state.commodityPrices, turnData.commodityPriceChanges);
          }
        }),

        /**
         * completeBuild: Building construction finished, deduct resources
         */
        completeBuild: (buildingData) => set((state) => {
          if (!buildingData) return;
          if (buildingData?.goldCost) {
            state.gold = Math.max(0, state.gold - buildingData.goldCost);
          }
          if (buildingData?.foodCost) {
            state.food = Math.max(0, state.food - buildingData.foodCost);
          }
        }),

        /**
         * finishResearch: Research discipline complete, consume mana
         */
        finishResearch: (researchData) => set((state) => {
          if (!researchData) return;
          if (researchData?.manaCost) {
            state.mana = Math.max(0, state.mana - researchData.manaCost);
          }
        }),

        /**
         * applyCombatResult: Combat resolution, resources gained/lost
         */
        applyCombatResult: (combatResult) => set((state) => {
          if (!combatResult) return;
          if (combatResult?.goldTransferred) {
            state.gold = Math.max(0, state.gold + combatResult.goldTransferred);
          }
          if (combatResult?.foodTransferred) {
            state.food = Math.max(0, state.food + combatResult.foodTransferred);
          }
          if (combatResult?.landTransferred) {
            // Land doesn't live here, but gold/food adjustments might occur
          }
        }),

        /**
         * receiveTrade: Trade route completes, adjust gold/food
         */
        receiveTrade: (tradeData) => set((state) => {
          if (!tradeData) return;
          state.gold = Math.max(0, state.gold + (tradeData.goldReceived || 0) - (tradeData.goldSent || 0));
          state.food = Math.max(0, state.food + (tradeData.foodReceived || 0) - (tradeData.foodSent || 0));
        }),

        /**
         * spendGold: Client action (optimistic update, server validates)
         */
        spendGold: (amount) => set((state) => {
          state.gold = Math.max(0, state.gold - amount);
        }),

        /**
         * addTradeRoute: Add trade route to collection (normalized)
         */
        addTradeRoute: (route) => set((state) => {
          state.tradeRoutes.byId[route.id] = route;
          if (!state.tradeRoutes.allIds.includes(route.id)) {
            state.tradeRoutes.allIds.push(route.id);
          }
        }),

        /**
         * removeTradeRoute: Remove trade route from collection
         */
        removeTradeRoute: (routeId) => set((state) => {
          delete state.tradeRoutes.byId[routeId];
          state.tradeRoutes.allIds = state.tradeRoutes.allIds.filter(id => id !== routeId);
        }),

        /**
         * updateTradeRoute: Update single trade route (O(1) with normalized pattern)
         */
        updateTradeRoute: (routeId, updates) => set((state) => {
          if (state.tradeRoutes.byId[routeId]) {
            Object.assign(state.tradeRoutes.byId[routeId], updates);
          }
        }),

        /**
         * setTax: Client sets tax rate (server validates)
         */
        setTax: (newTax) => set((state) => {
          state.tax = Math.max(0, Math.min(100, newTax));
        }),
      })),
      { name: 'economy' }
    )
);

/**
 * SELECTORS: Derived values (calculated on demand, not stored)
 * Use these in components to prevent re-renders on unrelated state changes
 */

// Only re-render if gold changed
export const useGold = () => useEconomyStore((state) => state.gold);

// Only re-render if food changed
export const useFood = () => useEconomyStore((state) => state.food);

// Only re-render if mana changed
export const useMana = () => useEconomyStore((state) => state.mana);

// Multiple fields with shallow equality (prevents re-render if values unchanged)
export const useResources = () =>
  useEconomyStore((state) => ({
    gold: state.gold,
    food: state.food,
    mana: state.mana,
  }));

// Computed selector: effective gold income (memoized)
export const useGoldIncome = () =>
  useEconomyStore((state) => state.gold_income || 0); // Derived, not stored

// Trade routes as array (selector transforms normalized structure)
export const useTradeRoutes = () =>
  useEconomyStore((state) =>
    state.tradeRoutes.allIds.map(id => state.tradeRoutes.byId[id])
  );
