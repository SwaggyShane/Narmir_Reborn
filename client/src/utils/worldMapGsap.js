import gsap from 'gsap';

export function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function querySvg(container) {
  if (!container) return null;
  return container.querySelector('svg');
}

function setLayerVisible(layer, visible, { animate, duration = 0.32 }) {
  if (!layer) return;
  gsap.killTweensOf(layer);
  if (!animate) {
    gsap.set(layer, { autoAlpha: visible ? 1 : 0 });
    return;
  }
  gsap.to(layer, {
    autoAlpha: visible ? 1 : 0,
    duration,
    ease: 'power2.out',
    overwrite: 'auto',
  });
}

export function applyWorldMapLayers(container, layers, { animate = true } = {}) {
  const svg = querySvg(container);
  if (!svg) return;

  const mapping = {
    nodes: '.wm-layer-nodes',
    routes: '.wm-layer-routes',
    expeditions: '.wm-layer-expeditions',
    kingdoms: '.wm-layer-kingdoms',
    terrain: '.wm-layer-terrain',
  };

  Object.entries(mapping).forEach(([key, selector]) => {
    const visible = layers[key] !== false;
    setLayerVisible(svg.querySelector(selector), visible, { animate });
    if (key === 'nodes') {
      const nodeGroups = svg.querySelectorAll('.wm-node-group');
      gsap.killTweensOf(nodeGroups);
      if (!animate) {
        gsap.set(nodeGroups, { autoAlpha: visible ? 1 : 0, scale: 1 });
      } else {
        gsap.to(nodeGroups, {
          autoAlpha: visible ? 1 : 0,
          scale: 1,
          duration: 0.32,
          ease: 'power2.out',
          overwrite: 'auto',
        });
      }
    }
  });
}

function primeHidden(svg, selector) {
  const nodes = svg.querySelectorAll(selector);
  gsap.set(nodes, { autoAlpha: 0 });
  return nodes;
}

function lineDrawIn(lines, { delay = 0, stagger = 0.06 }) {
  lines.forEach((line) => {
    const length = typeof line.getTotalLength === 'function' ? line.getTotalLength() : 120;
    gsap.set(line, {
      strokeDasharray: length,
      strokeDashoffset: length,
      opacity: line.classList.contains('wm-expedition-line') ? 0.55 : 0.4,
    });
  });

  return gsap.to(lines, {
    strokeDashoffset: 0,
    duration: 0.85,
    delay,
    stagger,
    ease: 'power2.out',
  });
}

function startLineFlow(lines, { duration = 2.4, offset = 24 }) {
  if (!lines.length) return null;
  return gsap.to(lines, {
    strokeDashoffset: `-=${offset}`,
    duration,
    ease: 'none',
    repeat: -1,
  });
}

/**
 * Run entrance + ambient map motion. Returns a cleanup function.
 */
export function animateWorldMap(container, options = {}) {
  const {
    layers = {},
    selectedNodeId = null,
    entrance = true,
  } = options;

  const svg = querySvg(container);
  if (!svg) return () => {};

  const reduced = prefersReducedMotion();
  const ctx = gsap.context(() => {}, container);
  const cleanups = [];

  ctx.add(() => {
    const regions = primeHidden(svg, '.wm-region');
    const regionLabels = svg.querySelectorAll('.wm-region-label');
    gsap.set(regionLabels, { autoAlpha: 0, y: 8 });
    const nodeGroups = primeHidden(svg, '.wm-node-group');
    const kingdoms = primeHidden(svg, '.wm-kingdom');
    const kingdomLabels = primeHidden(svg, '.wm-kingdom-label');
    const expeditionLines = svg.querySelectorAll('.wm-expedition-line');
    const tradeLines = svg.querySelectorAll('.wm-trade-line');
    const terrainShapes = svg.querySelectorAll('.terrain-shape');
    const forestShapes = svg.querySelectorAll('.terrain-shape[data-terrain="forest"]');
    const mountainShapes = svg.querySelectorAll('.terrain-shape[data-terrain="mountains"]');

    if (!entrance) {
      applyWorldMapLayers(container, layers, { animate: true });
      highlightSelectedNode(svg, selectedNodeId, { animate: !reduced });
      if (reduced) {
        gsap.set([regions, regionLabels, nodeGroups, kingdoms, kingdomLabels, terrainShapes], { autoAlpha: 1, y: 0 });
      }
      return;
    }

    applyWorldMapLayers(container, layers, { animate: false });

    if (reduced) {
      gsap.set([regions, regionLabels, nodeGroups, kingdoms, kingdomLabels, expeditionLines, tradeLines, terrainShapes], {
        autoAlpha: 1,
        strokeDashoffset: 0,
      });
      highlightSelectedNode(svg, selectedNodeId, { animate: false });
      return;
    }

    if (entrance) {
      const tl = gsap.timeline({ defaults: { ease: 'power2.out' } });

      if (layers.terrain !== false && terrainShapes.length) {
        gsap.set(terrainShapes, { autoAlpha: 0 });
        tl.to(terrainShapes, {
          autoAlpha: 1,
          duration: 0.5,
          stagger: 0.06,
        }, 0);
        if (forestShapes.length) {
          tl.fromTo(forestShapes, {
            scale: 0.9,
          }, {
            scale: 1,
            duration: 0.5,
            ease: 'back.out(1.5)',
          }, 0);
        }
        if (mountainShapes.length) {
          tl.fromTo(mountainShapes, {
            y: -6,
          }, {
            y: 0,
            duration: 0.55,
          }, 0);
        }
      }

      tl.to(regions, {
        autoAlpha: 1,
        duration: 0.55,
        stagger: 0.07,
      }, 0.05)
        .to(regionLabels, {
          autoAlpha: 1,
          y: 0,
          duration: 0.45,
          stagger: 0.05,
        }, 0.17);

      if (layers.kingdoms !== false) {
        tl.fromTo(kingdoms, {
          scale: 0.82,
          transformOrigin: 'center center',
        }, {
          autoAlpha: 1,
          scale: 1,
          duration: 0.42,
          stagger: 0.025,
        }, 0.18)
          .to(kingdomLabels, {
            autoAlpha: 1,
            duration: 0.3,
            stagger: 0.02,
          }, 0.28);
      }

      if (layers.nodes !== false && nodeGroups.length) {
        tl.fromTo(nodeGroups, {
          scale: 0.7,
          transformOrigin: 'center center',
        }, {
          autoAlpha: 1,
          scale: 1,
          duration: 0.38,
          stagger: 0.05,
          ease: 'back.out(1.4)',
        }, 0.32);
      }

      if (layers.expeditions !== false && expeditionLines.length) {
        tl.add(lineDrawIn(expeditionLines, { delay: 0.05, stagger: 0.08 }), 0.42);
      }

      if (layers.routes !== false && tradeLines.length) {
        tl.add(lineDrawIn(tradeLines, { delay: 0.05, stagger: 0.06 }), 0.48);
      }
    }

    if (layers.expeditions !== false && expeditionLines.length) {
      const flow = startLineFlow(expeditionLines, { duration: 1.8, offset: 20 });
      if (flow) cleanups.push(() => flow.kill());
    }

    if (layers.routes !== false && tradeLines.length) {
      const flow = startLineFlow(tradeLines, { duration: 2.6, offset: 16 });
      if (flow) cleanups.push(() => flow.kill());
    }

    const rings = svg.querySelectorAll('.wm-kingdom-ring');
    rings.forEach((ring) => {
      const pulse = gsap.fromTo(ring, {
        attr: { r: 10 },
        autoAlpha: 0.55,
      }, {
        attr: { r: 22 },
        autoAlpha: 0,
        duration: 2.4,
        ease: 'sine.out',
        repeat: -1,
      });
      cleanups.push(() => pulse.kill());
    });

    highlightSelectedNode(svg, selectedNodeId, { animate: entrance });

    const unbindTerrainHover = bindTerrainHover(svg, reduced);
    cleanups.push(unbindTerrainHover);
  });

  return () => {
    cleanups.forEach((fn) => fn());
    ctx.revert();
  };
}

// Light hover feedback on terrain shapes — small scale bump, gated on reduced motion.
// Tooltip content (name + expedition speed modifier) lives in the SVG's native <title>.
function bindTerrainHover(svg, reduced) {
  const shapes = svg.querySelectorAll('.terrain-shape');
  if (!shapes.length) return () => {};

  const onEnter = (event) => {
    if (reduced) return;
    gsap.to(event.currentTarget, {
      scale: 1.015,
      opacity: 0.62,
      duration: 0.2,
      ease: 'power2.out',
      overwrite: 'auto',
    });
  };
  const onLeave = (event) => {
    gsap.to(event.currentTarget, {
      scale: 1,
      opacity: 0.48,
      duration: reduced ? 0 : 0.2,
      ease: 'power2.out',
      overwrite: 'auto',
    });
  };

  shapes.forEach((shape) => {
    shape.addEventListener('pointerenter', onEnter);
    shape.addEventListener('pointerleave', onLeave);
  });

  return () => {
    shapes.forEach((shape) => {
      shape.removeEventListener('pointerenter', onEnter);
      shape.removeEventListener('pointerleave', onLeave);
    });
  };
}

export function highlightSelectedNode(svg, selectedNodeId, { animate = true } = {}) {
  if (!svg) return;

  const groups = svg.querySelectorAll('.wm-node-group');
  groups.forEach((group) => {
    const isSelected = selectedNodeId && group.getAttribute('data-node-id') === String(selectedNodeId);
    const halo = group.querySelector('.wm-node-halo');
    const dot = group.querySelector('.wm-node');

    gsap.killTweensOf([group, halo, dot]);

    if (isSelected) {
      if (animate && !prefersReducedMotion()) {
        gsap.to(group, { scale: 1.08, duration: 0.28, ease: 'power2.out', transformOrigin: 'center center' });
        gsap.to(halo, { attr: { r: '+=2' }, opacity: 0.32, duration: 0.28, yoyo: true, repeat: -1, ease: 'sine.inOut' });
        gsap.to(dot, { attr: { 'stroke-width': 3 }, duration: 0.2 });
      } else {
        gsap.set(group, { scale: 1.06, transformOrigin: 'center center' });
        gsap.set(halo, { opacity: 0.3 });
        gsap.set(dot, { attr: { 'stroke-width': 3 } });
      }
      return;
    }

    gsap.set(group, { scale: 1, transformOrigin: 'center center' });
    gsap.set(halo, { opacity: 0.18 });
    gsap.set(dot, { attr: { 'stroke-width': dot?.getAttribute('data-base-stroke') || 1.5 } });
  });
}

export function animateMapPanelCard(element, { visible = true } = {}) {
  if (!element) return () => {};
  gsap.killTweensOf(element);

  if (prefersReducedMotion()) {
    gsap.set(element, { autoAlpha: visible ? 1 : 0, y: 0 });
    return () => {};
  }

  if (!visible) {
    const tween = gsap.to(element, { autoAlpha: 0, y: 8, duration: 0.2, ease: 'power2.in' });
    return () => tween.kill();
  }

  gsap.set(element, { autoAlpha: 0, y: 10 });
  const tween = gsap.to(element, { autoAlpha: 1, y: 0, duration: 0.34, ease: 'power2.out' });
  return () => tween.kill();
}