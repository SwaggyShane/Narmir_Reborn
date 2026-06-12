import React, { useState } from 'react';
import SchoolSelectionModal from './SchoolSelectionModal';
import { useGameState } from '../../hooks/useGameState';

/**
 * SchoolSelectionPanel
 * Shows the school selection modal when:
 *   - res_spellbook >= 100
 *   - school_of_magic is unset
 *
 * Pure store consumer — re-renders automatically when state changes.
 * No registry, no fetch.
 */
export default function SchoolSelectionPanel() {
  const { state, applyUpdates } = useGameState();
  const [dismissed, setDismissed] = useState(false);

  const shouldShow =
    !dismissed &&
    (state.res_spellbook || 0) >= 100 &&
    !state.school_of_magic;

  if (!shouldShow) return null;

  const handleSuccess = (data) => {
    setDismissed(true);
    // Funnel through the single mutation entry point with reason 'school'
    // so any panel listening for that reason refreshes.
    window.applyGameMutation(
      { updates: { school_of_magic: data.school } },
      { reason: 'school' },
    );
    // Keep window.gameState in sync for legacy reads (applyGameMutation
    // already mirrors, but be explicit for this branch).
    applyUpdates({ school_of_magic: data.school }, 'school');

    const label = data.school
      .split('_')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
    window.toast?.(`🔮 You have chosen the school of ${label}!`, 'success');
  };

  return (
    <SchoolSelectionModal
      onClose={() => setDismissed(true)}
      onSuccess={handleSuccess}
    />
  );
}
