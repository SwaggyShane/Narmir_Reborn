import React from 'react';
import { repairMojibake } from '../../utils/repairMojibake.js';
import { fmt } from '../../utils/fmt.js';
import HeroLorePortrait from './HeroLorePortrait.jsx';

export default function HeroLoreContent({ heroKey, hero }) {
  const repair = (v) => repairMojibake(String(v ?? ''));
  const abilities = Array.isArray(hero.abilities) ? hero.abilities : [];

  return (
    <>
      <div className="mb-5 text-center">
        <HeroLorePortrait heroKey={heroKey} alt={repair(hero.name || '')} />
        <div className="text-xl font-bold text-gray-100">
          {repair(hero.name || '')}
        </div>
        <div className="text-xs uppercase tracking-wider text-gray-500">
          Legendary Hero Class
        </div>
      </div>

      {abilities.length > 0 && (
        <div className="mb-5">
          <div className="mb-2.5 text-xs font-bold uppercase tracking-wider text-yellow-500">
            Signature Abilities
          </div>
          <div className="flex flex-col gap-2.5">
            {abilities.map((a, i) => (
              <div key={i} className="rounded-lg border border-gray-700 bg-white bg-opacity-5 p-2.5">
                <div className="mb-0.5 text-sm font-semibold text-gray-100">
                  {repair(a.name || '')}
                </div>
                <div className="text-xs text-gray-500">
                  {repair(a.description || '')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-lg bg-gray-800 p-2.5 text-center">
          <div className="text-xs uppercase text-gray-500">Recruit Cost</div>
          <div className="text-sm font-bold text-yellow-500">{fmt(hero.recruitCost)} GC</div>
        </div>
        <div className="rounded-lg bg-gray-800 p-2.5 text-center">
          <div className="text-xs uppercase text-gray-500">Mana Cost</div>
          <div className="text-sm font-bold text-blue-400">{fmt(hero.recruitMana)} ✨</div>
        </div>
      </div>
    </>
  );
}