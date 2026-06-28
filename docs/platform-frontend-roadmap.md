# Nile Learn Frontend Completion Roadmap

Scope note: auth and backend stay as they are for this phase. The current app uses demo role selection, protected client routes, and a localStorage-backed platform store. This roadmap covers the remaining product, UI, and integration-readiness work that can be completed without replacing that boundary.

## Current Frontend State

- Public marketing/course pages are live for catalog, course detail, trial request, placement booking, FAQ, contact, about, privacy, and terms.
- Role portals are live under `/app/student`, `/app/teacher`, `/app/registrar`, `/app/hod`, `/app/branch`, and `/app/admin`.
- Core feature pages use the shared platform shell, role-aware navigation, searchable tables, filters, quick-create forms, row inspectors, audit logging, metrics, empty states, and responsive layouts.
- Stateful workflows are implemented for learning progress, assignments, quizzes, attendance, scheduling, certificates, Quran review, messages, finance, admissions, reports, integrations, and system admin.
- Legacy prototype routes redirect into the maintained `/app` platform instead of exposing incomplete old screens.
- Moodle, EMS, email, WhatsApp, meeting, payment, upload, PDF, and sync surfaces remain mock-mode or disabled integration boundaries by design.

## Completed In This Phase

1. Platform shell
   - Persisted language and branch selectors.
   - Clickable notification items with read-state updates and navigation.
   - Global search with empty states and result navigation.
   - Sign-out now routes through the existing logout screen.

2. Generic feature pages
   - Search, filter, sort, pagination, selected-row state, and row inspector.
   - Quick-create forms save visible local records and write audit entries.
   - Field-level required validation uses clear labels instead of generic schema errors.

3. Workflow robustness
   - Assignment resubmission updates the existing pending row.
   - Quiz attempts respect attempt limits.
   - Payments become non-repeatable once paid.
   - Lead conversion reuses the existing application.
   - Certificate approval and issue actions become disabled after final state.
   - Messaging, attendance, scheduling, Quran review, and finance actions have disabled/invalid states.

4. Route and loading cleanup
   - Old `/student`, `/teacher`, `/registrar`, `/dashboard`, `/users`, `/payments`, and similar legacy paths redirect to current `/app/...` destinations.
   - Route screens are lazy-loaded behind a shared loading state.

5. Production-depth frontend workspaces
   - Integration detail screens show provider status, required environment variables, server-only boundaries, local check logs, and disabled sync actions when not connected.
   - Reports support local report type selection, saved browser-session presets, live row previews, and CSV export from the local platform store.
   - Scheduling supports day/week/month segmented views, conflict previews, event limits by view, and disabled recurring-rule controls until a server scheduler exists.
   - Certificates support printable local previews and verification-code lookup against local store data.
   - Quran review includes waveform placeholder, tajweed mistake tags, progress scoring, and a disabled upload panel for the future storage provider.

6. Student portal role split
   - Student dashboard actions route to learner work: continue lesson, join live class, submit assignment, message teacher, and view calendar.
   - Assignment and quiz detail routes now respect `:assignmentId` and `:quizId` instead of always rendering the first seeded item.
   - Student attendance is read-only and scoped to the current learner's classes, with review-request affordances instead of teacher save controls.
   - Student calendar shows learner class events, assignment due dates, quiz reminders, and view modes without operational event creation.
   - Student certificates are a wallet and verification view; approval and issuing remain staff-only.
   - Student Quran progress supports learner recitation submission with audit and teacher notification, while teacher review controls stay out of student routes.
   - Student messages are scoped to teachers/support roles and no longer offer the student as their own recipient.
   - Student reports and grades export only learner rows instead of global finance/audit/report data.

7. Teacher portal assessment pass
   - Teacher dashboard primary and quick actions now route to real teacher pages instead of inert buttons or missing `/app/teacher/courses` paths.
   - Teacher assignment detail, assignments, grading, quizzes, and question-bank routes render inside the teacher delivery workspace.
   - Teachers can create class-scoped assignments and quizzes in local platform state with audit entries.
   - Teachers can return feedback on pending assignment submissions, producing a completed submission, grade row, student notification, and audit entry.
   - Assessment route context is class-aware and displays selected assignment, selected quiz, pending work, and question-bank type coverage.
   - The assessment command layout has responsive desktop, tablet, and mobile grid rules.

8. Registrar portal detail pass
   - Registrar dashboard primary and quick actions route to leads, placement, enrollments, and messaging instead of inert controls.
   - Lead, student, and placement detail routes consume URL params and show a selected-record focus panel.
   - Lead detail shows contact, source, conversion status, and conversion action state.
   - Student detail shows account, language/timezone, enrollments, grade, and attendance context.
   - Placement detail shows booking status, recommended level, contact data, and can record a result directly from the detail route.
   - Registrar detail panels include responsive grid rules for desktop, tablet, and mobile.

## Frontend-Only Work Still Worth Doing

These do not require changing auth/backend, but they would make the mock-mode platform feel more complete.

1. Legacy file retirement
   - The old standalone pages and layouts are no longer routed for core workflows.
   - After one more verification pass, remove or archive unused legacy components to reduce maintenance and bundle risk.

2. Automated UI coverage
   - Keep store-level Vitest coverage for critical idempotent operations.
   - Add browser regression specs once the project chooses a committed Playwright setup.
   - The current `qa:portals` wrapper depends on fetching `@playwright/cli` when the local cache is missing; pin a local browser harness before making portal QA mandatory in offline environments.

3. Print and export refinements
   - Add print-specific CSS for certificate previews.
   - Add richer CSV schemas per role after stakeholders confirm exact finance/admissions/report column requirements.

4. Design-system consolidation
   - Extract repeated workflow controls into reusable components once the final shape stabilizes.
   - Keep the current app surfaces operational first; refactor only where it reduces duplication without changing behavior.

## Work Blocked By Backend Or Real Integrations

- Real identity provider, password reset delivery, server-side RBAC, and multi-role account assignment.
- Server persistence, API/service layer, server-side audit log, and multi-user concurrency.
- Moodle content sync, EMS import/export, payment gateway, email/WhatsApp delivery, meeting provider, upload storage, PDF renderer, background jobs, queue retries, and health probes.
- Secure quiz timers, anti-cheat controls, real file submissions, signed downloads, and external calendar sync.

## Suggested Next Order

1. Verify no external stakeholders depend on old standalone paths, then remove unused legacy page/layout files.
2. Add committed browser regression specs for the top role workflows.
3. Add print CSS for certificate previews.
4. Extract repeated report/integration/certificate primitives into reusable components if the files continue to grow.
5. When backend work is allowed, replace the local platform store behind the existing service API first, then wire provider integrations one at a time.
