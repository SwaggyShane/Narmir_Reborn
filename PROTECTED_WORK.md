# PROTECTED WORK - DO NOT DELETE

This file documents critical code that must never be deleted or treated as orphaned, even if it appears unused.

## Combat Redesign System (CRITICAL)

**Files**
- `game/combat-new.js` - Combat V2 system with individual troop HP and injury states
- `game/combat-resolver.js` - Combat execution engine

**Status**: Complete and protected. The V2 path exists locally behind `USE_COMBAT_V2=1` and must not be deleted or treated as orphaned. V1 remains the default path unless the flag is set.

**Importance**: This is a major system overhaul that affects core game mechanics. It must stay intact and documented correctly.

**Plan**: Keep the feature-flagged V2 path, diagnostics, and docs aligned with the current codebase. Do not push to remote unless asked.

**Why Protected**:
These files were previously deleted as "orphaned" even though they represent complete, high-value work. They must not be removed from the codebase.

**Integration Timeline**:
The V2 adapter is already present locally behind a feature flag. Next work is cleanup, balance review, and documentation alignment. Do not use V1 balance reports as final V2 evidence.

---

## How to Ensure This Is Never Deleted Again

1. Audit scripts must explicitly skip files in `PROTECTED_WORK.md` before deleting anything as "orphaned"
2. Code review should flag any PR that deletes these files without explicit approval
3. Git hooks can prevent deletion of these files unless force-flagged
4. This document serves as the source of truth for protected combat work

---

## Other Protected Work

None currently. This section can be expanded as more long-term work is marked for protection.
