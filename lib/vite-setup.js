'use strict';

const path = require('path');
const { devRequestDebugMiddleware } = require('./middleware');

async function setupVite(app, httpServer) {
  if (process.env.NODE_ENV === 'production') return null;
  try {
    const { createServer } = require('vite');
    const vite = await createServer({
      configFile: path.join(__dirname, '..', 'vite.config.js'),
      server: { middlewareMode: true, hmr: { server: httpServer } },
      appType: 'custom',
      base: '/',
      root: path.join(__dirname, '..', 'client'),
      mode: 'development'
    });

    // Dev debug logging middleware (before Vite)
    app.use(devRequestDebugMiddleware());

    console.log('[vite] Dev server created with root:', path.join(__dirname, '..'));
    return vite;
  } catch (err) {
    console.error('[vite] Dev middleware failed to start:', err);
    return null;
  }
}

module.exports = { setupVite };
