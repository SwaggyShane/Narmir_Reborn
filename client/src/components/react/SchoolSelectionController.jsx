import React, { useEffect, useState } from 'react';
import { useGameState } from '../../hooks/useGameState';
import SchoolSelectionModal from './SchoolSelectionModal';
import { applyGameMutation } from '../../utils/gameMutations.js';
import { toast } from '../../utils/toast.js';

/**
 * SchoolSelectionController
 * Invisible controller/watcher that decides whether to show the school
 * selection modal when:
 * - res_spellbook >= 100
 * - school_of_magic is NULL (not yet chosen)
 *
 * This is NOT a panel — it renders null or a modal overlay, never its own panel.
 */
export default function SchoolSelectionController() {
  const [showModal, setShowModal] = useState(false);
  const { state } = useGameState();

  useEffect(() => {
    const shouldShowModal = (state?.res_spellbook || 0) >= 100 && !state?.school_of_magic;
    setShowModal(shouldShowModal);
  }, [state?.res_spellbook, state?.school_of_magic]);

  const handleModalClose = () => {
    setShowModal(false);
  };

  const handleSuccess = (data) => {
    // Close modal and update game state
    setShowModal(false);

    // Update game state with new school
    applyGameMutation({ school_of_magic: data.school }, { reason: 'school-selected' });

    // Show success message
    toast(`✨ You have chosen the school of ${data.school.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}!`, 'success');
  };

  // Don't show anything if modal shouldn't be visible
  if (!showModal) {
    return null;
  }

  return (
    <SchoolSelectionModal
      onClose={handleModalClose}
      onSuccess={handleSuccess}
    />
  );
}
