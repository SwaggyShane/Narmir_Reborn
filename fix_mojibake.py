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
        # Latin-1 passthrough for undefined cp1252 bytes (0x81, 0x8D, 0x8F, 0x90, 0x9D)
        char = chr(byte_val)
        cp1252_reverse[char] = byte_val

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
