import React from 'react';
import SchoolSelectionModal from './SchoolSelectionModal';
import { useGameState } from '../../hooks/useGameState.js';

export default function SchoolSelectionPanel() {
  const gs = useGameState();
  const showModal = (gs.res_spellbook || 0) >= 100 && !gs.school_of_magic;

  const handleModalClose = () => {
    // Modal hides automatically once school_of_magic is set in gameState
  };

  const handleSuccess = (data) => {
    window.gameState.school_of_magic = data.school;
    if (window.triggerReactUpdates) window.triggerReactUpdates();
    if (window.toast) {
      const name = data.school.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      window.toast(`🔮 You have chosen the school of ${name}!`, 'success');
    }
  };

  if (!showModal) return null;

  return (
    <SchoolSelectionModal
      onClose={handleModalClose}
      onSuccess={handleSuccess}
    />
  );
}
