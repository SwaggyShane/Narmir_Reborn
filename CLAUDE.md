# Claude Code Workflow Guide

#### *****DO NOT TAKE THE PATH OF LEAST RESISTANCE*****

## PR Workflow

### Before Every Push — No Exceptions
1. Confirm you are on the correct branch:
   ```bash
   git branch --show-current
   # Must match the designated feature branch. If wrong, stop and ask.
   ```

2. Confirm there are commits to push:
   ```bash
   git fetch origin main
   git log --oneline origin/main..HEAD
   # If 0 commits, nothing to push. Do not push.
   ```

3. Check for an existing open PR on this branch before creating a new one:
   ```bash
   # Via GitHub MCP tool — run mcp__github__list_pull_requests with:
   # owner: swaggyshane, repo: narmir_reborn, head: <branch>, state: open
   ```
   - If an open PR exists: push to it, no new PR needed.
   - If no open PR exists (previous one was merged or never created): open a new PR **immediately after the push**. Do not wait for the user to notice.
   - "I forgot to check" is not valid. Run this before every push. No exceptions.

### Workflow Steps
1. Make code changes on feature branch
2. Run quality checks (lint → smoke → sanity) — see below
3. Stage and commit: `git add <files>` → `git commit -m "..."`
4. Confirm branch and commits (see above)
5. Push: `git push`

6. **Create or update PR**:
   - If an open PR already exists for this branch: push to the existing PR (do not create a new one).
   - If no open PR exists: create a new PR **immediately after the push**. Do not wait for the user to notice.

7. **Actively monitor until merge**:
   - Monitor CI status and Gemini review continuously — do not schedule check-ins.
   - Gemini will post a review once per PR (this is the only review you will ever receive).
   - It may take a few minutes to appear; stay alert and check periodically.
   - Once Gemini review arrives, proceed immediately to step 8.
   - Do **not** merge or update docs while waiting for the review.

8. **Address Gemini's feedback and immediately move to step 9**:
   - Make code fixes for valid feedback, commit, and push (updates the same PR).
   - Or reply on the PR with a clear explanation if you are refuting the feedback.
   - **IMPORTANT: Do NOT wait for Gemini to review your fixes. Gemini will never comment again on this PR.**
   - Once you've addressed the feedback, move immediately to step 9.
   - Continue active monitoring: check CI status in parallel while working on fixes.

9. **Update TODO.md / ARCHIVAL.md**:
   - Move finished items to ARCHIVAL.md with a dated entry.
   - Do this **before** any self-merge.
   - Commit and push the docs update.
   - Continue monitoring CI; do not schedule check-ins.

10. **Self-merge to main** (when CI passes):
    - Wait for all CI checks to pass (monitor actively, do not schedule check-ins).
    - Merge the PR to main. You have now addressed Gemini's ONE review, PR is green, and docs are updated.
    - Delete the feature branch locally and remotely.
    - **Done. Do not reopen the PR or wait for anything else.**
