const express = require('express');
const { requireAuth } = require('./middleware');
const { safeJsonParse } = require('../utils/helpers');

function httpError(status, message) {
  const err = new Error(message);
  err.statusCode = status;
  return err;
}

module.exports = (db) => {
  const router = express.Router();

  router.get('/list', requireAuth, async (req, res) => {
    const rows = await db.all(`
      SELECT a.id, a.name, k.name AS leader_name, COUNT(am.kingdom_id) as member_count
      FROM alliances a
      JOIN kingdoms k ON a.leader_id = k.id
      JOIN alliance_members am ON am.alliance_id = a.id
      GROUP BY a.id, a.name, k.name ORDER BY member_count DESC, a.name ASC
    `);
    res.json(rows);
  });

  router.post('/vault/deposit', requireAuth, async (req, res) => {
    try {
      const kingdom = await db.get('SELECT id, gold, name FROM kingdoms WHERE player_id = $1', [req.player.playerId]);
      if (!kingdom) return res.status(404).json({ error: 'Kingdom not found' });
      const membership = await db.get('SELECT alliance_id FROM alliance_members WHERE kingdom_id = $1', [kingdom.id]);
      if (!membership) return res.status(400).json({ error: 'Not in an alliance' });
      const { amount } = req.body;
      const goldAmount = parseInt(amount) || 0;
      if (goldAmount <= 0) return res.status(400).json({ error: 'Invalid amount' });

      await db.withTransaction(async () => {
        // Lock alliance FIRST (before kingdom) to establish consistent locking order and prevent deadlock
        const alliance = await db.get('SELECT id, vault_log FROM alliances WHERE id = $1 FOR UPDATE', [membership.alliance_id]);
        if (!alliance) throw httpError(404, 'Alliance not found or disbanded');

        const k = await db.get('SELECT gold FROM kingdoms WHERE id = $1 FOR UPDATE', [kingdom.id]);
        if (!k) throw httpError(404, 'Kingdom not found');
        if (k.gold < goldAmount) throw httpError(400, 'Not enough gold');

        await db.run('UPDATE kingdoms SET gold = gold - $1 WHERE id = $2', [goldAmount, kingdom.id]);
        await db.run('UPDATE alliances SET vault_gold = vault_gold + $1 WHERE id = $2', [goldAmount, membership.alliance_id]);
        let logs = safeJsonParse(alliance.vault_log || '[]', []);
        logs.unshift({ type: 'deposit', kingdom: kingdom.name, amount: goldAmount, date: new Date().toLocaleString() });
        if (logs.length > 20) logs = logs.slice(0, 20);
        await db.run('UPDATE alliances SET vault_log = $1 WHERE id = $2', [JSON.stringify(logs), membership.alliance_id]);
      });

      res.json({ ok: true, deposited: goldAmount });
    } catch (e) {
      if (e.statusCode) return res.status(e.statusCode).json({ error: e.message });
      console.error(e);
      res.status(500).json({ error: 'Deposit failed' });
    }
  });

  router.post('/vault/project', requireAuth, async (req, res) => {
    try {
      const kingdom = await db.get('SELECT id, name FROM kingdoms WHERE player_id = $1', [req.player.playerId]);
      const alliance = await db.get('SELECT * FROM alliances WHERE leader_id = $1', [kingdom.id]);
      if (!alliance) return res.status(403).json({ error: 'Only leader can fund projects' });

      const { project } = req.body;
      const allowedProjects = ['merchant_guild', 'shadow_network', 'mercenary_subsidy', 'fortress_walls'];
      if (!allowedProjects.includes(project)) return res.status(400).json({ error: 'Invalid project' });

      await db.withTransaction(async () => {
        const a = await db.get('SELECT * FROM alliances WHERE id = $1 FOR UPDATE', [alliance.id]);

        let projects = safeJsonParse(a.projects, {});
        const currentLevel = projects[project] || 0;
        if (currentLevel >= 10) throw httpError(400, 'Project is max level');

        const cost = 50000 * (currentLevel + 1);
        if (a.vault_gold < cost) throw httpError(400, 'Not enough vault gold');

        projects[project] = currentLevel + 1;
        await db.run('UPDATE alliances SET vault_gold = vault_gold - $1, projects = $2 WHERE id = $3', [cost, JSON.stringify(projects), a.id]);

        let logs = safeJsonParse(a.vault_log, []);
        logs.unshift({ type: 'project', name: project.replace('_', ' '), level: currentLevel + 1, cost: cost, date: new Date().toLocaleString() });
        if (logs.length > 20) logs = logs.slice(0, 20);
        await db.run('UPDATE alliances SET vault_log = $1 WHERE id = $2', [JSON.stringify(logs), a.id]);

        await db.run(
          'UPDATE kingdoms SET alliance_buffs = $1 WHERE id IN (SELECT kingdom_id FROM alliance_members WHERE alliance_id = $2)',
          [JSON.stringify(projects), a.id]
        );
      });

      res.json({ ok: true });
    } catch (e) {
      if (e.statusCode) return res.status(e.statusCode).json({ error: e.message });
      console.error(e);
      res.status(500).json({ error: 'Project funding failed' });
    }
  });

  router.get('/my', requireAuth, async (req, res) => {
    const kingdom = await db.get('SELECT id FROM kingdoms WHERE player_id = $1', [req.player.playerId]);
    if (!kingdom) return res.status(404).json({ error: 'Kingdom not found' });
    const membership = await db.get('SELECT * FROM alliance_members WHERE kingdom_id = $1', [kingdom.id]);
    if (!membership) return res.json({ alliance: null });
    const alliance = await db.get('SELECT * FROM alliances WHERE id = $1', [membership.alliance_id]);
    if (!alliance) {
      await db.run('DELETE FROM alliance_members WHERE kingdom_id = $1', [kingdom.id]);
      return res.json({ alliance: null });
    }
    const members = await db.all(`
      SELECT k.id, k.name, k.race, k.land, k.fighters, k.level, am.pledge
      FROM kingdoms k JOIN alliance_members am ON k.id = am.kingdom_id
      WHERE am.alliance_id = $1 ORDER BY k.land DESC`, [membership.alliance_id]);
    res.json({ alliance, members, myPledge: membership.pledge, isLeader: alliance.leader_id === kingdom.id });
  });

  router.post('/pledge', requireAuth, async (req, res) => {
    const kingdom = await db.get('SELECT id FROM kingdoms WHERE player_id = $1', [req.player.playerId]);
    const { pledge } = req.body;
    const p = Math.max(0, Math.min(10, Number(pledge) || 3));
    await db.run('UPDATE alliance_members SET pledge = $1 WHERE kingdom_id = $2', [p, kingdom.id]);
    res.json({ ok: true, pledge: p });
  });

  router.post('/dismiss', requireAuth, async (req, res) => {
    const kingdom = await db.get('SELECT id FROM kingdoms WHERE player_id = $1', [req.player.playerId]);
    const alliance = await db.get('SELECT * FROM alliances WHERE leader_id = $1', [kingdom.id]);
    if (!alliance) return res.status(403).json({ error: 'Only leader can dismiss members' });
    const { targetKingdomId } = req.body;
    if (targetKingdomId === kingdom.id) return res.status(400).json({ error: 'Cannot dismiss yourself' });
    await db.run('DELETE FROM alliance_members WHERE kingdom_id = $1 AND alliance_id = $2', [targetKingdomId, alliance.id]);
    await db.run('UPDATE kingdoms SET alliance_buffs = \'{}\' WHERE id = $1', [targetKingdomId]);
    res.json({ ok: true });
  });

  router.post('/create', requireAuth, async (req, res) => {
    try {
      const { name } = req.body;
      if (!name?.trim()) return res.status(400).json({ error: 'Alliance name required' });
      const kingdom = await db.get('SELECT * FROM kingdoms WHERE player_id = $1', [req.player.playerId]);
      if (!kingdom) return res.status(404).json({ error: 'Kingdom not found' });

      const allianceId = await db.withTransaction(async () => {
        const k = await db.get('SELECT id FROM kingdoms WHERE id = $1 FOR UPDATE', [kingdom.id]);
        if (!k) throw httpError(404, 'Kingdom not found');

        const leading = await db.get('SELECT id FROM alliances WHERE leader_id = $1', [kingdom.id]);
        if (leading) {
          throw httpError(400, 'You cannot create a new alliance while leading an existing one. Disband it first.');
        }

        await db.run('DELETE FROM alliance_members WHERE kingdom_id = $1', [kingdom.id]);
        const result = await db.run('INSERT INTO alliances (name, leader_id) VALUES ($1, $2)', [name.trim(), kingdom.id]);
        await db.run('INSERT INTO alliance_members (alliance_id, kingdom_id, pledge) VALUES ($1, $2, 3)', [result.lastID, kingdom.id]);
        return result.lastID;
      });

      res.json({ ok: true, allianceId });
    } catch (err) {
      if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
      if (err.message && err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Alliance name taken' });
      res.status(500).json({ error: 'Server error' });
    }
  });

  router.post('/invite', requireAuth, async (req, res) => {
    try {
      const kingdom = await db.get('SELECT * FROM kingdoms WHERE player_id = $1', [req.player.playerId]);
      const membership = await db.get('SELECT * FROM alliance_members WHERE kingdom_id = $1', [kingdom.id]);
      if (!membership) return res.status(400).json({ error: 'You are not in an alliance' });
      const alliance = await db.get('SELECT * FROM alliances WHERE id = $1', [membership.alliance_id]);
      if (alliance.leader_id !== kingdom.id) return res.status(403).json({ error: 'Only the leader can invite' });

      const targetKingdomId = req.body.targetKingdomId;
      await db.withTransaction(async () => {
        const target = await db.get('SELECT id FROM kingdoms WHERE id = $1 FOR UPDATE', [targetKingdomId]);
        if (!target) throw httpError(404, 'Target kingdom not found');

        const existingMembership = await db.get('SELECT alliance_id FROM alliance_members WHERE kingdom_id = $1', [targetKingdomId]);
        if (existingMembership) throw httpError(400, 'Target kingdom is already in an alliance');

        await db.run('INSERT INTO alliance_members (alliance_id, kingdom_id) VALUES ($1, $2)', [membership.alliance_id, targetKingdomId]);
        await db.run('UPDATE kingdoms SET alliance_buffs = $1 WHERE id = $2', [alliance.projects || '{}', targetKingdomId]);
      });

      res.json({ ok: true });
    } catch (e) {
      if (e.statusCode) return res.status(e.statusCode).json({ error: e.message });
      res.status(409).json({ error: 'Failed to invite kingdom' });
    }
  });

  router.post('/leave', requireAuth, async (req, res) => {
    try {
      const kingdom = await db.get('SELECT id FROM kingdoms WHERE player_id = $1', [req.player.playerId]);

      await db.withTransaction(async () => {
        const alliance = await db.get('SELECT * FROM alliances WHERE leader_id = $1 FOR UPDATE', [kingdom.id]);
        if (alliance) {
          await db.run('UPDATE kingdoms SET alliance_buffs = \'{}\' WHERE id IN (SELECT kingdom_id FROM alliance_members WHERE alliance_id = $1)', [alliance.id]);
          await db.run('DELETE FROM alliance_members WHERE alliance_id = $1', [alliance.id]);
          await db.run('DELETE FROM alliances WHERE id = $1', [alliance.id]);
        } else {
          await db.run('DELETE FROM alliance_members WHERE kingdom_id = $1', [kingdom.id]);
          await db.run('UPDATE kingdoms SET alliance_buffs = \'{}\' WHERE id = $1', [kingdom.id]);
        }
      });

      res.json({ ok: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to leave alliance' });
    }
  });

  return router;
};
