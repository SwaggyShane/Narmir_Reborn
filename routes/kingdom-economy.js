const express = require('express');
const { requireAuth, requireCsrfToken } = require('./middleware');
const { safeJsonParse, devLog } = require('../utils/helpers');
const { applyKingdomUpdates } = require('../db/schema');
const { marketPriceCache } = require('../cache.js');
const engine = require('../game/engine');
const config = require('../game/config');
const { calculateTradeIncome } = require('../game/economy');
const fragmentBonusManager = require('../game/fragment-bonus-manager');
const { getKingdomVisibility } = require('../game/visibility');
const { safeBitmapHasCell } = require('../game/visibility-cells');
const { pixelToHex } = require('../game/hex-utils');
const { getKingdomMapCoords } = require('../game/world-map-coords');

const router = express.Router();

// Load trade routes for a kingdom
async function loadTradeRoutes(db, k) {
  const tradeRoutes = await db.all(
    "SELECT * FROM trade_routes WHERE kingdom_id = $1 OR partner_id = $2",
    [k.id, k.id],
  );
  k._trade_routes = tradeRoutes.map((r) => {
    if (r.partner_id === k.id) {
      return { ...r, partner_id: r.kingdom_id, kingdom_id: r.partner_id };
    }
    return r;
  });
  return k;
}

// Market liquidity constants
const MARKET_LIQUIDITY = {
  food: 10000,
  wood: 5000,
  stone: 2500,
  iron: 1000,
  coal: 1500,
  steel: 750,
  mana: 5000,
  weapons: 500,
  armor: 250,
  war_machines: 50,
  ballistae: 50,
  land: 10
};

// Resource to database column mapping (prevents SQL injection)
const RESOURCE_COLUMN_MAP = {
  food: 'food',
  wood: 'wood',
  stone: 'stone',
  iron: 'iron',
  coal: 'coal',
  steel: 'steel',
  mana: 'mana',
  weapons: 'weapons_stockpile',
  armor: 'armor_stockpile',
  war_machines: 'war_machines',
  ballistae: 'ballistae',
  maps: 'maps',
  land: 'land'
};

// Returns the database column name for a resource, or undefined if invalid
function getResourceColumn(resource) {
  return RESOURCE_COLUMN_MAP[resource];
}

// Valid unit types for mercenaries (prevents SQL injection)
const VALID_UNIT_TYPES = new Set([
  'fighters', 'rangers', 'clerics', 'mages', 'thieves', 'ninjas'
]);

// Validates unit type before using in SQL
function validateUnitType(unitType) {
  if (!VALID_UNIT_TYPES.has(unitType)) {
    throw new Error(`Invalid unit type: ${unitType}`);
  }
  return unitType;
}

// Shared helper function
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
  if (updatesForDb.bank_deposits && typeof updatesForDb.bank_deposits === 'object') {
    updatesForDb.bank_deposits = JSON.stringify(updatesForDb.bank_deposits);
  }
  if (updatesForDb.bank_upgrades && typeof updatesForDb.bank_upgrades === 'object') {
    updatesForDb.bank_upgrades = JSON.stringify(updatesForDb.bank_upgrades);
  }
  if (updatesForDb.trade_routes && typeof updatesForDb.trade_routes === 'object') {
    updatesForDb.trade_routes = JSON.stringify(updatesForDb.trade_routes);
  }

  await applyKingdomUpdates(kingdomId, updatesForDb);
}

module.exports = function (db) {
  router.get("/trade-routes/list", requireAuth, async (req, res) => {
    const k = await db.get("SELECT id, race, visibility FROM kingdoms WHERE player_id=$1", [
      req.player.playerId,
    ]);
    if (!k) return res.status(404).json({ error: "Kingdom not found" });
    const vis = await getKingdomVisibility(db, k);
    const routes = await db.all(
      `
      SELECT tr.*, 
             CASE WHEN tr.kingdom_id = $1 THEN k2.id ELSE k1.id END as partner_id,
             CASE WHEN tr.kingdom_id = $1 THEN k2.name ELSE k1.name END as partner_name,
             CASE WHEN tr.kingdom_id = $1 THEN k2.race ELSE k1.race END as partner_race,
             CASE WHEN tr.kingdom_id = $1 THEN k2.land ELSE k1.land END as partner_land
      FROM trade_routes tr
      JOIN kingdoms k1 ON tr.kingdom_id = k1.id
      JOIN kingdoms k2 ON tr.partner_id = k2.id
      WHERE (tr.kingdom_id = $1 OR tr.partner_id = $1)
    `,
      [k.id],
    );
    // Gate by seen_cells: only include routes where partner's hex is visible
    const visibleRoutes = routes.filter((r) => {
      const partnerRace = r.partner_race;
      if (!partnerRace) return true; // fallback
      const coords = getKingdomMapCoords({ id: r.partner_id, race: partnerRace });
      const h = pixelToHex(coords.map_x, coords.map_y);
      return safeBitmapHasCell(vis.seenCells, h.col, h.row);
    });
    res.json({ routes: visibleRoutes });
  });
  router.post("/trade-routes/establish", requireAuth, requireCsrfToken, async (req, res) => {
    const targetId = parseInt(req.body.targetId);
    if (isNaN(targetId))
      return res.status(400).json({ error: "Invalid target kingdom" });

    const k = await db.get("SELECT * FROM kingdoms WHERE player_id = $1", [
      req.player.playerId,
    ]);
    if (!k) return res.status(404).json({ error: "Kingdom not found" });

    const marketUpgrades = safeJsonParse(
      k.market_upgrades,
      {},
      "establish:market_upgrades",
    );
    if (!marketUpgrades.trading_post) {
      return res.status(400).json({
        error: "Build a Trading Post in the Markets tab to establish trade routes",
      });
    }

    if (k.id == targetId)
      return res.status(400).json({ error: "Cannot trade with yourself" });

    const target = await db.get("SELECT id, turn, name, race FROM kingdoms WHERE id = $1", [
      targetId,
    ]);
    if (!target) return res.status(404).json({ error: "Target kingdom not found" });

    const vis = await getKingdomVisibility(db, k);
    const targetCoords = getKingdomMapCoords({ id: targetId, race: target.race });
    const targetHex = pixelToHex(targetCoords.map_x, targetCoords.map_y);
    if (!safeBitmapHasCell(vis.seenCells, targetHex.col, targetHex.row)) {
      return res.status(400).json({ error: "Target kingdom is not visible (scout the area first)" });
    }

    const routeCount = await db.get(
      `SELECT COUNT(*) as count FROM (
        SELECT id FROM trade_routes WHERE kingdom_id=$1
        UNION ALL
        SELECT id FROM trade_routes WHERE partner_id=$2
      ) t`,
      [k.id, k.id],
    );
    if (routeCount.count >= (engine.TRADE_ROUTE_MAX || 5)) {
      return res.status(400).json({
        error: `Maximum trade routes reached (${engine.TRADE_ROUTE_MAX || 5})`,
      });
    }

    const existing = await db.get(
      "SELECT id FROM trade_routes WHERE (kingdom_id=$1 AND partner_id=$2) OR (kingdom_id=$3 AND partner_id=$4)",
      [k.id, targetId, targetId, k.id],
    );
    if (existing)
      return res.status(400).json({ error: "Trade route already exists with this kingdom" });

    const distance = Math.hypot(k.x - target.x, k.y - target.y);
    const baseCost = Math.ceil(distance * 10);
    const cost = Math.max(baseCost, 100);

    try {
      await db.withTransaction(async () => {
        // Atomic balance check: verify sufficient gold within the UPDATE statement to prevent
        // concurrent requests from both bypassing the check and creating negative balances
        const goldResult = await db.run("UPDATE kingdoms SET gold = gold - $1 WHERE id = $2 AND gold >= $3", [
          cost,
          k.id,
          cost,
        ]);
        if (goldResult.changes === 0) {
          const err = new Error(`Establishing a permanent trade route costs ${cost.toLocaleString()} gold. You only have ${Math.floor(k.gold).toLocaleString()}.`);
          err.statusCode = 400;
          throw err;
        }
        await db.run(
          "INSERT INTO trade_routes (kingdom_id, partner_id, distance, stability) VALUES ($1, $2, $3, $4)",
          [k.id, targetId, distance, 100],
        );
        await db.run(
          "INSERT INTO news (kingdom_id, type, message, turn_num) VALUES ($1, $2, $3, $4)",
          [
            target.id,
            "system",
            `🤝 The merchants of ${k.name} have established a permanent trade route to your kingdom!`,
            target.turn,
          ],
        );
      });

      res.json({
        ok: true,
        message:
          "Trade route established! You can see it in your Economy > Trade Routes tab.",
      });
    } catch (err) {
      console.error("[establishTradeRoute] error:", err);
      const statusCode = err.statusCode || 500;
      res.status(statusCode).json({ error: err.message });
    }
  });

  router.post("/trade-routes/cancel", requireAuth, requireCsrfToken, async (req, res) => {
    const { routeId } = req.body;
    const k = await db.get("SELECT id FROM kingdoms WHERE player_id=$1", [
      req.player.playerId,
    ]);
    await db.run(
      "DELETE FROM trade_routes WHERE id = $1 AND (kingdom_id = $2 OR partner_id = $3)",
      [routeId, k.id, k.id],
    );
    res.json({ ok: true });
  });
  router.post("/trade/clear-logs", requireAuth, requireCsrfToken, async (req, res) => {
    const k = await db.get("SELECT id FROM kingdoms WHERE player_id = $1", [
      req.player.playerId,
    ]);
    if (!k) return res.status(404).json({ error: "Kingdom not found" });
    // Deletes trades involving this kingdom that are NOT pending
    await db.run(
      `
      DELETE FROM trades
      WHERE (sender_id = $1 OR receiver_id = $2)
      AND status != 'pending'`,
      [k.id, k.id],
    );
    res.json({ ok: true });
  });
  router.get("/market/prices", requireAuth, async (_req, res) => {
    const cacheKey = "all_prices";
    if (marketPriceCache.has(cacheKey)) {
      return res.json(marketPriceCache.get(cacheKey));
    }

    const prices = await db.all(
      "SELECT * FROM market_prices WHERE id != 'hammers'",
    );
    marketPriceCache.set(cacheKey, prices, 5 * 60 * 1000); // 5 min TTL
    res.json(prices);
  });
  router.post("/market/buy", requireAuth, requireCsrfToken, async (req, res) => {
    const { resource, amount } = req.body;
    const qty = Math.max(0, parseInt(amount) || 0);
    if (!qty) return res.status(400).json({ error: "Quantity required" });

    try {
      const result = await db.withTransaction(async () => {
        const k = await db.get("SELECT id, turn, gold, wood, stone, iron, food, mana, maps, weapons_stockpile, armor_stockpile, coal, steel, war_machines, ballistae, land FROM kingdoms WHERE player_id = $1 FOR UPDATE", [
          req.player.playerId,
        ]);
        if (!k) {
          const err = new Error("Kingdom not found");
          err.statusCode = 404;
          throw err;
        }

        const priceRow = await db.get("SELECT * FROM market_prices WHERE id = $1 FOR UPDATE", [
          resource,
        ]);
        if (!priceRow || resource === "hammers") {
          const err = new Error("Invalid resource");
          err.statusCode = 400;
          throw err;
        }

        const basePrice = priceRow.base_price;
        const currentPrice = priceRow.current_price;
        const liquidity = MARKET_LIQUIDITY[resource] || 100000;

        const minPrice = basePrice * 0.15;
        const maxPrice = basePrice * 6.0;

        const nextPrice = currentPrice * (1 + (qty / liquidity));
        const clampedNext = Math.max(minPrice, Math.min(maxPrice, nextPrice));
        const avgPrice = (currentPrice + clampedNext) / 2;
        const cost = Math.ceil(qty * avgPrice);

        if (k.gold < cost) {
          const err = new Error(`Need ${cost.toLocaleString()} GC (Avg price: ${avgPrice.toFixed(3)} GC)`);
          err.statusCode = 400;
          throw err;
        }

        const dbCol = getResourceColumn(resource);
        await db.run(
          `UPDATE kingdoms SET gold = gold - $1, ${dbCol} = ${dbCol} + $2 WHERE id = $3`,
          [cost, qty, k.id],
        );

        // Impact market: update the price to clamped progress
        await db.run(
          "UPDATE market_prices SET current_price = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
          [clampedNext, resource],
        );

        await db.run(
          "INSERT INTO news (kingdom_id, type, message, turn_num) VALUES ($1,$2,$3,$4)",
          [
            k.id,
            "system",
            `⚖️ Bought ${qty.toLocaleString()} ${resource.replace(/_/g, " ")} from the market for ${cost.toLocaleString()} GC (Avg price: ${avgPrice.toFixed(3)} GC).`,
            k.turn,
          ],
        );

        return {
          ok: true,
          bought: qty,
          cost,
          message: `⚖️ Bought ${qty.toLocaleString()} ${resource.replace(/_/g, " ")} from the market for ${cost.toLocaleString()} GC.`,
          updates: { gold: k.gold - cost, [dbCol]: (k[dbCol] || 0) + qty },
        };
      });

      res.json(result);
    } catch (err) {
      console.error("[market/buy] error:", err.message);
      const statusCode = err.statusCode || 500;
      res.status(statusCode).json({ error: err.message });
    }
  });

  router.post("/market/sell", requireAuth, requireCsrfToken, async (req, res) => {
    const { resource, amount } = req.body;
    const qty = Math.max(0, parseInt(amount) || 0);
    if (!qty) return res.status(400).json({ error: "Quantity required" });

    try {
      const result = await db.withTransaction(async () => {
        const k = await db.get("SELECT id, turn, gold, wood, stone, iron, food, mana, maps, weapons_stockpile, armor_stockpile, coal, steel, war_machines, ballistae, land FROM kingdoms WHERE player_id = $1 FOR UPDATE", [
          req.player.playerId,
        ]);
        if (!k) {
          const err = new Error("Kingdom not found");
          err.statusCode = 404;
          throw err;
        }

        const dbCol = getResourceColumn(resource);
        if (!dbCol) {
          const err = new Error("Invalid resource");
          err.statusCode = 400;
          throw err;
        }
        if ((k[dbCol] || 0) < qty) {
          const err = new Error("Not enough resource");
          err.statusCode = 400;
          throw err;
        }

        const priceRow = await db.get("SELECT * FROM market_prices WHERE id = $1 FOR UPDATE", [
          resource,
        ]);
        if (!priceRow || resource === "hammers") {
          const err = new Error("Invalid resource");
          err.statusCode = 400;
          throw err;
        }

        const basePrice = priceRow.base_price;
        const currentPrice = priceRow.current_price;
        const liquidity = MARKET_LIQUIDITY[resource] || 100000;

        const minPrice = basePrice * 0.15;
        const maxPrice = basePrice * 6.0;

        const nextPrice = currentPrice * (1 - (qty / liquidity));
        const clampedNext = Math.max(minPrice, Math.min(maxPrice, nextPrice));
        const avgPrice = (currentPrice + clampedNext) / 2;

        let sellMultiplier = 0.7; // 30% base spread
        if (k.prestige_level && k.prestige_level > 0) {
          sellMultiplier += Math.min(0.1, k.prestige_level * 0.02); // Up to +10% sell value (0.8 max modifier)
        }
        const gain = Math.floor(qty * avgPrice * sellMultiplier);

        await db.run(
          `UPDATE kingdoms SET gold = gold + $1, ${dbCol} = ${dbCol} - $2 WHERE id = $3`,
          [gain, qty, k.id],
        );

        // Impact market: update the price to clamped progress
        await db.run(
          "UPDATE market_prices SET current_price = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
          [clampedNext, resource],
        );

        await db.run(
          "INSERT INTO news (kingdom_id, type, message, turn_num) VALUES ($1,$2,$3,$4)",
          [
            k.id,
            "system",
            `⚖️ Sold ${qty.toLocaleString()} ${resource.replace(/_/g, " ")} to the market for ${gain.toLocaleString()} GC (Avg price: ${avgPrice.toFixed(3)} GC).`,
            k.turn,
          ],
        );

        return {
          ok: true,
          sold: qty,
          gain,
          message: `⚖️ Sold ${qty.toLocaleString()} ${resource.replace(/_/g, " ")} to the market for ${gain.toLocaleString()} GC.`,
          updates: { gold: k.gold + gain, [dbCol]: (k[dbCol] || 0) - qty },
        };
      });

      res.json(result);
    } catch (err) {
      console.error("[market/sell] error:", err.message);
      const statusCode = err.statusCode || 500;
      res.status(statusCode).json({ error: err.message });
    }
  });

  router.post("/economy/bank-deposit", requireAuth, requireCsrfToken, async (req, res) => {
    const { amount, termIndex } = req.body;
    if (!amount || amount <= 0)
      return res.status(400).json({ error: "Invalid amount." });

    try {
      const result = await db.withTransaction(async () => {
        const k = await db.get("SELECT id, turn, gold, bld_vaults, bank_upgrades, bank_deposits FROM kingdoms WHERE player_id = $1 FOR UPDATE", [
          req.player.playerId,
        ]);
        if (!k) {
          const err = new Error("Kingdom not found");
          err.statusCode = 404;
          throw err;
        }

        if (k.bld_vaults < 5) {
          const err = new Error("Bank access requires at least 5 Vaults.");
          err.statusCode = 400;
          throw err;
        }
        if (k.gold < amount) {
          const err = new Error("Not enough gold.");
          err.statusCode = 400;
          throw err;
        }

        const bankUpgrades = safeJsonParse(k.bank_upgrades, {}, "auto:bank_upgrades");
        let interestBonus = 0;
        if (bankUpgrades.trade_guild) interestBonus += 0.03;

        const availableTerms = [
          { turns: 10, interest: 0.02, reqUpgrade: null },
          { turns: 25, interest: 0.07, reqUpgrade: null },
          { turns: 50, interest: 0.15, reqUpgrade: null },
          { turns: 150, interest: 0.25, reqUpgrade: null },
          { turns: 300, interest: 0.6, reqUpgrade: "iron_treasury" },
        ];

        const termDef = availableTerms[termIndex];
        if (!termDef) {
          const err = new Error("Invalid term.");
          err.statusCode = 400;
          throw err;
        }

        if (termDef.reqUpgrade && !bankUpgrades[termDef.reqUpgrade]) {
          const err = new Error("This term requires a bank upgrade.");
          err.statusCode = 400;
          throw err;
        }

        const deposits = safeJsonParse(k.bank_deposits, [], "auto:bank_deposits");
        const startTurn = k.turn;
        const targetTurn = startTurn + termDef.turns;
        const finalInterest = termDef.interest + interestBonus;
        const returnAmount = Math.floor(amount * (1 + finalInterest));

        deposits.push({
          id: Math.random().toString(36).substring(7),
          amount: parseInt(amount, 10),
          startTurn,
          targetTurn,
          returnAmount,
          termTurns: termDef.turns,
          interest: finalInterest,
          status: "active",
        });

        await db.run(
          "UPDATE kingdoms SET gold = gold - $1, bank_deposits = $2 WHERE id = $3",
          [amount, JSON.stringify(deposits), k.id],
        );
        await db.run(
          "INSERT INTO news (kingdom_id, type, message, turn_num) VALUES ($1,$2,$3,$4)",
          [
            k.id,
            "system",
            `🏦 Deposited ${parseInt(amount).toLocaleString()} gold for ${termDef.turns} turns. Expected payout: ${returnAmount.toLocaleString()} gold.`,
            k.turn,
          ],
        );

        return { message: "Deposit successful.", updates: { gold: k.gold - amount, bank_deposits: JSON.stringify(deposits) } };
      });

      res.json(result);
    } catch (err) {
      console.error("[bank-deposit] error:", err.message);
      const statusCode = err.statusCode || 500;
      res.status(statusCode).json({ error: err.message });
    }
  });

  router.post("/economy/bank-withdraw", requireAuth, requireCsrfToken, async (req, res) => {
    const { depositId } = req.body;

    const k = await db.get("SELECT id, turn, gold, bank_upgrades, bank_deposits FROM kingdoms WHERE player_id = $1", [
      req.player.playerId,
    ]);
    if (!k) return res.status(404).json({ error: "Kingdom not found" });

    const bankUpgrades = safeJsonParse(k.bank_upgrades, {}, "auto:bank_upgrades");
    if (!bankUpgrades.ledger_ancients) {
      return res
        .status(400)
        .json({
          error:
            "You need the Ledger of the Ancients upgrade to withdraw early.",
        });
    }

    let deposits = safeJsonParse(k.bank_deposits, [], "auto:bank_deposits");
    let targetIndex = deposits.findIndex(
      (d) => d.id === depositId && d.status === "active",
    );

    if (targetIndex === -1) {
      return res
        .status(400)
        .json({ error: "Deposit not found or already matured." });
    }

    const dep = deposits[targetIndex];
    dep.status = "withdrawn_early";

    // Forfeit interest, just principal back
    const refund = dep.amount;

    const updates = {
      gold: k.gold + refund,
      bank_deposits: JSON.stringify(deposits),
    };

    await applyUpdates(db, k.id, updates);
    await db.run(
      "INSERT INTO news (kingdom_id, type, message, turn_num) VALUES ($1,$2,$3,$4)",
      [
        k.id,
        "system",
        `ðŸ¦ Early Withdrawal: You withdrew ${refund.toLocaleString()} gold and forfeited the interest.`,
        k.turn,
      ],
    );

    res.json({ message: "Withdrawal successful.", updates });
  });
  router.post("/economy/upgrade", requireAuth, requireCsrfToken, async (req, res) => {
    const { category, upgradeKey } = req.body;
    const k = await db.get(
      `SELECT id, turn, race, gold, wood, stone, iron, bld_vaults, bld_farms, bld_markets,
              bld_taverns, bld_mage_towers, bld_schools, bld_shrines, bld_mausoleums,
              bld_libraries, bld_walls, bld_guard_towers, bld_outposts, farm_upgrades,
              granary_upgrades, market_upgrades, tavern_upgrades, tower_upgrades,
              school_upgrades, shrine_upgrades, mausoleum_upgrades, library_upgrades,
              wall_upgrades, tower_def_upgrades, outpost_upgrades, bank_upgrades
       FROM kingdoms WHERE player_id = $1`,
      [req.player.playerId]
    );
    if (!k) return res.status(404).json({ error: "Kingdom not found" });
    const result = engine.purchaseUpgrade(k, category, upgradeKey);
    if (result.error) {
      console.warn('[economy/upgrade] Purchase failed', { category, upgradeKey, error: result.error, kingdomId: k.id });
      return res.status(400).json({ error: result.error });
    }
    devLog('[economy/upgrade] Purchase successful', { category, upgradeKey, kingdomId: k.id, updates: result.updates });
    await applyUpdates(db, k.id, result.updates);
    const def =
      engine.FARM_UPGRADES[upgradeKey] ||
      engine.GRANARY_UPGRADES[upgradeKey] ||
      engine.MARKET_UPGRADES[upgradeKey] ||
      engine.TAVERN_UPGRADES[upgradeKey] ||
      engine.TOWER_UPGRADES[upgradeKey] ||
      engine.SCHOOL_UPGRADES[upgradeKey] ||
      engine.SHRINE_UPGRADES[upgradeKey] ||
      engine.MAUSOLEUM_UPGRADES[upgradeKey] ||
      engine.LIBRARY_UPGRADES[upgradeKey] ||
      engine.WALL_UPGRADES[upgradeKey] ||
      engine.TOWER_DEF_UPGRADES[upgradeKey] ||
      engine.OUTPOST_UPGRADES[upgradeKey] ||
      engine.BANK_UPGRADES[upgradeKey];
    await db.run(
      "INSERT INTO news (kingdom_id, type, message, turn_num) VALUES ($1,$2,$3,$4)",
      [k.id, "system", `⬆️ ${def?.name || upgradeKey} purchased.`, k.turn],
    );
    res.json({ ok: true, updates: result.updates });
  });
  router.post("/economy/hire-mercs", requireAuth, requireCsrfToken, async (req, res) => {
    const { unitType, tier, count } = req.body;
    const k = await db.get(
      `SELECT id, turn, gold, bld_taverns, tavern_upgrades, mercenaries,
              fighters, rangers, mages, clerics, thieves, ninjas,
              engineers, scribes, war_machines
       FROM kingdoms WHERE player_id = $1`,
      [req.player.playerId]
    );
    if (!k) return res.status(404).json({ error: "Kingdom not found" });
    const result = engine.hireMercenaries(
      k,
      unitType,
      tier,
      parseInt(count) || 1,
    );
    if (result.error) return res.status(400).json({ error: result.error });
    await applyUpdates(db, k.id, result.updates);
    await db.run(
      "INSERT INTO news (kingdom_id, type, message, turn_num) VALUES ($1,$2,$3,$4)",
      [
        k.id,
        "system",
        `âš”ï¸ Hired ${result.hired.count} ${result.hired.tier} ${result.hired.unitType} (Lv ${result.hired.level}) for ${result.hired.cost.toLocaleString()} gold. Contract: ${result.hired.duration} turns.`,
        k.turn,
      ],
    );
    res.json({ ok: true, hired: result.hired, updates: result.updates });
  });
  router.post("/economy/dismiss-mercs", requireAuth, requireCsrfToken, async (req, res) => {
    const { mercIndex } = req.body;
    const k = await db.get("SELECT id, mercenaries, fighters, rangers, mages, clerics, thieves, ninjas, researchers, engineers, scribes, war_machines FROM kingdoms WHERE player_id = $1", [
      req.player.playerId,
    ]);
    if (!k) return res.status(404).json({ error: "Kingdom not found" });
    let mercs = [];
    try {
      mercs = safeJsonParse(k.mercenaries, [], "auto:mercenaries");
    } catch {}
    const idx = parseInt(mercIndex);
    if (idx < 0 || idx >= mercs.length)
      return res.status(400).json({ error: "Invalid mercenary index" });
    const m = mercs[idx];
    mercs.splice(idx, 1);
    let unitType;
    try {
      unitType = validateUnitType(m.unit_type);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
    const newCount = Math.max(0, (k[unitType] || 0) - m.count);
    await db.run(
      `UPDATE kingdoms SET mercenaries = $1, ${unitType} = $2 WHERE id = $3`,
      [JSON.stringify(mercs), newCount, k.id],
    );
    res.json({ ok: true, dismissed: m });
  });
  router.post("/economy/trade/send", requireAuth, requireCsrfToken, async (req, res) => {
    const { targetId, offer, request } = req.body;
    const k = await db.get("SELECT id, name, turn, market_upgrades, food, gold, mana, maps, blueprints_stored FROM kingdoms WHERE player_id = $1", [
      req.player.playerId,
    ]);
    if (!k) return res.status(404).json({ error: "Kingdom not found" });
    // Check trading post
    let mktUpgrades = {};
    try {
      if (k.market_upgrades) {
        mktUpgrades = JSON.parse(k.market_upgrades);
      }
    } catch (err) {
      console.error('[trade/send] Failed to parse market_upgrades', {
        kingdomId: k.id,
        raw: k.market_upgrades,
        error: err.message
      });
      return res.status(400).json({ error: "Market upgrades data corrupted. Contact admin." });
    }
    if (!mktUpgrades.trading_post) {
      console.warn('[trade/send] Trading post not purchased', {
        kingdomId: k.id,
        marketUpgrades: mktUpgrades,
        raw: k.market_upgrades
      });
      return res
        .status(400)
        .json({ error: "Build a Trading Post to trade with other kingdoms" });
    }
    if (!targetId || !offer || !request)
      return res.status(400).json({ error: "Missing trade parameters" });
    const target = await db.get("SELECT id, name FROM kingdoms WHERE id = $1", [
      targetId,
    ]);
    if (!target)
      return res.status(404).json({ error: "Target kingdom not found" });
    // Validate sender has the offered goods
    const offerObj = typeof offer === "string" ? JSON.parse(offer) : offer;
    const requestObj =
      typeof request === "string" ? JSON.parse(request) : request;
    for (const [item, qty] of Object.entries(offerObj)) {
      const col =
        item === "food"
          ? "food"
          : item === "gold"
            ? "gold"
            : item === "mana"
              ? "mana"
              : item === "maps"
                ? "maps"
                : item === "blueprints"
                  ? "blueprints_stored"
                  : null;
      if (col && (k[col] || 0) < qty)
        return res.status(400).json({ error: `Not enough ${item}` });
    }
    await db.run(
      `INSERT INTO trade_offers (sender_id, sender_name, receiver_id, receiver_name, offer, request, expires_at) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        k.id,
        k.name,
        target.id,
        target.name,
        JSON.stringify(offerObj),
        JSON.stringify(requestObj),
        Math.floor(Date.now() / 1000) + 3600,
      ],
    );
    await db.run(
      "INSERT INTO news (kingdom_id, type, message, turn_num) VALUES ($1,$2,$3,$4)",
      [
        target.id,
        "system",
        `ðŸ“¦ Trade offer from ${k.name} â€” check your Economy panel to accept or decline.`,
        k.turn,
      ],
    );
    res.json({ ok: true });
  });
  router.get("/economy/trade/list", requireAuth, async (req, res) => {
    const k = await db.get("SELECT id FROM kingdoms WHERE player_id = $1", [
      req.player.playerId,
    ]);
    if (!k) return res.status(404).json({ error: "Kingdom not found" });
    const now = Math.floor(Date.now() / 1000);
    await db.run(
      "UPDATE trade_offers SET status = $1 WHERE expires_at < $2 AND status = $3",
      ["expired", now, "pending"],
    );
    const sent = await db.all(
      "SELECT * FROM trade_offers WHERE sender_id   = $1 ORDER BY created_at DESC LIMIT 20",
      [k.id],
    );
    const received = await db.all(
      "SELECT * FROM trade_offers WHERE receiver_id = $1 AND status = $2 ORDER BY created_at DESC LIMIT 20",
      [k.id, "pending"],
    );
    res.json({ sent, received });
  });
  router.post("/economy/trade/accept", requireAuth, requireCsrfToken, async (req, res) => {
    const { offerId } = req.body;
    const k = await db.get("SELECT id, name, gold, food, mana, maps, blueprints_stored, weapons_stockpile, armor_stockpile FROM kingdoms WHERE player_id = $1", [
      req.player.playerId,
    ]);
    if (!k) return res.status(404).json({ error: "Kingdom not found" });
    const offer = await db.get(
      "SELECT * FROM trade_offers WHERE id = $1 AND receiver_id = $2 AND status = $3",
      [offerId, k.id, "pending"],
    );
    if (!offer)
      return res
        .status(404)
        .json({ error: "Offer not found or already resolved" });
    const sender = await db.get("SELECT id, turn, gold, food, mana, maps, blueprints_stored, weapons_stockpile, armor_stockpile FROM kingdoms WHERE id = $1", [
      offer.sender_id,
    ]);
    if (!sender) return res.status(404).json({ error: "Sender not found" });

    const offerItems = JSON.parse(offer.offer); // what sender gives
    const requestItems = JSON.parse(offer.request); // what receiver gives

    const ITEM_COL = {
      gold: "gold",
      food: "food",
      mana: "mana",
      maps: "maps",
      blueprints: "blueprints_stored",
      weapons: "weapons_stockpile",
      armor: "armor_stockpile",
    };

    // Validate both sides still have the goods
    for (const [item, qty] of Object.entries(requestItems)) {
      const col = ITEM_COL[item];
      if (col && (k[col] || 0) < qty)
        return res.status(400).json({ error: `You don't have enough ${item}` });
    }
    for (const [item, qty] of Object.entries(offerItems)) {
      const col = ITEM_COL[item];
      if (col && (sender[col] || 0) < qty)
        return res
          .status(400)
          .json({ error: `Sender no longer has enough ${item}` });
    }

    // Apply exchange
    const kUpdates = {},
      sUpdates = {};
    for (const [item, qty] of Object.entries(offerItems)) {
      const c = ITEM_COL[item];
      if (c) {
        kUpdates[c] =
          (kUpdates[c] !== undefined ? kUpdates[c] : k[c] || 0) + qty;
        sUpdates[c] =
          (sUpdates[c] !== undefined ? sUpdates[c] : sender[c] || 0) - qty;
      }
    }
    for (const [item, qty] of Object.entries(requestItems)) {
      const c = ITEM_COL[item];
      if (c) {
        kUpdates[c] =
          (kUpdates[c] !== undefined ? kUpdates[c] : k[c] || 0) - qty;
        sUpdates[c] =
          (sUpdates[c] !== undefined ? sUpdates[c] : sender[c] || 0) + qty;
      }
    }

    await applyUpdates(db, k.id, kUpdates);
    await applyUpdates(db, sender.id, sUpdates);
    await db.run("UPDATE trade_offers SET status = $1 WHERE id = $2", [
      "accepted",
      offer.id,
    ]);
    await db.run(
      "INSERT INTO news (kingdom_id, type, message, turn_num) VALUES ($1,$2,$3,$4)",
      [
        sender.id,
        "system",
        `âœ… ${k.name} accepted your trade offer.`,
        sender.turn,
      ],
    );
    res.json({ ok: true, kUpdates, sUpdates });
  });
  router.post("/economy/trade/decline", requireAuth, requireCsrfToken, async (req, res) => {
    const { offerId } = req.body;
    const k = await db.get("SELECT id FROM kingdoms WHERE player_id = $1", [
      req.player.playerId,
    ]);
    if (!k) return res.status(404).json({ error: "Kingdom not found" });
    const offer = await db.get(
      "SELECT * FROM trade_offers WHERE id = $1 AND receiver_id = $2",
      [offerId, k.id],
    );
    if (!offer) return res.status(404).json({ error: "Offer not found" });
    await db.run("UPDATE trade_offers SET status = $1 WHERE id = $2", [
      "declined",
      offer.id,
    ]);
    await db.run(
      "INSERT INTO news (kingdom_id, type, message, turn_num) VALUES ($1,$2,$3,$4)",
      [offer.sender_id, "system", `\u274C ${k.name} declined your trade offer.`, 0],
    );
    res.json({ ok: true });
  });
  router.get("/economy/overview", requireAuth, async (req, res) => {
    const k = await db.get(
      `SELECT id, race, bld_farms, farm_upgrades, population, thralls, active_event,
              bld_markets, market_upgrades, prestige_level, maps, bld_taverns,
              bld_granaries, granary_upgrades, food, food_shortage_turns,
              food_surplus_turns, fragment_bonuses, tavern_upgrades, mercenaries,
              fighters, rangers, mages, clerics, thieves, ninjas,
              researchers, engineers, scribes, tax,
              land, happiness, bld_castles, res_economy, milestone_bonuses,
              achievements, bld_barracks, bld_smithies, bld_libraries, bld_schools,
              alliance_buffs, active_effects
       FROM kingdoms WHERE player_id = $1`,
      [req.player.playerId]
    );
    if (!k) return res.status(404).json({ error: "Kingdom not found" });

    // Fetch and normalize trade routes so calculateTradeIncome can use them
    await loadTradeRoutes(db, k);

    // Compute troop upkeep (mirrors processTurn logic)
    const upkeepMult = { high_elf: 1.0, dwarf: 0.85, dire_wolf: 1.2, dark_elf: 1.1, human: 1.0, orc: 1.15 }[k.race] || 1.0;
    const combatTroops = (k.fighters || 0) + (k.rangers || 0) + (k.clerics || 0) + (k.mages || 0) + (k.thieves || 0) + (k.ninjas || 0);
    const capRace = config.SUPPORT_CAP_RACE[k.race] || { researcher: 1.0, engineer: 1.0, scribe: 1.0 };
    const researcherCap = Math.floor((k.bld_schools || 0) * 100 * (capRace.researcher || 1.0));
    const engineerCap = Math.floor((k.bld_smithies || 0) * 50 * (capRace.engineer || 1.0));
    const scribeCap = Math.floor((k.bld_libraries || 0) * 20 * (capRace.scribe || 1.0));
    const supportOverflow = Math.max(0, (k.researchers || 0) - researcherCap) + Math.max(0, (k.engineers || 0) - engineerCap) + Math.max(0, (k.scribes || 0) - scribeCap);
    const barracksTrainingMult = fragmentBonusManager.getBonusMultiplier(k, 'barracks', 'training');
    const barrackDiscount = Math.min(0.5, Math.floor((k.bld_barracks || 0) / 2) * 0.01 * barracksTrainingMult);
    const troopUpkeep = Math.floor((combatTroops + supportOverflow) * upkeepMult * (1 - barrackDiscount));

    const marketInc = engine.marketIncomeFull(k);
    const goldIncome = engine.goldPerTurn(k);
    const tradeRouteIncome = calculateTradeIncome(k);
    const totalIncome = goldIncome + tradeRouteIncome;

    res.json({
      tax: k.tax,
      taxIncome: goldIncome - marketInc,
      marketIncome: marketInc,
      tradeRouteIncome,
      totalIncome,
      troopUpkeep,
      netIncome: totalIncome - troopUpkeep,
      farmProduction: engine.farmProduction(k),
      foodConsumption: engine.foodConsumption(k),
      foodBalance: engine.farmProduction(k) - engine.foodConsumption(k),
      tavernBonus: engine.tavernEntertainmentBonus(k),
      maxFoodStorage:
        k.bld_granaries *
        (safeJsonParse(k.granary_upgrades, {}, "auto:granary_upgrades").silos ? 150000 : 100000),
      foodSpoilageRate: safeJsonParse(k.granary_upgrades, {}, "auto:granary_upgrades").preservation
        ? 0.05 * 0.7
        : 0.05,
      foodSpoilageAmount: Math.floor(
        k.food *
          (safeJsonParse(k.granary_upgrades, {}, "auto:granary_upgrades").preservation
            ? 0.05 * 0.7
            : 0.05),
      ),
      foodDegradeTurns: (() => {
        const rate = safeJsonParse(k.granary_upgrades, {}, "auto:granary_upgrades").preservation
          ? 0.05 * 0.7
          : 0.05;
        const bal = engine.farmProduction(k) - engine.foodConsumption(k);
        const current = k.food;
        if (current <= 0) return 0;
        // Approximation: how many turns until food is near zero
        // if balance < spoilage, it decreases.
        // spoilage = food * rate.
        // net = bal - (food * rate).
        if (bal >= current * rate) return Infinity; // Technically growing
        // logarithmic decay? no, just simple turn estimate
        let tempFood = current;
        let turns = 0;
        while (tempFood > 100 && turns < 500) {
          tempFood = tempFood + bal - tempFood * rate;
          turns++;
          if (tempFood >= current && turns > 1) return Infinity;
        }
        return turns;
      })(),
      workedFarms: (() => {
        let workers = engine.FARM_WORKERS_PER?.[k.race] || 10;
        const upg = safeJsonParse(k.farm_upgrades, {}, "auto:farm_upgrades");
        if (upg.iron_plows) workers = Math.max(1, workers - 2);
        return Math.min(
          k.bld_farms,
          Math.floor(
            Math.max(
              0,
              k.population -
                (k.fighters +
                  k.rangers +
                  k.clerics +
                  k.mages +
                  k.thieves +
                  k.ninjas +
                  k.researchers +
                  k.engineers +
                  k.scribes),
            ) / workers,
          ),
        );
      })(),
      farm_upgrades: safeJsonParse(k.farm_upgrades, {}, "auto:farm_upgrades"),
      granary_upgrades: safeJsonParse(k.granary_upgrades, {}, "auto:granary_upgrades"),
      market_upgrades: safeJsonParse(k.market_upgrades, {}, "auto:market_upgrades"),
      tavern_upgrades: safeJsonParse(k.tavern_upgrades, {}, "auto:tavern_upgrades"),
      mercenaries: safeJsonParse(k.mercenaries, [], "auto:mercenaries"),
      food_shortage_turns: k.food_shortage_turns,
      food_surplus_turns: k.food_surplus_turns,
      activeTradeRouteCount: k._trade_routes.length,
    });
  });

  return router;
};
