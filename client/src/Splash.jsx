import React, { useState, useEffect, useRef, useCallback } from 'react';
import './Splash.css';

// ─── Constants ────────────────────────────────────────────────────────────────

const RACES = [
  { id: 'human',     name: 'Human',     emoji: '⚔️', lore: 'Versatile builders and diplomats' },
  { id: 'orc',       name: 'Orc',       emoji: '🪓', lore: 'Fearsome warriors bred for conquest' },
  { id: 'dwarf',     name: 'Dwarf',     emoji: '⛏️', lore: 'Master craftsmen of mountain holds' },
  { id: 'dark_elf',  name: 'Dark Elf',  emoji: '🌙', lore: 'Shadows and sorcery, unseen and deadly' },
  { id: 'vampire',   name: 'Vampire',   emoji: '🦇', lore: 'Undying lords of blood and night' },
  { id: 'dire_wolf', name: 'Dire Wolf', emoji: '🐺', lore: 'Pack hunters, swift and relentless' },
];

const FEATURES = [
  { id: 'building',  icon: '🏰', title: 'Kingdom Building',    desc: 'Construct farms, barracks, walls and more. Every building shapes your strategy and expands your power.' },
  { id: 'military',  icon: '⚔️', title: 'Military Conquest',   desc: 'Command armies, siege enemy lands, and dominate through war — or cunning raids in the dead of night.' },
  { id: 'magic',     icon: '🔮', title: 'Magic & Alchemy',     desc: 'Study arcane arts, attune ancient fragments, and unleash devastating spells upon your enemies.' },
  { id: 'economy',   icon: '💰', title: 'Trade & Economy',     desc: 'Master the markets, hire mercenaries, and build wealth through shrewd commerce and resource mastery.' },
  { id: 'alliance',  icon: '🛡️', title: 'Alliance Warfare',   desc: 'Join forces with allies, coordinate strategies, share buffs, and claim collective glory.' },
  { id: 'prestige',  icon: '👑', title: 'Prestige System',     desc: 'Rebirth your kingdom, carrying hard-won wisdom forward into a more powerful incarnation.' },
];

const NAV_LINKS = [
  'Play Narmir', 'Forums', 'Rankings', 'Worlds',
  'New Player Help', 'Hosted Sites', 'Windows Quest',
  'Contact Us', 'Tradewars',
];

// Approximate color of each horizontal eighth of the retro page
const TEAR_GRADIENTS = [
  'linear-gradient(to right, #050510 100%)',
  'linear-gradient(to right, #0a0a1a 100%)',
  'linear-gradient(to right, #0000bb 160px, #e8e8e8 160px)',
  'linear-gradient(to right, #0000aa 160px, #f5f5f5 160px)',
  'linear-gradient(to right, #0000bb 160px, #ffffff 160px)',
  'linear-gradient(to right, #0000aa 160px, #f5f5f5 160px)',
  'linear-gradient(to right, #0000bb 160px, #f0f0f0 160px)',
  'linear-gradient(to right, #0000aa 160px, #e0e0e0 160px)',
];

const GLITCH_CHARS = '▒█▓░@#%&*^~!?><╗╔╚╝║═±§¶';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function corruptString(str) {
  return str.split('').map(c =>
    Math.random() < 0.2 ? GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)] : c
  ).join('');
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function EmberParticles() {
  const [particles] = useState(() =>
    Array.from({ length: 30 }, (_, i) => ({
      id: i,
      left: `${5 + Math.random() * 90}%`,
      size: `${2 + Math.random() * 4}px`,
      delay: `-${Math.random() * 8}s`,
      duration: `${5 + Math.random() * 7}s`,
      color: Math.random() < 0.7 ? '#f06202' : '#ff4400',
    }))
  );

  return (
    <div className="ember-container" aria-hidden="true">
      {particles.map(p => (
        <div
          key={p.id}
          className="ember"
          style={{
            left: p.left,
            width: p.size,
            height: p.size,
            background: p.color,
            boxShadow: `0 0 6px 2px ${p.color}`,
            animationDelay: p.delay,
            animationDuration: p.duration,
          }}
        />
      ))}
    </div>
  );
}

function AuthBlock({ status, onEnter, fading }) {
  const handleEnter = (e, href) => {
    e.preventDefault();
    if (fading) return;
    if (onEnter) onEnter();
    setTimeout(() => {
      window.location.href = href;
    }, 500);
  };

  if (status === 'loading') {
    return (
      <div className="auth-loading">
        <span className="dot" style={{ animationDelay: '0s' }} />
        <span className="dot" style={{ animationDelay: '0.2s' }} />
        <span className="dot" style={{ animationDelay: '0.4s' }} />
      </div>
    );
  }

  if (status === 'in') {
    return (
      <div className="auth-continue">
        <a href="/game" onClick={(e) => handleEnter(e, '/game')} className="continue-btn">ENTER</a>
        <p className="auth-sub">Your kingdom awaits</p>
      </div>
    );
  }

  return (
    <div className="auth-continue">
      <a href="/portal" onClick={(e) => handleEnter(e, '/portal')} className="continue-btn">ENTER</a>
      <p className="auth-sub">Rankings · Login · Forums</p>
    </div>
  );
}

function RetroSite({ glitch }) {
  const g = glitch;
  return (
    <div className="retro-site">
      <div className="retro-header">
        <div className="retro-logo-block">
          <span className="retro-logo-name">{g.title ?? 'NARMIR'}</span>
          <span className="retro-logo-tagline">{g.tagline ?? 'Land of Magic and Conquest'}</span>
        </div>
      </div>

      <div className="retro-body">
        <nav className="retro-nav">
          {NAV_LINKS.map((link, i) => (
            <a
              key={i}
              href="#"
              className={`retro-nav-link${i === 0 ? ' first' : ''}`}
              onClick={e => e.preventDefault()}
            >
              {i === 0 ? (g.nav0 ?? link) : i === 1 ? (g.nav1 ?? link) : i === 2 ? (g.nav2 ?? link) : link}
            </a>
          ))}
        </nav>

        <main className="retro-content">
          <h2 className="retro-h2">{g.heading ?? 'Welcome to Narmir'}</h2>
          <hr className="retro-hr" />
          <p>
            Welcome to Narmir a unique game experience like none other. Narmir is 100%
            free and playable from any java capable browser such as Internet Explorer
            or Netscape.
          </p>
          <p>
            If you have problems loading the game be sure to email us at the link below.
            Also you might want to check at{' '}
            <a href="#" onClick={e => e.preventDefault()}>online-java.com</a>{' '}
            for help with computer and browser problems.
          </p>
          <hr className="retro-hr" />
          <h3 className="retro-h3">{g.java ?? 'Java Requirement'}</h3>
          <p>
            Sorry, you must use a Java capable browser or enable Java in your
            browser&apos;s options to play Narmir. WebTV users, currently WebTV does
            NOT support Java and so you won&apos;t be able to play this game, but you
            might try{' '}
            <a href="#" onClick={e => e.preventDefault()}>tradewars</a>, one of the most
            popular games of this genre but requires no more than an HTML browser to
            play. Another good game is{' '}
            <a href="#" onClick={e => e.preventDefault()}>kingdoms</a> which is in
            similar settings to this game.
          </p>
          <hr className="retro-hr" />
          <p className="retro-small-red">
            If you have any problems or need verification contact please email me at{' '}
            <a href="#" onClick={e => e.preventDefault()}>admin@narmir.com</a>
          </p>
        </main>
      </div>

      <div className="retro-statusbar">
        <span>© 2003 Narmir.com — All Rights Reserved</span>
        <span>Best viewed in Internet Explorer 6.0 at 800×600</span>
      </div>
    </div>
  );
}

function RacePortrait({ race }) {
  const [hasError, setHasError] = useState(false);
  return (
    <div className="race-portrait">
      {!hasError ? (
        <img src={`/race/${race.id}_male.webp`} alt={race.name} onError={() => setHasError(true)} />
      ) : (
        <span className="race-fallback-emoji">{race.emoji}</span>
      )}
    </div>
  );
}

function ModernSplash({ authStatus, onEnter, fading }) {
  const sectionRef = useRef(null);

  useEffect(() => {
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); }),
      { threshold: 0.12 }
    );
    if (sectionRef.current) {
      sectionRef.current.querySelectorAll('.reveal').forEach(el => obs.observe(el));
    }
    return () => obs.disconnect();
  }, []);

  return (
    <div className="modern-splash" ref={sectionRef}>
      {/* Video background */}
      <div className="video-bg">
        <video autoPlay muted playsInline preload="auto">
          <source src="/intro.mp4" type="video/mp4" />
        </video>
        <div className="video-overlay" />
      </div>

      <EmberParticles />

      {/* Hero */}
      <section className="hero-section">
        <h1 className="hero-title">NARMIR REBORN</h1>
        <p className="hero-tagline">Rise From the Ashes. Forge Your Legacy.</p>
        <div className="auth-block">
          <AuthBlock status={authStatus} onEnter={onEnter} fading={fading} />
        </div>
        <div className="scroll-hint" aria-hidden="true">
          <span className="scroll-arrow">↓</span>
        </div>
      </section>

      {/* Race showcase */}
      <section className="race-section">
        <h2 className="section-title reveal">Choose Your Race</h2>
        <div className="race-row">
          {RACES.map((race, i) => (
            <div
              key={race.id}
              className="race-card reveal"
              style={{ transitionDelay: `${i * 0.08}s` }}
            >
              <RacePortrait race={race} />
              <div className="race-name">{race.name}</div>
              <div className="race-lore">{race.lore}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Feature grid */}
      <section className="features-section">
        <h2 className="section-title reveal">Build Your Empire</h2>
        <div className="feature-grid">
          {FEATURES.map((f, i) => (
            <div
              key={f.id}
              className="feature-card reveal"
              style={{ transitionDelay: `${i * 0.07}s` }}
            >
              <div className="feature-icon">{f.icon}</div>
              <h3 className="feature-title">{f.title}</h3>
              <p className="feature-desc">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="splash-footer">
        <span>© 2025 Narmir Reborn</span>
        <span className="footer-sep">·</span>
        <a href="/portal" className="footer-link">Enter</a>
      </footer>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Splash() {
  const [phase, setPhase] = useState(() => {
    try {
      return (sessionStorage.getItem('narmir_intro_seen') || localStorage.getItem('narmir_skip_intro'))
        ? 'modern' : 'retro';
    } catch (e) {
      return 'retro';
    }
  }); // 'retro' | 'glitch' | 'modern'
  const [tearing, setTearing] = useState(false);
  const [showFlash, setShowFlash] = useState(false);
  const [glitch, setGlitch] = useState({});
  const [authStatus, setAuthStatus] = useState('loading');
  const [fading, setFading] = useState(false);
  const timers = useRef([]);

  // Check auth on mount
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/auth/me', { credentials: 'include', signal: controller.signal })
      .then(r => r.ok ? setAuthStatus('in') : setAuthStatus('out'))
      .catch(err => { if (err.name !== 'AbortError') setAuthStatus('out'); });
    return () => controller.abort();
  }, []);

  // Cleanup all timers on unmount
  useEffect(() => () => {
    timers.current.forEach(t => { clearTimeout(t); clearInterval(t); });
  }, []);

  const triggerGlitch = useCallback(() => {
    if (phase !== 'retro') return;

    try {
      const skipGlitch = localStorage.getItem('narmir_skip_glitch') === '1';
      if (skipGlitch) {
        try { sessionStorage.setItem('narmir_intro_seen', '1'); } catch (e) {}
        setPhase('modern');
        return;
      }
    } catch (e) {}

    setPhase('glitch');

    const interval = setInterval(() => {
      setGlitch({
        title:   corruptString('NARMIR'),
        tagline: corruptString('Land of Magic and Conquest'),
        nav0:    corruptString('Play Narmir'),
        nav1:    corruptString('Forums'),
        nav2:    corruptString('Rankings'),
        heading: corruptString('Welcome to Narmir'),
        java:    corruptString('Java Requirement'),
      });
    }, 75);
    timers.current.push(interval);

    // Tear slices appear at 1.4s
    timers.current.push(setTimeout(() => setTearing(true), 1400));

    // White flash at 2.1s
    timers.current.push(setTimeout(() => setShowFlash(true), 2100));

    // Switch to modern at 2.5s, fade flash out shortly after
    timers.current.push(setTimeout(() => {
      clearInterval(interval);
      try { sessionStorage.setItem('narmir_intro_seen', '1'); } catch (e) {}
      setPhase('modern');
      setTearing(false);
      setGlitch({});
    }, 2500));

    timers.current.push(setTimeout(() => setShowFlash(false), 2700));
  }, [phase]);

  return (
    <div className={`splash-root phase-${phase}${fading ? ' fading' : ''}`}>
      {/* Phase 1 + 2: Retro site */}
      {(phase === 'retro' || phase === 'glitch') && (
        <div
          className={`retro-wrapper${phase === 'glitch' ? ' glitching' : ''}`}
          onClick={triggerGlitch}
        >
          <div className="scanlines" aria-hidden="true" />
          <RetroSite glitch={glitch} />
        </div>
      )}

      {/* Tear slices — outside retro-wrapper so they aren't affected by
          the glitchShake transform (which would break position:fixed containment) */}
      {phase === 'glitch' && TEAR_GRADIENTS.map((bg, i) => (
        <div
          key={i}
          className={`tear-slice${tearing ? ' tearing' : ''}`}
          data-dir={i % 2 === 0 ? 'l' : 'r'}
          style={{
            top: `${i * 12.5}vh`,
            height: '12.5vh',
            background: bg,
            animationDelay: `${i * 28}ms`,
          }}
        />
      ))}

      {/* Phase 3: Modern splash */}
      {phase === 'modern' && <ModernSplash authStatus={authStatus} onEnter={() => setFading(true)} fading={fading} />}

      {/* Flash overlay lives outside phases so it persists through transition */}
      <div className={`flash-overlay${showFlash ? ' active' : ''}`} aria-hidden="true" />
    </div>
  );
}
