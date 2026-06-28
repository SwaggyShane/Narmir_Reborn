import React from 'react';
import UpgradesList from '../UpgradesList.jsx';
import { LIBRARY_UPGRADES } from '../../../utils/studiesUpgrades.js';
import { parseOwnedUpgrades } from '../../../utils/upgradeUtils.js';

export const LibraryTab = ({ studiesData, state, onUpgraded }) => {
  return (
    <div className="r-grid-2">
      <div className="flex flex-col gap-3">
        <div className="card m-0">
          <div className="card-title">Library Operations</div>
          <div className="trow">
            <span className="name">Library</span>
            <span className="count">0</span>
          </div>
          <div className="trow">
            <span className="name">Scribes (Current/Cap)</span>
            <span className="count"><span>0</span> / <span>0</span></span>
          </div>
          <div className="mt-4 pt-3 border-t border-[var(--border)]">
            <div></div>
            <div className="mt-2.5"></div>
            <div className="mt-4"></div>
          </div>
        </div>

        <div className="card m-0">
          <div className="card-title">Maps &amp; Blueprints</div>
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="bg-[var(--bg3)] border border-[var(--border)] rounded-[var(--radius)] p-2.5">
              <div className="text-5xl mb-0.5">🗺️</div>
              <div className="text-5xl font-bold text-[var(--gold)]">0</div>
              <div className="text-2xs text-[var(--text3)]">Maps</div>
            </div>
            <div className="bg-[var(--bg3)] border border-[var(--border)] rounded-[var(--radius)] p-2.5">
              <div className="text-5xl mb-0.5">📐</div>
              <div className="text-5xl font-bold text-[var(--amber)]">0</div>
              <div className="text-2xs text-[var(--text3)]">Blueprints</div>
            </div>
          </div>
        </div>

        <div className="card m-0">
          <div className="card-title">World Survey</div>
          <div className="bg-[#0a0d10] rounded border border-[var(--border)] h-50 relative overflow-hidden flex items-center justify-center">
            <canvas width="400" height="200" className="w-full h-full"></canvas>
            <div className="absolute text-[var(--text3)] text-xs pointer-events-none">No locations mapped yet.</div>
          </div>
          <div className="text-2xs text-[var(--text3)] mt-2 text-center">
            Mapped kingdoms are shown relative to your capital.
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="card m-0">
          <div className="card-title">Crafting progress</div>
          <div className="flex flex-col gap-2">
            <div className="text-xs text-[var(--text3)]">Nothing being crafted.</div>
          </div>
        </div>
        <div className="card m-0">
          <div className="card-title">Library upgrades</div>
          <UpgradesList
            category="library"
            defs={LIBRARY_UPGRADES}
            owned={parseOwnedUpgrades(studiesData?.library_upgrades)}
            state={state || {}}
            onPurchased={(_, nextOwned) => onUpgraded('library', nextOwned)}
          />
        </div>
      </div>

      <div className="flex flex-col gap-3 col-span-full">
        <div className="card m-0">
          <div className="card-title">Lore</div>
          <div className="text-xs text-[var(--text2)] flex flex-col gap-2">
            Loading lore...
          </div>
        </div>
        <div className="card m-0">
          <div className="card-title">Achievements</div>
          <div className="mb-3 text-xs flex flex-col gap-2"></div>
        </div>
      </div>
    </div>
  );
};
