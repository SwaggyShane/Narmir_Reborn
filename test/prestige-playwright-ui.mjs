/**
 * Playwright UI — Prestige rebirth (Options / Settings → ASCEND EMPIRE)
 * Run from feature/prestige-rebirth: node test/prestige-playwright-ui.mjs
 */
import { chromium } from 'playwright';
import { spawn } from 'child_process';
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const envPath = path.join(root, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m && !process.env[m[1].trim()]) {
      process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
    }
  }
}

const bcrypt = require('bcrypt');
const { Pool } = require('pg');
const { landSeed, goldSeed } = require('../game/prestige/balance');

const BASE = process.env.PRESTIGE_HTTP_BASE || 'http://localhost:3000';
/** React game shell (root `/` is splash, not GameShell) */
const GAME = `${BASE}/game`;
const USER = 'prestige_test_bot';
const PASS = 'TestPass1!';
const FAIL = [];
const pass = (m) => console.log(`  ✓ ${m}`);
const fail = (m, e) => {
  console.error(`  ✗ ${m}:`, e?.message || e);
  FAIL.push(m);
};

async function waitForServer(timeoutMs = 90000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(BASE + '/');
      if (r.status > 0) return true;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

async function ensureServer() {
  if (await waitForServer(2000)) {
    pass('server already up');
    return null;
  }
  console.log('Starting server...');
  const child = spawn(process.execPath, ['index.js'], {
    cwd: root,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
  });
  child.stdout.on('data', () => {});
  child.stderr.on('data', () => {});
  if (!(await waitForServer(90000))) throw new Error('Server failed to start');
  pass('server started');
  return child;
}

async function seedDb() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const hash = await bcrypt.hash(PASS, 10);
  let player = (await pool.query(`SELECT id FROM players WHERE username=$1`, [USER])).rows[0];
  if (!player) {
    player = (
      await pool.query(`INSERT INTO players (username, password, is_admin) VALUES ($1,$2,0) RETURNING id`, [
        USER,
        hash,
      ])
    ).rows[0];
  } else {
    await pool.query(`UPDATE players SET password=$1 WHERE id=$2`, [hash, player.id]);
  }
  let k = (await pool.query(`SELECT id FROM kingdoms WHERE player_id=$1`, [player.id])).rows[0];
  if (!k) {
    k = (
      await pool.query(
        `INSERT INTO kingdoms (player_id, name, race, region, level, prestige_level, turn, land, gold, food, mana, population)
         VALUES ($1,'PrestigeTestRealm','human','human',500,0,5000,9999,1,1,1,100) RETURNING id`,
        [player.id],
      )
    ).rows[0];
  }
  await pool.query(
    `UPDATE kingdoms SET level=500, prestige_level=0, last_prestige_turn=0, turn=6000,
      fighters=1234, bld_castles=8, bld_markets=15, bld_farms=200, land=9999, gold=1,
      world_fragments=$1, items=$2 WHERE id=$3`,
    [JSON.stringify([{ id: 'ui_frag' }]), JSON.stringify([{ id: 'ui_item' }]), k.id],
  );
  pass(`DB seeded kingdom ${k.id} at level 500`);
  return { pool, kingdomId: k.id, playerId: player.id };
}

async function openSettings(page) {
  // Dev server: dynamic import of panel router (hash alone does not switch panels)
  await page.evaluate(async () => {
    try {
      const mod = await import('/src/utils/switchTab.js');
      if (mod.switchTab) mod.switchTab('options');
    } catch (e) {
      console.warn('switchTab import failed', e);
    }
  });
  await page.waitForTimeout(800);

  if (!(await page.locator('#rebirth-btn').isVisible().catch(() => false))) {
    // UI path: More drawer → Settings
    const more = page.locator('button').filter({ hasText: /more/i }).or(page.locator('nav button').filter({ hasText: '⋯' }));
    if (await more.count()) {
      await more.first().click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(400);
    }
    const settings = page.locator('button').filter({ hasText: /settings/i });
    if (await settings.count()) await settings.first().click({ timeout: 8000 });
  }

  // Screenshot aid if still missing
  if (!(await page.locator('#rebirth-btn').isVisible().catch(() => false))) {
    const html = await page.content();
    console.log('  page title', await page.title());
    console.log('  has #options', html.includes('id="options"') || html.includes("id='options'"));
    console.log('  has ASCEND', /ASCEND/i.test(html));
    console.log('  body snippet', (await page.locator('body').innerText()).slice(0, 400).replace(/\s+/g, ' '));
  }

  await page.locator('#rebirth-btn').waitFor({ state: 'visible', timeout: 20000 });
}

async function main() {
  console.log('=== Playwright prestige UI ===');
  console.log('BASE', BASE);
  let serverProc = null;
  let browser = null;
  let pool = null;

  try {
    serverProc = await ensureServer();
    const seeded = await seedDb();
    pool = seeded.pool;
    const kingdomId = seeded.kingdomId;

    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });

    // Cookie/session login via API (matches production auth; skips flaky modal bootstrap)
    console.log('\n[1] Auth via /api/auth/login');
    const loginRes = await context.request.post(BASE + '/api/auth/login', {
      data: { username: USER, password: PASS },
      headers: { 'Content-Type': 'application/json' },
    });
    const loginBody = await loginRes.json();
    if (!loginRes.ok() || loginBody.error) {
      throw new Error(`login failed ${loginRes.status()}: ${JSON.stringify(loginBody)}`);
    }
    pass(`API login ok (token ${loginBody.token ? 'present' : 'cookie-only'})`);

    const page = await context.newPage();
    page.setDefaultTimeout(25000);

    await page.goto(GAME, { waitUntil: 'domcontentloaded' });
    if (loginBody.token) {
      await page.evaluate((t) => localStorage.setItem('narmir_token', t), loginBody.token);
      await page.reload({ waitUntil: 'networkidle' });
    } else {
      await page.waitForLoadState('networkidle');
    }
    await page.waitForTimeout(2500);
    // Ensure React shell (not splash)
    const title = await page.title();
    if (/Rise From Darkness/i.test(title) && !(await page.locator('#app').count())) {
      throw new Error(`Landed on splash instead of /game (title=${title})`);
    }
    pass('game shell loaded with session');

    console.log('\n[2] Open Settings panel');
    await openSettings(page);
    pass('Settings open, #rebirth-btn visible');

    console.log('\n[3] Level 500 UI');
    const ascend = page.locator('#rebirth-btn');
    if (await ascend.isDisabled()) fail('button enabled at L500', new Error('disabled'));
    else pass('ASCEND EMPIRE enabled');

    const panelText = await page.locator('#options').innerText().catch(() => page.locator('body').innerText());
    if (/500/.test(panelText)) pass('panel references 500');
    else fail('panel references 500', new Error(panelText.slice(0, 150)));
    if (/550/.test(panelText) || /New land/i.test(panelText)) pass('land preview present');
    else console.warn('  ? land preview text weak');

    console.log('\n[4] Confirm dialog + Ascend');
    let dialogMsg = '';
    page.once('dialog', async (dialog) => {
      dialogMsg = dialog.message();
      console.log('  dialog snippet:', dialogMsg.slice(0, 180).replace(/\n/g, ' | '));
      await dialog.accept();
    });
    await ascend.click();
    await page.waitForTimeout(4000);
    await page.waitForLoadState('networkidle').catch(() => {});
    if (/Rebirth to Prestige|Prestige 1/i.test(dialogMsg)) pass('confirm dialog content');
    else if (dialogMsg) fail('confirm dialog content', new Error(dialogMsg.slice(0, 80)));
    else fail('confirm dialog', new Error('no dialog fired'));
    if (/550|land/i.test(dialogMsg)) pass('dialog mentions land seed');

    console.log('\n[5] DB after UI rebirth');
    const after = (
      await pool.query(
        `SELECT level, prestige_level, land, gold, fighters, bld_castles, bld_farms, last_prestige_turn
         FROM kingdoms WHERE id=$1`,
        [kingdomId],
      )
    ).rows[0];
    console.log('  DB', after);
    try {
      if (Number(after.prestige_level) !== 1) throw new Error(`prestige_level=${after.prestige_level}`);
      if (Number(after.level) !== 1) throw new Error(`level=${after.level}`);
      if (Number(after.land) !== landSeed(1)) throw new Error(`land=${after.land}`);
      if (Number(after.gold) !== goldSeed(1)) throw new Error(`gold=${after.gold}`);
      if (Number(after.fighters) !== 0) throw new Error(`fighters=${after.fighters}`);
      if (Number(after.bld_castles) !== 0) throw new Error(`castles=${after.bld_castles}`);
      if (Number(after.bld_farms) !== 5) throw new Error(`farms=${after.bld_farms}`);
      pass('DB wipe contract after UI flow');
    } catch (e) {
      fail('DB after UI', e);
    }

    console.log('\n[6] After rebirth — reload UI shows level 1 + seeds + disabled');
    await page.goto(GAME, { waitUntil: 'domcontentloaded' });
    if (loginBody.token) {
      await page.evaluate((t) => localStorage.setItem('narmir_token', t), loginBody.token);
      await page.reload({ waitUntil: 'networkidle' });
    }
    await page.waitForTimeout(2500);
    await openSettings(page);
    // On-screen kingdom level after /me load
    const levelEl = page.locator('[data-testid="prestige-kingdom-level"]');
    const levelText = await levelEl.innerText().catch(() => '');
    if (String(levelText).trim() === '1') pass('on-screen kingdom level 1 after reload');
    else fail('on-screen kingdom level 1', new Error(`got "${levelText}"`));
    const prestigeEl = page.locator('[data-testid="prestige-current"]');
    const prestigeText = await prestigeEl.innerText().catch(() => '');
    if (String(prestigeText).trim() === '1') pass('on-screen prestige 1 after reload');
    else fail('on-screen prestige 1', new Error(`got "${prestigeText}"`));
    // Preview for next rebirth still shows seeds for P2
    const previewLand = await page.locator('[data-testid="prestige-preview-land"]').innerText().catch(() => '');
    if (previewLand.includes(String(landSeed(2)))) pass(`preview land for P2 = ${landSeed(2)}`);
    else console.warn('  ? preview land after P1:', previewLand);
    if (await page.locator('#rebirth-btn').isDisabled()) pass('disabled at level 1');
    else fail('disabled at level 1', new Error('still enabled'));
    // Cooldown message while L1 (level block may show first)
    const blockLevel = await page.locator('[data-testid="prestige-block-level"]').isVisible().catch(() => false);
    if (blockLevel) pass('level block message visible at L1');

    console.log('\n[7] Level 499 — still disabled');
    await pool.query(`UPDATE kingdoms SET level=499, prestige_level=1, last_prestige_turn=0, turn=7000 WHERE id=$1`, [
      kingdomId,
    ]);
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await openSettings(page);
    if (await page.locator('#rebirth-btn').isDisabled()) pass('disabled at level 499');
    else fail('disabled at 499', new Error('enabled'));

    console.log('\n[8] Level 500 + active cooldown — disabled + cooldown copy');
    // last_prestige_turn = 7000, turn = 7100 => 100 turns into 200 cooldown => 100 remaining
    await pool.query(
      `UPDATE kingdoms SET level=500, prestige_level=1, last_prestige_turn=7000, turn=7100 WHERE id=$1`,
      [kingdomId],
    );
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(2500);
    await openSettings(page);
    if (await page.locator('#rebirth-btn').isDisabled()) pass('disabled during cooldown at L500');
    else fail('disabled during cooldown', new Error('enabled'));
    const cdVisible = await page.locator('[data-testid="prestige-block-cooldown"]').isVisible().catch(() => false);
    const cdText = cdVisible
      ? await page.locator('[data-testid="prestige-block-cooldown"]').innerText()
      : '';
    if (cdVisible && /cooldown|turn/i.test(cdText)) pass(`cooldown message: ${cdText.slice(0, 80)}`);
    else fail('cooldown message visible', new Error(cdText || 'missing'));

    console.log('\n[9] Level 500 + cooldown cleared — enabled');
    await pool.query(
      `UPDATE kingdoms SET level=500, prestige_level=1, last_prestige_turn=0, turn=8000 WHERE id=$1`,
      [kingdomId],
    );
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await openSettings(page);
    if (!(await page.locator('#rebirth-btn').isDisabled())) pass('enabled at level 500 with no cooldown');
    else fail('enabled at 500 no cooldown', new Error('disabled'));

    await browser.close();
    browser = null;

    console.log('\n=== Playwright summary ===');
    if (FAIL.length) {
      console.error(`FAILED ${FAIL.length}: ${FAIL.join(', ')}`);
      process.exitCode = 1;
    } else {
      console.log('✓ Playwright prestige UI checks passed');
    }
  } catch (err) {
    console.error('FATAL', err);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (pool) await pool.end().catch(() => {});
    if (serverProc) {
      try {
        serverProc.kill('SIGTERM');
      } catch {
        /* ignore */
      }
    }
  }
}

main();
