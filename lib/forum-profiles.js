const crypto = require('crypto');

const AVATAR_MODES = new Set(['initials', 'gravatar', 'custom']);

function normalizeAvatarMode(mode) {
  return AVATAR_MODES.has(mode) ? mode : 'initials';
}

function gravatarHash(email) {
  if (!email || typeof email !== 'string') return null;
  return crypto.createHash('md5').update(email.trim().toLowerCase()).digest('hex');
}

function gravatarUrl(email, size = 96) {
  const hash = gravatarHash(email);
  if (!hash) return null;
  return `https://www.gravatar.com/avatar/${hash}$1d=identicon&s=${size}`;
}

function initialsAvatarDataUri(username, size = 96) {
  const letter = (username || '?').trim().charAt(0).toUpperCase() || '?';
  const colors = ['#4a8fb8', '#c8962a', '#8fb84a', '#b43c00', '#4caf82', '#8b5cf6', '#f06202'];
  let hash = 0;
  for (let i = 0; i < (username || '').length; i++) {
    hash = (hash * 31 + username.charCodeAt(i)) & 0xffffffff;
  }
  const bg = colors[Math.abs(hash) % colors.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="100%" height="100%" fill="${bg}" rx="8"/>
    <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="#fff" font-family="Inter, sans-serif" font-size="${Math.floor(size * 0.45)}" font-weight="700">${letter}</text>
  </svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function resolveForumAvatar({ profile, email, username, size = 96 }) {
  const mode = normalizeAvatarMode(profile?.avatar_mode);
  if (mode === 'custom' && profile?.avatar_url) {
    return profile.avatar_url;
  }
  if (mode === 'gravatar') {
    const url = gravatarUrl(email, size);
    if (url) return url;
  }
  return initialsAvatarDataUri(username, size);
}

async function getForumProfile(db, playerId) {
  return db.get(`SELECT player_id, avatar_mode, avatar_url, updated_at FROM forum_profiles WHERE player_id = $1`, [
    playerId,
  ]);
}

async function upsertForumProfile(db, playerId, { avatarMode, avatarUrl }) {
  const mode = normalizeAvatarMode(avatarMode);
  let url = typeof avatarUrl === 'string' ? avatarUrl.trim() : null;
  if (mode !== 'custom') url = null;
  if (mode === 'custom' && url && !/^https?:\/\//i.test(url)) {
    return { error: 'Custom avatar must be an http(s) URL' };
  }
  const now = Math.floor(Date.now() / 1000);
  await db.run(
    `INSERT INTO forum_profiles (player_id, avatar_mode, avatar_url, updated_at)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (player_id) DO UPDATE SET
       avatar_mode = EXCLUDED.avatar_mode,
       avatar_url = EXCLUDED.avatar_url,
       updated_at = EXCLUDED.updated_at`,
    [playerId, mode, url, now],
  );
  return { ok: true, avatarMode: mode, avatarUrl: url };
}

module.exports = {
  AVATAR_MODES,
  normalizeAvatarMode,
  gravatarUrl,
  initialsAvatarDataUri,
  resolveForumAvatar,
  getForumProfile,
  upsertForumProfile,
};