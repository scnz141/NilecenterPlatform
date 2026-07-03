# Super Admin Feature Map

## Research Inputs

- Current Nile Learn code routes: `/app/admin/dashboard`, `/app/admin/users`, `/app/admin/roles`, `/app/admin/permissions`, `/app/admin/branches`, `/app/admin/departments`, `/app/admin/programs`, `/app/admin/courses`, `/app/admin/moodle-source`, `/app/admin/settings`, `/app/admin/integrations`, `/app/admin/audit-logs`, `/app/admin/reports`, `/app/admin/system-health`, and `/app/admin/platform-blueprint`.
- Public legacy LMS surface: course categories, announcements, login, calendar, multi-language support, Moodle-style course/activity structure, and public course discovery.
- Current local platform domain state: users, roles, branches, departments, programs, courses, modules, lessons, resources, course runs, class groups, leads, placements, enrollments, payments, certificates, Quran records, integrations, notifications, and audit logs.

## Super Admin Hierarchy

1. Global governance
   - Owns platform settings, RBAC, audit evidence, integration boundaries, and operating policy.
   - Primary routes: dashboard, blueprint, roles, permissions, settings, audit logs, system health.

2. Academic ownership
   - Owns departments, programs, levels, courses, curriculum, certificates, and Moodle source mapping.
   - Primary routes: departments, programs, courses, Moodle source.

3. Branch operations
   - Owns branch visibility, branch status, rooms, local classes, schedules, attendance exceptions, and branch reporting.
   - Primary routes: branches, reports, system health.

4. Admissions and finance
   - Owns cross-portal visibility into leads, placement, enrollment, invoices, payment state, and report exports.
   - Primary routes: reports, audit logs, integrations.

5. Teaching delivery
   - Owns platform-level visibility into teachers, course runs, class groups, Moodle activities, materials, assignments, quizzes, Quran review, and messages.
   - Primary routes: Moodle source, courses, reports.

## Required Super Admin Workspaces

- Dashboard: live state-derived metrics, hierarchy map, quick actions, operating stream, and direct links to the owning modules.
- Users: identity directory, create user, pause/activate, role assignment, branch scope, department scope, and audit trail.
- Roles: selected-role coverage, assigned users, role toggles, active role selection, and audit evidence.
- Permissions: permission matrix with grant/revoke behavior and clear RBAC coverage metrics.
- Branches: branch list, status changes, user counts, department counts, and branch-scope warnings.
- Departments/programs/courses: academic governance, curriculum module creation, course status, certificate approval, and academic reports.
- Moodle source: observed course structure, sections, activities, plugin strategies, and server-only sync boundary.
- Integrations/settings: connector registry, env requirements, local checks, disabled sync until connected, and server-only credential policy.
- Audit logs: searchable/filterable audit explorer, CSV export, and recent access/system changes.
- Reports/system health: live local summaries, saved views, CSV export, health checks, connector readiness, and operational warnings.

## Current Boundaries

- Auth and backend behavior stay as-is for this phase.
- Supabase is currently used as a demo/snapshot persistence boundary, not a normalized production LMS schema.
- Moodle, EMS, email, WhatsApp, payment, meeting, file upload, and PDF generation stay explicit server-side integration boundaries until provider work is scheduled.
- Every UI change must remain responsive for desktop, tablet, and mobile.
