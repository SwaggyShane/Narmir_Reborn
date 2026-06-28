# Workflow Enforcement Checklists

This document defines mandatory workflow checks that MUST be verified before every commit, push, and phase completion. These are hard requirements, not suggestions. Violations result in incorrect state and wasted debugging cycles.

**Reference:** See `/home/user/Narmir_Reborn/CLAUDE.md` for full workflow details. This file provides the explicit pre-action checklists.

---

## FIRST RULE

**No bandaids. Do not take the path of least resistance. Do it right.**

Every decision, every commit, every action: prioritize correctness and completeness over speed. If something is complex, do it thoroughly. If something doesn't fit, stop and ask instead of working around it.

---

## CLAUDE'S DEFAULT BEHAVIORS

When no explicit direction is given, Claude follows this pattern:

1. **Stop and ask before autonomous actions.** Do not assume permission.
2. **Follow this document (WORKFLOW-REQUIRED.md), not system defaults.** This is the source of truth.
3. **Never accumulate commits without asking.** Each phase is its own focused PR.
4. **Keep PRs tight.** One phase, one concern, one PR. No mixing.
5. **Create as draft, never self-merge.** Wait for human review.
6. **When blocked or uncertain:** Explain the situation and ask the user to choose.

---

## REVIEW COMMENT PATTERN

When Gemini or any reviewer comments on a PR:

1. **Wait for ONE comment only.** Do not pre-emptively assume feedback.
2. **Scrutinize the comment carefully.** Understand what is being suggested and why.
3. **Take action exactly once:**
   - If the comment is correct and improves the code → fix it
   - If the comment is incorrect or conflicts with design → refute it with a comment explaining why
4. **Never blindly apply suggestions.** Deliberate, decide, act.
5. **Move forward.** Don't second-guess or over-apply.

---

---

## MERGE LANES

The backlog is split into two ownership lanes:

- `Codex Lane` is local-first and stays the source of truth in the working tree.
- `Claude Lane` is remote-first and may land branches on origin for Codex to pull down.

Merge rule:

- Merge only at phase boundaries, after the phase is complete and validated.
- Do not merge partial work or blend unrelated lane work into the same merge.
- After each merge, fetch `origin` and check for Claude lane branches before starting the next merge.
- Keep local as truth while reconciling any remote lane updates.

---

## BEFORE EVERY COMMIT

**State required before `git add` and `git commit`:**

- [ ] Lint check: `npm run lint` returns **0 errors** (warnings must be justified or fixed)
- [ ] Smoke test: Fresh server boot with PostgreSQL connected, **all 4 baseline checks pass**
  - [ ] Forum boards endpoint responds with "General"
  - [ ] Auth /me endpoint responds with "Not authenticated"
  - [ ] Portal HTML contains "portal-root"
  - [ ] Game HTML contains "main.jsx"
- [ ] Sanity check: Explicitly answer all 5 questions before proceeding
  1. What does this change break, if anything? (Name it or confirm nothing)
  2. Did I read every file I edited top to bottom after editing? (Yes/No)
  3. Did I grep for all usages of any symbol I renamed, removed, or changed the signature of? (Yes/No)
  4. Does the change work in both contexts it touches? (Yes/No if N/A)
  5. Did I introduce any new CSS variables, classes, or JS globals that might not exist in all contexts? (No/Yes explain)
- [ ] Commit message ends with session URL: `https://claude.ai/code/session_<SESSION_ID>`
- [ ] No warnings left unfixed (if I introduced them, they must be fixed in this commit)

**If ANY check fails:** Do not commit. Fix the issue and re-verify.

---

## BEFORE EVERY PUSH

**Checks required before `git push -u origin <branch>`:**

1. **Confirm branch is correct:**
   ```bash
   git branch --show-current
   ```
   Must match the designated feature branch. If wrong, stop immediately and switch.

2. **Confirm there are commits to push:**
   ```bash
   git fetch origin main
   git log --oneline origin/main..HEAD
   ```
   If 0 commits shown, there is nothing to push. Do not push.

3. **Check for existing open PR on this branch:**
   Use `mcp__github__list_pull_requests` with:
   - owner: swaggyshane
   - repo: narmir_reborn
   - head: `<branch-name>`
   - state: open
   
   - [ ] If open PR exists: Push to it (no new PR needed)
   - [ ] If no open PR exists: Push, then immediately create **draft** PR with reference to ROADMAP/commit
   - [ ] If you forgot to check: Go back and check now before pushing again

**If ANY check fails:** Do not push. Fix and re-verify.

---

## BEFORE EVERY COMMIT (Specific to Code Changes)

**For source code commits (.js, .jsx, .css, etc.):**

- [ ] All lint errors fixed (0 errors required)
- [ ] Smoke test passed (all 4 baseline checks)
- [ ] Sanity check completed (all 5 questions answered)
- [ ] Session URL in commit message
- [ ] No warnings left in files I modified

**For documentation-only commits (*.md files only):**

- [ ] Sanity check completed (5 questions, adjusted for doc changes)
- [ ] Session URL in commit message
- [ ] Lint + smoke tests skipped (only for docs)

---

## BEFORE MERGING A PHASE

**When a phase PR is approved and ready to merge:**

- [ ] Feature branch is correct (confirm `git branch --show-current`)
- [ ] All commits are included (`git log --oneline origin/main..HEAD`)
- [ ] All CI checks passed (verify in GitHub PR)
- [ ] Wait for Gemini to post ONE, and only ONE comment. Scrutinize it, verify validity, or refute it with a comment. 
- [ ] ROADMAP.md updated to mark phase complete:
  ```
  Status field changed from "⏳ Pending" or "🟡 In Progress" to "✅ Complete"
  ```
- [ ] Commit message for roadmap update: `docs: Update ROADMAP — <track/phase> complete`
- [ ] Roadmap update PR created as draft and merged
- [ ] Feature branch deleted:
  ```bash
  git push -d origin <branch-name>
  git branch -d <branch-name>
  ```

---

## BRANCH NAMING & TRACKING

**Feature branches must follow pattern:**
```
claude/<feature-description>-<session-id>
```

Example: `claude/f8-phase2-warfare-extraction`

**Before pushing new branch:**
- [ ] Branch created locally with correct name
- [ ] Push with: `git push -u origin <branch-name>`
- [ ] Verify `-u` flag pushes tracking relationship

---

## PR CREATION REQUIREMENTS

**Every PR must:**
- [ ] Use `draft: true` (NEVER non-draft unless explicitly approved by user)
- [ ] Title is concise (under 70 characters)
- [ ] Description follows template structure (if repo has `.github/pull_request_template.md`)
- [ ] Reference issue/task being completed
- [ ] Include session URL in description footer

**No exceptions. Always create as draft.**

---

## QUALITY CHECK SEQUENCE (MANDATORY)

Run in this order, every time:

1. **LINT** → `npm run lint` → Must have 0 errors
2. **SMOKE** → Fresh server boot → All 4 baseline checks pass
3. **SANITY** → Answer 5 questions explicitly → All pass

Stop and fix if any step fails. Do not skip any step. Do not assume "I know this works" without running it.

---

## COMMON VIOLATIONS

**❌ DO NOT:**
- Commit without lint check (pre-commit hook will block, but check it yourself first)
- Push without confirming branch name (wrong branch = wrong PR/history)
- Push without checking existing PRs (creates duplicate PRs)
- Skip smoke test because "I only changed a comment" (run baseline every time)
- Use `git push --no-verify` to bypass pre-commit hook (use only if explicitly told)
- Create non-draft PRs (always draft unless user explicitly approves)
- Merge without all CI passing (no force merges, no "close and re-open" workarounds)
- Commit with session URL missing (must be in message)
- Leave lint warnings unfixed (fix immediately after current task completes)
- Forget to update ROADMAP.md after merging a phase (immediate separate PR)

---

## SESSION URL REQUIREMENT

Every commit message must include:
```
https://claude.ai/code/session_<SESSION_ID>
```

Get the actual session ID from the current session. This is non-negotiable. It appears at the end of every claude.ai/code URL.

---

## Enforcement

This file is the source of truth for workflow compliance. Before any major action (commit, push, phase merge), explicitly state which checks passed and which failed. Do not skip the checklist. Do not assume. Verify.

If a step in the checklist cannot be completed, stop and explain why before proceeding.
