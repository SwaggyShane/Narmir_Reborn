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
  { pattern: /^Mana:/i, emoji: "✨" },
  { pattern: /mana restored/i, emoji: "✨" },
  { pattern: /Mana Infusion:/i, emoji: "✨" },
  { pattern: /^Population grew\b/i, emoji: "👥" },
  { pattern: /^Population declined\b/i, emoji: "⚠️" },
  { pattern: /^Happiness:/i, emoji: "😊" },
  { pattern: /^Turn \d+: .*gold earned/i, emoji: "🪙" },
  { pattern: /^Kingdom reached Level \d+/i, emoji: "🏆" },
  { pattern: /^Level \d+ milestone/i, emoji: "🏆" },
  { pattern: /^Troop upkeep:/i, emoji: "⚙️" },
  { pattern: /^Bank deposits matured!/i, emoji: "🏦" },
  { pattern: /^End of Turn \d+.*Net Gold/i, emoji: "💰" },
  { pattern: /^End of Turn \d+/i, emoji: "💰" },
  { pattern: /^Net Gold:/i, emoji: "💰" },
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

function stripLeadingEmoji(text) {
  let result = String(text);
  for (let i = 0; i < 3; i += 1) {
    const next = result.replace(
      /^(?:\p{Extended_Pictographic}(?:\uFE0F)?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F)?)*)\s*/u,
      "",
    );
    if (next === result) break;
    result = next;
  }
  return result;
}

function stripLeadingMojibakeEmoji(text) {
  return String(text).replace(
    /^(?:[\u00F0\u00E2\u00EF][\u0080-\u00FF]{1,6})\s*/u,
    "",
  );
}

function stripLeadingNoise(text) {
  return text.replace(/^[<>=\-\u2022\u00B7/\\|]+\s*/, "");
}

function stripReplacementChars(text) {
  return String(text).replace(/[\uFFFD\uFFFE\uFFFF]+/g, "");
}

function stripLeadingCorruption(text) {
  let result = String(text);
  for (let i = 0; i < 8; i += 1) {
    const next = result
      .replace(/^\?+\s*/g, "")
      .replace(/^[\u0080-\u00BF]{1,4}\s*/g, "")
      .replace(/^[\u00C0-\u00FF]{1,4}\s*/g, "");
    if (next === result) break;
    result = next;
  }
  return result;
}

function scrubNewsBody(text) {
  return String(text)
    .replace(/^\?+\s*/g, "")
    .replace(/\s+\?\s+(?=Net Gold)/gi, " — ")
    .replace(/[\uFFFD\uFFFE\uFFFF]+/g, "")
    .trim();
}

const DEFAULT_NEWS_EMOJI = "📋";

function normalizeNewsText(value, repairFn) {
  let text = String(value ?? "");
  if (typeof repairFn === "function") {
    text = repairFn(text);
  }
  if (!text) return "";

  for (let pass = 0; pass < 8; pass += 1) {
    const prev = text;
    text = stripLeadingEmoji(text);
    text = stripLeadingMojibakeEmoji(text);
    text = stripLeadingCorruption(text);
    text = stripReplacementChars(text);
    text = stripLeadingNoise(text);
    text = text.trimStart();
    if (typeof repairFn === "function") {
      text = repairFn(text);
    }
    if (text === prev) break;
  }

  return scrubNewsBody(text);
}

function matchNewsRule(text) {
  for (const rule of NEWS_EMOJI_RULES) {
    if (rule.pattern.test(text)) {
      return { emoji: rule.emoji, text };
    }
  }

  let probe = text;
  for (let i = 0; i < 32 && probe.length > 3; i += 1) {
    probe = probe.slice(1).trimStart();
    for (const rule of NEWS_EMOJI_RULES) {
      if (rule.pattern.test(probe)) {
        return { emoji: rule.emoji, text: probe };
      }
    }
  }

  return null;
}

function formatNewsMessage(value, repairFn) {
  if (value === null || value === undefined) {
    return { emoji: DEFAULT_NEWS_EMOJI, text: "" };
  }

  const cleaned = normalizeNewsText(value, repairFn);
  if (!cleaned) {
    return { emoji: DEFAULT_NEWS_EMOJI, text: "" };
  }

  const matched = matchNewsRule(cleaned);
  if (matched) {
    return {
      emoji: matched.emoji || DEFAULT_NEWS_EMOJI,
      text: scrubNewsBody(matched.text),
    };
  }

  return { emoji: DEFAULT_NEWS_EMOJI, text: cleaned };
}

function decorateNewsMessage(value, repairFn) {
  const { text } = formatNewsMessage(value, repairFn);
  return text || "";
}

function getNewsMeta(type) {
  return NEWS_META[type] || NEWS_META.system;
}

// ESM exports for client (Vite / browser)
export {
  NEWS_META,
  NEWS_EMOJI_RULES,
  decorateNewsMessage,
  formatNewsMessage,
  getNewsMeta,
};

export default {
  NEWS_META,
  NEWS_EMOJI_RULES,
  decorateNewsMessage,
  formatNewsMessage,
  getNewsMeta,
};
