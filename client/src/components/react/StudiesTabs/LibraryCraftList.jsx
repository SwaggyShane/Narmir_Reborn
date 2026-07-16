import React, { useEffect, useState } from 'react';
import { apiCall } from '../../../utils/api.mjs';
import { toast } from '../../../utils/toast.js';
import { SCRIBE_ITEMS } from '../../../utils/scribeItems.js';
import { AllocationButtons } from '../AllocationButtons.jsx';

function progressPercent(progress, key, turns) {
  const done = Number(progress?.[`scribe_${key}`]) || 0;
  if (!turns) return 0;
  return Math.max(0, Math.min(100, Math.round((done / turns) * 100)));
}

// Mirrors the exact pause conditions in game/magic.js's processLibrary —
// scribes assigned to these tasks silently sit at 0% forever if the
// prerequisite isn't met, with the only explanation being an easy-to-miss
// turn event. Surfacing it directly in the crafting list avoids the
// confusion of "I assigned scribes to this and nothing is happening."
function blockedReason(key, discoveredKingdoms, worldFragments, maps) {
  if (key === 'location_map') {
    const disc = discoveredKingdoms || {};
    const unmapped = Object.values(disc).some((d) => d?.found && !d?.mapped);
    if (!unmapped) return 'No unmapped locations discovered yet — scout further first.';
    if ((maps || 0) < 2) return 'Need at least 2 Maps (one is kept) to scribe a location map.';
  }
  if (key === 'study_fragment') {
    const frags = Array.isArray(worldFragments) ? worldFragments : [];
    if (!frags.some((f) => f && !f.studied)) return 'No unstudied World Fragments available.';
  }
  if (key === 'hybrid_blueprint') {
    const frags = Array.isArray(worldFragments) ? worldFragments : [];
    if (!frags.some((f) => f && f.studied)) return 'No studied World Fragments available yet.';
  }
  return null;
}

export const LibraryCraftList = ({
  allocation,
  progress,
  bldLibraries,
  scribes,
  libraryUpgrades,
  discoveredKingdoms,
  worldFragments,
  maps,
  onAllocated,
}) => {
  const [draft, setDraft] = useState(() => ({ ...(allocation || {}) }));
  const [saving, setSaving] = useState(false);

  // Re-sync local edits whenever the server's allocation actually changes
  // (e.g. after a save, or a fresh kingdom load) — but not on every render,
  // so mid-edit keystrokes aren't clobbered by an unrelated parent refresh.
  const allocationSig = JSON.stringify(allocation || {});
  useEffect(() => {
    setDraft({ ...(allocation || {}) });
  }, [allocationSig]);

  if (!bldLibraries) {
    return (
      <div className="text-xs text-[var(--text3)]">
        Build a Library first to assign scribes to crafting tasks.
      </div>
    );
  }

  const capacity = bldLibraries * 20;
  const maxScribes = Math.min(scribes || 0, capacity);
  const totalAllocated = Object.values(draft).reduce((s, v) => s + (Number(v) || 0), 0);
  const hasMasonSigil = Boolean(libraryUpgrades?.mason_sigil);

  const setItem = (key, value) => {
    const n = Math.max(0, Math.floor(Number(value) || 0));
    setDraft((prev) => ({ ...prev, [key]: n }));
  };

  const submitAllocation = async (nextAllocation, successMessage) => {
    if (saving) return;
    const total = Object.values(nextAllocation).reduce((s, v) => s + (Number(v) || 0), 0);
    if (total > maxScribes) {
      toast(`Allocated ${total} but you only have ${maxScribes} effective scribes`, 'warning');
      return;
    }
    setSaving(true);
    try {
      const result = await apiCall('/api/kingdom/library-allocation', {
        method: 'POST',
        body: { allocation: nextAllocation },
      });
      if (result.error) {
        toast(result.error, 'error');
        return;
      }
      toast(successMessage, 'success');
      onAllocated?.();
    } finally {
      setSaving(false);
    }
  };

  const handleAllocate = () => submitAllocation(draft, 'Scribe allocation updated');
  const handleRelease = () => {
    setDraft({});
    submitAllocation({}, 'All scribes released');
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
        <div className="text-[11px] text-[var(--text3)]">
          Scribes: <span className={totalAllocated > maxScribes ? 'text-[var(--red)]' : 'text-[var(--gold)]'}>{totalAllocated}</span> / {maxScribes} allocated
        </div>
        <AllocationButtons onRelease={handleRelease} onAllocate={handleAllocate} disabled={saving} />
      </div>
      {Object.entries(SCRIBE_ITEMS).map(([key, item]) => {
        const locked = item.requiresUpgrade && !hasMasonSigil;
        const pct = progressPercent(progress, key, item.turns);
        const blocked = !locked && (draft[key] || 0) > 0
          ? blockedReason(key, discoveredKingdoms, worldFragments, maps)
          : null;
        return (
          <div key={key} className="flex items-center gap-2 py-1.5 border-b border-[var(--border)]">
            <div className="flex-1">
              <div className="text-[13px] text-[var(--text)] font-semibold">{item.label}</div>
              <div className="text-[11px] text-[var(--text3)]">
                {item.desc} | {item.scribes} scribes / {item.turns} turns
              </div>
              {!locked && !blocked && pct > 0 && (
                <div className="text-2xs text-[var(--text3)] mt-0.5">Progress: {pct}%</div>
              )}
              {locked && (
                <div className="text-2xs text-[var(--text3)] mt-0.5">
                  Requires the Master Mason Sigil upgrade
                </div>
              )}
              {blocked && (
                <div className="text-2xs text-[var(--amber)] mt-0.5">⚠️ Paused: {blocked}</div>
              )}
            </div>
            <input
              type="number"
              min="0"
              className="w-16 text-[12px] px-1.5 py-1 bg-[var(--bg3)] border border-[var(--border)] rounded text-right"
              value={draft[key] || 0}
              disabled={locked || saving}
              onChange={(e) => setItem(key, e.target.value)}
            />
          </div>
        );
      })}
    </div>
  );
};
