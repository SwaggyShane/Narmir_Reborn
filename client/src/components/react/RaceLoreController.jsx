import React, { useCallback, useEffect, useState } from 'react';
import LoreModal from './LoreModal.jsx';
import RaceLoreContent from './RaceLoreContent.jsx';
import { registerOpenRaceLore } from '../../utils/openRaceLore.js';
import { showHeroLore } from '../../utils/showHeroLore.js';
import { getRacePortrait } from '../../utils/racePortraits.js';
import { repairMojibake } from '../../utils/repairMojibake.js';
import { RACE_LORE, REGION_META, REGION_BONUSES } from '../../utils/raceData.js';

/**
 * Always-mounted controller for race lore modals opened from StatusPanel,
 * RacesPanel, or anywhere else that calls openRaceLore().
 */
export default function RaceLoreController() {
  const [selectedRace, setSelectedRace] = useState(null);
  const repair = useCallback((v) => repairMojibake(String(v ?? '')), []);

  useEffect(() => registerOpenRaceLore((race) => setSelectedRace(race || null)), []);

  const selectedLore = selectedRace ? RACE_LORE[selectedRace] : null;
  const portraitUrl = selectedRace ? (getRacePortrait(selectedRace, 'male') || '') : '';

  return (
    <LoreModal
      isOpen={!!selectedRace && !!selectedLore}
      onClose={() => setSelectedRace(null)}
      title={selectedLore ? `${repair(selectedLore.icon || '')} ${repair(selectedLore.title || '')}` : ''}
    >
      {selectedLore && selectedRace ? (
        <RaceLoreContent
          lore={selectedLore}
          regionName={repair((REGION_META[selectedRace] || {}).name || '')}
          regionBonus={REGION_BONUSES[selectedRace] || ''}
          portraitUrl={portraitUrl}
          repair={repair}
          onHeroClick={(name) => {
            setSelectedRace(null);
            showHeroLore(name);
          }}
        />
      ) : null}
    </LoreModal>
  );
}