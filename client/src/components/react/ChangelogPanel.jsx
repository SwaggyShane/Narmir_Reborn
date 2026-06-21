import React from 'react';
import { toast } from '../../utils/toast.js';
import { switchTab } from '../../utils/panelNav.js';

const sectionCard = 'rounded-2xl border border-[var(--border)] bg-[var(--bg3)] p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.02)_inset]';
const titleLine = 'mb-4 border-b border-[var(--border2)] pb-2 text-[16px] font-bold text-[var(--gold)]';
const copy = 'text-[13px] leading-6 text-[var(--text2)]';
const listCopy = 'space-y-3 text-[13px] leading-7 text-[var(--text2)]';
const label = 'text-[14px] font-bold text-[var(--text)]';
const smallLabel = 'text-[11px] uppercase tracking-[0.18em] text-[var(--text3)]';

const ChangelogPanel = () => {
  const submitSuggestion = () => {
    toast('Suggestion submission is not wired up yet.', 'warn');
  };

  const returnToKingdom = () => {
    switchTab('status');
  };

  return (
    <div id="changelog" className="panel min-h-0 w-full overflow-y-auto px-4 pb-5" style={{ display: 'none' }}>
      <div className="mx-auto mt-0 w-full max-w-6xl rounded-[20px] border border-[var(--border)] bg-[var(--bg2)] p-6">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="card-title !mb-0">📋 Changelog & Updates</div>
        </div>

        <div className="space-y-6">
          <section className={sectionCard}>
            <h2 className={titleLine}>🔥 Latest Updates (May 2026)</h2>
            <div className="space-y-4">
              <div>
                <div className={label}>🌲 Advanced Resources & Fortifications</div>
                <ul className={listCopy}>
                  <li>
                    <strong className="text-[var(--text)]">🪨 Resource Systems:</strong>{' '}
                    Wood, Stone, and Iron can now be gathered via specialized buildings and expeditions.
                  </li>
                  <li>
                    <strong className="text-[var(--text)]">🥘 Food Supply:</strong>{' '}
                    Manage starvation and surpluses to keep your troops ready and able to march on Resource Expeditions.
                  </li>
                  <li>
                    <strong className="text-[var(--text)]">💀 Mausoleums & Thralls:</strong>{' '}
                    Reanimate fallen enemies into Thralls to automate basic labor around your kingdom.
                  </li>
                  <li>
                    <strong className="text-[var(--text)]">🧱 Advanced Defenses:</strong>{' '}
                    Build and upgrade protective walls to secure your kingdom from hostile invaders.
                  </li>
                  <li>
                    <strong className="text-[var(--text)]">⚙️ Advanced Blueprints:</strong>{' '}
                    Craft Hybrid and Fortified blueprints using the new elemental fragments and rare materials.
                  </li>
                </ul>
              </div>
            </div>
          </section>

          <section className={sectionCard}>
            <h2 className={titleLine}>🔥 Latest Updates (April 2026)</h2>
            <div className="space-y-4">
              <div>
                <div className={label}>🛠️ Game Interface & Logic Patch (v1.0.6)</div>
                <ul className={listCopy}>
                  <li>
                    <strong className="text-[var(--text)]">🏆 Achievements:</strong>{' '}
                    Discover custom unlockables and titles inside your Library.
                  </li>
                  <li>
                    <strong className="text-[var(--text)]">🎁 Prestige System:</strong>{' '}
                    A new beginning awaits with permanent bonuses for max level resets.
                  </li>
                  <li>
                    <strong className="text-[var(--text)]">🌦️ Seasons & Daily Events:</strong>{' '}
                    Unpredicted world conditions impacting crop yields and happiness.
                  </li>
                  <li>
                    <strong className="text-[var(--text)]">📈 Dynamic Pricing:</strong>{' '}
                    Market commodities respond to supply and demand server-wide.
                  </li>
                  <li>
                    <strong className="text-[var(--text)]">🤝 Trade Connections:</strong>{' '}
                    Establish long-term trade routes for steady passive gold.
                  </li>
                  <li>
                    <strong className="text-[var(--text)]">⚔️ Trade Raiding:</strong>{' '}
                    Aggressive kingdoms can pillage the trade routes of their enemies.
                  </li>
                  <li>
                    <strong className="text-[var(--text)]">🔊 Immersive Audio:</strong>{' '}
                    Enjoy sound effects for various actions in your kingdom!
                  </li>
                  <li>
                    <strong className="text-[var(--text)]">✨ Named Heroes:</strong>{' '}
                    Recruit legendary leaders to lead your armies and research.
                  </li>
                  <li>
                    <strong className="text-[var(--text)]">🧱 Siege Mechanics:</strong>{' '}
                    Fortify with Walls to protect your holdings from damage.
                  </li>
                  <li>
                    <strong className="text-[var(--text)]">🏰 Citadel Badge:</strong>{' '}
                    Now displays on Defense and Status panels when met.
                  </li>
                  <li>
                    <strong className="text-[var(--text)]">✨ Racial Gift Badge:</strong>{' '}
                    Now visible on the Training panel for active bonuses.
                  </li>
                  <li>
                    <strong className="text-[var(--text)]">⚓ Siege Badge:</strong>{' '}
                    Added to war machines on the status page.
                  </li>
                  <li>
                    <strong className="text-[var(--text)]">📈 Rankings Modernization:</strong>{' '}
                    New columns (Player, Score, Turns) and stats privacy.
                  </li>
                  <li>
                    <strong className="text-[var(--text)]">📦 Trade Logs:</strong>{' '}
                    New "Clear Logs" button in markets to tidy up old offers.
                  </li>
                  <li>
                    <strong className="text-[var(--text)]">💛 Hire Page Rework:</strong>{' '}
                    High-contrast yellow labels and improved column alignment.
                  </li>
                  <li>
                    <strong className="text-[var(--text)]">📖 Library Sync:</strong>{' '}
                    Upgrades and residents (scribes only) are now correctly synced.
                  </li>
                </ul>
              </div>
            </div>
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className={sectionCard}>
              <div className={label}>📜 Race Lore Expansion</div>
              <p className={copy}>
                Ancient secrets are beginning to stir. Your turn reports now have a chance to include rare historical events and lore snippets specific to your race and region, bringing the deep history of Narmir to life.
              </p>
            </section>

            <section className={sectionCard}>
              <div className={label}>🚩 Region Capture & Mastery</div>
              <p className={copy}>
                Alliances can now contest and capture the six major regions of Narmir. Holding a region grants your entire alliance a 10% bonus to that region's signature stat (Military, Magic, Economy, etc.). Check the 🗺️ World Map to see capture progress!
              </p>
            </section>

            <section className={sectionCard}>
              <div className={label}>📊 Alliance Leaderboards</div>
              <p className={copy}>
                A new "Alliance" tab has been added to the Rankings panel. Compare your coalition's total land, member counts, and average strength against every other Alliance in the realm.
              </p>
            </section>

            <section className={sectionCard}>
              <div className={label}>📝 Kingdom Lore & Bios</div>
              <p className={copy}>
                Tell your story. You can now write a custom lore description for your kingdom in your Kingdom view. These bios are saved to your profile and visible to all players who inspect your kingdom.
              </p>
            </section>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className={sectionCard}>
              <div className={label}>💀 Narmir Reborn: Pure. Damn. Evil.</div>
              <p className={copy}>
                Complete aesthetic overhaul. The land of Narmir has officially evolved into its darker, gritier "Reborn" state.
              </p>
            </section>

            <section className={sectionCard}>
              <div className={label}>✨ Racial masteries (Level 25+)</div>
              <p className="mb-2 text-[13px] leading-6 text-[var(--text2)]">
                Veteran units now unlock powerful race-specific abilities once they reach Level 5:
              </p>
              <ul className={listCopy}>
                <li>
                  <strong className="text-[var(--text)]">🔨 Dwarf Engineers:</strong>{' '}
                  Can solo-crew heavy war machines.
                </li>
                <li>
                  <strong className="text-[var(--text)]">✨ High Elf Mages:</strong>{' '}
                  Produce two scrolls per crafting session.
                </li>
                <li>
                  <strong className="text-[var(--text)]">🐺 Orc Fighters:</strong>{' '}
                  Passively train 1 free fighter per 10 every turn.
                </li>
                <li>
                  <strong className="text-[var(--text)]">🕵️ Dark Elf Ninjas:</strong>{' '}
                  Silent assassination (targets get no news).
                </li>
                <li>
                  <strong className="text-[var(--text)]">🐺 Dire Wolf Rangers:</strong>{' '}
                  Expeditions return 1 turn early.
                </li>
                <li>
                  <strong className="text-[var(--text)]">💚 Human Clerics:</strong>{' '}
                  Radiate a happiness aura.
                </li>
              </ul>
            </section>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className={sectionCard}>
              <div className={label}>💬 Chat Personalization</div>
              <p className={copy}>
                Use <code className="text-[var(--accent1)]">/nick &lt;name&gt;</code> to set a
                persistent nickname and <code className="text-[var(--accent1)]">/color &lt;hex&gt;</code> to
                choose your chat color. These settings are now saved to your profile!
              </p>
            </section>

            <section className={sectionCard}>
              <div className={label}>🛡️ Extended Newbie Protection</div>
              <p className={copy}>
                To ensure all new leaders have time to fortify their holds, protection from attacks and spells has been extended to <strong className="text-[var(--gold)]">Turn 400</strong>.
              </p>
            </section>

            <section className={sectionCard}>
              <div className={label}>🏗️ Racial Starting Buildings</div>
              <p className={copy}>
                Fresh kingdoms now receive a starting kit of buildings unique to their heritage, allowing you to leverage your race's strengths from day one.
              </p>
            </section>
          </div>

          <section className={sectionCard}>
            <div className="mb-3 text-[14px] font-bold text-[var(--gold)]">💡 Have an Idea?</div>
            <p className="mb-3 text-[13px] leading-6 text-[var(--text3)]">
              We want to build the ultimate dark fantasy world with you. Tell us what features or changes you'd like to see!
            </p>
            <textarea
              id="suggestion-input"
              placeholder="Enter your suggestion here..."
              className="mb-3 min-h-[110px] w-full rounded-xl border border-[var(--border)] bg-[var(--bg2)] p-3 text-[13px] text-[var(--text)] outline-none transition focus:border-[var(--accent1)]"
            />
            <button
              className="base-btn variant-green w-full px-4 py-3"
              style={{ background: 'var(--green)' }}
              onClick={submitSuggestion}
            >
              Submit Idea
            </button>
          </section>

          <button
            className="base-btn variant-accent w-full px-4 py-3"
            style={{ background: 'var(--accent1)', marginTop: 0 }}
            onClick={returnToKingdom}
          >
            Return to Kingdom
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChangelogPanel;
