# Nile Learn Agent Guide

## Project

This repository is Nile Learn, a modern Nile Center LMS + EMS platform.

## Mandatory Instruction Files

Before any implementation work, read:

- `CLAUDE.md` for engineering discipline, verification, simplicity, and anti-pattern rules.
- `AGENTS.md` for Nile Learn product, role, security, and portal-specific rules.
- The matching `.codex/prompts/*.md` file for the feature or portal being changed.

If these files conflict, follow the stricter rule and preserve auth, backend behavior, and RBAC.

Do not duplicate rules across these files: `CLAUDE.md` is engineering discipline; `AGENTS.md` is product, security, role, portal, and command authority.

## Product Goal

Build a full role-based learning platform replacing or recreating:

- public course website
- authentication and RBAC
- LMS student portal
- teacher portal
- registrar/EMS portal
- head-of-department portal
- branch admin portal
- super admin portal
- shared academic operations: assessments, attendance, calendar, certificates, Quran, reports

## Design Source Of Truth

Match the existing Nile Learn visual direction:

- modern SaaS LMS UI
- clean cards and operational layouts
- strong spacing, hierarchy, and responsive behavior
- role-specific dashboards and workspaces
- English and Arabic/RTL readiness
- premium, highly respected education platform feel
- no disposable prototype-only pages

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
- `npm test -- --run` for Vitest in this local workspace.
- `npm run build` for production build.
- `scripts/verify.sh` runs a non-mutating Prettier check for `CLAUDE.md`, `AGENTS.md`, `.codex/hooks.json`, and `.codex/prompts/*.md` by default.
- `FULL_FORMAT_CHECK=1 scripts/verify.sh` runs the repo-wide Prettier audit. Use this intentionally because the current app has existing formatting drift.
- `npm run qa:portals` for portal route QA when browser/runtime context is available.
- `npm run seed:supabase` only when explicitly working on Supabase demo seeding.

`npm run lint` and `npm run typecheck` are not currently defined. Do not report them as run unless scripts are added.

## Current Coverage Map

| Area         | Current route coverage                                                                                                                                                | Key implementation pointers                                                                                                                                                                                                       |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public site  | Catalog, course detail, trial, placement, FAQ/contact/about/privacy/terms.                                                                                            | `client/src/App.tsx`, `client/src/pages/public/PublicSitePage.tsx`, `client/src/lib/platformData.ts`                                                                                                                              |
| Auth/RBAC    | Demo/Supabase login path, role selection, password reset, local session, server cookie session, protected route checks, permission map.                               | `client/src/pages/Login.tsx`, `client/src/pages/platform/AuthFlowPage.tsx`, `client/src/components/platform/ProtectedRoute.tsx`, `client/src/lib/auth/session.ts`, `client/src/lib/rbac.ts`, `server/auth.ts`, `server/routes.ts` |
| Student      | Dashboard, course/lesson/live, assignments, quizzes, grades, attendance, calendar, messages, certificates, reports, support, Quran progress, profile.                 | `client/src/App.tsx`, `client/src/lib/platformData.ts`, `client/src/components/platform/WorkflowExperiences.tsx`, `client/src/components/platform/FeaturePage.tsx`                                                                |
| Teacher      | Dashboard, classes/session/materials/students, attendance, assignments, grading, quizzes, question bank, calendar, messages, reports, profile, Quran review.          | `client/src/App.tsx`, `client/src/lib/platformData.ts`, `client/src/components/platform/FeaturePage.tsx`                                                                                                                          |
| Registrar    | Dashboard, leads, applications, students, placement tests, enrollments, classes, schedule, payments, messages, reports, settings.                                     | `client/src/App.tsx`, `client/src/lib/platformData.ts`, `client/src/lib/domain/modules.ts`                                                                                                                                        |
| HOD          | Dashboard, departments, programs, courses, Moodle source, levels, curriculum, teachers, classes, assessments, certificates, reports, messages.                        | `client/src/App.tsx`, `client/src/lib/platformData.ts`, `client/src/pages/platform/RoleDashboard.tsx`                                                                                                                             |
| Branch admin | Dashboard, students, teachers, classes, rooms, schedule, attendance, payments, reports, messages, settings.                                                           | `client/src/App.tsx`, `client/src/lib/platformData.ts`, `client/src/lib/domain/modules.ts`                                                                                                                                        |
| Super admin  | Dashboard, blueprint, users, roles, permissions, branches, departments, programs, courses, Moodle source, settings, integrations, audit logs, reports, system health. | `client/src/App.tsx`, `client/src/lib/platformData.ts`, `client/src/pages/platform/PlatformBlueprintPage.tsx`, `client/src/components/platform/FeaturePage.tsx`                                                                   |
| Assessments  | Student assignments/quizzes, teacher assignments/grading/quizzes/question bank, HOD assessments.                                                                      | `client/src/App.tsx`, `client/src/components/platform/WorkflowExperiences.tsx`, `client/src/lib/domain/modules.ts`                                                                                                                |
| Attendance   | Student attendance, teacher class attendance, branch attendance.                                                                                                      | `client/src/App.tsx`, `client/src/components/platform/WorkflowExperiences.tsx`, `client/src/lib/domain/modules.ts`                                                                                                                |
| Calendar     | Student/teacher calendar plus registrar/branch schedules.                                                                                                             | `client/src/App.tsx`, `client/src/components/platform/WorkflowExperiences.tsx`, `client/src/lib/domain/modules.ts`                                                                                                                |
| Certificates | Student certificates and HOD certificate approval path.                                                                                                               | `client/src/App.tsx`, `client/src/components/platform/WorkflowExperiences.tsx`, `client/src/lib/domain/modules.ts`                                                                                                                |
| Quran        | Public Quran course, student Quran progress, teacher Quran review, HOD/admin course governance.                                                                       | `client/src/App.tsx`, `client/src/components/platform/WorkflowExperiences.tsx`, `client/src/lib/domain/modules.ts`                                                                                                                |
| Reports      | Student, teacher, registrar, HOD, branch, admin report routes plus admin audit/system-health workflows.                                                               | `client/src/App.tsx`, `client/src/components/platform/WorkflowExperiences.tsx`                                                                                                                                                    |

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
PLAN: inspect `WorkflowExperiences`, `FeaturePage`, domain state, and student routes.
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
