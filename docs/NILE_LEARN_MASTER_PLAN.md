# Nile Learn Modernization Master Plan

## Purpose

This document is the product and architecture roadmap for moving Nile Learn
from a broad internal alpha into a production-ready LMS and EMS foundation.

It is grounded in:

- the current Nile Learn codebase and protected portal QA baseline;
- the read-only legacy EMS audit for Registrar, Teacher, HOD, Supervisor, and
  Branch Administrator views;
- the read-only Moodle teacher and course audit;
- the existing Nile Learn domain, server action, repository, auth, and UI
  architecture.

This plan owns product sequencing, data authority, architecture boundaries,
migration order, and completion gates. It does not replace `CLAUDE.md`,
`AGENTS.md`, the design contracts, or feature-specific prompts.

## Mission

Build Nile Learn as the canonical school operating system while retaining
Moodle as the initial learning-content and activity engine. Migrate verified
legacy EMS data into Nile Learn through a finite, reconciled, reversible
process. Do not reproduce legacy security flaws, invalid data states, role
leaks, crowded UI, or ambiguous ownership.

The protected internal-alpha baseline is:

- Portal QA: 1,634 checks, 0 failures.
- TypeScript check, unit tests, and production build are required gates.
- The accepted evidence is recorded in `docs/qa-baseline.md`.

## Agent Goal

Move Nile Learn from a broad internal alpha to a production-ready LMS and EMS
foundation without losing the clean baseline. Make Nile Learn authoritative for
identity, RBAC, organization, admissions, enrollments, classes, schedules,
attendance, finance, certificates, messaging, and audit. Treat legacy EMS as a
finite read-only migration source and Moodle as the initial authority for
Moodle-managed content and activities. Implement normalized persistence,
durable sessions, strict scope enforcement, reconciliation-based integrations,
and route-by-route Simple UI through small verified slices.

Every agent must name the master-plan phase and bounded slice before editing,
then follow `docs/MODERNIZATION_EXECUTION_CONTRACT.md` through completion or a
clear stop condition.

## Non-Negotiable Product Model

Supported roles remain:

- `student`
- `teacher`
- `registrar`
- `headofdepartment`
- `branchadmin`
- `superadmin`

Legacy Supervisor, Guidance, Accountant, and Administrator labels do not become
new permanent Nile Learn roles. Their valid capabilities are expressed as
permissions and scopes within the five staff roles.

```text
User
  -> Role grant
  -> Active role
  -> Branch and department scopes
  -> Permissions
  -> Portal access
  -> Server-authorized actions
  -> Immutable audit events
```

## Source-Of-Truth Matrix

| Data family                                           | Initial authority                       | Nile Learn behavior                                   |
| ----------------------------------------------------- | --------------------------------------- | ----------------------------------------------------- |
| Authentication                                        | Supabase Auth                           | Verify identity and manage durable sessions           |
| Roles, permissions, active role, scopes               | Nile Learn                              | Canonical, server-authoritative                       |
| Branches and departments                              | Nile Learn                              | Canonical                                             |
| Leads, applications, placement                        | Nile Learn                              | Canonical                                             |
| Students, guardians, enrollments                      | Nile Learn                              | Canonical                                             |
| Programs, levels, catalog metadata                    | Nile Learn                              | Canonical                                             |
| Course offerings, classes, teachers, rooms, schedules | Nile Learn                              | Canonical                                             |
| Class sessions and attendance                         | Nile Learn                              | Canonical; Moodle writeback is a later optional phase |
| Finance, certificates, messages, audit                | Nile Learn                              | Canonical                                             |
| Moodle course structure and content                   | Moodle initially                        | Read-only synchronized projection                     |
| Moodle activities and completion                      | Moodle for provider-managed activities  | Read-only synchronized projection                     |
| Moodle attempts, grades, and feedback                 | Moodle for provider-managed assessments | Read-only summary in Nile Learn                       |
| Nile-native assessments                               | Nile Learn                              | Canonical; never dual-owned with a Moodle activity    |
| Legacy EMS records                                    | Legacy EMS only during migration        | One-way import, reconciliation, then retirement       |
| Files, audio, and video                               | Future approved storage provider        | Metadata only until storage is approved               |

No entity field may have two writable authorities. Provider-managed fields must
be visibly read-only in Nile Learn and rejected by server actions.

## Accepted Architecture Decisions

The Phase 0 decisions are recorded under `docs/decisions/`:

- ADR-001: system authority boundaries;
- ADR-002: durable sessions and effective role grants;
- ADR-003: read-only Moodle projection;
- ADR-004: finite legacy EMS migration;
- ADR-005: atomic domain, audit, and outbox writes.

Implementation must follow these records. Any change requires a superseding ADR
and the approval process defined in `docs/decisions/README.md`.

## Canonical Academic Model

The new model must distinguish reusable academic design from delivery:

```text
Department
  -> Program
  -> Level
  -> Course template
  -> Curriculum version
  -> Modules
  -> Lessons

Course template
  -> Course offering
  -> Class group
  -> Teacher assignment history
  -> Student membership history
  -> Recurring schedule
  -> Class sessions
  -> Attendance and outcomes
```

Required corrections to the current snapshot model:

- A course template is not a class.
- A course offering is not a class group.
- A recurring schedule is not an individual session.
- Teacher assignment needs effective dates, substitutes, and history.
- Student class membership needs effective dates and status history.
- Moodle and EMS identifiers belong in external mapping records.
- Course titles and human names are never integration keys.

## Target Application Architecture

Keep a modular monolith. Do not create microservices during stabilization.

```text
React route and page-type layer
  -> Typed query and command API
  -> Application use cases
  -> Domain rules and authorization policy
  -> Granular repositories
  -> Supabase/Postgres transactions
  -> Audit and outbox records
  -> Provider adapters and background synchronization
```

### Client

- Render role-scoped read models returned by the server.
- Send typed commands without actor, role, or ownership authority.
- Use local storage only for non-authoritative UI preferences and safe drafts.
- Never merge demo seed data into production results.

### Server

- Resolve identity, active role, permissions, branch scope, department scope,
  ownership, and provider authority from the authenticated session and database.
- Use explicit application services for lifecycle transitions.
- Commit domain mutation, audit event, and outbox event atomically.
- Require an idempotency key for retried commands and integration writes.
- Fail closed when production persistence is unavailable.

### Repository

The current snapshot repository remains a compatibility adapter during
migration. It must not become the production model.

Target repository families:

- Identity and access
- Organization
- Admissions and students
- Catalog and curriculum
- Course delivery and scheduling
- Attendance
- Assessments and progress
- Finance
- Certificates
- Communication
- Audit and reporting
- Integrations and migration

## Authentication And Authorization

Supabase Auth authenticates the person. Nile Learn tables authorize the action.

Required chain:

```text
auth.users
  -> app_users
  -> role_grants
  -> staff or student profile
  -> branch and department scopes
  -> permission policy
```

Hard rules:

- A missing or ambiguous identity mapping returns 403. It never falls back to a
  demo user.
- Production sessions are durable across instances and deployments.
- Active-role switching requires an active grant and creates an audit event.
- Sensitive actions refresh role and scope authority server-side.
- RLS and server action gates provide defense in depth.
- Service-role credentials are used only by server jobs that require them.
- Previously exposed credentials must be rotated before production use.

## Integration Architecture

Use provider-neutral mapping and synchronization records:

- `integration_connections`
- `external_records`
- `sync_cursors`
- `sync_runs`
- `sync_run_items`
- `reconciliation_cases`
- `outbox_events`

Every external record needs provider, entity type, internal ID, external ID,
external parent ID, source version, source timestamp, source hash, sync state,
last seen time, last synchronized time, and last error.

### Moodle

The verified legacy contract includes Moodle user IDs, course IDs, course short
names, course dates, attendance activity IDs, course sections, pages, videos,
quizzes, gradebook, completion, and attendance sessions.

Moodle rollout order:

1. Capability discovery with a dedicated minimum-privilege service account.
2. Read-only user, course, section, activity, enrollment, completion, grade,
   and attendance projections.
3. Mapping and reconciliation UI.
4. Human approval of unmatched or stale records.
5. Controlled user/course enrollment writes.
6. Optional attendance writeback only after Nile attendance is canonical.

Do not use browser automation or staff credentials as a production connector.

### Legacy EMS

Legacy EMS integration is a finite migration, not a permanent sync.

Required migration records:

- `migration_runs`
- immutable source payload hashes
- source-to-internal ID mappings
- match exceptions
- reconciliation totals
- approval state
- cutover watermark
- final delta-import evidence
- rollback evidence

Outbound EMS writeback and recurring EMS synchronization are prohibited. After
approved cutover, retire the migration credentials.

## UI And Information Architecture

All route work follows `DESIGN.md`, `docs/DESIGN_V2.md`,
`docs/SIMPLE_UI.md`, and `docs/UI_INFORMATION_ARCHITECTURE.md`.

One page has one main job. List, detail, create, reports, activity, settings,
and access management remain separate.

Example class route family:

```text
/app/{role}/classes
/app/{role}/classes/:classId
/app/{role}/classes/:classId/roster
/app/{role}/classes/:classId/schedule
/app/{role}/classes/:classId/sessions
/app/{role}/classes/:classId/attendance
/app/{role}/classes/:classId/grades
/app/{role}/classes/:classId/content
/app/{role}/classes/:classId/activity
```

The UI must not reproduce the legacy all-tabs-expanded class screen.

## Delivery Phases

### Phase 0: Authority And Baseline

Deliverables:

- Correct the legacy discovery ledger.
- Approve this source-of-truth matrix.
- Record architecture decisions for auth, Moodle, EMS migration, and audit.
- Preserve the then-current 1,313/0 QA artifact.

Gate: no unresolved ownership conflict.

### Phase 1: Identity, Organization, Audit, And Mapping Schema

Deliverables:

- Migration drafts for users, role grants, permissions, scopes, branches,
  departments, immutable audit events, and external mappings.
- Forced RLS, zero direct browser grants/policies on normalized base tables,
  server-only authority helpers, and complete foreign-key/authority indexes.
- Fake seed data only.

Gate: migration rollback succeeds, database browser-role privilege assertions
and real local PostgREST `anon`/`authenticated` denial checks pass, session
resolution proves one active role grant, and command/migration evidence
constraints pass.

Current local-only Phase 1 package:

- `docs/supabase-phase-1-identity-session-rls-draft.sql`
- `docs/supabase-phase-1-identity-session-rls-rollback.sql`
- `docs/supabase-phase-1-identity-session-rls-assertions.sql`
- `supabase/migrations/20260710053837_phase1_identity_scope_session_audit_mapping.sql`
- `supabase/seed.sql`
- `scripts/validate-phase1-schema.mjs`
- `scripts/validate-phase1-pglite.mjs`
- `scripts/validate-phase1-supabase.sh`

The reviewed SQL has been promoted into local migration history and proved on a
disposable Supabase Postgres 17 stack after the atomic authority RPC and live
scope-revalidation changes. The local gate resets from migration history, loads
fake-only seed data, runs semantic and database browser-role privilege
assertions, executes the rollback, reapplies the migration and seed, and runs
database lint. It has not been pushed or applied to a linked, shared, or remote
Supabase project.

Current evidence:

- `npm run check:phase1-schema` validates the migration package statically.
- `npm run check:phase1-schema:runtime` proves the portable PGlite cycle.
- `npm run check:phase1-schema:supabase` proves the disposable local Supabase
  cycle for all 25 Phase 1 tables.
- `npm run check:phase2-session:postgrest` proves the corrected Phase 2B SQL
  through the real repository adapter against isolated native PostgreSQL 17 and
  PostgREST 14.14. The local-only run covers atomic create/revoke, exact replay
  and conflict rejection, live scope refresh, expiry, audit evidence,
  `revoked_by`, and eight browser-role denials. The evidence is recorded in
  `docs/moodle-and-session-foundation-evidence-20260712.md`.
- `QA_OUTPUT_DIR=output/playwright/phase2a-20260710 scripts/verify.sh` preserves
  the then-current full 1,313-check portal baseline with 0 failures.

A remote dry run, managed-project advisors, backup/restore evidence, and
explicit promotion approval remain required before any shared-environment
application.

Phase 2A now provides the asynchronous durable-session repository boundary, a
memory default, a non-default Supabase adapter, opaque-token hashing, atomic
identity/active-grant resolution, live role-scope refresh, revocation,
fail-closed configuration, and real disposable-local PostgREST evidence. It
does not authorize linked/shared use or normalized workflow persistence.

### Phase 2: Durable Authentication And Scope Authority

Deliverables:

- Durable Supabase-backed session model.
- Exact `auth.users -> app_users` mapping.
- Active-role grant verification and revocation.
- Server-side scope refresh for sensitive actions.

Gate: no in-memory session dependency in production and no demo fallback.

### Phase 3: Repository Read Migration

Deliverables:

- Granular repository interfaces.
- Normalized read adapter behind an explicit server flag.
- Snapshot compatibility adapter remains default during parity testing.
- Read-model parity tests.

Gate: seeded route and workflow results remain equivalent and QA stays clean.

### Phase 4: Admissions And Student Lifecycle

Deliverables:

- Lead, application, placement, profile, enrollment workflow, course offering,
  class assignment, and portal activation in normalized persistence.
- Branch-scoped registrar actions and audit evidence.

Gate: the complete lifecycle passes server, RLS, UI, and portal QA tests.

### Phase 5: Course Delivery And Scheduling

Deliverables:

- Course templates, versions, offerings, class groups, assignment history,
  rooms, recurrence, sessions, conflicts, and membership history.

Gate: teacher, room, branch, and time conflicts are deterministic and audited.

### Phase 6: Read-Only Moodle Projection

Deliverables:

- Dedicated sandbox connection.
- Read-only mappings for users, courses, content, activities, enrollments,
  completion, grades, and attendance.
- Sync run history and reconciliation queues.

Gate: repeated sync creates no duplicates and stale mappings are visible.

### Phase 7: Teacher Operations

Deliverables:

- Assigned classes and rosters.
- Session attendance.
- Native or Moodle-owned assessment distinction.
- Grading and feedback within provider authority.
- Student progress and intervention views.

Gate: teachers cannot read or mutate unrelated classes or students.

### Phase 8: HOD And Branch Governance

Deliverables:

- HOD academic health, teacher oversight, curriculum review, assessment review,
  and certificate approval.
- Branch room, schedule, attendance-exception, finance, and local-report flows.

Gate: department and branch isolation pass direct API and RLS tests.

### Phase 9: Super Admin And Reconciliation

Deliverables:

- User and access administration.
- Branch and department configuration.
- Connection status, sync runs, reconciliation, immutable activity, and health.

Gate: every sensitive action has before/after evidence and an actor.

### Phase 10: Controlled Moodle Write Operations

Deliverables:

- Approved user provisioning and enrollment synchronization.
- Idempotent outbox processing and rollback.
- No broad content writeback until separately approved.

Gate: sandbox proof, threat review, retry proof, and reconciliation approval.

### Phase 11: Legacy Migration And Cutover

Deliverables:

- Dry-run imports.
- Data quality report.
- Human-approved reconciliation.
- Final delta import and cutover.
- Credential retirement and rollback window.

Gate: approved counts, relationships, balances, and sampled records match.

### Phase 12: Route-By-Route UI Completion

UI work follows each stable workflow rather than preceding it.

Deliverables:

- Dedicated page owners instead of generic `FeaturePage` fallback.
- Simple UI separation.
- Responsive and RTL verification.
- Loading, empty, error, disabled, success, and permission-denied states.

Gate: visual review and portal QA at every route-family boundary.

### Phase 13: Nile Forms

Nile Forms replaces the approved Jotform-dependent collection use cases without
turning typed learning and school operations into generic forms.

Deliverables:

- Authority, permissions, schema, rollback, fake fixtures, and ADR-006.
- Immutable versions, structured bilingual renderer and builder, public and
  assigned access, drafts, submissions, scoped inbox, review, export, and typed
  promotion adapters.
- Staff-only encrypted offline capture with expiring bundles, foreground sync,
  duplicate protection, reauthorization, quarantine, and recovery.
- Selective finite Jotform response migration with source hashes,
  reconciliation, no automatic promotion, and credential retirement.

Gate: schema and rule validation, every RBAC and scope denial, immutable-version
proof, idempotent review/promotion/sync/import, EN/AR and RTL accessibility,
local migration rollback, and the accepted portal baseline all pass. Remote
schema application, normalized production runtime activation, uploads, drawn
signatures, arbitrary webhooks, payments, or provider actions require their own
later approvals.

### Phase 14: Nile Forms Processing And Typed Operations

ADR-007 extends the Jotform replacement program without turning form answers
into mutable workflow state or creating a generic application builder.

Deliverables, implemented as separately approved slices:

- Typed processing modules built only after the Phase 13F1 normalized
  repository contract is accepted.
- Structured field, language, validation, calculation, and reusable-template
  parity, including complete `en | ar | tr` values, Arabic RTL, Turkish LTR,
  and localized validation message keys with parameters.
- Typed Requests and bounded Approvals with immutable correction lineage.
- Typed Appointments with atomic slot capacity and typed Surveys with privacy
  thresholds.
- Storage, signature acknowledgment, reporting, PDF, notifications, and
  external adapters only after their prerequisite approvals.
- Route-by-route Jotform replacement, selective migration, reconciliation,
  shutdown, and credential retirement.

Gate: each typed module proves its own authority, state transitions,
idempotency, concurrency, privacy, rollback, responsive UI, and accepted portal
baseline before the next module or provider is approved.

## Testing Strategy

Every phase uses the smallest relevant test pyramid:

- Domain invariant unit tests
- Application service tests
- Repository contract tests
- Transaction and idempotency tests
- RLS allow/deny tests with real role identities
- API ownership and scope tests
- Provider contract fixture tests
- Migration reconciliation tests
- Portal QA
- Responsive visual checks
- Accessibility checks

Completion never relies on a screenshot alone.

## Agent Workstreams

The primary agent owns scope, integration, and final validation. Specialized
review agents may run in parallel under `docs/MODERNIZATION_EXECUTION_CONTRACT.md`.

Recommended workstreams:

- Data architecture and migrations
- Auth, RBAC, RLS, and security
- Domain workflow implementation
- Moodle and migration adapters
- UI information architecture and responsive design
- QA, accessibility, and observability

Shared authority files, migrations, routing, auth, domain types, repositories,
QA scripts, and global CSS are serialized unless isolated worktrees and disjoint
ownership are explicitly approved.

## Definition Of Production-Ready Foundation

The foundation is ready only when:

- Production writes fail closed.
- Sessions are durable.
- Normalized persistence is authoritative.
- RLS and server gates agree.
- Every sensitive write is atomic with audit evidence.
- Cross-role, cross-branch, cross-department, and ownership tests pass.
- External synchronization is idempotent and reconcilable.
- Legacy data migration is approved and reversible.
- No production secret is browser-visible.
- Portal QA remains clean.
- Core routes are usable on mobile, laptop, desktop, ultrawide, and RTL.

## Current Modernization Checkpoint

This section is the single source of truth for current phase status and the
only approved next implementation slice. Companion plans and prompts must link
here rather than restating this checkpoint.

Current status:

- The product owner approved the seven-phase integration stabilization program
  on 2026-07-16. Its sequence and acceptance gates are defined in
  `docs/INTEGRATION_STABILIZATION_PROGRAM.md`. Program Phase 1 is accepted: the
  source-derived freeze records 6 roles, 282 concrete route patterns, 65
  workflow actions, 51 API routes, 31 Moodle reads, and 11 bounded sandbox
  writes in `docs/integration-feature-freeze.json`. The integrated acceptance
  run passed every repository gate and 1,598 portal checks with 0 failures; its
  tracked attestation is
  `docs/qa-attestations/integration-feature-freeze-phase1-20260716.json`.
  Program Phase 2 is accepted. M2C-R reached 31/31 reads twice with an identical
  combined fingerprint, removed all disposable course modules, users, service,
  private uploads, WebDAV configuration, and H5P libraries, revoked temporary
  capabilities, stopped its local bridge, and proved retired-token rejection.
  The full phase-boundary verification passed 572 unit tests and 1,598 portal
  checks with 0 failures. The redacted proof is
  `docs/qa-attestations/moodle-m2cr-phase2-20260716.json`. Program Phase 3 is
  accepted. Its executable matrix maps all 282 routes, 65 workflow actions, 51
  APIs, 31 Moodle reads, and 11 bounded sandbox writes to exactly one of 33
  feature families. The final acceptance run passed 591 unit tests and 1,598
  portal checks with 0 failures. Evidence is recorded in
  `docs/qa-attestations/integration-ownership-phase3-20260716.json`. Program
  Phase 4 is accepted. Its executable contract proves both provider lanes, 10
  feature families, all 31 reads, all 11 bounded sandbox writes, all 9 lifecycle
  stages, 7 authority denials, and 5 negative controls. The final acceptance
  run passed 591 unit tests and all 1,598 portal checks with 0 failures in
  615,566 ms. Evidence is recorded in
  `docs/qa-attestations/moodle-phase4-contract-loops-20260716.json`. Program
  Phase 5 is accepted. The pinned isolated staging project passed two reviewed
  database applications, two semantic assertion passes, rollback, deterministic
  reseeding, RLS and browser-role denial checks, real Supabase login, hashed
  durable sessions, two-instance resolution, live scope refresh, revocation,
  logout, expiry, and fail-closed outage behavior. The phase-boundary run passed
  624 unit tests and all 1,598 portal checks with 0 failures. Redacted evidence
  is recorded in
  `docs/qa-attestations/integration-phase5-staging-foundation-20260716.json`.
  Program Phase 6 is now active and is limited to role-scoped, read-only Moodle
  projections. Its initial course/content contract is accepted: two GET-only
  endpoints enforce the four-role catalog ownership contract, canonical active
  identity and relationship scope, exact mappings, hidden learner-content
  filtering, minimum-privilege evidence, deterministic replay, and fail-closed
  repository/provider behavior. The phase-boundary run passed 659 unit tests
  and all 1,598 portal checks with 0 failures in 619,666 ms. Evidence is in
  `docs/qa-attestations/integration-phase6-projection-contract-20260716.json`.
  The additive Phase 6A authority repository contract is also accepted. It adds
  a normalized server-only authority and Moodle course-mapping boundary, nine
  forced-RLS tables, two bounded service-role RPCs, explicit 403/503 failure
  classification, and no compatibility-state fallback. The package passed two
  portable PostgreSQL applications, two semantic assertion passes, rollback and
  reapply, 49 focused repository/service/route tests, 673 total unit tests, and
  all 1,598 portal checks with 0 failures in 619,718 ms. Evidence is in
  `docs/qa-attestations/integration-phase6a-authority-repository-20260717.json`.
  Its SQL remains manual and unapplied, and runtime activation remains disabled.
  The additive Phase 6B observation repository is accepted locally. It retains
  bounded sanitized course-catalog and course-content observations, re-resolves
  current authority before every read, distinguishes fresh, stale, unavailable,
  and partial results, and never uses stale data as authority. Its reviewed SQL
  remains manual and unapplied. Evidence is in
  `docs/qa-attestations/integration-phase6b-observation-repository-20260717.json`.
  Phase 6C now wires the four approved catalog roles to the same-origin server
  projection through a strict client DTO boundary. The portal has explicit
  loading, empty, unavailable, stale, partial, and retry states, no local-state
  fallback, no browser-to-Moodle call, and no write control. The approved QA
  scope adds server-source and unexpected-console-error checks, establishing the
  protected 1,602/0 baseline. Evidence is in
  `docs/qa-attestations/integration-phase6c-portal-catalog-wiring-20260717.json`.
  Phase 6D adds the exact-course content route for the same four roles, strict
  nested DTO validation, current-authority and exact-course observation scope,
  fail-closed student visibility, and explicit read-only detail states. Desktop,
  mobile, accessibility, console, and same-origin request coverage establish the
  protected 1,634/0 baseline. Evidence is in
  `docs/qa-attestations/integration-phase6d-course-content-wiring-20260717.json`.
  Phase 6E establishes the prerequisite exact Moodle user-mapping authority
  boundary before enrollment, roster, completion, or outcome projections. Its
  two service-role-only RPCs derive user scope from current normalized grants
  and relationships, return IDs and synchronization metadata only, reject
  browser roles, and never match by email or display name. The additive SQL is
  manual and unapplied, runtime activation remains disabled, and no portal
  route or provider call was added. Two portable PostgreSQL applications, two
  semantic assertion passes, rollback/reapply, 8 browser-role denials, 763 unit
  tests, the production build, and the complete 1,634/0 portal suite pass.
  Evidence is in
  `docs/qa-attestations/integration-phase6e-user-mapping-authority-20260717.json`.
  Phase 6F establishes a bounded enrollment/group observation repository and
  server-only class projection route on top of exact current mappings. Teachers
  receive only person-level IDs for learners in classes currently assigned to
  them; HOD and Super Admin receive aggregate counts only; Student, Registrar,
  and Branch Admin are denied. Strict payload parsing, hash validation,
  30-day maximum retention, fresh/stale-retained/expired/unavailable states,
  reconciliation outcomes, replay, rollback/reapply, and current relationship
  revalidation are enforced without names, emails, provider identifiers, or
  direct Moodle calls. Two portable PostgreSQL applications, two semantic
  assertion passes, rollback/reapply, 14 browser-role denials, 8 bounded
  service calls, 772 unit tests, the production build, and the complete
  1,634/0 portal suite pass. The SQL remains manual and unapplied, normalized
  runtime activation remains disabled, and no Moodle write occurred. Evidence
  is in
  `docs/qa-attestations/integration-phase6f-enrollment-group-observation-20260717.json`.
  Phase 6G establishes an atomic assignment/quiz definition and schedule-status
  observation boundary for exact authorized classes. Students are limited to
  their own active or completed enrollment and exact user mapping; teachers to
  a currently assigned class; HOD to department scope; and Super Admin to
  global scope. Registrar and Branch Admin are denied. Strict payload parsing,
  hash and retention validation, reconciliation-only missing mappings, and
  rollback/reapply are enforced while submissions, attempts, answers, grades,
  feedback, completion, contact data, and raw Moodle identifiers remain
  excluded. Two portable PostgreSQL applications, two semantic assertion
  passes, rollback/reapply, 22 browser-role denials, 14 bounded service calls,
  783 unit tests, the production build, and the complete 1,634/0 portal suite
  pass. The SQL remains manual and unapplied, normalized runtime activation is
  disabled, and no provider call or Moodle write occurred. Evidence is in
  `docs/qa-attestations/integration-phase6g-assessment-status-observation-20260717.json`.
  Phase 6H1 establishes the first result-family boundary for assignment
  submissions and grade state. Students receive only their own current mapped
  result, teachers receive person-level results only for exact currently
  assigned classes, and HOD/Super Admin receive aggregate counts. Registrar and
  Branch Admin are denied. Strict closed payloads, exact course/group/user/
  assignment mappings, 15-minute freshness, stale-result denial, 30-day maximum
  retention, replay/conflict handling, rollback/reapply, and current authority
  revalidation are enforced. Files, answers, comments, feedback, grader
  identity, contact data, and raw Moodle identifiers remain excluded. Two
  portable PostgreSQL applications, two semantic assertion passes,
  rollback/reapply, 22 browser-role denials, 16 bounded service calls, 809 unit
  tests, the production build, and the complete 1,634/0 portal suite pass. The
  SQL remains manual and unapplied, normalized runtime activation is disabled,
  and no provider call or Moodle write occurred. Evidence is in
  `docs/qa-attestations/integration-phase6h1-assignment-results-observation-20260717.json`.
  Phase 6H2 establishes the separate quiz-attempt summary boundary. Students
  receive only their own current mapped attempt, teachers receive person-level
  summaries only for exact currently assigned classes, and HOD/Super Admin
  receive aggregate counts. Registrar and Branch Admin are denied. Exact
  course/group/user/quiz/attempt mappings, preview-attempt rejection,
  15-minute freshness, stale-result denial, 30-day maximum retention,
  replay/conflict handling, rollback/reapply, and current authority
  revalidation are enforced. Question text, answers, feedback, files, comments,
  contact data, and raw Moodle identifiers remain excluded. Two portable
  PostgreSQL applications, two semantic assertion passes, rollback/reapply,
  22 browser-role denials, 16 bounded service calls, 815 unit tests, the
  production build, and the complete 1,634/0 portal suite pass. The SQL remains
  manual and unapplied, normalized runtime activation is disabled, and no
  provider call or Moodle write occurred. Evidence is in
  `docs/qa-attestations/integration-phase6h2-quiz-attempt-observation-20260717.json`.
  Phase 6H3 establishes the separate gradebook and released-feedback summary
  boundary. Students receive only their own explicitly released outcome,
  teachers receive person-level outcomes only for exact currently assigned
  classes, and HOD/Super Admin receive aggregate counts. Registrar and Branch
  Admin are denied. Exact course/group/user/grade-item mappings, explicit
  feedback release, unsafe-feedback rejection, 15-minute freshness, 30-day
  maximum retention, replay/conflict handling, rollback/reapply, and current
  authority revalidation are enforced. Questions, answers, files, comments,
  grader identity, contact data, and raw Moodle identifiers remain excluded.
  Two portable PostgreSQL applications, two semantic assertion passes,
  rollback/reapply, 22 browser-role denials, 16 bounded service calls, 822 unit
  tests, the production build, and the complete 1,634/0 portal suite pass. The
  SQL remains manual and unapplied, normalized runtime activation is disabled,
  and no provider call or Moodle write occurred. Evidence is in
  `docs/qa-attestations/integration-phase6h3-grade-outcome-observation-20260717.json`.
  Phase 6H4 establishes the separate lesson, H5P, and SCORM outcome-summary
  boundary. Students receive only their own current mapped outcome, teachers
  receive person-level outcomes only for exact currently assigned classes, and
  HOD/Super Admin receive aggregate counts. Registrar and Branch Admin are
  denied. Exact course/group/user/activity mappings, completion state,
  explicitly released scores, 15-minute freshness, 30-day maximum retention,
  replay/conflict handling, rollback/reapply, and current authority
  revalidation are enforced. Raw tracks, interactions, questions, answers,
  files, comments, provider identifiers, grader identity, and contact data
  remain excluded. Two portable PostgreSQL applications, two semantic
  assertion passes, rollback/reapply, 22 browser-role denials, 16 bounded
  service calls, 829 unit tests, the production build, and the complete
  1,634/0 portal suite pass. The SQL remains manual and unapplied, normalized
  runtime activation is disabled, and no provider call or Moodle write
  occurred. Evidence is in
  `docs/qa-attestations/integration-phase6h4-activity-outcome-observation-20260717.json`.
  Phase 6I is accepted on the pinned isolated fake-data staging project. All
  nine accepted read-only Phase 6 packages passed two applications, two
  deterministic fixture and semantic assertion passes, one complete rollback,
  reapply, PostgreSQL and forced-RLS inspection, 18 service-role PostgREST RPC
  checks, and 8 anonymous/authenticated denial checks. The run verified 16
  forced-RLS tables, 32 service-role routines, no browser grants, Supabase's
  `extensions`-schema pgcrypto deployment, and collation-independent grade
  payload validation. The temporary fake Auth identity was deleted. The final
  gate passed 829 unit tests, the production build, and all 1,634 portal checks
  with 0 failures. Production was not targeted, no provider call or Moodle
  write occurred, and `NILE_MOODLE_PROJECTION_REPOSITORY` remains disabled.
  Evidence is in
  `docs/qa-attestations/integration-phase6i-staging-promotion-20260717.json`.
  The SQL remains outside migration history and is accepted only on the pinned
  isolated staging target. No further Phase 6 projection family, production
  promotion, live-provider proof, or runtime activation is approved at this
  checkpoint. The next implementation slice requires an explicit product
  decision; Phase 7 remains gated.
- Phase 0 is accepted: authority, legacy boundaries, architecture decisions,
  and its then-current 1,317/0 QA baseline are recorded. The current protected
  baseline is 1,634/0.
- Phase 1 is accepted as a local-only migration package. It is not approved for
  linked, shared, or remote Supabase promotion.
- Phase 2A is accepted as a non-default local foundation. The repository
  boundary, disposable-local Data API integration, live scope revalidation,
  failure classification, and its then-current full 1,317/0 regression evidence
  are complete.
- The compatibility identity fallback identified during review is removed:
  unmapped student sessions cannot mutate seeded student records, missing or
  ambiguous authority returns `403`, and provider/storage outages return
  `503` without alternate-provider fallback.
- Phase 2B database acceptance is complete locally. Static SQL checks, 60
  focused auth/session tests, the portable PGlite lifecycle gate, and the
  corrected migration through native PostgreSQL 17 plus PostgREST 14.14 pass.
  The real Data API run proves the server repository adapter, atomic
  create/revoke, exact replay and conflict rejection, denial with no residual
  write, live branch and relationship refresh, expiry, audit evidence,
  `revoked_by`, and eight PostgreSQL `42501` browser-role denials. The integrated
  gate preserves 1,509/0 portal checks in
  `output/playwright/phase2b-portable-final-20260712/portal-qa-summary.json`.
  This is local-only database acceptance, not remote promotion or runtime
  activation.
- Production Phase 2 is not complete. Memory remains the runtime default, demo
  compatibility remains available under controlled configuration, Supabase
  Auth memory sessions still use the compatibility `app_metadata` role path,
  and normalized sessions cannot access legacy snapshot workflow routes.

The UI V2 shell baseline is accepted. The product owner has explicitly approved
a controlled continuation of **Phase 12 Route-By-Route UI Completion**. This is
not permission for a broad visual rewrite: each slice owns one route family,
preserves its existing workflow and authority boundaries, and must pass visual
review plus the protected portal baseline before the next family begins. The
complete sequence and route inventory live in
`docs/UI_ROUTE_MODERNIZATION_PLAN.md`.

The already-approved **Phase 12 Insight System** remains strictly limited to
shared accessible chart and motion primitives plus one role-specific,
decision-focused insight panel on each portal dashboard and report route. It
must not create analytics walls or dashboard card grids.

The first approved route-modernization slice is **Phase 12A: Super Admin
system workspaces**:

1. `/app/admin/settings` owns global school setup only.
2. `/app/admin/integrations` owns connection readiness and reviewed status
   only.
3. `/app/admin/system-health` owns concise internal health review only.

Phase 12A may change page composition, concise user-facing copy, responsive
layout, semantic visualizations, loading/empty/error/success presentation, and
CSS. It must not change routes, server actions, persistence, auth, RBAC, audit
behavior, provider activation, or the data each action reads or writes. The
primary compatibility workstream remains **bounded compatibility workflow
integrity**, one feature family at a time:

1. Preserve the authenticated session as the server authority for actor, role,
   branch, department, and ownership.
2. Remove client-cache authority leaks before expanding workflow CRUD.
3. Require exact course-run and class-group targets for initial enrollment
   activation; never select a fallback run or group during a write.
4. Require active course, run, branch, teacher identity, teacher profile, and
   staff scope before creating delivery records.
5. Keep registrar status and enrollment mutations inside every affected branch
   scope; reject global mutations that would cross scope.
6. Require valid session state, run dates, active rooms, and room capacity for
   attendance and class scheduling.
7. Add domain and server-authority tests for every invariant, run focused portal
   workflows, then preserve the full 1,634/0 baseline.
8. Do not add live provider integrations, activate normalized production writes,
   or begin broad route UI polish in this workstream.

Counts in the following slice history identify the artifact used when each
slice was accepted. The current protected baseline is defined by
`docs/qa-baseline.md`.

The server projection and client cache authority boundary is complete: scoped
snapshots replace global collections, protected-route hydration fails closed,
and role projections are covered by foreign-record sentinel tests. Admissions
transitions now require exact lead and placement identities, validate scores,
link application and placement into one enrollment workflow, preserve internal
handoff and audit evidence, and expose the linked placement route. These
compatibility workflows are covered by 383 unit tests plus the 1,313/0 portal
artifact dated 2026-07-11.

Branch-scoped class-group creation is now server-authoritative. It requires an
active delivery run, active same-branch room, valid capacity, a conflict-free
schedule, and branch-admin scope; it creates an empty roster, updates the run
teacher assignment, and exposes scoped audit evidence. The route
`/app/branch/classes/new` and its focused browser workflow are part of the
1,313/0 baseline.

Exact course-run creation and class-group update/status transitions are now
server-authoritative. HOD course-run creation is department and branch scoped;
branch class changes preserve the run and roster, enforce room and capacity
constraints, block unsafe completion/cancellation, and project audit evidence.
The focused routes `/app/hod/classes/runs/new` and
`/app/branch/classes/:classGroupId` are included in the 1,313/0 baseline.

Enrollment and roster transitions are now server-authoritative. Registrar or
Super Admin can transfer active or paused enrollments between eligible classes
inside the same run, pause/resume, complete, or cancel with guarded transitions.
The mutation keeps roster membership, aggregate student access, workflow state,
teacher relationship, notification, and audit evidence atomic. Cross-run,
out-of-scope, full-class, inactive-class, incomplete-completion, and terminal
replay attempts are rejected before mutation. The focused registrar routes
`/app/registrar/enrollments/records` and
`/app/registrar/enrollments/records/:enrollmentId` are included in the 1,313/0
baseline.

Class-session lifecycle transitions are now server-authoritative. Branch Admin,
assigned Teacher, or Super Admin can reschedule or cancel an active or pending
class session. The transition atomically updates its calendar and session rows,
enforces run dates, active room, room capacity, teacher availability, schedule
conflicts, and role scope, and writes learner notifications plus scoped audit
evidence. Sessions with attendance are locked so academic history cannot be
silently detached. The route
`/app/branch/schedule/sessions/:sessionId` and its focused browser workflow are
included in the 1,313/0 baseline.

Attendance-exception lifecycle transitions are now server-authoritative. A
student can submit a reason against an exact own absent or late attendance row;
Branch Admin or Super Admin can approve or reject a pending request. Approval
atomically changes the record to excused and recomputes the related enrollment
attendance rate, while rejection preserves the original record. Duplicate
pending requests, cross-student submissions, terminal replay, inconsistent
relationships, and cross-branch reviews are rejected. Student, Teacher, Branch
Admin, HOD, and Super Admin receive scoped exception, notification, or audit
projections. The student attendance request and branch attendance review
workflows are included in the 1,313/0 baseline.

Assignment-publication lifecycle transitions are now server-authoritative.
Creation produces an exact course-run draft. Assigned Teacher, department and
branch-scoped HOD, or Super Admin actions can edit and publish it only while the
delivery run and class are active. Drafts and cancelled rows never reach Student
projections. Cancellation is blocked after submission; closing requires the due
date or a completed submission from every active learner; submitted work and
grades remain intact. Publish, published-cancel, and close transitions notify
active learners and write scoped audit evidence. The focused Teacher create and
detail workflow is included in the 1,313/0 baseline.

Quiz-publication lifecycle transitions are now server-authoritative. Creation
produces an exact course-run draft. Assigned Teacher, department and
branch-scoped HOD, or Super Admin actions can update and publish it only with a
valid question set, future delivery window, and active class. Drafts and
cancelled quizzes never reach Student projections. Attempts are denied before
publication; updates, question-set changes, and cancellation are blocked after
attempts. Closing requires the due date or a reviewed attempt from every active
learner, while attempts and grades remain intact. Publish and close transitions
notify active learners and write scoped audit evidence. The focused Teacher
create, question-attachment, and detail workflow plus Student active and
closed-quiz states are included in the 1,317/0 baseline.

Manual assessment-review finalization is complete as a bounded compatibility
integrity slice. Assigned Teacher, department and branch-scoped HOD, or Super
Admin can finalize an exact pending assignment submission or quiz attempt once.
Missing, malformed, out-of-scope, and already-finalized reviews are rejected
before mutation; successful reviews preserve the result, gradebook, learner
notification, and scoped audit evidence. A manual quiz submission alerts the
assigned Teacher. The focused Teacher review detail and Student result state
are included in the 1,317/0 baseline. This closure does not change the separate
product-owner-directed Nile Forms phase or the Phase 2B durability gate.
Regrade and appeal workflows remain out of scope until a separate approval
defines their history and authority model.

Phase 2B database acceptance is satisfied locally. Runtime session or
persistence activation remains a separate prohibited step until a later
checkpoint proves the complete Supabase Auth, HTTP cookie, multi-instance,
logout, outage, and production-mode boundary.

The accepted Phase 2B evidence proves atomic create/revoke, audit evidence,
idempotent replay, conflict rejection, denial rollback, browser-role denial,
and `revoked_by` through a real local PostgREST boundary.
`npm run check:phase2-session-schema:runtime` now provides portable PostgreSQL
evidence for the enumerated direct-SQL lifecycle, exact replay binding, live
authority, privilege-catalog, direct database-role denial, transaction rollback,
and rollback/reapply invariants. It does not prove managed-project settings,
concurrent advisory-lock behavior, or a managed Supabase environment. The
separate native PostgREST acceptance covers the current real Data API and
repository-adapter boundary.

No live provider connection, production runtime switch, remote schema
application, or broad UI expansion beyond the bounded Phase 12 Insight System
and explicitly approved Phase 13 route family is approved by this checkpoint.

Phase 13A Nile Forms authority and schema foundation is accepted locally. It
adds ADR-006, the feature prompt, permissions, shared bilingual schema and rule
contracts, seven fake templates, and an additive 12-table migration with forced
RLS and no browser policies. Static validation, two PGlite forward applications,
two assertion passes, one rollback drill, TypeScript, and the production build
pass. It has not been applied to Supabase.

Phase 13B Nile Forms online core is accepted locally. The compatibility-runtime
repository boundary, server-derived scope and permission gates, immutable
draft/publish behavior, public and assigned rendering, encrypted drafts,
assignments, submission inbox, one-stage review, CSV export, dedicated one-job
routes, and responsive EN/AR UI are implemented. TypeScript, 34 test files with
427 passing tests, production build, focused browser workflows, and the full
1,317-check portal matrix were executed. Three unrelated long-run legacy
workflow selector misses passed immediately in isolation; the accepted portal
baseline remains unchanged.

Phase 13C registered promotion adapters are accepted as an internal-alpha
foundation for `lead.create`, `application.create`, `placement.create`, support
tickets, and attendance exceptions. Promotions are reviewed, idempotent, and
audited; form answers never write operational tables directly. Existing enquiry,
application, placement, support, and attendance routes remain authoritative
until separate route-by-route parity and cutover approval.

Phase 13D Nile Forms staff-only offline capture is accepted locally. Staff
device enrollment, 72-hour assigned bundles, PBKDF2-HMAC-SHA-256 key derivation,
AES-256-GCM envelopes, encrypted IndexedDB credentials/bundles/answers, the
Forms-only service worker, foreground batch sync, replay receipts,
reauthorization, quarantine, expiry renewal, lock/reset recovery, and restricted
field denial are implemented. A real Branch Admin browser flow enrolled a
device, captured and encrypted an incident response, synchronized it, received
an accepted receipt, and found the immutable offline submission in the scoped
review inbox. Wrong-passphrase denial, EN/AR RTL rendering, and 390, 768, 1024,
1440, and 1920 responsive layouts passed without horizontal overflow.

Phase 13E finite Jotform migration support is accepted locally. A server-only
official-API client uses the `APIKEY` header and allowlisted standard, EU, or
HIPAA endpoints. Super Admin can inspect selected forms, map fields, record a
dry-run hash, commit only an unchanged preview, replay safely, and reconcile
each import record. Imported answers remain pinned to the selected Nile Forms
version, enter review as `legacy_import`, create no promotion or submission
outbox event, and retain source form, submission, payload hash, run, and
reconciliation evidence. A second additive migration brings the Forms total to
14 forced-RLS, service-only tables; two forward applications, two semantic
assertion passes, and the combined rollback drill pass in PGlite. The full local
suite now passes 38 files and 460 tests, TypeScript, production build, and the
expanded frozen-production 1,509-check portal matrix with 0 failures. The source
fingerprint remained unchanged across the complete browser run. Focused
offline, finite-migration, and HOD certificate browser QA also completed with no
console errors.

The Forms authority closure also adds server-resolved assignment directories,
scoped assignment creation and revocation, actionable owner-scope denial states,
and browser evidence for one complete Super Admin assign/revoke cycle. Global
Super Admin templates remain unavailable to Registrar management while scoped
admissions review remains allowed. This does not activate normalized production
writes or any external provider.

ADR-007 and the authority slice for the full Nile Forms replacement program are
accepted. This approval establishes the typed processing boundary and sequence;
it does not approve the program as one broad implementation.

The only approved next Nile Forms implementation slice is **Phase 13F1:
normalized repository contract foundation**:

1. Replace the callback-only repository boundary with explicit query and
   command methods for the already accepted Forms lifecycle.
2. Keep a deterministic memory reference adapter and add a disabled-by-default,
   server-only Supabase adapter backed by bounded RPCs and projections.
3. Add additive local-only SQL, semantic assertions, fake fixtures, complete
   rollback/reapply evidence, and isolated Data API tests.
4. Resolve the hashed server session token in the command transaction and
   revalidate unexpired, unrevoked session, user, active role grant, role,
   canonical action permission, branch, department, ownership, and assignment.
   Lock authority and target rows in a deterministic order shared with
   revocation, and prove both outcomes of concurrent revoke/command races.
5. Give anonymous public submissions a dedicated public command-evidence chain;
   never fabricate a user, session, or role grant for global protected audit.
6. Keep domain, command, and audit evidence atomic. Only successful submission
   and review create outbox events in this slice. Each newly accepted,
   non-quarantined offline item emits exactly one submission event; the sync
   envelope, replayed, rejected, and quarantined items emit none. Promotion
   execution fails closed until its canonical target can join the same
   transaction.
7. Prove the explicit colon-to-dot permission mapping and sensitive-value
   redaction, including export behavior. Add grant-level permission evidence;
   sensitive-read cannot be granted to a whole non-admin role, and sensitive
   values never enter search indexes, audit metadata, logs, or outbox payloads.
8. Make rollback remove only Phase 13F1 objects while preserving all accepted
   Phase 13A-E evidence.
9. Keep memory as the runtime default, normalized production Forms requests
   fail closed, and every route cutover flag disabled.
10. Require immutable one-to-one public command evidence, persisted MACed
    offline bundle authority, durable privacy-preserving public rate limits,
    exact Origin/Fetch-Metadata mutation checks, and a dedicated RPC-only Forms
    execution principal.
11. Keep Phase 13F1 SQL outside pushable migration history and reject every
    non-local or linked database target. A dedicated normalized-persistence flag
    stays off and cannot activate memory or compatibility promotion paths.

Phase 13F1 must not add fields, processing profiles, requests, approvals,
appointments, surveys, uploads, signatures, broad directories, provider
delivery, remote SQL application, or a runtime switch. Those remain later
Phase 14 slices requiring their own checkpoint acceptance.

Phase 13 remains internal alpha: no remote migration was applied, no real
Jotform credential or historical data was used, and no existing intake route
was cut over. Actual selective import still requires an approved mapping
window, temporary key, reconciliation sign-off, Jotform intake shutdown, and
key revocation.

The Phase 13F1 checkpoint is the only approved next **Nile Forms** slice. The
separately approved Phase 12 Insight and Moodle sandbox workstreams may proceed
only with disjoint write sets. Changes to shared session, permission, audit,
outbox, migration-history, or server-runtime boundaries are serialized through
the execution contract and must preserve every accepted gate.

### Approved Moodle Sandbox Slice

The product owner has approved one bounded Moodle sandbox slice against
`moodle-no-data.enesekremergunesh.com`. This approval is limited to capability
discovery and a disabled-by-default, server-only, read-only client/probe:

1. Do not store the supplied administrator username or password in the
   repository, environment examples, fixtures, logs, or provider records.
2. Use a dedicated minimum-privilege Moodle service account and custom REST
   service before any live Nile Learn runtime call. An administrator or mobile
   application token is not an integration credential.
3. Keep Moodle writes, course creation, enrolment changes, grade changes,
   messages, attendance writeback, and file transfer disabled.
4. Keep provider projection persistence disabled until normalized repository
   and reconciliation prerequisites are accepted.
5. Implement and test only the server client, capability probe, safe status
   endpoint, strict read-function allowlist, timeout/error behavior, and
   Super-Admin authority boundary in this slice.
6. Keep the client mock projection and all portal behavior unchanged until a
   later mapping/projection slice is approved.

The detailed sandbox evidence, function allowlist, rollout plan, and stop
conditions live in `docs/MOODLE_INTEGRATION_EXECUTION_PLAN.md`. This bounded
foundation does not advance the production Phase 6 projection gate or authorize
any remote Nile Learn database change.

M0 discovery and the disabled M1 server boundary are accepted locally. The M1
client rejects protocol-field overrides, broad service surfaces, private or
unapproved destinations, unbounded responses, provider-controlled error text,
and requests that exceed the DNS-plus-HTTP timeout. It pins the validated
public address to the actual TLS socket. Two read-only reviews found no
remaining high or medium issue, 16 focused Moodle tests pass, and the complete
repository gate preserves 1,509/0 in
`output/playwright/moodle-read-foundation-20260712/portal-qa-summary.json`.

The product owner's 2026-07-12 end-to-end sandbox testing instruction approves
M2 for the dedicated practice site only. M2 may enable the installed Web
services authentication method and create one synthetic non-interactive
service user, minimum-capability role, authorised-users-only custom read
service, expiring token, and synthetic course/user/activity dataset. No real
student data may be used. Student photos, passports, national IDs, guardian
documents, consent, addresses, and admissions notes remain Nile Learn-only and
must never be projected to Moodle. The supplied administrator credential must
never become a Nile Learn runtime credential.

This approval does not activate M3 persistence, a production runtime flag,
Moodle writes from Nile Learn, or any remote Nile Learn database change. The
token may be used only from the local command environment for live contract
verification and must be revoked if the minimum-privilege boundary fails.

The product owner's 2026-07-13 instruction separately approves **M2B synthetic
sandbox write proof**. ADR-008 owns this bounded exception. M2B must use a
separate authorised-users-only service, service user, expiring token,
configuration namespace, and exact eleven-function surface. The eleventh
function is a marker-only user lookup required to reconcile a synthetic user
before enrolment makes it visible to the separate course-scoped read service.
It may mutate only one marker-bound fake user, that user's manual enrolment in
the existing synthetic course, and one marker-bound group plus membership. It
must reconcile before retry, prove replay without duplication, clean up in
dependency order, and leave the M2 read result unchanged. It may not add a
portal route, runtime flag, database write, outbox worker, production
credential, real identity, course or activity write, grade, message,
attendance writeback, or file transfer.

M2B is provider-contract evidence, not Phase 10 acceptance. Production Moodle
writes remain blocked on normalized mappings, durable command/audit/outbox
transactions, worker leases and retry behavior, reconciliation approval, RLS,
and a separate production threat review.

The bounded M2B proof completed on 2026-07-13. The final run preserved an
identical M2 read-projection hash, adopted the same synthetic records on its
second ensure pass, removed every created record, and ended with a rejected
write token after provider teardown. The redacted evidence is recorded in
`docs/moodle-m2b-write-proof-evidence-20260713.md`.

The product owner's 2026-07-13 follow-up instruction approves **M2C
comprehensive synthetic Moodle provider-contract testing** on the same dedicated
practice host. ADR-009 owns this approval. M2C must run as separate
minimum-privilege lanes for read closure, disposable content fixtures, learner
interactions, outcomes, limited operations evidence, and authority denials.
Every lane requires a distinct expiring token, exact function allowlist,
deterministic fake-only marker, before and after fingerprints, reconciliation,
idempotent cleanup, and credential teardown. It may not use real identities,
student documents, production content, a shared broad token, portal actions,
normalized persistence, Supabase changes, or a runtime provider flag.

M2C is sandbox provider evidence only. Attendance, Nile scheduling, internal
messaging, certificates, admissions documents, and audit remain Nile Learn
authorities even when a similar Moodle API exists. The first M2C implementation
slice is read-contract closure: add sanitized provider-neutral models for the
six approved H5P, SCORM, and Resource functions, route every live read-validator
response through its model, then create the missing disposable fixtures and
re-run all 31 reads. Broader learner and outcome writes begin only after that
slice is green and its credential teardown is recorded.

The 2026-07-13 M2C-R run remains historical partial evidence. The resumed
2026-07-16 run closed its H5P/SCORM fixture gaps, passed all 31 reads twice,
restored the disposable sandbox surfaces, and completed credential teardown.
The accepted closure evidence is
`docs/moodle-m2c-read-closure-evidence-20260716.md`. Broader M2C loops remain
gated by Program Phase 3 ownership acceptance.
