# 08 Super Admin

## SPEC

Build `/app/admin/*` for users, roles, permissions, branches, departments, programs, courses, Moodle source, settings, integrations, audit logs, reports, system health, and platform blueprint.

## PLAN

- Map RBAC, users, permissions, branches, integrations, audit logs, and system state.

## IMPLEMENT

- Build access control and system operations workspaces with auditable local actions.

## VERIFY

- Create user, update role, toggle permission, update branch, set connector status, export audit, run health check, save settings.
- Run `scripts/verify.sh`.

## REVIEW

- RBAC reviewer.
- Security reviewer.
- QA reviewer.

## FIX

Fix permission leaks, audit gaps, and admin-only visibility.

## DOCUMENT

Document admin operations and server-side follow-ups.
