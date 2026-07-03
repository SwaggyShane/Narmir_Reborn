// game/scout-economy.js
// Scouting and exploration economy balance tuning

// TUNING NOTES:
// These values are placeholders. Adjust after playtesting to achieve:
// - ~500 turns for a casual player to explore entire map
// - Fog feels strategic (reveals reward curiosity) not tedious (grindy)
// - Ranger/food costs create meaningful trade-offs
// - Spell debuff creates interesting combat risk/reward

const SCOUT_ECONOMY = {
  // Vision baseline: how many hexes can a kingdom see without active scouting?
  // LOCKED: Home hex only (strict fog everywhere else)
  baselineVisibilityRadius: 0, // only the kingdom's own hex is visible; all else is fogged

  // Spell debuff: fog_of_war spell reduces visibility to this many hexes
  // Creates a combat decision: "Do I blind them for 3 turns?"
  debuffRadius: 0, // (0 = total blind; TBD)

  // Exploration costs per hex scouted
  // Rangers are the scout unit; food is consumed per action
  rangerCostPerHex: 10, // (TBD: how many rangers per hex?)
  foodCostPerHex: 50, // (TBD: food spent per hex)

  // Scaling: how does visibility radius grow with ranger count?
  // Linear: 1 ranger = 1 hex, 10 rangers = 10 hexes
  // Diminishing: curves off (more realistic, strategic cap)
  // (TBD: select + tune the formula)
  scalingCurve: 'linear', // Options: 'linear', 'diminishing', 'exponential'
  scalingFactor: 1, // hex-units per ranger (for linear)

  // Expedition reveal mechanics: how does an active expedition reveal the map?
  // 'ahead': reveals hexes in front of the army (pre-move scouting)
  // 'route': reveals every hex along the path
  // 'current': reveals current hex + immediate neighbors
  // (TBD: choose based on desired exploration pacing)
  expeditionRevealMode: 'ahead', // Options: 'ahead', 'route', 'current'

  // Depth penalty: how much harder is it to scout far from home?
  // (TBD: e.g., "costs scale by distance", "reveal radius shrinks with distance")
  depthScaling: 'linear', // (TBD: 'linear', 'quadratic', 'none')

  // Node discovery: how many turns to send a scouted node's population?
  // (TBD: distance * multiplier?)
  nodeDeliveryTurnsPerHex: 1, // turns per hex distance
};

module.exports = {
  SCOUT_ECONOMY,
};
