import React, { useEffect, useMemo, useState } from 'react';
import { apiCall } from '../../../utils/api.mjs';
import { toast } from '../../../utils/toast.js';
import { AllocationButtons } from '../AllocationButtons.jsx';

function scrollLabel(key) {
  return String(key || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function progressPercent(progress, key, turns) {
  const done = Number(progress?.[`scroll_${key}`]) || 0;
  if (!turns) return 0;
  return Math.max(0, Math.min(100, Math.round((done / turns) * 100)));
}

export const TowerCraftList = ({
  allocation,
  progress,
  scrolls,
  bldMageTowers,
  mages,
  onAllocated,
}) => {
  const [defs, setDefs] = useState(null);
  const [defsError, setDefsError] = useState(null);
  const [draft, setDraft] = useState(() => ({ ...(allocation || {}) }));
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    apiCall('/api/spell-definitions').then((result) => {
      if (cancelled) return;
      if (result.error) setDefsError(result.error);
      else setDefs(result);
    });
    return () => { cancelled = true; };
  }, []);

  const allocationSig = JSON.stringify(allocation || {});
  useEffect(() => {
    setDraft({ ...(allocation || {}) });
  }, [allocationSig]);

  const blankScrollsAvailable = Number(scrolls?.blank_scroll) || 0;

  const allItems = useMemo(() => {
    if (!defs?.SCROLL_REQUIREMENTS) return [];
    return Object.entries(defs.SCROLL_REQUIREMENTS).map(([key, req]) => ({
      key,
      label: scrollLabel(key),
      desc: defs.SPELL_DEFS?.[key]?.desc || (key === 'blank_scroll' ? 'Base material every other scroll is crafted from.' : ''),
      mages: req.mages,
      turns: req.turns,
    }));
  }, [defs]);

  // Rendering all 200+ scrolls unconditionally would be unusable — show
  // whatever's currently allocated/queued by default, plus search results.
  const visibleItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q) {
      return allItems.filter((i) => i.key.includes(q.replace(/\s+/g, '_')) || i.label.toLowerCase().includes(q)).slice(0, 60);
    }
    return allItems.filter((i) => (draft[i.key] || 0) > 0 || i.key === 'blank_scroll');
  }, [allItems, query, draft]);

  if (!bldMageTowers) {
    return (
      <div className="text-xs text-[var(--text3)]">
        Build a Mage Tower first to assign mages to scroll crafting.
      </div>
    );
  }

  if (defsError) {
    return <div className="text-xs text-[var(--red)]">{defsError}</div>;
  }

  const capacity = bldMageTowers * 20;
  const maxMages = Math.min(mages || 0, capacity);
  const totalAllocated = Object.values(draft).reduce((s, v) => s + (Number(v) || 0), 0);

  const setItem = (key, value) => {
    const n = Math.max(0, Math.floor(Number(value) || 0));
    setDraft((prev) => ({ ...prev, [key]: n }));
  };

  const submitAllocation = async (nextAllocation, successMessage) => {
    if (saving) return;
    const total = Object.values(nextAllocation).reduce((s, v) => s + (Number(v) || 0), 0);
    if (total > maxMages) {
      toast(`Allocated ${total} but you only have ${maxMages} effective mages`, 'warning');
      return;
    }
    setSaving(true);
    try {
      const result = await apiCall('/api/kingdom/tower-allocation', {
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

  const handleAllocate = () => submitAllocation(draft, 'Mage allocation updated');
  const handleRelease = () => {
    setDraft({});
    submitAllocation({}, 'All mages released');
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
        <div className="text-[11px] text-[var(--text3)]">
          Mages: <span className={totalAllocated > maxMages ? 'text-[var(--red)]' : 'text-[var(--gold)]'}>{totalAllocated}</span> / {maxMages} allocated
          {' · '}Blank Scrolls: <span className="text-[var(--text)]">{blankScrollsAvailable}</span>
        </div>
        <AllocationButtons onRelease={handleRelease} onAllocate={handleAllocate} disabled={saving} />
      </div>

      <input
        type="text"
        className="input text-[12px]"
        placeholder="Search 200+ scrolls by name…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {!defs && !defsError && (
        <div className="text-xs text-[var(--text3)]">Loading scroll list...</div>
      )}

      {defs && visibleItems.length === 0 && (
        <div className="text-xs text-[var(--text3)]">
          {query ? 'No scrolls match your search.' : 'Search above to queue a scroll for crafting.'}
        </div>
      )}

      {defs && visibleItems.map((item) => {
        const pct = progressPercent(progress, item.key, item.turns);
        const needsBlank = item.key !== 'blank_scroll' && (draft[item.key] || 0) > 0 && blankScrollsAvailable < 1;
        return (
          <div key={item.key} className="flex items-center gap-2 py-1.5 border-b border-[var(--border)] even:bg-white/[0.03]">
            <div className="flex-1">
              <div className="text-[13px] text-[var(--text)] font-semibold">{item.label}</div>
              <div className="text-[11px] text-[var(--text3)]">
                {item.desc} | {item.mages} mages / {item.turns} turns
              </div>
              {pct > 0 && !needsBlank && (
                <div className="text-2xs text-[var(--text3)] mt-0.5">Progress: {pct}%</div>
              )}
              {needsBlank && (
                <div className="text-2xs text-[var(--amber)] mt-0.5">⚠️ Paused: craft a Blank Scroll first — every other scroll consumes one.</div>
              )}
            </div>
            <input
              type="number"
              min="0"
              className="w-16 text-[12px] px-1.5 py-1 bg-[var(--bg3)] border border-[var(--border)] rounded text-right"
              value={draft[item.key] || 0}
              disabled={saving}
              onChange={(e) => setItem(item.key, e.target.value)}
            />
            <button
              type="button"
              className="base-btn text-[10px] px-2 py-1"
              disabled={saving}
              onClick={() => setItem(item.key, maxMages - (totalAllocated - (draft[item.key] || 0)))}
            >
              Max
            </button>
          </div>
        );
      })}
    </div>
  );
};
