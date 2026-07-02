import React, { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { fmt } from '../../utils/fmt.js';
import { getLastSpellTarget, setLastSpellTarget } from '../../utils/spellTargetHistory.js';

function spellLabel(spellId, spell) {
  const base = String(spellId || '').replace(/_/g, ' ');
  return spell?.minSB ? `${base} (SB ${spell.minSB})` : base;
}

function spellMatchesQuery(spellId, spell, query) {
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    String(spellId || '').toLowerCase().includes(q) ||
    String(spell?.desc || '').toLowerCase().includes(q)
  );
}

function SpellTargetCard({ target, isSelected, onSelect }) {
  return (
    <button
      type="button"
      className={clsx(
        'mb-1 flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition',
        isSelected
          ? 'border-[var(--accent1)] bg-[var(--bg3)]'
          : 'border-[var(--border)] bg-[var(--bg2)] hover:border-[var(--accent)]',
      )}
      onClick={() => onSelect(target)}
    >
      <span className="text-[18px]">{target.is_location ? '📍' : '👤'}</span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-semibold text-[var(--text)]">{target.name}</div>
        <div className="text-[10px] text-[var(--text3)]">
          {target.is_location ? 'Discovered Site' : `Lv ${target.level} • ${String(target.race || 'unknown').replace(/_/g, ' ')}`}
        </div>
      </div>
      <div className="text-right">
        <div className="text-[12px] font-semibold text-[var(--gold)]">{target.is_location ? '???' : fmt(target.land)} ac</div>
        <div className="text-[10px] text-[var(--text3)]">#{target.rank || '?'}</div>
      </div>
    </button>
  );
}

export default function SpellCastingModal({
  open,
  onClose,
  spellDefs,
  spellDefsLoading,
  targets,
  selectedSpellId,
  onSelectedSpellIdChange,
  spellTarget,
  onSpellTargetChange,
  spellSearchQ,
  onSpellSearchChange,
  targetSearchQ,
  onTargetSearchChange,
  onCast,
}) {
  const [localSearch, setLocalSearch] = useState('');

  useEffect(() => {
    if (!open) return;
    setLocalSearch('');
  }, [open]);

  const filteredSpells = useMemo(() => {
    return Object.entries(spellDefs || {})
      .filter(([spellId, spell]) => spellMatchesQuery(spellId, spell, localSearch || spellSearchQ))
      .sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  }, [spellDefs, localSearch, spellSearchQ]);

  useEffect(() => {
    if (!open || !selectedSpellId || !targets?.length) return;
    const lastTargetId = getLastSpellTarget(selectedSpellId);
    if (!lastTargetId) return;
    const nextTarget = targets.find((entry) => String(entry.id) === String(lastTargetId));
    if (nextTarget && String(nextTarget.id) !== String(spellTarget?.id)) {
      onSpellTargetChange(nextTarget);
    }
  }, [open, selectedSpellId, targets, spellTarget?.id, onSpellTargetChange]);

  if (!open) return null;

  const selectedSpell = spellDefs?.[selectedSpellId];

  return (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-[980px] overflow-y-auto rounded-[var(--radius-lg)] border-2 border-[var(--accent1)] bg-[var(--bg2)] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="text-[18px] font-bold text-[var(--gold)]">Spell Casting</div>
            <div className="text-[12px] text-[var(--text3)]">Pick a spell, then target. History is saved per spell.</div>
          </div>
          <button type="button" className="base-btn px-3 py-1.5 text-[12px]" onClick={onClose}>Close</button>
        </div>

        {spellDefsLoading ? (
          <div className="py-10 text-center text-[var(--text3)]">Loading spells…</div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg3)] p-4">
              <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.5px] text-[var(--text3)]">Spell Library</div>
              <input
                className="input mb-3 w-full"
                type="text"
                value={localSearch}
                onChange={(e) => {
                  const next = e.target.value;
                  setLocalSearch(next);
                  onSpellSearchChange?.(next);
                }}
                placeholder="Search spell name or description..."
              />
              <div className="max-h-[56vh] overflow-y-auto pr-1">
                {filteredSpells.length === 0 ? (
                  <div className="py-8 text-center text-[13px] text-[var(--text3)]">No spells match that search.</div>
                ) : (
                  filteredSpells.map(([spellId, spell]) => (
                    <button
                      key={spellId}
                      type="button"
                      className={clsx(
                        'mb-2 w-full rounded-lg border px-3 py-2 text-left transition',
                        String(selectedSpellId) === String(spellId)
                          ? 'border-[var(--accent1)] bg-[var(--bg2)]'
                          : 'border-[var(--border)] bg-[var(--bg2)] hover:border-[var(--accent)]',
                      )}
                      onClick={() => {
                        onSelectedSpellIdChange?.(spellId);
                      }}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-[13px] font-semibold text-[var(--text)]">{spellLabel(spellId, spell)}</div>
                          <div className="text-[10px] text-[var(--text3)]">{spell?.desc || 'No description available.'}</div>
                        </div>
                        {String(selectedSpellId) === String(spellId) ? (
                          <span className="rounded-full border border-[var(--accent1)] px-2 py-0.5 text-[10px] text-[var(--accent1)]">Selected</span>
                        ) : null}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg2)] p-4">
              <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.5px] text-[var(--text3)]">Target Selection</div>
              <div className="mb-3 rounded-lg border border-[var(--border)] bg-[var(--bg3)] p-3">
                <div className="text-[10px] uppercase tracking-[0.5px] text-[var(--text3)]">Active Spell</div>
                <div className="text-[14px] font-semibold text-[var(--text)]">
                  {selectedSpell ? spellLabel(selectedSpellId, selectedSpell) : 'Pick a spell to begin'}
                </div>
              </div>

              <input
                className="input mb-3 w-full"
                type="text"
                value={targetSearchQ || ''}
                onChange={(e) => onTargetSearchChange?.(e.target.value)}
                placeholder="Search targets..."
                disabled={!selectedSpellId}
              />

              {spellTarget ? (
                <div className="mb-3 rounded-lg border border-[var(--accent)] bg-[var(--bg3)] p-3">
                  <div className="text-[10px] uppercase tracking-[0.5px] text-[var(--text3)]">Current Target</div>
                  <div className="text-[13px] font-semibold text-[var(--text)]">{spellTarget.name}</div>
                  <div className="text-[11px] text-[var(--text3)]">
                    {spellTarget.is_location ? 'Site' : `Lv ${spellTarget.level || 1} • ${fmt(spellTarget.land || 0)} ac`}
                  </div>
                  <button type="button" className="base-btn mt-2 px-2 py-1 text-[11px]" onClick={() => onSpellTargetChange(null)}>
                    Clear target
                  </button>
                </div>
              ) : null}

              <div className="max-h-[40vh] overflow-y-auto pr-1">
                {!selectedSpellId ? (
                  <div className="py-8 text-center text-[13px] text-[var(--text3)]">Choose a spell before selecting a target.</div>
                ) : targets.length === 0 ? (
                  <div className="py-8 text-center text-[13px] text-[var(--text3)]">No mapped targets available.</div>
                ) : (
                  targets.map((target) => (
                    <SpellTargetCard
                      key={String(target.id)}
                      target={target}
                      isSelected={spellTarget && String(spellTarget.id) === String(target.id)}
                      onSelect={(nextTarget) => {
                        onSpellTargetChange(nextTarget);
                        if (nextTarget?.id) {
                          setLastSpellTarget(selectedSpellId, nextTarget.id);
                        }
                      }}
                    />
                  ))
                )}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn btn-accent"
                  disabled={!selectedSpellId || !spellTarget}
                  onClick={() => onCast?.(selectedSpellId, spellTarget)}
                >
                  Cast Spell
                </button>
                <button
                  type="button"
                  className="base-btn"
                  onClick={() => {
                    onSelectedSpellIdChange?.('');
                    onSpellTargetChange(null);
                  }}
                >
                  Reset
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
