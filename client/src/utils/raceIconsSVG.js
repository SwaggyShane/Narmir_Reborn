// Custom SVG icons for each race
export const RACE_ICONS_SVG = {
  human: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="6" r="3.5" fill="currentColor"/>
    <path d="M 8 10 L 6 14 L 8 20 L 10 16 L 12 18 L 14 16 L 16 20 L 18 14 L 16 10 Q 12 9 8 10" fill="currentColor"/>
  </svg>`,

  orc: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M 6 8 L 4 5 L 8 4 L 10 6 L 12 3 L 14 6 L 16 4 L 20 5 L 18 8 L 16 12 L 18 20 L 12 18 L 6 20 L 8 12 Z" fill="currentColor" stroke="currentColor" stroke-width="0.5"/>
  </svg>`,

  dwarf: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <rect x="10" y="2" width="4" height="8" fill="currentColor"/>
    <circle cx="12" cy="12" r="2.5" fill="currentColor"/>
    <polygon points="8,15 16,15 15,24 9,24" fill="currentColor"/>
  </svg>`,

  dark_elf: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <polygon points="12,2 14,8 18,8 15,12 17,18 12,14 7,18 9,12 6,8 10,8" fill="currentColor"/>
    <circle cx="12" cy="15" r="1.5" fill="currentColor"/>
  </svg>`,

  vampire: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="8" r="3" fill="currentColor"/>
    <path d="M 9 11 L 7 16 Q 7 20 12 22 Q 17 20 17 16 L 15 11 Z" fill="currentColor"/>
    <circle cx="10" cy="8" r="0.8" fill="white" opacity="0.7"/>
    <circle cx="14" cy="8" r="0.8" fill="white" opacity="0.7"/>
  </svg>`,

  dire_wolf: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M 6 10 L 5 8 L 8 7 L 10 9 L 12 7 L 14 9 L 16 7 L 19 8 L 18 10 L 16 11 L 14 14 L 12 13 L 10 14 L 8 11 Z" fill="currentColor"/>
    <polygon points="12,14 11,18 12,21 13,18" fill="currentColor"/>
  </svg>`,

  high_elf: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <polygon points="12,2 14,6 18,6 15,9 16,14 12,11 8,14 9,9 6,6 10,6" fill="currentColor"/>
    <circle cx="12" cy="18" r="2" fill="currentColor"/>
    <path d="M 10 20 L 10 24 M 14 20 L 14 24" stroke="currentColor" stroke-width="1.5"/>
  </svg>`,

  wood_elf: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <polygon points="12,2 9,8 6,14 8,20 12,22 16,20 18,14 15,8" fill="currentColor"/>
    <path d="M 10 10 Q 12 12 14 10" stroke="currentColor" stroke-width="1" fill="none"/>
    <path d="M 10 15 Q 12 17 14 15" stroke="currentColor" stroke-width="1" fill="none"/>
  </svg>`,

  ogre: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <rect x="9" y="14" width="6" height="8" rx="1" fill="currentColor"/>
    <ellipse cx="12" cy="10" rx="4" ry="5" fill="currentColor"/>
    <circle cx="10" cy="7" r="1.5" fill="currentColor"/>
    <circle cx="14" cy="7" r="1.5" fill="currentColor"/>
    <circle cx="8" cy="10" r="1.2" fill="currentColor"/>
    <circle cx="16" cy="10" r="1.2" fill="currentColor"/>
    <circle cx="12" cy="4" r="1" fill="currentColor"/>
  </svg>`,
};

export function getRaceSVGIcon(race) {
  return RACE_ICONS_SVG[race] || null;
}
