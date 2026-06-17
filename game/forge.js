/**
 * Forge System
 * Handles construction tool forging
 */

const { TOOL_COL, TOOL_GOLD_COST } = require('./config');

function forgeTools(k, toolType, quantity) {
  const cost = TOOL_GOLD_COST[toolType];
  const col = TOOL_COL[toolType];
  if (!cost || !col) return { error: "Unknown tool type" };
  const qty = Math.floor(Number(quantity));
  if (isNaN(qty) || qty <= 0) return { error: "Invalid quantity" };
  quantity = qty;
  const totalCost = cost * quantity;
  if (totalCost > k.gold)
    return {
      error: `Need ${totalCost.toLocaleString()} gold but only have ${k.gold.toLocaleString()} gold`,
    };
  return {
    updates: {
      [col]: (k[col] || 0) + quantity,
      gold: k.gold - totalCost,
      updated_at: Math.floor(Date.now() / 1000),
    },
    totalCost,
  };
}
module.exports = {
  forgeTools,
};
