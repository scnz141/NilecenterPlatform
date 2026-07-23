# ADR-001: System Authority Boundaries

- Status: Accepted
- Date: 2026-07-10

## Context

The alpha snapshot mixes Nile-native records, demo records, provider-shaped
records, and legacy identifiers. Without field-level authority, two systems can
silently overwrite the same school fact.

## Decision

Nile Learn is the writable authority for identity mappings, role grants,
permissions, organization, admissions, students, enrollments, course delivery,
classes, schedules, attendance, finance, certificates, communication, and
audit.

Moodle is the writable authority for Moodle-managed curriculum content,
activities, completion, attempts, grades, and feedback. Nile Learn stores
scoped projections and mappings and submits edits through audited Moodle CRUD
commands or native launches. Legacy Nile-native learning records are
compatibility read models only.

ADR-010 supersedes the final sentence for Moodle-managed learning records, and
ADR-011 authorizes full synthetic CRUD testing in the dedicated sandbox. Nile
Learn must use typed provider commands rather than create a parallel writable
learning record.

Legacy EMS is authoritative only while a finite migration is running. Accepted
records become Nile Learn records after reconciliation and cutover. EMS never
receives writeback.

Files, audio, and video remain metadata-only until a storage provider is
separately approved.

## Invariants

- One field has one writable authority at a time.
- Browser state is never authority.
- Provider identifiers live in external mapping records, not human names.
- Provider-managed fields are read-only and rejected by Nile Learn commands.
- A UI label such as `connected` or `synced` requires current server evidence.
- Phase 1 permissions are role defaults only. Per-user allow/deny overrides need
  a later ADR and are not inferred from profile metadata.
- Branch scopes are unioned with other branch scopes on the same active grant;
  department scopes are unioned likewise. When an action requires both branch
  and department, both predicates must pass. Only an active Super Admin grant
  is global.

## Consequences

The application needs provider-aware read models, reconciliation state, and an
explicit distinction between Nile-native and Moodle-managed assessments.
