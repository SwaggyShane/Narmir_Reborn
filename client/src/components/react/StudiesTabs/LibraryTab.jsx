import React from 'react';
import UpgradesList from '../UpgradesList.jsx';
import { LibraryCraftList } from './LibraryCraftList.jsx';
import { LIBRARY_UPGRADES } from '../../../utils/studiesUpgrades.js';
import { parseOwnedUpgrades } from '../../../utils/upgradeUtils.js';
import { SCRIBE_ITEMS } from '../../../utils/scribeItems.js';
import { LoreAndAchievements } from './LoreAndAchievements.jsx';

function mappedLocations(discoveredKingdoms) {
  const disc = parseOwnedUpgrades(discoveredKingdoms);
  return Object.entries(disc)
    .filter(([, d]) => d?.mapped)
    .map(([id, d]) => ({ id, name: d.name || `Kingdom #${id}`, race: d.race || 'unknown' }));
}

function activeCraftTasks(allocation, progress) {
  const alloc = parseOwnedUpgrades(allocation);
  const prog = parseOwnedUpgrades(progress);
  return Object.entries(SCRIBE_ITEMS)
    .filter(([key]) => (Number(alloc?.[key]) || 0) > 0)
    .map(([key, item]) => {
      const done = Number(prog?.[`scribe_${key}`]) || 0;
      const pct = item.turns ? Math.max(0, Math.min(100, Math.round((done / item.turns) * 100))) : 0;
      return { key, label: item.label, scribes: alloc[key], pct };
    });
}

export const LibraryTab = ({ studiesData, state, onUpgraded, fetchStudiesData }) => {
  const activeTasks = activeCraftTasks(studiesData?.library_allocation, studiesData?.library_progress);
  const locations = mappedLocations(studiesData?.discovered_kingdoms);
  return (
    <div className="r-grid-2">
      <div className="flex flex-col gap-3">
        <div className="card m-0">
          <div className="card-title">Library Operations</div>
          <div className="trow">
            <span className="name">Library</span>
            <span className="count" id="st-libraries">{studiesData?.bld_libraries ?? 0}</span>
          </div>
          <div className="trow">
            <span className="name">Scribes (Current/Cap)</span>
            <span className="count">
              <span id="st-scribes-lib">{studiesData?.scribes ?? 0}</span> / <span id="st-lib-cap">{(studiesData?.bld_libraries || 0) * 20}</span>
            </span>
          </div>
          <div className="mt-4 pt-3 border-t border-[var(--border)]">
            <LibraryCraftList
              allocation={studiesData?.library_allocation}
              progress={studiesData?.library_progress}
              bldLibraries={studiesData?.bld_libraries}
              scribes={studiesData?.scribes}
              libraryUpgrades={parseOwnedUpgrades(studiesData?.library_upgrades)}
              discoveredKingdoms={studiesData?.discovered_kingdoms}
              worldFragments={studiesData?.world_fragments}
              maps={studiesData?.maps}
              onAllocated={fetchStudiesData}
            />
          </div>
        </div>

        <div className="card m-0">
          <div className="card-title">Maps &amp; Blueprints</div>
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="bg-[var(--bg3)] border border-[var(--border)] rounded-[var(--radius)] p-2.5">
              <div className="text-xl mb-0.5">🗺️</div>
              <div className="text-xl font-bold text-[var(--gold)]" id="st-lib-maps">{studiesData?.maps ?? 0}</div>
              <div className="text-2xs text-[var(--text3)]">Maps</div>
            </div>
            <div className="bg-[var(--bg3)] border border-[var(--border)] rounded-[var(--radius)] p-2.5">
              <div className="text-xl mb-0.5">📐</div>
              <div className="text-xl font-bold text-[var(--amber)]" id="st-lib-blueprints">{studiesData?.blueprints_stored ?? 0}</div>
              <div className="text-2xs text-[var(--text3)]">Blueprints</div>
            </div>
          </div>
        </div>

        <div className="card m-0">
          <div className="card-title">World Survey</div>
          <div className="bg-[#0a0d10] rounded border border-[var(--border)] min-h-[100px] p-2.5">
            {locations.length === 0 ? (
              <div id="survey-empty" className="text-[var(--text3)] text-xs text-center py-6">
                No locations mapped yet.
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {locations.map((loc) => (
                  <div key={loc.id} className="flex items-center justify-between text-[12px]">
                    <span className="text-[var(--text)]">📍 {loc.name}</span>
                    <span className="text-[var(--text3)]">{String(loc.race).replace(/_/g, ' ')}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="text-2xs text-[var(--text3)] mt-2 text-center">
            Locations your scribes have scribed into usable maps.
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="card m-0">
          <div className="card-title">Crafting progress</div>
          <div id="st-lib-craft-progress" className="flex flex-col gap-2">
            {activeTasks.length === 0 ? (
              <div className="text-xs text-[var(--text3)]">Nothing being crafted.</div>
            ) : (
              activeTasks.map((task) => (
                <div key={task.key} className="flex items-center justify-between text-xs py-1 border-b border-[var(--border)]">
                  <span className="text-[var(--text)]">{task.label}</span>
                  <span className="text-[var(--text3)]">{task.scribes} scribes — {task.pct}%</span>
                </div>
              ))
            )}
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
        <LoreAndAchievements />
      </div>
    </div>
  );
};
