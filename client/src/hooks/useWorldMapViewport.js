import { useCallback, useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { prefersReducedMotion } from '../utils/worldMapGsap.js';

const MIN_SCALE = 1;
const MAX_SCALE = 3;
const ZOOM_STEP = 0.25;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getContentSize(stageEl) {
  const svg = stageEl?.querySelector('svg');
  if (!svg) return { width: 0, height: 0 };
  const rect = svg.getBoundingClientRect();
  return { width: rect.width, height: rect.height };
}

function clampPan(x, y, scale, viewportEl, stageEl) {
  if (!viewportEl || !stageEl) return { x, y };
  const { width: vw, height: vh } = viewportEl.getBoundingClientRect();
  const { width: cw, height: ch } = getContentSize(stageEl);
  const scaledW = cw * scale;
  const scaledH = ch * scale;

  if (scaledW <= vw && scaledH <= vh) {
    return { x: 0, y: 0 };
  }

  return {
    x: clamp(x, Math.min(0, vw - scaledW), 0),
    y: clamp(y, Math.min(0, vh - scaledH), 0),
  };
}

function zoomAroundPoint(state, viewportEl, pointX, pointY, nextScale) {
  const scale = clamp(nextScale, MIN_SCALE, MAX_SCALE);
  if (scale === state.scale) return state;

  const contentX = (pointX - state.x) / state.scale;
  const contentY = (pointY - state.y) / state.scale;
  const x = pointX - contentX * scale;
  const y = pointY - contentY * scale;
  return { scale, x, y };
}

function applyStageTransform(stageEl, { x, y, scale }, animate = false) {
  if (!stageEl) return;
  if (animate && !prefersReducedMotion()) {
    gsap.to(stageEl, {
      x,
      y,
      scale,
      duration: 0.28,
      ease: 'power2.out',
      overwrite: 'auto',
    });
    return;
  }
  gsap.set(stageEl, { x, y, scale });
}

export function useWorldMapViewport({ resetKey = '', enabled = true } = {}) {
  const viewportRef = useRef(null);
  const stageRef = useRef(null);
  const dragRef = useRef({ active: false, moved: false, startX: 0, startY: 0, originX: 0, originY: 0, pointerId: null });
  const stateRef = useRef({ x: 0, y: 0, scale: 1 });
  const [zoomLabel, setZoomLabel] = useState('100%');

  const syncLabel = useCallback((scale) => {
    setZoomLabel(`${Math.round(scale * 100)}%`);
  }, []);

  const setViewport = useCallback((next, { animate = false } = {}) => {
    const viewportEl = viewportRef.current;
    const stageEl = stageRef.current;
    if (!viewportEl || !stageEl) return;

    const clamped = {
      ...next,
      ...clampPan(next.x, next.y, next.scale, viewportEl, stageEl),
    };
    stateRef.current = clamped;
    applyStageTransform(stageEl, clamped, animate);
    syncLabel(clamped.scale);
  }, [syncLabel]);

  const resetViewport = useCallback((animate = true) => {
    setViewport({ x: 0, y: 0, scale: 1 }, { animate });
  }, [setViewport]);

  const zoomBy = useCallback((delta, animate = true) => {
    const viewportEl = viewportRef.current;
    if (!viewportEl) return;
    const rect = viewportEl.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const next = zoomAroundPoint(
      stateRef.current,
      viewportEl,
      centerX,
      centerY,
      stateRef.current.scale + delta,
    );
    setViewport(next, { animate });
  }, [setViewport]);

  useEffect(() => {
    resetViewport(false);
  }, [resetKey, resetViewport]);

  useEffect(() => {
    if (!enabled) return undefined;

    const viewportEl = viewportRef.current;
    const stageEl = stageRef.current;
    if (!viewportEl || !stageEl) return undefined;

    gsap.set(stageEl, { x: 0, y: 0, scale: 1, transformOrigin: '0 0' });

    const onWheel = (event) => {
      event.preventDefault();
      const rect = viewportEl.getBoundingClientRect();
      const pointX = event.clientX - rect.left;
      const pointY = event.clientY - rect.top;
      const delta = -event.deltaY * 0.0015;
      const nextScale = stateRef.current.scale * (1 + delta);
      const next = zoomAroundPoint(stateRef.current, viewportEl, pointX, pointY, nextScale);
      setViewport(next, { animate: false });
    };

    const onPointerDown = (event) => {
      if (event.button !== 0) return;
      const target = event.target;
      if (target.closest('button')) return;

      dragRef.current = {
        active: true,
        moved: false,
        startX: event.clientX,
        startY: event.clientY,
        originX: stateRef.current.x,
        originY: stateRef.current.y,
        pointerId: event.pointerId,
      };
      viewportEl.setPointerCapture(event.pointerId);
      viewportEl.style.cursor = 'grabbing';
    };

    const onPointerMove = (event) => {
      if (!dragRef.current.active || dragRef.current.pointerId !== event.pointerId) return;
      const dx = event.clientX - dragRef.current.startX;
      const dy = event.clientY - dragRef.current.startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        dragRef.current.moved = true;
      }
      setViewport({
        x: dragRef.current.originX + dx,
        y: dragRef.current.originY + dy,
        scale: stateRef.current.scale,
      }, { animate: false });
    };

    const endDrag = (event) => {
      if (!dragRef.current.active || dragRef.current.pointerId !== event.pointerId) return;
      dragRef.current.active = false;
      viewportEl.releasePointerCapture(event.pointerId);
      viewportEl.style.cursor = 'grab';
    };

    viewportEl.addEventListener('wheel', onWheel, { passive: false });
    viewportEl.addEventListener('pointerdown', onPointerDown);
    viewportEl.addEventListener('pointermove', onPointerMove);
    viewportEl.addEventListener('pointerup', endDrag);
    viewportEl.addEventListener('pointercancel', endDrag);

    return () => {
      viewportEl.removeEventListener('wheel', onWheel);
      viewportEl.removeEventListener('pointerdown', onPointerDown);
      viewportEl.removeEventListener('pointermove', onPointerMove);
      viewportEl.removeEventListener('pointerup', endDrag);
      viewportEl.removeEventListener('pointercancel', endDrag);
    };
  }, [enabled, setViewport]);

  const shouldSuppressClick = useCallback(() => {
    if (!dragRef.current.moved) return false;
    dragRef.current.moved = false;
    return true;
  }, []);

  return {
    viewportRef,
    stageRef,
    zoomLabel,
    resetViewport,
    zoomIn: () => zoomBy(ZOOM_STEP),
    zoomOut: () => zoomBy(-ZOOM_STEP),
    shouldSuppressClick,
  };
}