# Narmir Reborn: Development Todos

Remote is truth for shared project state. Completed work now lives in `ARCHIVAL.md`. The Claude completion log has been removed.

## Project Workflow

1. Treat `origin/main` as the shared project ledger; keep local branches disposable and task-specific.
2. Keep one active owner per lane at a time. Claude works the task lane; Codex handles PRs and merges.
3. Never mix task work and PR work in the same branch, commit, or PR.
4. Create one branch and one PR per task. PRs are ready-for-review, not draft.
5. Before starting a task, check the lane's current TODO item and any open PRs that already cover it.
6. For PRs, address Gemini review comments: fix correct ones or refute incorrect ones with evidence.
7. Claude and Codex both amend `TODO.md` when their work is completed.
8. Codex merges approved PRs, deletes the associated branches, then fetches `origin` before starting the next merge.
9. After every merge, re-check for newly landed Claude branches before picking up the next task.
10. Use Gemini feedback for high-risk work before merge.
11. When a PR is green, viable, and its review comments are resolved, merge it.
12. Move directly to the next task after each completion.
13. Do not ask for permission to continue unless blocked or explicitly told to stop.
14. Repeat until `TODO.md` is complete.

## Claude Lane

1. [done] Battle Outcome Animation: Animate casualty and critical hit counters.
2. [done] Battle Outcome Animation: Animate HP, wall, or power bars when results are shown.
3. [done] Battle Outcome Animation: Keep combat resolution deterministic and presentation-only.
4. [done] Mobile and Vanilla Cleanup: Scan `public/` for inline `<script>` blocks and jQuery usage.
5. [done] Mobile and Vanilla Cleanup: Audit `index.html` and fallback templates for non-React entry points.
<<<<<<< HEAD
<<<<<<< HEAD
6. Mobile and Vanilla Cleanup: Move remaining user-facing vanilla routes to React.
7. Mobile and Vanilla Cleanup: Convert remaining vanilla form handlers to controlled components.
8. [done] Mobile and Vanilla Cleanup: Replace inline styles and `onclick` handlers with Tailwind and React bindings.
=======
=======
>>>>>>> 2c39d329 (docs: Update TODO — Mark Items 6-7 complete)
6. [done] Mobile and Vanilla Cleanup: Move remaining user-facing vanilla routes to React.
7. [done] Mobile and Vanilla Cleanup: Convert remaining vanilla form handlers to controlled components.
8. Mobile and Vanilla Cleanup: Replace inline styles and `onclick` handlers with Tailwind and React bindings.
<<<<<<< HEAD
<<<<<<< HEAD
>>>>>>> 2c39d329 (docs: Update TODO — Mark Items 6-7 complete)
9. Mobile and Vanilla Cleanup: Consolidate vanilla template CSS into one Tailwind source.
=======
9. [done] Mobile and Vanilla Cleanup: Consolidate vanilla template CSS into one Tailwind source.
>>>>>>> fb3f81e0 (docs: Update TODO — Mark Item 9 complete)
=======
9. [done] Mobile and Vanilla Cleanup: Consolidate vanilla template CSS into one Tailwind source.
>>>>>>> fb3f81e0 (docs: Update TODO — Mark Item 9 complete)
10. Mobile and Vanilla Cleanup: Verify no horizontal scroll at 360px.
11. Mobile and Vanilla Cleanup: Keep bottom nav visible without overlap.
12. Mobile and Vanilla Cleanup: Preserve natural header scrolling.
13. Mobile and Vanilla Cleanup: Enforce responsive breakpoints and 44x44 touch targets.
14. Mobile and Vanilla Cleanup: Prevent layout shifts when nav appears or disappears.
15. Beta Architecture Debt: Remove remaining GameStateManager bridge hooks after full Zustand coverage.
16. Beta Architecture Debt: Enforce Tailwind-only defaults for static styling.
17. Beta Architecture Debt: Remove legacy admin compatibility routes from `index.js`.
18. [done] Beta Architecture Debt: Expand component test coverage.
19. Beta Architecture Debt: Refresh API documentation.
20. Beta Architecture Debt: Investigate `/expedition` and `/turn` query performance.
21. [done] Beta Architecture Debt: Clean up duplicate happiness logic and related code-quality debt.
22. Beta Architecture Debt: Decide whether Discord.js v15 migration is still needed before beta.




