/**
 * Regression tests for Gemini PR #730 review findings.
 */
const assert = require('assert');
const { gravatarUrl } = require('../lib/forum-profiles');

const url = gravatarUrl('test@example.com', 48);
assert.ok(url.includes('?d=identicon'), 'gravatar query string must use ? not $1');
assert.ok(!url.includes('$1d='), 'gravatar URL must not contain corrupted placeholder');

console.log('db-gemini regression checks passed');