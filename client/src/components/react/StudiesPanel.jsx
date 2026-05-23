import React, { useState } from 'react';

const StudiesPanel = () => {
  const [activeTab, setActiveTab] = useState('tower');

  const handleTabClick = (tabId) => {
    setActiveTab(tabId);
    if (tabId === "tower" && window.renderMageTowerPanel) window.renderMageTowerPanel();
    if (tabId === "school" && window.updateFocusPreview) window.updateFocusPreview();
    if (tabId === "shrine" && window.renderShrinePanel) window.renderShrinePanel();
    if (tabId === "slibrary" && window.renderLibraryPanel) window.renderLibraryPanel();
  };

  const loadStudies = () => {
    if (window.loadStudies) window.loadStudies();
  };

  const updateFocusPreview = () => {
    if (window.updateFocusPreview) window.updateFocusPreview();
  };

  const saveResearchFocus = () => {
    if (window.saveResearchFocus) window.saveResearchFocus();
  };

  const race = window.gameState?.race || 'human';

  return (
    <div id="studies" className="panel" style={{ display: 'none' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
        <div className="card-title">🏛️ Studies</div>
        <button className="base-btn" onClick={loadStudies}>↻ Refresh</button>
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
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
          <div className="card" style={{ margin: 0 }}>
            <div className="card-title" style={{ marginBottom: '10px' }}>School overview</div>
            <div className="trow">
              <span className="name">Schools</span><span className="count" id="st-schools">0</span>
            </div>
            <div className="trow">
              <span className="name">Researchers</span><span className="count" id="st-researchers">0</span>
            </div>
            <div className="trow">
              <span className="name">Capacity</span><span className="count" id="st-school-cap">0</span>
            </div>
          </div>
          <div className="card" style={{ margin: 0 }}>
            <div className="card-title" style={{ marginBottom: '10px' }}>School upgrades</div>
            <div id="school-upgrade-list"></div>
          </div>
        </div>
        
        {/* Research focus */}
        <div className="card">
          <div className="card-title" style={{ marginBottom: '8px' }}>Research focus</div>
          <div style={{ fontSize: '12px', color: 'var(--text3)', marginBottom: '12px' }}>
            Choose one discipline to study. Repository upgrade unlocks a second slot.
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
              <option value="spellbook">Spellbook</option>
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
              <option value="spellbook">Spellbook</option>
            </select>
          </div>
          <button className="base-btn variant-green w-full" onClick={saveResearchFocus} style={{ width: '100%', background: 'var(--green)' }}>Save focus</button>
          <div id="study-progress-list"></div>
        </div>
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
