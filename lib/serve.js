const path = require('path');
const fs = require('fs');
const express = require('express');
const compression = require('compression');

module.exports = (vite, _bootError, _isBooted, _PORT, _HOST, _server) => {
  const serveIndex = async (req, res, next) => {
    console.log(`[serveIndex] HIT: ${req.method} ${req.url}`);
    if (req.url === '/admin.html') return next();
    if (req.url.includes('.') && !req.url.endsWith('.html')) return next();
    try {
      const indexPath = path.join(__dirname, '..', 'client', 'index.html');
      let html = fs.readFileSync(indexPath, 'utf-8');
      
      if (process.env.NODE_ENV !== 'production' && vite) {
        html = await vite.transformIndexHtml('/game', html);
      } else {
        const distPath = path.join(__dirname, '..', 'dist');
        if (fs.existsSync(distPath)) {
          const distIndexHtml = path.join(distPath, 'index.html');
          if (fs.existsSync(distIndexHtml)) {
            html = fs.readFileSync(distIndexHtml, 'utf-8');
          } else {
            const files = fs.readdirSync(distPath);
            const mainJs = files.find(f => f.startsWith('main') && f.endsWith('.js'));
            if (mainJs) {
              html = html.replace('</head>', `<script type="module" src="/dist/${mainJs}"></script></head>`);
            }
          }
        }
      }

      if (html.includes('main.js') || html.includes('/assets/main') || html.includes('assets/index.js') || html.includes('/assets/index')) {
        console.log("[vite] Verified JavaScript bundle/script tag found in final HTML response");
      } else {
        console.warn("[vite] WARNING: JavaScript bundle script NOT FOUND in final HTML response!");
      }

      res.set({
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }).send(html);
    } catch (e) { 
      console.error("[vite] Error in serveIndex:", e);
      next(e); 
    }
  };

  const serveSplash = async (req, res, next) => {
    console.log(`[serveSplash] HIT: ${req.method} ${req.url}`);
    const NO_CACHE = {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    };
    try {
      if (process.env.NODE_ENV !== 'production' && vite) {
        const splashPath = path.join(__dirname, '..', 'client', 'splash.html');
        let html = fs.readFileSync(splashPath, 'utf-8');
        html = await vite.transformIndexHtml('/splash.html', html);
        return res.set(NO_CACHE).send(html);
      }

      const distPath = path.join(__dirname, '..', 'dist');
      const distSplash = path.join(distPath, 'splash.html');
      if (fs.existsSync(distSplash)) {
        console.log('[serveSplash] Serving from dist/splash.html');
        return res.set(NO_CACHE).send(fs.readFileSync(distSplash, 'utf-8'));
      }

      console.warn('[serveSplash] dist/splash.html not found, attempting bundle injection');
      const assetPath = path.join(distPath, 'assets');
      if (fs.existsSync(assetPath)) {
        const assets = fs.readdirSync(assetPath);
        const splashJs  = assets.find(f => f.startsWith('splash') && f.endsWith('.js'));
        const splashCss = assets.find(f => f.startsWith('splash-') && f.endsWith('.css'));
        if (splashJs) {
          let html = fs.readFileSync(path.join(__dirname, '..', 'client', 'splash.html'), 'utf-8');
          html = html.replace(/<script type="module" src="\/src\/splash-main\.jsx"><\/script>/, '');
          let inject = `<script type="module" crossorigin src="/dist/assets/${splashJs}"></script>`;
          if (splashCss) inject += `\n    <link rel="stylesheet" crossorigin href="/dist/assets/${splashCss}">`;
          html = html.replace('</head>', `    ${inject}\n  </head>`);
          console.log(`[serveSplash] Injection fallback: ${splashJs}`); 
          return res.set(NO_CACHE).send(html);
        }
      }
      next();
    } catch (e) {
      console.error("[serveSplash] Error:", e);
      next(e);
    }
  };

  const servePortal = async (req, res, next) => {
    console.log(`[servePortal] HIT: ${req.method} ${req.url}`);
    const NO_CACHE = {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    };
    try {
      if (process.env.NODE_ENV !== 'production' && vite) {
        const portalPath = path.join(__dirname, '..', 'client', 'portal.html');
        let html = fs.readFileSync(portalPath, 'utf-8');
        html = await vite.transformIndexHtml('/portal.html', html);
        return res.set(NO_CACHE).send(html);
      }

      const distPath = path.join(__dirname, '..', 'dist');
      const distPortal = path.join(distPath, 'portal.html');
      if (fs.existsSync(distPortal)) {
        console.log('[servePortal] Serving from dist/portal.html');
        return res.set(NO_CACHE).send(fs.readFileSync(distPortal, 'utf-8'));
      }

      console.warn('[servePortal] dist/portal.html not found, attempting bundle injection');
      const assetPath = path.join(distPath, 'assets');
      if (fs.existsSync(assetPath)) {
        const assets = fs.readdirSync(assetPath);
        const portalJs  = assets.find(f => f.startsWith('portal') && f.endsWith('.js'));
        const portalCss = assets.find(f => f.startsWith('portal-') && f.endsWith('.css'));
        if (portalJs) {
          let html = fs.readFileSync(path.join(__dirname, '..', 'client', 'portal.html'), 'utf-8');
          html = html.replace(/<script type="module" src="\/src\/portal-main\.jsx"><\/script>/, '');
          let inject = `<script type="module" crossorigin src="/dist/assets/${portalJs}"></script>`;
          if (portalCss) inject += `\n    <link rel="stylesheet" crossorigin href="/dist/assets/${portalCss}">`;
          html = html.replace('</head>', `    ${inject}\n  </head>`);
          console.log(`[servePortal] Injection fallback: ${portalJs}`);
          return res.set(NO_CACHE).send(html);
        }
      }
      next();
    } catch (e) {
      console.error("[servePortal] Error:", e);
      next(e);
    }
  };

  const serveAdmin = async (req, res, next) => {
    console.log(`[serveAdmin] HIT: ${req.method} ${req.url}`);
    const NO_CACHE = {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    };
    try {
      if (process.env.NODE_ENV !== 'production' && vite) {
        const adminPath = path.join(__dirname, '..', 'client', 'admin.html');
        let html = fs.readFileSync(adminPath, 'utf-8');
        html = await vite.transformIndexHtml('/admin.html', html);
        return res.set(NO_CACHE).send(html);
      }

      const distPath = path.join(__dirname, '..', 'dist');
      const distAdmin = path.join(distPath, 'admin.html');
      if (fs.existsSync(distAdmin)) {
        console.log('[serveAdmin] Serving from dist/admin.html');
        return res.set(NO_CACHE).send(fs.readFileSync(distAdmin, 'utf-8'));
      }

      console.warn('[serveAdmin] dist/admin.html not found, attempting bundle injection');
      const assetPath = path.join(distPath, 'assets');
      if (fs.existsSync(assetPath)) {
        const assets = fs.readdirSync(assetPath);
        const adminJs  = assets.find(f => f.startsWith('admin') && f.endsWith('.js'));
        const adminCss = assets.find(f => f.startsWith('admin-') && f.endsWith('.css'));
        if (adminJs) {
          let html = fs.readFileSync(path.join(__dirname, '..', 'client', 'admin.html'), 'utf-8');
          html = html.replace(/<script type="module" src="\/src\/admin-main\.jsx"><\/script>/, '');
          let inject = `<script type="module" crossorigin src="/dist/assets/${adminJs}"></script>`;
          if (adminCss) inject += `\n    <link rel="stylesheet" crossorigin href="/dist/assets/${adminCss}">`;
          html = html.replace('</head>', `    ${inject}\n  </head>`);
          console.log(`[serveAdmin] Injection fallback: ${adminJs}`);
          return res.set(NO_CACHE).send(html);
        }
      }
      next();
    } catch (e) {
      console.error("[serveAdmin] Error:", e);
      next(e);
    }
  };

  // Centralized registration of HTML entry points, Vite middlewares (dev), static assets,
  // and SPA fallback. Removes duplication and bloat from index.js.
  const setupServing = (app) => {
    // gzip/deflate everything below (HTML, static assets, JSON API responses).
    // dist/assets/index.js and WorldmapPanel-*.js in particular go from
    // ~178KB/~580KB minified down to roughly ~55KB/~148KB over the wire —
    // nothing in the build previously applied any compression at all.
    app.use(compression());

    // HTML entry points MUST register before Vite middleware — otherwise Vite serves
    // client/index.html for /index.html and the splash intro disappears.
    app.get(['/', '/index.html'], serveSplash);
    app.get(['/game', '/game.html'], serveIndex);
    app.get(['/portal', '/portal.html'], servePortal);
    app.get(['/admin', '/admin.html'], serveAdmin);

    if (vite) {
      app.use(vite.middlewares);
      console.log('[vite] Vite middleware active');
    }

    app.use(express.static(path.join(__dirname, '..', 'public'), { index: false }));
    app.use(express.static(path.join(__dirname, '..', 'client'), { index: false }));
    app.use('/dist', express.static(path.join(__dirname, '..', 'dist')));

    if (process.env.NODE_ENV === 'production') {
      app.use('/client', express.static(path.join(__dirname, '..', 'client')));
      app.use('/node_modules', express.static(path.join(__dirname, '..', 'node_modules')));
    }

    // SPA fallback: for non-asset paths, serve splash (client handles routing)
    app.get('*', (req, res, next) => {
      if (req.url.includes('.') && !req.url.endsWith('.html')) {
        console.log(`[static] Could not find file: ${req.url}`);
        return next();
      }
      serveSplash(req, res, next);
    });
  };

  return { serveIndex, serveSplash, servePortal, serveAdmin, setupServing };
};
