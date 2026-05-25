import React, { useEffect } from 'react';

const RacesPanel = () => {
  useEffect(() => {
    // Call renderRaces when component mounts to populate race list
    if (window.renderRaces) {
      window.renderRaces();
    }
  }, []);

  return (
    <div id="races" className="panel" style={{ display: 'none' }}>
      <div className="card" style={{ marginTop: 0 }}>
        <div className="card-title">🦄 Race Information</div>
        <div
          style={{
            fontSize: '13px',
            color: 'var(--text2)',
            lineHeight: 1.6,
            marginBottom: '16px',
          }}
        >
          Learn about the various races of Narmir, their history, and their unique
          passives and abilities.
        </div>
        <div
          id="races-list"
          style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}
        ></div>
      </div>
    </div>
  );
};

export default RacesPanel;
