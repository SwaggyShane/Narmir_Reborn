import React, { useState, useEffect } from 'react';
import HybridBlueprintModal from './HybridBlueprintModal';
import './HybridBlueprintPanel.css';

/**
 * HybridBlueprintPanel
 * Displays list of hybrid blueprints available for fragment assignment
 * Only visible when kingdom has unassigned hybrid blueprints
 */
export default function HybridBlueprintPanel({ kingdom, onUpdate }) {
  const [blueprints, setBlueprints] = useState([]);
  const [selectedBlueprint, setSelectedBlueprint] = useState(null);
  const [showModal, setShowModal] = useState(false);

  // Parse hybrid blueprints from kingdom data
  useEffect(() => {
    if (kingdom && kingdom.hybrid_blueprints) {
      try {
        const hbp = JSON.parse(kingdom.hybrid_blueprints);
        const unassigned = Object.entries(hbp)
          .filter(([_, bp]) => !bp.assigned)
          .map(([id, bp]) => ({
            id,
            fragment: bp.fragment,
            assigned: bp.assigned,
          }));
        setBlueprints(unassigned);
      } catch (err) {
        console.error('Failed to parse hybrid blueprints:', err);
        setBlueprints([]);
      }
    }
  }, [kingdom]);

  const handleSelectBlueprint = (blueprint) => {
    setSelectedBlueprint(blueprint);
    setShowModal(true);
  };

  const handleModalClose = () => {
    setShowModal(false);
    setSelectedBlueprint(null);
  };

  const handleSuccess = (data) => {
    // Close modal
    setShowModal(false);
    setSelectedBlueprint(null);

    // Update parent with new data
    if (onUpdate) {
      onUpdate({
        gold: data.gold,
        mana: data.mana,
      });
    }

    // Update blueprints list
    setBlueprints(blueprints.filter(bp => bp.id !== selectedBlueprint.id));
  };

  // Only show if there are unassigned blueprints
  if (blueprints.length === 0) {
    return null;
  }

  return (
    <div className="hybrid-blueprint-panel">
      <div className="panel-header">
        <h3>⚡ World Fragment Blueprints</h3>
        <span className="blueprint-count">{blueprints.length} unassigned</span>
      </div>

      <div className="blueprints-list">
        {blueprints.map(blueprint => (
          <BlueprintItem
            key={blueprint.id}
            blueprint={blueprint}
            onSelect={handleSelectBlueprint}
          />
        ))}
      </div>

      <div className="panel-info">
        <p>✨ Select a blueprint to apply its fragment bonus to a building.</p>
        <p>⚠️ This choice is permanent and cannot be undone.</p>
      </div>

      {showModal && selectedBlueprint && (
        <HybridBlueprintModal
          blueprintId={selectedBlueprint.id}
          fragmentName={selectedBlueprint.fragment}
          onClose={handleModalClose}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
}

/**
 * Individual blueprint item component
 */
function BlueprintItem({ blueprint, onSelect }) {
  return (
    <div className="blueprint-item" onClick={() => onSelect(blueprint)}>
      <div className="blueprint-icon">✨</div>
      <div className="blueprint-info">
        <h4>{blueprint.fragment}</h4>
        <p className="blueprint-desc">Click to select building for this fragment</p>
      </div>
      <div className="blueprint-action">
        <button className="btn-apply">Apply →</button>
      </div>
    </div>
  );
}
