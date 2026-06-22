# Mojibake Fix - Narmir Reborn

## What happened

Some source files were written through a bad encoding path and ended up with triple-encoded cp1252 -> UTF-8 mojibake. The result was broken text in source files and in any database rows written from that text.

The rendering pipeline itself is fine. Node, Postgres, JSON, and the browser all pass bytes through normally. The corruption lives in the source content and in any rows already written from it.

## What the fixer does

- `fix_mojibake.py` scans the known source files.
- It repeatedly decodes known mojibake byte spans until the text stops changing.
- It leaves valid UTF-8 alone.
- It reports spans that still look suspicious after the repair pass.

## How to use it

```bash
python3 fix_mojibake.py --dry-run
python3 fix_mojibake.py
```

## Manual follow-up

If a string still looks wrong after the automated pass, check the history for the clean version and replace it directly.

Useful signals to search for are the common mojibake markers:

- `U+00C3`
- `U+00C2`
- `U+00E2`
- `U+FFFD`

## Historical rows

Any rows already written to the database before the cleanup may still contain corrupted text. Those can be repaired with the same decode logic against the affected tables.

## Verification

After running the fixer and rebuilding:

- source files should no longer contain mojibake markers
- player-visible text should render with the intended Unicode characters
- new rows written after the cleanup should stay clean

A clean scan means the source is fixed and the guardrail can keep it that way.
