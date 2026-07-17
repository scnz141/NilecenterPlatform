# Nile Learn Agent Guide

## Project

This repository is Nile Learn, a modern Nile Center LMS + EMS platform.

## Mandatory Instruction Files

Before any implementation work, read:

- `CLAUDE.md` for engineering discipline, verification, simplicity, and anti-pattern rules.
- `AGENTS.md` for Nile Learn product, role, security, and portal-specific rules.
- `docs/NILE_LEARN_MASTER_PLAN.md` for product authority, target architecture,
  migration phases, and implementation sequence.
- `docs/MODERNIZATION_EXECUTION_CONTRACT.md` for agent ownership, phase gates,
  validation, stop conditions, and completion evidence.
- `DESIGN.md` before creating or editing any UI.
- `docs/DESIGN_V2.md` before creating or editing any internal portal UI. It is the stricter UI V2 reset contract for app shell, dashboards, density, and rollout order.
- `docs/SIMPLE_UI.md` before creating or editing any UI. It is the strict simplicity contract: one page, one main job.
- `docs/UI_INFORMATION_ARCHITECTURE.md` before changing internal routes, page
  ownership, navigation, or route-family structure.
- The matching `.codex/prompts/*.md` file for the feature or portal being changed.

If these files conflict, follow the stricter rule and preserve auth, backend behavior, and RBAC.

Rule ownership:

| Authority                                      | Owner                                                 |
| ---------------------------------------------- | ----------------------------------------------------- |
| Engineering discipline                         | `CLAUDE.md`                                           |
| Product, roles, security, portal, and commands | `AGENTS.md`                                           |
| Architecture, data authority, and sequencing   | `docs/NILE_LEARN_MASTER_PLAN.md`                      |
| Agent orchestration and completion gates       | `docs/MODERNIZATION_EXECUTION_CONTRACT.md`            |
| Brand and UI rules                             | `DESIGN.md`, `docs/DESIGN_V2.md`, `docs/SIMPLE_UI.md` |
| Route and page ownership                       | `docs/UI_INFORMATION_ARCHITECTURE.md`                 |
| Feature acceptance                             | Matching `.codex/prompts/*.md` file                   |

Do not duplicate detailed rules across authority files.

## Product Goal

Build a full role-based learning platform that replaces the legacy system while
preserving validated school workflows:

- public course website
- authentication and RBAC
- LMS student portal
- teacher portal
- registrar/EMS portal
- head-of-department portal
- branch admin portal
- super admin portal
- shared academic operations: assessments, attendance, calendar, certificates, Quran, reports

## Current Development Phase

The platform is in internal alpha stabilization and modernization foundation
work. Follow `docs/NILE_LEARN_MASTER_PLAN.md` in order. Broad feature expansion
is paused.

The exact current checkpoint and only approved next implementation slice live
in `docs/NILE_LEARN_MASTER_PLAN.md` under **Current Modernization Checkpoint**.
Do not duplicate or infer that status in companion files.

Current QA baseline:

- Portal QA: 1,634 checks, 0 failures.
- This baseline must not be broken.

Current priority:

1. Preserve clean portal QA.
2. Finalize authority, architecture, migration, and agent contracts.
3. Normalize identity, role grants, scopes, audit, and external mappings.
4. Make production sessions durable before normalized workflow writes.
5. Migrate repositories and workflows in small verified slices.
6. Add read-only Moodle projections and finite EMS migration only in their
   approved phases.
7. Improve UI route by route after each workflow is stable.

Do not implement outside an explicitly approved master-plan phase:

- live Moodle sync
- recurring/live EMS sync or EMS writeback
- payment gateway
- real email/SMS/WhatsApp sending
- meeting provider
- production file/media storage

Integration pages may remain configuration/status placeholders. A visual
`connected` or `synced` label requires server-verified remote evidence.

### Legacy Evidence Boundary

The read-only audit verified Registrar, Teacher, HOD, Supervisor-routed, Branch
Administrator, and Moodle teacher/course surfaces. This evidence informs the
replacement model but authorizes no production import, sync, writeback, or
credential reuse.

- Legacy Supervisor is a capability bundle, not a Nile Learn role and not proof
  of Super Admin behavior.
- Guidance capabilities belong to Registrar admissions scope.
- Academic supervision belongs to HOD scope.
- Branch operations and branch finance oversight belong to Branch Admin scope.
- Global configuration, audit, and controlled finance authority belong to Super
  Admin scope.
- Legacy EMS is a finite migration source. Moodle is initially the authority for
  Moodle-managed content and activities.

Every task must:

- keep scope small
- avoid unrelated refactors
- preserve RBAC
- preserve portal QA
- run validation
- report exact files changed
- report exact commands run

When changing UI:

- follow `DESIGN.md`, `docs/DESIGN_V2.md`, and `docs/SIMPLE_UI.md`
- do not create generic admin screens
- keep the UI simple, clean, and easy
- enforce one page = one main job
- improve one route or one component family at a time
- apply UI V2 in this controlled order: app shell, sidebar, top header, one reference dashboard, visual review, then route-by-route rollout

When changing workflows:

- update tests
- update portal QA only if the product behavior intentionally changed
- preserve audit logging
- preserve server-side action gates

## UI Enforcement

The landing page at <https://nile-center-platform.vercel.app/> is the visual
source of truth. Detailed UI rules live only in the four UI authority documents
listed above.

For every UI slice:

- use one page for one main job;
- use the correct page type and dedicated route owner;
- preserve role scope and workflow behavior;
- include responsive, RTL, accessibility, and all relevant state handling;
- verify laptop, desktop, ultrawide, and mobile behavior;
- do not use a visual redesign to hide missing logic or data authority.

## Roles

Supported roles:

- `student`
- `teacher`
- `registrar`
- `headofdepartment`
- `branchadmin`
- `superadmin`

## Security Rules

- Never hard-code real emails, passwords, Moodle tokens, EMS credentials, API keys, or private user data.
- Use fake local demo users only.
- Use `.env.example` placeholders only.
- Never commit `.env` files.
- Treat `VITE_*` values as browser-public.
- Server-only keys and external provider tokens must stay server-side.
- Current client role selection/localStorage guards are demo UX only, not a production authorization boundary.
- Every protected route must enforce RBAC.
- Every server action/API endpoint must check permissions.
- Server authorization must derive `actorId`, `userId`, `activeRole`, branch scope, and ownership from the authenticated session, not request body fields.
- Do not rely on client-provided `studentId`, `actorId`, `role`, `provider`, or `expiresAt` for authorization.
- Do not weaken auth, validation, RLS, or access control to make tests pass.
- Keep browser-side keys publishable only; service credentials must remain server-side.
- Preserve Supabase RLS posture; do not widen `anon` or `authenticated` access without a server-side access design.

## Coding Rules

- Preserve the existing Vite + React + TypeScript stack.
- Prefer existing components, domain store, route patterns, and design tokens before creating new ones.
- Keep components reusable and role-aware.
- Keep pages meaningful; do not leave empty placeholder screens.
- Add loading, empty, error, disabled, and success states where appropriate.
- Keep changes focused on the requested feature.
- Do not refactor unrelated areas unless required for correctness.

## Repository Commands

Use the commands that exist in `package.json`:

- `npm run check` for TypeScript in this local workspace. Use `USE_PNPM=1 scripts/verify.sh` only after pnpm/node_modules store state is healthy.
- `npm run check:phase1-schema` for static consistency across the promoted
  Phase 1 migration, reviewed SQL, rollback, RLS, assertion, and fake-seed
  artifacts.
- `npm run check:phase1-schema:runtime` for two forward applications, two
  semantic assertion passes, and one rollback drill against disposable PGlite
  PostgreSQL. It never contacts the linked Supabase project.
- `npm run check:phase1-schema:supabase` for the destructive local-only
  Supabase reset, assertion, rollback, reapply, seed, and database-lint gate.
  Start the disposable local stack first. This command must never target a
  linked or shared project.
- `npm run check:phase2-session-schema` for the static Phase 2B RPC, privilege,
  evidence, and rollback contract.
- `npm run check:phase2-session-schema:runtime` for two portable Phase 2B SQL
  applications, exact parameter-bound replay/conflict behavior, live authority
  refresh, injected transaction rollback, direct database-role denial, and one
  rollback/reapply lifecycle in PGlite. It never contacts PostgREST or a
  Supabase project.
- `npm run check:phase2-session:supabase` for the guarded disposable-local
  PostgREST session adapter gate. It resets only the recognized local Supabase
  project from migration history, then verifies the exact fake fixture, durable
  create, hashed-token storage, resolve, expiry, live scope refresh, revocation,
  and browser role denial. It must never target a linked or shared project.
- `npm run check:phase2-session:postgrest` for an already-running isolated local
  PostgREST endpoint when Docker operation is not approved. It requires an
  explicit local-only acknowledgement, rejects non-local URLs, requires the
  exact fresh fake fixture marker, and never applies SQL or changes the runtime
  default.
- `QA_ONLY_WORKFLOWS="<workflow>" npm run verify:focused-fast` for the fast
  workflow inner loop. It runs the integration contracts, TypeScript, unit
  tests, build, and only the selected isolated portal workflow. It never
  replaces the unfiltered final gate.
- `QA_ONLY_WORKFLOWS="<workflow>" npm run verify:focused-qa` builds the current
  application and runs only the selected isolated portal workflow. Use it after
  `npm run verify:phase6d-fast` to avoid repeating unrelated contracts and unit
  tests. It never replaces the unfiltered final gate.
- `npm test -- --run` for Vitest in this local workspace.
- `npm run build` for production build.
- `scripts/verify.sh` runs a non-mutating Prettier check for `CLAUDE.md`, `AGENTS.md`, `.codex/hooks.json`, and `.codex/prompts/*.md` by default.
- `npm run verify:integration-fast` runs the integration ownership/evidence contracts, TypeScript, unit tests, and build in a bounded parallel inner loop. It does not replace the final database and portal gates.
- `npm run verify:phase6b-fast` runs the Phase 6 contracts, Phase 6A/6B portable PostgreSQL gates, TypeScript, and the focused Moodle projection tests in parallel. Use it while implementing Phase 6B; it intentionally omits the full unit suite, build, and portal QA.
- `VERIFY_SCOPE=focused SKIP_PORTAL_QA=1 scripts/verify.sh` is the explicit focused verifier when portal QA is not relevant. Filtered portal runs also require `VERIFY_SCOPE=focused`.
- `npm run verify:phase6c-fast` runs the Phase 6 contracts, Phase 6A/6B portable PostgreSQL gates, TypeScript, and the focused catalog/content portal tests in parallel. Use it for the Moodle projection portal inner loop; it intentionally omits the full unit suite, build, and portal QA.
- `npm run verify:phase6d-fast` runs the feature-freeze, ownership, and Phase 6
  projection contracts with TypeScript and focused projection portal tests in
  parallel. It intentionally omits historical contracts, database runtimes,
  the full unit suite, build, and portal QA.
- `npm run verify:phase6e-fast` runs the feature-freeze, ownership, Phase 6,
  and Phase 6E user-mapping contracts with the portable Phase 6E PostgreSQL
  lifecycle, TypeScript, and focused repository tests. It intentionally omits
  the full unit suite, build, and portal QA.
- `npm run check:phase6f-moodle-enrollment-group` and
  `npm run check:phase6f-moodle-enrollment-group:runtime` verify the manual,
  unapplied enrollment/group observation SQL, service-only role boundaries,
  exact-class teacher scope, aggregate governance scope, retention, replay,
  rollback, and browser-role denials in portable PostgreSQL.
- `npm run verify:phase6f-fast` runs the feature-freeze, ownership, Phase 6,
  Phase 6E, and Phase 6F contracts with both portable PostgreSQL lifecycles,
  TypeScript, and focused enrollment/group repository and route tests. It
  intentionally omits the full unit suite, build, and portal QA.
- `npm run check:phase6g-moodle-assessment-status` and
  `npm run check:phase6g-moodle-assessment-status:runtime` verify the manual,
  unapplied assessment-definition and schedule-status observation package,
  service-only authorization, exact class/user mappings, replay, retention,
  rollback, and browser-role denials in portable PostgreSQL.
- `npm run verify:phase6g-fast` runs the bounded Phase 6G contracts, portable
  PostgreSQL lifecycles, TypeScript, and focused assessment projection tests in
  parallel. It intentionally omits the full unit suite, build, and portal QA.
- `npm run check:phase6h1-moodle-assignment-result` and
  `npm run check:phase6h1-moodle-assignment-result:runtime` verify the manual,
  unapplied assignment-result observation package, normalized-session and
  role-grant authority, exact class/assignment/user mappings, 15-minute
  freshness, 30-day retention, replay, rollback, and browser-role denials.
- `npm run verify:phase6h1-fast` runs the existing Phase 6 contracts, the new
  static and portable PostgreSQL gates, TypeScript, and focused freshness,
  repository, and route tests in parallel. It intentionally omits the full unit
  suite, build, and portal QA.
- `npm run check:phase6h2-moodle-quiz-attempt` and
  `npm run check:phase6h2-moodle-quiz-attempt:runtime` verify the separate,
  manual quiz-attempt summary package, exact quiz/attempt/user mappings,
  student-own and exact-class teacher results, aggregate governance scope,
  freshness, retention, replay, rollback, and browser-role denials.
- `npm run verify:phase6h2-fast` runs the bounded Phase 6H2 contracts,
  portable PostgreSQL lifecycles, TypeScript, and focused projection tests. It
  intentionally omits the full unit suite, build, and portal QA.
- `npm run check:phase6h3-moodle-grade-outcome` and
  `npm run check:phase6h3-moodle-grade-outcome:runtime` verify the separate,
  manual grade-outcome package, exact grade-item and user mappings, released
  learner feedback, aggregate governance scope, freshness, retention, replay,
  rollback, and browser-role denials.
- `npm run verify:phase6h3-fast` runs the bounded Phase 6H3 contracts, portable
  PostgreSQL lifecycle, TypeScript, and focused projection tests. It
  intentionally omits the full unit suite, build, and portal QA.
- `npm run check:phase6h4-moodle-activity-outcome` and
  `npm run check:phase6h4-moodle-activity-outcome:runtime` verify the separate,
  manual lesson/H5P/SCORM outcome-summary package, exact activity and user
  mappings, released scores, aggregate governance scope, freshness, retention,
  replay, rollback, and browser-role denials.
- `npm run verify:phase6h4-fast` runs the bounded Phase 6H4 contracts, portable
  PostgreSQL lifecycle, TypeScript, and focused projection tests. It
  intentionally omits the full unit suite, build, and portal QA.
- `npm run check:phase6-staging-db:static` verifies the immutable Phase 6I
  target, ordered SQL package, artifact hashes, and trusted local tooling
  without reading credentials or contacting a remote project.
- `npm run check:phase6i-pgcrypto-compatibility:runtime` proves the service-only
  `public.digest` compatibility wrappers against an `extensions`-schema
  pgcrypto installation, including rollback/reapply and browser-role denial.
- `npm run check:phase6-staging-db:dry-run` verifies the explicitly supplied
  isolated-staging target guards without reading credentials or contacting the
  database. It rejects the pinned production project and keeps the normalized
  projection repository disabled.
- `npm run check:phase6-staging-db:live` is the explicit, acknowledgement-gated
  Phase 6I isolated-staging promotion and PostgREST/RLS proof. It accepts only
  the pinned fake-data staging project, applies the reviewed read-only packages,
  runs semantic assertions, proves service-role access and browser-role denial,
  drills rollback/reapply, invalidates the temporary fake login, and writes
  redacted evidence. It must never target production or enable Moodle calls,
  Moodle writes, or the normalized runtime.
- Plain `scripts/verify.sh` is the final gate. It rejects portal filters/skips and asserts the protected `1,634/0` summary.
- `FULL_FORMAT_CHECK=1 scripts/verify.sh` runs the repo-wide Prettier audit. Use this intentionally because the current app has existing formatting drift.
- `npm run qa:portals` for portal route QA when browser/runtime context is available.
- `npm run seed:supabase` only when explicitly working on Supabase demo seeding.
- `npm run check:moodle-phase4-loops` verifies that every frozen Moodle read and
  bounded sandbox-write contract has complete lifecycle evidence, deterministic
  replay, cleanup, teardown, and authority-denial coverage.
- `npm run check:integration-phase5-staging` verifies the immutable, redacted
  Phase 5 target and SQL artifact contract without network access.
- `npm run check:phase5-staging-db` is the explicit opt-in isolated-staging
  migration, assertion, rollback, reapply, and denial proof. It must reject the
  production project and must never print credentials.
- `npm run check:phase5-staging-db:static` and
  `npm run check:phase5-session-runtime` are network-free Phase 5 preflights.
  The live durable-session command remains explicit, staging-only, and
  credential-gated.

`scripts/verify.sh` keeps the Docker-backed Phase 1 Supabase gate opt-in. Set
`RUN_SUPABASE_LOCAL_CHECK=1` only when the disposable local stack is running.
It runs the Phase 2B static and portable PGlite gates by default. Run the real
Phase 2 PostgREST adapter gate separately only against the approved isolated
endpoint when its current slice requires it.

`npm run lint` and `npm run typecheck` are not currently defined. Do not report them as run unless scripts are added.

## Browser Policy

For browser/manual QA, use the Codex in-app Browser:

- Reuse the Codex in-app Browser tab for route checks, DOM inspection,
  screenshots, responsive checks, and smoke tests.
- Do not launch Chrome, a browser extension, standalone Playwright, Selenium,
  or another browser window for manual QA.
- If the Codex in-app Browser is unavailable, stop browser work and report the
  blocker instead of silently switching browser surfaces.

Repository validation commands such as `npm run qa:portals` may still use their built-in automation.

## Current Coverage Map

| Area         | Current route coverage                                                                                                                                                | Key implementation pointers                                                                                                                                                                                                                                                                                         |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public site  | Catalog, course detail, trial, placement, FAQ/contact/about/privacy/terms.                                                                                            | `client/src/App.tsx`, `client/src/pages/public/PublicSitePage.tsx`, `client/src/lib/platformData.ts`                                                                                                                                                                                                                |
| Auth/RBAC    | Demo/Supabase login path, role selection, password reset, local session, server cookie session, protected route checks, permission map.                               | `client/src/pages/Login.tsx`, `client/src/pages/platform/AuthFlowPage.tsx`, `client/src/components/platform/ProtectedRoute.tsx`, `client/src/lib/auth/session.ts`, `client/src/lib/rbac.ts`, `server/auth.ts`, `server/routes.ts`                                                                                   |
| Student      | Dashboard, course/lesson/live, assignments, quizzes, grades, attendance, calendar, messages, certificates, reports, support, Quran progress, profile.                 | `client/src/App.tsx`, `client/src/pages/platform/StudentLearningPage.tsx`, `client/src/pages/platform/StudentAssessmentPage.tsx`, `client/src/pages/platform/StudentRecordsPage.tsx`, `client/src/pages/platform/StudentSupportPage.tsx`, `client/src/pages/platform/PortalMessagesPage.tsx`                        |
| Teacher      | Dashboard, classes/session/materials/students, attendance, assignments, grading, quizzes, question bank, calendar, messages, reports, profile, Quran review.          | `client/src/App.tsx`, `client/src/pages/platform/TeacherClassesPage.tsx`, `client/src/pages/platform/TeacherClassWorkspacePage.tsx`, `client/src/pages/platform/TeacherAssessmentPage.tsx`, `client/src/pages/platform/TeacherWorkPage.tsx`, `client/src/pages/platform/PortalMessagesPage.tsx`                     |
| Registrar    | Dashboard, leads, applications, students, placement tests, enrollments, classes, schedule, payments, messages, reports, settings.                                     | `client/src/App.tsx`, `client/src/lib/platformData.ts`, `client/src/lib/domain/modules.ts`                                                                                                                                                                                                                          |
| HOD          | Dashboard, departments, programs, courses, Moodle source, levels, curriculum, teachers, classes, assessments, certificates, reports, messages.                        | `client/src/App.tsx`, `client/src/lib/platformData.ts`, `client/src/pages/platform/RoleDashboard.tsx`                                                                                                                                                                                                               |
| Branch admin | Dashboard, students, teachers, classes, rooms, schedule, attendance, payments, reports, messages, settings.                                                           | `client/src/App.tsx`, `client/src/lib/platformData.ts`, `client/src/lib/domain/modules.ts`                                                                                                                                                                                                                          |
| Super admin  | Dashboard, blueprint, users, roles, permissions, branches, departments, programs, courses, Moodle source, settings, integrations, audit logs, reports, system health. | `client/src/App.tsx`, `client/src/lib/platformData.ts`, `client/src/pages/platform/PlatformBlueprintPage.tsx`, `client/src/pages/platform/AdminUsersPage.tsx`, `client/src/pages/platform/AdminReportsPage.tsx`, `client/src/pages/platform/AdminCoursesPage.tsx`, `client/src/pages/platform/SimplePortalPage.tsx` |
| Assessments  | Student assignments/quizzes, teacher assignments/grading/quizzes/question bank, HOD assessments.                                                                      | `client/src/App.tsx`, `client/src/components/platform/WorkflowExperiences.tsx`, `client/src/lib/domain/modules.ts`                                                                                                                                                                                                  |
| Attendance   | Student attendance, teacher class attendance, branch attendance.                                                                                                      | `client/src/App.tsx`, `client/src/components/platform/WorkflowExperiences.tsx`, `client/src/lib/domain/modules.ts`                                                                                                                                                                                                  |
| Calendar     | Student/teacher calendar plus registrar/branch schedules.                                                                                                             | `client/src/App.tsx`, `client/src/components/platform/WorkflowExperiences.tsx`, `client/src/lib/domain/modules.ts`                                                                                                                                                                                                  |
| Certificates | Student certificates and HOD certificate approval path.                                                                                                               | `client/src/App.tsx`, `client/src/components/platform/WorkflowExperiences.tsx`, `client/src/lib/domain/modules.ts`                                                                                                                                                                                                  |
| Quran        | Public Quran course, student Quran progress, teacher Quran review, HOD/admin course governance.                                                                       | `client/src/App.tsx`, `client/src/components/platform/WorkflowExperiences.tsx`, `client/src/lib/domain/modules.ts`                                                                                                                                                                                                  |
| Reports      | Student, teacher, registrar, HOD, branch, admin report routes plus admin audit/system-health workflows.                                                               | `client/src/App.tsx`, `client/src/components/platform/WorkflowExperiences.tsx`                                                                                                                                                                                                                                      |

## Standard Loop

For every portal or feature slice, use:

1. <u>READ</u>: read `CLAUDE.md`, `AGENTS.md`, the matching prompt, and the files to be changed.
2. <u>SPEC</u>: define the target route, role, data model, permissions, UX states, and acceptance criteria.
3. <u>PLAN</u>: identify files, components, domain store functions, route structure, and tests.
4. <u>IMPLEMENT</u>: build the route/components/data/actions with the existing design system.
5. <u>VERIFY</u>: run `scripts/verify.sh` or the relevant subset of `npm run check`, `npm test -- --run`, `npm run build`, and browser QA.
6. <u>REVIEW</u>: run focused reviewer agents or manual code review for UI, RBAC, QA, data, and security.
7. <u>FIX</u>: feed findings back into implementation with the smallest relevant patch.
8. <u>DOCUMENT</u>: update feature checklist, README notes, or prompt status when useful.

## Portal Specs

### Public Site

<u>SPEC</u>: Public pages must explain Nile Center courses, trial/placement booking, certificate verification, and course discovery with strong responsive design.
PLAN: inspect public routes, catalog data, forms, and verification workflow.
IMPLEMENT: build real forms against local/domain services, visible success/error states, and mobile-first layout.
VERIFY: check public pages, booking flow, certificate verification, and responsive overflow.
REVIEW: UI reviewer and QA reviewer.
FIX: resolve layout, copy, validation, and accessibility issues.
DOCUMENT: update public-site prompt notes and README if behavior changes.

### Auth And RBAC

<u>SPEC</u>: Auth pages must separate student/admin entry points, preserve existing auth/backend behavior, and enforce role-based route access.
PLAN: inspect auth routes, session storage, role guards, and protected shell.
IMPLEMENT: improve UX without weakening guards.
VERIFY: test login/logout, direct route access, and role redirects.
REVIEW: RBAC reviewer and security reviewer.
FIX: close bypasses and route leaks.
DOCUMENT: note auth assumptions and backend boundaries.

### Student Portal

<u>SPEC</u>: Student portal must include dashboard, courses, custom player, assignments, quizzes, calendar, attendance, certificates, Quran progress, messages, reports, support, and profile.
PLAN: inspect `StudentLearningPage`, `StudentAssessmentPage`, `StudentRecordsPage`, `PortalMessagesPage`, `WorkflowExperiences`, domain state, and student routes.
IMPLEMENT: build stateful learning and account flows, not static cards.
VERIFY: complete lessons, submit assignments/quizzes, use support/profile, test mobile and classroom-board view.
REVIEW: UI reviewer and QA reviewer.
FIX: address overflow, action state, and stale selection bugs.
DOCUMENT: note learning-player behavior and remaining integrations.

### Teacher Portal

<u>SPEC</u>: Teacher portal must support classes, sessions, attendance, materials, grading, quizzes, question bank, Quran review, messages, calendar, and reports.
PLAN: map teacher routes to course runs, class groups, lessons, resources, assignments, attendance, and messages.
IMPLEMENT: create real teacher workflows using domain store actions.
VERIFY: create sessions, save attendance, publish materials, send reminders, and test responsiveness.
REVIEW: UI reviewer, QA reviewer, and data architect.
FIX: correct workload, roster, and class-selection issues.
DOCUMENT: update teacher portal checklist.

### Registrar Portal

<u>SPEC</u>: Registrar portal must handle leads, applications, students, placement tests, enrollments, classes, schedule, payments, messages, reports, and settings.
PLAN: inspect EMS-like data models and registrar workflows.
IMPLEMENT: create lead conversion, placement result, payment, enrollment, and schedule flows.
VERIFY: create/convert leads, record placement, record payment, test route detail pages.
REVIEW: QA reviewer and data architect.
FIX: address pipeline state and payment consistency.
DOCUMENT: document EMS boundaries.

### HOD Portal

<u>SPEC</u>: HOD portal must manage departments, programs, courses, Moodle source, levels, curriculum, teachers, classes, assessments, certificates, reports, and messages.
PLAN: inspect academic governance components and course/curriculum models.
IMPLEMENT: build academic governance and approval workflows.
VERIFY: create modules, publish curriculum, review teachers/classes, approve certificates.
REVIEW: data architect and QA reviewer.
FIX: resolve academic ownership and curriculum mapping issues.
DOCUMENT: update academic management notes.

### Branch Admin Portal

<u>SPEC</u>: Branch admin portal must manage local students, teachers, classes, rooms, schedule, attendance, payments, reports, messages, and settings.
PLAN: inspect branch operations, rooms, class groups, events, invoices, and attendance.
IMPLEMENT: build room, class, staff, local schedule, and payment workflows.
VERIFY: create room, update room status, check branch-scope UI, test mobile.
REVIEW: UI reviewer and QA reviewer.
FIX: address branch-only visibility and scheduling conflicts.
DOCUMENT: record branch-scope assumptions.

### Super Admin Portal

<u>SPEC</u>: Super admin portal must govern users, roles, permissions, branches, integrations, audit logs, reports, system health, settings, and platform blueprint.
PLAN: inspect RBAC, integration configs, audit logs, and platform shell.
IMPLEMENT: build access control and system operations workspaces using local platform state.
VERIFY: create user, update roles/permissions, update connector status, export audit, run health checks.
REVIEW: RBAC reviewer, security reviewer, QA reviewer.
FIX: close permission, audit, and route-scope gaps.
DOCUMENT: maintain super-admin operations notes.

### Assessments

<u>SPEC</u>: Assessments must support assignments, quizzes, question bank, grading, attempts, submissions, feedback, and manual review.
PLAN: inspect assignment, quiz, submission, grade models.
IMPLEMENT: use domain store actions for submissions and attempts.
VERIFY: submit assignment, submit quiz, grade/review where supported.
REVIEW: data architect and QA reviewer.
FIX: correct attempt counts and grading state.
DOCUMENT: note remaining external grading/storage integrations.

### Attendance

<u>SPEC</u>: Attendance must support session rosters, present/late/absent/excused states, save flow, and role-specific visibility.
PLAN: inspect class sessions, class groups, attendance records.
IMPLEMENT: use `saveAttendanceBulk` and show saved/pending status.
VERIFY: save attendance and check audit/state.
REVIEW: QA reviewer.
FIX: resolve roster/session mismatches.
DOCUMENT: note attendance rules.

### Calendar

<u>SPEC</u>: Calendar must support class sessions, live sessions, placement tests, room bookings, conflicts, and role filters.
PLAN: inspect events, rooms, class groups, teacher availability.
IMPLEMENT: use `createCalendarEvent` and show conflict state.
VERIFY: create event with and without conflicts; test mobile.
REVIEW: QA reviewer and data architect.
FIX: correct overlap and room/teacher conflicts.
DOCUMENT: note scheduler limitations.

### Certificates

<u>SPEC</u>: Certificates must support eligibility, approval, issue state, verification code, preview, and download/print placeholder.
PLAN: inspect certificates, courses, students, verification lookup.
IMPLEMENT: use approve/issue/verify domain actions.
VERIFY: approve, issue, verify, and test student/admin views.
REVIEW: QA reviewer and security reviewer.
FIX: prevent invalid issue/approval state transitions.
DOCUMENT: note certificate verification behavior.

### Quran Features

<u>SPEC</u>: Quran functionality must support memorization plans, tajweed progress, recitation review, mistake tags, revision cycles, and future audio storage.
PLAN: inspect Quran progress, recitation submissions, teacher/student routes.
IMPLEMENT: use Quran progress and recitation review actions.
VERIFY: update progress, review recitation, test mobile.
REVIEW: UI reviewer and data architect.
FIX: correct Quran-specific state and terminology.
DOCUMENT: note storage/provider limitations.

### Reports

<u>SPEC</u>: Reports must support role-specific analytics, filters, saved views, CSV export, and audit/report rows.
PLAN: inspect `exportReportRows`, reports workflow, and route roles.
IMPLEMENT: build live local summaries from platform state.
VERIFY: switch report types, export CSV, test mobile.
REVIEW: QA reviewer and data architect.
FIX: correct metrics and export shape.
DOCUMENT: document report row sources.

### Security Review

<u>SPEC</u>: Security review must cover secrets, auth, RBAC, backend actions, route guards, env boundaries, and sensitive data handling.
PLAN: inspect routes, API/server code, env usage, Supabase boundaries.
IMPLEMENT: patch only validated security gaps without weakening features.
VERIFY: run checks/build/tests and targeted route/API tests.
REVIEW: security reviewer and RBAC reviewer.
FIX: remediate high-confidence findings.
DOCUMENT: record limitations and assumptions.

## Response After Each Task

Return:

- mandatory guidance files read
- summary of work
- changed files
- commands run
- validation results
- remaining limitations
