#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const testDir = path.join(__dirname, '..', 'test');
const files = fs.readdirSync(testDir)
  .filter((name) => name.endsWith('.test.js'))
  .sort();

if (!files.length) {
  console.error('No test files found in test/');
  process.exit(1);
}

let failed = 0;

for (const file of files) {
  const filePath = path.join(testDir, file);
  process.stdout.write(`\n▶ ${file}\n`);
  const result = spawnSync(process.execPath, [filePath], {
    stdio: 'inherit',
    env: process.env,
  });
  if (result.status !== 0) {
    failed += 1;
    console.error(`✗ ${file} failed (exit ${result.status ?? 'signal'})`);
  }
}

if (failed) {
  console.error(`\n${failed} test file(s) failed.`);
  process.exit(1);
}

console.log(`\n✓ All ${files.length} test files passed.`);