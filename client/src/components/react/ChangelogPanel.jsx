import React, { useEffect, useState } from 'react';
import clsx from 'clsx';
import { toast } from '../../utils/toast.js';
import { switchTab } from '../../utils/panelNav.js';
import { apiCall } from '../../utils/api.mjs';
import ChangelogEntryCard from './ChangelogEntryCard.jsx';

const sectionCard = 'rounded-2xl border border-[var(--border)] bg-[var(--bg3)] p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.02)_inset]';
const titleLine = 'mb-4 border-b border-[var(--border2)] pb-2 text-[15px] font-bold text-[var(--gold)]';
const copy = 'text-[13px] leading-6 text-[var(--text2)]';
const listCopy = 'space-y-3 text-[13px] leading-7 text-[var(--text2)]';
const label = 'text-[14px] font-bold text-[var(--text)]';

const ChangelogPanel = () => {
  const [liveEntries, setLiveEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiCall('/api/changelog')
      .then((data) => {
        if (Array.isArray(data)) setLiveEntries(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const submitSuggestion = async () => {
    const el = document.getElementById('suggestion-input');
    const message = el?.value?.trim();
    if (!message || message.length < 5) {
      toast('Enter at least 5 characters for your suggestion.', 'warn');
      return;
    }
    const data = await apiCall('/api/suggestions', { method: 'POST', body: { message } });
    if (data?.error) {
      toast(data.error, 'error');
      return;
    }
    toast(data?.message || 'Thank you!', 'success');
    if (el) el.value = '';
  };

  const returnToKingdom = () => {
    switchTab('status');
  };

  return (
    <div id="changelog" className="panel">
      <div className="mx-auto mt-0 w-full max-w-6xl rounded-[20px] border border-[var(--border)] bg-[var(--bg2)] p-4 sm:p-6">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="card-title !mb-1">📋 Changelog & Updates</div>
            <p className="text-[13px] leading-6 text-[var(--text3)]">
              Live patch notes from the realm — updated when the team publishes.
            </p>
          </div>
          <div className="rounded-full border border-ember-900/40 bg-void-950/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--gold)]">
            Pure. Damn. Evil.
          </div>
        </div>

        <div className="space-y-6">
          {loading ? (
            <div className="rounded-2xl border border-dashed border-white/10 px-6 py-12 text-center text-[13px] text-[var(--text3)]">
              Summoning the latest dispatches...
            </div>
          ) : liveEntries.length > 0 ? (
            <section className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-ember-500/40 to-transparent" />
                <span className="font-cinzel text-[12px] font-bold uppercase tracking-[0.28em] text-[var(--gold)]">
                  Live Updates
                </span>
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-ember-500/40 to-transparent" />
              </div>
              {liveEntries.map((entry, index) => (
                <ChangelogEntryCard key={entry.id} entry={entry} featured={index === 0} />
              ))}
            </section>
          ) : (
            <div className="rounded-2xl border border-dashed border-white/10 bg-[var(--bg3)]/50 px-6 py-10 text-center">
              <div className="text-3xl">📜</div>
              <p className="mt-3 text-[14px] font-semibold text-[var(--text2)]">No live updates yet</p>
              <p className="mt-1 text-[13px] text-[var(--text3)]">New entries appear here when published from admin.</p>
            </div>
          )}

          <details className="changelog-archive group rounded-2xl border border-white/5 bg-[var(--bg3)]/40 open:bg-[var(--bg3)]">
            <summary className="cursor-pointer list-none px-5 py-4 font-cinzel text-[14px] font-bold text-[var(--text2)] transition hover:text-[var(--gold)] [&::-webkit-details-marker]:hidden">
              <span className="inline-flex items-center gap-2">
                <span className="text-[var(--text3)] transition group-open:rotate-90">▸</span>
                Archive — earlier milestones
              </span>
            </summary>
            <div className="space-y-6 border-t border-white/5 px-5 pb-5 pt-4">
              <section className={sectionCard}>
                <h2 className={titleLine}>🔥 Latest Updates (May 2026)</h2>
                <div className={label}>🌲 Advanced Resources & Fortifications</div>
                <ul className={clsx(listCopy, 'mt-3')}>
                  <li><strong className="text-[var(--text)]">🪨 Resource Systems:</strong> Wood, Stone, and Iron via specialized buildings and expeditions.</li>
                  <li><strong className="text-[var(--text)]">🥘 Food Supply:</strong> Manage starvation and surpluses for expeditions.</li>
                  <li><strong className="text-[var(--text)]">💀 Mausoleums & Thralls:</strong> Reanimate fallen enemies into labor thralls.</li>
                  <li><strong className="text-[var(--text)]">🧱 Advanced Defenses:</strong> Walls and fortified holdings.</li>
                  <li><strong className="text-[var(--text)]">⚙️ Advanced Blueprints:</strong> Hybrid and Fortified blueprint crafting.</li>
                </ul>
              </section>

              <section className={sectionCard}>
                <h2 className={titleLine}>🔥 Latest Updates (April 2026)</h2>
                <div className={label}>🛠️ Game Interface & Logic Patch (v1.0.6)</div>
                <ul className={clsx(listCopy, 'mt-3')}>
                  <li><strong className="text-[var(--text)]">🏆 Achievements:</strong> Unlockables and titles in your Library.</li>
                  <li><strong className="text-[var(--text)]">🎁 Prestige System:</strong> Permanent bonuses for max-level resets.</li>
                  <li><strong className="text-[var(--text)]">🌦️ Seasons & Daily Events:</strong> World conditions affecting yields and happiness.</li>
                  <li><strong className="text-[var(--text)]">📈 Dynamic Pricing:</strong> Market commodities respond to supply and demand.</li>
                  <li><strong className="text-[var(--text)]">🔊 Immersive Audio:</strong> Sound effects across kingdom actions.</li>
                </ul>
              </section>

              <div className="grid gap-6 lg:grid-cols-2">
                <section className={sectionCard}>
                  <div className={label}>📜 Race Lore Expansion</div>
                  <p className={copy}>Turn reports can surface rare historical events and lore tied to your race and region.</p>
                </section>
                <section className={sectionCard}>
                  <div className={label}>🚩 Region Capture & Mastery</div>
                  <p className={copy}>Alliances contest regions for +10% alliance-wide bonuses. Check the World Map.</p>
                </section>
              </div>
            </div>
          </details>

          <section className={sectionCard}>
            <div className="mb-3 text-[14px] font-bold text-[var(--gold)]">💡 Have an Idea?</div>
            <p className="mb-3 text-[13px] leading-6 text-[var(--text3)]">
              Help shape the realm — feature ideas go straight to the admin team.
            </p>
            <textarea
              id="suggestion-input"
              placeholder="Enter your suggestion here..."
              className="mb-3 min-h-[110px] w-full rounded-xl border border-[var(--border)] bg-[var(--bg2)] p-3 text-[13px] text-[var(--text)] outline-none transition focus:border-[var(--accent1)]"
            />
            <button
              className="base-btn variant-green w-full px-4 py-3 bg-[var(--green)]"
              onClick={submitSuggestion}
            >
              Submit Idea
            </button>
          </section>

          <button
            className="base-btn variant-accent w-full px-4 py-3 bg-[var(--accent1)]"
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