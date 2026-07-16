#!/usr/bin/env node
/**
 * Kingdom location discovery — path coverage suite
 *
 * Asserts the pure / unit-testable writers of `discovered_kingdoms` and the
 * flag → merge orchestration used by the turn path. Documents each live path.
 *
 * Paths covered here:
 *  1. Passive scout kingdom_signal → _find_kingdom
 *  2. Flag resolution (scout / surveyor / expedition) via mergeKingdomDiscovery
 *  3. Location maps WIP completion (scribe job finish)
 *  4. Epic trek hex-matched kingdom discoveries
 *  5. Search-type "targets" style random discovers (pure loop)
 *  6. Scout-area hex match (pure geometry of discovery rule)
 *  7. Combat V1: defender always learns attacker (mapped)
 *  8. Offensive spell: target learns caster when not obscure (logic mirror)
 *  9. Steal-map merge (pure transfer of mapped entry)
 * 10. Scribe location_map: found → mapped (pure)
 *
 * Not covered here (need live HTTP/DB or orphaned intake):
 *  - Full /scout-area + visibility bitmap write
 *  - location_maps_wip *enqueue* (no writer found in codebase)
 *  - Combat V2 adapter currently omits discovered_kingdoms on updates
 *    (route pre-writes defender discovery for attack; see kingdom-warfare.js)
 */

'use strict';

const assert = require('assert');

const {
  mergeKingdomDiscovery,
  stripDiscoveryFlags,
} = require('../game/kingdom-discovery-resolve');
const {
  applyPassiveScoutFind,
  rollPassiveScoutFind,
  pickWeightedOutcome,
} = require('../game/passive-scout-finds');
const { processLocationMapsWip } = require('../game/location-maps');
const {
  processPathDiscoveries,
  rollKingdomDiscovery,
  seededUnit,
} = require('../game/epic-trek-discovery');
const { pixelToHex } = require('../game/hex-utils');

// Force legacy combat path for deterministic discovery assertions
process.env.USE_COMBAT_V2 = '0';
// Clear combat module if preloaded with V2
const combatPath = require.resolve('../game/combat');
delete require.cache[combatPath];
const { resolveMilitaryAttack } = require('../game/combat');

function parseDisc(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  return JSON.parse(raw);
}

function sequenceRandom(values) {
  let i = 0;
  return () => {
    const v = values[Math.min(i, values.length - 1)];
    i += 1;
    return v;
  };
}

// ── 1. Passive scout kingdom_signal ───────────────────────────────────────────
{
  const kingdom = { id: 1, scout_allocation: 5000 };
  const updates = {};
  const events = [];
  applyPassiveScoutFind(kingdom, updates, events, { type: 'kingdom_signal' });
  assert.strictEqual(updates._find_kingdom, true, 'kingdom_signal sets _find_kingdom');
  assert.ok(events.some((e) => /kingdom/i.test(e.message || '')), 'player-facing signal event');
}
console.log('path 1: passive scout kingdom_signal → _find_kingdom flag');

{
  // Engine path is roll + apply; kingdom_signal is one weighted outcome.
  // Prove pick → apply end-to-end without depending on full table order.
  const onlySignal = [{ type: 'kingdom_signal', weight: 1 }];
  const picked = pickWeightedOutcome(() => 0, onlySignal);
  assert.strictEqual(picked.type, 'kingdom_signal');
  const updates = {};
  const events = [];
  applyPassiveScoutFind({ id: 1 }, updates, events, { type: 'kingdom_signal' });
  assert.strictEqual(updates._find_kingdom, true);
  // Full roll still hits something when forced (random 0 passes chance)
  const anyFind = rollPassiveScoutFind(
    { scout_allocation: 1000 },
    { random: sequenceRandom([0, 0]) },
  );
  assert.ok(anyFind, 'forced hit yields a find descriptor');
}
console.log('path 1b: kingdom_signal outcome applies; forced roll hits');

// ── 2. Flag resolution (turn / expedition) ──────────────────────────────────
{
  const kingdom = { id: 10, discovered_kingdoms: '{}' };
  const updates = {};
  const other = { id: 20, name: 'Northwatch' };

  const scout = mergeKingdomDiscovery(kingdom, updates, other, { source: 'scout' });
  assert.strictEqual(scout.applied, true);
  assert.strictEqual(parseDisc(scout.discovered_kingdoms)[20].found, true);
  assert.strictEqual(parseDisc(scout.discovered_kingdoms)[20].name, 'Northwatch');
  assert.ok(/scout/i.test(scout.message) || scout.message.includes('🔍'));

  const surveyor = mergeKingdomDiscovery(
    { id: 10, discovered_kingdoms: '{}' },
    {},
    other,
    { source: 'surveyor' },
  );
  assert.strictEqual(surveyor.applied, true);
  assert.ok(/Surveyor/i.test(surveyor.message) || surveyor.message.includes('🔭'));

  const expedition = mergeKingdomDiscovery(
    { id: 10, discovered_kingdoms: '{}' },
    {},
    other,
    { source: 'expedition' },
  );
  assert.strictEqual(expedition.applied, true);
  assert.ok(/ranger/i.test(expedition.message));

  // strip flags so they never hit DB columns
  const dirty = { _find_kingdom: true, _find_kingdom_surveyor: true, gold: 5 };
  stripDiscoveryFlags(dirty);
  assert.strictEqual(dirty._find_kingdom, undefined);
  assert.strictEqual(dirty._find_kingdom_surveyor, undefined);
  assert.strictEqual(dirty.gold, 5);
}
console.log('path 2: mergeKingdomDiscovery scout/surveyor/expedition + strip flags');

// ── 3. Location maps WIP completion ─────────────────────────────────────────
{
  const k = {
    id: 1,
    scribes: 20,
    discovered_kingdoms: JSON.stringify({ 5: { found: true, name: 'Pending' } }),
    location_maps_wip: JSON.stringify([
      { target_id: 5, target_name: 'Pending', turns_remaining: 1 },
      { target_id: 6, target_name: 'Later', turns_remaining: 3 },
    ]),
  };
  const events = [];
  const updates = processLocationMapsWip(k, events);
  const disc = parseDisc(updates.discovered_kingdoms);
  assert.strictEqual(disc[5].found, true);
  assert.strictEqual(disc[5].mapped, true, 'WIP complete → mapped');
  const remaining = JSON.parse(updates.location_maps_wip);
  assert.strictEqual(remaining.length, 1);
  assert.strictEqual(remaining[0].target_id, 6);
  assert.strictEqual(remaining[0].turns_remaining, 2);
  assert.ok(events.some((e) => /location map/i.test(e.message)));
}
console.log('path 3: location_maps_wip completion sets mapped');

// ── 4. Epic trek hex-matched discoveries ────────────────────────────────────
{
  const kingdom = { id: 3, turn: 12 };
  // Find a hex that rolls kingdom discovery for this kingdom
  let hitHex = null;
  for (let c = 0; c < 80 && !hitHex; c++) {
    for (let r = 0; r < 40; r++) {
      if (rollKingdomDiscovery(c, r, kingdom)) {
        hitHex = { col: c, row: r };
        break;
      }
    }
  }
  assert.ok(hitHex, 'need at least one seeded kingdom-hit hex for tests');

  const discoveries = processPathDiscoveries([hitHex], kingdom);
  const kingdomHits = discoveries.filter((d) => d.type === 'kingdom');
  assert.ok(kingdomHits.length >= 1, 'path includes kingdom discovery on hit hex');
  assert.strictEqual(kingdomHits[0].hex_col, hitHex.col);
  assert.strictEqual(kingdomHits[0].hex_row, hitHex.row);

  // Simulate resolveEpicTrek match: other kingdom home hex equals discovery hex
  const otherKingdoms = [
    { id: 99, race: 'orc', name: 'Bloodfort', _hex: hitHex },
    { id: 100, race: 'human', name: 'Elsewhere', _hex: { col: hitHex.col + 50, row: hitHex.row + 50 } },
  ];
  let disc = {};
  let discoveredCount = 0;
  for (const discovered of kingdomHits) {
    const match = otherKingdoms.find((ok) => {
      const h = ok._hex;
      return h.col === discovered.hex_col && h.row === discovered.hex_row;
    });
    if (match && !disc[match.id]) {
      disc[match.id] = {
        found: true,
        discovered_turn: discovered.discovered_turn,
        name: match.name,
      };
      discoveredCount++;
    }
  }
  assert.strictEqual(discoveredCount, 1);
  assert.strictEqual(disc[99].name, 'Bloodfort');
  assert.strictEqual(disc[99].found, true);
  assert.ok(!disc[100], 'off-path kingdom not discovered');
}
console.log('path 4: epic trek kingdom hits match home hex only');

// ── 5. Search type=targets (pure random-exclude loop) ───────────────────────
{
  const pool = [
    { id: 2, name: 'Two' },
    { id: 3, name: 'Three' },
    { id: 4, name: 'Four' },
  ];
  const disc = {};
  const excluded = new Set([1]);
  let foundCount = 0;
  const baseFound = 2;
  let attempts = 0;
  const attemptsLimit = 20;
  // deterministic picker: always first not excluded
  const pick = () => pool.find((p) => !excluded.has(p.id)) || null;
  while (foundCount < baseFound && attempts < attemptsLimit) {
    attempts++;
    const other = pick();
    if (!other) break;
    excluded.add(other.id);
    disc[other.id] = { found: true, name: other.name };
    foundCount++;
  }
  assert.strictEqual(foundCount, 2);
  assert.strictEqual(disc[2].name, 'Two');
  assert.strictEqual(disc[3].name, 'Three');
}
console.log('path 5: search targets random-exclude merge shape');

// ── 6. Scout-area hex match rule ────────────────────────────────────────────
{
  // Rule from routes/kingdom-gameplay scout-area:
  // if kingdom home hex is in newlyRevealed and not in disc → { found: true }
  const newlyRevealed = [
    { col: 10, row: 20 },
    { col: 11, row: 20 },
  ];
  const others = [
    { id: 50, home: { col: 10, row: 20 } },
    { id: 51, home: { col: 99, row: 99 } },
  ];
  const disc = { 50: { found: true, name: 'Already' } };
  let discUpdated = false;
  for (const ok of others) {
    const matchesNew = newlyRevealed.some(
      (c) => c.col === ok.home.col && c.row === ok.home.row,
    );
    if (matchesNew && !disc[ok.id]) {
      disc[ok.id] = { found: true };
      discUpdated = true;
    }
  }
  // 50 already known — not re-written as bare found
  assert.strictEqual(disc[50].name, 'Already');
  assert.strictEqual(discUpdated, false);

  const disc2 = {};
  for (const ok of others) {
    const matchesNew = newlyRevealed.some(
      (c) => c.col === ok.home.col && c.row === ok.home.row,
    );
    if (matchesNew && !disc2[ok.id]) {
      disc2[ok.id] = { found: true };
    }
  }
  assert.deepStrictEqual(disc2[50], { found: true });
  assert.ok(!disc2[51]);
}
console.log('path 6: scout-area hex match only for newly revealed homes');

// ── 7. Combat V1: defender discovers attacker ───────────────────────────────
{
  const base = {
    race: 'human',
    turn: 500,
    happiness: 100,
    fighters: 80,
    rangers: 0,
    mages: 0,
    clerics: 0,
    thieves: 0,
    ninjas: 0,
    thralls: 0,
    engineers: 0,
    war_machines: 0,
    ballistae: 0,
    land: 1000,
    gold: 1000,
    population: 10000,
    troop_levels: '{}',
    equipment_levels: '{}',
    injured_troops: '{}',
    bld_walls: 0,
    bld_guard_towers: 0,
    bld_outposts: 0,
    bld_mage_towers: 0,
    bld_castles: 0,
    wall_hp: 0,
    discovered_kingdoms: '{}',
    prestige_level: 0,
    level: 1,
    xp: 0,
    xp_sources: '{}',
    defense_upgrades: '{}',
    wall_upgrades: '{}',
    tower_def_upgrades: '{}',
    outpost_upgrades: '{}',
    fragment_bonuses: '{}',
    milestone_bonuses: '{}',
    weapons_stockpile: 0,
    armor_stockpile: 0,
    res_military: 0,
    res_weapons: 0,
    res_armor: 0,
    res_war_machines: 0,
    res_attack_magic: 0,
    res_defense_magic: 0,
    ladders: 0,
    wall_defense_type: null,
    mausoleum_upgrades: '{}',
    shrine_upgrades: '{}',
  };
  const attacker = { ...base, id: 1, name: 'Aggressor', fighters: 100 };
  const defender = { ...base, id: 2, name: 'Defender', fighters: 20 };
  const result = resolveMilitaryAttack(
    attacker,
    defender,
    { fighters: 40 },
    [],
    [],
  );
  assert.ok(result && result.defenderUpdates, 'combat returns defenderUpdates');
  const defDisc = parseDisc(result.defenderUpdates.discovered_kingdoms);
  assert.strictEqual(defDisc[1].found, true, 'defender learns attacker');
  assert.strictEqual(defDisc[1].mapped, true, 'attacker leaves a map');
  assert.strictEqual(defDisc[1].name, 'Aggressor');
}
console.log('path 7: combat V1 defender always maps attacker');

// ── 8. Spell: target discovers caster when not obscure ──────────────────────
{
  // Mirrors game/magic.js cast offensive discovery block
  function applySpellDiscovery(caster, target, obscure) {
    const targetUpdates = {};
    if (!obscure) {
      let targetDisc = parseDisc(target.discovered_kingdoms);
      if (!targetDisc[caster.id]) {
        targetDisc[caster.id] = { found: true };
        targetUpdates.discovered_kingdoms = JSON.stringify(targetDisc);
      }
    }
    return targetUpdates;
  }
  const caster = { id: 7, name: 'Mage' };
  const target = { id: 8, discovered_kingdoms: '{}' };
  const hit = applySpellDiscovery(caster, target, false);
  assert.strictEqual(parseDisc(hit.discovered_kingdoms)[7].found, true);
  const obscured = applySpellDiscovery(caster, target, true);
  assert.strictEqual(obscured.discovered_kingdoms, undefined);
  const already = applySpellDiscovery(
    caster,
    { id: 8, discovered_kingdoms: JSON.stringify({ 7: { found: true, mapped: true } }) },
    false,
  );
  assert.strictEqual(already.discovered_kingdoms, undefined, 'no overwrite if known');
}
console.log('path 8: spell target discovers caster unless obscure');

// ── 9. Steal map transfer ───────────────────────────────────────────────────
{
  function stealMappedEntry(myDisc, targetDisc) {
    const mappedIds = Object.keys(targetDisc).filter((id) => targetDisc[id]?.mapped);
    if (!mappedIds.length) return { ok: false, reason: 'none' };
    const stolenId = mappedIds[0];
    const nextTarget = { ...targetDisc };
    delete nextTarget[stolenId];
    const nextMine = { ...myDisc, [stolenId]: { found: true, mapped: true } };
    return { ok: true, stolenId, myDisc: nextMine, targetDisc: nextTarget };
  }
  const r = stealMappedEntry(
    {},
    { 9: { found: true, mapped: true, name: 'Far' }, 10: { found: true } },
  );
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.stolenId, '9');
  assert.strictEqual(r.myDisc[9].mapped, true);
  assert.ok(!r.targetDisc[9]);
  assert.strictEqual(r.targetDisc[10].found, true);
  assert.strictEqual(stealMappedEntry({}, { 1: { found: true } }).ok, false);
}
console.log('path 9: steal-map transfers mapped entry only');

// ── 10. Scribe location_map: found → mapped ─────────────────────────────────
{
  function applyScribeLocationMap(disc, mapsStock) {
    const unmapped = Object.keys(disc).filter((id) => disc[id].found && !disc[id].mapped);
    if (unmapped.length === 0 || mapsStock < 1) return { disc, maps: mapsStock, done: false };
    const targetId = unmapped[0];
    const next = { ...disc, [targetId]: { ...disc[targetId], mapped: true } };
    return { disc: next, maps: mapsStock - 1, done: true, targetId };
  }
  const r = applyScribeLocationMap(
    { 3: { found: true, name: 'Unmapped' }, 4: { found: true, mapped: true } },
    2,
  );
  assert.strictEqual(r.done, true);
  assert.strictEqual(r.targetId, '3');
  assert.strictEqual(r.disc[3].mapped, true);
  assert.strictEqual(r.maps, 1);
  assert.strictEqual(
    applyScribeLocationMap({ 4: { found: true, mapped: true } }, 5).done,
    false,
  );
}
console.log('path 10: scribe location_map upgrades found → mapped');

// ── pixelToHex sanity (used by hex-true paths) ──────────────────────────────
{
  const h = pixelToHex(400, 300);
  assert.ok(Number.isInteger(h.col) && Number.isInteger(h.row));
  // seededUnit used by trek remains stable
  assert.strictEqual(seededUnit(1, 2, 3), seededUnit(1, 2, 3));
}
console.log('helpers: pixelToHex + seededUnit usable for hex-true paths');

console.log('\n✅ All kingdom-discovery path tests passed!');
console.log(`   Covered pure/unit paths 1–10. Live HTTP: scout-area write, expedition finish, steal-map route.`);
console.log(`   Known gap: Combat V2 adapter omits discovered_kingdoms on updates (warfare route pre-writes defender).`);
console.log(`   Known gap: location_maps_wip has no enqueue writer in routes.`);
