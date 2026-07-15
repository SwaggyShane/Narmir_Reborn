export const PANEL_META = Object.freeze({
  status: { label: 'Status', icon: '🏰', section: 'Kingdom', keywords: ['kingdom', 'troops', 'tax'] },
  happiness: { label: 'Happiness', icon: '😊', section: 'Kingdom', keywords: ['morale', 'unrest'] },
  studies: { label: 'Studies', icon: '🏛️', section: 'Kingdom', keywords: ['research', 'magic', 'spellbook'] },
  build: { label: 'Build', icon: '🔨', section: 'Kingdom', keywords: ['construction', 'engineers', 'smithy'] },
  exploration: { label: 'Exploration', icon: '🧭', section: 'Kingdom', keywords: ['expedition', 'rangers', 'scout'] },
  economy: { label: 'Economy', icon: '💰', section: 'Wherewithal', keywords: ['tax', 'food', 'bank', 'farm'] },
  market: { label: 'Market', icon: '⚖️', section: 'Wherewithal', keywords: ['trade', 'commodity'] },
  resources: { label: 'Resources', icon: '🌲', section: 'Wherewithal', keywords: ['wood', 'stone', 'iron', 'nodes'] },
  rankings: { label: 'Rankings', icon: '🏆', section: 'Warfare', keywords: ['rank', 'score', 'leaderboard'] },
  hire: { label: 'Hire', icon: '🤝', section: 'Warfare', keywords: ['recruit', 'troops'] },
  warfare: { label: 'Offense', icon: '⚔️', section: 'Warfare', keywords: ['attack', 'spell', 'covert', 'war'] },
  defense: { label: 'Defense', icon: '🛡️', section: 'Warfare', keywords: ['walls', 'towers', 'fortify'] },
  bounties: { label: 'Bounties', icon: '🪙', section: 'Warfare', keywords: ['bounty', 'gold'] },
  training: { label: 'Training', icon: '🎯', section: 'Warfare', keywords: ['xp', 'levels'] },
  heroes: { label: 'Heroes', icon: '👑', section: 'Warfare', keywords: ['hero', 'champion'] },
  worldmap: { label: 'World Map', icon: '🗺️', section: 'Warfare', keywords: ['map', 'regions'] },
  alliances: { label: 'Alliance', icon: '🤝', section: 'Warfare', keywords: ['guild', 'alliance'] },
  messages: { label: 'Messages', icon: '✉️', section: 'Social', keywords: ['pm', 'mail', 'inbox'], badgeKey: 'messages' },
  forum: { label: 'Forum', icon: '📚', section: 'Social', keywords: ['boards', 'posts'] },
  globalchat: { label: 'Chat', icon: '💬', section: 'Social', keywords: ['global', 'talk'], badgeKey: 'chat' },
  news: { label: 'News', icon: '📰', section: 'Social', keywords: ['events', 'log'], badgeKey: 'news' },
  goals: { label: 'Goals', icon: '📝', section: 'Information', keywords: ['quests', 'objectives'] },
  races: { label: 'Races', icon: '🦄', section: 'Information', keywords: ['lore', 'race'] },
  changelog: { label: 'Changelog', icon: '📋', section: 'Information', keywords: ['updates', 'patch'] },
  testing: { label: 'Testing', icon: '🧪', section: 'Information', keywords: ['debug', 'dev'] },
  options: { label: 'Settings', icon: '⚙️', section: 'Information', keywords: ['config', 'bio', 'prestige'] },
});

export const HIDE_KINGDOM_HEADER_PANELS = new Set([
  'globalchat',
  'defense',
  'races',
  'build',
  'heroes',
  'worldmap',
  'bounties',
  'messages',
  'forum',
]);

/** Full-width shell: sidebar + topbar + footer only (no resource strip, no panel chrome). */
export const FULL_BLEED_SHELL_PANELS = new Set(['globalchat', 'forum']);

export const NAV_SECTIONS = Object.freeze([
  {
    id: 'kingdom',
    label: 'Kingdom',
    panels: ['status', 'happiness', 'studies', 'build', 'exploration'],
  },
  {
    id: 'wherewithal',
    label: 'Wherewithal',
    panels: ['economy', 'market', 'resources'],
  },
  {
    id: 'warfare',
    label: 'Warfare',
    panels: ['rankings', 'hire', 'warfare', 'defense', 'bounties', 'training', 'heroes', 'worldmap', 'alliances'],
  },
  {
    id: 'social',
    label: 'Social',
    panels: ['messages', 'forum', 'globalchat', 'news'],
  },
  {
    id: 'information',
    label: 'Information',
    panels: ['goals', 'races', 'changelog', 'testing', 'options'],
  },
]);

export const EXPEDITION_TYPE_LABELS = Object.freeze({
  scout: 'Scout',
  deep: 'Deep',
  dungeon: 'Dungeon',
  mountain: "Mountain's Heart",
  'resource-harvest': 'Harvest',
});

export function getPanelMeta(panelId) {
  return PANEL_META[panelId] || { label: panelId, icon: '📋', section: 'Other', keywords: [] };
}