# Mojibake Fix — Narmir Reborn

## What Happened

Every non-ASCII character in ~36 game source files is **triple-encoded**.  
The original bytes (emojis, em-dashes, etc.) were passed through the cycle:

```
UTF-8 bytes → each byte read as cp1252 codepoint → re-encoded as UTF-8
```

…three times over. This happened in the editor/tooling that touched these files during the sprint.

The rendering pipeline (Node → Postgres → JSON → browser) is clean — it passes bytes through unchanged. The corruption lives entirely in the source `.js` files (and consequently in any DB rows written since the sprint).

`game/lore.js` is the only game file that was NOT affected.

---

## Step 1 — Run the Automated Fix Script

Save the script below as `fix_mojibake.py` in the repo root, then run it.

```python
#!/usr/bin/env python3
"""
Fixes triple-encoded cp1252→UTF-8 mojibake in Narmir Reborn source files.
Run from the repo root: python3 fix_mojibake.py
"""
import os, sys

# Build cp1252 reverse mapping (char → original byte value)
cp1252_reverse = {}
for byte_val in range(256):
    try:
        char = bytes([byte_val]).decode('cp1252')
        cp1252_reverse[char] = byte_val
    except Exception:
        pass

def un_encode_once(b: bytes):
    """One round: read bytes as UTF-8, reverse-map each codepoint back through cp1252."""
    try:
        s = b.decode('utf-8')
    except UnicodeDecodeError:
        return None
    out = []
    for ch in s:
        if ch in cp1252_reverse:
            out.append(cp1252_reverse[ch])
        else:
            return None  # codepoint not in cp1252 — stop here
    return bytes(out)

def fully_decode(raw: bytes) -> bytes:
    """Keep un-encoding until the result stops changing or becomes invalid UTF-8."""
    b = raw
    for _ in range(5):
        b2 = un_encode_once(b)
        if b2 is None:
            break
        try:
            b2.decode('utf-8')
        except UnicodeDecodeError:
            break
        if b2 == b:
            break
        b = b2
    return b

def fix_file(filepath: str):
    with open(filepath, 'rb') as f:
        content = f.read()

    result = bytearray()
    unfixed = []
    i = 0

    while i < len(content):
        if content[i] < 0x80:
            result.append(content[i])
            i += 1
        else:
            # Collect contiguous high bytes (≥ 0x80)
            start = i
            while i < len(content) and content[i] >= 0x80:
                i += 1
            span = content[start:i]
            fixed = fully_decode(span)
            result.extend(fixed)
            if fixed != span:
                orig_str = span.decode('utf-8', errors='replace')
                fixed_str = fixed.decode('utf-8', errors='replace')
                line_no = content[:start].count(b'\n') + 1
            else:
                # Only report as unfixed if the span contains known mojibake
                # signature bytes (Ã=0xC3, â=0xC2, Å=0xC5). Valid UTF-8
                # characters such as emojis or accented letters are left
                # unchanged by fully_decode and must not be flagged as errors.
                MOJIBAKE_SIGS = {0xC3, 0xC2, 0xC5}
                if any(b in MOJIBAKE_SIGS for b in span):
                    line_no = content[:start].count(b'\n') + 1
                    unfixed.append((line_no, span.decode('utf-8', errors='replace')))

    return bytes(result), unfixed

FILES = [
    'game/achievements.js',
    'game/actions.js',
    'game/attunements.js',
    'game/combat.js',
    'game/combat-helpers.js',
    'game/combat-new.js',
    'game/combat-resolver.js',
    'game/config.js',
    'game/constants-loader.js',
    'game/construction.js',
    'game/covert.js',
    'game/defense.js',
    'game/economy.js',
    'game/effects.js',
    'game/engine.js',
    'game/expeditions.js',
    'game/fragment-attunements.js',
    'game/fragment-synergies.js',
    'game/happiness.js',
    'game/heroes.js',
    'game/location-maps.js',
    'game/magic.js',
    'game/mercenaries.js',
    'game/rebellion.js',
    'game/recruitment.js',
    'game/research.js',
    'game/sockets.js',
    'game/trade-routes.js',
    'game/turn.js',
    'game/xp.js',
    'routes/admin.js',
    'routes/auth.js',
    'routes/discord.js',
    'routes/forum.js',
    'routes/hero.js',
    'routes/kingdom.js',
]

dry_run = '--dry-run' in sys.argv

total_changed = 0
total_unfixed = 0

for rel_path in FILES:
    abs_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), rel_path)
    if not os.path.exists(abs_path):
        print(f'SKIP (not found): {rel_path}')
        continue

    fixed_content, unfixed = fix_file(abs_path)

    with open(abs_path, 'rb') as f:
        original = f.read()

    if fixed_content == original:
        print(f'  unchanged : {rel_path}')
        continue

    changed_lines = sum(1 for a, b in zip(original.split(b'\n'), fixed_content.split(b'\n')) if a != b)
    total_changed += 1

    if dry_run:
        print(f'  [DRY RUN] would fix {changed_lines} lines: {rel_path}')
    else:
        with open(abs_path, 'wb') as f:
            f.write(fixed_content)
        print(f'  FIXED {changed_lines} lines: {rel_path}')

    if unfixed:
        total_unfixed += len(unfixed)
        for line_no, span in unfixed[:5]:
            print(f'    !! could not auto-fix line {line_no}: {repr(span[:40])}')
        if len(unfixed) > 5:
            print(f'    ... and {len(unfixed) - 5} more unfixed spans')

print()
if dry_run:
    print(f'Dry run complete. {total_changed} files would be changed.')
else:
    print(f'Done. {total_changed} files changed. {total_unfixed} spans could not be auto-fixed (see above).')
```

### Run it

```bash
# Dry run first — prints what would change without writing
python3 fix_mojibake.py --dry-run

# If output looks right, apply for real
python3 fix_mojibake.py
```

---

## Step 2 — Manually Fix the Lines the Script Can't Auto-Decode

Some emojis use byte values that fall in cp1252's "undefined" range (0x81, 0x8D, 0x8F, 0x90, 0x9D). The auto-decoder can't reverse those safely. These lines need the correct character looked up from git history.

### Find the original characters

```bash
# Find the last commit before the encoding was corrupted — look for a commit
# that still had clean emoji in these files
git log --oneline -- game/expeditions.js game/turn.js game/construction.js | head -30

# Once you have the commit hash (e.g. abc1234), check a specific line:
git show abc1234:game/expeditions.js | sed -n '410,414p'
```

### Known lines to check manually after running the script

After the script runs, grep for any remaining mojibake:

```bash
grep -Pn "Ã|â€|Å¸|Ã‚Â" game/expeditions.js game/turn.js game/construction.js game/engine.js
```

Anything still showing `Ã`, `â€`, `Å¸` etc. after the script ran needs a manual character replacement.

#### expeditions.js — lines likely still broken after script

| Line | Context | Look up in git |
|------|---------|---------------|
| 412 | `+${ironGained} iron plundered` | emoji before the text |
| 598, 616 | `ULTRA RARE: ${prize.text}` | 3× emoji prefix |
| 641 | `Air Fragment pulses with the fury` | emoji prefix |
| 765, 767 | Throne of Nazdreg found message | emoji prefix |
| 786, 827 | `Your rangers discovered the kingdom` / Scout type label | emoji |
| 803, 807 | `World Fragment` found messages | emoji prefix |
| 814, 818, 915, 919 | `ACHIEVEMENT UNLOCKED` messages | emoji prefix |
| 828 | `"deep"` expedition type label | emoji prefix |

#### turn.js — lines likely still broken after script

| Line | Context | Look up in git |
|------|---------|---------------|
| 377, 385, 406, 411, 429, 438, 456 | Population/unrest news messages | emoji prefix |
| 547 | Mana restoration message | emoji prefix |
| 562, 567 | Population growth message | emoji prefix |
| 774 | Construction complete message | emoji prefix |
| 922 | Low Tax Event message | emoji prefix |
| 1049, 1104, 1109 | Various news messages | emoji prefix |
| 1063 | News message | emoji prefix |
| 1137 | News message | emoji prefix |
| 1289, 1405, 1439, 1620, 1840–1964 | Various game event messages | emoji prefix |
| 2215, 2223 | Messages | emoji prefix |
| 2265, 2284 | Messages | emoji prefix |
| 2515, 2523, 2537, 2549 | Messages | emoji prefix |

---

## Step 3 — Rebuild and Deploy

```bash
npm run build
# commit and push to your branch
git add game/ routes/
git commit -m "fix: restore correct Unicode encoding in all game source files"
git push -u origin <your-branch>
```

---

## Step 4 — Fix Historical Database Rows (Optional)

Rows already written to the `news` table in Postgres contain the corrupted strings. New rows generated after the fix will be clean. To backfill old rows, run this script locally against the production DATABASE_URL:

```js
// fix_db_news.mjs � run with:
// DATABASE_URL="<production-url>" node fix_db_news.mjs

import pg from 'pg';
import { TextDecoder } from 'node:util';
const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

// Build cp1252 reverse table
// cp1252 byte ? Unicode codepoint table for 0x80-0x9F (the special range)
const CP1252_SPECIALS = {
  0x80: '�', 0x82: '�', 0x83: '�', 0x84: '�',
  0x85: '�', 0x86: '�', 0x87: '�', 0x88: '�',
  0x89: '�', 0x8A: '�', 0x8B: '�', 0x8C: '�',
  0x8E: '�', 0x91: '�', 0x92: '�', 0x93: '�',
  0x94: '�', 0x95: '�', 0x96: '�', 0x97: '�',
  0x98: '�', 0x99: '�', 0x9A: '�', 0x9B: '�',
  0x9C: '�', 0x9E: '�', 0x9F: '�',
};

function cp1252ByteToChar(b) {
  if (b in CP1252_SPECIALS) return CP1252_SPECIALS[b];
  return String.fromCodePoint(b);
}

// Build reverse: Unicode char ? cp1252 byte
const cp1252Reverse = new Map();
for (let b = 0; b < 256; b++) {
  const ch = cp1252ByteToChar(b);
  if (!cp1252Reverse.has(ch)) cp1252Reverse.set(ch, b);
}

function unEncodeOnce(s) {
  const bytes = [];
  for (const ch of s) {
    if (!cp1252Reverse.has(ch)) return null;
    bytes.push(cp1252Reverse.get(ch));
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(Buffer.from(bytes));
  } catch {
    return null;
  }
}

function decodeMojibake(s) {
  let current = s;
  for (let i = 0; i < 5; i++) {
    const decoded = unEncodeOnce(current);
    if (decoded === null || decoded === current) break;
    current = decoded;
  }
  return current;
}

async function fixNewsRows() {
  const { rows } = await pool.query('SELECT id, message FROM news WHERE message ~ \'[ÃÂÅ]\' LIMIT 5000');
  console.log(`Found ${rows.length} rows to check`);
  let fixed = 0;
  for (const row of rows) {
    const cleaned = decodeMojibake(row.message);
    if (cleaned !== row.message) {
      await pool.query('UPDATE news SET message = $1 WHERE id = $2', [cleaned, row.id]);
      fixed++;
    }
  }
  console.log(`Fixed ${fixed} rows`);
  await pool.end();
}

fixNewsRows().catch(console.error);
```

Run against production:
```bash
DATABASE_URL="<your-railway-postgres-url>" node fix_db_news.mjs
```

The same script logic applies to `expeditions` rows if those have a `rewards_json` or similar text column that stores the reward messages.

---

## Verification

After the build deploys, check these in the game UI:

- [ ] Expedition log shows proper emojis (🪵 wood, 🗺️ map, 💀 skull, ⚡ lightning)  
- [ ] News panel shows em-dashes (—) not `ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â`
- [ ] Construction notes show `⚒️` and `🏗️`
- [ ] Mercenary messages show `⚔️`
- [ ] No remaining `Ã`, `â€`, `Å¸` patterns in any player-visible text

Quick grep to confirm source files are clean after running the script:
```bash
grep -rP "ÃƒÂ|â€šÂ|Ã…Â¸" game/ routes/ | grep -v "lore.js"
```

A clean result (no output) means all source files are fixed.
