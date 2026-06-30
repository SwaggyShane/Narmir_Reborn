import React, { useEffect, useState } from 'react';
import SchoolSelectionModal from './SchoolSelectionModal';
import { toast } from '../../utils/toast.js';
import { useResearchStore, useSchoolOfMagic, useResSpellbook, useResearchSnapshotLoaded } from '../../stores';

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
  const researchLoaded = useResearchSnapshotLoaded();

  // Show modal only if spellbook >= 100 and school not yet chosen
  // (school_of_magic is synced from server in loadKingdom)
  useEffect(() => {
    if (!researchLoaded) {
      setShowModal(false);
      return;
    }
    const shouldShow = (spellbook || 0) >= 100 && !school;
    setShowModal(shouldShow);
  }, [researchLoaded, spellbook, school]);

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
