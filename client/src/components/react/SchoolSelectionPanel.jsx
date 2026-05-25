import React, { useState, useEffect } from 'react';
import SchoolSelectionModal from './SchoolSelectionModal';

/**
 * SchoolSelectionPanel
 * Shows school selection modal when:
 * - res_spellbook >= 100
 * - school_of_magic is NULL (not yet chosen)
 */
export default function SchoolSelectionPanel() {
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    const updateModalVisibility = () => {
      const gameState = window.gameState || {};
      const shouldShowModal =
        (gameState.res_spellbook || 0) >= 100 &&
        !gameState.school_of_magic;

      setShowModal(shouldShowModal);
    };

    // Initial check
    updateModalVisibility();

    // Register hook for state updates
    const unreg = window.registerPanelReactHook &&
      window.registerPanelReactHook('school-selection', updateModalVisibility);

    return () => {
      if (unreg) unreg();
    };
  }, []);

  const handleModalClose = () => {
    setShowModal(false);
  };

  const handleSuccess = (data) => {
    // Close modal and update game state
    setShowModal(false);

    // Update game state with new school
    const gameState = window.gameState || {};
    gameState.school_of_magic = data.school;

    // Notify other panels of state change
    if (window.triggerReactUpdates) {
      window.triggerReactUpdates();
    }

    // Show success message
    if (window.toast) {
      window.toast(`🔮 You have chosen the school of ${data.school.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}!`, 'success');
    }
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
