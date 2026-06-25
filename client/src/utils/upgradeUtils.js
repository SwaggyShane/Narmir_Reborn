export function parseOwnedUpgrades(value) {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

export function normalizeMutationUpdates(updates) {
  if (!updates || typeof updates !== 'object') return updates;
  const next = { ...updates };
  for (const [key, value] of Object.entries(next)) {
    if (key.endsWith('_upgrades')) {
      next[key] = parseOwnedUpgrades(value);
    }
  }
  return next;
}

export function ownedFromUpdates(updates, category) {
  if (!updates || !category) return null;
  const col = `${category}_upgrades`;
  if (updates[col] === undefined) return null;
  return parseOwnedUpgrades(updates[col]);
}