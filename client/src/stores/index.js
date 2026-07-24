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
 * - profileStore: kingdom identity, turn, prestige, active_effects
 * - explorationLogStore: instant expedition log entries
 *
 * Active panel navigation lives in hooks/useActivePanel.js (module listeners),
 * not a Zustand store. All stores use Immer + DevTools as needed.
 */

export {
  // Economy Store
  useEconomyStore,
  useGold,
  useFood,
  useMana,
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
  useCoalStored,
  useSteelStored,
  useForgeFlags,
  useNextForgeUpgrade,
  useMaps,
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
  useResourceBuildAllocation,
  useTax,
  useTradeTargets,
  useBankUpgrades,
  useFarmUpgrades,
  useGranaryUpgrades,
  useMarketUpgrades,
  useTavernUpgrades,
  useWallUpgrades,
  useTowerDefUpgrades,
  useOutpostUpgrades,
  useMausoleumUpgrades,
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
  useResearchSnapshotLoaded,
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
  // Exploration Log Store
  useExplorationLogStore,
  useInstantEntries,
  useAddInstantEntry,
  useClearInstantEntries,
} from './explorationLogStore';

export {
  // Profile Store
  useProfileStore,
  usePlayerName,
  useKingdomName,
  useLevel,
  useXp,
  usePrestige,
  useLastPrestigeTurn,
  usePrestigeCooldownRemaining,
  useTurn,
  useScore,
  useRank,
  useKingdomId,
  useKingdomMetadata,
  useRace,
  useDefenseRating,
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
  useAllianceRankingsCache,
  useDescription,
  useCustomPortrait,
  useGender,
  useXpSources,
  useMilestoneBonuses,
  useMilestoneTitle,
  useActiveEffects,
} from './profileStore';
