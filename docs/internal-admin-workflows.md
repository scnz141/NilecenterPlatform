# Nile Learn Internal Administration Workflows

## Purpose

This document maps the internal administration architecture for Nile Learn before more feature work is added. It is based on the current code, not chat history.

The platform is in internal alpha stabilization. The current implementation has broad route coverage, domain models, workflow actions, server-side action gates, demo seed data, and portal QA coverage. It does not yet have production-grade external integrations, durable normalized persistence as the only authority, or production media/payment/provider flows.

## Sources Read

- `client/src/lib/domain/types.ts`
- `client/src/lib/domain/actions.ts`
- `client/src/lib/domain/store.ts`
- `client/src/lib/domain/seed.ts`
- `server/auth.ts`
- `server/routes.ts`
- `server/platformState.ts`
- `client/src/App.tsx`
- `CLAUDE.md`
- `AGENTS.md`
- `DESIGN.md`
- `.codex/prompts/00-discovery.md`

## Status Legend

- Implemented: exists in domain types, seed data, routes, actions, server gates, and UI route coverage.
- Partial: exists but is not yet production complete, usually because it uses demo/local state, simplified validation, or incomplete operational depth.
- Placeholder: visible configuration/status UI or mocked data without live external behavior.
- Future integration: intentionally not built yet.

## Architecture Summary

### Client Route Layer

`client/src/App.tsx` defines the protected route map for the public site, auth, dashboards, and all role portals.

Protected app routes pass through role-aware routing and use these major surfaces:

- `RoleDashboard` for role dashboards.
- Dedicated route-owner pages for Simple UI list, detail, report, settings, profile, assessment, schedule, admissions, and operations routes.
- `WorkflowExperiences` for stateful workflow experiences.
- `PlatformBlueprintPage` for the super admin platform blueprint.

### Domain State Layer

`client/src/lib/domain/types.ts` defines the current internal domain model. The central `PlatformState` includes:

- identity and RBAC: `users`, `staffProfiles`, `permissions`
- organization: `branches`, `departments`, `programs`
- academics: `courses`, `levels`, `modules`, `lessons`, `resources`, `courseRuns`, `classGroups`
- learning operations: `students`, `teachers`, `enrollments`, `lessonProgress`
- assessment: `assignments`, `assignmentSubmissions`, `quizzes`, `questionBankItems`, `quizAttempts`, `grades`
- schedule and attendance: `events`, `classSessions`, `teacherAvailability`, `rooms`, `meetingLinks`, `attendance`
- admissions and EMS: `leads`, `applications`, `placementTests`, `placementResults`, `enrollmentWorkflows`
- finance: `invoices`, `payments`, `packages`, `discounts`
- certificates: `certificates`
- Quran: `quranPlans`, `quranProgress`, `recitationSubmissions`
- communication and evidence: `messages`, `communicationLogs`, `documents`, `notifications`, `supportTickets`, `auditLogs`, `reportPresets`
- platform configuration: `integrations`, `settings`

### Workflow Action Layer

`client/src/lib/domain/actions.ts` defines `PlatformWorkflowAction` and `applyWorkflowMutation`. Every meaningful internal workflow should eventually become one of these typed actions or a new typed action with server-side validation.

Current action families include:

- student learning: `lesson.start`, `lesson.complete`, `assignment.submit`, `quiz.submit`
- admissions: `lead.create`, `application.create`, `placement.create`, `placement.result.record`, `lead.convert`, `application.convert`
- student lifecycle: `student.create`, `student.status.update`, `enrollment.activate`
- staff and access: `staff.user.create`, `user.create`, `user.update`, `permission.update`
- academics: `teacher.assign`, `curriculum.module.create`, `course.status.update`, `material.publish.update`
- assessment: `assignment.create`, `quiz.create`, `question.create`, `quiz.questions.set`, `assignment.grade`, `quiz.review`
- operations: `attendance.save`, `calendar.create`, `room.create`, `room.status.update`, `payment.record`
- certificates: `certificate.approve`, `certificate.issue`, `certificate.reject`
- Quran: `quran.progress.update`, `recitation.submit`, `recitation.review`
- communication and reporting: `message.send`, `notification.read`, `report.preset.save`
- platform administration: `branch.update`, `integration.status.update`, `integration.local_check`, `system.health_check`, `settings.save`

Every action mutation appends an audit log through the domain mutation path.

### Client Store Layer

`client/src/lib/domain/store.ts` provides a client-side store around `PlatformState`.

Current behavior:

- It seeds from `client/src/lib/domain/seed.ts`.
- It stores local demo state in `localStorage` under `nilelearn.platform.state.v1`.
- It calls the server action endpoint through `runPlatformWorkflowActionRequest`.
- If the server returns a scoped state, the client updates its local state to the server response.

Important boundary:

- Client `localStorage` is a demo UX cache and must not be treated as production authority.
- Server-side action gates in `server/platformState.ts` are the authority for protected mutations.

### Server Auth Layer

`server/auth.ts` defines server roles, demo users, Supabase sign-in fallback behavior, and an HttpOnly cookie session.

Current behavior:

- Roles: `student`, `teacher`, `registrar`, `headofdepartment`, `branchadmin`, `superadmin`.
- Demo accounts are available for local/internal testing.
- Supabase sign-in is attempted when configured.
- Sessions are stored in an in-memory map with a 12 hour TTL.
- The session contains `userId`, `email`, `name`, `roles`, `activeRole`, `provider`, and `expiresAt`.

Production gap:

- Session storage is not durable across server restarts.
- Supabase/RLS and normalized database authority still need a complete production design.

### Server API Layer

`server/routes.ts` exposes the internal API surface:

- `POST /api/auth/login`
- `GET /api/auth/session`
- `POST /api/auth/logout`
- `GET /api/platform/state`
- `POST /api/platform/state/actions`
- `GET /api/platform/records`
- `POST /api/platform/records`
- `GET /api/certificates/verify`
- `GET /api/integrations/supabase/status`

All non-GET `/api` calls require the first-party `X-Nile-Learn-Request: browser` header.

### Server State And RBAC Layer

`server/platformState.ts` is the central server-side mutation and scoping boundary.

It handles:

- loading the platform snapshot
- parsing workflow actions
- injecting the authenticated actor into actions
- verifying role permissions with `roleCanRunAction`
- enforcing ownership and branch/department scope in `assertScopedAction`
- applying domain mutations
- persisting state
- scoping the returned state for the active session role
- writing optional Supabase event rows when configured

This file is the current internal authority for role-based workflow safety.

## Role Map

### Student

Who creates the account:

- Registrar creates students through direct student creation, lead conversion, application conversion, or placement-test conversion.
- Super admin can also create/manage students globally where routes and actions expose it.
- Seed data provides demo students.

Required fields:

- full name
- email
- phone or WhatsApp
- branch
- preferred language
- course interest
- age group
- course run
- class/group
- status

Optional fields:

- guardian name
- guardian phone
- current level
- placement result
- notes
- source
- lead/application/placement references
- country and timezone where available

Branch/department scope:

- A student belongs to a branch through the linked user.
- Learning visibility is based on student enrollments and assigned class groups.
- Department is inferred through course, program, course run, or teacher relationships rather than a direct student department field.

Permissions and actions:

- `lesson.start`
- `lesson.complete`
- `assignment.submit`
- `quiz.submit`
- `recitation.submit`
- `message.send`
- `notification.read`
- `report.preset.save` for allowed student report types

Routes available:

- `/app/student/dashboard`
- `/app/student/courses`
- `/app/student/courses/:courseId`
- `/app/student/courses/:courseId/learn/:lessonId`
- `/app/student/courses/:courseId/live`
- `/app/student/moodle-source`
- `/app/student/assignments`
- `/app/student/assignments/:assignmentId`
- `/app/student/quizzes`
- `/app/student/quizzes/:quizId`
- `/app/student/grades`
- `/app/student/attendance`
- `/app/student/calendar`
- `/app/student/messages`
- `/app/student/certificates`
- `/app/student/reports`
- `/app/student/support`
- `/app/student/profile`
- `/app/student/quran-progress`

Audit logs generated:

- `lesson.started`
- `lesson.completed`
- `assignment.submit`
- `quiz.submit`
- `recitation.submitted`
- `message.sent`
- `notification.read`
- `report.preset.saved`

Current status:

- Implemented: route coverage, enrollment-scoped state, lessons, assignments, quizzes, attendance review, certificates, Quran progress, messages, reports.
- Partial: production identity, durable persistence, media/file submissions, and live notification delivery.
- Placeholder: external Moodle/source sync and media storage.
- Future integration: production LMS sync, file/media storage, live meeting provider, external notifications.

### Teacher

Who creates the account:

- Super admin creates staff users through `staff.user.create`.
- Super admin can assign teachers to course runs with `teacher.assign`.
- Seed data provides demo teachers.

Required fields:

- full name
- email
- role `teacher`
- branch
- department
- subjects
- teaching levels
- availability status
- status

Optional fields:

- phone
- specialties
- availability details
- notes
- operational title

Branch/department scope:

- Teacher scope is based on assigned course runs and class groups.
- The teacher profile also stores branch, department, subjects, teaching levels, availability, assigned classes, and status.

Permissions and actions:

- `assignment.create`
- `quiz.create`
- `question.create`
- `quiz.questions.set`
- `assignment.grade`
- `quiz.review`
- `attendance.save`
- `calendar.create`
- `material.publish.update`
- `message.send`
- `quran.progress.update`
- `recitation.review`
- `notification.read`
- `report.preset.save` for allowed teacher report types

Routes available:

- `/app/teacher/dashboard`
- `/app/teacher/classes`
- `/app/teacher/classes/:classId`
- `/app/teacher/classes/:classId/sessions`
- `/app/teacher/classes/:classId/attendance`
- `/app/teacher/classes/:classId/students`
- `/app/teacher/classes/:classId/materials`
- `/app/teacher/moodle-source`
- `/app/teacher/assignments`
- `/app/teacher/assignments/:assignmentId`
- `/app/teacher/grading`
- `/app/teacher/quizzes`
- `/app/teacher/question-bank`
- `/app/teacher/calendar`
- `/app/teacher/messages`
- `/app/teacher/reports`
- `/app/teacher/profile`
- `/app/teacher/quran-review`

Audit logs generated:

- `assignment.created`
- `quiz.created`
- `question.created`
- `quiz.questions.updated`
- `assignment.graded`
- `quiz.reviewed`
- `attendance.saved`
- `calendar.created`
- `calendar.created_with_conflict`
- `material.publish_updated`
- `message.sent`
- `quran.progress_updated`
- `recitation.reviewed`
- `notification.read`
- `report.preset.saved`

Current status:

- Implemented: teacher class scoping, assigned students, attendance save, grading, quiz review, material publish state, Quran review, reports.
- Partial: teacher availability and scheduling depth, classroom materials/files, detailed performance analytics.
- Placeholder: external meeting links and media storage.
- Future integration: live meeting provider, LMS sync, file/audio/video storage, notification delivery.

### Registrar

Who creates the account:

- Super admin creates staff users through `staff.user.create`.
- Seed data provides a demo registrar.

Required fields:

- full name
- email
- role `registrar`
- branch
- permission scope, usually `admissions`
- status

Optional fields:

- phone
- operational scope
- notes
- title

Branch/department scope:

- Registrar operates inside assigned admissions branch scope.
- Branch scope is derived from the linked user branch and department branch IDs.

Permissions and actions:

- `lead.create`
- `application.create`
- `placement.create`
- `placement.result.record`
- `lead.convert`
- `application.convert`
- `student.create`
- `student.status.update`
- `enrollment.activate`
- `payment.record`
- `calendar.create`
- `message.send`
- `record.save`
- `notification.read`
- `report.preset.save` for allowed registrar report types

Routes available:

- `/app/registrar/dashboard`
- `/app/registrar/leads`
- `/app/registrar/leads/:leadId`
- `/app/registrar/applications`
- `/app/registrar/applications/:applicationId`
- `/app/registrar/students`
- `/app/registrar/students/:studentId`
- `/app/registrar/placement-tests`
- `/app/registrar/placement-tests/:placementId`
- `/app/registrar/enrollments`
- `/app/registrar/classes`
- `/app/registrar/schedule`
- `/app/registrar/payments`
- `/app/registrar/messages`
- `/app/registrar/reports`
- `/app/registrar/settings`

Audit logs generated:

- `lead.created`
- `application.created`
- `placement.created`
- `placement.result_recorded`
- `lead.converted`
- `application.converted`
- `student.created`
- `student.status_updated`
- `enrollment.activated`
- `payment.recorded`
- `calendar.created`
- `calendar.created_with_conflict`
- `message.sent`
- `record.saved`
- `notification.read`
- `report.preset.saved`

Current status:

- Implemented: admissions records, placement booking/result, lead/application conversion, student creation, enrollment activation, internal payment records, branch-scoped action gates.
- Partial: payment lifecycle depth, communication log delivery, complete registrar settings.
- Placeholder: external EMS sync, external payment gateway, external email/SMS/WhatsApp.
- Future integration: EMS import/export, payment provider, message delivery provider.

### Head Of Department

Who creates the account:

- Super admin creates staff users through `staff.user.create`.
- Seed data provides a demo HOD.

Required fields:

- full name
- email
- role `headofdepartment`
- department
- branch scope where applicable
- permission scope, usually `department`
- status

Optional fields:

- phone
- teaching levels
- subjects
- notes
- title

Branch/department scope:

- HOD scope is department-first.
- HOD actions are limited to courses, certificates, assessment records, Quran records, and students connected to their department.

Permissions and actions:

- `assignment.create`
- `assignment.grade`
- `quiz.create`
- `question.create`
- `quiz.questions.set`
- `quiz.review`
- `certificate.approve`
- `certificate.issue`
- `certificate.reject`
- `curriculum.module.create`
- `course.status.update`
- `message.send`
- `quran.progress.update`
- `recitation.review`
- `record.save`
- `notification.read`
- `report.preset.save` for allowed HOD report types

Routes available:

- `/app/hod/dashboard`
- `/app/hod/departments`
- `/app/hod/programs`
- `/app/hod/courses`
- `/app/hod/moodle-source`
- `/app/hod/levels`
- `/app/hod/curriculum`
- `/app/hod/teachers`
- `/app/hod/classes`
- `/app/hod/schedule`
- `/app/hod/assessments`
- `/app/hod/certificates`
- `/app/hod/reports`
- `/app/hod/messages`

Audit logs generated:

- `assignment.created`
- `assignment.graded`
- `quiz.created`
- `question.created`
- `quiz.questions.updated`
- `quiz.reviewed`
- `certificate.approved`
- `certificate.issued`
- `certificate.rejected`
- `curriculum.module_created`
- `course.status_updated`
- `message.sent`
- `quran.progress_updated`
- `recitation.reviewed`
- `record.saved`
- `notification.read`
- `report.preset.saved`

Current status:

- Implemented: department academic routes, curriculum module creation, course status update, assessment oversight, certificate approval/reject/issue, department-scoped action gates.
- Partial: curriculum publishing depth, teacher performance detail, academic reports depth.
- Placeholder: Moodle source mapping and external content sync.
- Future integration: LMS curriculum sync, full academic analytics, certificate document generation/storage.

### Branch Admin

Who creates the account:

- Super admin creates staff users through `staff.user.create`.
- Seed data provides a demo branch admin.

Required fields:

- full name
- email
- role `branchadmin`
- branch
- permission scope, usually `operations`
- operational scope
- status

Optional fields:

- phone
- notes
- title

Branch/department scope:

- Branch admin sees and acts only inside their assigned branch.
- Server action gates restrict room, schedule, attendance, and payment operations to branch scope.

Permissions and actions:

- `attendance.save`
- `calendar.create`
- `message.send`
- `payment.record`
- `record.save`
- `room.create`
- `room.status.update`
- `notification.read`
- `report.preset.save` for allowed branch admin report types

Routes available:

- `/app/branch/dashboard`
- `/app/branch/students`
- `/app/branch/teachers`
- `/app/branch/classes`
- `/app/branch/rooms`
- `/app/branch/schedule`
- `/app/branch/attendance`
- `/app/branch/payments`
- `/app/branch/reports`
- `/app/branch/messages`
- `/app/branch/settings`

Audit logs generated:

- `attendance.saved`
- `calendar.created`
- `calendar.created_with_conflict`
- `message.sent`
- `payment.recorded`
- `record.saved`
- `room.created`
- `room.status_updated`
- `notification.read`
- `report.preset.saved`

Current status:

- Implemented: branch route coverage, room creation/status, branch-scoped schedule, attendance, payments, reports, messages.
- Partial: schedule conflict depth, room utilization reporting, branch staff management depth.
- Placeholder: external payment reconciliation and external notifications.
- Future integration: production scheduler/jobs, payment provider, branch-level notification delivery.

### Super Admin

Who creates the account:

- Existing super admin seed/demo account.
- Super admin can create another super admin through `staff.user.create`.

Required fields:

- full name
- email
- role `superadmin`
- global permission scope
- status

Optional fields:

- phone
- branch or department link for display/context
- operational notes
- title

Branch/department scope:

- Global scope.
- Can view and manage internal data across branches, departments, users, settings, and audits.

Permissions and actions:

- `staff.user.create`
- `application.create`
- `student.create`
- `student.status.update`
- `application.convert`
- `user.create`
- `user.update`
- `permission.update`
- `branch.update`
- `integration.status.update`
- `integration.local_check`
- `system.health_check`
- `settings.save`
- `teacher.assign`
- `course.status.update`
- `room.create`
- `room.status.update`
- `message.send`
- `record.save`
- `notification.read`
- `report.preset.save` for allowed super admin report types

Routes available:

- `/app/admin/dashboard`
- `/app/admin/platform-blueprint`
- `/app/admin/users`
- `/app/admin/users/:userId`
- `/app/admin/roles`
- `/app/admin/permissions`
- `/app/admin/branches`
- `/app/admin/departments`
- `/app/admin/programs`
- `/app/admin/courses`
- `/app/admin/certificates`
- `/app/admin/schedule`
- `/app/admin/moodle-source`
- `/app/admin/settings`
- `/app/admin/integrations`
- `/app/admin/audit-logs`
- `/app/admin/reports`
- `/app/admin/system-health`

Audit logs generated:

- `staff.user.created`
- `application.created`
- `student.created`
- `student.status_updated`
- `application.converted`
- `user.created`
- `user.updated`
- `permission.updated`
- `branch.updated`
- `integration.status_updated`
- `integration.local_checked`
- `system.health_checked`
- `settings.saved`
- `teacher.assigned`
- `course.status_updated`
- `room.created`
- `room.status_updated`
- `message.sent`
- `record.saved`
- `notification.read`
- `report.preset.saved`

Current status:

- Implemented: global route coverage, users, roles, permissions, branches, departments, programs/courses overview, certificates, schedule, integrations/status, audit logs, reports, system health, settings.
- Partial: durable production admin persistence, advanced audit filtering/export, full role lifecycle edge cases.
- Placeholder: integration credential/status screens where external services are intentionally not live.
- Future integration: external provider connection management, production secrets workflow, durable audit retention policy.

## Student Lifecycle

Target flow:

1. Lead or application starts the record.
2. Registrar books placement when needed.
3. Placement result maps the student to a recommended level.
4. Registrar creates or converts to a student profile.
5. Registrar creates an enrollment workflow.
6. Registrar activates the enrollment.
7. Enrollment connects student, course run, level, class/group, and teacher.
8. Student portal shows only assigned courses, classes, sessions, assignments, quizzes, attendance, grades, certificates, messages, and Quran records.

Current implementation:

- `lead.create` creates a lead.
- `application.create` creates an application.
- `placement.create` creates a placement booking.
- `placement.result.record` records recommended level and score.
- `lead.convert` and `application.convert` create enrollment workflow records.
- `student.create` creates a user, student profile, enrollment, invoice, and class group membership.
- `enrollment.activate` activates a workflow into enrollment/class assignment.
- Student state is scoped by enrollment and class group in `scopePlatformStateForSession`.

Gaps:

- Placement-to-level mapping is present as fields and workflow behavior but needs production rules per program/course.
- Payment gating before activation is internal/demo only.
- External EMS, payment, email, and WhatsApp are not connected.

## Teacher Lifecycle

Target flow:

1. Super admin creates teacher account.
2. Teacher receives department, branch, subjects, teaching levels, and availability status.
3. Teacher is assigned to course runs and class groups.
4. Teacher portal shows only assigned classes and students.
5. Teacher marks attendance for class sessions.
6. Teacher creates/grades assignments and quizzes for assigned course runs.
7. Teacher reviews Quran progress and recitations where assigned.
8. Teacher sends feedback/messages to scoped students.

Current implementation:

- `staff.user.create` creates teacher staff accounts and teacher profiles.
- `teacher.assign` connects a teacher to a course run.
- Teacher state scoping includes assigned course runs, class groups, students, rooms, attendance, assignments, quizzes, submissions, grades, messages, reports, and audit evidence.
- Server action gates prevent teachers from grading, reviewing, scheduling, or marking attendance outside assigned classes.

Gaps:

- Detailed availability scheduling is still basic.
- Material/file publishing does not have production storage.
- Live class links are placeholders.

## Registrar Lifecycle

Target flow:

1. Registrar captures leads.
2. Registrar creates or reviews applications.
3. Registrar books placement tests.
4. Registrar records placement results.
5. Registrar converts lead/application to a student workflow.
6. Registrar creates or activates student enrollment.
7. Registrar records internal invoice/payment events.
8. Registrar assigns student to course/class.
9. Registrar monitors pipeline, schedule, payment, and admission reports.

Current implementation:

- All above core actions exist as typed workflow actions except external communication delivery.
- Registrar action gates enforce branch/admissions scope.
- Registrar routes cover leads, applications, placement tests, students, enrollments, classes, schedule, payments, messages, reports, and settings.

Gaps:

- Communication logs are internal placeholders, not external sent messages.
- Payment records are internal only.
- Registrar settings need production-level policies and provider boundaries.

## HOD Lifecycle

Target flow:

1. HOD owns department academic oversight.
2. HOD reviews programs, courses, levels, curriculum, and Moodle/source mapping.
3. HOD monitors teachers, classes, assessment completion, and at-risk students.
4. HOD creates curriculum modules or course status changes where allowed.
5. HOD reviews assignments/quizzes and academic outcomes.
6. HOD approves, rejects, or issues certificates.
7. HOD reviews academic reports and audit evidence.

Current implementation:

- HOD routes cover department, programs, courses, levels, curriculum, teachers, classes, schedule, assessments, certificates, reports, and messages.
- HOD actions are department/course scoped in server gates.
- Certificate approval/rejection/issue is implemented as domain actions with audit logs.

Gaps:

- Curriculum coverage and teacher oversight metrics need deeper production definitions.
- Moodle/source mapping remains a placeholder/status workflow.
- Certificate document generation and storage are not production-integrated.

## Branch Admin Lifecycle

Target flow:

1. Branch admin manages local branch operations.
2. Branch admin views branch students, teachers, classes, rooms, and schedule.
3. Branch admin creates or updates rooms.
4. Branch admin manages schedule and room bookings.
5. Branch admin monitors attendance exceptions.
6. Branch admin reviews branch payments and reports.
7. Branch admin communicates within branch scope.

Current implementation:

- Branch routes cover dashboard, students, teachers, classes, rooms, schedule, attendance, payments, reports, messages, and settings.
- `room.create`, `room.status.update`, `calendar.create`, `attendance.save`, and `payment.record` are branch-scoped.
- Branch state scoping limits users, students, teachers, course runs, class groups, events, rooms, invoices, payments, messages, and audit evidence.

Gaps:

- Schedule conflicts and capacity rules need production hardening.
- Branch settings and operations policies are still basic.
- Payment and notification delivery remain internal placeholders.

## Super Admin Lifecycle

Target flow:

1. Super admin creates staff users.
2. Super admin manages users, roles, permissions, branches, departments, programs, courses, settings, integrations, reports, and audit logs.
3. Super admin assigns teachers and manages platform-level role changes.
4. Super admin reviews health checks and integration status.
5. Super admin uses audit logs as the evidence layer for sensitive changes.

Current implementation:

- Super admin routes cover the complete internal control surface.
- `staff.user.create`, `user.update`, `permission.update`, `branch.update`, `settings.save`, `integration.status.update`, `integration.local_check`, and `system.health_check` exist.
- Super admin receives unscoped state except report presets are still owner-filtered.

Gaps:

- Production-level permissions UI and audit review workflows need stronger evidence and confirmation patterns.
- Integration screens must remain placeholders until provider-specific secure credential handling is designed.
- Durable settings/audit storage and retention policy need production implementation.

## Current Implementation Status

### Implemented

- Six role model: student, teacher, registrar, HOD, branch admin, super admin.
- Protected route coverage for all major portals.
- Domain model for users, staff profiles, students, teachers, courses, enrollments, classes, attendance, grades, payments, certificates, Quran, reports, and integrations.
- Typed workflow action union.
- Server action endpoint for platform mutations.
- Server-side role action gates.
- Server-side scope checks for student, teacher, registrar, HOD, branch admin, and super admin flows.
- Server-scoped platform snapshots per active role.
- Audit logging for domain workflow mutations.
- Demo seed data across identity, academics, admissions, payments, attendance, certificates, Quran, reports, and integrations.
- Certificate verification endpoint with basic rate limiting and code validation.
- Internal placeholder integration status.

### Partial

- Client `localStorage` is still used as a demo cache and offline UX layer.
- Server sessions are in memory.
- Platform state persistence is not yet a fully normalized production database authority.
- Branch/HOD scoping exists but needs production test depth across every edge case.
- Reports and exports are functional but need final production definitions per role.
- Payment, schedule, and communication workflows are internally represented but not provider-backed.
- UI route coverage is broad, but each route still needs route-by-route polish and workflow QA after data architecture stabilizes.

### Placeholder

- Moodle source mapping.
- EMS registration portal sync.
- Payment provider status.
- Email, WhatsApp, SMS, and meeting provider status.
- File/media storage for submissions, resources, audio, video, and certificate documents.
- Some operational records saved through generic `record.save`.

### Future Integration

- Live Moodle sync.
- Live EMS sync.
- Payment gateway.
- Real email/SMS/WhatsApp sending.
- Meeting provider.
- Production file/media storage.
- Durable server sessions.
- Supabase RLS-backed normalized tables.
- Scheduled jobs and background processing.
- Production audit export/retention.

## Data Authority Notes

Current internal alpha authority:

- Server action gates and scoped snapshots in `server/platformState.ts`.
- Domain mutation logic in `client/src/lib/domain/actions.ts`.
- Seed state in `client/src/lib/domain/seed.ts`.

Current risky authority:

- Client `localStorage` can hold demo platform state and should not be trusted for production authorization or final persistence.
- Client-side route guards improve UX but are not sufficient for production authorization.

Required production authority:

- Authenticated server session.
- Server-derived actor, role, branch scope, department scope, and ownership.
- Supabase/Postgres tables with RLS and server-only service operations where required.
- Audit log written server-side for sensitive actions.

## Workflow Gaps Discovered

1. Production persistence is not yet the single source of truth.
2. Client localStorage remains useful for demo UX but is risky if treated as authority.
3. Session storage is in memory and not durable.
4. External integrations are correctly deferred but many UI surfaces still need clear "placeholder/config/status only" treatment.
5. Placement-to-level rules need formal program-specific mapping.
6. Payment gating and reconciliation need internal rules before adding a provider.
7. Schedule conflict logic needs deeper production rules for room, teacher, branch, and time.
8. File/media storage is absent for assignments, resources, recitations, recordings, and certificates.
9. Report metrics need a final product definition per role.
10. Audit logs exist, but export, retention, filtering, and review workflows need production hardening.

## Recommended Implementation Sequence

1. Preserve the clean portal QA baseline before all changes.
2. Finalize the production data architecture: normalized tables, ownership fields, branch/department scope, and RLS boundaries.
3. Harden auth/session persistence and make server-derived identity the only authority for protected actions.
4. Stabilize super admin user and role management edge cases.
5. Stabilize student lifecycle end to end: lead/application, placement, level, enrollment, course, class, teacher, active portal.
6. Stabilize teacher lifecycle end to end: profile, assignment to classes, attendance, grading, feedback, progress.
7. Stabilize registrar, HOD, and branch admin workflows one workflow slice at a time.
8. Polish UI route by route after workflow behavior is stable.
9. Add CI enforcement for `npm run check`, tests, build, and portal QA.
10. Integrate external systems only after internal data authority and workflow QA are stable.
