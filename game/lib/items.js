// Inventory item helpers — shared between economy (resource yield) and
// exploration (expedition rewards). Both modules add items to a kingdom's
// items array, and both need the four elemental fragments to exist as
// stub entries.

const { ELEMENTAL_FRAGMENTS } = require("../config");

function addItemToInventory(itemsArray, id, name, qty = 1) {
  const existing = itemsArray.find((i) => i.id === id);
  if (existing) {
    existing.qty = (existing.qty || 0) + qty;
  } else {
    itemsArray.push({ id, name, qty });
  }
}

// Returns a fresh array with the four elemental fragments guaranteed present.
// Callers may append more items; the array is detached from the input so
// downstream mutations don't leak.
function initItemsArray(existing) {
  const arr = Array.isArray(existing) ? [...existing] : [];
  for (const frag of ELEMENTAL_FRAGMENTS) {
    if (!arr.find((i) => i.id === frag.id)) {
      arr.push({ id: frag.id, name: frag.name, qty: 0 });
    }
  }
  return arr;
}

module.exports = { addItemToInventory, initItemsArray };
