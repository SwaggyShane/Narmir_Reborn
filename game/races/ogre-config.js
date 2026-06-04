/**
 * Ogre Race Configuration
 * Military specialists with brute strength
 * Weakness: Poor at research and magic
 */

const OGRE_CONFIG = {
  id: 'ogre',
  name: 'Ogre',
  title: 'Ogre — Unmatched Warriors',
  icon: '🗡️',
  color: '#8b572a',

  lore: `Ogres are massive, powerful beings of raw strength and primal fury. Known for their towering stature and incredible physique, they excel in combat like no other race. However, their lack of intellectual curiosity makes them poor scholars—research and magic are foreign to their nature. An Ogre kingdom thrives on military dominance and conquest, not academic pursuit.`,

  description: `Brutal warriors with exceptional combat prowess. Ogres field special ogre troops with +25% attack damage. Weak at research (-30%) and magic (-25%), but unbeatable on the battlefield.`,

  strengths: {
    description: 'Military Masters',
    list: [
      'Ogre Warriors deal +25% attack damage',
      'Superior melee combat capabilities',
      'Intimidating military presence'
    ]
  },

  weaknesses: {
    description: 'Intellectual Weakness',
    list: [
      'Research progresses 30% slower',
      'Magic production 25% reduced',
      'Limited by their warrior culture'
    ]
  },

  mechanics: {
    specialUnit: 'ogre_warrior',
    combatBonus: 0.25, // +25% attack damage
    researchPenalty: 0.30, // -30% research speed
    magicPenalty: 0.25, // -25% magic production
  },

  playstyle: 'Aggressive military dominance. Build armies quickly, overwhelm enemies through superior firepower. Accept research/magic limitations as the trade-off for battlefield supremacy.',

  recommendations: [
    'Focus on military buildings: Barracks, War Machines',
    'Prioritize troop recruitment and upgrades',
    'Use magic sparingly—invest in combat instead',
    'Conquer neighbors before they can research counters to your strength'
  ]
};

module.exports = OGRE_CONFIG;
