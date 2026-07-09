# Nile Learn UI Information Architecture

This document is the routing and page-purpose contract for Nile Learn internal portals. It works with `docs/SIMPLE_UI.md`: one page has one main job, and related work moves into sub-navigation or separate routes.

## Page Types

### DashboardPage

Purpose: show what needs attention today.

Allowed:

- Page title and one short description.
- Three to four important metrics maximum.
- One primary work queue.
- One small upcoming or alerts panel.
- One primary action.

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
- One create button.
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
- Operations: Branches, Departments, Schedule
- Business: Payments, Reports
- System: Connections, Activity log, Settings

Portal sidebars should follow the same principle:

- Show top-level work areas only.
- Keep rare or secondary work inside page sub-navigation.
- Do not expose every create, activity, review, setting, and report route in the sidebar.
- Use the same page types for students, teachers, registrars, HODs, branch admins, and super admins.

Preferred role sidebar intent:

- Student: Dashboard, Courses, Assignments, Quizzes, Grades, Attendance, Calendar, Messages, Certificates, Reports, Support, Profile, Quran progress.
- Teacher: Dashboard, Classes, Assignments, Grading, Quizzes, Question bank, Calendar, Messages, Reports, Profile, Quran review.
- Registrar: Dashboard, Leads, Applications, Placement tests, Students, Enrollments, Classes, Schedule, Payments, Messages, Reports, Settings.
- HOD: Dashboard, Departments, Programs, Courses, Curriculum, Teachers, Classes, Assessments, Certificates, Reports, Messages.
- Branch admin: Dashboard, Students, Teachers, Classes, Rooms, Schedule, Attendance, Payments, Reports, Messages, Settings.

## Sub-Navigation Rules

- Use sub-navigation when one top-level area has multiple jobs.
- Each sub-page must have one page type and one purpose.
- Sub-navigation labels should be nouns or short task names.
- The active sub-page must be obvious.
- Sub-navigation should not become a second sidebar of every route in the app.

## Content Placement Rules

### Users

- `/app/admin/users`: ListPage for finding users and opening detail.
- `/app/admin/users/new`: CreateFlowPage for creating one staff account.
- `/app/admin/users/:userId`: DetailPage overview for one user.
- `/app/admin/users/:userId/access`: Access tab for role and branch access.
- `/app/admin/users/:userId/activity`: Activity tab for recent account changes.

Do not show the create flow, selected-user editor, access rules, branch access, and activity log on the list page.

### Schedule

- `/app/admin/schedule`: Calendar view only.
- `/app/admin/schedule/calendar`: Calendar view only.
- `/app/admin/schedule/sessions`: Session list and session management.
- `/app/admin/schedule/conflicts`: Conflicts and pending reviews.
- `/app/admin/schedule/rooms`: Room bookings and availability.
- `/app/admin/schedule/activity`: Schedule activity.

Do not combine schedule board, create form, conflict review, room metrics, audit, and boundary notes on one screen.

### Reports

- `/app/admin/reports`: Report area overview and high-level summary.
- `/app/admin/reports/attendance`: Attendance report only.
- `/app/admin/reports/finance`: Finance report only.
- `/app/admin/reports/certificates`: Certificate report only.
- `/app/admin/reports/admissions`: Admissions report only.
- `/app/admin/reports/classes`: Class report only.
- `/app/admin/reports/saved-views`: Saved report views only.

Do not combine attendance evidence, certificate health, finance presets, class stats, activity rows, and connections on one report page.

### Roles And Access

- `/app/admin/roles`: Role summaries first.
- `/app/admin/roles/access-rules`: Detailed access rules.
- `/app/admin/roles/branch-access`: Branch access.
- `/app/admin/roles/advanced`: Advanced access controls.

Do not show the full permission matrix by default.

### Courses

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

- `/app/admin/branches`: Branch list.
- `/app/admin/branches/rooms`: Rooms.
- `/app/admin/branches/staff`: Staff.
- `/app/admin/branches/schedule`: Branch schedule.
- `/app/admin/branches/activity`: Branch activity.

### Registrar Admissions

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

### Teacher Assessments

- `/app/teacher/quizzes`: ListPage for finding quiz items.
- `/app/teacher/quizzes/new`: CreateFlowPage for creating one quiz.
- `/app/teacher/quizzes/review`: ListPage/work queue for quiz attempts that need review.
- `/app/teacher/question-bank`: ListPage for reusable questions and attaching questions to a selected quiz.
- `/app/teacher/question-bank/new`: CreateFlowPage for creating one question.

Do not combine assignment queue, quiz list, quiz creation, question creation, question attachment, manual review, recent activity, and score metrics on one teacher assessment page.

### Role-Wide Report Pages

- `/app/{role}/reports`: Report overview or the role's primary report only.
- `/app/{role}/reports/attendance`: Attendance report only when the role owns attendance data.
- `/app/{role}/reports/finance`: Finance report only for registrar, branch admin, and super admin roles.
- `/app/{role}/reports/academic`: Academic progress and course outcomes only.
- `/app/{role}/reports/saved-views`: Saved report views only.

Do not place finance, attendance, academic, audit, and certificate report controls on one generic reports page.

### Role-Wide Schedule Pages

- `/app/{role}/schedule` or `/app/{role}/calendar`: Calendar view only.
- `/app/{role}/schedule/sessions`: Sessions only.
- `/app/{role}/schedule/conflicts`: Conflicts and pending reviews only.
- `/app/{role}/schedule/rooms`: Room availability only for branch and admin roles.
- `/app/{role}/schedule/activity`: Schedule activity only for admin roles.

Do not combine create schedule forms, conflict review, room status, audit, and schedule board on one page.

## Label Rules

Use these user-facing replacements:

| Avoid                 | Use              |
| --------------------- | ---------------- |
| RBAC                  | Roles and access |
| Permission Matrix     | Access rules     |
| Audit Trail           | Activity         |
| Audit Evidence        | Activity         |
| Integration Readiness | Connections      |
| Moodle Source         | Moodle           |
| Platform State        | System data      |
| Mock Mode             | Test mode        |
| Server-only           | Protected        |
| Local Records         | Records          |
| Governance View       | Admin view       |
| Branch Scope          | Branch access    |
| Permission Scope      | Access level     |

## Anti-Patterns

- One route with dashboard, reports, activity, forms, detail panels, and settings.
- Card walls with many equal-weight panels.
- Technical/debug data on normal school-management pages.
- Audit logs on every operational page.
- Create/edit forms permanently inside side panels.
- Full reports inside operational pages.
- Navigation that exposes every internal route at the same level.
- Generic generated layouts used for unrelated work.

## Phase 1 Scope

Implement the IA split first for:

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

Next implemented reference split:

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
