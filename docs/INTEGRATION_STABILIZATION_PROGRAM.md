# Nile Learn Integration Stabilization Program

## Purpose

This program moves the current internal alpha toward a production-ready
integration foundation without adding product features. The phases are
sequential. A later phase cannot start until the previous phase has its required
evidence, cleanup, rollback, and quality-gate result.

The single source of truth for which phase is active remains the **Current
Modernization Checkpoint** in `docs/NILE_LEARN_MASTER_PLAN.md`.

## Non-Negotiable Boundaries

- Preserve the six permanent Nile Learn roles and server-side role/scope gates.
- Preserve the current portal QA baseline of 1,634 checks and 0 failures. Earlier
  phase attestations retain their historical acceptance counts.
- Use fake synthetic data only for provider and staging evidence.
- Keep provider credentials server-only, expiring, minimum privilege, and out
  of repository files and logs.
- Do not activate production writes, linked database promotion, or portal
  provider flags without the matching checkpoint acceptance.
- Reconcile before retry, clean up every disposable remote fixture, and prove
  retired-token rejection.
- Stop on authority ambiguity, an unclean rollback, unexplained provider drift,
  or a quality-gate regression.

## Phase 1: Freeze Existing Features

Main job: establish the exact surface that later integration work must preserve.

Evidence:

- `docs/integration-feature-freeze.json` records roles, route signatures,
  workflow actions, server APIs, Moodle allowlists, authority, and the accepted
  QA artifact.
- `npm run check:integration-freeze` derives those declarations from source and
  rejects unreviewed additions or removals.
- The validator includes negative controls for both an added and a removed
  protected item.

Acceptance: the worktree baseline is known, the validator passes, TypeScript,
unit tests, build, and protected portal QA remain green.

Rollback: remove only this validator, manifest, package script, and checkpoint
record. Product runtime behavior is unchanged.

## Phase 2: Close the Moodle Sandbox Contract

Main job: finish the approved M2C-R read contract before any later Moodle lane.

Required work:

1. Use one dedicated fake-only, minimum-privilege, expiring read-contract token.
2. Create the missing H5P and SCORM fixtures through an approved sandbox-only
   upload-capable path.
3. Exercise all 31 allowlisted reads through the real client validators.
4. Repeat the run to prove deterministic reads and bounded responses.
5. Remove course content, enrolments, service, role grants, user, and token in
   dependency order.
6. Prove the retired token is rejected and the sandbox fingerprint is restored.

Acceptance: 31/31 reads pass twice, cleanup is idempotent, no real identity or
document is used, and redacted evidence contains no credential or raw payload.

## Phase 3: Enforce Product Integration Ownership

Main job: make authority and mapping decisions executable rather than inferred.

Required artifact: one ownership matrix for every existing feature family with
Nile Learn authority, Moodle authority, projection direction, external ID,
conflict rule, permitted roles, audit owner, failure behavior, and future write
status. Static validation must reject an unmapped route, action, or Moodle
function.

Fast feedback during this phase uses `npm run verify:integration-fast`. The
command runs the ownership/evidence contracts first, then TypeScript, unit
tests, and the production build concurrently. It intentionally omits database
runtime drills and browser QA. Focused portal runs use `VERIFY_SCOPE=focused`
with one exact role or workflow and isolated output/state directories. Only an
unfiltered plain `scripts/verify.sh` may certify the protected `1,634/0`
baseline.

Acceptance: every protected route and workflow action maps to exactly one
feature family; no bidirectional or shared authority is implicit.

Status: accepted on 2026-07-16 with 33 feature families, zero unmapped or
ambiguous frozen surfaces, and a complete 1,598/0 final portal gate. Evidence:
`docs/qa-attestations/integration-ownership-phase3-20260716.json`.

## Phase 4: Test Complete Integration Loops

Main job: prove every already-approved provider contract as a bounded lifecycle.

Status: accepted on 2026-07-16. The executable contract covers both frozen
provider lanes, 10 feature families, all 31 read functions, all 11 bounded
sandbox-write functions, all 9 lifecycle stages, 7 authority denials, and 5
negative controls. The final phase gate completed all 1,598 portal checks with
0 failures. Evidence:
`docs/qa-attestations/moodle-phase4-contract-loops-20260716.json`.

Each loop must cover setup, create or fixture discovery, read, replay,
reconciliation, injected denial/failure, cleanup, repeated cleanup, and token
teardown. Separate lanes and credentials are required for read closure,
synthetic identity/enrolment/group writes, content fixtures, learner
interactions, outcomes, and authority denials. No lane may widen the current
allowlist or become a portal action.

Acceptance: evidence is deterministic, cleanup leaves no marker-bound records,
and all denied operations leave no residual mutation.

Efficient development feedback uses `npm run verify:integration-fast` for
contracts, TypeScript, unit tests, and build. A changed browser workflow uses
`QA_ONLY_WORKFLOWS="<exact workflow>" npm run verify:focused-fast` with unique
QA directories. Neither command replaces the unfiltered `scripts/verify.sh`
phase-boundary gate.

## Phase 5: Activate the Production Foundation in Isolated Staging

Main job: prove normalized persistence and durable sessions outside the
compatibility runtime before production cutover.

Status: accepted on 2026-07-16. Redacted evidence is recorded in
`docs/qa-attestations/integration-phase5-staging-foundation-20260716.json`.

Required work:

- Apply reviewed SQL only to a dedicated isolated staging project.
- Prove migration, assertions, RLS, seed, rollback, reapply, and database lint.
- Prove durable login, cookie resolution, live role/scope refresh, expiry,
  revocation, multi-instance behavior, outage fail-closed behavior, and logout.
- Keep production and compatibility runtime flags unchanged.

Acceptance: staging evidence passes with fake identities, browser roles cannot
bypass RLS/RPC boundaries, rollback is clean, and secrets remain server-only.

## Phase 6: Moodle Projections And CRUD Command Foundation

Main job: expose Moodle-owned learning data through Nile Learn role scope and
prepare typed CRUD commands without transferring record authority.

Status: projection packages accepted as historical Phase 6 evidence. ADR-010
and ADR-011 now authorize Moodle-owned command work and full synthetic sandbox
CRUD under the current master-plan checkpoint.

Implemented boundary: authenticated server-only read endpoints now project
Moodle course and course-content data through canonical Nile Learn enrolment,
class-assignment, and department relationships for the roles approved by the
catalog/content ownership contract. Exact external mappings are required,
ambiguous or unauthorized records fail closed, provider responses are sanitized,
and the boundary exposes no Moodle write action.

The additive Phase 6A repository contract now supplies normalized authority and
course-mapping RPCs behind a disabled-by-default server adapter. Its manual SQL
package has portable apply/assert/rollback/reapply evidence but has not been
promoted to an approved Supabase environment.

The additive Phase 6B observation contract retains bounded, sanitized
course-catalog and course-content snapshots for deterministic freshness and
outage presentation. Current Nile Learn authority is always resolved first;
stale projection data never authorizes access. Its manual SQL is also unapplied
and its runtime adapter remains disabled.

Phase 6C wires the role-scoped course catalog into the student, teacher, HOD,
and super-admin Moodle source routes through the same-origin Nile Learn API.
The client validates the complete response contract, exposes loading, empty,
unavailable, stale, partial, and retry states, and has no local-state fallback,
direct provider call, or write action.

Phase 6D wires exact-course section and activity projections into dedicated
read-only detail routes for the same four roles. The server re-resolves current
authority, loads only the requested course observation, filters unknown or
hidden student content closed, and returns reconciliation metadata without
exposing provider credentials or write controls.

Phase 6E establishes exact current user-mapping authority without matching by
email or display name. Phase 6F adds a bounded class enrollment/group
observation route with person-level teacher scope and aggregate governance
scope. Phase 6G adds assignment/quiz definitions and schedule status for an
exact authorized class. Phase 6H1 adds assignment submission and grade-result
observations. Phase 6H2 adds quiz-attempt summary observations with student-own,
exact-class teacher, and aggregate governance audiences. Phase 6H3 adds
gradebook and explicitly released-feedback summaries with the same bounded
audiences and exact grade-item mappings. These packages are manual, unapplied,
and runtime-disabled; their portable PostgreSQL lifecycle, rollback, RLS
denial, focused test, build, and complete 1,634/0 portal evidence is accepted.

The only approved next implementation slice is Phase 6H4: a read-only bounded
lesson, H5P, and SCORM outcome summary projection. It must expose only current
completion and explicitly released score summaries, require exact course,
class, user, and activity mappings, exclude raw attempt tracks and learner
answers, and add no Moodle write control.

Remaining acceptance gates and limitations:

- Later projection-family portal views are not yet wired.
- Normalized authority and mapping persistence is implemented as an unapplied
  manual SQL and repository contract. Approved staging promotion and real
  PostgREST/RLS acceptance evidence are still pending.
- The accepted projection boundary did not configure a live service token or
  perform provider writes.
- Full synthetic sandbox CRUD is now approved by ADR-011. Production portal
  activation remains disabled until operation-family gates pass.
- Approved live read evidence and isolated PostgREST/RLS proof are still
  required before runtime activation.

Initial order:

1. external course and user mappings;
2. course/module/activity projections;
3. assignment and quiz status projections;
4. submission, attempt, grade, and feedback projections;
5. projection freshness, unavailable, empty, and reconciliation states.

Students see only their mapped enrolments. Teachers see only assigned mapped
classes and learners. HOD, Branch Admin, and Super Admin projections remain
department, branch, or global according to existing server scope. Nile Learn
continues to own admissions documents, attendance exceptions, internal
messages, scheduling, payments, certificates, and audit.

Acceptance: provider outage fails closed without stale authority, unmapped or
ambiguous records are not projected, and no portal action writes to Moodle.

## Phase 7: Preserve the Quality Gates

Main job: make the completed program repeatable.

Required gates:

- feature-freeze and ownership validators;
- Moodle contract and cleanup validators;
- schema, RLS, session, repository, and rollback gates;
- `npm run check`;
- `npm test -- --run`;
- `npm run build`;
- full portal QA with a unique output directory;
- `scripts/verify.sh`.

Acceptance: all evidence paths and counts are recorded in the master-plan
checkpoint, the portal QA result has 0 failures, and no disposable server,
fixture, token, or credential remains active.
