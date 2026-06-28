import React from 'react';
import UpgradesList from '../UpgradesList.jsx';
import { SHRINE_UPGRADES } from '../../../utils/studiesUpgrades.js';
import { parseOwnedUpgrades } from '../../../utils/upgradeUtils.js';

export const ShrineTab = ({ studiesData, state, onUpgraded }) => {
  const shrineLabel = state?.race === 'vampire' ? '🪦 Mausoleum' : '⛩️ Shrine';

  return (
    <div className="r-grid-2">
      <div className="flex flex-col gap-3">
        <div className="card m-0">
          <div className="card-title" id="st-shrine-ops">Shrine Operations</div>
          <div className="trow">
            <span className="name" id="st-shrine-name">Shrines</span>
            <span className="count" id="st-shrines">0</span>
          </div>
          <div className="trow">
            <span className="name" id="st-cleric-name">Clerics (Current/Cap)</span>
            <span className="count"><span id="st-clerics-shrine">0</span> / <span id="st-shrine-cap">0</span></span>
          </div>
          <div className="trow hidden" id="st-shrine-row-happiness">
            <span className="name">Happiness gain/turn</span>
            <span className="count" id="st-happiness-gain" style={{ color: 'var(--green)' }}>0</span>
          </div>
          <div className="trow hidden" id="st-shrine-row-sanctuary">
            <span className="name">Divine Sanctuary</span>
            <span className="count" id="st-sanctuary">—</span>
          </div>
          <div className="mt-3 pt-3 text-xs text-[var(--text3)] border-t border-[var(--border)] leading-relaxed" id="st-shrine-desc">
            Clerics auto-populate Shrines up to capacity to heal battle injuries.
          </div>
        </div>
        <div className="card m-0">
          <div className="card-title" id="st-shrine-upg-title">Shrine upgrades</div>
          <UpgradesList
            category="shrine"
            defs={SHRINE_UPGRADES}
            owned={parseOwnedUpgrades(studiesData?.shrine_upgrades)}
            state={state || {}}
            onPurchased={(_, nextOwned) => onUpgraded('shrine', nextOwned)}
          />
        </div>
      </div>
      <div className="card m-0">
        <div className="card-title" id="st-shrine-eff-title">Shrine effects</div>
        <div id="st-shrine-eff-list" className="flex flex-col gap-2.5 text-xs text-[var(--text2)] leading-relaxed">
          <div>
            💊 <strong className="text-[var(--text)]">Battle healing</strong> — after any combat, clerics in shrines automatically restore a portion of injured troops before the next turn.
          </div>
        </div>
      </div>
    </div>
  );
};
