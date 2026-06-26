const CATEGORY_META = {
  gameplay: { emoji: '⚔️', label: 'Gameplay' },
  combat: { emoji: '🗡️', label: 'Combat' },
  economy: { emoji: '💰', label: 'Economy' },
  world: { emoji: '🌍', label: 'World' },
  ui: { emoji: '🎨', label: 'UI' },
  'polish & management': { emoji: '✨', label: 'Polish' },
  polish: { emoji: '✨', label: 'Polish' },
  bugfix: { emoji: '🐛', label: 'Bugfix' },
  balance: { emoji: '⚖️', label: 'Balance' },
  content: { emoji: '📜', label: 'Content' },
  performance: { emoji: '⚡', label: 'Performance' },
  feature: { emoji: '🔮', label: 'Feature' },
};

function normalizeCategory(category) {
  return String(category || '').trim().toLowerCase();
}

function categoryMeta(category) {
  const key = normalizeCategory(category);
  return CATEGORY_META[key] || { emoji: '🔥', label: category || 'Update' };
}

/**
 * Build game-facing markdown unless the admin already wrote structured md.
 */
function buildBodyMd({ title, description, category }) {
  const desc = String(description || '').trim();
  const hasStructure = /^#{1,3}\s/m.test(desc) || /^[-*]\s/m.test(desc);
  if (hasStructure) return desc;

  const meta = categoryMeta(category);
  const lines = [
    `### ${meta.emoji} ${String(title || 'Update').trim()}`,
    '',
  ];
  if (category) {
    lines.push(`> **${meta.label}**`, '');
  }
  lines.push(desc);
  return lines.join('\n');
}

/** Plain text for Discord embeds */
function stripMarkdown(md) {
  return String(md || '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^[-*]\s+/gm, '• ')
    .trim();
}

module.exports = { categoryMeta, buildBodyMd, stripMarkdown, CATEGORY_META };