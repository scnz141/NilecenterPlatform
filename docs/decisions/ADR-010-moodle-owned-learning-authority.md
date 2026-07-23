# ADR-010: Moodle-Owned Learning Authority

- Status: Accepted
- Date: 2026-07-23
- Supersedes: ADR-001 and ADR-003 where Moodle-owned learning writes are concerned

## Context

Nile Learn had begun creating native lesson, resource, assignment, quiz,
question, progress, grade, and feedback records while also projecting the same
families from Moodle. That creates conflicting authority and makes later
reconciliation unsafe. The legacy evidence and writable sandbox confirm that
Moodle already owns these learning structures.

## Decision

Moodle is the sole writable authority for course learning content, sections,
lessons, resources, assignments, submissions, quizzes, question banks,
attempts, completion, grades, and feedback.

Nile Learn remains authoritative for admissions, programs and levels,
offerings, class groups, teacher allocation, rosters, schedules, rooms,
attendance, finance, communication, certificates, RBAC, audit, mappings,
commands, and reconciliation evidence.

Each Nile class maps to one isolated Moodle delivery course cloned from an
HOD-approved, versioned Moodle template. New classes clone the current approved
version. Existing delivery courses are never destructively updated without an
explicit preview and approval.

Nile Learn may:

1. display sanitized, server-authorized Moodle projections;
2. enqueue narrowly typed and idempotent Moodle commands after the command
   packages pass sandbox gates;
3. open short-lived authenticated Moodle launches for complex native editors
   and student attempts.

Nile Learn may not create a parallel writable learning record. Attendance
continues to be canonical in Nile Learn.

## Command Boundary

Controlled Moodle commands require:

- exact internal and external mappings;
- an authenticated Nile actor and mapped Moodle actor;
- target-context capability verification;
- an idempotency key, request hash, and expected provider version;
- atomic Nile audit and outbox evidence;
- read-back verification and reconciliation before retry after an unknown
  provider outcome.

The planned versioned `local_nilelearn` Moodle plugin exposes only reviewed,
allowlisted operations. The service identity is transport authority only; it
does not replace the mapped actor's Moodle capability.

## Phase 6J Boundary

Phase 6J corrects ownership, rejects normalized native learning writes, and
enriches safe read projections. It does not install the plugin, enable a Moodle
worker, expose provider tokens, or activate production Moodle writes.

## Phase 6K Boundary

Phase 6K establishes the versioned `local_nilelearn` capability manifest, the
exact server-side command envelope, and durable database evidence for a future
provider command. The package requires exact actor and target mappings and an
atomic successful command, immutable audit row, and outbox event. Provider
attempts are immutable, and unknown outcomes move to reconciliation rather
than being retried blindly.

Phase 6K remains manual and unapplied. It exposes no browser or public command
RPC, grants no runtime role direct table access, installs no Moodle plugin,
starts no worker, reads no credential, and performs no provider write. Those
capabilities require separate reviewed slices and sandbox evidence.

ADR-011 supplies the product authorization for full synthetic Moodle sandbox
CRUD. The next slices may implement and exercise every allowlisted Moodle-owned
operation in the sandbox, but production portal activation still requires the
plugin, worker, actor-capability proof, audit/outbox evidence, reconciliation,
and operation-family acceptance gates.

## Consequences

- The normalized native-assignment SQL package is retired and excluded from the
  manual Supabase bootstrap.
- Compatibility snapshot learning actions remain temporarily available only to
  protect migration and existing QA; they are not production authority.
- Raw Moodle URLs, tokens, and private file URLs never enter browser payloads.
- Provider files require a separately reviewed, session-authorized proxy with
  Moodle access checks and byte-range support.
- Reports and certificate eligibility must fail closed when required Moodle
  outcomes are stale, missing, or conflicted.

## Rollback

Disable Moodle command flags and workers, preserve the last verified projection
as stale, stop launches, and reconcile unknown provider outcomes. Do not restore
native learning writes.
