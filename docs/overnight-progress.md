# Overnight Progress

> Historical progress log captured on 2026-07-08. It does not define current
> architecture status or the next implementation slice. Use
> `docs/NILE_LEARN_MASTER_PLAN.md` under **Current Modernization Checkpoint**.

This document tracks the controlled beta-readiness build loop for Nile Learn. It is intentionally module-based: finish a safe slice, validate it, then continue.

## Current Snapshot

- Snapshot time: `2026-07-08T01:10:32.296Z`.
- Phase: internal alpha stabilization moving toward beta readiness.
- Active rule: one page = one main job.
- Historical loop boundary: external integrations were placeholders in this
  run. ADR-011 now permits full synthetic Moodle sandbox CRUD; production
  activation and the other providers remain separately gated.
- Current protected portal QA baseline: 1,205 checks, 0 failures.
- Baseline artifact: `output/playwright/overnight-final-rerun-20260708T035400Z/portal-qa-summary.json`.
- Latest full verification artifact: `output/playwright/overnight-final-rerun-20260708T035400Z/portal-qa-summary.json`.

## Dirty Worktree At Start Of This Snapshot

The worktree was already dirty. These files were modified before this documentation snapshot:

- `AGENTS.md`
- `client/src/App.tsx`
- `client/src/components/platform/FeaturePage.tsx`
- `client/src/components/platform/WorkflowExperiences.tsx`
- `client/src/index.css`
- `client/src/pages/platform/AdminUserDetailPage.tsx`
- `client/src/pages/platform/PortalReportsPage.tsx`
- `client/src/pages/platform/TeacherAssessmentPage.tsx`
- `scripts/qa-portals-cli.mjs`

Do not reset or discard these changes. Continue by inspecting each file before editing it.

## Modules

### Module 0: Safety And Status Snapshot

Status: completed.

Evidence inspected:

- Mandatory guidance files were read: `CLAUDE.md`, `AGENTS.md`, `DESIGN.md`, `docs/DESIGN_V2.md`, `docs/SIMPLE_UI.md`, `docs/UI_INFORMATION_ARCHITECTURE.md`, and `.codex/prompts/08-super-admin.md`.
- Architecture and QA files were inspected: `client/src/App.tsx`, `client/src/components/platform/FeaturePage.tsx`, `client/src/components/platform/PageTypes.tsx`, `client/src/pages/platform/SimplePortalPage.tsx`, `client/src/pages/platform/AdminRolesPage.tsx`, `server/platformState.ts`, `server/routes.ts`, `server/auth.ts`, `scripts/qa-portals-cli.mjs`, and `scripts/verify.sh`.
- Current git status was recorded.
- QA baseline artifacts were inspected and confirmed 1,163 checks with 0 failures before the reports split.

Documentation changes in this module:

- Created `docs/overnight-progress.md`.
- Updated `AGENTS.md` to reflect the 1,163-check portal QA baseline available at that point.
- Updated `AGENTS.md` browser policy so browser/manual QA uses Aside by default.

### Module 1: Restore Portal QA Baseline

Status: already green at this snapshot.

Current evidence:

- `output/playwright/codex-admin-governance-fix-verify-final/portal-qa-summary.json`
  - Checked at: `2026-07-07T22:00:33.555Z`
  - Command: `QA_OUTPUT_DIR=output/playwright/codex-admin-governance-fix-verify-final QA_PORT=3015 scripts/verify.sh`
  - Result: 1,163 checks, 0 failures.
- `output/playwright/portal-qa-summary.json`
  - Checked at: `2026-07-07T22:41:46.457Z`
  - Command: `scripts/verify.sh`
  - Result: 1,163 checks, 0 failures.

Admin governance is separated across:

- `/app/admin/roles`
- `/app/admin/permissions`
- `/app/admin/branches`

### Module 2: Update QA Baseline Docs

Status: completed before this snapshot and verified current.

Current evidence:

- `docs/qa-baseline.md` records the 1,163-check, 0-failure baseline.
- It records the unique `QA_OUTPUT_DIR` baseline artifact.
- It documents the Simple UI admin governance split across roles, permissions, and branches.

### Module 3: Simple UI Information Architecture For Admin Users

Status: completed in the current worktree and browser-verified in this snapshot.

Current route contract:

- `/app/admin/users`: user directory only. It shows search, role/branch/status filters, one create action, and a user table.
- `/app/admin/users/new`: create-flow page only. It shows a four-step create user flow.
- `/app/admin/users/:userId`: account overview for one user.
- `/app/admin/users/:userId/access`: access settings for one user.
- `/app/admin/users/:userId/activity`: activity for one user.
- `/app/admin/users/:userId/related`: related records for one user.
- `/app/admin/users/:userId/assignment`: teacher assignment for one teacher account.

Browser QA evidence:

- Tool: Aside REPL.
- Login route: `http://localhost:3000/auth/admin-login`.
- Demo role used: Super Admin.
- Routes checked:
  - `/app/admin/users`
  - `/app/admin/users/new`
  - `/app/admin/users/usr_teacher_demo`
  - `/app/admin/users/usr_teacher_demo/access`
  - `/app/admin/users/usr_teacher_demo/activity`
  - `/app/admin/users/usr_teacher_demo/related`
  - `/app/admin/users/usr_teacher_demo/assignment`
- Result: all routes loaded without sign-in wall, error boundary, or horizontal overflow.
- Users list had one table and no create form.
- Create user had one form and no table.
- User overview/activity/related pages did not show create forms or permission matrices.
- Access and teacher assignment forms are separated into their own subroutes.

### Module 4: Simple UI Information Architecture For Schedule

Status: completed in the current worktree and browser-verified in this snapshot.

Current route contract:

- `/app/admin/schedule`: calendar overview only.
- `/app/admin/schedule/sessions`: class sessions only.
- `/app/admin/schedule/conflicts`: pending schedule conflicts only.
- `/app/admin/schedule/rooms`: room availability and bookings only.
- `/app/admin/schedule/activity`: schedule-related activity only.

Browser QA evidence:

- Tool: Aside REPL.
- Login route: `http://localhost:3000/auth/admin-login`.
- Demo role used: Super Admin.
- Routes checked:
  - `/app/admin/schedule`
  - `/app/admin/schedule/sessions`
  - `/app/admin/schedule/conflicts`
  - `/app/admin/schedule/rooms`
  - `/app/admin/schedule/activity`
- Result: all routes loaded without sign-in wall, error boundary, or horizontal overflow.
- Each route rendered one table for its own job.
- No schedule route showed an operational create form.
- The calendar, sessions, conflicts, rooms, and activity tables did not appear together on one screen.

### Module 5: Simple UI Information Architecture For Reports

Status: completed and fully verified.

Current route contract:

- `/app/admin/reports`: report overview only.
- `/app/admin/reports/attendance`: attendance records only.
- `/app/admin/reports/finance`: invoices and payment follow-up only.
- `/app/admin/reports/certificates`: certificate status rows only.
- `/app/admin/reports/admissions`: leads, applications, and placement activity only.
- `/app/admin/reports/classes`: class groups, branches, teachers, and learner counts only.
- `/app/admin/reports/saved-views`: saved report filters only.

Implementation notes:

- Added the missing finance, certificates, admissions, classes, and saved-views report routes.
- Kept each report page read-only with filters, one table, and CSV export.
- Preserved the existing attendance report QA selector contract.
- Updated the admin user workflow QA to follow the separated Simple UI detail route: create user, open Access settings, then pause the user.
- Added the new admin report subroutes to the portal QA route matrix.

Browser QA evidence:

- Tool: Aside REPL.
- Routes checked:
  - `/app/admin/reports`
  - `/app/admin/reports/attendance`
  - `/app/admin/reports/finance`
  - `/app/admin/reports/certificates`
  - `/app/admin/reports/admissions`
  - `/app/admin/reports/classes`
  - `/app/admin/reports/saved-views`
- Result: all report routes loaded without sign-in wall, error boundary, or horizontal overflow.
- Each route rendered one report table and no operational create/edit forms.
- Aside viewport resize helpers did not resize the browser in this environment; mobile report coverage was verified by portal QA instead.

Full validation evidence:

- `QA_OUTPUT_DIR=output/playwright/overnight-reports-final-20260707T233310Z QA_PORT=3019 scripts/verify.sh`
  - Checked at: `2026-07-07T23:49:46.981Z`
  - Result: 1,198 checks, 0 failures.

### Module 6: Roles, Permissions, And Branches Cleanup Checkpoint

Status: completed by inspection and covered by the latest full QA.

Current route contract:

- `/app/admin/roles`: role overview and role summaries only.
- `/app/admin/permissions`: access rules and permission editing only.
- `/app/admin/branches`: branch management and branch status updates only.

Evidence:

- `AdminRolesPage` renders role rows and links out to Users, Access rules, and Branches. It does not render the permission editor or branch status controls.
- `AdminPermissionsPage` renders role/module filters, access-rule controls, protected permission update requests, result state, and audit context.
- `SimplePortalPage` renders the admin branches page with branch summary rows, status controls, protected branch update requests, result state, and audit context.
- The latest full QA passed the role overview, access-rule update, and branch status update workflows.

### Module 7: Retire Generic FeaturePage Route Ownership

Status: completed and fully verified.

Implementation notes:

- Reduced `featureRoutes` in `client/src/App.tsx` so routes already owned by Simple UI pages or dedicated workflow pages no longer keep duplicate `FeaturePage` fallback entries.
- Removed fallback entries for Student list pages already handled by `SimplePortalPage`: courses, assignments, quizzes, and calendar.
- Removed fallback entries for Teacher quiz and question-bank pages already handled by `TeacherAssessmentPage`.
- Removed fallback entries for HOD departments, programs, levels, teachers, and classes already handled by `SimplePortalPage`.
- Removed fallback entries for Branch Admin students, teachers, and classes already handled by `SimplePortalPage`.
- Removed fallback entries for Super Admin users, user detail, roles, departments, programs, courses, certificates, schedule, and reports already handled by dedicated pages or `SimplePortalPage`.
- Split the remaining student detail routes into dedicated route owners: `StudentLearningPage`, `StudentAssessmentPage`, `StudentRecordsPage`, `StudentSupportPage`, and `PortalMessagesPage`.
- Split teacher workflow routes into dedicated route owners: `TeacherWorkPage`, `TeacherAssessmentPage`, `TeacherClassWorkspacePage`, and `PortalMessagesPage`.
- Split registrar, HOD, branch, and super admin workflow routes into dedicated route-owner pages or focused `SimplePortalPage` routes.
- `client/src/App.tsx` no longer imports or renders `FeaturePage`.

Remaining cleanup:

- `client/src/components/platform/FeaturePage.tsx` still exists in the dirty worktree as an unreferenced component. Delete it in a separate cleanup slice only after the current uncommitted changes are consolidated, so no unrelated work is lost.

Aside browser QA evidence:

- Tool: Aside REPL.
- Role logins tested through real auth forms: Student, Teacher, Head of Department, Branch Admin, and Super Admin.
- Representative routes checked:
  - `/app/student/courses`, `/app/student/assignments`, `/app/student/quizzes`, `/app/student/calendar`
  - `/app/teacher/quizzes`, `/app/teacher/question-bank`
  - `/app/hod/departments`, `/app/hod/programs`, `/app/hod/levels`, `/app/hod/teachers`, `/app/hod/classes`
  - `/app/branch/students`, `/app/branch/teachers`, `/app/branch/classes`
  - `/app/admin/users`, `/app/admin/users/usr_teacher_demo`, `/app/admin/roles`, `/app/admin/courses`, `/app/admin/reports`, `/app/admin/schedule`, `/app/admin/certificates`
- Result: all routes loaded without sign-in wall, error boundary, or horizontal overflow.

Full validation evidence:

- `QA_OUTPUT_DIR=output/playwright/overnight-featurepage-cleanup-20260707T235800Z QA_PORT=3020 scripts/verify.sh`
  - Checked at: `2026-07-08T00:15:28.090Z`
  - Result: 1,198 checks, 0 failures.

### Module 8: RBAC Edge-Case Tests

Status: completed and locally verified.

Implementation notes:

- Strengthened `client/src/lib/auth/server-platform-state.test.ts` with server-boundary RBAC tests.
- Added student negative coverage for assignment, quiz, and lesson actions outside the authenticated student's enrolled course runs.
- Added teacher negative coverage for unrelated class attendance, assignment grading, and quiz review.
- Added teacher positive audit coverage proving successful assignment grading records the authenticated teacher as actor even when the request spoofs another actor.
- Added branch admin negative coverage for attendance and room creation outside the active branch.
- Added registrar negative coverage for student creation and payment recording outside admissions branch scope.
- Added HOD negative coverage for course status, assignment grading, and certificate actions outside department scope.
- Added super admin positive coverage for global branch and permission governance actions with audit evidence.
- No production behavior, RBAC gates, server actions, or UI routes were changed.

Validation evidence:

- `npm test -- --run src/lib/auth/server-platform-state.test.ts`
  - Result: 19 tests passed.
- `npm run check`
  - Result: passed.
- `npm test -- --run`
  - Result: 8 files passed, 166 tests passed.
- `npm run build`
  - Result: passed with existing chunk-size warnings.

Browser QA:

- Not run for this module because it changed only server-side tests and did not change UI, routes, workflows, or runtime behavior.
- The latest full portal QA baseline remains `output/playwright/overnight-featurepage-cleanup-20260707T235800Z/portal-qa-summary.json` with 1,198 checks and 0 failures.

### Module 9: Production Persistence Plan

Status: completed as documentation-only planning.

Implementation notes:

- Created `docs/production-persistence-plan.md`.
- Confirmed current persistence is still snapshot-based through `server/platformRepository.ts`.
- Confirmed local fallback uses `.local-data/platform-state.json`.
- Confirmed Supabase support currently writes optional snapshot/event rows through server-only REST credentials.
- Confirmed `server/platformState.ts` remains the server-side workflow/RBAC/action gate.
- Confirmed `server/sessionStore.ts` remains in-memory and durable production sessions are still a future migration step.
- Confirmed `docs/supabase-phase-1-identity-session-rls-draft.sql` is still a planning draft, not an applied runtime migration.
- No app code, routes, server actions, RBAC gates, persistence behavior, tests, or external integrations were changed.

Plan coverage:

- current snapshot persistence reality
- target normalized Supabase/Postgres schema groups
- RLS rules and role-scope policy direction
- repository interface evolution
- migration phases
- rollback plan
- local/demo boundaries
- server-authoritative ownership
- validation gates
- Aside browser/manual QA evidence requirements for each workflow test

Validation evidence:

- `npx --no-install prettier --check docs/production-persistence-plan.md docs/overnight-progress.md`
  - Result: passed.
- `npm run check`
  - Result: passed.

### Module 10: Repository Abstraction Compatibility Coverage

Status: completed as test-only compatibility work.

Implementation notes:

- Strengthened `client/src/lib/auth/server-platform-repository.test.ts`.
- Added coverage for `normalizePlatformState(null)` to prove invalid snapshot reads recover to a complete seed-compatible state.
- Added coverage for partial persisted snapshots to prove future snapshot/Supabase/read-adapter payloads do not drop seeded compatibility records for users, staff profiles, course runs, class groups, events, portal settings, or report presets.
- Did not change runtime repository behavior.
- Did not change default local/snapshot fallback behavior.
- Did not connect normalized Supabase tables.
- Did not add migrations or external integrations.

Validation evidence:

- `npm test -- --run src/lib/auth/server-platform-repository.test.ts`
  - Result: passed, 6 tests.
- `npx --no-install prettier --check client/src/lib/auth/server-platform-repository.test.ts docs/production-persistence-plan.md docs/overnight-progress.md`
  - Result: passed.
- `npm run check`
  - Result: passed.
- `npm test -- --run`
  - Result: passed, 168 tests.
- `npm run build`
  - Result: passed with existing chunk-size warnings.

Browser QA:

- Not run for this module because it changed only repository tests and did not change UI, routes, workflows, or runtime behavior.
- For future UI/workflow modules, Aside remains the default browser QA path, with Browser plugin and Computer fallback if Aside is unavailable.

### Module 11: Durable Session Hardening Plan

Status: completed as documentation-only planning.

Implementation notes:

- Created `docs/session-hardening-plan.md`.
- Confirmed current server sessions still use `server/auth.ts` plus the in-memory default store from `server/sessionStore.ts`.
- Confirmed client `localStorage` only stores a safe session DTO for UX refresh and must not become an authorization boundary.
- Confirmed Supabase Auth sign-in can identify users when configured, but server-owned app identity, role, branch, and department scope tables are not yet runtime authority.
- No auth runtime behavior, cookies, routes, RBAC gates, persistence behavior, tests, or external integrations were changed.

Plan coverage:

- current in-memory session limitations
- target durable `app_sessions` model
- cookie security contract
- Supabase Auth to `app_users` mapping
- server-confirmed role switching rules
- localStorage limitations
- durable session adapter phases
- RLS/access plan for session rows
- tests required before implementation
- rollback and acceptance gates

Validation evidence:

- `npx --no-install prettier --check docs/session-hardening-plan.md docs/overnight-progress.md`
  - Result: passed.
- `npm run check`
  - Result: passed.

Browser QA:

- Not run for this module because it changed only documentation and did not change UI, routes, workflows, or runtime behavior.

### Module 12: Final Overnight Validation And Report

Status: completed and fully verified.

Implementation notes:

- Ran the final local validation gates after Modules 9-11.
- Ran full portal QA with a unique output directory.
- Investigated the only final full-run failure in the `admin user workflow creates staff account` QA workflow.
- Confirmed the product workflow passed focused QA, then tightened the QA harness so it observes the same server-authoritative paused account state that the UI action writes.
- Updated `scripts/qa-portals-cli.mjs` with a server state fallback for that workflow instead of restoring old combined UI behavior.
- Re-ran the focused workflow and the full portal QA suite after the fix.

Validation evidence:

- `npm run check`
  - Result: passed.
- `npm test -- --run`
  - Result: passed, 168 tests.
- `npm run build`
  - Result: passed with existing chunk-size warnings.
- `QA_OUTPUT_DIR=output/playwright/overnight-final-20260708T033200Z QA_PORT=3021 scripts/verify.sh`
  - Result: failed, 1,205 checks with 1 failure in the admin user workflow.
- `QA_OUTPUT_DIR=output/playwright/overnight-final-focused-admin-user-20260708T035000Z QA_PORT=3022 QA_ONLY_WORKFLOWS='admin user workflow creates staff account' scripts/verify.sh`
  - Result: passed, 5 checks, 0 failures.
- `QA_OUTPUT_DIR=output/playwright/overnight-final-focused-admin-user-fix-20260708T035300Z QA_PORT=3023 QA_ONLY_WORKFLOWS='admin user workflow creates staff account' scripts/verify.sh`
  - Result: passed, 5 checks, 0 failures.
- `QA_OUTPUT_DIR=output/playwright/overnight-final-rerun-20260708T035400Z QA_PORT=3024 scripts/verify.sh`
  - Checked at: `2026-07-08T01:10:32.296Z`.
  - Result: passed, 1,205 checks, 0 failures.
  - Artifact: `output/playwright/overnight-final-rerun-20260708T035400Z/portal-qa-summary.json`.

Browser QA:

- Full portal QA passed after the harness update, covering route matrix checks, deep workflows, and mobile route checks.
- Earlier UI modules in this loop used Aside browser checks for admin users, schedule, reports, and representative fallback-cleanup routes.
- Browser plugin and Computer plugin fallback were not needed because Aside/Playwright validation completed successfully.

## Commands Recorded For This Snapshot

- `git status --short`
- `npm run check`
- `npm test -- --run`
- `npm run build`
- `npm test -- --run src/lib/auth/server-platform-state.test.ts`
- `npm test -- --run src/lib/auth/server-platform-repository.test.ts`
- `npx --no-install prettier --write client/src/lib/auth/server-platform-repository.test.ts`
- `npx --no-install prettier --check client/src/lib/auth/server-platform-repository.test.ts docs/production-persistence-plan.md docs/overnight-progress.md`
- `npx --no-install prettier --check docs/session-hardening-plan.md docs/overnight-progress.md`
- `npx --no-install prettier --check scripts/qa-portals-cli.mjs`
- `scripts/verify.sh`
- Aside CLI smoke checks:
  - `/Users/fin./.local/bin/aside --version`
  - `/Users/fin./.local/bin/aside mcp`
  - `/Users/fin./.local/bin/aside repl "const p = await openTab('http://localhost:3000'); ..."`
- Aside admin user IA check:
  - `/Users/fin./.local/bin/aside repl "... /app/admin/users ... /app/admin/users/usr_teacher_demo/assignment ..."`
- Aside admin schedule IA check:
  - `/Users/fin./.local/bin/aside repl "... /app/admin/schedule ... /app/admin/schedule/activity ..."`
- Aside admin reports IA check:
  - `/Users/fin./.local/bin/aside repl "... /app/admin/reports ... /app/admin/reports/saved-views ..."`
- Aside fallback cleanup route smoke:
  - `/Users/fin./.local/bin/aside repl "... /app/student/courses ... /app/admin/certificates ..."`
- Focused QA reruns:
  - `QA_OUTPUT_DIR=output/playwright/overnight-reports-focused-user-20260707T233214Z QA_PORT=3017 QA_ONLY_WORKFLOWS='admin user workflow creates staff account' scripts/verify.sh`
  - `QA_OUTPUT_DIR=output/playwright/overnight-reports-focused-attendance-20260707T233242Z QA_PORT=3018 QA_ONLY_WORKFLOWS='admin attendance report filters attendance records' scripts/verify.sh`
- Final full QA:
  - `QA_OUTPUT_DIR=output/playwright/overnight-featurepage-cleanup-20260707T235800Z QA_PORT=3020 scripts/verify.sh`
  - `QA_OUTPUT_DIR=output/playwright/overnight-final-20260708T033200Z QA_PORT=3021 scripts/verify.sh`
  - `QA_OUTPUT_DIR=output/playwright/overnight-final-rerun-20260708T035400Z QA_PORT=3024 scripts/verify.sh`
- Final focused QA:
  - `QA_OUTPUT_DIR=output/playwright/overnight-final-focused-admin-user-20260708T035000Z QA_PORT=3022 QA_ONLY_WORKFLOWS='admin user workflow creates staff account' scripts/verify.sh`
  - `QA_OUTPUT_DIR=output/playwright/overnight-final-focused-admin-user-fix-20260708T035300Z QA_PORT=3023 QA_ONLY_WORKFLOWS='admin user workflow creates staff account' scripts/verify.sh`

## Latest Validation Results

- `npm run check`: passed.
- `npx --no-install prettier --check client/src/lib/auth/server-platform-repository.test.ts docs/production-persistence-plan.md docs/overnight-progress.md`: passed.
- `npm test -- --run src/lib/auth/server-platform-state.test.ts`: passed, 19 tests.
- `npm test -- --run src/lib/auth/server-platform-repository.test.ts`: passed, 6 tests.
- `npm test -- --run`: passed, 168 tests.
- `npm run build`: passed with existing chunk-size warnings.
- `npx --no-install prettier --check docs/session-hardening-plan.md docs/overnight-progress.md`: passed.
- `npx --no-install prettier --check scripts/qa-portals-cli.mjs`: passed.
- `scripts/verify.sh`: passed, 1,205 portal QA checks, 0 failures.
- Final portal QA artifact: `output/playwright/overnight-final-rerun-20260708T035400Z/portal-qa-summary.json`.
- Aside browser smoke: passed; Aside opened `http://localhost:3000` and read the page snapshot.
- Aside admin user IA browser QA: passed for list, create, overview, access, activity, related, and assignment routes.
- Aside admin schedule IA browser QA: passed for calendar, sessions, conflicts, rooms, and activity routes.
- Aside admin reports IA browser QA: passed for overview, attendance, finance, certificates, admissions, classes, and saved-views routes.
- Aside fallback cleanup route smoke: passed across Student, Teacher, HOD, Branch Admin, and Super Admin representative routes.

## Browser QA Policy

Use Aside for browser/manual QA during this loop.

- Use `aside repl` for deterministic checks.
- Use `aside exec` for browser-agent style tasks.
- Use `aside mcp` when connected.
- Keep automated repo QA scripts as-is unless the task specifically changes QA infrastructure.

## Remaining Production Gaps

- Normalized production persistence is still planned, not complete.
- `docs/production-persistence-plan.md` now defines the controlled migration plan and rollback gates.
- Durable production sessions are still planned, not complete.
- Supabase/Postgres RLS architecture still needs a controlled implementation plan before schema work.
- External integrations remain placeholders.
- Production media/file/audio/video storage remains intentionally out of scope.
- Some pages still rely on generic workflow/layout patterns and need route-by-route Simple UI separation.

## Recommended Next-Day Plan

- Continue route-by-route Simple UI separation for the remaining crowded pages: student detail/support pages, teacher assignments/grading/calendar/messages/Quran review, registrar operational routes, HOD governance routes, branch operations, and super admin system routes.
- Start durable session implementation only after reviewing `docs/session-hardening-plan.md` and keeping the 1,205-check portal QA baseline clean.
- Start normalized Supabase/Postgres persistence only after reviewing `docs/production-persistence-plan.md` and implementing it as a controlled migration slice.
- Historical instruction for that loop: keep providers as placeholders. The
  current ADR-011 order supersedes this only for full synthetic Moodle sandbox
  CRUD; other providers and production activation remain gated.
