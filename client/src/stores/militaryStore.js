import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { devtools } from 'zustand/middleware';
import { persist } from 'zustand/middleware';

/**
 * Military Store — Troops, armies, combat, walls, war machines
 *
 * Includes Combat V2 state (HP tracking, injuries, equipment)
 * Entity normalization: armies use byId/allIds pattern for O(1) updates
 */

export const useMillitaryStore = create(
  persist(
    devtools(
      immer((set, _get) => ({
        // ===== AUTHORITATIVE STATE (from server) =====
        troops: {
          fighters: 0,
          rangers: 0,
          mages: 0,
          clerics: 0,
          ninjas: 0,
          thieves: 0,
          engineers: 0,
          war_machines: 0,
        },

        // Combat V2: Individual troop HP tracking
        injuredTroops: {
          fighters: 0,
          rangers: 0,
          mages: 0,
          clerics: 0,
          ninjas: 0,
          thieves: 0,
          engineers: 0,
        },

        // Wall state
        wall_hp: 1000,
        wall_defense_type: 'fortified',

        // Equipment levels (Combat V2)
        equipment_levels: {
          armor: 1,
          weapons: 1,
          shields: 1,
        },

        // Entity collections (normalized)
        armies: {
          byId: {},
          allIds: [],
        },

        // Combat state
        activeCombat: null,

        lastCombatResult: null,

        // ===== CLIENT-OWNED STATE (UI only) =====
        selectedArmy: null,
        pendingAttack: null,

        // ===== ACTIONS =====

        /**
         * receiveServerSnapshot: Overwrite authoritative military state
         */
        receiveServerSnapshot: (data) => set((state) => {
          if (data.troops) {
            Object.assign(state.troops, data.troops);
          }
          if (data.injuredTroops) {
            Object.assign(state.injuredTroops, data.injuredTroops);
          }
          if (data.wall_hp !== undefined) {
            state.wall_hp = data.wall_hp;
          }
          if (data.wall_defense_type) {
            state.wall_defense_type = data.wall_defense_type;
          }
          if (data.equipment_levels) {
            Object.assign(state.equipment_levels, data.equipment_levels);
          }
        }),

        /**
         * receiveTurnUpdate: Troops recruited, injured troops recover, etc.
         */
        receiveTurnUpdate: (turnData) => set((state) => {
          if (turnData.troopsRecruited) {
            Object.keys(turnData.troopsRecruited).forEach((unitType) => {
              state.troops[unitType] = (state.troops[unitType] || 0) + turnData.troopsRecruited[unitType];
            });
          }
          if (turnData.injuredTroopsRecovered) {
            Object.keys(turnData.injuredTroopsRecovered).forEach((unitType) => {
              state.injuredTroops[unitType] = Math.max(
                0,
                (state.injuredTroops[unitType] || 0) - turnData.injuredTroopsRecovered[unitType]
              );
            });
          }
        }),

        /**
         * applyCombatResult: Combat finished, update troops, walls, equipment
         */
        applyCombatResult: (combatResult) => set((state) => {
          state.lastCombatResult = combatResult;

          if (combatResult.defenderCasualties) {
            Object.keys(combatResult.defenderCasualties).forEach((unitType) => {
              state.troops[unitType] = Math.max(0, (state.troops[unitType] || 0) - combatResult.defenderCasualties[unitType]);
            });
          }

          if (combatResult.wallDamage) {
            state.wall_hp = Math.max(0, state.wall_hp - combatResult.wallDamage);
          }

          if (combatResult.activeCombat) {
            state.activeCombat = combatResult.activeCombat;
          } else {
            state.activeCombat = null;
          }
        }),

        /**
         * injureTroops: Combat V2 injury tracking
         */
        injureTroops: (injuryCounts) => set((state) => {
          Object.keys(injuryCounts).forEach((unitType) => {
            state.injuredTroops[unitType] = (state.injuredTroops[unitType] || 0) + injuryCounts[unitType];
          });
        }),

        /**
         * damageWalls: Wall HP reduction from combat
         */
        damageWalls: (damage) => set((state) => {
          state.wall_hp = Math.max(0, state.wall_hp - damage);
        }),

        /**
         * addArmy: Create new army (normalized collection)
         */
        addArmy: (army) => set((state) => {
          state.armies.byId[army.id] = army;
          if (!state.armies.allIds.includes(army.id)) {
            state.armies.allIds.push(army.id);
          }
        }),

        /**
         * removeArmy: Delete army from collection
         */
        removeArmy: (armyId) => set((state) => {
          delete state.armies.byId[armyId];
          state.armies.allIds = state.armies.allIds.filter(id => id !== armyId);
        }),

        /**
         * updateArmy: Update single army (O(1) with normalization)
         */
        updateArmy: (armyId, updates) => set((state) => {
          if (state.armies.byId[armyId]) {
            Object.assign(state.armies.byId[armyId], updates);
          }
        }),

        /**
         * selectArmy: UI selection (client-owned state)
         */
        selectArmy: (armyId) => set((state) => {
          state.selectedArmy = armyId;
        }),

        /**
         * setPendingAttack: Optimistic state before user confirms attack
         */
        setPendingAttack: (attackData) => set((state) => {
          state.pendingAttack = attackData;
        }),

        /**
         * cancelPendingAttack: User cancels pending action
         */
        cancelPendingAttack: () => set((state) => {
          state.pendingAttack = null;
        }),

        /**
         * recruitTroops: Train troops (deducts resources via economyStore)
         */
        recruitTroops: (unitType, count) => set((state) => {
          state.troops[unitType] = (state.troops[unitType] || 0) + count;
        }),
      })),
      { name: 'military' }
    ),
    {
      name: 'military-store',
      partialize: (state) => ({
        // Persist UI state only
        selectedArmy: state.selectedArmy,
        // Don't persist pendingAttack (transient optimistic state)
      }),
    }
  )
);

/**
 * SELECTORS
 */

export const useTroops = () => useMillitaryStore((state) => state.troops);

export const useInjuredTroops = () => useMillitaryStore((state) => state.injuredTroops);

export const useWallHp = () => useMillitaryStore((state) => state.wall_hp);

export const useArmies = () =>
  useMillitaryStore((state) =>
    state.armies.allIds.map(id => state.armies.byId[id])
  );

export const useSelectedArmy = () =>
  useMillitaryStore((state) => {
    if (!state.selectedArmy) return null;
    return state.armies.byId[state.selectedArmy];
  });

export const usePendingAttack = () => useMillitaryStore((state) => state.pendingAttack);

export const useLastCombatResult = () => useMillitaryStore((state) => state.lastCombatResult);
