import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { immer } from 'zustand/middleware/immer';
import { devtools } from 'zustand/middleware';

/**
 * Profile Store — Kingdom metadata (name, owner, level, turn, score, etc.)
 *
 * This store holds kingdom-level profile information that doesn't fit
 * into economy/military/research/population domains.
 */

export const useProfileStore = create(
  devtools(
    immer((set, _get) => ({
      // ===== AUTHORITATIVE STATE (from server) =====
      kingdom_id: null,  // Unique kingdom ID for combat/targeting
      username: '',
      owner_name: '',
      owner: '',
      name: '',
      kingdomName: '',
      level: 1,
      xp: 0,
      prestige_level: 0,
      turn: 0,
      score: 0,
      local_time: null,
      vampire_countdown: null,
      season: null,
      rank: null,  // World rank (computed on server, synced here)

      // Race and engineers
      race: '',
      engineers: 0,
      engineer_level: 1,
      engineer_xp: 0,
      engineer_xp_needed: 1000,

      // Support units
      scribes: 0,
      researchers: 0,

      // Admin and system
      isAdmin: false,
      turns_stored: 0,
      rankingsCache: [],

      // Kingdom profile
      description: '',
      customPortrait: null,

      // ===== ACTIONS =====

      /**
       * receiveServerSnapshot: Overwrite authoritative profile state
       */
      receiveServerSnapshot: (data) => set((state) => {
        if (data?.kingdom_id !== undefined) state.kingdom_id = data.kingdom_id;
        if (data?.username !== undefined) state.username = data.username;
        if (data?.owner_name !== undefined) state.owner_name = data.owner_name;
        if (data?.owner !== undefined) state.owner = data.owner;
        if (data?.name !== undefined) state.name = data.name;
        if (data?.kingdomName !== undefined) state.kingdomName = data.kingdomName;
        if (data?.level !== undefined) state.level = data.level;
        if (data?.xp !== undefined) state.xp = data.xp;
        if (data?.prestige_level !== undefined) state.prestige_level = data.prestige_level;
        if (data?.turn !== undefined) state.turn = data.turn;
        if (data?.score !== undefined) state.score = data.score;
        if (data?.local_time !== undefined) state.local_time = data.local_time;
        if (data?.vampire_countdown !== undefined) state.vampire_countdown = data.vampire_countdown;
        if (data?.season !== undefined) state.season = data.season;
        if (data?.rank !== undefined) state.rank = data.rank;
        if (data?.race !== undefined) state.race = data.race;
        if (data?.engineers !== undefined) state.engineers = data.engineers;
        if (data?.engineer_level !== undefined) state.engineer_level = data.engineer_level;
        if (data?.engineer_xp !== undefined) state.engineer_xp = data.engineer_xp;
        if (data?.engineer_xp_needed !== undefined) state.engineer_xp_needed = data.engineer_xp_needed;
        if (data?.scribes !== undefined) state.scribes = data.scribes;
        if (data?.researchers !== undefined) state.researchers = data.researchers;
        if (data?.isAdmin !== undefined) state.isAdmin = data.isAdmin;
        if (data?.turns_stored !== undefined) state.turns_stored = data.turns_stored;
        if (data?.rankingsCache !== undefined) state.rankingsCache = data.rankingsCache;
        if (data?.description !== undefined) state.description = data.description;
        if (data?.customPortrait !== undefined) state.customPortrait = data.customPortrait;
      }),

      /**
       * receiveTurnUpdate: Turn tick increments turn number
       */
      receiveTurnUpdate: (turnData) => set((state) => {
        if (turnData?.turn !== undefined) {
          state.turn = turnData.turn;
        }
      }),

      /**
       * updateDescription: Update kingdom description
       */
      updateDescription: (description) => set((state) => {
        state.description = description;
      }),

      /**
       * updateCustomPortrait: Update kingdom custom portrait URL
       */
      updateCustomPortrait: (portraitUrl) => set((state) => {
        state.customPortrait = portraitUrl;
      }),

      /**
       * updatePrestigeLevel: Update prestige level after rebirth
       */
      updatePrestigeLevel: (level) => set((state) => {
        state.prestige_level = level;
      }),
    })),
    { name: 'profile' }
  )
);

/**
 * SELECTORS
 */

export const usePlayerName = () =>
  useProfileStore((state) => state.username || state.owner_name || state.owner || 'Player');

export const useKingdomName = () =>
  useProfileStore((state) => state.name || state.kingdomName || 'Kingdom');

export const useLevel = () => useProfileStore((state) => state.level);

export const useXp = () => useProfileStore((state) => state.xp);

export const usePrestige = () => useProfileStore((state) => state.prestige_level);

export const useTurn = () => useProfileStore((state) => state.turn);

export const useScore = () => useProfileStore((state) => state.score);

export const useRank = () => useProfileStore((state) => state.rank);

export const useKingdomId = () => useProfileStore((state) => state.kingdom_id);

export const useKingdomMetadata = () =>
  useProfileStore(
    useShallow((state) => ({
      local_time: state.local_time,
      vampire_countdown: state.vampire_countdown,
      season: state.season,
    }))
  );

// Race and engineer selectors
export const useRace = () => useProfileStore((state) => state.race);

export const useEngineers = () => useProfileStore((state) => state.engineers);

export const useEngineerLevel = () => useProfileStore((state) => state.engineer_level);

export const useEngineerXp = () => useProfileStore((state) => state.engineer_xp);

export const useEngineerXpNeeded = () => useProfileStore((state) => state.engineer_xp_needed);

export const useScribes = () => useProfileStore((state) => state.scribes);

export const useResearchers = () => useProfileStore((state) => state.researchers);

export const useIsAdmin = () => useProfileStore((state) => state.isAdmin);

export const useTurnsStored = () => useProfileStore((state) => state.turns_stored);

export const useUsername = () => useProfileStore((state) => state.username);

export const useRankingsCache = () => useProfileStore((state) => state.rankingsCache);

export const useDescription = () => useProfileStore((state) => state.description);

export const useCustomPortrait = () => useProfileStore((state) => state.customPortrait);
