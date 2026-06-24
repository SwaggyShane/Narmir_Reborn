const NEWS_META = Object.freeze({
  attack: { icon: "⚔️", color: "var(--red)", label: "Combat" },
  spell: { icon: "✨", color: "var(--accent1)", label: "Spell" },
  covert: { icon: "🕵️", color: "var(--amber)", label: "Covert" },
  system: { icon: "📋", color: "var(--text2)", label: "System" },
  alliance: { icon: "🤝", color: "var(--blue)", label: "Alliance" },
  expedition: { icon: "🧭", color: "var(--gold)", label: "Expedition" },
});

const NEWS_EMOJI_RULES = Object.freeze([
  { pattern: /^Food surplus:/i, emoji: "🌽" },
  { pattern: /^Food:/i, emoji: "🌽" },
  { pattern: /^Tears of the World Tree:/i, emoji: "💧" },
  { pattern: /^Your foresters discovered a rare item:/i, emoji: "🌲" },
  { pattern: /^Your foresters unearthed an Earth Fragment while logging!/i, emoji: "🌍" },
  { pattern: /^An unusually productive logging session doubled your wood yield!/i, emoji: "🌲" },
  { pattern: /^Foresters report:/i, emoji: "🌲" },
  { pattern: /^Resource production: .*wood\./i, emoji: "🪵" },
  { pattern: /^Resource production: .*stone\./i, emoji: "🪨" },
  { pattern: /^Resource production: .*iron\./i, emoji: "🔗" },
  { pattern: /^(\d[\d,]*) researchers studying/i, emoji: "🔬" },
  { pattern: /^Mana:/i, emoji: "🔮" },
  { pattern: /^Population grew\b/i, emoji: "👥" },
  { pattern: /^Population declined\b/i, emoji: "⚠️" },
  { pattern: /^Happiness:/i, emoji: "😊" },
  { pattern: /^Turn \d+: .*gold earned/i, emoji: "🪙" },
  { pattern: /^Troop upkeep:/i, emoji: "⚙️" },
  { pattern: /^End of Turn \d+\b/i, emoji: "🏦" },
  { pattern: /^Geared Self-Construction:/i, emoji: "⚙️" },
  { pattern: /^Actively constructing:/i, emoji: "🏗️" },
  { pattern: /^Mage research advanced:/i, emoji: "✨" },
  { pattern: /^The Mage Tower has completed:/i, emoji: "✨" },
  { pattern: /^Mage Tower Est:/i, emoji: "📜" },
  { pattern: /^Mausoleum:/i, emoji: "🪦" },
  { pattern: /^Scribes paused location mapping/i, emoji: "⚠️" },
  { pattern: /^Scribes paused Hybrid Blueprint research/i, emoji: "⚠️" },
  { pattern: /^Scribes paused Fragment studying/i, emoji: "⚠️" },
  { pattern: /^Your scribes mapped a new location!/i, emoji: "📍" },
  { pattern: /^Your scribes fully conceptualized a/i, emoji: "✨" },
  { pattern: /^Your scribes successfully studied a World Fragment/i, emoji: "🧪" },
  { pattern: /^Your scribes drafted in the Library:/i, emoji: "📚" },
  { pattern: /^Library Est:/i, emoji: "📚" },
  { pattern: /^Scribes have completed a location map for/i, emoji: "🗺️" },
  { pattern: /^Engineers grew more skilled/i, emoji: "⚒️" },
  { pattern: /^Construction complete:/i, emoji: "✅" },
  { pattern: /^All support units housed/i, emoji: "✅" },
  { pattern: /^Low Tax Event:/i, emoji: "🌟" },
  { pattern: /^UNREST:/i, emoji: "⚠️" },
  { pattern: /^TAX REVOLT:/i, emoji: "⚠️" },
  { pattern: /^SABOTAGE:/i, emoji: "⚠️" },
  { pattern: /^FOOD RIOT:/i, emoji: "⚠️" },
  { pattern: /^MILITARY MUTINY:/i, emoji: "⚠️" },
  { pattern: /^Unrest:/i, emoji: "😒" },
  { pattern: /^Thrall starvation!/i, emoji: "🚨" },
  { pattern: /^Vampire hunger:/i, emoji: "🍷" },
  { pattern: /^Blood Sacrifice:/i, emoji: "🩸" },
  { pattern: /^Food deficit:/i, emoji: "⚠️" },
  { pattern: /^Food shortage!/i, emoji: "🚨" },
  { pattern: /^Population fleeing starvation:/i, emoji: "👥" },
  { pattern: /^Holy Sanctuaries:/i, emoji: "👥" },
  { pattern: /fighters deserted — starvation\./i, emoji: "⚔️" },
  { pattern: /^Your warriors intercepted an expedition!/i, emoji: "⚔️" },
  { pattern: /^Orc raiders .* intercepted your expedition/i, emoji: "🚨" },
  { pattern: /^Your warriors failed to intercept the expedition/i, emoji: "⚔️" },
  { pattern: /^Your expedition successfully repelled Orc raiders/i, emoji: "🛡️" },
  { pattern: /^Expedition returned with:/i, emoji: "🗂️" },
  { pattern: /^Your Surveyors discovered the kingdom of/i, emoji: "🔭" },
  { pattern: /^Studied .* with .* researchers/i, emoji: "📚" },
  { pattern: /^Rangers discovered/i, emoji: "🗺️" },
  { pattern: /^Rangers returned with/i, emoji: "💰" },
  { pattern: /^Rangers foraged/i, emoji: "🌾" },
  { pattern: /^BOUNTY CLAIMED!/i, emoji: "💰" },
  { pattern: /^In the aftermath, your troops scavenged a map/i, emoji: "🗺️" },
  { pattern: /^The merchants of .* have established a permanent trade route/i, emoji: "🤝" },
  { pattern: /^Trade offer from/i, emoji: "📦" },
  { pattern: /accepted your trade offer/i, emoji: "✅" },
  { pattern: /declined your trade offer/i, emoji: "❌" },
  { pattern: /^Bought .* from the market/i, emoji: "⚖️" },
  { pattern: /^Sold .* to the market/i, emoji: "⚖️" },
  { pattern: /^Applied .* to .*! Bonuses unlocked:/i, emoji: "✨" },
  { pattern: /^Assigned a .* Hybrid Blueprint/i, emoji: "✨" },
  { pattern: /^A thief stole your location map/i, emoji: "🗺️" },
  { pattern: /^SUCCESS: You raided/i, emoji: "🏴‍☠️" },
  { pattern: /^RAIDED:/i, emoji: "🛶" },
  { pattern: /^FAILURE: Your raid on/i, emoji: "💀" },
  { pattern: /^Your guards repelled an Orc raid/i, emoji: "🛡️" },
  { pattern: /^Dungeon raid FAILED/i, emoji: "💀" },
  { pattern: /^Plague ravages your kingdom/i, emoji: "☠️" },
  { pattern: /^Summoned rats devour/i, emoji: "🐀" },
  { pattern: /^Life drain aura saps/i, emoji: "💀" },
  { pattern: /^Mutated crops rot/i, emoji: "🌿" },
  { pattern: /^Command legion confusion/i, emoji: "⚔️" },
  { pattern: /^Conjured abundance generates/i, emoji: "🌽" },
  { pattern: /^REGION CAPTURED:/i, emoji: "🚩" },
  { pattern: /^Grand Chancellor's Golden Touch:/i, emoji: "👑" },
  { pattern: /^Archmage Mana Infusion:/i, emoji: "🧙" },
  { pattern: /^Forge Lord Industrialism:/i, emoji: "🛠️" },
  { pattern: /^Alpha Hunting:/i, emoji: "🐺" },
  { pattern: /^Blood Shaman Sacrifice:/i, emoji: "🩸" },
  { pattern: /^Mage King Leyline Control:/i, emoji: "✨" },
  { pattern: /^Silent Shadow Espionage:/i, emoji: "🌑" },
  { pattern: /^Diplomat Influence:/i, emoji: "🤝" },
]);

function stripLeadingNoise(text) {
  return text.replace(/^[<>=\-\u2022\u00B7/\\|]+\s*/, "");
}

function decorateNewsMessage(value, repairFn) {
  if (value === null || value === undefined) return value;
  let text = String(value);
  if (typeof repairFn === "function") {
    text = repairFn(text);
  }
  if (!text) return text;
  if (/^\p{Extended_Pictographic}/u.test(text)) return text;

  const cleaned = stripLeadingNoise(text);
  for (const rule of NEWS_EMOJI_RULES) {
    if (rule.pattern.test(cleaned)) {
      return rule.emoji ? `${rule.emoji} ${cleaned}` : cleaned;
    }
  }

  return `📋 ${cleaned}`;
}

function getNewsMeta(type) {
  return NEWS_META[type] || NEWS_META.system;
}

// ESM exports for client (Vite / browser)
export {
  NEWS_META,
  NEWS_EMOJI_RULES,
  decorateNewsMessage,
  getNewsMeta,
};

export default {
  NEWS_META,
  NEWS_EMOJI_RULES,
  decorateNewsMessage,
  getNewsMeta,
};
