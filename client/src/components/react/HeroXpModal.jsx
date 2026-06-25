import React from 'react';
import { createPortal } from 'react-dom';
import { fmt } from '../../utils/fmt.js';

const HERO_XP_LEVELS = Array.from({ length: 19 }, (_, idx) => idx + 2);

function heroXpForLevel(level) {
  return Math.floor(1000 * (Math.pow(1.5, level - 1) - 1));
}

export default function HeroXpModal({ open, onClose }) {
  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9000] flex items-center justify-center bg-black/72 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[80vh] w-full max-w-[700px] flex-col rounded-md border-2 border-[var(--accent1)] bg-[var(--bg2)] shadow-[0_8px_32px_rgba(0,0,0,0.6)]">
        <div className="flex items-center justify-between border-b border-[var(--border)] p-3.5">
          <span className="text-[14px] font-bold text-[var(--text)]">👑 Hero XP Progression</span>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer border-none bg-transparent px-1 text-[18px] leading-none text-[var(--text3)]"
          >
            ✕
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-4.5">
          <div className="mb-4 text-center">
            <div className="mb-2 text-[40px]">👑</div>
            <div className="text-[18px] font-bold text-[var(--text)]">Hero XP Progression</div>
            <div className="text-[12px] text-[var(--text3)]">Max Level is 20</div>
          </div>
          <table className="w-full border-collapse text-left text-[13px]">
            <thead>
              <tr>
                <th className="border-b border-[var(--border)] p-2 text-[var(--text3)]">Level</th>
                <th className="border-b border-[var(--border)] p-2 text-[var(--text3)]">Total XP Req.</th>
                <th className="border-b border-[var(--border)] p-2 text-[var(--text3)]">XP for Level</th>
              </tr>
            </thead>
            <tbody>
              {HERO_XP_LEVELS.map((level) => {
                const currentTotalXp = heroXpForLevel(level);
                const previousTotalXp = heroXpForLevel(level - 1);
                const xpNeeded = currentTotalXp - previousTotalXp;
                return (
                  <tr key={level}>
                    <td className="border-b border-[var(--border)] p-2 font-bold text-[var(--gold)]">{level}</td>
                    <td className="border-b border-[var(--border)] p-2 text-[var(--text2)]">
                      {fmt(currentTotalXp)} <span className="text-[10px] text-[var(--text3)]">XP</span>
                    </td>
                    <td className="border-b border-[var(--border)] p-2 text-[var(--text)]">
                      {fmt(xpNeeded)} <span className="text-[10px] text-[var(--text3)]">XP</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>,
    document.body,
  );
}