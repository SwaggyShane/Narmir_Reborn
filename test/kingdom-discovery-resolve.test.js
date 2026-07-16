'use strict';

const assert = require('assert');
const {
  mergeKingdomDiscovery,
  stripDiscoveryFlags,
} = require('../game/kingdom-discovery-resolve');

// ── no other kingdom ────────────────────────────────────────────────────────
{
  const r = mergeKingdomDiscovery({ id: 1, discovered_kingdoms: '{}' }, {}, null);
  assert.strictEqual(r.applied, false);
}
console.log('mergeKingdomDiscovery: null other → not applied');

// ── first discovery ─────────────────────────────────────────────────────────
{
  const kingdom = { id: 1, discovered_kingdoms: '{}' };
  const updates = {};
  const r = mergeKingdomDiscovery(kingdom, updates, { id: 99, name: 'Rival' }, { source: 'scout' });
  assert.strictEqual(r.applied, true);
  assert.ok(r.discovered_kingdoms);
  const disc = JSON.parse(r.discovered_kingdoms);
  assert.strictEqual(disc[99].found, true);
  assert.strictEqual(disc[99].name, 'Rival');
  assert.ok(r.message.includes('Rival'));
  assert.ok(r.message.includes('scouts') || r.message.includes('🔍'));
}
console.log('mergeKingdomDiscovery: first find persists name + found');

// ── already known ───────────────────────────────────────────────────────────
{
  const kingdom = {
    id: 1,
    discovered_kingdoms: JSON.stringify({ 99: { found: true, name: 'Rival' } }),
  };
  const r = mergeKingdomDiscovery(kingdom, {}, { id: 99, name: 'Rival' }, { source: 'scout' });
  assert.strictEqual(r.applied, false);
  assert.strictEqual(r.alreadyKnown, true);
}
console.log('mergeKingdomDiscovery: already known → not re-applied');

// ── updates.discovered_kingdoms preferred over kingdom ──────────────────────
{
  const kingdom = { id: 1, discovered_kingdoms: '{}' };
  const updates = {
    discovered_kingdoms: JSON.stringify({ 5: { found: true, name: 'A' } }),
  };
  const r = mergeKingdomDiscovery(kingdom, updates, { id: 6, name: 'B' }, { source: 'scout' });
  assert.strictEqual(r.applied, true);
  const disc = JSON.parse(r.discovered_kingdoms);
  assert.ok(disc[5]);
  assert.ok(disc[6]);
}
console.log('mergeKingdomDiscovery: merges onto updates.discovered_kingdoms');

// ── surveyor / expedition message flavors ───────────────────────────────────
{
  const s = mergeKingdomDiscovery({}, {}, { id: 1, name: 'X' }, { source: 'surveyor' });
  assert.ok(s.message.includes('Surveyors'));
  const e = mergeKingdomDiscovery({}, {}, { id: 1, name: 'X' }, { source: 'expedition' });
  assert.ok(e.message.includes('rangers'));
}
console.log('mergeKingdomDiscovery: source flavors');

// ── strip flags ─────────────────────────────────────────────────────────────
{
  const updates = {
    gold: 10,
    _find_kingdom: true,
    _find_kingdom_surveyor: true,
  };
  stripDiscoveryFlags(updates);
  assert.strictEqual(updates.gold, 10);
  assert.strictEqual(updates._find_kingdom, undefined);
  assert.strictEqual(updates._find_kingdom_surveyor, undefined);
}
console.log('stripDiscoveryFlags: removes flag keys only');

console.log('\n✅ All kingdom-discovery-resolve tests passed!');
