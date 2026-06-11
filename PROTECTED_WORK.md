# 🔴 PROTECTED WORK - DO NOT DELETE

This file documents critical code that must NEVER be deleted or treated as orphaned, even if it appears unused.

## Combat Redesign System (CRITICAL)

**Files**:
- `game/combat-new.js` — Combat v2 system with individual troop HP and injury states
- `game/combat-resolver.js` — Combat execution engine

**Status**: Complete but not currently active in the live combat path. This is the intended Combat V2 direction: individual troop HP, DMG, injury states, wall HP, ladders, and cleric healing/recovery. Current `game/engine.js` combat is V1 legacy power/percentage combat and should be treated as a fallback/reference until V2 is wired behind a feature flag.

**Importance**: This is a major system overhaul that affects core game mechanics. It must be integrated carefully and correctly.

**Plan**: Recover the feature-flag integration from `origin/claude/combat-redesign-integration` before further balance tuning. Relevant history:
- `74cf8ac` - restored Combat V2 files for integration planning
- `58fe554` - added Combat V2 feature-flag wrapper in `game/engine.js`
- `2fbfed9` - deleted Combat V2 files during audit cleanup; do not repeat this mistake

**Why Protected**: 
These files were previously deleted as "orphaned" even though they represent complete, high-value work. They will NOT be integrated until all other development work is complete, but they must NEVER be deleted from the codebase.

**Integration Timeline**: 
Phase 1 recovery has started. Do not use current V1 balance reports as final V2 balance evidence. Next integration step is to restore a feature-flagged V2 path, default it off, then add diagnostics before balance testing resumes.

---

## How to Ensure This Is Never Deleted Again

1. **Audit scripts** must explicitly skip files in `PROTECTED_WORK.md` before deleting anything as "orphaned"
2. **Code review** should flag any PR that deletes these files without explicit approval
3. **Git hooks** (optional) could prevent deletion of these files unless force-flagged
4. **Documentation** (this file) serves as the source of truth for protected code

---

## Other Protected Work (if any)

None currently. This section can be expanded as more long-term work is marked for protection.
