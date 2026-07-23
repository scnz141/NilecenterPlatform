# Nile Learn Integration Ownership

## Purpose

This document explains the executable ownership contract in
`docs/integration-ownership-matrix.json`. The JSON matrix, not this summary, is
the machine-checked source for Phase 3 of the integration stabilization
program.

Status: accepted on 2026-07-16. The acceptance evidence is recorded in
`docs/qa-attestations/integration-ownership-phase3-20260716.json`.

The contract covers the complete frozen alpha surface:

- 296 client routes;
- 66 workflow actions;
- 78 server API routes;
- 31 approved Moodle read functions;
- 11 bounded Moodle sandbox contract functions.

Every item must match exactly one feature family. A new or ambiguous item fails
validation until its authority is decided explicitly.

## Non-Negotiable Authority Rules

1. One record field has one writable authority at a time.
2. Nile Learn is writable authority for identity mappings, role grants,
   organization, admissions, programs and levels, class delivery, rosters,
   schedules, rooms, attendance, finance, certificates, communication, and
   audit.
3. Moodle is the sole writable authority for course learning content,
   sections, resources, assignments, submissions, quizzes, questions,
   attempts, completion, grades, and feedback. Nile Learn receives read-only
   projections and submits verified provider CRUD commands or authenticated
   native Moodle launches.
4. Legacy Nile-native learning actions are compatibility-only and must reject
   normalized writes. They cannot create a second production authority.
5. ADR-011 authorizes full CRUD for marker-bound synthetic data in the
   dedicated Moodle sandbox. Production portal activation remains separately
   gated.
6. Browser state, titles, emails, and display names are never identity or
   authorization boundaries.
7. Missing, stale, conflicting, or ambiguous mappings create visible
   reconciliation work. They never use last-write-wins or title matching.

## Feature Family Groups

| Group                   | Families                                                                                                                                                                                                                         | Writable authority                                                         |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Entry and shell         | `public_discovery`, `authentication_sessions`, `legacy_route_compatibility`, `portal_overviews`                                                                                                                                  | Nile Learn or Supabase Auth identity                                       |
| Administration          | `identity_access_governance`, `organization_governance`, `profiles_preferences`, `platform_configuration_integrations`                                                                                                           | Nile Learn                                                                 |
| Admissions and delivery | `admissions_student_lifecycle`, `academic_catalog_curriculum`, `class_delivery_schedule`, `attendance_exceptions`                                                                                                                | Nile Learn                                                                 |
| Learning                | `moodle_learning_workspace`, `moodle_assignment_workflows`, `moodle_quiz_workflows`, `quran_learning`                                                                                                                            | Moodle for learning records; Nile Learn for Quran operational review only  |
| Operations              | `internal_communications`, `support`, `finance`, `certificates`, `reports_audit_health`, `nile_forms`                                                                                                                            | Nile Learn                                                                 |
| Alpha compatibility     | `compatibility_state_gateway`                                                                                                                                                                                                    | Temporary server transport; underlying domain action remains authoritative |
| Moodle projections      | `moodle_identity_projection`, `moodle_catalog_content_projection`, `moodle_enrollment_groups_projection`, `moodle_completion_projection`, `moodle_assignment_projection`, `moodle_quiz_projection`, `moodle_outcomes_projection` | Moodle, projected into Nile Learn and edited only through Moodle commands  |
| Moodle sandbox evidence | `moodle_sandbox_user_contract`, `moodle_sandbox_enrollment_group_contract`, `moodle_sandbox_status_contract`, `moodle_sandbox_full_crud_contract`                                                                                | Full synthetic CRUD in disposable sandbox                                  |

## Cross-Cutting Route Rules

- `/api/platform/state/actions` is a compatibility command envelope. The
  enclosed workflow action is classified independently and remains subject to
  its own server permission and scope gate.
- `/app/teacher/classes/:classId/attendance` belongs to attendance, not generic
  class delivery.
- `/app/teacher/classes/:classId/materials` belongs to the Moodle learning
  workspace, not generic class delivery.
- Report routes ending in `attendance`, `classes`, `certificates`, or `finance`
  remain report read models. They do not inherit write authority from the
  underlying operational family.
- Forms migration remains part of the Nile Forms boundary. It is a finite,
  explicit import workflow and does not create a recurring external authority.
- `core_webservice_get_site_info` is classified by surface: production read
  projection when listed as a read function, sandbox fingerprint evidence when
  listed in the bounded sandbox campaign.

## Failure And Reconciliation Policy

- Nile Learn command failure is atomic: no partial domain, audit, or outbox
  success.
- Moodle read failure retains only the last successful projection, marked with
  its source and stale timestamp.
- Unknown external IDs, missing mappings, duplicate mappings, and source
  conflicts are quarantined for reconciliation.
- Provider-managed fields remain read-only even when the provider is
  unavailable.
- A `connected` or `synced` state requires current server evidence.

## Efficient Validation Loop

Use the fast inner loop during implementation:

```bash
npm run verify:integration-fast
```

It runs the feature freeze, ownership matrix, Moodle closure evidence,
TypeScript, unit tests, and production build in two bounded parallel stages.
It does not certify database runtime drills or portal QA.

Use one focused browser workflow when the slice changes portal behavior:

```bash
VERIFY_SCOPE=focused \
QA_ONLY_WORKFLOWS="exact workflow name" \
QA_PORT=3022 \
QA_SESSION="focused-ownership" \
QA_OUTPUT_DIR="$PWD/output/playwright/focused-ownership" \
QA_LOCAL_DATA_DIR="$PWD/.local-data/focused-ownership" \
scripts/verify.sh
```

At a phase boundary, use an unfiltered final run:

```bash
QA_PORT=3023 \
QA_SESSION="integration-phase-boundary" \
QA_OUTPUT_DIR="$PWD/output/playwright/integration-phase-boundary" \
QA_LOCAL_DATA_DIR="$PWD/.local-data/integration-phase-boundary" \
scripts/verify.sh
```

Final mode rejects `QA_ONLY_ROLES`, `QA_ONLY_WORKFLOWS`, and
`SKIP_PORTAL_QA=1`, then asserts exactly 1,598 checks, zero failures, a complete
summary, and an unfiltered selection.

## Static Gate

Run:

```bash
npm run check:integration-ownership
```

The validator rejects:

- an unmapped frozen route;
- an unmapped workflow action;
- an unmapped Moodle read function;
- a surface matching more than one family;
- dead selectors;
- unknown roles or authority values;
- two writable authorities;
- a shared, dual, or bidirectional projection.

Its built-in negative controls prove those rejection paths remain active.
