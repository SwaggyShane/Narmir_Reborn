import React, { useState } from 'react';
import { apiCall } from '../../utils/api';
import './SchoolSelectionModal.css';

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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content school-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>🔮 Choose Your School of Magic</h2>
          <p className="modal-subtitle">Select a specialization path for your spellcasting. This choice is permanent!</p>
        </div>

        {error && <div className="error-message">{error}</div>}

        <div className="schools-grid">
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

        <div className="modal-footer">
          <p className="info-text">
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
      className={`school-card ${isSelected ? 'selected' : ''} ${isLoading ? 'disabled' : ''}`}
      onClick={isLoading ? undefined : onSelect}
      style={{
        borderColor: isSelected ? school.color : undefined,
        backgroundColor: isSelected ? `${school.color}20` : undefined,
      }}
    >
      <div className="school-icon">{school.emoji}</div>
      <h3>{school.name}</h3>
      <p>{school.desc}</p>
      {isSelected && <div className="selected-checkmark">✓</div>}
      {isSelected && isLoading && <div className="school-card-spinner">⏳</div>}
    </div>
  );
}
