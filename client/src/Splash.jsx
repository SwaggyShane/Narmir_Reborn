import React, { useState, useEffect, useRef, useCallback } from 'react';

// ─── Constants ────────────────────────────────────────────────────────────────

const RACES = [
  { id: 'human',     name: 'Human',     emoji: '⚔️', lore: 'Versatile builders and diplomats' },
  { id: 'orc',       name: 'Orc',       emoji: '🪓', lore: 'Fearsome warriors bred for conquest' },
  { id: 'dwarf',     name: 'Dwarf',     emoji: '⛏️', lore: 'Master craftsmen of mountain holds' },
  { id: 'dark_elf',  name: 'Dark Elf',  emoji: '🌙', lore: 'Shadows and sorcery, unseen and deadly' },
  { id: 'vampire',   name: 'Vampire',   emoji: '🦇', lore: 'Undying lords of blood and night' },
  { id: 'dire_wolf', name: 'Dire Wolf', emoji: '🐺', lore: 'Pack hunters, swift and relentless' },
  { id: 'wood_elf',  name: 'Wood Elf',  emoji: '🌲', lore: 'Master explorers of uncharted wilderness' },
  { id: 'ogre',      name: 'Ogre',      emoji: '🗡️', lore: 'Unmatched warriors of brute strength' },
];

const FEATURES = [
  { id: 'building',  icon: '🏰', title: 'Kingdom Building',    desc: 'Construct farms, barracks, walls and more. Every building shapes your strategy and expands your power.' },
  { id: 'military',  icon: '⚔️', title: 'Military Conquest',   desc: 'Command armies, siege enemy lands, and dominate through war — or cunning raids in the dead of night.' },
  { id: 'magic',     icon: '🔮', title: 'Magic & Alchemy',     desc: 'Study arcane arts, attune ancient fragments, and unleash devastating spells upon your enemies.' },
  { id: 'economy',   icon: '💰', title: 'Trade & Economy',     desc: 'Master the markets, hire mercenaries, and build wealth through shrewd commerce and resource mastery.' },
  { id: 'alliance',  icon: '🛡️', title: 'Alliance Warfare',   desc: 'Join forces with allies, coordinate strategies, share buffs, and claim collective glory.' },
  { id: 'prestige',  icon: '👑', title: 'Prestige System',     desc: 'Rebirth your kingdom, carrying hard-won wisdom forward into a more powerful incarnation.' },
];

// Mirrors narmir.com/varuh/left.html — image nav on textured sidebar
const RETRO_NAV = [
  { src: '/retro/play.jpg', alt: 'Play Narmir or Create an Account' },
  { src: '/retro/forums.jpg', alt: 'Narmir Forums' },
  { src: '/retro/rankings.jpg', alt: 'Rankings' },
  { src: '/retro/worlds.jpg', alt: 'Worlds' },
  { src: '/retro/help.jpg', alt: 'Narmir Help' },
  { src: '/retro/players.jpg', alt: 'Hosted Sites' },
  { src: '/retro/links.jpg', alt: 'Narmir Links' },
  { src: '/retro/wq.jpg', alt: 'Windows Quest' },
  { src: '/retro/contact.jpg', alt: 'Contact Us' },
  { src: '/retro/tradewars.gif', alt: 'Play Tradewars' },
];

// Mobile faux-button labels — one per file in public/retro/, same order as
// RETRO_NAV. First entry (Play Narmir) is the highlighted/active button.
const MOBILE_NAV_LABELS = [
  'Play Narmir',
  'Forums',
  'Rankings',
  'Worlds',
  'Help',
  'Hosted Sites',
  'Links',
  'Windows Quest',
  'Contact Us',
  'Play Tradewars',
];

// Horizontal tear bands — black frameset + gray content (varuh layout)
const TEAR_GRADIENTS = [
  'linear-gradient(to right, #000000 100%)',
  'linear-gradient(to right, #000000 140px, #1a1a1a 140px)',
  'linear-gradient(to right, #000000 140px, #c0c0c0 140px)',
  'linear-gradient(to right, #000000 100%)',
  'linear-gradient(to right, #000000 140px, #c0c0c0 140px)',
  'linear-gradient(to right, #000000 140px, #1a1a1a 140px)',
  'linear-gradient(to right, #000000 140px, #c0c0c0 140px)',
  'linear-gradient(to right, #000000 100%)',
];

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
      <p className="auth-sub">Rankings | Login | Forums</p>
    </div>
  );
}

function RetroSite() {
  const blockNav = (e) => e.preventDefault();

  return (
    <div className="retro-frameset">
      <aside className="retro-col retro-col-left" aria-label="Site navigation">
        <div className="retro-nav-spacer" aria-hidden="true" />
        <nav className="retro-nav">
          {RETRO_NAV.map((item, i) => (
            <a
              key={item.src}
              href="#"
              className={i === 0 ? 'retro-nav-first' : undefined}
              onClick={blockNav}
            >
              <img src={item.src} width={120} height={18} alt={item.alt} />
            </a>
          ))}
        </nav>
      </aside>

      <div className="retro-center">
        <header className="retro-top">
          <img
            src="/retro/bg-top.png"
            alt="Narmir, Land of Magic and Conquest"
            className="retro-top-banner"
          />
        </header>
        <main className="retro-content" style={{
          backgroundImage: 'url(/retro/752296106_1723312728940886_1659173184335563790_n.jpg)',
        }}>
          <div className="retro-applet-wrap">
            <button
              type="button"
              className="retro-play-button"
            >
              Play Narmir
            </button>
            <hr className="retro-hr" />
          </div>
        </main>
      </div>

      <aside className="retro-col retro-col-right" aria-hidden="true" />
    </div>
  );
}

// Mobile retro splash — built from scratch, not the desktop frameset shrunk
// down. Black page, header at top, dragon artwork below it, then the
// desktop sidebar's thin repeating blue-line texture (matching
// bg-left.gif/bg-right.gif) as a plain background — not discrete button
// elements. Faux buttons get placed on top of this next.
function MobileRetroSite() {
  return (
    <div className="mobile-retro">
      <img
        src="/retro/bg-top.png"
        alt="Narmir, Land of Magic and Conquest"
        className="mobile-retro-banner"
      />
      <div className="mobile-retro-dragon-wrap">
        <img
          src="/retro/752296106_1723312728940886_1659173184335563790_n.jpg"
          alt=""
          className="mobile-retro-dragon"
        />
        <button type="button" className="mobile-retro-play-applet">Play Narmir</button>
      </div>
      <div className="mobile-retro-nav" aria-label="Retro navigation">
        {MOBILE_NAV_LABELS.map((label, i) => (
          <button
            key={label}
            type="button"
            className={`mobile-retro-btn${i === 0 ? ' mobile-retro-btn-active' : ''}`}
          >
            {label}
          </button>
        ))}
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
        <span className="footer-sep">|</span>
        <a href="/portal" className="footer-link">Enter</a>
      </footer>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Splash() {
  const [phase, setPhase] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('replay') === '1' || params.get('intro') === '1') {
        sessionStorage.removeItem('narmir_intro_seen');
        return 'retro';
      }
      return (sessionStorage.getItem('narmir_intro_seen') || localStorage.getItem('narmir_skip_intro'))
        ? 'modern' : 'retro';
    } catch (e) {
      return 'retro';
    }
  }); // 'retro' | 'glitch' | 'modern'
  const [tearing, setTearing] = useState(false);
  const [showFlash, setShowFlash] = useState(false);
  const [authStatus, setAuthStatus] = useState('loading');
  const [fading, setFading] = useState(false);
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth <= 767 : false
  );
  const timers = useRef([]);

  // Mobile gets its own from-scratch retro splash (MobileRetroSite), not the
  // desktop 3-column frameset squeezed down with CSS — that's what was
  // "all messed up" before. Track viewport width directly so resizing/
  // rotating actually switches between them live.
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 767);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

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

    // CSS-only glitch (.glitching) — no React re-renders during sequence
    timers.current.push(setTimeout(() => setTearing(true), 1400));
    timers.current.push(setTimeout(() => setShowFlash(true), 2100));
    timers.current.push(setTimeout(() => {
      try { sessionStorage.setItem('narmir_intro_seen', '1'); } catch (e) {}
      setPhase('modern');
      setTearing(false);
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
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              triggerGlitch();
            }
          }}
          role="button"
          tabIndex={0}
          aria-label="Original Narmir site — click or press Enter to reveal Narmir Reborn"
        >
          <div className="scanlines" aria-hidden="true" />
          {isMobile ? <MobileRetroSite /> : <RetroSite />}
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
