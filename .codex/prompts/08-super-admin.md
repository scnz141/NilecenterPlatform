# 08 Super Admin

## SPEC

Build `/app/admin/*` for users, roles, permissions, branches, departments, programs, courses, Moodle source, settings, integrations, audit logs, reports, system health, and platform blueprint.

## PLAN

- Map RBAC, users, permissions, branches, Moodle connections/mappings/commands,
  reconciliation, audit logs, and system state.

## IMPLEMENT

- Build access control and system operations workspaces with server-authorized,
  auditable actions. Super Admin governs Moodle capability manifests, mappings,
  command failures, and reconciliation; academic CRUD still requires the
  explicit content-governance permission.

## VERIFY

- Create user, update role, toggle permission, update branch, verify the Moodle
  CRUD capability manifest, reconcile a synthetic command, export audit, run
  health checks, and save settings.
- Run `scripts/verify.sh`.

## REVIEW

- RBAC reviewer.
- Security reviewer.
- QA reviewer.

## FIX

Fix permission leaks, audit gaps, and admin-only visibility.

## DOCUMENT

Document admin operations and server-side follow-ups.
