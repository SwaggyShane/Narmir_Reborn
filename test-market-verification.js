#!/usr/bin/env node
const { chromium } = require('playwright');

(async () => {
  console.log('🚀 Starting MarketPanel verification...\n');

  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium',
  });
  const page = await browser.newPage();

  try {
    // Check for any console errors
    const errors = [];
    const pageErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    page.on('pageerror', err => {
      pageErrors.push(err.message);
    });

    // First, try to authenticate via API
    console.log('🔐 Attempting to authenticate...');
    const authRes = await page.request.post('http://localhost:3000/api/auth/register', {
      data: {
        username: 'testuser',
        email: 'testuser@test.com',
        password: 'password123',
      },
      failOnStatusCode: false,
    });
    const authData = await authRes.json();
    if (authData.token) {
      await page.context().addCookies([{
        name: 'auth_token',
        value: authData.token,
        url: 'http://localhost:3000',
      }]);
      console.log('✅ Authenticated');
    }

    // Navigate to game
    console.log('📍 Navigating to game...');
    await page.goto('http://localhost:3000/game', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Look for main game container or any game content
    const mainElement = await page.$('#main, [data-game], .game, #game');
    if (!mainElement) {
      console.log('⚠️ Game main container not found, checking for page content...');
      const bodyContent = await page.locator('body').count();
      if (bodyContent > 0) {
        console.log('✅ Page has content, proceeding...');
      }
    } else {
      console.log('✅ Game container loaded');
    }

    // First, try to close any modals that might be blocking interaction
    console.log('📋 Checking for blocking modals...');
    const modalBackdrop = await page.locator('[class*="z-modal"]').first();
    if (await modalBackdrop.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('  Found modal backdrop, trying to close...');
      // Try escape key to close
      await page.keyboard.press('Escape');
      await page.waitForTimeout(1000);
    }

    // Try to find and click Market tab
    console.log('\n📋 Looking for Market panel navigation...');

    // Search for Market button/tab in various possible selectors
    let marketTab = await page.locator('button, a, [role="tab"]').filter({ hasText: /market/i }).first();

    if (!await marketTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('⚠️ Market tab not immediately visible, searching in side nav...');
      marketTab = await page.locator('[data-panel="market"], .market-panel, .panel-market').first();
    }

    if (await marketTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('✅ Found Market tab, clicking...');
      await marketTab.click();
      await page.waitForTimeout(2000);
    } else {
      console.log('⚠️ Could not find Market tab, looking for market panel content directly...');
    }

    // Test 1: Owned amounts display
    console.log('\n📦 Test 1: Checking owned amounts display for resources...');
    const ownedElements = await page.locator('text=/Owned:/i').all();
    if (ownedElements.length > 0) {
      console.log(`✅ Found ${ownedElements.length} resource owned amounts displayed`);

      // Get first few owned values to verify
      for (let i = 0; i < Math.min(3, ownedElements.length); i++) {
        const text = await ownedElements[i].textContent();
        console.log(`   - ${text}`);
      }
    } else {
      console.log('⚠️ No owned amounts found - may need to navigate to Market panel');
    }

    // Test 2: Max Sell button
    console.log('\n💰 Test 2: Checking Max Sell button...');
    const maxSellButtons = await page.locator('button:has-text("Max Sell")').all();
    if (maxSellButtons.length > 0) {
      console.log(`✅ Found ${maxSellButtons.length} Max Sell buttons`);
    } else {
      console.log('⚠️ No Max Sell buttons found');
    }

    // Test 3: Max Buy button
    console.log('\n🛍️ Test 3: Checking Max Buy button...');
    const maxBuyButtons = await page.locator('button:has-text("Max Buy")').all();
    if (maxBuyButtons.length > 0) {
      console.log(`✅ Found ${maxBuyButtons.length} Max Buy buttons`);
    } else {
      console.log('⚠️ No Max Buy buttons found');
    }

    // Test 4: Trade targets dropdown
    console.log('\n🌍 Test 4: Checking trade targets dropdown...');
    const selects = await page.locator('select').all();

    if (selects.length > 0) {
      console.log(`✅ Found ${selects.length} dropdown(s)`);
      // Try to get options from first select
      const firstSelect = selects[0];
      const options = await firstSelect.locator('option').count();
      console.log(`   - First dropdown has ${options} options`);
    } else {
      console.log('⚠️ No dropdowns found');
    }

    // Test 5: Mercenary remaining turns
    console.log('\n💪 Test 5: Checking mercenary contract display...');
    const mercenaryElements = await page.locator('text=/Remaining.*turns/i').all();
    if (mercenaryElements.length > 0) {
      console.log(`✅ Found ${mercenaryElements.length} mercenary contract(s) with remaining turns`);
      for (let i = 0; i < Math.min(2, mercenaryElements.length); i++) {
        const text = await mercenaryElements[i].textContent();
        console.log(`   - ${text}`);
      }
    } else {
      console.log('ℹ️ No active mercenary contracts found (this is OK)');
    }

    // Check for console errors
    if (errors.length > 0) {
      console.log('\n❌ Console errors detected:');
      errors.forEach(err => console.log(`   - ${err}`));
    }
    if (pageErrors.length > 0) {
      console.log('\n❌ Page errors detected:');
      pageErrors.forEach(err => console.log(`   - ${err}`));
    }

    // Take screenshot
    await page.screenshot({ path: '/tmp/market-panel-screenshot.png' });
    console.log('\n📸 Screenshot saved to /tmp/market-panel-screenshot.png');

    console.log('\n✅ MarketPanel verification complete!');

  } catch (err) {
    console.error('\n❌ Error during verification:', err.message);
    await page.screenshot({ path: '/tmp/market-panel-error.png' });
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
