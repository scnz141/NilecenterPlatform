# Nile Learn Production Persistence Plan

## Purpose

This document governs the move from snapshot/demo persistence toward production
Supabase/Postgres persistence. Phase 1 now has a local-only migration, RLS
contract, rollback, assertions, and fake seed; it does not change application
runtime behavior or authorize remote application or external integrations.

The detailed table design draft remains in `docs/production-persistence-architecture.md`. `docs/NILE_LEARN_MASTER_PLAN.md` is the authoritative phase sequence; this file summarizes its persistence-specific gates and must not define a competing rollout order.

## Current Snapshot

Current runtime persistence is intentionally conservative:

- `server/platformRepository.ts` owns the repository boundary.
- The default repository stores one denormalized `PlatformState` snapshot.
- Local fallback writes to `.local-data/platform-state.json`.
- Optional Supabase snapshot mode writes the same denormalized state to `SUPABASE_PLATFORM_STATE_TABLE`.
- Optional repository events write to `SUPABASE_PLATFORM_EVENTS_TABLE`.
- `server/platformState.ts` is the server-side workflow gate: it derives the actor from the session, checks role and scope, applies domain mutations, writes the next snapshot, and records audit/event evidence.
- `server/auth.ts` supports Supabase password sign-in when configured, but demo auth and memory-backed sessions are still part of the alpha flow.
- `server/sessionRepository.ts` owns the asynchronous session repository,
  memory default, and non-default Supabase durable adapter.
- `server/sessionStore.ts` is a compatibility re-export only.
- `client/src/lib/domain/store.ts` may cache demo/scoped state locally, but client state is not an authorization boundary.

Current Supabase posture:

- Supabase browser config accepts only public browser keys through `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, or `VITE_SUPABASE_ANON_KEY`.
- Server Supabase REST calls require server-only credentials through `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY`.
- The reviewed Phase 1 SQL is promoted locally as
  `supabase/migrations/20260710053837_phase1_identity_scope_session_audit_mapping.sql`.
- The migration and fake-only seed pass static, PGlite, disposable local
  Supabase reset, assertion, rollback, reapply, and database-lint gates.
- The non-default session adapter has a disposable-local PostgREST gate for
  create, hashed-token storage, atomic resolve, expiry, live scope refresh,
  revocation, and browser-role denial. Corrected-migration database acceptance
  remains open under the current master-plan checkpoint.
- The migration is not applied to the linked or any shared Supabase project.
- Normalized Supabase/Postgres tables and complete RLS policies are not yet the production source of truth.
- Memory-backed Supabase Auth sessions still derive compatibility roles from
  server-validated `app_metadata`; this is not the normalized production
  authority model.
- Durable normalized sessions intentionally receive `503` for legacy snapshot
  workflow reads and writes until normalized workflow repositories exist.

## Target Authority Model

Production must be server-authoritative for:

- identity, roles, permissions, branch scope, and department scope
- authenticated session state and session expiry
- protected route data and scoped reads
- user, student, staff, branch, department, course, class, and roster records
- admissions lifecycle records
- attendance, assignment, quiz, grade, certificate, and Quran review records
- invoices and internal payment records
- messages, notifications, communication logs, report presets, and settings
- audit logs and sensitive action evidence

The browser must not be authoritative for:

- actor identity
- active role
- permissions
- branch or department scope
- ownership checks
- payment state
- certificate state
- grade or attendance state
- service keys or external provider secrets

## Target Normalized Schema Groups

Use `docs/production-persistence-architecture.md` as the source for table-level detail. The migration should be grouped by product boundary:

1. Identity and access: app users, roles, permissions, staff profiles, branch scopes, department scopes.
2. Organization: branches, departments, department branch coverage.
3. Academic catalog: programs, levels, courses, modules, lessons, resources.
4. Classes and scheduling: course runs, class groups, rosters, sessions, calendar events, availability, rooms, meeting placeholders.
5. Admissions and students: leads, applications, placement tests/results, student profiles, enrollment workflows, enrollments.
6. Assessments and learning: lesson progress, assignments, submissions, quizzes, question bank, attempts, grades.
7. Attendance: attendance records with class/session/student uniqueness.
8. Finance: packages, discounts, invoices, internal payment records.
9. Certificates: approval, issue, verification, revocation state.
10. Quran: memorization plans, progress records, recitation submissions.
11. Communication: messages, communication logs, templates, notifications, support tickets.
12. Governance: report presets, audit logs, settings, integration configuration placeholders.

## RLS Plan

RLS should be implemented only with normalized tables and indexed authority columns. Phase 1 base tables are server-only: browser roles receive no direct table grants or policies. Later browser-readable projections require a separate accepted decision and active-session-safe scope design.

Global rules:

- Enable RLS on every application table exposed through Supabase APIs.
- Revoke direct `anon` and `authenticated` access to Phase 1 base tables.
- Resolve identity and the one active role grant through the opaque Nile application session in the server layer.
- Resolve role/scope from server-owned tables, not Auth claims or user-editable metadata.
- Use `USING` and `WITH CHECK` policies for writable tables.
- Index all foreign keys and every policy predicate column.
- Keep service credentials server-side only.
- Write audit logs through server-side repository/actions, not direct browser inserts.

Role rules:

- Student: own profile, enrollments, classes through enrollment, own learning records, own attendance, own grades, own certificates, own messages, own Quran progress.
- Teacher: assigned course runs/classes, rosters through assigned classes, attendance/grading/Quran review only for assigned students.
- Registrar: admissions, placement, students, enrollments, and internal payment follow-up within branch/admissions scope.
- HOD: academic records, teachers, classes, assessments, and certificate approval within department/branch scope.
- Branch admin: branch people, rooms, schedules, attendance exceptions, payments, and reports within branch scope.
- Super admin: global governance with audit logging for sensitive writes.

Anon/public access should be limited to intentional public read models, public intake endpoints, and certificate verification by code through a controlled endpoint or tightly scoped view.

## Repository Interface Plan

The repository boundary should evolve without breaking current portal behavior.

Current interface:

- `readSnapshot()`
- `writeSnapshot(state)`
- `recordEvent(input)`

Target interface direction:

- `getScopedState(session)`
- `runAction(action, session)`
- `writeAudit(input)`
- `createUser(input, actor)`
- `updateUserScope(input, actor)`
- `saveAttendance(input, actor)`
- `gradeSubmission(input, actor)`
- `reviewQuizAttempt(input, actor)`
- `approveCertificate(input, actor)`
- `recordPayment(input, actor)`
- `savePortalSettings(input, actor)`

Do not expose table names to page components. Pages and workflow components continue to call domain actions/server actions. A workflow has one writable authority at a time; compatibility projections may be compared but are not independently writable.

## Migration Phases

The canonical sequence is defined in `docs/NILE_LEARN_MASTER_PLAN.md`:

1. **Phase 0 - Authority and baseline:** approve ADRs, preserve the accepted portal QA baseline, and resolve ownership conflicts.
2. **Phase 1 - Identity, organization, audit, and mapping schema:** prove the additive migration, rollback, indexes, browser denials, command evidence, and fake fixtures on a disposable database.
3. **Phase 2 - Durable authentication and scope authority:** map Supabase Auth exactly, resolve one active grant per opaque session, revoke rather than mutate sessions, and fail closed in production.
4. **Phase 3 - Repository read migration:** introduce normalized server reads behind a flag and compare them to snapshot compatibility output. Snapshot remains the only writable authority during parity work.
5. **Phases 4-5 - Student lifecycle, course delivery, and scheduling:** cut over one bounded workflow transactionally; its normalized service becomes the sole writable authority while snapshot data is generated only as a compatibility read model.
6. **Phase 6 - Moodle projection and command foundation:** ingest approved
   Moodle projections with checkpoints and reconciliation, then establish
   exact mappings and durable CRUD command evidence.
7. **Phases 7-9 - Teacher, HOD, branch, and super-admin operations:** migrate one scoped workflow family at a time with server authorization, audit/outbox evidence, parity, and portal QA.
8. **Phase 10 - Moodle CRUD activation:** ADR-010 and ADR-011 approve the
   authority and synthetic sandbox campaign. Production activation still
   requires the plugin, worker, command/outbox migration, RBAC, and accepted
   operation-family gates.
9. **Phase 11 - Finite legacy EMS migration:** dry run, reconciliation, approved import, final delta, cutover, rollback evidence, and credential retirement. No recurring EMS sync or writeback.
10. **Phase 12 - Route-by-route UI completion:** complete Simple UI after the underlying workflows and authority boundaries are stable.

At every cutover there is one writable authority. The previous adapter remains available only as a read-only rollback/export source until the slice is accepted.

## What Stays Local Or Demo

Until explicitly approved:

- seed fixtures
- role-switch/demo auth UX
- `.local-data/platform-state.json`
- portal QA reset state
- fake local emails and demo passwords
- pending file/audio/media metadata without byte upload
- print-to-PDF certificate flow
- integration status/config placeholders
- Moodle projection/command fixtures, finite EMS migration fixtures, and
  payment, email/SMS/WhatsApp, meeting, and storage placeholders

## Rollback Plan

Every persistence slice must support immediate rollback:

- Keep the snapshot adapter available until final retirement.
- Gate normalized adapters behind explicit server env flags.
- Export the current snapshot before data backfill or adapter cutover.
- Prefer additive migrations and reversible local/dev migrations during early phases.
- Run parity tests before enabling new reads.
- If a shadow read comparison diverges, keep the current writable adapter active, disable the normalized read adapter, preserve the snapshot, and stop before cutover.

## Validation Gates

Before any runtime persistence change:

- `npm run check`
- `npm run check:phase1-schema`
- `npm run check:phase1-schema:runtime`
- `npm run check:phase2-session:supabase` when the approved slice touches the
  durable session adapter
- `npm test -- --run`
- `npm run build`
- focused repository parity tests
- focused RBAC/scope tests
- migration dry run in local/dev Supabase
- direct browser-denial tests for Phase 1 base tables
- server action and scope tests for each role
- full portal QA with 0 failures

Manual/browser validation must be done per workflow using Aside when available:

- record the role/account
- record the route
- record the steps
- record pass/fail and evidence
- verify no sign-in wall after login
- verify no error overlay
- verify no horizontal overflow
- verify the page purpose is clear within 5 seconds

## Implementation Guardrails

- Do not implement schema and app cutover in the same slice.
- Do not migrate all workflows at once.
- Do not let client localStorage override server action results.
- Do not put service-role keys in client code.
- Do not add real external provider integrations in this persistence phase.
- Do not use real production data.
- Do not make RLS permissive to simplify QA.
- Do not remove snapshot fallback until normalized reads, writes, RLS, sessions, and QA are proven stable.

## Current Slice Authority

The authoritative current status, next slice, and slice-specific constraints
live only in `docs/NILE_LEARN_MASTER_PLAN.md` under **Current Modernization
Checkpoint**. This persistence plan does not duplicate or independently approve
that work.
