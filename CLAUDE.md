# Claude Code Workflow Guide

## PR Workflow

### ALWAYS SEE IF PREVIOUS PR IS MERGED. Always Create PRs as Drafts
When pushing changes to a feature branch, **always create the PR as a draft** (`draft: true`). This allows for:

1. **Code review feedback before merge** - Reviewers can comment on the draft PR
2. **Iterative improvements** - Address feedback and make additional commits without merging
3. **Clean history** - Avoid unnecessary merge commits to main
4. **Early feedback** - Get review feedback on changes before marking PR ready for merge

### Workflow Steps
1. Make code changes on feature branch
2. Stage changes: `git add <files>`
3. (Optional) Create draft PR for staged changes feedback before committing
4. Commit changes: `git commit -m "..."`
5. Push commits: `git push origin <branch>`
6. Create (or update) draft PR with the commits
7. Wait for code review feedback
8. Address feedback with new commits and push
9. Update PR description if needed
10. Mark PR as ready for review when approved
11. Merge to main

### Commit Messages
Include session URL for traceability (replace `<SESSION_ID>` with your actual session ID):
```
https://claude.ai/code/session_<SESSION_ID>
```

Example:
```
https://claude.ai/code/session_019XuBJBAmgDCeyviR3jpqee
```

## High Priority Issues Checklist

When fixing high-priority issues:
- [ ] Security vulnerabilities (SQL injection, XSS, etc.)
- [ ] Race conditions / transaction safety
- [ ] Memory leaks / resource management
- [ ] Critical performance bottlenecks
- [ ] Code review feedback from automated tools

Always push high-priority fixes as draft PRs for feedback before merging to main.

## Code Quality Standards

### No Bandaids — Fix It Right
- Do not use temporary workarounds, partial fixes, or quick hacks
- Identify and fix the root cause, not symptoms
- If a proper fix requires investigation, do the investigation first
- When code review identifies a flawed approach, revert it and fix it correctly
- Prefer reverting + re-fixing over stacking workarounds on top of broken solutions
- Example: If queue persistence causes database bloat, don't bandaid with fallbacks—delete the entry and redesign the logic

## Database & Deployment Notes

### Railway Limitations
- **Railway does NOT have a Shell feature** for this deployment
- For database operations, use **pgAdmin4** (available locally)
- Cannot run Node.js scripts directly on Railway via web console
- Migration scripts should be created but executed locally via pgAdmin4

### pgAdmin4 Access
- User has pgAdmin4 available locally
- Use pgAdmin4's connection dialog to configure the Railway PostgreSQL database connection
- For database migrations: paste SQL in pgAdmin4's Query Tool and Execute

### Future Database Changes
When making database schema changes:
1. Create migration SQL statements (or Node.js migration script for reference)
2. Execute via pgAdmin4 Query Tool (NOT via Railway Shell)
3. Test on local dev environment if possible

## Notes

- Hook feedback requires clean working tree (no uncommitted changes)
- Use `git add` to stage before requesting PR creation
- Always run code review tools before marking PR as ready
