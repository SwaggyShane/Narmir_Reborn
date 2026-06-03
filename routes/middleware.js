const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { kingdomIdCache } = require("../cache.js");

if (!process.env.JWT_SECRET) {
  throw new Error("CRITICAL: JWT_SECRET environment variable is required. Set it before starting the server.");
}
const JWT_SECRET = process.env.JWT_SECRET;
const isProd = process.env.NODE_ENV === 'production';

function generateCsrfToken() {
  return crypto.randomBytes(32).toString("hex");
}

function requireAuth(req, res, next) {
  const token =
    req.cookies?.token ||
    req.headers.authorization?.replace("Bearer ", "") ||
    req.headers["x-auth-token"];
  if (!token) {
    console.log('[requireAuth] No token found. Cookies:', Object.keys(req.cookies || {}), 'Headers:', { auth: req.headers.authorization ? 'present' : 'missing', custom: req.headers["x-auth-token"] ? 'present' : 'missing' });
    return res.status(401).json({ error: "Authentication required" });
  }
  try {
    req.player = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    console.log('[requireAuth] Token verification failed:', err?.message || err);
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

function cacheKingdomId(db) {
  return async (req, res, next) => {
    if (!req.player || !req.player.id) return next();

    const playerId = req.player.id;
    const cacheKey = `kingdom:${playerId}`;

    // Check cache first (30 minute TTL)
    if (kingdomIdCache.has(cacheKey)) {
      req.kingdomId = kingdomIdCache.get(cacheKey);
      return next();
    }

    // Fetch from DB and cache
    try {
      const row = await db.get("SELECT id FROM kingdoms WHERE player_id = ?", [playerId]);
      if (row) {
        req.kingdomId = row.id;
        kingdomIdCache.set(cacheKey, row.id, 30 * 60 * 1000); // 30 min TTL
      }
      next();
    } catch (err) {
      console.error('[cacheKingdomId] Error:', err.message);
      next();
    }
  };
}

function requireAdmin(req, res, next) {
  const token =
    req.cookies?.token ||
    req.headers.authorization?.replace("Bearer ", "") ||
    req.headers["x-auth-token"];
  if (!token) return res.status(401).json({ error: "Authentication required" });
  try {
    req.player = jwt.verify(token, JWT_SECRET);
    if (!req.player.isAdmin)
      return res.status(403).json({ error: "Admin access required" });
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

function requireCsrfToken(req, res, next) {
  const headerToken = req.headers["x-csrf-token"];
  if (!headerToken) {
    return res.status(403).json({ error: "CSRF token required" });
  }

  const cookieToken = req.cookies?.csrf_token;
  if (!cookieToken) {
    return res.status(403).json({ error: "CSRF token missing from cookie" });
  }

  if (headerToken !== cookieToken) {
    return res.status(403).json({ error: "CSRF token mismatch" });
  }

  next();
}

function ensureCsrfToken(req, res, next) {
  // Only set CSRF token if one doesn't already exist (avoid regenerating on every request)
  // This prevents performance issues from redundant JWT verification and token generation
  if (!req.cookies?.csrf_token) {
    // Check if user is authenticated by verifying the token
    const token =
      req.cookies?.token ||
      req.headers.authorization?.replace("Bearer ", "") ||
      req.headers["x-auth-token"];

    if (token) {
      try {
        // Verify token is valid - if it is, user is authenticated
        jwt.verify(token, JWT_SECRET);
        // Token is valid, set CSRF token for future requests
        const csrfToken = generateCsrfToken();
        const csrfCookieOpts = {
          httpOnly: false,
          path: "/",
          maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days, matching auth routes
          sameSite: isProd ? "none" : "lax",
          secure: isProd,
        };
        res.cookie("csrf_token", csrfToken, csrfCookieOpts);
      } catch (e) {
        // Token is invalid, don't set CSRF token
      }
    }
  }
  next();
}

function cleanupOrphanedTransactions(db) {
  return (req, res, next) => {
    // Cleanup after response is sent
    res.on('finish', () => {
      try {
        // Check if transaction is still active and release it
        if (db && db.cleanupTransaction) {
          db.cleanupTransaction();
        }
      } catch (err) {
        console.error('[db] Cleanup error:', err.message);
      }
    });
    next();
  };
}

module.exports = { requireAuth, cacheKingdomId, requireAdmin, requireCsrfToken, ensureCsrfToken, generateCsrfToken, cleanupOrphanedTransactions };
