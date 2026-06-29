# Narmir Reborn: Development Todos

Local is truth. Completed work now lives in `ARCHIVAL.md`. The Claude completion log has been removed.

## Codex Lane

1. Battle Outcome Animation: Animate win/loss banners in combat results.
2. Battle Outcome Animation: Animate casualty and critical hit counters.
3. Battle Outcome Animation: Animate HP, wall, or power bars when results are shown.
4. Battle Outcome Animation: Keep combat resolution deterministic and presentation-only.
5. Weekly Deep Audit: Add schedule UI to the admin panel.
6. Weekly Deep Audit: Create database tables for audit schedules and history.
7. Weekly Deep Audit: Implement a cron scheduler for recurring scans.
8. Weekly Deep Audit: Add API endpoints for schedule management.
9. Weekly Deep Audit: Expand the auditor to recursively scan the full codebase.
10. Weekly Deep Audit: Generate comparison reports between audits.
11. Weekly Deep Audit: Add trend visualization for findings over time.
12. Weekly Deep Audit: Add notifications for new issues.
13. Weekly Deep Audit: Investigate and repair JSON row corruption.
14. Production Maintenance: Complete SQL injection audit coverage.
15. Production Maintenance: Harden rate limiting and DDoS mitigation.
16. Production Maintenance: Finish secrets management and verify Railway environment variables.
17. Production Maintenance: Enforce HTTPS in production.
18. Production Maintenance: Load test for 5,000+ concurrent players.
19. Production Maintenance: Verify backup and restore workflow.
20. Production Maintenance: Configure API rate limiting.
21. Production Maintenance: Add monitoring and alerting.
22. Production Maintenance: Refresh user-facing docs.
23. Production Maintenance: Prepare the support runbook.
24. Production Maintenance: Confirm production database URL and automated backups.
25. Mobile and Vanilla Cleanup: Scan `public/` for inline `<script>` blocks and jQuery usage.
26. Mobile and Vanilla Cleanup: Audit `index.html` and fallback templates for non-React entry points.
27. Mobile and Vanilla Cleanup: Move remaining user-facing vanilla routes to React.
28. Mobile and Vanilla Cleanup: Convert remaining vanilla form handlers to controlled components.
29. Mobile and Vanilla Cleanup: Replace inline styles and `onclick` handlers with Tailwind and React bindings.
30. Mobile and Vanilla Cleanup: Consolidate vanilla template CSS into one Tailwind source.
31. Mobile and Vanilla Cleanup: Verify no horizontal scroll at 360px.
32. Mobile and Vanilla Cleanup: Keep bottom nav visible without overlap.
33. Mobile and Vanilla Cleanup: Preserve natural header scrolling.
34. Mobile and Vanilla Cleanup: Enforce responsive breakpoints and 44x44 touch targets.
35. Mobile and Vanilla Cleanup: Prevent layout shifts when nav appears or disappears.
36. Beta Architecture Debt: Remove remaining GameStateManager bridge hooks after full Zustand coverage.
37. Beta Architecture Debt: Enforce Tailwind-only defaults for static styling.
38. Beta Architecture Debt: Remove legacy admin compatibility routes from `index.js`.
39. Beta Architecture Debt: Expand component test coverage.
40. Beta Architecture Debt: Refresh API documentation.
41. Beta Architecture Debt: Investigate `/expedition` and `/turn` query performance.
42. Beta Architecture Debt: Clean up duplicate happiness logic and related code-quality debt.
43. Beta Architecture Debt: Decide whether Discord.js v15 migration is still needed before beta.
