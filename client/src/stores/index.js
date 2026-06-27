/**
 * Zustand Stores Index
 *
 * Central export point for all domain stores.
 * Keeps imports clean: import { useEconomyStore } from 'src/stores'
 *
 * Domain-based architecture:
 * - economyStore: gold, food, trade routes, market prices
 * - militaryStore: troops, armies, combat, walls
 * - researchStore: research progress, disciplines, mana
 * - populationStore: population, happiness, growth, rebellion
 * - uiStore: panels, modals, UI preferences
 *
 * All stores use Immer (safe nested updates), DevTools (debugging),
 * and Persist (UI state only) middleware.
 */

export {
  // Economy Store
  useEconomyStore,
  useGold,
  useFood,
  useMana as useEconomyMana,
  useResources,
  useGoldIncome,
  useFoodBalance,
  useTradeRoutes,
  useBuildAllocation,
  useBuildProgress,
  useLand,
  useBuiltLand,
  useHammersStored,
  useHammerTurnsUsed,
  useLandAvailable,
  useWood,
  useStone,
  useIron,
  useSteel,
  useCoal,
  useBlueprintsStored,
  useScaffoldingStored,
  useBuildTraining,
  useBuildCount,
  useBuildingCounts,
  useResWeapons,
  useResMilitary,
  useResAttackMagic,
  useResWarMachines,
  useResEconomy,
  useResSpellbook,
  useResArmor,
  useResDefenseMagic,
  useResEntertainment,
  useResConstruction,
  useDiscoveredKingdoms,
  useTrainingAllocation,
  useTax,
  useTradeTargets,
} from './economyStore';

export {
  // Military Store
  useMilitaryStore,
  useTroops,
  useInjuredTroops,
  useWallHp,
  useArmies,
  useSelectedArmy,
  usePendingAttack,
  useLastCombatResult,
  useFighters,
  useRangers,
  useMages,
  useClerics,
  useNinjas,
  useThieves,
  useEngineers as useMilitaryEngineers,
  useWarMachines,
  useLadders,
  useThralls,
  useWeaponsStockpile,
  useArmorStockpile,
  useTroopLevels,
} from './militaryStore';

export {
  // Research Store
  useResearchStore,
  useMana as useResearchMana,
  useManaRegen,
  useDisciplineProgress,
  useDisciplineLevel,
  useActiveResearch,
  useSelectedDiscipline,
  useResearchFocus,
  useResearchAllocation,
  useSchoolOfMagic,
  useSchoolLevel,
  useSchoolUpgrades,
  useResearchersCount,
} from './researchStore';

export {
  // Population Store
  usePopulationStore,
  usePopulation,
  useHappiness,
  useHappinessBreakdown,
  useGrowthRate,
  useRebellionState,
  useShowHappinessBreakdown,
} from './populationStore';

export {
  // UI Store
  useUIStore,
  useActivePanel,
  usePanelState,
  useOpenModals,
  useModal,
  useSearchText,
  getUIState,
} from './uiStore';

export {
  // Profile Store
  useProfileStore,
  usePlayerName,
  useKingdomName,
  useLevel,
  useXp,
  usePrestige,
  useTurn,
  useScore,
  useRank,
  useKingdomId,
  useKingdomMetadata,
  useRace,
  useEngineers,
  useEngineerLevel,
  useEngineerXp,
  useEngineerXpNeeded,
  useScribes,
  useResearchers,
  useIsAdmin,
  useTurnsStored,
  useUsername,
  useRankingsCache,
  useDescription,
  useCustomPortrait,
  useGender,
} from './profileStore';

/**
 * SOCKET.IO INTEGRATION
 *
 * Example usage in socket event handlers:
 *
 * socket.on('kingdom-update', (data) => {
 *   useEconomyStore.getState().receiveServerSnapshot(data.economy);
 *   useMilitaryStore.getState().receiveServerSnapshot(data.military);
 *   useResearchStore.getState().receiveServerSnapshot(data.research);
 *   usePopulationStore.getState().receiveServerSnapshot(data.population);
 * });
 *
 * socket.on('turn-tick', (turnData) => {
 *   useEconomyStore.getState().receiveTurnUpdate(turnData);
 *   useMilitaryStore.getState().receiveTurnUpdate(turnData);
 *   useResearchStore.getState().receiveTurnUpdate(turnData);
 *   usePopulationStore.getState().receiveTurnUpdate(turnData);
 * });
 */

/**
 * INTER-STORE COMMUNICATION
 *
 * If one store needs to trigger actions in another:
 *
 * // In economyStore.js action:
 * spendGold: (amount) => set((state) => {
 *   state.gold = Math.max(0, state.gold - amount);
 *   if (state.gold === 0) {
 *     // Trigger modal in UI store
 *     useUIStore.getState().openModal('insufficient-funds');
 *   }
 * })
 *
 * Keep cross-store calls minimal; prefer having each store own its domain.
 */
