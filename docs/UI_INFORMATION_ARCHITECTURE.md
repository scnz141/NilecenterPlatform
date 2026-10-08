# Nile Learn UI Information Architecture

This document is the routing and page-purpose contract for Nile Learn internal portals. It works with `docs/SIMPLE_UI.md`: one page has one main job, and related work moves into sub-navigation or separate routes.

## Route Status

- **Current** means the route is registered in `client/src/App.tsx` now.
- **Target** means the route expresses approved information architecture but is
  not proof that implementation exists.
- A route family may contain both. Implement target routes only in a bounded
  master-plan slice; do not create empty navigation or placeholder routes.

## Page Types

### DashboardPage

Purpose: show what needs attention today.

Allowed:

- Page title and one short description.
- Three to four important metrics maximum.
- One primary work queue.
- One small upcoming or alerts panel.
- One primary action when the workflow supports one and the role is authorized.

Move away:

- Full audit logs.
- Full reports.
- Create forms.
- Settings forms.
- Permission matrices.
- Huge lists.
- Unrelated modules.

### ListPage

Purpose: find and manage records.

Allowed:

- Title and short subtitle.
- One create button when creation is supported and authorized.
- Search.
- Two to four filters.
- Table or list.
- Row actions.
- Empty state.

Move away:

- Detail editors.
- Always-visible create forms.
- Audit logs.
- Reports.
- Permission matrices.
- Unrelated stat walls.

### DetailPage

Purpose: understand and manage one record.

Allowed:

- Record header.
- Status.
- Important summary.
- Tabs for related sections.
- One primary action.
- Small recent activity section.

Move away:

- All tabs expanded at once.
- Unrelated reports.
- Full audit explorer.
- Create-new forms for other records.

### CreateFlowPage

Purpose: create one record.

Allowed:

- Step-by-step form.
- Basic information.
- Assignment or access scope.
- Review.
- Create action.

Move away:

- Tables.
- Audit logs.
- Dashboards.
- Unrelated side panels.

### SettingsPage

Purpose: manage configuration.

Allowed:

- Grouped settings.
- Save button.
- Simple explanation.

Move away:

- Operational queues.
- Full dashboards.
- Audit feeds unless the page has a dedicated Activity tab.

### ReportPage

Purpose: analyze information.

Allowed:

- Filters.
- Report cards or charts.
- Export.
- Table.

Move away:

- Create or edit operational forms.
- Mixed workflow actions.

## Navigation Rules

- Main sidebar shows top-level work areas only.
- Complex areas use page-level sub-navigation.
- Advanced and system items stay under System or Advanced groups.
- Do not expose every possible route directly in the sidebar.
- Use human names, not system names.

Preferred staff sidebar (unified staff app):

- Home: Dashboard, Notifications
- Admissions: Students, Leads, Enrolments, Placement tests, Trial lessons
- Teaching: Courses, Classes, Sessions, Rooms
- People and places: Staff, Branches, Departments
- Setup: Lost reasons, Action reasons, Areas of study, Custom fields
- System: Moodle, System health, Audit log

Portal sidebars should follow the same principle:

- Show top-level work areas only.
- Keep rare or secondary work inside page sub-navigation.
- Do not expose every create, activity, review, setting, and report route in the sidebar.
- Use the same page types for students, teachers, registrars, HODs, branch admins, and super admins.

Preferred role sidebar intent:

- Student: Dashboard, Courses, Assignments, Quizzes, Grades, Attendance, Calendar, Forms, Messages, Certificates, Reports, Support, Profile, Quran progress.
- Staff (all roles): the unified staff navigation in `client/src/staff/nav.ts`,
  grouped as Home, Admissions, Teaching, People and places, Setup, and System,
  filtered per role by `canAccess`.

## Sub-Navigation Rules

- Use sub-navigation when one top-level area has multiple jobs.
- Each sub-page must have one page type and one purpose.
- Sub-navigation labels should be nouns or short task names.
- The active sub-page must be obvious.
- Sub-navigation should not become a second sidebar of every route in the app.

## Content Placement Rules

### Staff

Status: Current. Staff accounts live in the unified staff app; the former
`/app/admin/users*` routes redirect here.

- `/app/staff`: ListPage for finding staff and opening detail.
- `/app/staff/:id`: DetailPage overview for one staff member.

Do not show the create flow, selected-user editor, access rules, branch access, and activity log on the list page.

### Schedule

Status: Current.

- `/app/sessions`: Session list and the signed-in staff member's week view.
- `/app/classes`: Class list and class detail.
- `/app/rooms`: Room list and room detail.

Do not combine schedule board, create form, conflict review, room metrics, audit, and boundary notes on one screen.

### Reports

Status: Removed for staff. The old per-portal report pages had no unified-app
equivalent and were removed with the old portals; `/app/student/reports`
remains for students.

### Roles And Access

Status: Removed. `/app/admin/roles` and `/app/admin/permissions` had no
unified-app equivalent and were removed with the old portals.

### Courses

Status: Current.

- `/app/courses`: Course catalog.
- `/app/courses/:id`: Course detail.

Do not show catalog, programs, levels, teachers, curriculum builder, lessons, and resources all on one page.

### Branches

Status: Current.

- `/app/branches`: Branch list.
- `/app/branches/:id`: Branch detail.
- `/app/departments`: Department list.

### System Workspaces

Status: Current for the listed routes. They are separate System pages, not one
technical control center.

- `/app/moodle`: Moodle connection status and reviewed readiness only.
  Protected credentials and provider configuration stay outside browser UI.
- `/app/system`: ReportPage for concise service-health review.
- `/app/audit`: ReportPage for searchable, exportable activity only.

Do not merge settings, connection status, health checks, activity, provider
configuration, or audit evidence into one page.

### Admissions

Status: Current.

- `/app/leads`: Lead intake and lead follow-up only.
- `/app/leads/:id`: Lead detail only.
- `/app/students`: Student records only.
- `/app/students/:id`: Student detail only.
- `/app/enrolments`: Enrolment handoff and activation only.
- `/app/placement-tests`: Placement booking and result recording only.
- `/app/trial-lessons`: Trial lesson booking only.

Do not show the full admissions pipeline, placement desk, enrolment handoff, payment ledger, student creation, and activity feed together on one page. Detail routes must not render list or create desks underneath the selected record.

### Nile Forms

Status: Current internal-alpha route ownership. Production persistence and
legacy cutover remain separately gated. Staff forms live in the unified staff
app; the old `/app/{staff-role}/forms/...` addresses redirect to it.

- `/app/student/forms`: assigned forms and response status only.
- `/app/student/forms/:publicationId`: one assigned form response flow only.
- `/app/student/forms/:publicationId/responses/:submissionId`: the respondent's
  own submitted response, review status, and permitted withdrawal only.
- `/app/forms`: staff scoped form definitions and submission queue only.
- `/app/forms/:formId`: one form definition: builder, publications, and
  assignments for one draft or published form only.
- `/app/forms/responses/:submissionId`: one submission, review decision,
  promotion state, and evidence timeline only.
- `/app/forms/fill/:publicationId`: one publication fill/preview flow only.
- `/app/forms/import`: one finite Jotform import job: source/target inspection,
  mapping, dry-run evidence, explicit commit, or run reconciliation.
- `/forms/:slug`: one public form response flow only.

Do not combine assigned forms, definition management, the builder, publication
settings, the inbox, exports, migration, and review detail on one page.

Future ADR-007 typed modules own separate route families. They must not be
embedded in Forms management, builder, or review:

- `/app/student/requests` and `/app/student/requests/:requestId` own the
  student request queue and one request record (`/requests/:requestId` is the
  route-family shape).
- `/app/{role}/approvals` and `/approvals/:approvalId` own the approval queue and
  one bounded approval decision.
- `/app/{role}/appointments`, `/appointments/services`, and
  `/appointments/:bookingId` own booking lists, service/schedule configuration,
  and one booking respectively.
- `/app/{role}/surveys/results` and `/surveys/results/:surveyId` own aggregate
  results and one privacy-filtered survey result.
- `/app/forms/:formId` may select one registered, versioned processing
  profile. Processing execution and case management never occur inside the
  builder.

### Student Moodle-Projected Assessments

Status: Moodle-authority boundary active.

- `/app/student/assignments` and `/app/student/quizzes` show exact Moodle
  projections and use authenticated Moodle launches for submissions and
  attempts. Nile Learn must not persist local learning outcomes from these
  pages.
- `/app/student/moodle-source` and `/app/student/moodle-source/:courseId`:
  verified Moodle course projections.

Nile Learn must not create local curriculum modules, assignments, quizzes,
grades, or feedback from these routes. Course runs, schedules, attendance,
certificates, and operational governance remain Nile-owned.

### Student Report Pages

- `/app/student/reports`: the student's report overview only.

### Student Schedule Page

- `/app/student/calendar`: calendar view only.

### Class Workspaces

Status: Target route family. The unified staff app currently exposes
`/app/classes` and `/app/classes/:id`; the nested workspace routes below remain
Target.

- `/app/classes`: class list only.
- `/app/classes/:id`: class overview only.
- `/app/classes/:classId/roster`: roster and membership only.
- `/app/classes/:classId/schedule`: recurring schedule only.
- `/app/classes/:classId/sessions`: delivered sessions only.
- `/app/classes/:classId/attendance`: attendance only.
- `/app/classes/:classId/grades`: grades and feedback only.
- `/app/classes/:classId/content`: linked learning content only.
- `/app/classes/:classId/activity`: class activity only.

Do not expand every class tab into one page. Teacher assignment, membership,
schedule, session, attendance, and content are distinct records and jobs.

## Unified Staff App

ADR-013 adds one unified staff application for NCC sessions under `/app/...`,
modeled on the NCC EMS frontend's interaction model. It is now the only staff
UI: the old `/app/admin`, `/app/registrar`, `/app/hod`, `/app/branch`, and
`/app/teacher` portals were removed, and every old staff address redirects
into the unified app through `legacyStaffTarget` in
`client/src/staff/legacy-redirects.ts`.

### Routes

- Overview: `/app/dashboard`, `/app/notifications`.
- Profile: `/app/profile`.
- Admissions: `/app/students`, `/app/students/:id`, `/app/leads`,
  `/app/leads/:id`, `/app/enrolments`, `/app/placement-tests`,
  `/app/trial-lessons`.
- Teaching: `/app/courses`, `/app/courses/:id`, `/app/classes`,
  `/app/classes/:id`, `/app/sessions`, `/app/rooms`, `/app/rooms/:id`.
- People and places: `/app/staff`, `/app/staff/:id`, `/app/branches`,
  `/app/branches/:id`, `/app/departments`.
- Setup: `/app/lost-reasons`, `/app/action-reasons`, `/app/areas-of-study`,
  `/app/custom-fields`.
- System: `/app/moodle`, `/app/system`, `/app/audit`.
- Nile Forms: `/app/forms`, `/app/forms/:formId`,
  `/app/forms/responses/:submissionId`, `/app/forms/fill/:publicationId`,
  `/app/forms/import`.

### Role visibility

`canAccess(path, activeRole)` gates every route. `/app/profile`,
`/app/dashboard`, and `/app/notifications` are open to all seven EMS roles.
Admissions items are visible to `super_admin`, `branch_admin`, `vice_manager`,
`registrar`, and `ssa`. Rooms add `hod`; classes also add `teacher`. Sessions
are teacher-only. Staff, audit, and the remaining organisation items are
`super_admin`, `branch_admin`, and `vice_manager`; departments and the
settings-style items are `super_admin` only. `branch_admin`, `vice_manager`,
`registrar`, and `ssa` must pick a workspace branch before operating;
management roles may open a role view restricted to strictly lower-privileged
roles.

## Label Rules

`docs/SIMPLE_UI.md` owns the user-facing terminology table. This document owns
only where a job lives. Do not duplicate or locally override those labels.

## Anti-Patterns

- One route with dashboard, reports, activity, forms, detail panels, and settings.
- Card walls with many equal-weight panels.
- Technical/debug data on normal school-management pages.
- Audit logs on every operational page.
- Create/edit forms permanently inside side panels.
- Full reports inside operational pages.
- Navigation that exposes every internal route at the same level.
- Generic generated layouts used for unrelated work.

## Removed Legacy Staff Portals

The `/app/admin`, `/app/registrar`, `/app/hod`, `/app/branch`, and
`/app/teacher` route families were removed together with their pages,
layouts, and role stylesheets. Old addresses keep working through five
catch-all redirect routes in `client/src/App.tsx` that call
`legacyStaffTarget(path)` in `client/src/staff/legacy-redirects.ts`:

- Forms review/manage/migration paths map to the unified `/app/forms` family
  and preserve Nile Forms IDs only.
- Profile, messages, staff, departments, rooms, audit, system health, Moodle,
  courses, students, leads, placement tests, enrolments, sessions, and classes
  map to the matching `/app/*` family.
- Every other old staff address falls back to `/app/dashboard`.
- Old demo-store record IDs are never carried into the new app except Nile
  Forms IDs, which share the same Forms service.

Do not restore per-role staff portals under the removed prefixes; new staff
work goes into the unified staff app.

Do not refactor every route at once. Finish one top-level area, review it visually, then continue route by route.
