# Local Parallel Workflow for Claude + Codex

**Purpose:** Enable Claude and Codex to work on TODO items in parallel without conflicts  
**Coordination:** TODO.md as handshake mechanism  
**Source of Truth:** Local (origin/main)

---

## Workflow Model

### 1. Claim Phase (Handshake START)

When starting work on a TODO item:

```bash
# 1. Update TODO.md: mark item as "Claude: in progress" or "Codex: in progress"
# 2. Commit to main (signals ownership to other agent)
# 3. Push to origin/main

git add TODO.md
git commit -m "todo: Claude claiming Item X (description)"
git push origin main
```

**Effect:** TODO.md update signals "I'm taking this item, don't pick it"

### 2. Work Phase (Independent)

After claiming, work independently on feature branch:

```bash
# 1. Create task-specific branch
git checkout -b claude/item-X-description

# 2. Do work (commits on feature branch)
# 3. Push feature branch (optional, for backup)
git push origin claude/item-X-description
```

**Parallel Safety:** Each agent works on different items → no conflicts

### 3. Completion Phase (Handshake END)

When work is ready to merge:

```bash
# 1. Switch to main
git checkout main

# 2. Pull latest (to sync with parallel work)
git pull origin main

# 3. Merge feature branch
git merge claude/item-X-description

# 4. Update TODO.md: mark item as ✅ complete
# 5. Commit and push both together
git add TODO.md
git commit -m "todo: Mark Item X complete"
git push origin main
```

**Effect:** TODO.md update signals "I'm done, item is complete"

### 4. Sync Before Next Task

Before claiming next item:

```bash
# Always fetch latest state
git fetch origin main
git pull origin main

# Check updated TODO.md
cat TODO.md

# Pick next unclaimed Tier 1 item
# Go to step 1 (Claim)
```

---

## TODO.md Handshake States

```markdown
1. Item Name
   - Status: Claude: in progress  ← Claim phase
   
2. Item Name  
   - Status: ✅ Complete         ← Completion phase
   
3. Item Name
   - Status: (blank/unassigned)   ← Available for claiming
```

---

## Merge Conflict Prevention

**Why conflicts don't happen:**
- Claude works on `claude/item-X-branch`
- Codex works on `codex/item-Y-branch`
- Only TODO.md is shared, and updates are atomic (one item at a time)
- Each agent syncs before claiming next item

**If Codex pushes while Claude works:**
1. Claude finishes work and tries to push
2. Remote has Codex's commits → rebase needed
3. Claude: `git pull origin main` → gets Codex's work
4. Claude: `git rebase origin/main` → stacks Claude's commits on top
5. Claude: `git push origin main` → clean fast-forward

**Example:**
```
Origin/main: A --C1 (Codex Item Y) --C2 (Codex Item Y)
Local main:  A --D1 (Claude Item X) --D2 (Claude Item X) --D3 (TODO update)

After rebase:
Local main:  A --C1 --C2 --D1 --D2 --D3
Push: clean
```

---

## Best Practices

1. **Claim immediately** — Update TODO.md first, before starting work
2. **Sync before next** — Always `git fetch && git pull` before claiming new item
3. **Feature branch per task** — One branch = one TODO item
4. **Atomic commits** — Each commit should be a logical unit of work
5. **Push frequently** — Push feature branch regularly for backup
6. **Rebase on conflicts** — Use `git rebase origin/main` if pushed during work

---

## Session Checklist

- [ ] Fetch origin before starting
- [ ] Check TODO.md for next unclaimed item
- [ ] Claim item (update TODO.md + push)
- [ ] Create feature branch
- [ ] Do work + commit
- [ ] Merge to main + update TODO.md
- [ ] Push to origin/main
- [ ] Fetch latest before next item
- [ ] Repeat until TODO complete

---

**Workflow Established:** 2026-06-30  
**Status:** Active (Claude + Codex working in parallel)
