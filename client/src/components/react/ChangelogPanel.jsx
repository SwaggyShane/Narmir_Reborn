import React from 'react';

const ChangelogPanel = () => {
  const submitSuggestion = () => {
    if (window.submitSuggestion) {
      window.submitSuggestion();
    }
  };

  const returnToKingdom = () => {
    if (window.switchTab) {
      window.switchTab("status");
    }
  };

  return (
    <div id="changelog" className="panel" style={{ display: 'none' }}>
      <div className="card" style={{ marginTop: 0 }}>
        <div className="card-title">📋 Changelog & Updates</div>

        <h2
          style={{
            fontSize: '16px',
            color: 'var(--gold)',
            marginBottom: '20px',
            borderBottom: '1px solid var(--border2)',
            paddingBottom: '10px',
          }}
        >
          🔥 LATEST UPDATES (MAY 2026)
        </h2>

        <div style={{ marginBottom: '24px' }}>
          <div
            style={{
              fontSize: '14px',
              fontWeight: 700,
              color: 'var(--text)',
              marginBottom: '6px',
            }}
          >
            🌲 Advanced Resources & Fortifications
          </div>
          <ul
            style={{
              fontSize: '13px',
              color: 'var(--text2)',
              lineHeight: 1.8,
              listStyle: 'none',
              paddingLeft: '10px',
            }}
          >
            <li>
              🪨
              <strong style={{ color: 'var(--text)' }}> Resource Systems:</strong>
              Wood, Stone, and Iron can now be gathered via specialized buildings and expeditions.
            </li>
            <li>
              🥘
              <strong style={{ color: 'var(--text)' }}> Food Supply:</strong>
              Manage starvation and surpluses to keep your troops ready and able to march on Resource Expeditions.
            </li>
            <li>
              💀
              <strong style={{ color: 'var(--text)' }}> Mausoleums & Thralls:</strong>
              Reanimate fallen enemies into Thralls to automate basic labor around your kingdom.
            </li>
            <li>
              🧱
              <strong style={{ color: 'var(--text)' }}> Advanced Defenses:</strong>
              Build and upgrade protective walls to secure your kingdom from hostile invaders.
            </li>
            <li>
              ⚙️
              <strong style={{ color: 'var(--text)' }}> Advanced Blueprints:</strong>
              Craft Hybrid and Fortified blueprints using the new elemental fragments and rare materials.
            </li>
          </ul>
        </div>

        <h2
          style={{
            fontSize: '16px',
            color: 'var(--gold)',
            marginBottom: '20px',
            borderBottom: '1px solid var(--border2)',
            paddingBottom: '10px',
            marginTop: '30px',
          }}
        >
          🔥 LATEST UPDATES (APRIL 2026)
        </h2>

        <div style={{ marginBottom: '24px' }}>
          <div
            style={{
              fontSize: '14px',
              fontWeight: 700,
              color: 'var(--text)',
              marginBottom: '6px',
            }}
          >
            🛠️ Game Interface & Logic Patch (v1.0.6)
          </div>
          <ul
            style={{
              fontSize: '13px',
              color: 'var(--text2)',
              lineHeight: 1.8,
              listStyle: 'none',
              paddingLeft: '10px',
            }}
          >
            <li>
              🏆
              <strong style={{ color: 'var(--text)' }}> Achievements:</strong>
              Discover custom unlockables and titles inside your Library.
            </li>
            <li>
              🎁
              <strong style={{ color: 'var(--text)' }}> Prestige System:</strong>
              A new beginning awaits with permanent bonuses for max level resets.
            </li>
            <li>
              🌦️
              <strong style={{ color: 'var(--text)' }}> Seasons & Daily Events:</strong>
              Unpredicted world conditions impacting crop yields and happiness.
            </li>
            <li>
              📈
              <strong style={{ color: 'var(--text)' }}> Dynamic Pricing:</strong>
              Market commodities respond to supply and demand server-wide.
            </li>
            <li>
              🤝
              <strong style={{ color: 'var(--text)' }}> Trade Connections:</strong>
              Establish long-term trade routes for steady passive gold.
            </li>
            <li>
              ⚔️
              <strong style={{ color: 'var(--text)' }}> Trade Raiding:</strong>
              Aggressive kingdoms can pillage the trade routes of their enemies.
            </li>
            <li>
              🔊
              <strong style={{ color: 'var(--text)' }}> Immersive Audio:</strong>
              Enjoy sound effects for various actions in your kingdom!
            </li>
            <li>
              ✨
              <strong style={{ color: 'var(--text)' }}> Named Heroes:</strong>
              Recruit legendary leaders to lead your armies and research.
            </li>
            <li>
              🧱
              <strong style={{ color: 'var(--text)' }}> Siege Mechanics:</strong>
              Fortify with Walls to protect your holdings from damage.
            </li>
            <li>
              🏰
              <strong style={{ color: 'var(--text)' }}> Citadel Badge:</strong> Now
              displays on Defense and Status panels when met.
            </li>
            <li>
              ✨
              <strong style={{ color: 'var(--text)' }}> Racial Gift Badge:</strong>
              Now visible on the Training panel for active bonuses.
            </li>
            <li>
              ⚓
              <strong style={{ color: 'var(--text)' }}> Siege Badge:</strong> Added to
              war machines on the status page.
            </li>
            <li>
              📈
              <strong style={{ color: 'var(--text)' }}> Rankings Modernization:</strong>
              New columns (Player, Score, Turns) and stats privacy.
            </li>
            <li>
              📦 <strong style={{ color: 'var(--text)' }}> Trade Logs:</strong> New
              "Clear Logs" button in markets to tidy up old offers.
            </li>
            <li>
              💛
              <strong style={{ color: 'var(--text)' }}> Hire Page Rework:</strong>
              High-contrast yellow labels and improved column alignment.
            </li>
            <li>
              📖
              <strong style={{ color: 'var(--text)' }}> Library Sync:</strong>
              Upgrades and residents (scribes only) are now correctly synced.
            </li>
          </ul>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <div
            style={{
              fontSize: '14px',
              fontWeight: 700,
              color: 'var(--text)',
              marginBottom: '6px',
            }}
          >
            📜 Race Lore Expansion
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text2)', lineHeight: 1.6 }}>
            Ancient secrets are beginning to stir. Your turn reports now have a
            chance to include rare historical events and lore snippets specific to
            your race and region, bringing the deep history of Narmir to life.
          </p>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <div
            style={{
              fontSize: '14px',
              fontWeight: 700,
              color: 'var(--text)',
              marginBottom: '6px',
            }}
          >
            🚩 Region Capture & Mastery
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text2)', lineHeight: 1.6 }}>
            Alliances can now contest and capture the six major regions of Narmir.
            Holding a region grants your entire alliance a 10% bonus to that
            region's signature stat (Military, Magic, Economy, etc.). Check the 🗺️
            World Map to see capture progress!
          </p>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <div
            style={{
              fontSize: '14px',
              fontWeight: 700,
              color: 'var(--text)',
              marginBottom: '6px',
            }}
          >
            📊 Alliance Leaderboards
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text2)', lineHeight: 1.6 }}>
            A new "Alliance" tab has been added to the Rankings panel. Compare
            your coalition's total land, member counts, and average strength
            against every other Alliance in the realm.
          </p>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <div
            style={{
              fontSize: '14px',
              fontWeight: 700,
              color: 'var(--text)',
              marginBottom: '6px',
            }}
          >
            📜 Kingdom Lore & Bios
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text2)', lineHeight: 1.6 }}>
            Tell your story. You can now write a custom lore description for your
            kingdom in your Kingdom view. These bios are saved to your profile and
            visible to all players who inspect your kingdom.
          </p>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <div
            style={{
              fontSize: '14px',
              fontWeight: 700,
              color: 'var(--text)',
              marginBottom: '6px',
            }}
          >
            💀 NARMIR REBORN: Pure. Damn. Evil.
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text2)', lineHeight: 1.6 }}>
            Complete aesthetic overhaul. The land of Narmir has officially evolved
            into its darker, gritier "Reborn" state.
          </p>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <div
            style={{
              fontSize: '14px',
              fontWeight: 700,
              color: 'var(--text)',
              marginBottom: '6px',
            }}
          >
            ✨ Racial masteries (Level 25+)
          </div>
          <p
            style={{
              fontSize: '13px',
              color: 'var(--text2)',
              lineHeight: 1.6,
              marginBottom: '8px',
            }}
          >
            Veteran units now unlock powerful race-specific abilities once they
            reach Level 5:
          </p>
          <ul
            style={{
              fontSize: '13px',
              color: 'var(--text2)',
              lineHeight: 1.8,
              listStyle: 'none',
              paddingLeft: '10px',
            }}
          >
            <li>
              🔨
              <strong style={{ color: 'var(--text)' }}> Dwarf Engineers:</strong>
              Can solo-crew heavy war machines.
            </li>
            <li>
              ✨
              <strong style={{ color: 'var(--text)' }}> High Elf Mages:</strong>
              Produce two scrolls per crafting session.
            </li>
            <li>
              🪓
              <strong style={{ color: 'var(--text)' }}> Orc Fighters:</strong>
              Passively train 1 free fighter per 10 every turn.
            </li>
            <li>
              🕵️
              <strong style={{ color: 'var(--text)' }}> Dark Elf Ninjas:</strong>
              Silent assassination (targets get no news).
            </li>
            <li>
              🐺
              <strong style={{ color: 'var(--text)' }}> Dire Wolf Rangers:</strong>
              Expeditions return 1 turn early.
            </li>
            <li>
              💚
              <strong style={{ color: 'var(--text)' }}> Human Clerics:</strong>
              Radiate a happiness aura.
            </li>
          </ul>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <div
            style={{
              fontSize: '14px',
              fontWeight: 700,
              color: 'var(--text)',
              marginBottom: '6px',
            }}
          >
            💬 Chat Personalization
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text2)', lineHeight: 1.6 }}>
            Use
            <code style={{ color: 'var(--accent1)' }}> /nick &lt;name&gt;</code> to set a
            persistent nickname and
            <code style={{ color: 'var(--accent1)' }}> /color &lt;hex&gt;</code> to
            choose your chat color. These settings are now saved to your profile!
          </p>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <div
            style={{
              fontSize: '14px',
              fontWeight: 700,
              color: 'var(--text)',
              marginBottom: '6px',
            }}
          >
            🛡️ Extended Newbie Protection
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text2)', lineHeight: 1.6 }}>
            To ensure all new leaders have time to fortify their holds, protection
            from attacks and spells has been extended to
            <strong style={{ color: 'var(--gold)' }}> Turn 400</strong>.
          </p>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <div
            style={{
              fontSize: '14px',
              fontWeight: 700,
              color: 'var(--text)',
              marginBottom: '6px',
            }}
          >
            🏗️ Racial Starting Buildings
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text2)', lineHeight: 1.6 }}>
            Fresh kingdoms now receive a starting kit of buildings unique to their
            heritage, allowing you to leverage your race's strengths from day one.
          </p>
        </div>

        <div
          style={{
            marginTop: '40px',
            paddingTop: '20px',
            borderTop: '1px solid var(--border2)',
          }}
        >
          <div
            style={{
              fontSize: '14px',
              fontWeight: 700,
              color: 'var(--gold)',
              marginBottom: '12px',
            }}
          >
            💡 Have an Idea?
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text3)', marginBottom: '12px' }}>
            We want to build the ultimate dark fantasy world with you. Tell us
            what features or changes you'd like to see!
          </p>
          <textarea
            id="suggestion-input"
            placeholder="Enter your suggestion here..."
            style={{
              width: '100%',
              height: '100px',
              marginBottom: '12px',
              background: 'var(--bg2)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              padding: '10px',
              borderRadius: '8px',
              fontSize: '13px',
            }}
          ></textarea>
          <button
            className="base-btn variant-green"
            style={{ background: 'var(--green)', width: '100%', padding: '10px' }}
            onClick={submitSuggestion}
          >
            Submit Idea
          </button>
        </div>

        <button
          className="base-btn variant-accent"
          style={{ background: 'var(--accent1)', width: '100%', padding: '12px', marginTop: '20px' }}
          onClick={returnToKingdom}
        >
          Return to Kingdom
        </button>
      </div>
    </div>
  );
};

export default ChangelogPanel;
