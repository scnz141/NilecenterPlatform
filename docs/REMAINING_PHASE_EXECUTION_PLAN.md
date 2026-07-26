# Nile Learn Remaining Phase Execution Plan

## Purpose

This document is the code-grounded execution roadmap for moving Nile Learn from
its current internal-alpha foundations to a production-ready platform.

It does not approve every future phase. The only authoritative current
checkpoint and approved implementation slice remain in
`docs/NILE_LEARN_MASTER_PLAN.md` under **Current Modernization Checkpoint**.
After a phase passes its gate, that checkpoint must be updated before the next
phase starts.

The plan is intentionally sequential:

1. research the current slice;
2. specify its authority, scope, and acceptance;
3. implement the smallest complete boundary;
4. verify positive, denial, replay, failure, and recovery behavior;
5. record evidence;
6. review and fix;
7. update the master checkpoint;
8. start the next approved slice.

No phase may be declared complete from UI appearance, local success state, or
unit tests alone.

## Code-Grounded Starting Point

The repository does not have a simple numeric backlog. Some later local
foundations were accepted while production authority remains disabled.

| Master phase | Current position                                          | Required treatment                                                                                         |
| ------------ | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 0            | Accepted                                                  | Preserve authority decisions and evidence.                                                                 |
| 1            | Accepted local schema foundation                          | Do not apply to production without a separate promotion gate.                                              |
| 2A/2B        | Accepted local repository and durable-session foundations | Production runtime activation remains incomplete.                                                          |
| 3            | Partial                                                   | Compatibility snapshots remain the default for several reads.                                              |
| 4            | Compatibility workflows are broad                         | Normalized admissions and student lifecycle are not fully authoritative.                                   |
| 5            | Compatibility workflows are broad                         | Normalized delivery, schedule, capacity, and history are not fully authoritative.                          |
| 6A-6I        | Accepted projection and isolated-staging foundations      | Keep read-only and fail-closed.                                                                            |
| 6J           | Authority correction accepted                             | Moodle owns learning content and outcomes.                                                                 |
| 6K           | Durable command contract accepted locally                 | Manual and runtime-disabled.                                                                               |
| 6L           | Active                                                    | Local foundation exists; live plugin, staging, CRUD, launch, cleanup, and attestation gates remain.        |
| 7-11         | Planned                                                   | Re-audit after each preceding authority gate; do not assume compatibility behavior is production-complete. |
| 12A-12G      | Accepted UI route modernization                           | Revisit only routes whose authoritative workflow changes.                                                  |
| 13A-13F1     | Accepted local Forms foundations                          | No new Forms slice is approved.                                                                            |
| 14A-14B      | Accepted local typed content and Requests foundations     | No next typed module is approved.                                                                          |

The current protected portal baseline is defined by `docs/qa-baseline.md`. The
master checkpoint records the currently accepted count and evidence. This file
must not become a second status ledger.

## Phase Transition Contract

Every phase uses the same mandatory packet.

### 1. Discovery Packet

- Read the current master checkpoint, authority ADRs, ownership matrix, feature
  freeze, routes, repositories, server actions, tests, and latest evidence.
- Trace one representative workflow from browser route to server authority,
  database or provider, audit/outbox evidence, and affected role projections.
- Identify compatibility, demo, memory, local-storage, disabled-provider, and
  placeholder branches.
- Record exact invariants, current failures, external prerequisites, and data
  cleanup obligations.
- Confirm the phase does not duplicate an already accepted local foundation.

### 2. Phase Specification

Before implementation, define:

- one bounded business outcome;
- data authority and source of truth;
- role and scope matrix;
- typed commands and read models;
- state transitions and immutable history;
- failure, retry, conflict, stale, denied, and unavailable behavior;
- routes and page owners;
- SQL or provider changes;
- test and rollback plan;
- explicit exclusions.

### 3. Implementation

- Keep browser payloads closed and typed.
- Derive actor, active role, branch, department, ownership, and provider
  mappings from the authenticated server session.
- Persist authoritative changes, audit evidence, and outbox work atomically.
- Require idempotency and expected versions for mutations.
- Fail closed when authority, mappings, freshness, or providers are missing.
- Do not allow local state to report success before the server confirms it.

### 4. Acceptance Evidence

Each phase must prove:

- allowed role success;
- every relevant role and cross-scope denial;
- replay and payload-hash conflict;
- concurrency or expected-version conflict;
- provider/database outage behavior;
- interrupted operation and recovery;
- audit and outbox evidence;
- rollback/reapply where SQL changes exist;
- cleanup and credential teardown for synthetic provider work;
- focused browser QA and the complete protected portal gate.

### 5. Documentation Closeout

Update only the document that owns the changed rule:

- `docs/NILE_LEARN_MASTER_PLAN.md`: accepted status and next approved slice.
- `docs/INTEGRATION_STABILIZATION_PROGRAM.md`: provider sequence and evidence.
- `docs/integration-ownership-matrix.json`: endpoint and authority ownership.
- `docs/integration-feature-freeze.json`: frozen or replaced behavior.
- `docs/qa-baseline.md`: only after a complete accepted portal run.
- `docs/decisions/ADR-*.md`: authority or irreversible architecture decision.
- `.codex/prompts/*.md`: bounded feature acceptance contract.
- `AGENTS.md`: durable command or engineering guidance, not changing status.

Every accepted phase receives a redacted artifact under
`docs/qa-attestations/`. Secrets, tokens, personal data, and raw provider
errors must never appear in evidence.

## Sequential Execution Queue

### Execution 1: Phase 6L Local Closure

**Main job:** complete everything that can be proven locally without claiming a
live Moodle installation or remote staging acceptance.

#### Research

- Reconcile the active worktree against Phase 6K evidence and ADR-011.
- Verify the 19 command operations and six launch kinds have one canonical
  manifest and one server handler each.
- Inspect draft-file creation and Moodle file-area requirements for PDF, image,
  audio, video, and general resources.
- Trace command creation, lease, attempt, terminal state, reconciliation, file
  authorization, and launch consumption.
- Identify every portal control that currently implies Moodle write ability.

#### Implementation

- Finish deterministic draft-upload mapping and checksum/MIME/size validation.
- Complete a local provider simulator or fixture adapter for all command
  families so server lifecycle behavior can be tested without a live plugin.
- Add role-scoped command and launch availability DTOs. Unavailable operations
  must render an honest unavailable state, not a false success control.
- Complete command status, reconciliation, launch, file-range, replay,
  interruption, and cleanup tests.
- Keep `MOODLE_COMMANDS_ENABLED`,
  `NILE_MOODLE_COMMAND_RUNTIME_ENABLED`, and normalized projection activation
  disabled by default.

#### Primary code

- `integrations/moodle/local_nilelearn/`
- `server/moodleCommandContract.ts`
- `server/moodleCommandRuntime.ts`
- `server/moodleCommandRepository.ts`
- `server/moodleCommandService.ts`
- `server/moodleCommandProvider.ts`
- `server/moodleCommandRoutes.ts`
- `server/moodleFileAccess.ts`
- `client/src/pages/platform/MoodleCourseContentPage.tsx`
- `client/src/lib/moodle/`
- `supabase/manual/027_phase6k_moodle_command_contract.sql`
- `supabase/manual/028_phase6l_moodle_command_runtime.sql`
- Phase 6L validators and package scripts

#### Gate

- `npm run verify:phase6l-fast`
- `npm run check`
- `npm test -- --run`
- `npm run build`
- focused Moodle route QA
- unfiltered `scripts/verify.sh`

The closeout evidence must say **local closure**, not Phase 6L acceptance, while
the host and staging prerequisites remain unavailable.

### Execution 2: Phase 6L Live Sandbox And Isolated-Staging Acceptance

**Prerequisites:**

- authorized host-level Moodle plugin installation or writable plugin
  deployment path;
- a dedicated least-privilege Moodle service identity;
- pinned isolated-staging Data API and pooler credentials for
  `xvgsypaatibntfocvvxn`;
- synthetic-data marker and cleanup approval;
- production project guards.

Production project `lkvyhevoommqnpwwmqgp` is prohibited in this execution.

#### Research

- Record Moodle version, enabled plugins, service allowlist, capability
  assignments, and pre-run fingerprint.
- Verify the plugin ZIP hash against source.
- Verify the staging SQL inventory and confirm retired package `026` is absent.
- Confirm every synthetic record can be identified and cleaned in dependency
  order.

#### Implementation And Proof Order

1. Install `local_nilelearn` disabled and verify the manifest.
2. Apply Phase 6K/6L packages to isolated staging and prove browser-role denial.
3. Accept delivery-course clone/read/update/archive/restore/safe-delete.
4. Accept sections, ordering, and visibility.
5. Accept pages, books, URLs, PDF, image, audio, video, and resources.
6. Accept assignment, quiz shell, and question-bank operations.
7. Accept grade, feedback, and completion operations.
8. Accept all six single-use native launch kinds.
9. Prove timeout, unknown outcome, reconciliation, provider outage, replay,
   payload conflict, and interrupted-worker recovery.
10. Clean every marker-bound record twice, remove temporary services/tokens,
    prove retired-token denial, and verify the final fingerprint.
11. Roll back and reapply isolated staging.

#### Gate

Phase 6L is accepted only when all 19 operations, all six launches, file-range
delivery, role denials, cleanup, token retirement, staging rollback/reapply,
full validation, and a redacted Phase 6L attestation pass.

If the host or staging prerequisite is still unavailable, stop here. Do not
fake the proof and do not activate production writes.

### Execution 3: Phases 2 And 3 Production Authority Cutover

**Main job:** make durable session and normalized repository authority the
universal production foundation before expanding role workflows.

#### Research

- Trace login, cookie session, role selection, live scope refresh, logout,
  expiry, revocation, and multi-instance behavior.
- Inventory every compatibility snapshot read and every normalized repository
  flag.
- Confirm client storage is limited to locale, harmless UI preferences, and
  recoverable drafts.
- Build read-parity fixtures for each role before changing runtime defaults.

#### Implementation

- Promote reviewed identity, role grant, scope, session, audit, outbox, and
  mapping SQL through staging gates.
- Enable durable sessions with fail-closed outage behavior.
- Make normalized read repositories authoritative one family at a time.
- Remove production demo-user and snapshot merging.
- Preserve a read-only compatibility adapter only during measured parity.
- Never convert `403`, `409`, or `503` into logout.

#### Primary code

- `server/auth.ts`
- `server/sessionRepository.ts`
- `server/runtimeProfile.ts`
- `server/platformRepository.ts`
- `server/normalizedWorkflowRepository.ts`
- `server/routes.ts`
- `client/src/lib/auth/session.ts`
- `client/src/components/platform/ProtectedRoute.tsx`
- Phase 1/2 SQL and runtime validators

#### Gate

- real staging HTTP cookie lifecycle;
- multi-instance resolve/revoke;
- live branch/department/ownership refresh;
- no workflow authority in local storage;
- compatibility/normalized read parity;
- RLS allow and denial evidence;
- rollback/reapply;
- full validation and portal QA with newly created normalized users.

### Execution 4: Phase 4 Normalized Admissions And Student Lifecycle

**Main job:** make the complete student journey authoritative in normalized
persistence.

#### Research

- Trace lead, application, placement, student, guardian, enrollment, course
  run, class group, teacher, payment, and portal activation relationships.
- Inventory correction, duplicate, transfer, pause, cancellation, completion,
  minor/guardian, and branch-scope rules.
- Identify every compatibility action that mutates more than one aggregate.

#### Implementation Order

1. Lead and application creation/correction.
2. Placement booking, result, level decision, and replay rules.
3. Student identity/profile and guardian relationships.
4. Enrollment creation with exact course run and class group.
5. Transfer, pause, resume, cancel, complete, and activation.
6. Internal invoice/payment linkage without external payment processing.
7. Student portal projection from current enrollments only.
8. Moodle provisioning command creation after Nile enrollment commits.

#### Primary code

- `client/src/lib/domain/types.ts`
- `client/src/lib/domain/actions.ts`
- `client/src/lib/domain/modules.ts`
- `server/normalizedWorkflowRepository.ts`
- `server/routes.ts`
- `client/src/pages/platform/RegistrarAdmissionsPage.tsx`
- `client/src/pages/platform/RegistrarStudentsPage.tsx`
- `client/src/pages/platform/RegistrarEnrollmentsPage.tsx`
- `client/src/pages/platform/RegistrarEnrollmentRecordsPage.tsx`
- student workspace and records pages
- normalized student/enrollment SQL and tests

#### Gate

A newly created normalized student must move from source record to active
portal with exact branch, level, course, class, teacher, timetable, attendance,
and learning mappings. Cross-branch, duplicate, missing-target, full-class,
terminal-replay, and partial-transaction tests must fail safely.

### Execution 5: Phase 5 Normalized Delivery And Scheduling

**Main job:** make course offerings, classes, assignments, rooms, recurrence,
sessions, conflicts, and membership history authoritative.

#### Research

- Separate Moodle course-template authority from Nile program, level,
  offering, class, teacher, room, and timetable authority.
- Inventory free-form schedules and duplicated teacher assignments.
- Define timezone, holiday, cancellation, substitute, capacity, availability,
  and conflict rules.

#### Implementation Order

1. Program, level, offering, and version relationships.
2. Course run and class-group lifecycle.
3. Teacher assignment history and substitute periods.
4. Room lifecycle and capacity.
5. Recurrence and generated class sessions.
6. Teacher, room, student, branch, holiday, and run-date conflicts.
7. Conflict review, override authority, and immutable resolution evidence.
8. Moodle delivery-course provisioning status and mapping.

#### Primary code

- domain types/actions/modules
- normalized workflow repository
- Registrar, HOD, Branch, and Admin schedule/class pages
- attendance and calendar workflows
- scheduling SQL, conflict tests, and portal workflows

#### Gate

The same class/session mutation must produce identical deterministic conflict
results through domain, API, database, and UI paths. No overlapping teacher,
room, or student schedule may be silently accepted.

### Execution 6: Phase 7 Teacher Operations

**Main job:** make the teacher portal an exact assigned-class command center.

#### Research

- Derive teacher access from active class assignment history.
- Separate Nile attendance/schedule operations from Moodle learning content and
  outcomes.
- Define student progress, intervention, grade release, correction, and
  moderation visibility.

#### Implementation Order

1. Assigned classes, sessions, rosters, and student detail.
2. Availability and substitute assignment.
3. Nile session attendance and notes.
4. Moodle content projection and supported command availability.
5. Assignment/quiz launches, outcomes, released grades, and feedback.
6. Student progress and intervention records.
7. Teacher reports from authoritative data.

#### Gate

Teacher unrelated-class and unrelated-student reads and writes must be denied
at API, repository, database, Moodle command, file, and launch boundaries.
Every teacher change must appear correctly in the affected student, HOD,
Branch, and audit projections.

### Execution 7: Phase 8 HOD And Branch Governance

**Main job:** complete academic governance and branch operations without
crossing department or branch scope.

#### HOD order

1. Department course and template governance.
2. Curriculum release/version review.
3. Teacher workload and class-progress definitions.
4. Assessment moderation and released-outcome review.
5. At-risk learner and completion review.
6. Certificate eligibility, approval, rejection, and revocation request.

#### Branch order

1. Branch users, classes, rooms, and schedules.
2. Teacher availability and substitute coverage.
3. Conflict and capacity review.
4. Attendance exceptions.
5. Internal finance overview.
6. Branch reports and exports.

#### Gate

Department and branch isolation must pass direct API, repository, RLS, provider
projection, report, export, and browser tests. Every approval or override must
carry actor, reason, before/after state, and version.

### Execution 8: Phase 9 Super Admin And Reconciliation

**Main job:** make global administration a safe control plane.

#### Implementation Order

1. Users, invitations, status, and session revocation.
2. Roles, permissions, branch scope, and department scope.
3. Branches, departments, programs, levels, and platform settings.
4. Moodle mappings, manifest, command queue, failures, and reconciliation.
5. Storage, email, migration, and provider health.
6. Immutable audit and system reports.

#### Gate

- no generic untyped save action;
- every sensitive mutation has explicit permission and validation;
- before/after audit evidence is immutable;
- integration health comes from server evidence;
- secrets and raw provider errors never reach browsers;
- normalized Super Admin users can complete every accepted control-plane task.

### Execution 9: Phase 10 Controlled Moodle Activation

**Main job:** activate only the Phase 6L families already accepted in sandbox
and isolated staging.

#### Activation Order

1. read-only projections;
2. user mapping and provisioning;
3. enrollment and group membership;
4. delivery-course clone;
5. sections and content;
6. assessments and outcomes;
7. native launches;
8. authorized file delivery.

Each family has an independent server flag, queue observation period, rollback,
and reconciliation threshold. Production writes require a new cutover decision,
least-privilege production service identity, credential rotation, backup,
rollback evidence, and security review.

#### Gate

No unresolved unknown outcomes, stale required mappings, cross-scope events, or
cleanup failures. Disable and rollback must preserve Nile operational records
and Moodle learning history.

### Execution 10: Phase 11 Finite Legacy EMS Migration

**Main job:** migrate validated legacy records once and retire the source.

#### Prerequisites

- official API, database export, or immutable CSV/JSON export;
- agreed source cutoff;
- field dictionary and ownership;
- business owner for ambiguous matches and finance totals.

#### Implementation Order

1. Inventory and source hashes.
2. Versioned import adapters.
3. Dry run and quality report.
4. Identity and relationship matching.
5. Human-approved exception resolution.
6. Approved import.
7. Final delta and cutover.
8. Rollback window.
9. Credential and source-write retirement.

Browser automation and staff credentials are not production migration
connectors. There is no recurring EMS sync or writeback.

#### Gate

Approved counts, relationships, balances, schedules, sampled records, source
hashes, exception decisions, replay, rollback, and credential retirement must
match.

### Execution 11: Phase 12 Residual UI Completion

The accepted 12A-12G route modernization is not rebuilt. Reopen only routes
whose authoritative workflow changed in Executions 3-10.

#### Order

1. app shell and navigation regressions;
2. one reference dashboard per role;
3. list routes;
4. detail routes;
5. create/edit flows;
6. reports and reconciliation;
7. settings and health;
8. classroom-board and media views.

#### Gate

One page has one main job. Verify loading, empty, missing, denied, stale,
conflict, queued, retrying, failed, offline, and success states at 390, 768,
1280, 1440, 1728, 1920, and 2560 pixels, plus Arabic and Urdu RTL, keyboard,
focus, contrast, and no horizontal overflow. Manual QA uses only the Codex
in-app Browser.

### Execution 12: Phases 13 And 14 Future Forms Work

The accepted Forms and typed Requests foundations remain frozen. Do not add
Approvals, Appointments, Surveys, Applications, uploads, signatures, payments,
webhooks, or provider actions without an explicit product decision and new
bounded checkpoint.

When approved, each typed module must independently prove authority, immutable
source evidence, state transitions, idempotency, concurrency, privacy,
rollback, responsive UI, and the protected portal baseline.

## Production Readiness Gate

The platform moves from internal alpha toward beta only when:

- normalized repositories and durable sessions are authoritative;
- no protected workflow depends on memory, snapshots, seeded records, or
  browser storage;
- role, branch, department, class, enrollment, and ownership scopes are
  enforced server-side and by RLS where applicable;
- all accepted commands are typed, versioned, idempotent, audited, and
  recoverable;
- Moodle authority and Nile authority do not conflict;
- provider outages and stale projections fail closed;
- backups, restore, rollback, monitoring, queue health, and reconciliation are
  proven;
- newly created normalized users complete cross-role browser workflows;
- the complete unfiltered validation and protected portal QA pass;
- production activation has a separate reviewed cutover decision.

## Immediate Next Action

Phase 6L local closure and the bounded non-Moodle work in Phases 7 through 10
are accepted locally.

- Phase 7 includes teacher-owned weekly availability and durable,
  exact-class-scoped learner interventions. Substitute assignment history
  remains a later normalized persistence slice.
- Phase 8 includes defined Nile-owned HOD operational metrics and durable branch
  schedule-conflict review. Moodle-owned curriculum, assessment, and outcome
  metrics fail closed until fresh normalized projections are active.
- Phase 9 includes a safe, server-derived Super Admin Moodle command queue. It
  exposes no payloads or credentials and offers no mutation while the provider
  runtime is deferred.
- Phase 10 preserves fail-closed runtime activation and responsive handling for
  every changed route. The broader route-by-route UI program remains ongoing.

The Moodle plugin host installation remains a separate deferred prerequisite
because `/var/www/html/local` is not writable. Do not bypass that host
boundary. Live synthetic CRUD, native launches, isolated-staging promotion,
rollback/reapply, and production activation remain unaccepted.

The next local work must be selected as one bounded, server-authoritative
workflow or one UI route family. It must not claim Moodle completion or enable a
provider until the deferred Phase 6L host and staging gates pass.
