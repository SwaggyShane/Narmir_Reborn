import React, { useState, useEffect } from 'react';
import './Portal.css';

const RACE_EMOJI = {
  human: '⚔️', orc: '🪓', dwarf: '⛏️', dark_elf: '🌙',
  vampire: '🦇', dire_wolf: '🐺', high_elf: '✨', undead: '💀',
};

const RACE_DATA = [
  {
    id: 'human', title: 'Humans of The Heartlands', icon: '⚔️', color: '#8fb84a',
    lore: 'Humans are not the strongest, the fastest, or the most magical. What they are is relentless. They breed quickly, adapt faster than any other race, and build institutions that outlast individual heroes.',
    strengths: ['Versatile and adaptable in all military areas', 'Exceptional population growth speed', 'Access to powerful morale-boosting clerics', 'Strong exploration initiatives'],
    weaknesses: ['Lacks specialization in any single discipline', 'Requires careful strategic balance'],
    heroes: ['Paladin', 'Grand Chancellor', 'High Consul'],
    special: 'Level 25+ clerics radiate a healing aura that restores kingdom morale',
    playstyle: 'Flexible all-rounder. Strong in long games where adaptation outweighs specialisation.',
  },
  {
    id: 'orc', title: 'Orcs of The Bloodplains', icon: '🪓', color: '#e05c5c',
    lore: "The Orcs have never needed a reason to go to war. The Bloodplains have been theirs since before the other races learned to write, and they intend to keep them — by force, by sheer weight of bodies.",
    strengths: ['Formidable front-line fighters', 'Significant military power bonuses', 'Passive troop generation from masters', 'Robust economic structure'],
    weaknesses: ['Poor investment in research', 'Virtually no magical aptitude', 'Slower construction progress'],
    heroes: ['Warlord', 'High Chieftain', 'Warshaman'],
    special: 'Level 25+ fighters passively generate free trainees each turn',
    playstyle: 'Blitzkrieg. Rush military, attack early, snowball fighter count with passive generation.',
  },
  {
    id: 'dwarf', title: 'Dwarves of The Iron Holds', icon: '⛏️', color: '#c8962a',
    lore: 'Deep beneath the mountain roots, Dwarven civilisation predates all others in recorded history. Their citadels are cities of impossible scale, carved across generations by engineers who see rock as other races see clay.',
    strengths: ['Master builders — extremely fast construction speed', 'Powerful economy and gold generation', 'Superior war machines and siege engines', 'Elite engineer training programs'],
    weaknesses: ['Very weak magical capabilities', 'Below-average resource research', 'Limited surface exploration range'],
    heroes: ['Siegebreaker', 'Forge Lord', 'Stonelord'],
    special: 'Level 25+ engineers can solo-crew war machines',
    playstyle: 'Economy and fortress play. Turtle behind walls, stockpile gold, outlast everyone.',
  },
  {
    id: 'dark_elf', title: 'Dark Elves of The Underspire', icon: '🌙', color: '#f06202',
    lore: 'No one knows how many Dark Elves there are. That is precisely how they like it. Operating from a vast underground network of city-warrens and shadow markets, they wage war through proxy, poison, and precision.',
    strengths: ['Unrivaled covert operations and stealth', 'Lethal units specialized in assassination', 'Trained rangers for high-risk scouting', 'Excellent global exploration'],
    weaknesses: ['Fragile military units in open battle', 'Modest economic output', 'Limited housing availability'],
    heroes: ['Assassin', 'Void Weaver', 'Shadowmaster'],
    special: 'Level 25+ ninjas perform silent assassinations — hidden from news reports',
    playstyle: 'Shadow warfare. Drain enemy gold and research with thieves, assassinate key units.',
  },
  {
    id: 'vampire', title: 'Vampires of The Sanguine Spires', icon: '🦇', color: '#b43c00',
    lore: 'Ancient and immortal, the Vampires view the other races as little more than cattle for their blood-feasts. From their dark spires, they command armies of thralls and necromantic soldiers.',
    strengths: ['Devastating efficiency during night hours', 'Recruits fallen enemies into their army', 'Rapid combat experience gain', 'Effective daytime stealth and evasion'],
    weaknesses: ['Significant combat penalties in daylight', 'Limited natural economic systems', 'Perpetual need for population consumption'],
    heroes: ['Night Lord', 'Sanguine Oracle', 'Blood Matriarch'],
    special: 'Level 25+ Infiltrators have significantly higher theft and sabotage success',
    playstyle: 'Necromantic conquest. Dominate the night, harvest souls, convert the fallen into your eternal army.',
  },
  {
    id: 'dire_wolf', title: 'Dire Wolves of The Ashfang Wilds', icon: '🐺', color: '#4a8fb8',
    lore: "The Dire Wolves do not build kingdoms — they claim territory. Their settlements are mobile, their supply chains are their rangers, and their economy is whatever they can take from the land before moving on.",
    strengths: ['Most powerful combatants in the realm', 'Elite rangers with rapid expedition cycle', 'Overwhelming natural military strength', 'Massive housing capacity from tribal lands'],
    weaknesses: ['Significant economic struggles', 'Extremely limited magical knowledge', 'High logistical upkeep for armies'],
    heroes: ['Alpha Pack-Leader', 'Storm Howler', 'Blood Shaman'],
    special: 'Level 25+ rangers execute expeditions at a much faster pace',
    playstyle: 'Raid and conquest. Hit fast, take land, use rangers for gold when not at war.',
  },
  {
    id: 'high_elf', title: 'High Elves of The Silverwood', icon: '✨', color: '#4caf82',
    lore: 'Ageless and arch, the High Elves have spent millennia convinced they are the chosen custodians of arcane knowledge. A High Elf mage at level 100 is worth ten of any other race.',
    strengths: ['Vast magical reserves and research potential', 'Can produce extra scrolls during crafting', 'Highly efficient mage and cleric training', 'Substantial mana generation per cycle'],
    weaknesses: ['Significant military fragility', 'Very limited housing capacity', 'Minimal population growth rate'],
    heroes: ['Archmage', 'Lunar Sentinel', 'Mage-King'],
    special: 'Level 25+ mages produce 2 scrolls per craft instead of 1',
    playstyle: 'Magic dominance. Stack mages, craft scrolls fast, debuff enemies with tier-3 spells.',
  },
  {
    id: 'undead', title: 'Undead of The Cursed Tombs', icon: '💀', color: '#7b68ee',
    lore: 'Neither living nor dead, the Undead command legions of the departed. They drain the life from all they touch, building power from the corpses of their enemies.',
    strengths: ['Command over death and undeath', 'Raises slain enemies as servants', 'Immunity to mortal poisons', 'Terrifying presence in battle'],
    weaknesses: ['Limited natural reproduction', 'Vulnerable to holy magic', 'Requires dark rituals for power'],
    heroes: ['Death Knight', 'Bone Weaver', 'Lich Lord'],
    special: 'Level 25+ necromancers permanently raise fallen enemy units',
    playstyle: 'Dark dominion. Raise the dead, amass undead armies, overwhelm through sheer numbers.',
  },
];

// ─── Race Selection Overlay ───────────────────────────────────────────────────

function RaceSelectOverlay({ selected, onSelect, onBack, onConfirm }) {
  const [hovered, setHovered] = useState(null);
  const active = hovered || selected;
  const activeRace = RACE_DATA.find(r => r.id === active);

  return (
    <div className="race-overlay">
      <div className="race-overlay-header">
        <h2 className="race-overlay-title">Choose Your Race</h2>
        <p className="race-overlay-sub">Your race shapes your kingdom's strengths, heroes, and destiny.</p>
      </div>

      <div className="race-overlay-body">
        <div className="race-grid">
          {RACE_DATA.map(race => (
            <button
              key={race.id}
              className={`race-pick-card${selected === race.id ? ' selected' : ''}`}
              style={{ '--race-color': race.color }}
              onClick={() => onSelect(race.id)}
              onMouseEnter={() => setHovered(race.id)}
              onMouseLeave={() => setHovered(null)}
            >
              <div className="race-pick-icon">{race.icon}</div>
              <div className="race-pick-name">{race.title.split(' of ')[0]}</div>
              <div className="race-pick-playstyle">{race.playstyle.split('.')[0]}</div>
            </button>
          ))}
        </div>

        <div className="race-detail-panel">
          {activeRace ? (
            <div className="race-detail-inner" style={{ '--race-color': activeRace.color }}>
              <div className="race-detail-header">
                <span className="race-detail-icon">{activeRace.icon}</span>
                <div>
                  <div className="race-detail-title">{activeRace.title}</div>
                  <div className="race-detail-heroes">Heroes: {activeRace.heroes.join(' · ')}</div>
                </div>
              </div>
              <p className="race-detail-lore">{activeRace.lore}</p>
              <div className="race-detail-section">
                <div className="race-detail-label">Strengths</div>
                <ul className="race-detail-list strengths">
                  {activeRace.strengths.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </div>
              <div className="race-detail-section">
                <div className="race-detail-label">Weaknesses</div>
                <ul className="race-detail-list weaknesses">
                  {activeRace.weaknesses.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              </div>
              <div className="race-detail-special">
                <span className="race-detail-special-label">✦ Special</span>
                {activeRace.special}
              </div>
              <div className="race-detail-playstyle">
                <span className="race-detail-special-label">⚔ Playstyle</span>
                {activeRace.playstyle}
              </div>
            </div>
          ) : (
            <div className="race-detail-empty">
              Hover over a race to learn more, or click to select.
            </div>
          )}
        </div>
      </div>

      <div className="race-overlay-footer">
        <button className="portal-ghost-btn" onClick={onBack}>← Back</button>
        <button className="portal-enter-btn race-confirm-btn" disabled={!selected} onClick={onConfirm}>
          {selected
            ? `Begin as ${RACE_DATA.find(r => r.id === selected)?.title?.split(' of ')[0]} →`
            : 'Select a Race'}
        </button>
      </div>
    </div>
  );
}

// ─── Auth Card ────────────────────────────────────────────────────────────────

function AuthCard({ onRegistration }) {
  const [authStatus, setAuthStatus] = useState('loading');
  const [view, setView] = useState('login'); // 'login' | 'race-select' | 'register'
  const [selectedRace, setSelectedRace] = useState(null);
  const [forgotMsg, setForgotMsg] = useState(false);

  const setViewWithTracking = (newView) => {
    setView(newView);
    if (onRegistration) {
      onRegistration(newView !== 'login');
    }
  };

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regKingdom, setRegKingdom] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch('/api/auth/me', { credentials: 'include', signal: ctrl.signal })
      .then(r => r.json())
      .then(d => setAuthStatus(d.username ? 'in' : 'out'))
      .catch(e => { if (e.name !== 'AbortError') setAuthStatus('out'); });
    return () => ctrl.abort();
  }, []);

  const doLogin = async e => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const r = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password }),
      });
      const d = await r.json();
      if (d.error) { setError(d.error); setSubmitting(false); return; }
      if (d.token) {
        try {
          localStorage.setItem('narmir_token', d.token);
        } catch (e) {
          console.warn('[auth] localStorage unavailable:', e.message);
        }
      }
      window.location.href = '/game';
    } catch {
      setError('Network error. Try again.');
      setSubmitting(false);
    }
  };

  const doRegister = async e => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const r = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          username: regUsername,
          password: regPassword,
          kingdomName: regKingdom,
          email: regEmail,
          race: selectedRace || 'human',
        }),
      });
      const d = await r.json();
      if (d.error) { setError(d.error); setSubmitting(false); return; }
      if (d.token) {
        try {
          localStorage.setItem('narmir_token', d.token);
        } catch (e) {
          console.warn('[auth] localStorage unavailable:', e.message);
        }
      }
      window.location.href = '/game';
    } catch {
      setError('Network error. Try again.');
      setSubmitting(false);
    }
  };

  if (authStatus === 'loading') {
    return (
      <div className="portal-card">
        <div className="portal-loading">Checking session…</div>
      </div>
    );
  }

  if (authStatus === 'in') {
    return (
      <div className="portal-card auth-modal-card">
        <div className="auth-modal-title">Welcome Back</div>
        <p className="auth-modal-sub">Your kingdom awaits, Commander.</p>
        <a href="/game" className="portal-enter-btn auth-login-btn" style={{ marginTop: '1rem', display: 'block', textAlign: 'center' }}>ENTER</a>
      </div>
    );
  }

  if (view === 'race-select') {
    return (
      <RaceSelectOverlay
        selected={selectedRace}
        onSelect={setSelectedRace}
        onBack={() => setViewWithTracking('login')}
        onConfirm={() => setViewWithTracking('register')}
      />
    );
  }

  if (view === 'register') {
    const raceInfo = RACE_DATA.find(r => r.id === selectedRace);
    return (
      <div className="portal-card auth-modal-card">
        <div className="auth-modal-title">Create Your Kingdom</div>
        <p className="auth-modal-sub">Your path begins now.</p>

        {raceInfo && (
          <>
            <div className="reg-race-badge" style={{ '--race-color': raceInfo.color }}>
              <span className="reg-race-icon">{raceInfo.icon}</span>
              <div>
                <div className="reg-race-name">{raceInfo.title.split(' of ')[0]}</div>
                <button className="reg-race-change" onClick={() => setViewWithTracking('race-select')}>Change race</button>
              </div>
            </div>

            <div className="reg-warning" style={{ borderColor: raceInfo.color }}>
              <strong>⚠️ PERMANENT CHOICE</strong><br/>
              Your race cannot be changed after creation. Choose carefully.
            </div>

            {selectedRace === 'vampire' && (
              <div className="reg-warning vampire-warning">
                <strong>⚠️ Experienced Players Only</strong><br/>
                Vampires are nearly powerless during daylight hours and rely on Thralls for daytime defense. Covert and night-assault mechanics must be well understood before playing this race effectively.
              </div>
            )}
          </>
        )}

        <form onSubmit={doRegister}>
          <input className="portal-input" type="text" placeholder="Username" value={regUsername}
            onChange={e => setRegUsername(e.target.value)} required autoComplete="username" />
          <input className="portal-input" type="text" placeholder="Kingdom Name" value={regKingdom}
            onChange={e => setRegKingdom(e.target.value)} required />
          <input className="portal-input" type="email" placeholder="Email" value={regEmail}
            onChange={e => setRegEmail(e.target.value)} required autoComplete="email" />
          <input className="portal-input" type="password" placeholder="Password" value={regPassword}
            onChange={e => setRegPassword(e.target.value)} required autoComplete="new-password" />
          <p className="auth-password-hint">8+ chars · uppercase · lowercase · number · special (@$!%*?&)</p>
          {error && <p className="portal-error">{error}</p>}
          <div className="auth-btn-row">
            <button type="button" className="portal-ghost-btn" onClick={() => setViewWithTracking('race-select')}>← Back</button>
            <button type="submit" className="portal-enter-btn auth-register-btn" disabled={submitting}>
              {submitting ? '…' : 'BEGIN YOUR REIGN'}
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="portal-card auth-modal-card">
      <div className="auth-modal-title">Enter the Realm</div>
      <p className="auth-modal-sub">Pure. Damn. Evil.</p>

      <form onSubmit={doLogin}>
        <input className="portal-input" type="text" placeholder="Username" value={username}
          onChange={e => setUsername(e.target.value)} required autoComplete="username" />
        <input className="portal-input" type="password" placeholder="Password" value={password}
          onChange={e => setPassword(e.target.value)} required autoComplete="current-password" />

        <div className="auth-forgot-row">
          <button type="button" className="auth-forgot-btn" onClick={() => setForgotMsg(v => !v)}>
            Forgot password?
          </button>
        </div>
        {forgotMsg && (
          <p className="auth-forgot-msg">
            Password recovery coming soon. Contact <a href="mailto:admin@narmir.com">admin@narmir.com</a> for help.
          </p>
        )}

        {error && <p className="portal-error">{error}</p>}

        <div className="auth-btn-row">
          <button type="submit" className="portal-enter-btn auth-login-btn" disabled={submitting}>
            {submitting ? '…' : 'Login'}
          </button>
          <button type="button" className="portal-enter-btn auth-register-btn"
            onClick={() => { setError(''); setViewWithTracking('race-select'); }}>
            Register
          </button>
        </div>
      </form>

      <p className="auth-bottom-hint">New to Narmir? Click Register to create your kingdom.</p>
    </div>
  );
}

// ─── Rankings Table ───────────────────────────────────────────────────────────

function RankingsTable() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch('/api/public/rankings', { signal: ctrl.signal })
      .then(r => {
        if (!r.ok) throw new Error('Network response was not ok');
        return r.json();
      })
      .then(d => {
        if (d.error) throw new Error(d.error);
        setRows(d.rankings || []);
        setLoading(false);
      })
      .catch(e => {
        if (e.name !== 'AbortError') { setError(true); setLoading(false); }
      });
    return () => ctrl.abort();
  }, []);

  return (
    <div className="portal-card">
      <h2 className="portal-section-title">⚔️ Top Kingdoms</h2>
      {loading && <div className="portal-loading">Loading rankings…</div>}
      {error && <div className="portal-loading">Could not load rankings.</div>}
      {!loading && !error && (
        <table className="portal-rankings-table">
          <thead>
            <tr>
              <th>#</th><th>Kingdom</th><th>Race</th><th>Land</th><th>Lvl</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id ?? i} className={r.is_ai ? 'ai-row' : ''}>
                <td className={`rank-num${i < 3 ? ' rank-top3' : ''}`}>{i + 1}</td>
                <td>
                  <div className="kingdom-cell">
                    <span className="kingdom-name-text">{r.name}</span>
                    <span className="kingdom-username">{r.username}</span>
                  </div>
                </td>
                <td className="race-cell">
                  {RACE_EMOJI[r.race] || '🏰'} {r.race ? r.race.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : 'Unknown'}
                </td>
                <td>{r.land?.toLocaleString()}</td>
                <td>{r.level}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ─── Forums Card ──────────────────────────────────────────────────────────────

function ForumsCard() {
  return (
    <div className="portal-card">
      <h2 className="portal-section-title">📜 Forums</h2>
      <p className="portal-coming-soon">
        Forums are coming soon. In the meantime, join the community on Discord for news, strategy, and war reports.
      </p>
      <a href="https://discord.gg/narmir" className="portal-discord-btn" target="_blank" rel="noopener noreferrer">
        💬 Join Discord
      </a>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Portal() {
  const [registrationView, setRegistrationView] = useState(false);

  return (
    <div className="portal-root">
      <header className="portal-header">
        <a href="/" className="portal-back-link">← Home</a>
        <h1 className="portal-title">NARMIR REBORN</h1>
        <p className="portal-tagline">Rise From the Ashes. Forge Your Legacy.</p>
      </header>

      <main className="portal-main">
        {!registrationView && (
          <div className="portal-col-left">
            <RankingsTable />
          </div>
        )}
        <div className={`portal-col-right${registrationView ? ' registration-full' : ''}`}>
          <AuthCard onRegistration={setRegistrationView} />
          {!registrationView && <ForumsCard />}
        </div>
      </main>

      <footer className="portal-footer">
        <span>© 2025 Narmir Reborn</span>
        <a href="/" className="portal-footer-link">← Back to Home</a>
      </footer>
    </div>
  );
}
