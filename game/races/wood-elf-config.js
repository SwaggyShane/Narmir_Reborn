/**
 * Wood Elf Race Configuration
 * Exploration specialists with unmatched wilderness navigation
 * Weakness: Poor at direct combat
 */

const WOOD_ELF_CONFIG = {
  id: 'wood_elf',
  name: 'Wood Elf',
  title: 'Wood Elf — Master Explorers',
  icon: '🌲',
  color: '#22c55e',

  lore: `Wood Elves are nomadic forest dwellers with an unmatched ability to read terrain, navigate wilderness, and discover hidden lands. Their tracking skills and intimate knowledge of nature allow them to find more land with fewer resources and less time. However, their preference for subterfuge and scouting makes them weak in direct combat—they are scouts, not soldiers.`,

  description: `Unparalleled wilderness navigators. Wood Elves discover +75% more land per expedition, at -40% cost and -40% time. But they struggle in direct combat (-25% damage).`,

  strengths: {
    description: 'Exploration Masters',
    list: [
      '+75% land discovered per expedition',
      '-40% expedition resource cost',
      '-40% expedition completion time',
      'Fastest way to expand territory'
    ]
  },

  weaknesses: {
    description: 'Poor Warriors',
    list: [
      'Combat troops deal 25% less damage',
      'Rely on tactics and territory, not strength',
      'Vulnerable to direct military assault'
    ]
  },

  mechanics: {
    landBonus: 0.75, // +75% land per expedition
    costReduction: 0.40, // -40% expedition cost
    timeReduction: 0.40, // -40% expedition time
    combatPenalty: 0.25, // -25% attack damage
  },

  playstyle: 'Territorial expansion through superior exploration. Discover land others cannot reach. Use territory control and defensive positioning to compensate for weaker combat. Prioritize land acquisition and economy over military conquest.',

  recommendations: [
    'Send frequent expeditions—they\'re your advantage',
    'Expand territory widely to control resources',
    'Build economy to defend against aggressive neighbors',
    'Use terrain and positioning strategically',
    'Avoid direct confrontations with military powerhouses'
  ]
};

module.exports = WOOD_ELF_CONFIG;
