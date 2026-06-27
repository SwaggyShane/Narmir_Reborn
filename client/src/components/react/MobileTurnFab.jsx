import React from 'react';
import { useGameActions } from '../../hooks/useGameActions.js';
import { useTurnsStored } from '../../stores';
import { useNavLayout } from '../../hooks/useNavLayout.js';

const MobileTurnFab = () => {
  const turns = useTurnsStored() || 0;
  const { takeTurn, loading } = useGameActions();
  const { layout } = useNavLayout();
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