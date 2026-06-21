export const WALL_UPGRADES_JS = {
  reinforced: {
    name: 'Reinforced Walls',
    cost: 10000,
    desc: '+25% wall strength, -10% land lost per attack',
    requires: null,
  },
  battlements: {
    name: 'Battlements',
    cost: 30000,
    desc: 'Guard towers +20% effectiveness',
    requires: 'reinforced',
  },
  fortress_walls: {
    name: 'Fortress Walls',
    cost: 100000,
    desc: 'War machines on walls deal +50% damage',
    requires: 'battlements',
  },
};

export const TOWER_DEF_UPGRADES_JS = {
  arrow_slits: {
    name: 'Arrow Slits',
    cost: 5000,
    desc: '+20% ranged defense from guard towers',
    requires: null,
  },
  watchtower: {
    name: 'Watchtower',
    cost: 20000,
    desc: 'Detects incoming attacks 1 turn early (news)',
    requires: 'arrow_slits',
  },
  signal_tower: {
    name: 'Signal Tower',
    cost: 50000,
    desc: 'Attack warning shared with alliance members',
    requires: 'watchtower',
  },
};

export const OUTPOST_UPGRADES_JS = {
  ranger_station: {
    name: 'Ranger Station',
    cost: 5000,
    desc: '+25% ranger patrol effectiveness',
    requires: null,
  },
  forward_camp: {
    name: 'Forward Camp',
    cost: 20000,
    desc: 'Rangers detect incoming expeditions',
    requires: 'ranger_station',
  },
  field_hq: {
    name: 'Field Headquarters',
    cost: 60000,
    desc: 'Expedition rangers return with +10% gold',
    requires: 'forward_camp',
  },
};

export const WALL_RACE_MULT = {
  human: 1.0,
  dwarf: 1.35,
  high_elf: 1.1,
  orc: 0.85,
  dark_elf: 0.9,
  dire_wolf: 0.8,
};

export const TOWER_RACE_MULT = {
  human: 1.0,
  dwarf: 1.0,
  high_elf: 1.1,
  orc: 0.8,
  dark_elf: 1.4,
  dire_wolf: 0.7,
};

export const OUTPOST_RACE_MULT = {
  human: 1.0,
  dwarf: 0.8,
  high_elf: 0.95,
  orc: 0.9,
  dark_elf: 1.3,
  dire_wolf: 1.4,
};
