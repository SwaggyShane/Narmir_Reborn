import React, { useEffect, useLayoutEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import gsap from 'gsap';
import { fmt } from '../../utils/fmt.js';

function parseDisplayNumber(value) {
  const text = String(value ?? '').trim();
  const match = text.match(/^([+-]?)([\d,]+)(.*)$/);
  if (!match) return null;

  const sign = match[1] || '';
  const digits = match[2].replace(/,/g, '');
  const suffix = match[3] || '';
  const numeric = Number(digits);

  if (!Number.isFinite(numeric)) return null;

  return { sign, numeric, suffix };
}

function AnimatedValue({ value, active, delay = 0 }) {
  const nodeRef = useRef(null);
  const tweenRef = useRef(null);
  const parsed = parseDisplayNumber(value);

  useLayoutEffect(() => {
    const node = nodeRef.current;
    if (!node) return undefined;

    tweenRef.current?.kill();

    if (!active || !parsed) {
      node.textContent = String(value);
      return undefined;
    }

    const state = { value: 0 };
    node.textContent = `${parsed.sign}0${parsed.suffix}`;

    tweenRef.current = gsap.fromTo(
      state,
      { value: 0 },
      {
        value: parsed.numeric,
        delay,
        duration: 0.6,
        ease: 'power3.out',
        onUpdate: () => {
          node.textContent = `${parsed.sign}${Math.round(state.value).toLocaleString()}${parsed.suffix}`;
        },
        onComplete: () => {
          node.textContent = String(value);
        },
      },
    );

    return () => {
      tweenRef.current?.kill();
      tweenRef.current = null;
    };
  }, [active, delay, parsed, value]);

  return <span ref={nodeRef}>{value}</span>;
}

function SummaryCard({ label, value, tone = 'var(--text)', delay = 0, emphasis = false }) {
  const cardRef = useRef(null);

  useLayoutEffect(() => {
    const node = cardRef.current;
    if (!node) return undefined;

    gsap.killTweensOf(node);
    gsap.fromTo(
      node,
      { autoAlpha: 0, y: 10 },
      {
        autoAlpha: 1,
        y: 0,
        duration: 0.22,
        delay,
        ease: 'power2.out',
      },
    );
    if (emphasis) {
      gsap.fromTo(
        node,
        { scale: 0.95 },
        {
          scale: 1,
          duration: 0.28,
          delay: delay + 0.02,
          ease: 'back.out(1.8)',
        },
      );
    }

    return () => {
      gsap.killTweensOf(node);
    };
  }, [delay, emphasis]);

  return (
    <div
      ref={cardRef}
      style={{
        background: 'var(--bg3)',
        borderRadius: 8,
        padding: '8px 10px',
        borderLeft: `3px solid ${tone}`,
      }}
    >
      <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: tone }}>
        <AnimatedValue value={value} active delay={delay + 0.05} />
      </div>
    </div>
  );
}

export default function BattleReportModal({ data, onClose }) {
  const modalRef = useRef(null);
  const panelRef = useRef(null);
  const titleRef = useRef(null);
  const subtitleRef = useRef(null);
  const powerWrapRef = useRef(null);
  const attackBarRef = useRef(null);
  const defenseBarRef = useRef(null);
  const wallWrapRef = useRef(null);
  const wallBarRef = useRef(null);
  const rowsWrapRef = useRef(null);
  const outcomeRef = useRef(null);
  const buttonRef = useRef(null);
  const rowRefs = useRef([]);

  const hasData = Boolean(data);
  const { win, type, target, atkPower = 0, defPower = 0, rows = [], spellOutcome } = data ?? {};

  const titleColor = win ? 'var(--green)' : 'var(--red)';
  const outcomeText = win ? ' Victory! Land captured and enemies routed.' : ' Attack repelled. Regroup and try again.';
  const outcomeStyle = {
    border: `1px solid ${win ? 'rgba(74, 222, 128, 0.42)' : 'rgba(248, 113, 113, 0.42)'}`,
    background: win
      ? 'linear-gradient(180deg, rgba(18, 54, 31, 0.98) 0%, rgba(10, 18, 13, 0.98) 100%)'
      : 'linear-gradient(180deg, rgba(58, 17, 17, 0.98) 0%, rgba(22, 11, 11, 0.98) 100%)',
    boxShadow: win
      ? '0 0 0 1px rgba(74, 222, 128, 0.18), 0 10px 28px rgba(0, 0, 0, 0.35)'
      : '0 0 0 1px rgba(248, 113, 113, 0.18), 0 10px 28px rgba(0, 0, 0, 0.35)',
    color: win ? 'var(--green)' : 'var(--red)',
  };
  const total = atkPower + defPower || 1;
  const atkPct = Math.round((atkPower / total) * 100);
  const defPct = 100 - atkPct;
  const hasPowerBars = !spellOutcome;
  const casualties = data?.summary?.casualties || 0;
  const criticalHits = data?.summary?.criticalHits || 0;
  const criticalKills = data?.summary?.criticalKills || 0;
  const landTransferred = data?.summary?.landTransferred || 0;
  const wallHpBefore = data?.summary?.wallHpBefore ?? 0;
  const wallHpAfter = data?.summary?.wallHpAfter ?? 0;
  const wallDamage = data?.summary?.wallDamage || 0;
  const showSummary = casualties > 0 || criticalHits > 0 || criticalKills > 0 || landTransferred > 0;
  const showWallState = wallHpBefore > 0 || wallHpAfter > 0 || wallDamage > 0;
  const wallPct = wallHpBefore > 0 ? Math.max(0, Math.min(100, Math.round((wallHpAfter / wallHpBefore) * 100))) : 0;

  useEffect(() => {
    rowRefs.current = rowRefs.current.slice(0, rows.length);
  }, [rows.length]);

  useLayoutEffect(() => {
    const modal = modalRef.current;
    const panel = panelRef.current;
    if (!hasData || !modal || !panel) return undefined;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const ctx = gsap.context(() => {
      const introTargets = [
        titleRef.current,
        subtitleRef.current,
        powerWrapRef.current,
        wallWrapRef.current,
        rowsWrapRef.current,
        outcomeRef.current,
        buttonRef.current,
      ].filter(Boolean);

      gsap.set(modal, { autoAlpha: 0 });
      gsap.set(panel, { y: 18, scale: 0.985, autoAlpha: 0 });
      gsap.set(introTargets, {
        autoAlpha: 0,
        y: 10,
      });
      gsap.set(rowRefs.current, { autoAlpha: 0, y: 12 });
      if (attackBarRef.current) gsap.set(attackBarRef.current, { width: '0%' });
      if (defenseBarRef.current) gsap.set(defenseBarRef.current, { width: '0%' });
      if (wallBarRef.current) gsap.set(wallBarRef.current, { width: '0%' });
      if (outcomeRef.current && !prefersReducedMotion) {
        gsap.set(outcomeRef.current, { autoAlpha: 0, y: 14, scale: 0.92, rotateX: 12 });
      }

      if (prefersReducedMotion) {
        gsap.set(modal, { autoAlpha: 1 });
        gsap.set(panel, { y: 0, scale: 1, autoAlpha: 1 });
        gsap.set(introTargets, {
          autoAlpha: 1,
          y: 0,
        });
        gsap.set(rowRefs.current, { autoAlpha: 1, y: 0 });
        if (attackBarRef.current) gsap.set(attackBarRef.current, { width: `${atkPct}%` });
        if (defenseBarRef.current) gsap.set(defenseBarRef.current, { width: `${defPct}%` });
        if (wallBarRef.current && showWallState) gsap.set(wallBarRef.current, { width: `${wallPct}%` });
        return;
      }

      const tl = gsap.timeline({ defaults: { ease: 'power2.out' } });

      tl.to(modal, { autoAlpha: 1, duration: 0.16 })
        .to(panel, { autoAlpha: 1, y: 0, scale: 1, duration: 0.26 }, 0)
        .to(titleRef.current, { autoAlpha: 1, y: 0, duration: 0.18 }, 0.05)
        .to(subtitleRef.current, { autoAlpha: 1, y: 0, duration: 0.18 }, 0.1);

      if (hasPowerBars) {
        tl.to(powerWrapRef.current, { autoAlpha: 1, y: 0, duration: 0.18 }, 0.13);
        if (attackBarRef.current) {
          tl.to(attackBarRef.current, { width: `${atkPct}%`, duration: 0.45, ease: 'power3.out' }, 0.16);
        }
        if (defenseBarRef.current) {
          tl.to(defenseBarRef.current, { width: `${defPct}%`, duration: 0.45, ease: 'power3.out' }, 0.16);
        }
      }

      if (showWallState) {
        tl.to(wallWrapRef.current, { autoAlpha: 1, y: 0, duration: 0.18 }, 0.17);
        if (wallBarRef.current) {
          tl.to(wallBarRef.current, { width: `${wallPct}%`, duration: 0.5, ease: 'power3.out' }, 0.2);
        }
      }

      if (showSummary) {
        const summaryNodes = modal.querySelectorAll?.('[data-summary-card="true"]') || [];
        if (summaryNodes.length > 0) {
          tl.fromTo(
            summaryNodes,
            { autoAlpha: 0, y: 10 },
            {
              autoAlpha: 1,
              y: 0,
              duration: 0.22,
              stagger: 0.06,
              ease: 'power2.out',
            },
            0.18,
          );
        }
      }

      if (rowsWrapRef.current) {
        tl.to(rowsWrapRef.current, { autoAlpha: 1, y: 0, duration: 0.18 }, 0.2);
      }

      if (rowRefs.current.length > 0) {
        tl.to(
          rowRefs.current,
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.22,
            stagger: 0.06,
            ease: 'power2.out',
          },
          0.24,
        );
      }

      tl.to(outcomeRef.current, { autoAlpha: 1, y: 0, scale: 1, rotateX: 0, duration: 0.34, ease: 'back.out(1.9)' }, 0.38)
        .to(
          outcomeRef.current,
          win
            ? { scale: 1.03, boxShadow: '0 0 0 1px rgba(74, 222, 128, 0.3), 0 0 26px rgba(74, 222, 128, 0.14), 0 10px 28px rgba(0, 0, 0, 0.35)', duration: 0.14, ease: 'power1.out', yoyo: true, repeat: 1 }
            : { x: -4, duration: 0.06, ease: 'power1.inOut', repeat: 5, yoyo: true },
          0.72,
        )
        .to(buttonRef.current, { autoAlpha: 1, y: 0, duration: 0.2 }, 0.46);
    }, modal);

    return () => {
      ctx.revert();
    };
  }, [atkPct, defPct, casualties, criticalHits, criticalKills, hasData, hasPowerBars, rows.length, showSummary, showWallState, wallPct, win]);

  if (!hasData) return null;

  const modal = (
    <div
      ref={modalRef}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        zIndex: 'var(--z-backdrop)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        style={{
          background: 'var(--bg2)',
          border: '2px solid var(--accent1)',
          borderRadius: 'var(--radius-lg)',
          padding: '28px 32px',
          maxWidth: 480,
          width: '90%',
          maxHeight: '90vh',
          overflowY: 'auto',
          position: 'relative',
          boxShadow: '0 24px 70px rgba(0, 0, 0, 0.55)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            cursor: 'pointer',
            color: 'var(--text3)',
            fontSize: 18,
            lineHeight: 1,
            padding: 4,
          }}
          onClick={onClose}
          title="Close"
        >
          x
        </div>

        <div
          ref={titleRef}
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: titleColor,
            marginBottom: 4,
          }}
        >
          {win ? ' Victory' : ' Repelled'}
        </div>

        <div
          ref={subtitleRef}
          style={{
            fontSize: 13,
            color: 'var(--text2)',
            marginBottom: 16,
          }}
        >
          {type}&nbsp;&nbsp;<strong style={{ color: 'var(--text)' }}>{target}</strong>
        </div>

        {hasPowerBars && (
          <div ref={powerWrapRef} style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>
              <span>
                Your power: <strong style={{ color: 'var(--green)' }}>{fmt(atkPower)}</strong>
              </span>
              <span>
                Enemy power: <strong style={{ color: 'var(--red)' }}>{fmt(defPower)}</strong>
              </span>
            </div>
            <div style={{ height: 8, borderRadius: 4, overflow: 'hidden', background: 'var(--bg4)', display: 'flex' }}>
              <div ref={attackBarRef} style={{ width: `${atkPct}%`, background: 'var(--green)' }} />
              <div ref={defenseBarRef} style={{ width: `${defPct}%`, background: 'var(--red)' }} />
            </div>
          </div>
        )}

        {showWallState && (
          <div ref={wallWrapRef} style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>
              <span>
                Wall HP: <strong style={{ color: 'var(--amber)' }}>{fmt(wallHpBefore)}</strong>
              </span>
              <span>
                Damage: <strong style={{ color: 'var(--red)' }}>-{fmt(wallDamage)}</strong>
              </span>
            </div>
            <div style={{ height: 8, borderRadius: 4, overflow: 'hidden', background: 'var(--bg4)', display: 'flex' }}>
              <div ref={wallBarRef} style={{ width: `${wallPct}%`, background: 'var(--amber)' }} />
            </div>
            <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text3)' }}>
              After battle: <strong style={{ color: 'var(--text)' }}>{fmt(wallHpAfter)}</strong>
            </div>
          </div>
        )}

        {showSummary && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, marginBottom: 14 }}>
            <div data-summary-card="true">
              <SummaryCard label="Casualties" value={casualties} tone="var(--red)" delay={0} emphasis />
            </div>
            <div data-summary-card="true">
              <SummaryCard label="Critical Hits" value={criticalHits} tone="var(--amber)" delay={0.04} emphasis />
            </div>
            <div data-summary-card="true">
              <SummaryCard label="Killing Blows" value={criticalKills} tone="var(--green)" delay={0.08} />
            </div>
            {landTransferred > 0 && (
              <div data-summary-card="true">
                <SummaryCard label="Land Seized" value={`+${fmt(landTransferred)} acres`} tone="var(--accent1)" delay={0.12} />
              </div>
            )}
          </div>
        )}

        <div ref={rowsWrapRef} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
          {rows.map(([label, value], i) => {
            const sval = String(value);
            let valColor = 'var(--text)';
            if (sval.startsWith('+')) valColor = 'var(--green)';
            else if (sval.startsWith('-') || (label.toLowerCase().includes('lost') && parseInt(value, 10) > 0)) valColor = 'var(--red)';

            return (
              <div
                key={`${label}-${i}`}
                ref={(el) => {
                  rowRefs.current[i] = el;
                }}
                style={{
                  background: 'var(--bg3)',
                  borderRadius: 8,
                  padding: '8px 10px',
                }}
              >
                <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 2 }}>{label}</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: valColor }}>
                  <AnimatedValue value={value} active />
                </div>
              </div>
            );
          })}
        </div>

        <div
          ref={outcomeRef}
          style={{
            borderRadius: 8,
            padding: 10,
            textAlign: 'center',
            fontWeight: 600,
            ...outcomeStyle,
          }}
        >
          {outcomeText}
        </div>

        <button ref={buttonRef} className="btn" onClick={onClose} style={{ marginTop: 18, width: '100%' }}>
          Dismiss report
        </button>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modal, document.body);
}
