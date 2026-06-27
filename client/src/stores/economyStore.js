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

        // Resources (raw materials)
        wood: 0,
        stone: 0,
        iron: 0,
        steel: 0,
        coal: 0,

        // Resource modifiers (percentages: 100 = normal, 80 = -20%, 120 = +20%)
        res_weapons: 100,
        res_military: 100,
        res_attack_magic: 100,
        res_war_machines: 100,

        // Build system
        build_allocation: {},
        build_progress: {},
        land: 0,
        built_land: 0,
        hammers_stored: 0,
        hammer_turns_used: 0,
        blueprints_stored: 0,
        scaffolding_stored: 0,

        // Discovered kingdoms (for targeting UI)
        discovered_kingdoms: {},

        // Building counts (dynamic: bld_farms, bld_barracks, etc.)
        bld_farms: 0,
        bld_housing: 0,
        bld_granaries: 0,
        bld_taverns: 0,
        bld_markets: 0,
        bld_barracks: 0,
        bld_libraries: 0,
        bld_schools: 0,
        bld_shrines: 0,
        bld_mausoleums: 0,
        bld_guard_towers: 0,
        bld_walls: 0,
        bld_outposts: 0,
        bld_smithies: 0,
        bld_armories: 0,
        bld_vaults: 0,
        bld_mage_towers: 0,
        bld_training: 0,
        bld_castles: 0,

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
          if (data?.wood !== undefined) state.wood = data.wood;
          if (data?.stone !== undefined) state.stone = data.stone;
          if (data?.iron !== undefined) state.iron = data.iron;
          if (data?.steel !== undefined) state.steel = data.steel;
          if (data?.coal !== undefined) state.coal = data.coal;
          if (data?.res_weapons !== undefined) state.res_weapons = data.res_weapons;
          if (data?.res_military !== undefined) state.res_military = data.res_military;
          if (data?.res_attack_magic !== undefined) state.res_attack_magic = data.res_attack_magic;
          if (data?.res_war_machines !== undefined) state.res_war_machines = data.res_war_machines;
          if (data?.commodityPrices) {
            Object.assign(state.commodityPrices, data.commodityPrices);
          }
          if (data?.build_allocation !== undefined) state.build_allocation = data.build_allocation;
          if (data?.build_progress !== undefined) state.build_progress = data.build_progress;
          if (data?.land !== undefined) state.land = data.land;
          if (data?.built_land !== undefined) state.built_land = data.built_land;
          if (data?.hammers_stored !== undefined) state.hammers_stored = data.hammers_stored;
          if (data?.hammer_turns_used !== undefined) state.hammer_turns_used = data.hammer_turns_used;
          if (data?.blueprints_stored !== undefined) state.blueprints_stored = data.blueprints_stored;
          if (data?.scaffolding_stored !== undefined) state.scaffolding_stored = data.scaffolding_stored;
          if (data?.discovered_kingdoms !== undefined) state.discovered_kingdoms = data.discovered_kingdoms;
          // Sync building counts
          Object.keys(data || {}).forEach((key) => {
            if (key.startsWith('bld_')) {
              state[key] = data[key];
            }
          });
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

// Build system selectors
export const useBuildAllocation = () => useEconomyStore((state) => state.build_allocation);

export const useBuildProgress = () => useEconomyStore((state) => state.build_progress);

export const useLand = () => useEconomyStore((state) => state.land);

export const useBuiltLand = () => useEconomyStore((state) => state.built_land);

export const useHammersStored = () => useEconomyStore((state) => state.hammers_stored);

export const useHammerTurnsUsed = () => useEconomyStore((state) => state.hammer_turns_used);

export const useLandAvailable = () =>
  useEconomyStore((state) => Math.max(0, state.land - state.built_land));

// Resource selectors
export const useWood = () => useEconomyStore((state) => state.wood);

export const useStone = () => useEconomyStore((state) => state.stone);

export const useIron = () => useEconomyStore((state) => state.iron);

export const useSteel = () => useEconomyStore((state) => state.steel);

export const useCoal = () => useEconomyStore((state) => state.coal);

// Build system selectors
export const useBlueprintsStored = () => useEconomyStore((state) => state.blueprints_stored);

export const useScaffoldingStored = () => useEconomyStore((state) => state.scaffolding_stored);

// Building count selector (dynamic field access: bld_farms, bld_barracks, etc.)
export const useBuildCount = (buildingId) =>
  useEconomyStore((state) => Number(state[`bld_${buildingId}`] || 0));

// All building counts as object (for use in components without calling hooks in helpers)
export const useBuildingCounts = () =>
  useEconomyStore((state) => ({
    farms: state.bld_farms || 0,
    housing: state.bld_housing || 0,
    granaries: state.bld_granaries || 0,
    taverns: state.bld_taverns || 0,
    markets: state.bld_markets || 0,
    barracks: state.bld_barracks || 0,
    libraries: state.bld_libraries || 0,
    schools: state.bld_schools || 0,
    shrines: state.bld_shrines || 0,
    mausoleums: state.bld_mausoleums || 0,
    guard_towers: state.bld_guard_towers || 0,
    walls: state.bld_walls || 0,
    outposts: state.bld_outposts || 0,
    smithies: state.bld_smithies || 0,
    armories: state.bld_armories || 0,
    vaults: state.bld_vaults || 0,
    mage_towers: state.bld_mage_towers || 0,
    training: state.bld_training || 0,
    castles: state.bld_castles || 0,
  }));

// Resource modifiers
export const useResWeapons = () => useEconomyStore((state) => state.res_weapons || 100);

export const useResMilitary = () => useEconomyStore((state) => state.res_military || 100);

export const useResAttackMagic = () => useEconomyStore((state) => state.res_attack_magic || 100);

export const useResWarMachines = () => useEconomyStore((state) => state.res_war_machines || 100);

// Discovered kingdoms for warfare targeting
export const useDiscoveredKingdoms = () => useEconomyStore((state) => state.discovered_kingdoms || {});
