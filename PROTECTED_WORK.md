# 🔴 PROTECTED WORK - DO NOT DELETE

This file documents critical code that must NEVER be deleted or treated as orphaned, even if it appears unused.

## Combat Redesign System (CRITICAL)

**Files**:
- `game/combat-new.js` — Combat v2 system with individual troop HP and injury states
- `game/combat-resolver.js` — Combat execution engine

**Status**: Complete but intentionally NOT integrated. Waiting for all other work to be completed before integration.

**Importance**: This is a major system overhaul that affects core game mechanics. It must be integrated carefully and correctly.

**Plan**: `/root/.claude/plans/combat-redesign-integration.md`

**Why Protected**: 
These files were previously deleted as "orphaned" even though they represent complete, high-value work. They will NOT be integrated until all other development work is complete, but they must NEVER be deleted from the codebase.

**Integration Timeline**: 
When ready to integrate, refer to the plan file. This is a ~8-12 hour effort and should only begin after all other features are stable.

---

## How to Ensure This Is Never Deleted Again

1. **Audit scripts** must explicitly skip files in `PROTECTED_WORK.md` before deleting anything as "orphaned"
2. **Code review** should flag any PR that deletes these files without explicit approval
3. **Git hooks** (optional) could prevent deletion of these files unless force-flagged
4. **Documentation** (this file) serves as the source of truth for protected code

---

## Other Protected Work (if any)

None currently. This section can be expanded as more long-term work is marked for protection.
