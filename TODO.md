# Narmir Reborn: Development Todos

Remote is truth for shared project state. Completed work now lives in `ARCHIVAL.md`. The Claude completion log has been removed.

## Project Workflow

1. Treat `origin/main` as the shared project ledger; keep local branches disposable and task-specific.
2. Keep one active owner per lane at a time. Codex works Codex lane items, Claude works Claude lane items.
3. Never mix lanes in the same branch, commit, or PR.
4. Create one branch and one PR per task. PRs are ready-for-review, not draft.
5. Before starting a task, check the lane's current TODO item and any open PRs that already cover it.
6. If a review comment is correct, fix it. If it is wrong, refute it with evidence and move on.
7. Claude and Codex both amend `TODO.md` when their work is completed.
8. Codex merges approved PRs, deletes the associated branches, then fetches `origin` before starting the next merge.
9. After every merge, re-check for newly landed Claude branches before picking up the next task.
10. Use Gemini feedback for high-risk work before merge.
11. Move directly to the next task after each completion.
12. Do not ask for permission to continue unless blocked or explicitly told to stop.
13. Repeat until `TODO.md` is complete.

## Codex Lane

1. Battle Outcome Animation: Animate casualty and critical hit counters.
2. Battle Outcome Animation: Animate HP, wall, or power bars when results are shown.
3. Battle Outcome Animation: Keep combat resolution deterministic and presentation-only.
4. Mobile and Vanilla Cleanup: Scan `public/` for inline `<script>` blocks and jQuery usage.
5. Mobile and Vanilla Cleanup: Audit `index.html` and fallback templates for non-React entry points.
6. Mobile and Vanilla Cleanup: Move remaining user-facing vanilla routes to React.
7. Mobile and Vanilla Cleanup: Convert remaining vanilla form handlers to controlled components.
8. Mobile and Vanilla Cleanup: Replace inline styles and `onclick` handlers with Tailwind and React bindings.
9. Mobile and Vanilla Cleanup: Consolidate vanilla template CSS into one Tailwind source.
10. Mobile and Vanilla Cleanup: Verify no horizontal scroll at 360px.
11. Mobile and Vanilla Cleanup: Keep bottom nav visible without overlap.
12. Mobile and Vanilla Cleanup: Preserve natural header scrolling.
13. Mobile and Vanilla Cleanup: Enforce responsive breakpoints and 44x44 touch targets.
14. Mobile and Vanilla Cleanup: Prevent layout shifts when nav appears or disappears.
15. Beta Architecture Debt: Remove remaining GameStateManager bridge hooks after full Zustand coverage.
16. Beta Architecture Debt: Enforce Tailwind-only defaults for static styling.
17. Beta Architecture Debt: Remove legacy admin compatibility routes from `index.js`.
18. Beta Architecture Debt: Expand component test coverage.
19. Beta Architecture Debt: Refresh API documentation.
20. Beta Architecture Debt: Investigate `/expedition` and `/turn` query performance.
21. Beta Architecture Debt: Clean up duplicate happiness logic and related code-quality debt.
22. Beta Architecture Debt: Decide whether Discord.js v15 migration is still needed before beta.

## Claude Lane

1. ✅ Weekly Deep Audit: Add schedule UI to the admin panel.
2. ✅ Weekly Deep Audit: Create database tables for audit schedules and history.
3. ✅ Weekly Deep Audit: Implement a cron scheduler for recurring scans.
4. ✅ Weekly Deep Audit: Add API endpoints for schedule management.
5. ✅ Weekly Deep Audit: Expand the auditor to recursively scan the full codebase.
6. ✅ Weekly Deep Audit: Generate comparison reports between audits.
7. ✅ Weekly Deep Audit: Add trend visualization for findings over time.
8. ✅ Weekly Deep Audit: Add notifications for new issues.
9. Weekly Deep Audit: Investigate and repair JSON row corruption.
10. Production Maintenance: Complete SQL injection audit coverage.
11. Production Maintenance: Harden rate limiting and DDoS mitigation.
12. Production Maintenance: Finish secrets management and verify Railway environment variables.
13. Production Maintenance: Enforce HTTPS in production.
14. Production Maintenance: Load test for 5,000+ concurrent players.
15. Production Maintenance: Verify backup and restore workflow.
16. Production Maintenance: Configure API rate limiting.
17. Production Maintenance: Add monitoring and alerting.
18. Production Maintenance: Refresh user-facing docs.
19. Production Maintenance: Prepare the support runbook.
20. Production Maintenance: Confirm production database URL and automated backups.
