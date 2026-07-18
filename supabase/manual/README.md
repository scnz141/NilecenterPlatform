# Nile Learn Manual SQL Bundle

This folder contains the current local-only normalized identity/session SQL in
manual execution order. It is a review and development bundle, not production
promotion approval.

## Single-File Staging Bootstrap

`000_nile_learn_staging_bootstrap.sql` is the single paste-ready SQL file for a
fresh, disposable Supabase staging project. It combines the promoted migration
history, core installation verification, Phase 6I pgcrypto compatibility, and
all accepted read-only Phase 6 projection packages in their proven order.

It is intentionally not a production installer and is not safe to rerun on a
database that already contains these migrations. Fake seeds, assertion
fixtures, rollback drills, credentials, provider writes, and the explicitly
local-only Phase 13F1 package are excluded.

Regenerate and verify it with:

```bash
npm run build:supabase-sql-bundle
npm run check:supabase-sql-bundle
```

## Forward Order

Run each file as one complete transaction in this order:

1. `001_phase1_identity_scope_session_audit_mapping.sql`
2. `002_phase2b_atomic_session_lifecycle.sql`
3. `200_install_verification.sql`
4. `100_fake_seed.sql` only in an empty development/test project

The seed is fake demo data only. Never run it in a real school database.

## Phase 6A Moodle Projection Authority Package - Outside Migration History

The following additive package is reviewed and portable-runtime tested. It is
not in migration history and is not approved for a shared or production target.
It is accepted only on the pinned isolated fake-data staging project through
the guarded Phase 6I runner:

1. `006_phase6a_moodle_projection_authority.sql`
2. `106_phase6a_moodle_projection_authority_fake_seed.sql` for disposable fake
   data only
3. `206_phase6a_moodle_projection_authority_assertions.sql`
4. `906_phase6a_moodle_projection_authority_rollback.sql` for the disposable
   rollback drill only

Validate the package without Docker or a remote database:

```bash
npm run check:phase6a-moodle-authority
npm run check:phase6a-moodle-authority:runtime
```

The runtime check applies the Phase 1 foundation plus Phase 6A twice in portable
PGlite PostgreSQL, runs semantic assertions twice, proves browser-role denials
and service-role RPC behavior, and performs rollback/reapply. It does not contact
Supabase. Keep `NILE_MOODLE_PROJECTION_REPOSITORY=disabled`; Phase 6I staging
acceptance did not approve runtime activation.

## Phase 6E Moodle User Mapping Authority Package - Outside Migration History

This additive package establishes exact internal-user to Moodle-user mappings
before any enrollment, roster, completion, or outcome projection is exposed.
It does not add a portal route, contact-data projection, Moodle write, or runtime
activation:

1. `008_phase6e_moodle_user_mapping_authority.sql`
2. `108_phase6e_moodle_user_mapping_authority_fake_seed.sql` for disposable fake
   data only
3. `208_phase6e_moodle_user_mapping_authority_assertions.sql`
4. `908_phase6e_moodle_user_mapping_authority_rollback.sql` for the disposable
   rollback drill only

Validate it without Docker or a remote database:

```bash
npm run check:phase6e-moodle-user-mapping
npm run check:phase6e-moodle-user-mapping:runtime
```

The authority RPC resolves only current normalized session relationships. The
mapping RPC returns IDs and synchronization metadata only; it never matches by
email or display name. Both RPCs are service-role-only. The package remains
manual, outside migration history, and runtime-disabled. Phase 6I accepted it
only on the pinned isolated fake-data staging target after PostgREST/RLS proof.

## Phase 6F Moodle Enrollment/Group Observation Package - Unapplied

This additive package stores sanitized class enrollment/group observations
without replacing Nile Learn roster authority. Teachers receive person-level
internal IDs only for an exact currently assigned class; HOD and Super Admin
receive aggregate counts only. Student, Registrar, and Branch Admin access is
denied. Names, emails, provider IDs, roles, access times, and raw metadata are
not stored:

1. `009_phase6f_moodle_enrollment_group_observation.sql`
2. `109_phase6f_moodle_enrollment_group_observation_fake_seed.sql` for
   disposable fake data only
3. `209_phase6f_moodle_enrollment_group_observation_assertions.sql`
4. `909_phase6f_moodle_enrollment_group_observation_rollback.sql` for the
   disposable rollback drill only

Validate it without Docker or a remote database:

```bash
npm run check:phase6f-moodle-enrollment-group
npm run check:phase6f-moodle-enrollment-group:runtime
```

The observation table is immutable, forced-RLS, and RPC-only. The package
remains manual, unapplied, and runtime-disabled. The server endpoint reads only
retained sanitized observations after re-resolving the normalized session,
role grant, exact class assignment, department scope, and external mappings.

## Phase 6G Moodle Assessment Status Observation Package - Unapplied

This additive package stores an atomic, sanitized snapshot of assignment and
quiz definitions plus bounded schedule status for an exact class. It does not
store or expose submissions, attempts, answers, scores, grades, feedback,
completion, contact data, or raw Moodle identifiers:

1. `010_phase6g_moodle_assessment_status_observation.sql`
2. `110_phase6g_moodle_assessment_status_fake_seed.sql` for disposable fake
   data only
3. `210_phase6g_moodle_assessment_status_assertions.sql`
4. `910_phase6g_moodle_assessment_status_rollback.sql` for the disposable
   rollback drill only

Validate it without Docker or a remote database:

```bash
npm run check:phase6g-moodle-assessment-status
npm run check:phase6g-moodle-assessment-status:runtime
```

The table is immutable, forced-RLS, policy-free, and service-role-only. Student
access requires the signed-in learner's exact active or completed class
enrollment and exact user mapping. Teacher access requires the current exact
class assignment; HOD and Super Admin remain governed by canonical scope. The
package remains manual, unapplied, and runtime-disabled.

## Phase 6H1 Moodle Assignment Result Observation Package - Unapplied

This additive package stores a sanitized, immutable assignment-result snapshot
for one exact internal class and assignment projection. Student access is
limited to the signed-in learner, teachers receive person-level results only
for an exactly assigned class, HOD and Super Admin receive aggregate counts,
and Registrar and Branch Admin are denied. It excludes raw Moodle identifiers,
files, answers, comments, feedback, and grader identity:

1. `011_phase6h1_moodle_assignment_result_observation.sql`
2. `111_phase6h1_moodle_assignment_result_fake_seed.sql` for disposable fake
   data only
3. `211_phase6h1_moodle_assignment_result_assertions.sql`
4. `911_phase6h1_moodle_assignment_result_rollback.sql` for the disposable
   rollback drill only

Validate it without Docker or a remote database:

```bash
npm run check:phase6h1-moodle-assignment-result
npm run check:phase6h1-moodle-assignment-result:runtime
```

The table is immutable, forced-RLS, policy-free, and service-role-only.
Observations are fresh for at most 15 minutes and retained for at most 30 days.
The route is read-only and repository-backed; it performs no Moodle provider
call or write. The package remains manual, unapplied, and runtime-disabled.

## Phase 6H2 Moodle Quiz Attempt Observation Package - Unapplied

This separate package stores sanitized latest-attempt summaries for one exact
class and quiz projection. Students receive only their own mapped attempt,
teachers receive person-level summaries only for an exactly assigned class,
HOD and Super Admin receive aggregate counts, and Registrar and Branch Admin
are denied. Question text, answers, feedback, files, preview attempts, contact
data, and raw Moodle identifiers are excluded:

1. `012_phase6h2_moodle_quiz_attempt_observation.sql`
2. `112_phase6h2_moodle_quiz_attempt_fake_seed.sql`
3. `212_phase6h2_moodle_quiz_attempt_assertions.sql`
4. `912_phase6h2_moodle_quiz_attempt_rollback.sql`

Validate it without Docker or a remote database:

```bash
npm run check:phase6h2-moodle-quiz-attempt
npm run check:phase6h2-moodle-quiz-attempt:runtime
```

The table is immutable, forced-RLS, policy-free, service-role-only, fresh for
15 minutes, and retained for no more than 30 days. The package is manual,
unapplied, runtime-disabled, read-only, and performs no provider call.

### Phase 6H4 Moodle activity outcome summary observation

This separate package stores sanitized lesson, H5P, and SCORM outcome summaries
for one exact class and activity projection. Students receive only their own
outcome, teachers receive person-level outcomes only for an exactly assigned
class, and HOD and Super Admin receive aggregate counts. Registrar and Branch
Admin are denied. Raw tracks, interactions, questions, answers, files,
comments, provider identifiers, grader identity, and contact data are excluded:

1. `014_phase6h4_moodle_activity_outcome_observation.sql`
2. `114_phase6h4_moodle_activity_outcome_fake_seed.sql`
3. `214_phase6h4_moodle_activity_outcome_assertions.sql`
4. `914_phase6h4_moodle_activity_outcome_rollback.sql`

Validate it without Docker or a remote database:

```bash
npm run check:phase6h4-moodle-activity-outcome
npm run check:phase6h4-moodle-activity-outcome:runtime
```

The table is immutable, forced-RLS, policy-free, service-role-only, fresh for
15 minutes, and retained for no more than 30 days. The package is manual,
unapplied, runtime-disabled, read-only, and performs no provider call.

## Phase 6H3 Moodle Grade Outcome Observation Package - Unapplied

This separate package stores sanitized released grade outcomes for one exact
class and grade-item projection. Students receive only their own released
result and feedback, teachers receive person-level outcomes only for an exactly
assigned class, HOD and Super Admin receive aggregate counts, and Registrar and
Branch Admin are denied. Questions, answers, files, comments, grader identity,
contact data, and raw Moodle identifiers are excluded:

1. `013_phase6h3_moodle_grade_outcome_observation.sql`
2. `113_phase6h3_moodle_grade_outcome_fake_seed.sql`
3. `213_phase6h3_moodle_grade_outcome_assertions.sql`
4. `913_phase6h3_moodle_grade_outcome_rollback.sql`

Validate it without Docker or a remote database:

```bash
npm run check:phase6h3-moodle-grade-outcome
npm run check:phase6h3-moodle-grade-outcome:runtime
```

The table is immutable, forced-RLS, policy-free, service-role-only, fresh for
15 minutes, and retained for no more than 30 days. The package is manual,
unapplied, runtime-disabled, read-only, and performs no provider call.

## Phase 6I Isolated Staging Promotion

The master-plan checkpoint accepts one remote use of the reviewed Phase 6
packages: the pinned isolated fake-data staging project. It does not approve
production, a shared school database, Moodle provider calls, Moodle writes, a
new projection family, or runtime activation.

Run the contract and target guards before the live proof:

```bash
npm run check:phase6-staging-db:static
npm run check:phase6-staging-db:dry-run
```

The live command requires the pinned staging and production references, exact
staging Supabase URL and pooler host, and an explicit acknowledgement. Server
credentials must come from the shell or the documented local Keychain entries;
never put them in source, command output, or evidence. The runner verifies fake
identities, applies all nine packages in dependency order, seeds deterministic
fixtures, runs every semantic assertion, proves PostgreSQL and PostgREST access
boundaries, performs rollback and reapply, and invalidates its temporary fake
login. It leaves the reviewed read-only schema applied in staging while
`NILE_MOODLE_PROJECTION_REPOSITORY` remains `disabled`.

```bash
NILE_PHASE6_ALLOW_REMOTE=1 \
NILE_PHASE6_STAGING_ACK=I_ACKNOWLEDGE_PHASE6_READ_ONLY_STAGING_PROMOTION \
npm run check:phase6-staging-db:live
```

The exact package order, target hashes, and artifact hashes are pinned in
`docs/integration-phase6-staging-promotion.json`. Redacted evidence is written
under `output/phase6/`, with accepted results summarized in
`docs/qa-attestations/integration-phase6i-staging-promotion-20260717.json`.
This staging pass does not authorize a production migration or runtime flag
change.

## Manual SQL Editor Steps - Not Currently Approved For Remote Use

Use only an isolated disposable local project. Phase 6I has its own guarded
runner for the single approved staging target above; these general editor steps
do not approve a linked, shared, tunneled, staging, or production target.

1. Open the approved isolated project in Supabase Dashboard or local Studio.
2. Open **SQL Editor** and create a new query.
3. Paste the complete contents of `001_phase1_identity_scope_session_audit_mapping.sql` and run it once.
4. Create a second query, paste `002_phase2b_atomic_session_lifecycle.sql`, and run it once.
5. Create a third query, paste `200_install_verification.sql`, and confirm it returns `verified_table_count = 25`.
6. Only for an empty demo project, run `100_fake_seed.sql` last.

Do not combine the files into one editor run. Stop at the first error and keep
`NILE_SESSION_REPOSITORY=memory` until the verification and server adapter
acceptance checks are both clean.

## Rollback Order

Rollback is destructive. Use it only in an empty disposable development
database before dependent migrations exist:

1. `901_phase2b_rollback.sql`
2. `902_phase1_rollback.sql`

For shared or production environments, use an approved forward migration or a
reviewed backup restore instead of these rollback files.

## Future Shared-Environment Review - Does Not Grant Approval

- Rotate any credentials previously exposed outside the repository.
- Confirm the target is a dedicated development/test project.
- Take and verify a backup.
- Review the project diff/dry run and database advisors.
- Confirm `anon` and `authenticated` cannot read base tables or execute the
  session lifecycle RPCs.
- Run `npm run check:phase1-schema`,
  `npm run check:phase1-schema:runtime`, and
  `npm run check:phase2-session-schema` locally.
- Run `npm run check:phase2-session-schema:runtime` to execute the reviewed SQL
  lifecycle and rollback in portable PGlite PostgreSQL. This is required local
  evidence but is not a substitute for PostgREST acceptance.
- Run the manual SQL in the documented order.
- Execute the Phase 1 assertions and the Phase 2 session lifecycle checks in a
  controlled environment.
- Preserve the accepted portal QA baseline from the master plan before any
  runtime flag changes.

Completing this checklist does not authorize a shared or remote run. Promotion
requires a later master-plan checkpoint with an explicit target and rollback
approval.

## Current Evidence Boundary

Static SQL, TypeScript, focused unit checks, and the portable PGlite Phase 2B
gate pass. The corrected SQL also passes the real repository adapter against
isolated native PostgreSQL 17 and PostgREST 14.14 with the exact fake fixture.
That local run proves eight browser-role denials plus create, replay, conflict,
denial-with-no-write, live scope refresh, expiry, revoke, audit, and
`revoked_by` behavior. Remote promotion and runtime activation remain
**unapproved**. Do not switch `NILE_SESSION_REPOSITORY` away from `memory` based
on this local evidence alone.

## Local PostgREST Acceptance Without Docker

When Docker operation is not approved, use only an already-running, isolated
local PostgREST/Supabase endpoint with fake data. Do not point this runner at a
linked, shared, tunneled, staging, or production project.

After the forward SQL, installation verification, and fake seed above are
complete, provide the local test credentials only in the current command shell.
The runner requires the deterministic
`phase2b-disposable-local-v1` integration marker, exactly the six fake
`@nilelearn.local` users, and no existing session rows. This prevents mutation
of an unknown or previously used database:

```bash
NILE_PHASE2_SESSION_LOCAL_ONLY=1 \
SUPABASE_URL=http://127.0.0.1:<port> \
SUPABASE_SECRET_KEY=<local-service-key> \
NILE_LOCAL_SUPABASE_ANON_KEY=<local-anon-key> \
NILE_LOCAL_SUPABASE_JWT_SECRET=<local-jwt-secret> \
npm run check:phase2-session:postgrest
```

The runner rejects non-local URLs, requires an explicit acknowledgement, never
starts Docker, never applies SQL, and never changes the application runtime
default. It writes fake session lifecycle rows while checking create, replay,
conflict, authority denial with no write, scope refresh, revoke, audit evidence,
and browser role denials; use it only on a freshly reset disposable database. A
pass is local acceptance evidence, not approval to enable
`NILE_SESSION_REPOSITORY=supabase`.
