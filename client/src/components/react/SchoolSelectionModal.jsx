import React, { useState } from 'react';
import { apiCall } from '../../utils/api';

const SCHOOLS = [
  {
    id: 'abjuration',
    name: 'Abjuration',
    emoji: '🛡️',
    desc: 'Protection & Defense — Shield your kingdom with powerful defensive magic',
    color: '#4A90E2',
  },
  {
    id: 'conjuration',
    name: 'Conjuration',
    emoji: '✨',
    desc: 'Creation & Summoning — Manifest powerful entities and supplies',
    color: '#7ED321',
  },
  {
    id: 'divination',
    name: 'Divination',
    emoji: '🔮',
    desc: 'Foresight & Information — Unveil hidden truths and futures',
    color: '#9013FE',
  },
  {
    id: 'enchantment',
    name: 'Enchantment',
    emoji: '💫',
    desc: 'Charm & Influence — Control minds and bend wills',
    color: '#F5A623',
  },
  {
    id: 'evocation',
    name: 'Evocation',
    emoji: '⚡',
    desc: 'Damage & Force — Unleash raw magical power and destruction',
    color: '#FF6B6B',
  },
  {
    id: 'illusion',
    name: 'Illusion',
    emoji: '👁️',
    desc: 'Deception & Trickery — Manipulate perception and reality',
    color: '#50E3C2',
  },
  {
    id: 'necromancy',
    name: 'Necromancy',
    emoji: '💀',
    desc: 'Death & Undeath — Command the forces of death itself',
    color: '#B8E986',
  },
  {
    id: 'transmutation',
    name: 'Transmutation',
    emoji: '🔄',
    desc: 'Transformation — Reshape matter and transform all things',
    color: '#FF6B9D',
  },
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
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[2000] backdrop-blur-sm" onClick={onClose}>
      <div className="rounded-xl border border-white/10 bg-gradient-to-br from-zinc-900 to-white/5 max-w-[900px] w-[90%] max-h-[85vh] overflow-y-auto shadow-2xl p-8" onClick={e => e.stopPropagation()}>
        <div className="text-center mb-8 border-b border-white/10 pb-5">
          <h2 className="text-2xl font-bold mb-2 text-white">🔮 Choose Your School of Magic</h2>
          <p className="text-sm text-zinc-400 font-medium">Select a specialization path for your spellcasting. This choice is permanent!</p>
        </div>

        {error && <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-3 rounded mb-4 text-xs">{error}</div>}

        <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4 mb-6">
          {SCHOOLS.map(school => (
            <SchoolCard
              key={school.id}
              school={school}
              isSelected={selectedSchool === school.id}
              isLoading={loading}
              onSelect={() => handleSelectSchool(school.id)}
            />
          ))}
        </div>

        <div className="text-center border-t border-white/10 pt-5">
          <p className="text-xs text-zinc-400 m-0 italic">
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
      className={`bg-zinc-900 border rounded-lg p-4 cursor-pointer transition-all relative text-center flex flex-col items-center gap-2 ${isSelected ? 'shadow-xl scale-[1.02]' : 'hover:-translate-y-1 hover:shadow-lg'} ${isLoading ? 'opacity-60 cursor-not-allowed' : ''}`}
      onClick={isLoading ? undefined : onSelect}
      style={{
        borderColor: isSelected ? school.color : undefined,
        backgroundColor: isSelected ? `${school.color}20` : undefined,
      }}
    >
      <div className="text-4xl leading-none">{school.emoji}</div>
      <h3 className="my-2 text-base font-semibold text-white">{school.name}</h3>
      <p className="m-0 text-xs text-zinc-400 leading-relaxed">{school.desc}</p>
      {isSelected && <div className="absolute -top-3 -right-3 bg-blue-500 text-white w-8 h-8 rounded-full flex items-center justify-center text-lg font-bold">✓</div>}
      {isSelected && isLoading && <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-2xl animate-spin">⏳</div>}
    </div>
  );
}
