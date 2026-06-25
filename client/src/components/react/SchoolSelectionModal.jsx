import React, { useState } from 'react';
import { apiCall } from '../../utils/api';

const SCHOOLS = [
  { id: 'abjuration', name: 'Abjuration', emoji: '🛡️', desc: 'Protection & Defense — Shield your kingdom with powerful defensive magic', color: '#4A90E2' },
  { id: 'conjuration', name: 'Conjuration', emoji: '✨', desc: 'Creation & Summoning — Manifest powerful entities and supplies', color: '#7ED321' },
  { id: 'divination', name: 'Divination', emoji: '🔮', desc: 'Foresight & Information — Unveil hidden truths and futures', color: '#9013FE' },
  { id: 'enchantment', name: 'Enchantment', emoji: '💫', desc: 'Charm & Influence — Control minds and bend wills', color: '#F5A623' },
  { id: 'evocation', name: 'Evocation', emoji: '🔥', desc: 'Damage & Force — Unleash raw magical power and destruction', color: '#FF6B6B' },
  { id: 'illusion', name: 'Illusion', emoji: '🎭', desc: 'Deception & Trickery — Manipulate perception and reality', color: '#50E3C2' },
  { id: 'necromancy', name: 'Necromancy', emoji: '☠️', desc: 'Death & Undeath — Command the forces of death itself', color: '#B8E986' },
  { id: 'transmutation', name: 'Transmutation', emoji: '⚗️', desc: 'Transformation — Reshape matter and transform all things', color: '#FF6B9D' },
];

export default function SchoolSelectionModal({ onClose, onSuccess }) {
  const [selectedSchool, setSelectedSchool] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSelectSchool = async (schoolId) => {
    if (loading) return;
    setSelectedSchool(schoolId);
    setLoading(true);
    setError(null);

    try {
      const data = await apiCall('/api/kingdom/select-school', {
        method: 'POST',
        body: { school: schoolId },
      });

      if (data.error) {
        setError(data.error);
        setLoading(false);
        setSelectedSchool(null);
        return;
      }

      if (data.ok && onSuccess) {
        onSuccess(data);
      }
    } catch (err) {
      setError('Network error: ' + err.message);
      setLoading(false);
      setSelectedSchool(null);
    }
  };

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div
        className="max-h-[85vh] w-[90%] max-w-[900px] overflow-y-auto rounded-xl border-2 border-[var(--accent1)] bg-gradient-to-br from-zinc-900 to-white/5 p-8 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-8 border-b border-white/10 pb-5 text-center">
          <h2 className="mb-2 text-2xl font-bold text-white">🔮 Choose Your School of Magic</h2>
          <p className="text-sm font-medium text-zinc-400">Select a specialization path for your spellcasting. This choice is permanent!</p>
        </div>

        {error && <div className="mb-4 rounded border border-red-500/50 bg-red-500/10 px-4 py-3 text-xs text-red-300">{error}</div>}

        <div className="mb-6 grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
          {SCHOOLS.map((school) => (
            <SchoolCard
              key={school.id}
              school={school}
              isSelected={selectedSchool === school.id}
              isLoading={loading}
              onSelect={() => handleSelectSchool(school.id)}
            />
          ))}
        </div>

        <div className="border-t border-white/10 pt-5 text-center">
          <p className="m-0 text-xs italic text-zinc-400">
            ✨ Each school offers 25 unique spells across 5 tiers. Spells from your chosen school cost 15% less mana!
          </p>
        </div>
      </div>
    </div>
  );
}

function SchoolCard({ school, isSelected, isLoading, onSelect }) {
  return (
    <div
      className={`relative flex cursor-pointer flex-col items-center gap-2 rounded-lg border bg-zinc-900 p-4 text-center transition-all ${isSelected ? 'scale-[1.02] shadow-xl' : 'hover:-translate-y-1 hover:shadow-lg'} ${isLoading ? 'cursor-not-allowed opacity-60' : ''}`}
      onClick={isLoading ? undefined : onSelect}>
      <div className="text-4xl leading-none">{school.emoji}</div>
      <h3 className="my-2 text-base font-semibold text-white">{school.name}</h3>
      <p className="m-0 text-xs leading-relaxed text-zinc-400">{school.desc}</p>
      {isSelected && <div className="absolute -right-3 -top-3 flex h-8 w-8 items-center justify-center rounded-full bg-blue-500 text-lg font-bold text-white">✓</div>}
      {isSelected && isLoading && <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 animate-spin text-2xl">⏳</div>}
    </div>
  );
}
