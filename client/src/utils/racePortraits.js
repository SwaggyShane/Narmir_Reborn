const GENDER_RACE_PORTRAITS = {
  high_elf: { male: '/race/high_elf_male.webp', female: '/race/high_elf_female.webp' },
  dwarf: { male: '/race/dwarf_male.webp', female: '/race/dwarf_female.webp' },
  human: { male: '/race/human_male.webp', female: '/race/human_female.webp' },
  orc: { male: '/race/orc_male.webp', female: '/race/orc_female.webp' },
  dark_elf: { male: '/race/dark_elf_male.webp', female: '/race/dark_elf_female.webp' },
  dire_wolf: { male: '/race/dire_wolf_male.webp', female: '/race/dire_wolf_female.webp' },
  vampire: { male: '/race/vampire_male.webp', female: '/race/vampire_female.webp' },
  ogre: { male: '/race/ogre_male.webp', female: '/race/ogre_female.webp' },
  wood_elf: { male: '/race/wood_elf_male.webp', female: '/race/wood_elf_female.webp' },
};

export function getRacePortrait(race, gender = 'male') {
  const genderVariant = GENDER_RACE_PORTRAITS[race]?.[gender] || GENDER_RACE_PORTRAITS[race]?.male || '';
  return genderVariant;
}

export default GENDER_RACE_PORTRAITS;
