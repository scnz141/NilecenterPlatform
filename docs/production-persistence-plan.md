# Nile Learn Production Persistence Plan

## Purpose

This is a planning artifact for moving Nile Learn from snapshot/demo persistence toward production Supabase/Postgres persistence. It does not implement schema changes, migrations, RLS policies, seed scripts, or external integrations.

The detailed table design draft remains in `docs/production-persistence-architecture.md`. This plan defines the safe execution sequence, authority boundaries, validation gates, and rollback posture.

## Current Snapshot

Current runtime persistence is intentionally conservative:

- `server/platformRepository.ts` owns the repository boundary.
- The default repository stores one denormalized `PlatformState` snapshot.
- Local fallback writes to `.local-data/platform-state.json`.
- Optional Supabase snapshot mode writes the same denormalized state to `SUPABASE_PLATFORM_STATE_TABLE`.
- Optional repository events write to `SUPABASE_PLATFORM_EVENTS_TABLE`.
- `server/platformState.ts` is the server-side workflow gate: it derives the actor from the session, checks role and scope, applies domain mutations, writes the next snapshot, and records audit/event evidence.
- `server/auth.ts` supports Supabase password sign-in when configured, but demo auth and in-memory sessions are still part of the alpha flow.
- `server/sessionStore.ts` is in-memory only.
- `client/src/lib/domain/store.ts` may cache demo/scoped state locally, but client state is not an authorization boundary.

Current Supabase posture:

- Supabase browser config accepts only public browser keys through `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, or `VITE_SUPABASE_ANON_KEY`.
- Server Supabase REST calls require server-only credentials through `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY`.
- `docs/supabase-phase-1-identity-session-rls-draft.sql` is a draft only, not an applied production migration.
- Normalized Supabase/Postgres tables and complete RLS policies are not yet the production source of truth.

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

RLS should be implemented only with normalized tables and indexed predicate columns.

Global rules:

- Enable RLS on every application table exposed through Supabase APIs.
- Avoid broad `TO authenticated` policies without row predicates.
- Resolve identity from `app_users.auth_user_id = auth.uid()`.
- Resolve role/scope from server-owned tables, not user-editable metadata.
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

Do not expose table names to page components. Pages and workflow components should continue to call domain actions/server actions, while repository adapters decide whether the backing store is snapshot, dual-write, or normalized Postgres.

## Migration Phases

### Phase 0: Preserve The Alpha Baseline

Status: current operating mode.

- Keep snapshot/local fallback default.
- Keep portal QA green.
- Keep demo auth and local fixtures available.
- Do not connect external systems.
- Do not widen RBAC to make persistence work easier.

### Phase 1: Identity, Scope, Session, And Audit Draft

Planning and dry-run only.

- Review `docs/supabase-phase-1-identity-session-rls-draft.sql`.
- Convert the draft into a real migration only after review.
- Add RLS policy tests before runtime adoption.
- Add fake demo seed data only.
- Keep production service keys out of browser-visible code.

### Phase 2: Read-Only Normalized Mirror

No UI behavior change.

- Create normalized tables in a local/dev Supabase environment.
- Seed fake demo data mapped from the current snapshot.
- Add a read-only adapter that maps normalized rows back into the existing `PlatformState` read model.
- Add parity tests comparing snapshot reads to normalized reads.
- Keep snapshot as the runtime source of truth.

### Phase 3: Dual-Write Low-Risk Modules

Controlled workflow migration.

- Start with audit logs, report presets, portal settings, and branch/room operations.
- Write both snapshot and normalized tables.
- Compare resulting read models.
- Keep rollback to snapshot immediate through an env flag.

### Phase 4: Dual-Write Core School Operations

Move one workflow at a time:

- attendance
- admissions lifecycle
- user/staff/student lifecycle
- enrollments and class rosters
- assignments, quiz attempts, grading, and feedback
- certificates
- Quran progress and recitation review
- invoices and internal payment records

Each workflow must have focused tests, role-scope tests, audit evidence checks, and browser workflow QA before the next workflow starts.

### Phase 5: Normalized Read Cutover

Only after parity is proven:

- Make normalized Postgres the source for selected read models.
- Keep snapshot export for debug/rollback.
- Avoid loading the entire platform state for normal page reads.
- Paginate large tables and reports.

### Phase 6: Durable Session Cutover

Only after identity and role/scope tables are stable:

- Replace in-memory session storage or verify Supabase sessions server-side.
- Map Supabase identities to `app_users`.
- Refresh role and scope server-side on sensitive actions.
- Keep role/scope authority in server-owned tables.

### Phase 7: Snapshot Retirement

Only after full parity and QA stability:

- Stop treating the snapshot as production state.
- Keep snapshot export/import as a local QA/debug tool if useful.
- Remove assumptions that the full platform can be loaded as one object.

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
- Moodle, EMS, payment, email/SMS/WhatsApp, meeting, and storage placeholders

## Rollback Plan

Every persistence slice must support immediate rollback:

- Keep the snapshot adapter available until final retirement.
- Gate normalized adapters behind explicit server env flags.
- Export the current snapshot before data backfill or adapter cutover.
- Prefer additive migrations and reversible local/dev migrations during early phases.
- Run parity tests before enabling new reads.
- If dual-write diverges, disable the normalized adapter, preserve the snapshot, inspect the workflow, and do not continue to the next slice.

## Validation Gates

Before any runtime persistence change:

- `npm run check`
- `npm test -- --run`
- `npm run build`
- focused repository parity tests
- focused RBAC/scope tests
- migration dry run in local/dev Supabase
- RLS policy tests for each role
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

## First Safe Implementation Slice

The first implementation slice after this plan should be small:

1. Convert the identity/scope/session/audit SQL draft into a real local-only migration.
2. Add fake seed rows for demo users, branches, departments, roles, scopes, and permissions.
3. Add tests that prove RLS denies cross-role and cross-scope reads.
4. Do not change app runtime persistence yet.
5. Run full validation and browser QA.

Only after that passes should a read-only normalized adapter be introduced.
