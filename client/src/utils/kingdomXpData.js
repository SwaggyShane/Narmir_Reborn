export const KINGDOM_XP_MILESTONES = [
  { level: 1, label: 'Fledgling', note: 'Starting point' },
  { level: 25, label: 'Budding Ruler', note: '25,000 gold' },
  { level: 50, label: 'Established Lord', note: '50,000 gold, 100 troops' },
  { level: 75, label: 'Regional Power', note: '75,000 gold, 50 land' },
  { level: 100, label: 'Grand Duke', note: '150,000 gold, 200 troops, +1% income' },
  { level: 125, label: 'Proven Warlord', note: '100,000 gold, +1% attack' },
  { level: 150, label: 'Master Builder', note: '125,000 gold, 100 land, +1% construction' },
  { level: 175, label: 'Sage of the Realm', note: '125,000 gold, +1% research' },
  { level: 200, label: 'High King', note: '300,000 gold, 500 troops, +1% income, +1% defense' },
  { level: 225, label: 'Strategist', note: '200,000 gold, +1% attack' },
  { level: 250, label: 'Dominator', note: '250,000 gold, 200 land, +1% covert' },
  { level: 275, label: 'Arcane Authority', note: '200,000 gold, +1% research' },
  { level: 300, label: 'Realm Sovereign', note: '500,000 gold, 1,000 troops, +1% income, +1% attack' },
  { level: 325, label: 'Grand Marshal', note: '300,000 gold, 250 land, +1% defense' },
  { level: 350, label: 'Emperor', note: '400,000 gold, +1% income, +1% covert' },
  { level: 375, label: 'Immortal General', note: '350,000 gold, 1,500 troops, +1% attack' },
  { level: 400, label: 'Legendary Sovereign', note: '750,000 gold, 400 land, +2% income, +1% defense' },
  { level: 425, label: 'Mythic Conqueror', note: '500,000 gold, 2,000 troops, +1% attack, +1% covert' },
  { level: 450, label: 'Eternal Ruler', note: '600,000 gold, 500 land, +2% income' },
  { level: 475, label: 'God-King', note: '700,000 gold, 2,500 troops, +1% attack, +1% defense' },
  { level: 500, label: 'Ascended', note: '1,000,000 gold, 750 land, +2% income, +2% attack' },
];

export const RACE_XP_BONUSES = {
  high_elf: 'Superior Research and Magic abilities',
  dwarf: 'Enhanced Construction and Economy',
  dire_wolf: 'Dominant Combat and Exploration',
  dark_elf: 'Exceptional Covert and Magic mastery',
  human: 'Balanced improvements across all activities',
  orc: 'Strong Combat and Economy focused for war',
  vampire: 'Mastery of Night and Shadow operations',
};

export const RACE_REWARD_MODIFIERS = {
  human: 'Your gold grants +25%',
  high_elf: 'Troops → researchers; research bonuses ×2',
  dwarf: 'Gold grants +50%; construction bonuses ×2',
  dire_wolf: 'Troop grants ×2; attack bonuses ×1.5',
  dark_elf: 'Troops → thieves/ninjas; covert bonuses ×2',
  orc: 'Troop grants ×2; attack bonuses ×1.5',
  vampire: 'Troop grants ×1.5; gold +25%; covert bonuses ×1.5',
};

export const XP_SOURCE_ROWS = [
  { key: 'turn', label: 'Turn processing', barClass: 'from-sky-600 to-sky-800' },
  { key: 'gold_earned', label: 'Gold income', barClass: 'from-amber-300 to-amber-600', textClass: 'text-zinc-900' },
  { key: 'combat_win', label: 'Combat victory', barClass: 'from-red-500 to-red-700' },
  { key: 'combat_loss', label: 'Combat defeat', barClass: 'from-orange-600 to-orange-800' },
  { key: 'research', label: 'Research advance', barClass: 'from-emerald-600 to-emerald-800' },
  { key: 'construction', label: 'Construction', barClass: 'from-amber-600 to-amber-800' },
  { key: 'exploration', label: 'Exploration', barClass: 'from-green-600 to-green-800' },
  { key: 'spell_cast', label: 'Spell casting', barClass: 'from-blue-600 to-blue-800' },
  { key: 'covert_op', label: 'Covert operation', barClass: 'from-purple-600 to-purple-800' },
];

export function parseXpSources(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw) || {};
  } catch {
    return {};
  }
}

export function parseMilestoneBonuses(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw) || {};
  } catch {
    return {};
  }
}

export function formatMilestoneBonusSummary(bonuses) {
  const parts = [];
  if (bonuses.gold_income_pct) parts.push(`+${bonuses.gold_income_pct}% gold income`);
  if (bonuses.attack_pct) parts.push(`+${bonuses.attack_pct}% attack`);
  if (bonuses.defense_pct) parts.push(`+${bonuses.defense_pct}% defense`);
  if (bonuses.research_speed_pct) parts.push(`+${bonuses.research_speed_pct}% research`);
  if (bonuses.construction_speed_pct) parts.push(`+${bonuses.construction_speed_pct}% construction`);
  if (bonuses.covert_pct) parts.push(`+${bonuses.covert_pct}% covert`);
  return parts.length ? parts.join(', ') : 'None yet';
}