# Nile Learn Route Modernization Plan

## Purpose

This plan controls the user-approved continuation of Phase 12 route-by-route
UI completion. It replaces remaining older, uneven portal surfaces without
changing workflow behavior, route authorization, server actions, persistence,
or provider boundaries.

The visual target remains the Nile Learn landing page language: warm neutral
canvas, quiet white surfaces, charcoal actions, role-aware accents, concise
copy, and clear school operations. The governing UI contracts are `DESIGN.md`,
`docs/DESIGN_V2.md`, `docs/SIMPLE_UI.md`, and
`docs/UI_INFORMATION_ARCHITECTURE.md`.

## Code-Grounded Audit

The route registry in `client/src/App.tsx` already maps most portal pages to
dedicated route components. The old generic fallback is not the main active
problem: `SimplePortalPage` currently owns only `/app/admin/branches`.

The remaining modernization risk is concentrated in the following areas:

- Older route components with dense, multi-purpose composition, especially
  `HodWorkflowPage`, `TeacherWorkPage`, and `TeacherAssessmentPage`.
- Older presentation layers such as `admin-v3.css`,
  `teacher-delivery-v3.css`, and `student-learning-v3.css` that remain beneath
  newer portal-specific overrides.
- Large legacy implementation files (`FeaturePage.tsx` and
  `WorkflowExperiences.tsx`) that should not be reused for new route work.
  `FeaturePage` has no active route import; its removal is a later cleanup,
  after active route families are independently verified.
- Secondary portal pages where technical status, editing, and contextual detail
  can still compete on the same screen.

The audit does not justify a global stylesheet rewrite or a universal card
template. Each route family needs a page-type-specific solution.

## Non-Negotiable Boundaries

- Preserve existing routes, business logic, RBAC, server-action gates,
  persistence, audit evidence, and role scopes.
- Do not activate Moodle, EMS, payment, email/SMS/WhatsApp, meeting, or
  production-media integrations.
- Do not create a new generic `FeaturePage` replacement.
- Do not add charts merely to fill space. A chart must answer an operational
  question and have text alternatives.
- Preserve the protected portal QA baseline of 1,634 checks and 0 failures.
- A portal family moves forward only after desktop, tablet/mobile, and
  ultrawide review in the Codex in-app Browser.

## Rollout Order

### Phase 12A: Super Admin System Workspaces - accepted

Routes:

- `/app/admin/settings`
- `/app/admin/integrations`
- `/app/admin/system-health`

Owners:

- `AdminSettingsPage.tsx`
- `AdminIntegrationsPage.tsx`
- `AdminSystemHealthPage.tsx`
- `admin-v4.css`

Target:

- Settings becomes a grouped, calm configuration form with one save action.
- Connections becomes a list-first readiness workspace with a compact selected
  connection inspector, not a technical provider dump.
- Health becomes a concise operational health report with one decision-focused
  status visualization and short service rows. Technical internals stay on the
  dedicated Connections page.

Acceptance:

- Settings remains a single grouped school-setup form with one save action.
- Connections remains list-first with a bounded readiness inspector and a
  mobile-safe two-column status filter.
- Health remains a concise readiness report with short service rows.
- Desktop and mobile browser review passed with no horizontal overflow.
- TypeScript, 856 unit tests, the production build, and the full 1,634/0 portal
  QA baseline passed on 2026-07-18.

### Phase 12B: Student Learning Core - accepted

Routes:

- `/app/student/courses`
- `/app/student/courses/:courseId`
- `/app/student/courses/:courseId/learn/:lessonId`
- `/app/student/courses/:courseId/live`
- `/app/student/assignments/:assignmentId`
- `/app/student/quizzes/:quizId`

Owners:

- `StudentWorkspacePage.tsx`
- `StudentLearningPage.tsx`
- `StudentAssessmentPage.tsx`
- `student-learning-v3.css`, `student-v5.css`

Target: a course list, one course path, one lesson/player, one live class, and
one assessment response at a time. Preserve immersive board mode while making
desktop, tablet, and mobile controls predictable.

Acceptance:

- Course discovery, course path, and lesson/player routes remain focused on one
  learning job each.
- The live route renders enrolled class/session context instead of falling back
  to an unrelated practice lesson.
- Closed assignment and quiz routes render the learner's scoped saved response,
  result, and teacher feedback when those records exist.
- Desktop and mobile in-app Browser review passed without horizontal overflow.
- TypeScript, 856 unit tests, the production build, the three focused student
  workflows, and the full 1,634/0 portal QA baseline passed on 2026-07-18.

### Phase 12C: Teacher Delivery And Assessment - accepted

Routes:

- `/app/teacher/classes` and `/app/teacher/classes/:classId/*`
- `/app/teacher/assignments/*`
- `/app/teacher/grading/*`
- `/app/teacher/quizzes/*`
- `/app/teacher/question-bank/*`
- `/app/teacher/calendar/*`
- `/app/teacher/quran-review/*`

Owners:

- `TeacherClassesPage.tsx`
- `TeacherClassDetailPage.tsx`
- `TeacherClassWorkspacePage.tsx`
- `TeacherWorkPage.tsx`
- `TeacherAssessmentPage.tsx`
- `teacher-delivery-v3.css`, `teacher-v5.css`

Target: class delivery, attendance, assignment lifecycle, review queue, quiz
authoring, calendar creation, and Quran review stay separate route jobs. In
particular, roster and attendance controls must remain usable in classroom and
mobile widths.

Acceptance:

- Class delivery, attendance, materials, assignment lifecycle, grading, quiz
  authoring/review, question-bank, calendar, and Quran review remain separate
  route jobs.
- Misleading hard-coded assignment and grading workload badges were removed;
  the sidebar no longer claims counts that are not derived from scoped state.
- Quran review copy now covers both pending and already-recorded feedback.
- Desktop and representative mobile in-app Browser review passed without
  horizontal overflow.
- TypeScript, 856 unit tests, the production build, 60 focused teacher workflow
  checks, and the full 1,634/0 portal QA baseline passed on 2026-07-18.

### Phase 12D: Registrar Operations - accepted

Routes:

- `/app/registrar/leads*`
- `/app/registrar/applications*`
- `/app/registrar/placement-tests*`
- `/app/registrar/students*`
- `/app/registrar/enrollments*`
- `/app/registrar/payments*`
- `/app/registrar/schedule*`

Owners:

- `RegistrarAdmissionsPage.tsx`
- `RegistrarStudentsPage.tsx`
- `RegistrarEnrollmentsPage.tsx`
- `RegistrarEnrollmentRecordsPage.tsx`
- `RegistrarPaymentsPage.tsx`
- `RegistrarSchedulePage.tsx`
- `registrar-v3.css`, `registrar-v5.css`

Target: each admission stage remains a focused desk: find records, inspect one
record, or complete one handoff. Do not return pipeline, payment, enrollment,
and activity panels to the same screen.

Acceptance:

- Leads, applications, placement, students, enrollment, payments, and schedule
  remain separate route jobs with dedicated list, detail, create, and handoff
  surfaces.
- Misleading hard-coded lead and placement sidebar counts were removed; the
  navigation no longer contradicts scoped server-backed records.
- The enrollment transfer and status controls use a dedicated responsive form
  layout instead of the unrelated room form grid.
- Desktop and representative mobile in-app Browser review passed without
  horizontal overflow across the registrar route family.
- TypeScript, 856 unit tests, the production build, 50 focused registrar
  workflow checks, and the full 1,634/0 portal QA baseline passed on
  2026-07-18.

### Phase 12E: HOD Academic Governance - accepted

Routes:

- `/app/hod/courses*`
- `/app/hod/curriculum*`
- `/app/hod/classes*`
- `/app/hod/assessments*`
- `/app/hod/certificates*`
- `/app/hod/schedule*`

Owners:

- `HodWorkflowPage.tsx`
- `HodDirectoryPage.tsx`
- `HodCourseRunCreatePage.tsx`
- `hod-v3.css`, `hod-v4.css`

Target: academic governance separates catalog, curriculum, delivery, review,
and certificate approvals by route. The component should be split only where a
single page currently owns more than one of those jobs.

Acceptance:

- Catalog, curriculum, class delivery, schedule, assessment creation/review,
  and certificate decisions remain separate route jobs.
- The misleading hard-coded certificate badge was removed; navigation no
  longer claims a queue that is not derived from scoped certificate state.
- Desktop and representative mobile in-app Browser review passed without
  horizontal overflow across fourteen list, detail, create, and review routes.
- TypeScript, 856 unit tests, the production build, 47 focused HOD workflow
  checks, and the full 1,634/0 portal QA baseline passed on 2026-07-18.

### Phase 12F: Branch Operations - accepted

Routes:

- `/app/branch/students`
- `/app/branch/teachers`
- `/app/branch/classes*`
- `/app/branch/rooms*`
- `/app/branch/schedule*`
- `/app/branch/attendance`
- `/app/branch/payments*`

Owners:

- `BranchDirectoryPage.tsx`
- `BranchClassCreatePage.tsx`
- `BranchClassDetailPage.tsx`
- `BranchRoomsPage.tsx`
- `BranchSchedulePage.tsx`
- `BranchSessionDetailPage.tsx`
- `BranchAttendancePage.tsx`
- `BranchPaymentsPage.tsx`
- `branch-v3.css`, `branch-v4.css`

Target: local operations use clear tables, room/schedule context, and one
branch scope. Long operational rows should become priority-based mobile rows,
not narrow desktop tables.

Acceptance:

- Students, teachers, classes, rooms, schedule, attendance, and payments
  remain separate branch-scoped route jobs.
- The misleading hard-coded attendance badge was removed; navigation no
  longer advertises exceptions that are not derived from scoped state.
- Desktop and representative mobile in-app Browser review passed without
  horizontal overflow across thirteen list, detail, and create routes.
- TypeScript, 856 unit tests, the production build, 67 focused branch workflow
  checks, and the full 1,634/0 portal QA baseline passed on 2026-07-18.

### Phase 12G: Remaining Super Admin And Forms Review - accepted

Routes include courses, departments, programs, certificates, schedule,
reports, activity, profile, and forms builder/review surfaces that are not
already covered by a narrower phase.

Owners include `AdminCoursesPage.tsx`, `AdminDirectoryPage.tsx`,
`AdminSchedulePage.tsx`, `AdminReportsPage.tsx`, `AdminAuditLogsPage.tsx`, and
the Nile Forms page family.

Target: complete route-specific cleanup only after the preceding portal slices.
Nile Forms receives separate visual review because its canvas and inspector are
an authoring environment, not a standard dashboard.

Acceptance:

- Academic directories, course governance, schedule, reports, activity,
  profile, and Forms remain separate route jobs with distinct semantic
  headings.
- The Forms builder remains a purpose-built authoring workspace; assigned,
  manage, publish, assignment, and review work stay on dedicated routes.
- Desktop and mobile in-app Browser review passed without horizontal overflow
  across thirty-two representative Super Admin and Forms routes.
- TypeScript, 856 unit tests, the production build, 60 focused Super Admin
  checks, focused Forms submission and assignment checks, and the full
  1,634/0 portal QA baseline passed on 2026-07-18.

## Slice Workflow

For every phase above:

1. Confirm current route owner, page type, data authority, and existing QA
   selectors.
2. Define a narrow route-family write set and preserve all workflow actions.
3. Build the smallest coherent visual and responsive change using existing
   shell, layouts, primitives, and tokens.
4. Add or adjust stable selectors only when UI structure makes current QA
   selectors invalid.
5. Review 390px, 768px, 1280px, and 1920px in the Codex in-app Browser,
   including loading, empty, error, disabled, and success states that apply.
6. Run the focused check, TypeScript, unit suite, production build, and full
   portal QA before starting the next family.

## Completion Definition

A route family is complete only when a non-technical school user can identify
where they are, what the page is for, and the next action in five seconds;
when it has no horizontal overflow at the required viewports; and when the
1,598/0 portal baseline remains clean.
