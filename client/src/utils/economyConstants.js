export const FARM_WORKERS_PER = {
  human: 10,
  dwarf: 8,
  high_elf: 12,
  orc: 15,
  dark_elf: 10,
  dire_wolf: 12,
  vampire: 2,
};

export const COMMODITY_VALUES = {
  food: 2,
  weapons: 6,
  armor: 8,
  mana: 4,
  maps: 50,
  scrolls: 200,
  blueprints: 150,
  war_machines: 500,
  ballistae: 500,
  land: 2000,
};

export const COMMODITY_RACE_DISCOUNT = {
  dwarf: { weapons: 0.85, armor: 0.85 },
  high_elf: { scrolls: 0.8, mana: 0.85 },
  dark_elf: { _all: 0.9 },
  orc: { food: 1.2 },
  dire_wolf: { maps: 0.8 },
  vampire: { food: 0.8 },
  human: {},
};
