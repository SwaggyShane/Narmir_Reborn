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

      // ===== ACTIONS =====

      /**
       * receiveServerSnapshot: Overwrite authoritative profile state
       */
      receiveServerSnapshot: (data) => set((state) => {
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
      }),

      /**
       * receiveTurnUpdate: Turn tick increments turn number
       */
      receiveTurnUpdate: (turnData) => set((state) => {
        if (turnData?.turn !== undefined) {
          state.turn = turnData.turn;
        }
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

export const useKingdomMetadata = () =>
  useProfileStore(
    useShallow((state) => ({
      local_time: state.local_time,
      vampire_countdown: state.vampire_countdown,
      season: state.season,
    }))
  );
