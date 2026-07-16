// Client mirror of game/config.js's SCRIBE_ITEMS (server canonical). Keep in
// sync manually if scribe costs/turns change server-side.
export const SCRIBE_ITEMS = {
  map: {
    label: 'Map',
    scribes: 3,
    turns: 10,
    desc: 'Required to interact with another kingdom',
  },
  blueprint: {
    label: 'Blueprint',
    scribes: 5,
    turns: 20,
    desc: 'Required to construct buildings.',
  },
  location_map: {
    label: 'Location Map',
    scribes: 10,
    turns: 5,
    desc: 'Uses 1 map to scribe an unmapped location into a usable map',
  },
  certified_blueprint: {
    label: 'Certified Blueprint',
    scribes: 20,
    turns: 60,
    desc: 'Required for constructing Master Mason Certified structures',
    requiresUpgrade: 'mason_sigil',
  },
  study_fragment: {
    label: 'Study Fragment',
    scribes: 50,
    turns: 200,
    desc: 'Study a World Fragment to determine its potential.',
  },
  hybrid_blueprint: {
    label: 'Hybrid Blueprint',
    scribes: 100,
    turns: 300,
    desc: 'Convert a studied fragment into a Hybrid Blueprint.',
  },
};
