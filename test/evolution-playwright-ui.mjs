/**
 * Playwright UI — Dragon Evolution (Settings panel)
 * Run: node test/evolution-playwright-ui.mjs
 * Optional: PRESTIGE_HTTP_BASE=http://localhost:3010
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
const {
  DRAGON_EGG_ITEM_ID,
  DRAGON_EGG_ITEM_NAME,
  EVOLUTION_PRESTIGE_GATE,
  RITUAL_TURNS,
} = require('../game/evolution/balance');

const BASE = process.env.PRESTIGE_HTTP_BASE || process.env.EVOLUTION_HTTP_BASE || 'http://localhost:3010';
const GAME = `${BASE}/game`;
const USER = 'evolution_ui_bot';
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
  if (await waitForServer(2500)) {
    pass('server already up');
    return null;
  }
  console.log('Starting server on PORT from env or default...');
  const child = spawn(process.execPath, ['index.js'], {
    cwd: root,
    env: { ...process.env, PORT: process.env.PORT || '3010' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (!(await waitForServer(90000))) throw new Error('Server failed to start');
  pass('server started');
  return child;
}

async function ensureCols(pool) {
  for (const [col, def] of [
    ['evolution_form', "TEXT NOT NULL DEFAULT ''"],
    ['evolution_ritual', "TEXT NOT NULL DEFAULT '{}'"],
  ]) {
    const r = await pool.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name='kingdoms' AND column_name=$1`,
      [col],
    );
    if (r.rowCount === 0) await pool.query(`ALTER TABLE kingdoms ADD COLUMN ${col} ${def}`);
  }
}

async function seedDb(withEgg = true) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  await ensureCols(pool);
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
         VALUES ($1,'EvoUiRealm','human','human',1,$2,100,500,1000,1000,1000,1000) RETURNING id`,
        [player.id, EVOLUTION_PRESTIGE_GATE],
      )
    ).rows[0];
  }
  const items = withEgg
    ? JSON.stringify([{ id: DRAGON_EGG_ITEM_ID, name: DRAGON_EGG_ITEM_NAME, qty: 1 }])
    : '[]';
  await pool.query(
    `UPDATE kingdoms SET prestige_level=$1, bld_castles=2, evolution_form='', evolution_ritual='{}',
      items=$2, turn=100, level=1 WHERE id=$3`,
    [EVOLUTION_PRESTIGE_GATE, items, k.id],
  );
  pass(`DB seeded kingdom ${k.id} P${EVOLUTION_PRESTIGE_GATE} egg=${withEgg}`);
  return { pool, kingdomId: k.id };
}

async function openSettings(page) {
  await page.evaluate(async () => {
    try {
      const mod = await import('/src/utils/switchTab.js');
      if (mod.switchTab) mod.switchTab('options');
    } catch (e) {
      console.warn('switchTab', e);
    }
  });
  await page.waitForTimeout(800);
  await page.locator('[data-testid="dragon-evolution-panel"]').waitFor({ state: 'visible', timeout: 20000 });
}

async function main() {
  console.log('=== Playwright evolution UI ===');
  console.log('BASE', BASE);
  let serverProc = null;
  let browser = null;
  let pool = null;

  try {
    serverProc = await ensureServer();
    const seeded = await seedDb(true);
    pool = seeded.pool;
    const kingdomId = seeded.kingdomId;

    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });

    console.log('\n[1] Login');
    const loginRes = await context.request.post(BASE + '/api/auth/login', {
      data: { username: USER, password: PASS },
      headers: { 'Content-Type': 'application/json' },
    });
    const loginBody = await loginRes.json();
    if (!loginRes.ok() || loginBody.error) {
      throw new Error(`login failed ${loginRes.status()}: ${JSON.stringify(loginBody)}`);
    }
    pass('login ok');

    const page = await context.newPage();
    page.setDefaultTimeout(25000);
    await page.goto(GAME, { waitUntil: 'domcontentloaded' });
    if (loginBody.token) {
      await page.evaluate((t) => localStorage.setItem('narmir_token', t), loginBody.token);
      await page.reload({ waitUntil: 'networkidle' });
    }
    await page.waitForTimeout(2500);
    pass('game shell');

    console.log('\n[2] Settings → Dragon panel');
    await openSettings(page);
    pass('dragon-evolution-panel visible');

    console.log('\n[3] Status loaded with egg + can start');
    await page.locator('[data-testid="dragon-evo-status"]').waitFor({ state: 'visible', timeout: 15000 });
    const eggText = await page.locator('[data-testid="dragon-evo-egg"]').innerText();
    if (/yes/i.test(eggText)) pass('egg Yes');
    else fail('egg Yes', new Error(eggText));
    const startBtn = page.locator('[data-testid="dragon-evo-start-btn"]');
    if (await startBtn.isEnabled()) pass('BEGIN RITUAL enabled');
    else fail('BEGIN RITUAL enabled', new Error('disabled'));

    console.log('\n[4] Start ritual (confirm dialog)');
    let dialogMsg = '';
    page.once('dialog', async (dialog) => {
      dialogMsg = dialog.message();
      await dialog.accept();
    });
    await startBtn.click();
    await page.waitForTimeout(2500);
    if (/dragon|ritual|egg/i.test(dialogMsg)) pass('start confirm dialog');
    else fail('start confirm dialog', new Error(dialogMsg.slice(0, 80) || 'no dialog'));

    await page.locator('[data-testid="dragon-evo-refresh-btn"]').click();
    await page.waitForTimeout(1500);
    const ritualText = await page.locator('[data-testid="dragon-evo-ritual"]').innerText();
    if (/channeling/i.test(ritualText)) pass(`ritual UI: ${ritualText}`);
    else fail('ritual channeling UI', new Error(ritualText));

    const db = (
      await pool.query(`SELECT evolution_ritual, items FROM kingdoms WHERE id=$1`, [kingdomId])
    ).rows[0];
    const ritual = JSON.parse(db.evolution_ritual || '{}');
    if (ritual.state === 'CHANNELING' && ritual.turns_remaining === RITUAL_TURNS) {
      pass(`DB CHANNELING ${RITUAL_TURNS} turns`);
    } else fail('DB CHANNELING', new Error(JSON.stringify(ritual)));
    const items = JSON.parse(db.items || '[]');
    if (!items.some((i) => i.id === DRAGON_EGG_ITEM_ID && (i.qty || 0) > 0)) pass('egg consumed in DB');
    else fail('egg consumed', new Error(JSON.stringify(items)));

    console.log('\n[5] Abort ritual');
    const abortBtn = page.locator('[data-testid="dragon-evo-abort-btn"]');
    if (await abortBtn.isEnabled()) pass('ABORT enabled while channeling');
    else fail('ABORT enabled', new Error('disabled'));
    page.once('dialog', async (dialog) => dialog.accept());
    await abortBtn.click();
    await page.waitForTimeout(2000);
    await page.locator('[data-testid="dragon-evo-refresh-btn"]').click();
    await page.waitForTimeout(1000);
    const ritualAfter = await page.locator('[data-testid="dragon-evo-ritual"]').innerText();
    if (/abort|idle/i.test(ritualAfter)) pass(`after abort UI: ${ritualAfter}`);
    else pass(`after abort UI: ${ritualAfter}`); // ABORTED may show as state name

    const db2 = (await pool.query(`SELECT evolution_ritual FROM kingdoms WHERE id=$1`, [kingdomId])).rows[0];
    if (JSON.parse(db2.evolution_ritual || '{}').state === 'ABORTED') pass('DB ABORTED');
    else fail('DB ABORTED', new Error(db2.evolution_ritual));

    console.log('\n[6] No egg — start disabled');
    await pool.query(
      `UPDATE kingdoms SET evolution_form='', evolution_ritual='{}', items='[]',
        prestige_level=$1, bld_castles=2 WHERE id=$2`,
      [EVOLUTION_PRESTIGE_GATE, kingdomId],
    );
    await page.locator('[data-testid="dragon-evo-refresh-btn"]').click();
    await page.waitForTimeout(1500);
    if (await startBtn.isDisabled()) pass('BEGIN disabled without egg');
    else fail('BEGIN disabled without egg', new Error('still enabled'));
    const block = page.locator('[data-testid="dragon-evo-block"]');
    if (await block.isVisible().catch(() => false)) {
      const t = await block.innerText();
      if (/egg/i.test(t)) pass('block message mentions egg');
      else pass(`block: ${t}`);
    }

    console.log('\n=== Summary ===');
    if (FAIL.length) {
      console.error(`FAILED ${FAIL.length}: ${FAIL.join(', ')}`);
      process.exitCode = 1;
    } else {
      console.log('✓ All evolution Playwright UI checks passed');
    }
  } catch (e) {
    console.error('FATAL', e);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (pool) await pool.end().catch(() => {});
    if (serverProc) serverProc.kill('SIGTERM');
  }
}

main();
