# Narmir Reborn: Development Todos

Local is truth. Completed work now lives in `ARCHIVAL.md`. The Claude completion log has been removed.

## Codex Lane

1. Battle Outcome Animation: Animate win/loss banners in combat results.
2. Battle Outcome Animation: Animate casualty and critical hit counters.
3. Battle Outcome Animation: Animate HP, wall, or power bars when results are shown.
4. Battle Outcome Animation: Keep combat resolution deterministic and presentation-only.
5. Mobile and Vanilla Cleanup: Scan `public/` for inline `<script>` blocks and jQuery usage.
6. Mobile and Vanilla Cleanup: Audit `index.html` and fallback templates for non-React entry points.
7. Mobile and Vanilla Cleanup: Move remaining user-facing vanilla routes to React.
8. Mobile and Vanilla Cleanup: Convert remaining vanilla form handlers to controlled components.
9. Mobile and Vanilla Cleanup: Replace inline styles and `onclick` handlers with Tailwind and React bindings.
10. Mobile and Vanilla Cleanup: Consolidate vanilla template CSS into one Tailwind source.
11. Mobile and Vanilla Cleanup: Verify no horizontal scroll at 360px.
12. Mobile and Vanilla Cleanup: Keep bottom nav visible without overlap.
13. Mobile and Vanilla Cleanup: Preserve natural header scrolling.
14. Mobile and Vanilla Cleanup: Enforce responsive breakpoints and 44x44 touch targets.
15. Mobile and Vanilla Cleanup: Prevent layout shifts when nav appears or disappears.
16. Beta Architecture Debt: Remove remaining GameStateManager bridge hooks after full Zustand coverage.
17. Beta Architecture Debt: Enforce Tailwind-only defaults for static styling.
18. Beta Architecture Debt: Remove legacy admin compatibility routes from `index.js`.
19. Beta Architecture Debt: Expand component test coverage.
20. Beta Architecture Debt: Refresh API documentation.
21. Beta Architecture Debt: Investigate `/expedition` and `/turn` query performance.
22. Beta Architecture Debt: Clean up duplicate happiness logic and related code-quality debt.
23. Beta Architecture Debt: Decide whether Discord.js v15 migration is still needed before beta.

## Claude Lane

1. Weekly Deep Audit: Add schedule UI to the admin panel.
2. Weekly Deep Audit: Create database tables for audit schedules and history.
3. Weekly Deep Audit: Implement a cron scheduler for recurring scans.
4. Weekly Deep Audit: Add API endpoints for schedule management.
5. Weekly Deep Audit: Expand the auditor to recursively scan the full codebase.
6. Weekly Deep Audit: Generate comparison reports between audits.
7. Weekly Deep Audit: Add trend visualization for findings over time.
8. Weekly Deep Audit: Add notifications for new issues.
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
