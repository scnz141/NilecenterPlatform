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

Preferred Super Admin sidebar:

- Dashboard
- People: Users, Roles and access
- Learning: Courses, Classes, Certificates
- Operations: Branches, Departments, Schedule, Forms
- Business: Payments, Reports
- System: Connections, Activity log, Settings

Portal sidebars should follow the same principle:

- Show top-level work areas only.
- Keep rare or secondary work inside page sub-navigation.
- Do not expose every create, activity, review, setting, and report route in the sidebar.
- Use the same page types for students, teachers, registrars, HODs, branch admins, and super admins.

Preferred role sidebar intent:

- Student: Dashboard, Courses, Assignments, Quizzes, Grades, Attendance, Calendar, Forms, Messages, Certificates, Reports, Support, Profile, Quran progress.
- Teacher: Dashboard, Classes, Assignments, Grading, Quizzes, Question bank, Calendar, Forms, Messages, Reports, Profile, Quran review.
- Registrar: Dashboard, Leads, Applications, Placement tests, Students, Enrollments, Classes, Schedule, Forms, Payments, Messages, Reports, Settings.
- HOD: Dashboard, Departments, Programs, Courses, Curriculum, Teachers, Classes, Assessments, Forms, Certificates, Reports, Messages.
- Branch admin: Dashboard, Students, Teachers, Classes, Rooms, Schedule, Attendance, Forms, Payments, Reports, Messages, Settings.

## Sub-Navigation Rules

- Use sub-navigation when one top-level area has multiple jobs.
- Each sub-page must have one page type and one purpose.
- Sub-navigation labels should be nouns or short task names.
- The active sub-page must be obvious.
- Sub-navigation should not become a second sidebar of every route in the app.

## Content Placement Rules

### Users

Status: Current.

- `/app/admin/users`: ListPage for finding users and opening detail.
- `/app/admin/users/new`: CreateFlowPage for creating one staff account.
- `/app/admin/users/:userId`: DetailPage overview for one user.
- `/app/admin/users/:userId/access`: Access tab for role and branch access.
- `/app/admin/users/:userId/activity`: Activity tab for recent account changes.

Do not show the create flow, selected-user editor, access rules, branch access, and activity log on the list page.

### Schedule

Status: Current for the listed admin routes.

- `/app/admin/schedule`: Calendar view only.
- `/app/admin/schedule/calendar`: Calendar view only.
- `/app/admin/schedule/sessions`: Session list and session management.
- `/app/admin/schedule/conflicts`: Conflicts and pending reviews.
- `/app/admin/schedule/rooms`: Room bookings and availability.
- `/app/admin/schedule/activity`: Schedule activity.

Do not combine schedule board, create form, conflict review, room metrics, audit, and boundary notes on one screen.

### Reports

Status: Current for the listed admin routes.

- `/app/admin/reports`: Report area overview and high-level summary.
- `/app/admin/reports/attendance`: Attendance report only.
- `/app/admin/reports/finance`: Finance report only.
- `/app/admin/reports/certificates`: Certificate report only.
- `/app/admin/reports/admissions`: Admissions report only.
- `/app/admin/reports/classes`: Class report only.
- `/app/admin/reports/saved-views`: Saved report views only.

Do not combine attendance evidence, certificate health, finance presets, class stats, activity rows, and connections on one report page.

### Roles And Access

- `/app/admin/roles`: Current role overview and summaries.
- `/app/admin/permissions`: Current access-rule editing.
- `/app/admin/branches`: Current branch management and branch status.
- Role-specific access detail routes are Target only when a workflow cannot be
  kept clear on these three owners.

Do not show the full permission matrix by default.

### Courses

Status: Current for catalog, programs, levels, curriculum, teachers, resources,
and course detail. Nested course-detail routes below are Target.

- `/app/admin/courses`: Course catalog.
- `/app/admin/courses/programs`: Programs.
- `/app/admin/courses/levels`: Levels.
- `/app/admin/courses/curriculum`: Curriculum overview.
- `/app/admin/courses/teachers`: Teaching assignment overview.
- `/app/admin/courses/resources`: Lesson resources overview.
- `/app/admin/courses/:courseId`: Course detail.
- `/app/admin/courses/:courseId/curriculum`: Curriculum builder.
- `/app/admin/courses/:courseId/teachers`: Teaching assignment.
- `/app/admin/courses/:courseId/resources`: Resources.

Do not show catalog, programs, levels, teachers, curriculum builder, lessons, and resources all on one page.

### Branches

Status: Current for `/app/admin/branches`; nested routes are Target.

- `/app/admin/branches`: Branch list.
- `/app/admin/branches/rooms`: Rooms.
- `/app/admin/branches/staff`: Staff.
- `/app/admin/branches/schedule`: Branch schedule.
- `/app/admin/branches/activity`: Branch activity.

### System Workspaces

Status: Current for the listed routes. They are separate System pages, not one
technical control center.

- `/app/admin/settings`: SettingsPage for global school setup only.
- `/app/admin/integrations`: SettingsPage for connection readiness and reviewed
  connection status only. Protected credentials and provider configuration stay
  outside browser UI.
- `/app/admin/system-health`: ReportPage for concise service-health review and
  the existing health-check action only.
- `/app/admin/audit-logs`: ReportPage for searchable, exportable activity only.

Do not merge settings, connection status, health checks, activity, provider
configuration, or audit evidence into one page.

### Registrar Admissions

Status: Current for the listed routes.

- `/app/registrar/leads`: Lead intake and lead follow-up only.
- `/app/registrar/applications`: Application intake and application files only.
- `/app/registrar/placement-tests`: Placement booking and result recording only.
- `/app/registrar/students`: Student records and direct student creation only.
- `/app/registrar/enrollments`: Enrollment handoff and activation only.
- `/app/registrar/classes`: Class assignment overview only.
- `/app/registrar/payments`: Payment ledger and receipt recording only.
- `/app/registrar/messages`: Admissions follow-up messages only.
- `/app/registrar/reports`: Registrar reports and activity only.
- `/app/registrar/settings`: Admissions configuration only.
- `/app/registrar/leads/:leadId`: Lead detail only.
- `/app/registrar/applications/:applicationId`: Application detail only.
- `/app/registrar/students/:studentId`: Student detail only.
- `/app/registrar/placement-tests/:bookingId`: Placement detail only.

Do not show the full admissions pipeline, placement desk, enrollment handoff, payment ledger, student creation, and activity feed together on registrar pages. Detail routes must not render list or create desks underneath the selected record.

### Nile Forms

Status: Current internal-alpha route ownership. Production persistence and
legacy cutover remain separately gated.

- `/app/{role}/forms`: assigned forms and response status only.
- `/app/{role}/forms/:publicationId`: one assigned form response flow only.
- `/app/{role}/forms/:publicationId/responses/:submissionId`: the respondent's
  own submitted response, review status, and permitted withdrawal only.
- `/app/{role}/forms/manage`: scoped form definitions only.
- `/app/{role}/forms/manage/new`: create one scoped form definition only.
- `/app/{role}/forms/manage/:formId/builder`: one draft version only.
- `/app/{role}/forms/manage/:formId/publish`: preview and publication settings only.
- `/app/{role}/forms/manage/:formId/publications`: publication history and
  retirement only.
- `/app/{role}/forms/manage/:formId/publications/:publicationId/assignments`:
  assignment targets for one active assigned publication only.
- `/app/{role}/forms/review`: scoped submission queue only.
- `/app/{role}/forms/review/:submissionId`: one submission, review decision,
  promotion state, and evidence timeline only.
- `/app/{staff-role}/forms/offline`: one enrolled device, downloaded forms,
  encrypted capture, and foreground sync queue only.
- `/app/admin/forms/migration`: one finite Jotform import job: source/target
  inspection, mapping, dry-run evidence, explicit commit, or run reconciliation.
- `/forms/:slug`: one public form response flow only.

The top-level Forms item opens assigned work. Staff page sub-navigation exposes
Offline, Manage, and Review according to server permissions; Super Admin also
receives Migration. Do not combine assigned
forms, definition management, the builder, publication settings, the inbox,
exports, migration, and review detail on one page.

Future ADR-007 typed modules own separate route families. They must not be
embedded in Forms Manage, Builder, Publish, or Review:

- `/app/{role}/requests`, `/requests/new`, and `/requests/:requestId` own the
  request queue, creation, and one request record respectively.
- `/app/{role}/approvals` and `/approvals/:approvalId` own the approval queue and
  one bounded approval decision.
- `/app/{role}/appointments`, `/appointments/services`, and
  `/appointments/:bookingId` own booking lists, service/schedule configuration,
  and one booking respectively.
- `/app/{role}/surveys/results` and `/surveys/results/:surveyId` own aggregate
  results and one privacy-filtered survey result.
- `/app/{role}/forms/manage/:formId/processing` may select one registered,
  versioned processing profile. Processing execution and case management never
  occur inside the builder.

### Teacher Assessments

Status: Transitional. Route jobs remain separate, but Moodle owns every
learning record under ADR-010.

- `/app/teacher/quizzes`: ListPage for projected quizzes in assigned Moodle
  delivery courses.
- `/app/teacher/quizzes/new`: supported simple Moodle command flow or an
  authenticated Moodle authoring launch; never a local quiz create.
- `/app/teacher/quizzes/review`: projected attempt queue with an authorized
  Moodle review launch.
- `/app/teacher/question-bank`: projected question-bank directory for assigned
  course contexts.
- `/app/teacher/question-bank/new`: supported Moodle command flow or native
  Moodle editor launch; never a local question create.

Student assignment and quiz routes likewise show exact Moodle projections and
use authenticated Moodle launches for submissions and attempts. Nile Learn
must not persist local learning outcomes from these pages.

Do not combine assignment queue, quiz list, quiz creation, question creation, question attachment, manual review, recent activity, and score metrics on one teacher assessment page.

### Role-Wide Report Pages

Status: Pattern. A concrete route is Current only when registered in
`client/src/App.tsx`.

- `/app/{role}/reports`: Report overview or the role's primary report only.
- `/app/{role}/reports/attendance`: Attendance report only when the role owns attendance data.
- `/app/{role}/reports/finance`: Finance report only for registrar, branch admin, and super admin roles.
- `/app/{role}/reports/academic`: Academic progress and course outcomes only.
- `/app/{role}/reports/saved-views`: Saved report views only.

Do not place finance, attendance, academic, audit, and certificate report controls on one generic reports page.

### Role-Wide Schedule Pages

Status: Pattern. A concrete route is Current only when registered in
`client/src/App.tsx`.

- `/app/{role}/schedule` or `/app/{role}/calendar`: Calendar view only.
- `/app/{role}/schedule/sessions`: Sessions only.
- `/app/{role}/schedule/conflicts`: Conflicts and pending reviews only.
- `/app/{role}/schedule/rooms`: Room availability only for branch and admin roles.
- `/app/{role}/schedule/activity`: Schedule activity only for admin roles.

Do not combine create schedule forms, conflict review, room status, audit, and schedule board on one page.

### Class Workspaces

Status: Target route family. Existing teacher class routes remain Current until
the bounded class-workspace migration is implemented.

- `/app/{role}/classes`: class list only.
- `/app/{role}/classes/:classId`: class overview only.
- `/app/{role}/classes/:classId/roster`: roster and membership only.
- `/app/{role}/classes/:classId/schedule`: recurring schedule only.
- `/app/{role}/classes/:classId/sessions`: delivered sessions only.
- `/app/{role}/classes/:classId/attendance`: attendance only.
- `/app/{role}/classes/:classId/grades`: grades and feedback only.
- `/app/{role}/classes/:classId/content`: linked learning content only.
- `/app/{role}/classes/:classId/activity`: class activity only.

Do not expand every class tab into one page. Teacher assignment, membership,
schedule, session, attendance, and content are distinct records and jobs.

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

## Protected Reference Route Inventory

The following splits are current and form the reference architecture. Preserve
them while migrating other route families.

The protected reference split includes:

- `/app/admin/users`
- `/app/admin/users/new`
- `/app/admin/users/:userId`
- `/app/admin/schedule`
- `/app/admin/schedule/sessions`
- `/app/admin/schedule/conflicts`
- `/app/admin/schedule/rooms`
- `/app/admin/schedule/activity`
- `/app/admin/reports`
- `/app/admin/reports/attendance`

Additional Current reference splits:

- `/app/teacher/quizzes`
- `/app/teacher/quizzes/new`
- `/app/teacher/quizzes/review`
- `/app/teacher/question-bank`
- `/app/teacher/question-bank/new`
- `/app/admin/courses`
- `/app/admin/courses/programs`
- `/app/admin/courses/levels`
- `/app/admin/courses/curriculum`
- `/app/admin/courses/teachers`
- `/app/admin/courses/resources`
- `/app/registrar/leads`
- `/app/registrar/applications`
- `/app/registrar/placement-tests`
- `/app/registrar/students`
- `/app/registrar/enrollments`
- `/app/registrar/classes`
- `/app/registrar/payments`
- `/app/registrar/messages`
- `/app/registrar/reports`
- `/app/registrar/settings`
- `/app/registrar/leads/:leadId`
- `/app/registrar/applications/:applicationId`
- `/app/registrar/students/:studentId`
- `/app/registrar/placement-tests/:bookingId`

Do not refactor every route at once. Finish one top-level area, review it visually, then continue route by route.
