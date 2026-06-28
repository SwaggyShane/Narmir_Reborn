import React, { useEffect, useState } from 'react';
import SchoolSelectionModal from './SchoolSelectionModal';
import { toast } from '../../utils/toast.js';
import { apiCall } from '../../utils/api';
import { useResearchStore, useSchoolOfMagic, useResSpellbook } from '../../stores';

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
  const spellbook = useResSpellbook();
  const school = useSchoolOfMagic();

  // Sync school_of_magic from server on mount (handles page refresh)
  useEffect(() => {
    const syncSchoolFromServer = async () => {
      try {
        const data = await apiCall('/api/kingdom/studies/overview');
        if (data && data.school_of_magic) {
          useResearchStore.getState().updateSchoolOfMagic(data.school_of_magic);
        }
      } catch (err) {
        // Silently fail - the school will be set when user selects it
      }
    };
    syncSchoolFromServer();
  }, []);

  useEffect(() => {
    const shouldShowModal = (spellbook || 0) >= 100 && !school;
    setShowModal(shouldShowModal);
  }, [spellbook, school]);

  const handleModalClose = () => {
    setShowModal(false);
  };

  const handleSuccess = (data) => {
    // Close modal and update game state
    setShowModal(false);

    // Update game state with new school
    useResearchStore.getState().updateSchoolOfMagic(data.school);

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
