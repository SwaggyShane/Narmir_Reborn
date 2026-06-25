import React from 'react';
import { useGameActions } from '../../hooks/useGameActions.js';
import { useGameState } from '../../hooks/useGameState.js';
import { useNavLayout } from '../../hooks/useNavLayout.js';

const MobileTurnFab = () => {
  const { state } = useGameState();
  const { takeTurn, loading } = useGameActions();
  const { layout } = useNavLayout();
  const turns = state?.turns_stored ?? 0;
  const show = layout === 'bottom' || layout === 'responsive';

  if (!show) return null;

  return (
    <button
      type="button"
      className="mobile-turn-fab lg:hidden"
      onClick={() => void takeTurn()}
      disabled={loading.takeTurn || turns < 1}
      aria-label={`Take turn, ${turns} remaining`}
    >
      <span className="mobile-turn-fab__label">
        {loading.takeTurn ? '…' : 'Turn'}
      </span>
      <span className="mobile-turn-fab__count">{turns}</span>
    </button>
  );
};

export default MobileTurnFab;