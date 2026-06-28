import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import clsx from 'clsx';
import UpgradesList from '../UpgradesList.jsx';
import { SCHOOL_UPGRADES, SHRINE_UPGRADES } from '../../../utils/studiesUpgrades.js';
import { parseOwnedUpgrades } from '../../../utils/upgradeUtils.js';
import { useResearchStore } from '../../../stores';
import { toast } from '../../../utils/toast.js';
import { MageAllocationCard } from './MageAllocationCard.jsx';
import { ResearchFocusSection } from './ResearchFocusSection.jsx';
import { SpellsGrid } from './SpellsGrid.jsx';

export const SchoolTab = ({
  studiesData,
  state,
  onUpgraded,
  mages,
  mageSpellbookValue,
  setMageSpellbookValue,
  mageSchoolValue,
  setMageSchoolValue,
  focus1Value,
  setFocus1Value,
  focus2Value,
  setFocus2Value,
  fetchStudiesData,
}) => {
  const [activeSchoolSubTab, setActiveSchoolSubTab] = useState('general');
  const spellbookInputRef = useRef(null);
  const schoolInputRef = useRef(null);

  const researchAlloc = studiesData?.research_allocation || {};
  const totalMages = Number(mages || 0);
  const allocatedMages = Number(researchAlloc.spellbook_mages || 0) + Number(researchAlloc.school_spellbook_mages || 0);
  const availableMages = Math.max(0, totalMages - allocatedMages);

  const setMageMax = useCallback((type) => {
    if (type === 'spellbook') {
      const maxAllowed = Math.max(0, totalMages - mageSchoolValue);
      setMageSpellbookValue(maxAllowed);
    } else {
      const maxAllowed = Math.max(0, totalMages - mageSpellbookValue);
      setMageSchoolValue(maxAllowed);
    }
  }, [totalMages, mageSpellbookValue, mageSchoolValue, setMageSpellbookValue, setMageSchoolValue]);

  const saveMageAllocation = useCallback(async () => {
    const spellbook = Math.max(0, mageSpellbookValue);
    const school_spellbook = Math.max(0, mageSchoolValue);
    if (spellbook + school_spellbook > totalMages) {
      toast(`Allocated ${spellbook + school_spellbook} mages, but only have ${totalMages}`, 'error');
      return;
    }
    const response = await fetch('/api/kingdom/school-allocation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ spellbook, school_spellbook }),
    });
    const data = await response.json();
    if (data.error) {
      toast(data.error, 'error');
      return;
    }
    if (data.ok) {
      await fetchStudiesData();
      toast('Mage allocation saved successfully', 'success');
    }
  }, [fetchStudiesData, mageSpellbookValue, mageSchoolValue, totalMages]);

  const releaseMageAllocation = useCallback(async () => {
    const response = await fetch('/api/kingdom/school-allocation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ spellbook: 0, school_spellbook: 0 }),
    });
    const data = await response.json();
    if (data.error) {
      toast(data.error, 'error');
      return;
    }
    if (data.ok) {
      setMageSpellbookValue(0);
      setMageSchoolValue(0);
      await fetchStudiesData();
      toast('Mage allocation released', 'success');
    }
  }, [fetchStudiesData, setMageSpellbookValue, setMageSchoolValue]);

  // Sync server data with local refs, guarding against overwriting active input
  useEffect(() => {
    if (studiesData?.research_allocation) {
      if (document.activeElement !== spellbookInputRef.current) {
        setMageSpellbookValue(studiesData.research_allocation.spellbook_mages || 0);
      }
      if (document.activeElement !== schoolInputRef.current) {
        setMageSchoolValue(studiesData.research_allocation.school_spellbook_mages || 0);
      }
    }
    if (studiesData?.research_focus) {
      const [f1, f2] = studiesData.research_focus;
      if (f1) setFocus1Value(f1);
      if (f2) setFocus2Value(f2);
    }
  }, [studiesData?.research_allocation, studiesData?.research_focus, setMageSpellbookValue, setMageSchoolValue, setFocus1Value, setFocus2Value]);

  const spellsByTier = useMemo(() => {
    if (!studiesData?.school_spells || studiesData.school_spells.length === 0) {
      return {};
    }
    const grouped = {};
    studiesData.school_spells.forEach(spell => {
      if (!grouped[spell.tier]) grouped[spell.tier] = [];
      grouped[spell.tier].push(spell);
    });
    return grouped;
  }, [studiesData?.school_spells]);

  const spellbookSpellsByTier = useMemo(() => {
    if (!studiesData?.spellbook_spells || studiesData.spellbook_spells.length === 0) {
      return {};
    }
    const grouped = {};
    studiesData.spellbook_spells.forEach(spell => {
      if (!grouped[spell.tier]) grouped[spell.tier] = [];
      grouped[spell.tier].push(spell);
    });
    return grouped;
  }, [studiesData?.spellbook_spells]);

  return (
    <div>
      {/* School Sub-tabs */}
      <div className="flex flex-wrap gap-1 mb-4 border-b-2 border-[var(--border2)] pb-0">
        <button
          className={clsx('base-btn admin-tab', activeSchoolSubTab === 'general' && 'active')}
          onClick={() => setActiveSchoolSubTab('general')}
          style={{ borderRadius: 0 }}
        >
          📚 General Studies
        </button>
        {(studiesData?.school_of_magic || state?.school_of_magic) && (
          <button
            className={clsx('base-btn admin-tab', activeSchoolSubTab === 'school' && 'active')}
            onClick={() => setActiveSchoolSubTab('school')}
            style={{ borderRadius: 0 }}
          >
            🔮 {(studiesData?.school_of_magic || state?.school_of_magic)?.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
          </button>
        )}
      </div>

      {/* GENERAL STUDIES SUB-TAB */}
      {activeSchoolSubTab === 'general' && (
        <div>
          <div className="r-grid-2 mb-3">
            <div className="card m-0">
              <div className="card-title !mb-2.5">General Spellbook</div>
              <div className="trow">
                <span className="name">Researchers</span>
                <span className="count" id="st-researchers">0</span>
              </div>
              <div className="trow">
                <span className="name">Capacity</span>
                <span className="count" id="st-school-cap">0</span>
              </div>
              <div className="trow">
                <span className="name">Spellbook Level</span>
                <span className="count" id="st-general-spellbook-level">0%</span>
              </div>
            </div>
            <div className="card m-0">
              <div className="card-title !mb-2.5">School upgrades</div>
              <UpgradesList
                category="school"
                defs={SCHOOL_UPGRADES}
                owned={parseOwnedUpgrades(studiesData?.school_upgrades)}
                state={state || {}}
                onPurchased={(_, nextOwned) => onUpgraded('school', nextOwned)}
              />
            </div>
          </div>

          <ResearchFocusSection
            studiesData={studiesData}
            state={state}
            focus1Value={focus1Value}
            setFocus1Value={setFocus1Value}
            focus2Value={focus2Value}
            setFocus2Value={setFocus2Value}
            fetchStudiesData={fetchStudiesData}
          />
        </div>
      )}

      {/* SCHOOL OF MAGIC SUB-TAB */}
      {activeSchoolSubTab === 'school' && (studiesData?.school_of_magic || state?.school_of_magic) && (
        <div>
          <div className="card mb-3 text-center">
            <div className="text-4xl mb-2">🔮</div>
            <div className="card-title !mb-0.5 capitalize text-base">
              {(studiesData?.school_of_magic || state?.school_of_magic)?.replace(/_/g, ' ')}
            </div>
            <div className="text-xs text-[var(--text3)] mb-2">School of Magic</div>
            <div className="text-xs text-[var(--text2)] leading-relaxed mt-2">
              {studiesData?.school_lore || 'Loading school information...'}
            </div>
          </div>

          <div className="card mb-4">
            <div className="flex items-center justify-between mb-3.5 flex-wrap gap-2">
              <div>
                <div className="card-title !mb-0.5">Mage Research</div>
                <div className="text-xs text-[var(--text3)]">
                  Total Mages: <span className="text-[var(--text)]">{ totalMages}</span> | Available: <span className="text-[var(--green)]">{availableMages}</span> | Allocated: <span className="text-[var(--gold)]">{allocatedMages}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <button className="base-btn variant-red whitespace-nowrap" onClick={releaseMageAllocation} style={{ background: 'var(--red)' }}>
                  Release all
                </button>
                <button className="base-btn variant-accent whitespace-nowrap" onClick={saveMageAllocation} style={{ background: 'var(--accent1)', color: '#fff' }}>
                  Study
                </button>
              </div>
            </div>

            <div className="r-grid-2">
              <MageAllocationCard
                title="📖 Spellbook"
                description="General spellbook continuation"
                value={mageSpellbookValue}
                onChange={(v) => setMageSpellbookValue(Math.max(0, v))}
                onMax={() => setMageMax('spellbook')}
                inputRef={spellbookInputRef}
              />
              <MageAllocationCard
                title="🔮 School Spellbook"
                description="School-specific specialization"
                value={mageSchoolValue}
                onChange={(v) => setMageSchoolValue(Math.max(0, v))}
                onMax={() => setMageMax('school')}
                inputRef={schoolInputRef}
              />
            </div>
          </div>

          <div className="r-grid-2">
            <SpellsGrid
              title="Spellbook"
              icon="📖"
              level={studiesData?.res_spellbook || 0}
              magesAssigned={researchAlloc.spellbook_mages || 0}
              spellsByTier={spellbookSpellsByTier}
            />
            {(studiesData?.school_of_magic || state?.school_of_magic) && (
              <SpellsGrid
                title={`${(studiesData?.school_of_magic || state?.school_of_magic)?.replace(/_/g, ' ')} Spells`}
                icon="🔮"
                level={studiesData?.school_spellbook || 0}
                magesAssigned={researchAlloc.school_spellbook_mages || 0}
                spellsByTier={spellsByTier}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};
