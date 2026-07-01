'use strict';
// Regression: game/news-emoji.js's matchNewsRule() has a fallback "probe"
// loop that shifts one character at a time through a message looking for a
// recognized emoji-rule pattern, to recover an icon when leading corruption
// couldn't be cleanly stripped. The bug: it returned the *shifted probe* as
// the message TEXT, not just used it to pick an emoji — so any legitimate
// multi-sentence message whose first sentence has no matching rule (e.g.
// "Completed: X. Actively constructing: Y.") got silently truncated down to
// just the second sentence. This is why players stopped seeing "Completed:"
// toasts: the client's useGameActions.js looks for the literal substring
// "Completed: " in the turn event message, which the server had already
// deleted before the response ever left the API.
//
// game/news-emoji.mjs is a hand-kept-in-sync ESM duplicate (per its own
// comment) — checked here too, both behaviorally and for source drift.
//
// Run: node test/news-emoji-truncation.test.js

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { decorateNewsMessage, formatNewsMessage } = require('../game/news-emoji.js');

// Test 1: a "Completed: X." sentence followed by a recognized "Actively
// constructing:" sentence must not be truncated.
{
  const raw = '🏗️ Completed: 4 farms. Actively constructing: 4 farms concluding [~4 next turn] (Using 200 gc & 40 land).';
  const text = decorateNewsMessage(raw, (x) => x);
  assert.ok(text.startsWith('Completed: 4 farms.'), `expected text to start with "Completed: 4 farms.", got: "${text}"`);
  assert.ok(text.includes('Actively constructing:'), `expected the rest of the message to survive too: "${text}"`);
  console.log('Test 1: "Completed:" prefix survives when followed by a recognized sentence ✓');
}

// Test 2: emoji is still correctly picked from the recognized sentence even
// though the text itself is preserved in full.
{
  const raw = '🏗️ Completed: 4 farms. Actively constructing: 4 farms concluding [~4 next turn] (Using 200 gc & 40 land).';
  const { emoji, text } = formatNewsMessage(raw, (x) => x);
  assert.strictEqual(emoji, '🏗️', `expected the construction emoji to be recovered, got: "${emoji}"`);
  assert.ok(text.startsWith('Completed: 4 farms.'), 'emoji recovery must not truncate the text');
  console.log('Test 2: probe fallback recovers the right emoji without truncating text ✓');
}

// Test 3: a message with NO recognized rule anywhere stays fully intact
// (falls through to the default emoji, full original text).
{
  const raw = 'Some entirely novel system message with no matching rule.';
  const text = decorateNewsMessage(raw, (x) => x);
  assert.strictEqual(text, raw, `unmatched messages must be returned unchanged, got: "${text}"`);
  console.log('Test 3: unmatched messages pass through unchanged ✓');
}

// Test 4: source-drift guard — game/news-emoji.mjs is a manually-synced ESM
// duplicate of game/news-emoji.js (per the comment at the bottom of both
// files). Assert their matchNewsRule() function bodies stay identical so a
// fix applied to one doesn't silently miss the other, like this bug did
// briefly during development.
{
  const extractFn = (src) => {
    const start = src.indexOf('function matchNewsRule');
    const end = src.indexOf('\nfunction formatNewsMessage', start);
    assert.ok(start !== -1 && end !== -1, 'could not locate matchNewsRule() in source');
    return src.slice(start, end).trim();
  };
  const jsSrc = fs.readFileSync(path.join(__dirname, '../game/news-emoji.js'), 'utf8');
  const mjsSrc = fs.readFileSync(path.join(__dirname, '../game/news-emoji.mjs'), 'utf8');
  assert.strictEqual(extractFn(jsSrc), extractFn(mjsSrc), 'news-emoji.js and news-emoji.mjs matchNewsRule() have drifted out of sync');
  console.log('Test 4: news-emoji.js and news-emoji.mjs matchNewsRule() stay in sync ✓');
}

console.log('news-emoji-truncation checks passed');
