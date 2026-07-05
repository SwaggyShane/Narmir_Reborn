import React, { useEffect, useLayoutEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import clsx from 'clsx';
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

function AnimatedValue({ value, active, delay = 0, impact = false }) {
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

    if (impact) {
      gsap.fromTo(
        node,
        { scale: 0.84, rotate: -2 },
        {
          scale: 1,
          rotate: 0,
          duration: 0.34,
          delay: delay + 0.06,
          ease: 'back.out(2.2)',
        },
      );
    }

    return () => {
      tweenRef.current?.kill();
      tweenRef.current = null;
    };
  }, [active, delay, parsed, value]);

  return <span ref={nodeRef}>{value}</span>;
}

function SummaryCard({ label, value, tone = 'var(--text)', delay = 0, emphasis = false, impact = false }) {
  const cardRef = useRef(null);
  const valueRef = useRef(null);

  useLayoutEffect(() => {
    const node = cardRef.current;
    if (!node) return undefined;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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
    if (emphasis && !prefersReducedMotion) {
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
    } else {
      gsap.set(node, { scale: 1 });
    }

    if (impact && !prefersReducedMotion && valueRef.current) {
      gsap.fromTo(
        valueRef.current,
        { scale: 0.82, y: 4 },
        {
          scale: 1,
          y: 0,
          duration: 0.34,
          delay: delay + 0.08,
          ease: 'back.out(2.4)',
        },
      );
    }

    return () => {
      gsap.killTweensOf(node);
      if (valueRef.current) {
        gsap.killTweensOf(valueRef.current);
      }
    };
  }, [delay, emphasis, impact]);

  return (
    <div
      ref={cardRef}
      className={clsx(
        'rounded-lg px-2.5 py-2',
        impact
          ? 'border-l-4 bg-[linear-gradient(180deg,rgba(34,12,12,0.95)_0%,rgba(20,10,10,0.98)_100%)] shadow-[0_0_0_1px_rgba(255,255,255,0.03)_inset]'
          : 'border-l-[3px] bg-[var(--bg3)]',
      )}
      style={{ borderLeftColor: tone }}
    >
      <div className="mb-0.5 text-[11px] text-[var(--text3)]">{label}</div>
      <div ref={valueRef} className="origin-center text-[15px] font-bold" style={{ color: tone }}>
        <AnimatedValue value={value} active delay={delay + 0.05} impact={impact} />
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
  const powerBarWrapRef = useRef(null);
  const attackBarRef = useRef(null);
  const defenseBarRef = useRef(null);
  const wallWrapRef = useRef(null);
  const wallBarWrapRef = useRef(null);
  const wallBarRef = useRef(null);
  const rowsWrapRef = useRef(null);
  const outcomeRef = useRef(null);
  const buttonRef = useRef(null);
  const rowRefs = useRef([]);

  const hasData = Boolean(data);
  const { win, type, target, atkPower = 0, defPower = 0, rows = [], spellOutcome } = data ?? {};

  const outcomeText = win ? ' Victory! Land captured and enemies routed.' : ' Attack repelled. Regroup and try again.';
  const outcomeClass = win
    ? 'border border-[rgba(74,222,128,0.42)] bg-[linear-gradient(180deg,rgba(18,54,31,0.98)_0%,rgba(10,18,13,0.98)_100%)] shadow-[0_0_0_1px_rgba(74,222,128,0.18),0_10px_28px_rgba(0,0,0,0.35)] text-[var(--green)]'
    : 'border border-[rgba(248,113,113,0.42)] bg-[linear-gradient(180deg,rgba(58,17,17,0.98)_0%,rgba(22,11,11,0.98)_100%)] shadow-[0_0_0_1px_rgba(248,113,113,0.18),0_10px_28px_rgba(0,0,0,0.35)] text-[var(--red)]';
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
        powerBarWrapRef.current,
        wallWrapRef.current,
        wallBarWrapRef.current,
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
      if (powerBarWrapRef.current) gsap.set(powerBarWrapRef.current, { scaleY: 0.92 });
      if (wallBarWrapRef.current) gsap.set(wallBarWrapRef.current, { scaleY: 0.92 });
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
        if (powerBarWrapRef.current) gsap.set(powerBarWrapRef.current, { scaleY: 1 });
        if (wallBarWrapRef.current) gsap.set(wallBarWrapRef.current, { scaleY: 1 });
        return;
      }

      const tl = gsap.timeline({ defaults: { ease: 'power2.out' } });

      tl.to(modal, { autoAlpha: 1, duration: 0.16 })
        .to(panel, { autoAlpha: 1, y: 0, scale: 1, duration: 0.26 }, 0)
        .to(titleRef.current, { autoAlpha: 1, y: 0, duration: 0.18 }, 0.05)
        .to(subtitleRef.current, { autoAlpha: 1, y: 0, duration: 0.18 }, 0.1);

      if (hasPowerBars) {
        tl.to(powerWrapRef.current, { autoAlpha: 1, y: 0, duration: 0.18 }, 0.13);
        tl.to(powerBarWrapRef.current, { scaleY: 1, duration: 0.2, ease: 'back.out(2)' }, 0.14);
        if (attackBarRef.current) {
          tl.to(attackBarRef.current, { width: `${atkPct}%`, duration: 0.45, ease: 'power3.out' }, 0.16);
        }
        if (defenseBarRef.current) {
          tl.to(defenseBarRef.current, { width: `${defPct}%`, duration: 0.45, ease: 'power3.out' }, 0.16);
        }
        if (powerBarWrapRef.current) {
          tl.fromTo(
            powerBarWrapRef.current,
            { boxShadow: '0 0 0 0 rgba(255,255,255,0)' },
            {
              boxShadow: '0 0 18px rgba(255,255,255,0.18)',
              duration: 0.18,
              yoyo: true,
              repeat: 1,
              ease: 'power1.out',
            },
            0.22,
          );
        }
      }

      if (showWallState) {
        tl.to(wallWrapRef.current, { autoAlpha: 1, y: 0, duration: 0.18 }, 0.17);
        tl.to(wallBarWrapRef.current, { scaleY: 1, duration: 0.2, ease: 'back.out(2)' }, 0.18);
        if (wallBarRef.current) {
          tl.to(wallBarRef.current, { width: `${wallPct}%`, duration: 0.5, ease: 'power3.out' }, 0.2);
          tl.fromTo(
            wallBarRef.current,
            { filter: 'brightness(1.25)' },
            {
              filter: 'brightness(1)',
              duration: 0.24,
              ease: 'power2.out',
            },
            0.22,
          );
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
      className="fixed inset-0 z-[var(--z-backdrop)] flex items-center justify-center bg-black/70"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        className="relative max-h-[90vh] w-[90%] max-w-[480px] overflow-y-auto rounded-[var(--radius-lg)] border-2 border-[var(--accent1)] bg-[var(--bg2)] px-8 py-7 shadow-[0_24px_70px_rgba(0,0,0,0.55)]"
      >
        <div
          className="absolute right-3 top-3 cursor-pointer p-1 text-[18px] leading-none text-[var(--text3)]"
          onClick={onClose}
          title="Close"
        >
          x
        </div>

        <div
          ref={titleRef}
          className={clsx('mb-1 text-base font-bold', win ? 'text-[var(--green)]' : 'text-[var(--red)]')}
        >
          {win ? ' Victory' : ' Repelled'}
        </div>

        <div ref={subtitleRef} className="mb-4 text-[13px] text-[var(--text2)]">
          {type}&nbsp;&nbsp;<strong className="text-[var(--text)]">{target}</strong>
        </div>

        {hasPowerBars && (
          <div ref={powerWrapRef} className="mb-4">
            <div className="mb-1 flex justify-between text-[11px] text-[var(--text3)]">
              <span>
                Your power: <strong className="text-[var(--green)]">{fmt(atkPower)}</strong>
              </span>
              <span>
                Enemy power: <strong className="text-[var(--red)]">{fmt(defPower)}</strong>
              </span>
            </div>
            <div ref={powerBarWrapRef} className="flex h-2 origin-center overflow-hidden rounded bg-[var(--bg4)]">
              <div ref={attackBarRef} className="bg-[var(--green)]" style={{ width: `${atkPct}%` }} />
              <div ref={defenseBarRef} className="bg-[var(--red)]" style={{ width: `${defPct}%` }} />
            </div>
          </div>
        )}

        {showWallState && (
          <div ref={wallWrapRef} className="mb-4">
            <div className="mb-1 flex justify-between text-[11px] text-[var(--text3)]">
              <span>
                Wall HP: <strong className="text-[var(--amber)]">{fmt(wallHpBefore)}</strong>
              </span>
              <span>
                Damage: <strong className="text-[var(--red)]">-{fmt(wallDamage)}</strong>
              </span>
            </div>
            <div ref={wallBarWrapRef} className="flex h-2 origin-center overflow-hidden rounded bg-[var(--bg4)]">
              <div ref={wallBarRef} className="bg-[var(--amber)]" style={{ width: `${wallPct}%` }} />
            </div>
            <div className="mt-1 text-[11px] text-[var(--text3)]">
              After battle: <strong className="text-[var(--text)]">{fmt(wallHpAfter)}</strong>
            </div>
          </div>
        )}

        {showSummary && (
          <div className="mb-3.5 grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-2">
            <div data-summary-card="true">
              <SummaryCard label="Casualties" value={casualties} tone="var(--red)" delay={0} emphasis impact />
            </div>
            <div data-summary-card="true">
              <SummaryCard label="Critical Hits" value={criticalHits} tone="var(--amber)" delay={0.04} emphasis impact />
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

        <div ref={rowsWrapRef} className="mb-3.5 grid grid-cols-2 gap-2">
          {rows.map(([label, value], i) => {
            const sval = String(value);
            let valColorClass = 'text-[var(--text)]';
            if (sval.startsWith('+')) valColorClass = 'text-[var(--green)]';
            else if (sval.startsWith('-') || (label.toLowerCase().includes('lost') && parseInt(value, 10) > 0)) valColorClass = 'text-[var(--red)]';

            return (
              <div
                key={`${label}-${i}`}
                ref={(el) => {
                  rowRefs.current[i] = el;
                }}
                className="rounded-lg bg-[var(--bg3)] px-2.5 py-2"
              >
                <div className="mb-0.5 text-[11px] text-[var(--text3)]">{label}</div>
                <div className={clsx('text-sm font-semibold', valColorClass)}>
                  <AnimatedValue value={value} active />
                </div>
              </div>
            );
          })}
        </div>

        <div ref={outcomeRef} className={clsx('rounded-lg p-2.5 text-center font-semibold', outcomeClass)}>
          {outcomeText}
        </div>

        <button ref={buttonRef} className="btn mt-[18px] w-full" onClick={onClose}>
          Dismiss report
        </button>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modal, document.body);
}
