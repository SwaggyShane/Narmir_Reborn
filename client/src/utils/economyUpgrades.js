export const FARM_UPGRADES = {
  irrigated: {
    name: 'Irrigated Farm',
    cost: 25000,
    costWood: 20,
    costStone: 0,
    costIron: 0,
    yieldBonus: 0.15,
    requires: null,
  },
  iron_plows: {
    name: 'Iron Plows',
    cost: 75000,
    costWood: 0,
    costStone: 0,
    costIron: 50,
    workerReduction: 2,
    requires: null,
  },
  plantation: {
    name: 'Plantation',
    cost: 150000,
    costWood: 0,
    costStone: 40,
    costIron: 80,
    yieldBonus: 0.3,
    requires: 'irrigated',
  },
};

export const GRANARY_UPGRADES = {
  silos: {
    name: 'Tall Silos',
    cost: 25000,
    costWood: 30,
    costStone: 0,
    costIron: 0,
    desc: '+50% Storage capacity per Granary',
    requires: null,
  },
  preservation: {
    name: 'Salt Curing',
    cost: 75000,
    costWood: 60,
    costStone: 0,
    costIron: 0,
    desc: 'Lowers food degradation by 30%',
    requires: 'silos',
  },
  segregation: {
    name: 'Segregated Vaults',
    cost: 150000,
    costWood: 80,
    costStone: 0,
    costIron: 50,
    desc: 'Secures a portion of food immune to Blight',
    requires: 'preservation',
  },
};

export const MARKET_UPGRADES = {
  trading_post: {
    name: 'Trading Post',
    cost: 5000,
    costWood: 0,
    costStone: 0,
    costIron: 10,
    unlocksTrade: true,
    requires: null,
  },
  bazaar: {
    name: 'Bazaar',
    cost: 50000,
    costWood: 0,
    costStone: 0,
    costIron: 70,
    incomeBonus: 0.5,
    requires: 'trading_post',
  },
  black_market: {
    name: 'Black Market',
    cost: 15000,
    costWood: 0,
    costStone: 0,
    costIron: 30,
    raceOnly: 'dark_elf',
    requires: 'trading_post',
  },
};

export const TAVERN_UPGRADES = {
  inn: {
    name: 'Inn',
    cost: 8000,
    costWood: 10,
    costStone: 0,
    costIron: 0,
    unlocksMercTier: 'sellsword',
    requires: null,
  },
  guild_hall: {
    name: 'Guild Hall',
    cost: 30000,
    costWood: 20,
    costStone: 0,
    costIron: 30,
    unlocksMercTier: 'veteran',
    requires: 'inn',
  },
};
