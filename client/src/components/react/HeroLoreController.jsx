import React, { useCallback, useEffect, useState } from 'react';
import LoreModal from './LoreModal.jsx';
import HeroLoreContent from './HeroLoreContent.jsx';
import { apiCall } from '../../utils/api.mjs';
import { registerShowHeroLore } from '../../utils/showHeroLore.js';
import { registerOpenHeroLore } from '../../utils/openHeroLore.js';
import { repairMojibake } from '../../utils/repairMojibake.js';

/**
 * Always-mounted controller for hero lore modals opened from HeroesPanel,
 * RacesPanel, RaceLoreController, or anywhere else that calls showHeroLore().
 */
export default function HeroLoreController() {
  const [heroLoreKey, setHeroLoreKey] = useState(null);
  const [heroClasses, setHeroClasses] = useState(null);

  const repair = useCallback((v) => repairMojibake(String(v ?? '')), []);

  const ensureHeroClasses = useCallback(async () => {
    if (heroClasses) return heroClasses;
    try {
      const result = await apiCall('/api/hero/all-classes');
      if (result && !result.error) {
        setHeroClasses(result);
        return result;
      }
    } catch (e) {
      console.error('[HeroLoreController] Failed to load hero classes:', e);
    }
    return null;
  }, [heroClasses]);

  const openByKey = useCallback(async (key) => {
    if (!key) return;
    const classes = await ensureHeroClasses();
    if (classes?.[key]) setHeroLoreKey(key);
  }, [ensureHeroClasses]);

  const openByName = useCallback(async (heroName) => {
    if (!heroName) return;
    const classes = await ensureHeroClasses();
    const found = Object.entries(classes || {}).find(([, c]) => c?.name === heroName);
    if (found) setHeroLoreKey(found[0]);
  }, [ensureHeroClasses]);

  useEffect(() => registerOpenHeroLore(openByKey), [openByKey]);
  useEffect(() => registerShowHeroLore(openByName), [openByName]);

  const heroData = heroLoreKey && heroClasses ? heroClasses[heroLoreKey] : null;

  return (
    <LoreModal
      isOpen={!!heroLoreKey && !!heroData}
      onClose={() => setHeroLoreKey(null)}
      title={heroData ? `${repair(heroData.name || '')} Class Lore` : 'Hero Lore'}
    >
      {heroData && heroLoreKey ? (
        <HeroLoreContent heroKey={heroLoreKey} hero={heroData} />
      ) : null}
    </LoreModal>
  );
}