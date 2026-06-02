import React, { useState, useEffect, useCallback, useMemo } from 'react';

const StudiesPanel = () => {
  const [activeTab, setActiveTab] = useState('tower');
  const [activeSchoolSubTab, setActiveSchoolSubTab] = useState('general');
  const [studiesData, setStudiesData] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchStudiesData = useCallback(async () => {
    try {
      const response = await fetch('/api/kingdom/studies/overview', {
        cache: 'no-store', // Force fresh data from server
        headers: { 'pragma': 'no-cache' }
      });
      if (response.ok) {
        const data = await response.json();
        setStudiesData(data);
      } else {
        console.error('Studies data fetch failed:', response.status);
      }
    } catch (err) {
      console.error('Failed to load studies data:', err);
    }
  }, []);

  // Fetch data on mount
  useEffect(() => {
    fetchStudiesData();
  }, [fetchStudiesData]);

  // Register hook to refresh when panel becomes active or game state updates
  useEffect(() => {
    const unregister = window.registerPanelReactHook?.('studies', () => {
      fetchStudiesData();
    });
    return () => unregister?.();
  }, [fetchStudiesData]);

  // Sync uncontrolled inputs with server data (skip if input is actively being edited)
  useEffect(() => {
    if (studiesData?.research_allocation) {
      const spellbookEl = document.getElementById('mage-alloc-spellbook');
      const schoolEl = document.getElementById('mage-alloc-school');
      // Only update if not currently focused by user
      if (spellbookEl && document.activeElement !== spellbookEl) {
        spellbookEl.value = studiesData.research_allocation.spellbook_mages || 0;
      }
      if (schoolEl && document.activeElement !== schoolEl) {
        schoolEl.value = studiesData.research_allocation.school_spellbook_mages || 0;
      }
    }
  }, [studiesData?.research_allocation]);

  const handleTabClick = useCallback((tabId) => {
    setActiveTab(tabId);
    if (tabId === "tower" && window.renderMageTowerPanel) window.renderMageTowerPanel();
    if (tabId === "school" && window.updateFocusPreview) window.updateFocusPreview();
    if (tabId === "shrine" && window.renderShrinePanel) window.renderShrinePanel();
    if (tabId === "slibrary" && window.renderLibraryPanel) window.renderLibraryPanel();
  }, []);

  const loadStudies = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await fetchStudiesData();
    } finally {
      setIsRefreshing(false);
    }
  }, [fetchStudiesData]);

  const updateFocusPreview = useCallback(() => {
    if (window.updateFocusPreview) window.updateFocusPreview();
  }, []);

  const saveResearchFocus = useCallback(() => {
    if (window.saveResearchFocus) window.saveResearchFocus();
  }, []);

  const race = window.gameState?.race || 'human';
  const researchAlloc = studiesData?.research_allocation || {};

  const updateAllocationDisplay = useCallback(() => {
    // Force re-render by reading current input values
    const spellbookEl = document.getElementById('mage-alloc-spellbook');
    const schoolEl = document.getElementById('mage-alloc-school');
    if (spellbookEl && schoolEl) {
      // Trigger a state update with current input values (clamped to non-negative)
      setStudiesData(prev => ({
        ...prev,
        research_allocation: {
          ...prev?.research_allocation,
          spellbook_mages: Math.max(0, parseInt(spellbookEl.value, 10) || 0),
          school_spellbook_mages: Math.max(0, parseInt(schoolEl.value, 10) || 0),
        }
      }));
    }
  }, []);

  // Memoize spell grouping by tier to avoid recalculation on every render
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

  return (
    <div id="studies" className="panel" style={{ display: 'none' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
        <div className="card-title">🏛️ Studies</div>
        <button className="base-btn" onClick={loadStudies} disabled={isRefreshing} style={{ fontSize: '11px', opacity: isRefreshing ? 0.6 : 0.7, padding: '4px 8px' }}>
          {isRefreshing ? '⟳ Syncing...' : '↻ Sync'}
        </button>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '16px', borderBottom: '2px solid var(--border2)', paddingBottom: 0 }}>
        <button className={`base-btn admin-tab ${activeTab === 'tower' ? 'active' : ''}`} onClick={() => handleTabClick('tower')} style={{ borderRadius: 0 }}>🗼 Tower</button>
        <button className={`base-btn admin-tab ${activeTab === 'school' ? 'active' : ''}`} onClick={() => handleTabClick('school')} style={{ borderRadius: 0 }}>🏫 School</button>
        <button id="studies-tab-shrine-btn" className={`base-btn admin-tab ${activeTab === 'shrine' ? 'active' : ''}`} onClick={() => handleTabClick('shrine')} style={{ borderRadius: 0 }}>
          {race === 'vampire' ? '🪦 Mausoleum' : '⛩️ Shrine'}
        </button>
        <button className={`base-btn admin-tab ${activeTab === 'slibrary' ? 'active' : ''}`} onClick={() => handleTabClick('slibrary')} style={{ borderRadius: 0 }}>📖 Library</button>
      </div>

      {/* TOWER TAB */}
      <div style={{ display: activeTab === 'tower' ? 'block' : 'none' }}>
        <div className="r-grid-2">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div className="card" style={{ margin: 0 }}>
              <div className="card-title">Tower Operations</div>
              <div className="trow">
                <span className="name">Towers</span><span className="count" id="st-towers">0</span>
              </div>
              <div className="trow">
                <span className="name">Mana/turn</span><span className="count" id="st-mana-turn" style={{ color: 'var(--accent1)' }}>0</span>
              </div>
              <div className="trow">
                <span className="name">Mages (Current/Cap)</span>
                <span className="count"><span id="st-mages-tower">0</span> / <span id="st-tower-cap">0</span></span>
              </div>
              <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
                <div id="st-tower-list"></div>
              </div>
            </div>

            <div className="card" style={{ margin: 0 }}>
              <div className="card-title">Scroll inventory</div>
              <div id="st-tower-scroll-inventory" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ fontSize: '13px', color: 'var(--text3)' }}>No scrolls in your tower.</div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div className="card" style={{ margin: 0 }}>
              <div className="card-title">Crafting progress</div>
              <div id="st-tower-craft-progress" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontSize: '13px', color: 'var(--text3)' }}>No scrolls being crafted.</div>
              </div>
            </div>

            <div className="card" style={{ margin: 0 }}>
              <div className="card-title">Tower upgrades</div>
              <div id="tower-upgrade-list"></div>
            </div>
          </div>
        </div>
      </div>

      {/* SCHOOL TAB */}
      <div style={{ display: activeTab === 'school' ? 'block' : 'none' }}>
        {/* School Sub-tabs */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '16px', borderBottom: '2px solid var(--border2)', paddingBottom: 0 }}>
          <button
            className={`base-btn admin-tab ${activeSchoolSubTab === 'general' ? 'active' : ''}`}
            onClick={() => setActiveSchoolSubTab('general')}
            style={{ borderRadius: 0 }}
          >
            📚 General Studies
          </button>
          {(studiesData?.school_of_magic || window.gameState?.school_of_magic) && (
            <button
              className={`base-btn admin-tab ${activeSchoolSubTab === 'school' ? 'active' : ''}`}
              onClick={() => setActiveSchoolSubTab('school')}
              style={{ borderRadius: 0 }}
            >
              🔮 {(studiesData?.school_of_magic || window.gameState?.school_of_magic)?.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
            </button>
          )}
        </div>

        {/* GENERAL STUDIES SUB-TAB */}
        <div style={{ display: activeSchoolSubTab === 'general' ? 'block' : 'none' }}>
          <div className="r-grid-2" style={{ marginBottom: '12px' }}>
            <div className="card" style={{ margin: 0 }}>
              <div className="card-title" style={{ marginBottom: '10px' }}>General Spellbook</div>
              <div className="trow">
                <span className="name">Researchers</span><span className="count" id="st-researchers">0</span>
              </div>
              <div className="trow">
                <span className="name">Capacity</span><span className="count" id="st-school-cap">0</span>
              </div>
              <div className="trow">
                <span className="name">Spellbook Level</span><span className="count" id="st-general-spellbook-level">0%</span>
              </div>
            </div>
            <div className="card" style={{ margin: 0 }}>
              <div className="card-title" style={{ marginBottom: '10px' }}>School upgrades</div>
              <div id="school-upgrade-list"></div>
            </div>
          </div>

          {/* Research focus - locked to spellbook */}
          <div className="card">
            <div className="card-title" style={{ marginBottom: '8px' }}>Researcher Focus</div>
            <div style={{ fontSize: '12px', color: 'var(--text3)', marginBottom: '12px' }}>
              Researchers study the general spellbook. Once you reach level 100, you can choose a school of magic.
            </div>
            <div id="research-focus-slot-1" style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text2)', marginBottom: '6px' }}>Primary discipline</div>
              <select className="input" id="focus-select-1" style={{ width: '100%', marginBottom: '6px' }} onChange={updateFocusPreview}>
                <option value="economy">Economy</option>
                <option value="weapons">Weapons</option>
                <option value="armor">Armor</option>
                <option value="military">Military tactics</option>
                <option value="attack_magic">Attack magic</option>
                <option value="defense_magic">Defense magic</option>
                <option value="entertainment">Entertainment</option>
                <option value="construction">Construction</option>
                <option value="war_machines">War machines</option>
                {!window.gameState?.school_of_magic && <option value="spellbook">Spellbook</option>}
              </select>
              <div style={{ fontSize: '11px', color: 'var(--text3)' }} id="focus-current-1"></div>
            </div>
            <div id="research-focus-slot-2" style={{ display: 'none', marginBottom: '12px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text2)', marginBottom: '6px' }}>
                Secondary discipline <span style={{ color: 'var(--gold)', fontSize: '10px' }}>Repository</span>
              </div>
              <select className="input" id="focus-select-2" style={{ width: '100%', marginBottom: '6px' }} onChange={updateFocusPreview}>
                <option value="economy">Economy</option>
                <option value="weapons">Weapons</option>
                <option value="armor">Armor</option>
                <option value="military">Military tactics</option>
                <option value="attack_magic">Attack magic</option>
                <option value="defense_magic">Defense magic</option>
                <option value="entertainment">Entertainment</option>
                <option value="construction">Construction</option>
                <option value="war_machines">War machines</option>
                {!window.gameState?.school_of_magic && <option value="spellbook">Spellbook</option>}
              </select>
            </div>
            <button className="base-btn variant-green w-full" onClick={saveResearchFocus} style={{ width: '100%', background: 'var(--green)' }}>Save focus</button>
            <div id="study-progress-list"></div>

            {window.gameState?.res_spellbook >= 100 && !window.gameState?.school_of_magic && (
              <div style={{ marginTop: '16px', padding: '12px', background: 'var(--bg3)', borderRadius: 'var(--radius)', border: '1px solid var(--gold)', color: 'var(--gold)', fontSize: '13px', textAlign: 'center' }}>
                ✨ <strong>School selection available!</strong> You can now choose a school of magic. Visit the school selection panel.
              </div>
            )}
          </div>
        </div>

        {/* SCHOOL OF MAGIC SUB-TAB */}
        {(studiesData?.school_of_magic || window.gameState?.school_of_magic) && (
          <div style={{ display: activeSchoolSubTab === 'school' ? 'block' : 'none' }}>
            {/* School Header */}
            <div className="card" style={{ marginBottom: '12px', textAlign: 'center' }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>🔮</div>
              <div className="card-title" style={{ marginBottom: '4px', textTransform: 'capitalize' }}>
                {(studiesData?.school_of_magic || window.gameState?.school_of_magic)?.replace(/_/g, ' ')}
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text3)', marginBottom: '8px' }}>
                School of Magic
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text2)', lineHeight: 1.5, marginTop: '8px' }}>
                {studiesData?.school_lore || 'Loading school information...'}
              </div>
            </div>

            {/* Mage Allocation Section */}
            <div className="card" style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <div className="card-title" style={{ marginBottom: '2px' }}>Mage Research</div>
                  <div style={{ fontSize: '12px', color: 'var(--text3)' }}>
                    Total Mages: <span id="mage-total" style={{ color: 'var(--text)' }}>0</span> · Available: <span id="mage-available" style={{ color: 'var(--green)' }}>0</span> · Allocated: <span id="mage-allocated" style={{ color: 'var(--gold)' }}>0</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="base-btn variant-red" onClick={() => { if (window.releaseMageAllocation) window.releaseMageAllocation(); }} style={{ whiteSpace: 'nowrap', background: 'var(--red)' }}>Release all</button>
                  <button className="base-btn variant-accent" onClick={() => { if (window.studyMagic) window.studyMagic(); }} style={{ whiteSpace: 'nowrap', background: 'var(--accent1)', color: '#fff' }}>Study</button>
                </div>
              </div>

              <div className="r-grid-2">
                {/* Spellbook Allocation */}
                <div style={{ padding: '12px', background: 'var(--bg2)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '10px', color: 'var(--text)' }}>📖 Spellbook</div>
                  <div style={{ fontSize: '11px', color: 'var(--text3)', marginBottom: '8px' }}>General spellbook continuation</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input
                      type="number"
                      className="input"
                      id="mage-alloc-spellbook"
                      min="0"
                      defaultValue={researchAlloc.spellbook_mages || 0}
                      onChange={() => {
                        updateAllocationDisplay();
                        if (window.updateMageAllocationDisplay) window.updateMageAllocationDisplay();
                      }}
                      style={{ textAlign: 'right', flex: 1 }}
                      placeholder="Qty"
                    />
                    <button className="base-btn" onClick={() => { if (window.setMageMax) window.setMageMax('spellbook'); }} style={{ padding: '4px 8px', fontSize: '10px' }}>Max</button>
                  </div>
                </div>

                {/* School Spellbook Allocation */}
                <div style={{ padding: '12px', background: 'var(--bg2)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '10px', color: 'var(--text)' }}>🔮 School Spellbook</div>
                  <div style={{ fontSize: '11px', color: 'var(--text3)', marginBottom: '8px' }}>School-specific specialization</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input
                      type="number"
                      className="input"
                      id="mage-alloc-school"
                      min="0"
                      defaultValue={researchAlloc.school_spellbook_mages || 0}
                      onChange={() => {
                        updateAllocationDisplay();
                        if (window.updateMageAllocationDisplay) window.updateMageAllocationDisplay();
                      }}
                      style={{ textAlign: 'right', flex: 1 }}
                      placeholder="Qty"
                    />
                    <button className="base-btn" onClick={() => { if (window.setMageMax) window.setMageMax('school'); }} style={{ padding: '4px 8px', fontSize: '10px' }}>Max</button>
                  </div>
                </div>
              </div>
            </div>

            {/* Mage Research Cards */}
            <div className="r-grid-2">
              {/* Card 1: Spellbook Continuation */}
              <div className="card" style={{ margin: 0, padding: '16px' }}>
                <div style={{ fontSize: '24px', marginBottom: '8px' }}>📖</div>
                <div className="card-title" style={{ marginBottom: '2px', fontSize: '14px' }}>Spellbook</div>
                <div style={{ fontSize: '11px', color: 'var(--text3)', marginBottom: '12px' }}>Mages continuing study</div>

                <div className="trow">
                  <span className="name">Level</span>
                  <span className="count">{studiesData?.res_spellbook || 0}%</span>
                </div>
                <div className="trow">
                  <span className="name">Progress</span>
                  <span className="count">—</span>
                </div>
                <div className="trow">
                  <span className="name">Mages assigned</span>
                  <span className="count">{researchAlloc.spellbook_mages || 0}</span>
                </div>

                <div style={{ marginTop: '12px', fontSize: '11px', color: 'var(--text3)' }}>
                  Turns to next level: —
                </div>
              </div>

              {/* Card 2: School Spellbook */}
              <div className="card" style={{ margin: 0, padding: '16px' }}>
                <div style={{ fontSize: '24px', marginBottom: '8px' }}>🔮</div>
                <div className="card-title" style={{ marginBottom: '2px', fontSize: '14px' }} id="school-spellbook-title">School Spellbook</div>
                <div style={{ fontSize: '11px', color: 'var(--text3)', marginBottom: '12px' }}>Mages specializing</div>

                <div className="trow">
                  <span className="name">Level</span>
                  <span className="count">{studiesData?.school_spellbook || 0}%</span>
                </div>
                <div className="trow">
                  <span className="name">Progress</span>
                  <span className="count">—</span>
                </div>
                <div className="trow">
                  <span className="name">Mages assigned</span>
                  <span className="count">{researchAlloc.school_spellbook_mages || 0}</span>
                </div>

                <div style={{ marginTop: '12px', fontSize: '11px', color: 'var(--text3)' }}>
                  Turns to next level: —
                </div>
              </div>
            </div>

            {/* Spell Tiers Reveal */}
            <div className="card">
              <div className="card-title" style={{ marginBottom: '12px' }}>Spell Tiers</div>
              <div style={{ fontSize: '12px', color: 'var(--text3)', marginBottom: '16px' }}>
                As your mages study the {(studiesData?.school_of_magic || window.gameState?.school_of_magic)?.replace(/_/g, ' ')} school, spells become available.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {Object.keys(spellsByTier).length > 0 ? (
                  Object.keys(spellsByTier)
                    .map(Number)
                    .sort((a, b) => a - b)
                    .map(tier => (
                      <div key={`tier-${tier}`}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '8px' }}>
                          Tier {tier} Spells {tier > 1 && `(requires ${(tier - 1) * 20}% school_spellbook)`}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginLeft: '12px' }}>
                          {spellsByTier[tier].map(spell => {
                            const isRevealed = (studiesData.school_spellbook || 0) >= (spell.min_school_spellbook || 0);
                            return (
                              <div key={spell.id} style={{ fontSize: '12px', color: isRevealed ? 'var(--text2)' : 'var(--text3)' }}>
                                {isRevealed ? (
                                  <>
                                    <span style={{ marginRight: '8px' }}>✨</span>
                                    <strong>{spell.name}</strong> — {spell.desc}
                                  </>
                                ) : (
                                  <>
                                    <span style={{ marginRight: '8px' }}>⬜</span>
                                    <span style={{ color: 'var(--text3)' }}>??? (requires {spell.min_school_spellbook}% school_spellbook)</span>
                                  </>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))
                ) : (
                  <div style={{ fontSize: '13px', color: 'var(--text3)' }}>Loading spell structure...</div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* SHRINE TAB */}
      <div style={{ display: activeTab === 'shrine' ? 'block' : 'none' }}>
        <div className="r-grid-2">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div className="card" style={{ margin: 0 }}>
              <div className="card-title" id="st-shrine-ops">Shrine Operations</div>
              <div className="trow">
                <span className="name" id="st-shrine-name">Shrines</span>
                <span className="count" id="st-shrines">0</span>
              </div>
              <div className="trow">
                <span className="name" id="st-cleric-name">Clerics (Current/Cap)</span>
                <span className="count"><span id="st-clerics-shrine">0</span> / <span id="st-shrine-cap">0</span></span>
              </div>
              <div className="trow" id="st-shrine-row-morale" style={{ display: 'none' }}>
                <span className="name">Morale gain/turn</span>
                <span className="count" id="st-morale-gain" style={{ color: 'var(--green)' }}>0</span>
              </div>
              <div className="trow" id="st-shrine-row-sanctuary" style={{ display: 'none' }}>
                <span className="name">Divine Sanctuary</span>
                <span className="count" id="st-sanctuary">—</span>
              </div>
              <div style={{ marginTop: '12px', fontSize: '12px', color: 'var(--text3)', lineHeight: 1.5 }} id="st-shrine-desc">
                Clerics auto-populate Shrines up to capacity to heal battle injuries.
              </div>
            </div>
            <div className="card" style={{ margin: 0 }}>
              <div className="card-title" id="st-shrine-upg-title">Shrine upgrades</div>
              <div id="shrine-upgrade-list"></div>
            </div>
          </div>
          <div className="card" style={{ margin: 0 }}>
            <div className="card-title" id="st-shrine-eff-title">Shrine effects</div>
            <div id="st-shrine-eff-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px', color: 'var(--text2)', lineHeight: 1.7 }}>
              <div>
                💊 <strong style={{ color: 'var(--text)' }}>Battle healing</strong> — after any combat, clerics in shrines automatically restore a portion of injured troops before the next turn.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* LIBRARY TAB */}
      <div style={{ display: activeTab === 'slibrary' ? 'block' : 'none' }}>
        <div className="r-grid-2">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div className="card" style={{ margin: 0 }}>
              <div className="card-title">Library Operations</div>
              <div className="trow">
                <span className="name">Library</span><span className="count" id="st-libraries">0</span>
              </div>
              <div className="trow">
                <span className="name">Scribes (Current/Cap)</span>
                <span className="count"><span id="st-scribes-lib">0</span> / <span id="st-lib-cap">0</span></span>
              </div>
              <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
                <div id="st-lib-list"></div>
                <div id="st-lib-hybrids" style={{ marginTop: '10px' }}></div>
                <div id="st-lib-location-maps" style={{ marginTop: '16px' }}></div>
              </div>
            </div>

            <div className="card" style={{ margin: 0 }}>
              <div className="card-title">Maps &amp; Blueprints</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', textAlign: 'center' }}>
                <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '10px' }}>
                  <div style={{ fontSize: '20px', marginBottom: '2px' }}>🗺️</div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--gold)' }} id="st-lib-maps">0</div>
                  <div style={{ fontSize: '10px', color: 'var(--text3)' }}>Maps</div>
                </div>
                <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '10px' }}>
                  <div style={{ fontSize: '20px', marginBottom: '2px' }}>📐</div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--amber)' }} id="st-lib-blueprints">0</div>
                  <div style={{ fontSize: '10px', color: 'var(--text3)' }}>Blueprints</div>
                </div>
              </div>
            </div>

            <div className="card" style={{ margin: 0 }}>
              <div className="card-title">World Survey</div>
              <div id="survey-map-container" style={{ background: '#0a0d10', borderRadius: '6px', border: '1px solid var(--border)', height: '200px', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <canvas id="survey-map-canvas" width="400" height="200" style={{ width: '100%', height: '100%' }}></canvas>
                <div id="survey-empty" style={{ position: 'absolute', color: 'var(--text3)', fontSize: '12px', pointerEvents: 'none' }}>No locations mapped yet.</div>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '8px', textAlign: 'center' }}>
                Mapped kingdoms are shown relative to your capital.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div className="card" style={{ margin: 0 }}>
              <div className="card-title">Crafting progress</div>
              <div id="st-lib-craft-progress" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontSize: '13px', color: 'var(--text3)' }}>Nothing being crafted.</div>
              </div>
            </div>
            <div className="card" style={{ margin: 0 }}>
              <div className="card-title">Library upgrades</div>
              <div id="library-upgrade-list"></div>
            </div>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', gridColumn: '1/-1' }}>
            <div className="card" style={{ margin: 0 }}>
              <div className="card-title">Lore</div>
              <div id="library-lore-list" style={{ fontSize: '13px', color: 'var(--text2)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                Loading lore...
              </div>
            </div>
            <div className="card" style={{ margin: 0 }}>
              <div className="card-title">Achievements</div>
              <div id="library-achievements" style={{ marginBottom: '12px', fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudiesPanel;
