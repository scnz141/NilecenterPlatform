# QA Baseline

Nile Learn is currently in internal alpha stabilization. The protected portal QA baseline is:

- Portal QA: 1,205 checks, 0 failures.
- Checked at: `2026-07-09T09:38:47.361Z`.
- Validation command: `QA_OUTPUT_DIR=output/playwright/beta-goal-20260709-verify scripts/verify.sh`.
- QA summary artifact: `output/playwright/beta-goal-20260709-verify/portal-qa-summary.json`.

Admin governance is now separated across focused Simple UI routes:

- `/app/admin/roles` for role overview and role summaries.
- `/app/admin/permissions` for access rules and permission editing.
- `/app/admin/branches` for branch management.

Admin reports are now separated across focused report routes:

- `/app/admin/reports` for report overview.
- `/app/admin/reports/attendance` for attendance records.
- `/app/admin/reports/finance` for payment and invoice rows.
- `/app/admin/reports/certificates` for certificate status rows.
- `/app/admin/reports/admissions` for leads, applications, and placement rows.
- `/app/admin/reports/classes` for class-group rows.
- `/app/admin/reports/saved-views` for saved report filters.

The generic `FeaturePage` fallback route table has been reduced so routes already owned by Simple UI pages or dedicated workflow pages do not keep duplicate fallback entries.

Admin courses now follows the Simple UI split:

- `/app/admin/courses` for the course catalog and status workflow.
- `/app/admin/courses/:courseId` for one course record and its relationships.
- `/app/admin/courses/programs`, `/levels`, `/curriculum`, `/teachers`, and `/resources` for their focused course-governance lists.

Admin activity now follows the Simple UI split:

- `/app/admin/audit-logs` for search, action filtering, latest activity context, and audit CSV export.

Admin health now follows the Simple UI split:

- `/app/admin/system-health` for readiness checks, system signals, and the audited health-check action.

Admin settings and connections now follow the Simple UI split:

- `/app/admin/settings` for global platform configuration, retention, language, and audited settings saves.
- `/app/admin/integrations` for connection status review, local provider checks, and integration audit rows. Live providers remain placeholders.

Registrar students now follows the Simple UI split:

- `/app/registrar/students` for direct student creation and student records.
- `/app/registrar/students/:studentId` for one student lifecycle record, status, placement, enrollment, and audit context.

Registrar admissions now follows the Simple UI split:

- `/app/registrar/leads` and `/app/registrar/leads/:leadId` for enquiry intake and lead conversion.
- `/app/registrar/applications` and `/app/registrar/applications/:applicationId` for application intake and enrollment handoff preparation.
- `/app/registrar/placement-tests` and `/app/registrar/placement-tests/:bookingId` for placement booking and result recording.

Registrar payments now follows the Simple UI split:

- `/app/registrar/payments` for invoice search, balance review, and receipt recording.

Registrar enrollments now follows the Simple UI split:

- `/app/registrar/enrollments` for assignment handoff, course run selection, class selection, and portal activation.

Registrar schedule now follows the Simple UI split:

- `/app/registrar/schedule` for placement, trial, and admissions event booking.

Registrar classes now follows the Simple UI split:

- `/app/registrar/classes` for class capacity, branch-scoped assignment visibility, and enrollment readiness.

Branch rooms now follows the Simple UI split:

- `/app/branch/rooms` for branch-scoped room readiness, room status updates, and room creation.

Branch payments now follows the Simple UI split:

- `/app/branch/payments` for branch-scoped invoice review, balance status, and internal payment recording.

Branch reports now follows the Simple UI split:

- `/app/branch/reports` for branch-scoped attendance, finance, enrollment rows, saved views, and CSV export.

Branch schedule now follows the Simple UI split:

- `/app/branch/schedule` for branch-scoped event booking, room/class selection, schedule review, and class-session creation.

Branch attendance now follows the Simple UI split:

- `/app/branch/attendance` for branch-scoped roster attendance, session filters, status marking, notes, and save state.

HOD reports now use a dedicated route owner:

- `/app/hod/reports` for department-scoped academic reports, saved report views, and CSV export.

HOD workflow routes now use a dedicated route owner:

- `/app/hod/courses` for department-scoped course status review.
- `/app/hod/curriculum` for module creation and curriculum review.
- `/app/hod/schedule` for academic schedule review.
- `/app/hod/assessments` for department-scoped assessment creation, grading, and review.
- `/app/hod/certificates` for certificate approval, rejection, issue checks, and verification context.

Teacher assignment routes now use a dedicated route owner:

- `/app/teacher/assignments` for the assignment list.
- `/app/teacher/assignments/new` for one assignment create flow.
- `/app/teacher/assignments/:assignmentId` for one assignment record and submission review context.

Student assessment detail routes now use a dedicated route owner:

- `/app/student/assignments/:assignmentId` for one assignment submission.
- `/app/student/quizzes/:quizId` for one quiz attempt.

This baseline must remain clean for future changes. If a task changes UI, workflows, routes, RBAC, domain actions, or server action gates, run validation and confirm the portal QA result before reporting completion.

## Required Discipline

- Keep each change small and scoped.
- Do not change unrelated routes, tests, or business logic.
- Preserve RBAC and server-side action gates.
- Preserve audit logging for workflow mutations.
- Update tests or portal QA only when product behavior intentionally changes.
- Do not integrate external systems until internal workflows and data architecture are stable.

## Reporting

Every implementation report must include:

- exact files changed
- exact commands run
- validation result
- whether portal QA remains clean
