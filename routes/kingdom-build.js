const express = require('express');
const { requireAuth, requireCsrfToken } = require('./middleware');
const { safeJsonParse } = require('../utils/helpers');
const { validateNonNegativeInteger, validateAllocationObject } = require('../utils/numeric-validation');
const { applyKingdomUpdates } = require('../db/schema');
const engine = require('../game/engine');
const config = require('../game/config');

const router = express.Router();

// Column selection constants (deduplicated)
const KINGDOM_RESOURCE = `id, player_id, name, race, turn, turns_stored, gold, food, population, land, happiness,
  wood, stone, iron, coal, steel, food_shortage_turns,
  bld_farms, bld_granaries, bld_walls, bld_guard_towers, bld_libraries, bld_mage_towers, bld_shrines, bld_vaults,
  bld_barracks, bld_outposts, bld_schools, bld_armories, bld_smithies, bld_markets, bld_training, bld_castles, bld_taverns, bld_mausoleums, bld_housing, bld_woodyard, bld_lumber_camp, bld_sawmill, bld_gravel_pit, bld_blockfield, bld_stone_quarry, bld_open_pit, bld_strip_mine, bld_deep_mine,
  build_queue, build_progress, build_allocation, resource_build_allocation, research_allocation, level, resource_sequence, engineer_level, engineers, ballistae`;

const KINGDOM_SMITHY = 'id, player_id, gold, bld_smithies, hammers_stored, scaffolding_stored';

// Shared helper function (moved from kingdom.js)
async function applyUpdates(db, kingdomId, updates) {
  for (const [key, value] of Object.entries(updates)) {
    if (typeof value === 'number' && (isNaN(value) || !isFinite(value))) {
      console.error(`[applyUpdates] NaN/Infinity detected in field: ${key} = ${value}`);
      throw new Error(`Corrupted numeric data: ${key} contains NaN or Infinity`);
    }
  }

  const updatesForDb = { ...updates };
  if (updatesForDb.troop_levels && typeof updatesForDb.troop_levels === 'object') {
    updatesForDb.troop_levels = JSON.stringify(updatesForDb.troop_levels);
  }
  await applyKingdomUpdates(kingdomId, updatesForDb);
}

module.exports = function (db) {
  // POST /build-queue - Queue building orders
  router.post('/build-queue', requireAuth, requireCsrfToken, async (req, res) => {
    const { orders } = req.body;

    const ordersValidation = validateAllocationObject(orders, {
      maxPerItem: 10000,
      maxTotal: 100000,
      fieldName: 'orders',
    });
    if (!ordersValidation.valid) {
      return res.status(400).json({ error: ordersValidation.error });
    }

    const k = await db.get(`SELECT ${KINGDOM_RESOURCE} FROM kingdoms WHERE player_id = ?`, [
      req.player.playerId,
    ]);
    if (!k) return res.status(404).json({ error: 'Kingdom not found' });
    try {
      k.build_queue = safeJsonParse(k.build_queue, {}, 'auto:build_queue');
    } catch {
      k.build_queue = {};
    }
    const result = engine.queueBuildings(k, ordersValidation.values);
    if (result.error) return res.status(400).json({ error: result.error });
    await applyUpdates(db, k.id, result.updates);
    res.json({
      ok: true,
      queue: JSON.parse(result.updates.build_queue),
      gold: result.updates.gold,
      totalCost: result.totalCost,
      engineers: k.engineers,
    });
  });

  // GET /training-allocation
  router.get('/training-allocation', requireAuth, async (req, res) => {
    const k = await db.get('SELECT training_allocation FROM kingdoms WHERE player_id = ?', [
      req.player.playerId,
    ]);
    if (!k) return res.status(404).json({ error: 'Kingdom not found' });
    const allocation = safeJsonParse(k.training_allocation, {}, 'GET /training-allocation');
    res.json({ allocation });
  });

  // POST /training-allocation
  router.post('/training-allocation', requireAuth, requireCsrfToken, async (req, res) => {
    const { allocation } = req.body;

    const validUnits = ['fighters', 'rangers', 'mages', 'clerics', 'thieves', 'ninjas'];
    const allocValidation = validateAllocationObject(allocation, {
      validKeys: validUnits,
      maxPerItem: 1000000,
      maxTotal: 1000000,
      fieldName: 'allocation',
    });
    if (!allocValidation.valid) {
      return res.status(400).json({ error: allocValidation.error });
    }

    try {
      await db.run('BEGIN TRANSACTION');

      const k = await db.get(
        'SELECT id, bld_training, fighters, rangers, mages, clerics, thieves, ninjas FROM kingdoms WHERE player_id = ? FOR UPDATE',
        [req.player.playerId],
      );
      if (!k) {
        await db.run('ROLLBACK');
        return res.status(404).json({ error: 'Kingdom not found' });
      }

      const capacity = k.bld_training * 100;
      const clean_alloc = allocValidation.values;

      for (const [unit, amount] of Object.entries(clean_alloc)) {
        if (amount > (k[unit] || 0)) {
          await db.run('ROLLBACK');
          return res.status(400).json({ error: `Not enough ${unit}` });
        }
      }
      if (allocValidation.total > capacity) {
        await db.run('ROLLBACK');
        return res.status(400).json({ error: `Exceeds training capacity (${capacity})` });
      }

      await db.run('UPDATE kingdoms SET training_allocation = ? WHERE id = ?', [
        JSON.stringify(clean_alloc),
        k.id,
      ]);

      await db.run('COMMIT');
      res.json({ ok: true });
    } catch (err) {
      try {
        await db.run('ROLLBACK');
      } catch (rollbackErr) {
        console.error('[training-allocation] rollback error:', rollbackErr.message);
      }
      console.error('[training-allocation] error:', err.message);
      res.status(500).json({ error: 'Failed to set training allocation' });
    }
  });

  // POST /build-allocation
  router.post('/build-allocation', requireAuth, requireCsrfToken, async (req, res) => {
    const { allocation } = req.body;

    const allocValidation = validateAllocationObject(allocation, {
      maxPerItem: 10000000,
      maxTotal: 10000000,
      fieldName: 'allocation',
    });
    if (!allocValidation.valid) {
      return res.status(400).json({ error: allocValidation.error });
    }

    try {
      await db.run('BEGIN TRANSACTION');

      const k = await db.get(
        'SELECT id, engineers, resource_build_allocation FROM kingdoms WHERE player_id = ? FOR UPDATE',
        [req.player.playerId],
      );
      if (!k) {
        await db.run('ROLLBACK');
        return res.status(404).json({ error: 'Kingdom not found' });
      }

      const resourceAlloc = safeJsonParse(k.resource_build_allocation, {}, 'build-allocation:resource_build_allocation');
      const resourceTotal = Object.values(resourceAlloc).reduce((s, v) => s + (Number(v) || 0), 0);

      if (allocValidation.total + resourceTotal > k.engineers) {
        await db.run('ROLLBACK');
        return res.status(400).json({
          error: `Allocated ${allocValidation.total.toLocaleString()} build engineers and ${resourceTotal.toLocaleString()} resource engineers, but only have ${k.engineers.toLocaleString()} engineers total`,
        });
      }

      await db.run('UPDATE kingdoms SET build_allocation = ? WHERE id = ?', [
        JSON.stringify(allocValidation.values),
        k.id,
      ]);

      await db.run('COMMIT');
      res.json({ ok: true });
    } catch (err) {
      try {
        await db.run('ROLLBACK');
      } catch (rollbackErr) {
        console.error('[build-allocation] rollback error:', rollbackErr.message);
      }
      console.error('[build-allocation] error:', err.message);
      res.status(500).json({ error: 'Failed to set build allocation' });
    }
  });

  // POST /resource-build-allocation
  router.post('/resource-build-allocation', requireAuth, requireCsrfToken, async (req, res) => {
    const { allocation } = req.body;

    const validResourceBuildings = [
      'woodyard',
      'lumber_camp',
      'sawmill',
      'gravel_pit',
      'blockfield',
      'stone_quarry',
      'open_pit',
      'strip_mine',
      'deep_mine',
    ];
    const allocValidation = validateAllocationObject(allocation, {
      validKeys: validResourceBuildings,
      maxPerItem: 10000000,
      maxTotal: 10000000,
      fieldName: 'allocation',
    });
    if (!allocValidation.valid) {
      return res.status(400).json({ error: allocValidation.error });
    }

    const k = await db.get(
      'SELECT id, engineers, build_allocation FROM kingdoms WHERE player_id = ?',
      [req.player.playerId],
    );
    if (!k) return res.status(404).json({ error: 'Kingdom not found' });

    const buildAlloc = safeJsonParse(k.build_allocation, {}, 'resource-build-allocation:build_allocation');
    const buildTotal = Object.values(buildAlloc).reduce((s, v) => s + (Number(v) || 0), 0);

    if (allocValidation.total + buildTotal > k.engineers)
      return res.status(400).json({
        error: `Allocated ${allocValidation.total.toLocaleString()} resource engineers and ${buildTotal.toLocaleString()} build engineers, but only have ${k.engineers.toLocaleString()} engineers total`,
      });
    await db.run('UPDATE kingdoms SET resource_build_allocation = ? WHERE id = ?', [
      JSON.stringify(allocValidation.values),
      k.id,
    ]);
    res.json({ ok: true });
  });

  // POST /school-allocation
  router.post('/school-allocation', requireAuth, requireCsrfToken, async (req, res) => {
    const { spellbook, school_spellbook } = req.body;

    const spellbookValidation = validateNonNegativeInteger(spellbook, {
      min: 0,
      max: 1000000,
      fieldName: 'spellbook',
    });
    if (!spellbookValidation.valid) {
      return res.status(400).json({ error: spellbookValidation.error });
    }

    const schoolSpellbookValidation = validateNonNegativeInteger(school_spellbook, {
      min: 0,
      max: 1000000,
      fieldName: 'school_spellbook',
    });
    if (!schoolSpellbookValidation.valid) {
      return res.status(400).json({ error: schoolSpellbookValidation.error });
    }

    const k = await db.get(
      'SELECT id, mages, school_of_magic, research_allocation FROM kingdoms WHERE player_id = ?',
      [req.player.playerId],
    );
    if (!k) return res.status(404).json({ error: 'Kingdom not found' });
    if (!k.school_of_magic) return res.status(400).json({ error: 'Must choose a school first' });

    const total = spellbookValidation.value + schoolSpellbookValidation.value;
    if (total > (k.mages || 0))
      return res.status(400).json({
        error: `Allocated ${total.toLocaleString()} mages, but only have ${(k.mages || 0).toLocaleString()} mages`,
      });

    const researchAlloc = safeJsonParse(k.research_allocation, {}, 'school-allocation:research_allocation');
    researchAlloc.spellbook_mages = spellbookValidation.value;
    researchAlloc.school_spellbook_mages = schoolSpellbookValidation.value;

    await db.run('UPDATE kingdoms SET research_allocation = ? WHERE id = ?', [
      JSON.stringify(researchAlloc),
      k.id,
    ]);
    res.json({ ok: true });
  });

  // POST /demolish
  router.post('/demolish', requireAuth, requireCsrfToken, async (req, res) => {
    const { building, amount } = req.body;
    if (!building || typeof building !== 'string') {
      return res.status(400).json({ error: 'Invalid building' });
    }

    const amountValidation = validateNonNegativeInteger(amount, {
      min: 1,
      max: 1000000,
      fieldName: 'amount',
    });
    if (!amountValidation.valid) {
      return res.status(400).json({ error: amountValidation.error });
    }

    try {
      await db.run('BEGIN TRANSACTION');

      const k = await db.get(`SELECT ${KINGDOM_RESOURCE} FROM kingdoms WHERE player_id = ? FOR UPDATE`, [
        req.player.playerId,
      ]);
      if (!k) {
        await db.run('ROLLBACK');
        return res.status(404).json({ error: 'Kingdom not found' });
      }

      const result = engine.demolishBuilding(k, building, amountValidation.value);
      if (result.error) {
        await db.run('ROLLBACK');
        return res.status(400).json({ error: result.error });
      }

      await applyUpdates(db, k.id, result.updates);
      const msg = `🗑️ Demolished ${result.refund.count} ${building.replace(/_/g, ' ')}. Refunded ${result.refund.gold.toLocaleString()} gold and ${result.refund.land} acres.`;
      await db.run('INSERT INTO news (kingdom_id, type, message, turn_num) VALUES (?,?,?,?)', [
        k.id,
        'system',
        msg,
        k.turn,
      ]);

      await db.run('COMMIT');
      res.json({ ok: true, updates: result.updates, message: msg });
    } catch (err) {
      await db.run('ROLLBACK').catch(() => {});
      console.error('[demolish] error:', err.message);
      res.status(500).json({ error: 'Demolish failed' });
    }
  });

  // POST /build
  router.post('/build', requireAuth, requireCsrfToken, async (req, res) => {
    const { building } = req.body;
    if (!building || typeof building !== 'string') {
      return res.status(400).json({ error: 'Invalid building' });
    }

    try {
      await db.run('BEGIN TRANSACTION');

      const k = await db.get(`SELECT ${KINGDOM_RESOURCE} FROM kingdoms WHERE player_id = ? FOR UPDATE`, [
        req.player.playerId,
      ]);
      if (!k) {
        await db.run('ROLLBACK');
        return res.status(404).json({ error: 'Kingdom not found' });
      }

      const buildingId = building.startsWith('bld_') ? building : `bld_${building}`;

      const tier = config.BUILDING_TIERS[buildingId];
      if (!tier) {
        await db.run('ROLLBACK');
        return res.status(400).json({ error: 'Invalid building' });
      }

      const buildTime = engine.calculateBuildTime(k, tier);
      const cost = engine.calculateBuildCost(k, tier);

      if (k.land < cost.land) {
        await db.run('ROLLBACK');
        return res.status(400).json({ error: 'Insufficient land' });
      }
      if (k.wood < cost.wood) {
        await db.run('ROLLBACK');
        return res.status(400).json({ error: 'Insufficient wood' });
      }
      if (k.stone < cost.stone) {
        await db.run('ROLLBACK');
        return res.status(400).json({ error: 'Insufficient stone' });
      }
      if (k.iron < cost.iron) {
        await db.run('ROLLBACK');
        return res.status(400).json({ error: 'Insufficient iron' });
      }

      const buildQueue = safeJsonParse(k.build_queue, {}, 'build:existing_queue');
      const queueId = `${buildingId}_${Date.now()}`;
      buildQueue[queueId] = {
        building: buildingId,
        started_at: k.turn,
        turns_needed: buildTime,
        turns_remaining: buildTime,
        cost,
      };

      const updates = {
        wood: k.wood - cost.wood,
        stone: k.stone - cost.stone,
        iron: k.iron - cost.iron,
        build_queue: JSON.stringify(buildQueue),
      };

      await applyUpdates(db, k.id, updates);
      const msg = `🗑️ Construction started: ${buildingId.replace(/^bld_/, '').replace(/_/g, ' ')}. Estimated completion: ${buildTime} turns.`;
      await db.run('INSERT INTO news (kingdom_id, type, message, turn_num) VALUES (?,?,?,?)', [
        k.id,
        'system',
        msg,
        k.turn,
      ]);

      await db.run('COMMIT');
      res.json({ ok: true, updates, message: msg, buildTime, cost });
    } catch (err) {
      await db.run('ROLLBACK').catch(() => {});
      console.error('[build] error:', err.message);
      res.status(500).json({ error: 'Build failed' });
    }
  });

  // POST /cancel-building
  router.post('/cancel-building', requireAuth, requireCsrfToken, async (req, res) => {
    const { queueId } = req.body;
    if (!queueId || typeof queueId !== 'string') {
      return res.status(400).json({ error: 'Invalid queueId' });
    }

    try {
      await db.run('BEGIN TRANSACTION');

      const k = await db.get(
        'SELECT id, build_queue, land, wood, stone, iron, turn FROM kingdoms WHERE player_id = ? FOR UPDATE',
        [req.player.playerId],
      );
      if (!k) {
        await db.run('ROLLBACK');
        return res.status(404).json({ error: 'Kingdom not found' });
      }

      const buildQueue = safeJsonParse(k.build_queue, {}, 'build:cancel_queue');
      if (!buildQueue[queueId]) {
        await db.run('ROLLBACK');
        return res.status(404).json({ error: 'Building not found in queue' });
      }

      const buildJob = buildQueue[queueId];
      delete buildQueue[queueId];

      const updates = {
        land: k.land + buildJob.cost.land,
        wood: k.wood + buildJob.cost.wood,
        stone: k.stone + buildJob.cost.stone,
        iron: k.iron + buildJob.cost.iron,
        build_queue: JSON.stringify(buildQueue),
      };

      await applyUpdates(db, k.id, updates);
      const msg = `🗑️ Construction cancelled: ${buildJob.building.replace(/_/g, ' ')}. Resources refunded.`;
      await db.run('INSERT INTO news (kingdom_id, type, message, turn_num) VALUES (?,?,?,?)', [
        k.id,
        'system',
        msg,
        k.turn,
      ]);

      await db.run('COMMIT');
      res.json({ ok: true, updates, message: msg });
    } catch (err) {
      await db.run('ROLLBACK').catch(() => {});
      console.error('[cancel-building] error:', err.message);
      res.status(500).json({ error: 'Cancellation failed' });
    }
  });

  // POST /smithy/buy-hammers
  router.post('/smithy/buy-hammers', requireAuth, requireCsrfToken, async (req, res) => {
    const amount = Math.max(1, parseInt(req.body.amount) || 1);

    try {
      await db.run('BEGIN TRANSACTION');

      const k = await db.get(`SELECT ${KINGDOM_SMITHY} FROM kingdoms WHERE player_id=? FOR UPDATE`, [
        req.player.playerId,
      ]);
      if (!k) {
        await db.run('ROLLBACK');
        return res.status(404).json({ error: 'Kingdom not found' });
      }
      if (!(k.bld_smithies > 0)) {
        await db.run('ROLLBACK');
        return res.status(400).json({ error: 'Need at least 1 smithy' });
      }

      const cost = amount * 25;
      if (k.gold < cost) {
        await db.run('ROLLBACK');
        return res.status(400).json({ error: `Need ${cost.toLocaleString()} gold` });
      }

      const cap = k.bld_smithies * 25;
      const newHammers = Math.min(cap, k.hammers_stored + amount);
      const bought = newHammers - k.hammers_stored;
      if (bought <= 0) {
        await db.run('ROLLBACK');
        return res.status(400).json({ error: 'Hammer storage full' });
      }

      const actualCost = bought * 25;
      await db.run('UPDATE kingdoms SET gold=gold-?, hammers_stored=? WHERE id=?', [actualCost, newHammers, k.id]);
      await db.run('COMMIT');

      res.json({
        ok: true,
        bought,
        cost: actualCost,
        hammers_stored: newHammers,
        gold: k.gold - actualCost,
      });
    } catch (err) {
      try {
        await db.run('ROLLBACK');
      } catch (rollbackErr) {
        console.error('[smithy/buy-hammers] rollback error:', rollbackErr.message);
      }
      console.error('[smithy/buy-hammers] error:', err.message);
      res.status(500).json({ error: 'Purchase failed' });
    }
  });

  // POST /smithy/buy-scaffolding
  router.post('/smithy/buy-scaffolding', requireAuth, requireCsrfToken, async (req, res) => {
    const amount = Math.max(1, parseInt(req.body.amount) || 1);

    try {
      await db.run('BEGIN TRANSACTION');

      const k = await db.get(`SELECT ${KINGDOM_SMITHY} FROM kingdoms WHERE player_id=? FOR UPDATE`, [
        req.player.playerId,
      ]);
      if (!k) {
        await db.run('ROLLBACK');
        return res.status(404).json({ error: 'Kingdom not found' });
      }

      const baseCost = 2500;
      const hasSmithy = k.bld_smithies > 0;
      const unitPrice = hasSmithy ? baseCost : Math.floor(baseCost * 1.25);
      const cost = amount * unitPrice;

      if (k.gold < cost) {
        await db.run('ROLLBACK');
        return res.status(400).json({ error: `Need ${cost.toLocaleString()} gold` });
      }

      const cap = Math.max(10, k.bld_smithies * 10);
      const currentScaff = k.scaffolding_stored;
      const newScaff = Math.min(cap, currentScaff + amount);
      const bought = newScaff - currentScaff;

      if (bought <= 0) {
        await db.run('ROLLBACK');
        return res.status(400).json({ error: 'Scaffolding storage full' });
      }

      const actualCost = bought * unitPrice;
      await db.run('UPDATE kingdoms SET gold=gold-?, scaffolding_stored=? WHERE id=?', [
        actualCost,
        newScaff,
        k.id,
      ]);
      await db.run('COMMIT');

      res.json({
        ok: true,
        bought,
        cost: actualCost,
        scaffolding_stored: newScaff,
        gold: k.gold - actualCost,
        markup: !hasSmithy,
      });
    } catch (err) {
      try {
        await db.run('ROLLBACK');
      } catch (rollbackErr) {
        console.error('[smithy/buy-scaffolding] rollback error:', rollbackErr.message);
      }
      console.error('[smithy/buy-scaffolding] error:', err.message);
      res.status(500).json({ error: 'Purchase failed' });
    }
  });

  // POST /smithy-allocation (stub)
  router.post('/smithy-allocation', requireAuth, requireCsrfToken, async (_req, res) => {
    res.json({ ok: true });
  });

  // POST /tower-craft
  router.post('/tower-craft', requireAuth, requireCsrfToken, async (req, res) => {
    const { item, qty } = req.body;
    if (!item || typeof item !== 'string') return res.status(400).json({ error: 'Invalid input' });

    const qtyValidation = validateNonNegativeInteger(qty, {
      min: 1,
      max: 1000000,
      fieldName: 'qty',
    });
    if (!qtyValidation.valid) {
      return res.status(400).json({ error: qtyValidation.error });
    }

    try {
      await db.run('BEGIN TRANSACTION');

      const k = await db.get(
        'SELECT id, bld_mage_towers, mage_tower_allocation FROM kingdoms WHERE player_id = ? FOR UPDATE',
        [req.player.playerId],
      );
      if (!k) {
        await db.run('ROLLBACK');
        return res.status(404).json({ error: 'Kingdom not found' });
      }
      if (k.bld_mage_towers === 0) {
        await db.run('ROLLBACK');
        return res.status(400).json({ error: 'You need at least 1 Mage Tower first' });
      }

      let alloc = {};
      try {
        alloc = safeJsonParse(k.mage_tower_allocation, {}, 'auto:mage_tower_allocation');
      } catch {}
      if (alloc.scroll_craft) {
        alloc[alloc.scroll_craft] = alloc.scroll_target || 999;
        delete alloc.scroll_craft;
        delete alloc.scroll_target;
      }

      alloc[item] = (alloc[item] || 0) + qtyValidation.value;
      await db.run('UPDATE kingdoms SET mage_tower_allocation = ? WHERE id = ?', [JSON.stringify(alloc), k.id]);
      await db.run('COMMIT');

      res.json({ ok: true, allocation: JSON.stringify(alloc) });
    } catch (err) {
      await db.run('ROLLBACK').catch(() => {});
      console.error('[tower-craft] error:', err.message);
      res.status(500).json({ error: 'Crafting failed' });
    }
  });

  // POST /tower-cancel
  router.post('/tower-cancel', requireAuth, requireCsrfToken, async (req, res) => {
    const { item } = req.body;
    const k = await db.get(
      'SELECT id, mage_tower_allocation FROM kingdoms WHERE player_id = ?',
      [req.player.playerId],
    );
    if (!k) return res.status(404).json({ error: 'Kingdom not found' });

    let alloc = {};
    try {
      alloc = safeJsonParse(k.mage_tower_allocation, {}, 'auto:mage_tower_allocation');
    } catch {}
    if (alloc.scroll_craft) {
      alloc[alloc.scroll_craft] = alloc.scroll_target || 999;
      delete alloc.scroll_craft;
      delete alloc.scroll_target;
    }

    delete alloc[item];
    await db.run('UPDATE kingdoms SET mage_tower_allocation = ? WHERE id = ?', [JSON.stringify(alloc), k.id]);
    res.json({ ok: true, allocation: JSON.stringify(alloc) });
  });

  // POST /shrine-allocation
  router.post('/shrine-allocation', requireAuth, requireCsrfToken, async (req, res) => {
    const { allocation } = req.body;

    const allocValidation = validateAllocationObject(allocation, {
      validKeys: ['clerics'],
      maxPerItem: 1000000,
      maxTotal: 1000000,
      fieldName: 'allocation',
    });
    if (!allocValidation.valid) {
      return res.status(400).json({ error: allocValidation.error });
    }

    const k = await db.get(
      'SELECT id, bld_shrines, clerics FROM kingdoms WHERE player_id = ?',
      [req.player.playerId],
    );
    if (!k) return res.status(404).json({ error: 'Kingdom not found' });
    if (k.bld_shrines === 0) return res.status(400).json({ error: 'You need at least 1 Shrine first' });

    const clericsAlloc = Math.min(allocValidation.values.clerics || 0, k.clerics);
    await db.run('UPDATE kingdoms SET shrine_allocation = ? WHERE id = ?', [
      JSON.stringify({ clerics: clericsAlloc }),
      k.id,
    ]);
    res.json({ ok: true, allocation: { clerics: clericsAlloc } });
  });

  // POST /mausoleum-allocation
  router.post('/mausoleum-allocation', requireAuth, requireCsrfToken, async (req, res) => {
    const { allocation } = req.body;
    if (!allocation || typeof allocation !== 'object')
      return res.status(400).json({ error: 'allocation required' });

    const k = await db.get(
      'SELECT id, bld_mausoleums, thralls FROM kingdoms WHERE player_id = ?',
      [req.player.playerId],
    );
    if (!k) return res.status(404).json({ error: 'Kingdom not found' });
    if (k.bld_mausoleums === 0) return res.status(400).json({ error: 'You need at least 1 Mausoleum first' });

    await db.run('UPDATE kingdoms SET mausoleum_allocation = ? WHERE id = ?', [JSON.stringify(allocation), k.id]);
    res.json({ ok: true, allocation });
  });

  // POST /buy-mausoleum-upgrade
  router.post('/buy-mausoleum-upgrade', requireAuth, requireCsrfToken, async (req, res) => {
    const { upgradeKey } = req.body;
    const k = await db.get('SELECT id, turn, race, gold, mausoleum_upgrades FROM kingdoms WHERE player_id = ?', [
      req.player.playerId,
    ]);
    if (!k) return res.status(404).json({ error: 'Kingdom not found' });
    if (k.race !== 'vampire')
      return res.status(403).json({ error: 'Only vampires can buy mausoleum upgrades' });

    const upgrades = engine.MAUSOLEUM_UPGRADES;
    const upg = upgrades[upgradeKey];
    if (!upg) return res.status(400).json({ error: 'Invalid upgrade' });

    const owned = safeJsonParse(k.mausoleum_upgrades, {}, 'auto:mausoleum_upgrades');
    if (owned[upgradeKey]) return res.status(400).json({ error: 'Already owned' });

    if (upg.requires && !owned[upg.requires])
      return res.status(400).json({
        error: 'Prerequisite not met: ' + upgrades[upg.requires].name,
      });

    if (k.gold < upg.cost) return res.status(400).json({ error: 'Not enough gold' });

    owned[upgradeKey] = true;
    await db.run('UPDATE kingdoms SET gold = gold - ?, mausoleum_upgrades = ? WHERE id = ?', [
      upg.cost,
      JSON.stringify(owned),
      k.id,
    ]);
    res.json({ ok: true, upgrade: upg });
  });

  return router;
};
