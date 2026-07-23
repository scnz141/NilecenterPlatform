# Nile Learn Foundation Evidence - 2026-07-12

Historical evidence note: ADR-011 now authorizes full synthetic Moodle sandbox
CRUD. The no-write statements below describe this earlier foundation run only.

## Phase 2B Native PostgREST Acceptance

The corrected Phase 2B SQL was applied in order to an isolated fake-data-only
PostgreSQL 17.10 cluster under `/tmp`, then exercised through PostgREST 14.14 and
the real `SupabaseSessionRepository` adapter. Docker and linked, shared, or
remote Supabase projects were not used.

Manual SQL order:

1. `supabase/manual/001_phase1_identity_scope_session_audit_mapping.sql`
2. `supabase/manual/002_phase2b_atomic_session_lifecycle.sql`
3. `supabase/manual/200_install_verification.sql`
4. `supabase/manual/100_fake_seed.sql`

The install verifier returned `verified_table_count = 25`. The acceptance
command exited `0` with:

```json
{
  "ok": true,
  "adapter": "supabase",
  "authority": "atomic-rpc",
  "browserRoleDenials": 8,
  "durableSessionChecks": [
    "create",
    "database-timestamps",
    "hashed-token",
    "atomic-command-audit",
    "idempotent-replay",
    "idempotency-conflict",
    "authority-denial-no-write",
    "resolve",
    "expiry",
    "branch-status-refresh",
    "relationship-refresh",
    "revoke",
    "revoked-by"
  ]
}
```

PostgREST logs confirmed that the anonymous and authenticated base-table and
RPC requests reached PostgreSQL and were rejected with SQLSTATE `42501`. The
service-role lifecycle produced the expected `200`, `403`, and `409` responses,
and the temporary proxy, PostgREST process, and PostgreSQL process were stopped
after the run.

Boundary: this is local-only database and repository-adapter acceptance. It is
not evidence for managed Supabase settings, remote promotion, production
runtime activation, multi-instance HTTP sessions, or normalized workflow
persistence. `NILE_SESSION_REPOSITORY=memory` remains the runtime default.

## Moodle Sandbox Discovery

Read-only browser discovery against the supplied practice site established:

- Moodle `4.5.12+ (Build: 20260708)` on MySQL `8.0.44` and PHP `8.1.34`.
- Web services are enabled and REST is the enabled protocol.
- Developer web-service documentation is disabled.
- At the time, the only configured service was the built-in Moodle mobile web
  service; there was no custom Nile Learn service.
- The mobile service exposes 437 functions, including course, enrolment,
  completion, grades, assignments, quizzes, H5P, SCORM, Lesson, Book, Page,
  File, URL, calendar, group, and messaging APIs.
- Activity completion is enabled.
- At the time, the practice site had one empty course category and no courses.
- The Attendance activity plugin is not installed.
- BigBlueButton is installed but disabled.

No Moodle user, role, service, token, course, enrolment, activity, grade, or
setting was created or changed during discovery. The supplied administrator
credential was used only in the in-app browser and was not written to the
repository.

## Moodle M1 Server Boundary Acceptance

The disabled-by-default server foundation now provides:

- a strict read-function allowlist and reserved-protocol-parameter rejection;
- an explicit service and hostname configuration gate;
- public-host DNS validation pinned to the actual HTTPS socket while retaining
  the original hostname for TLS verification and SNI;
- one timeout across DNS resolution and the provider request;
- bounded streaming with response cancellation on declared or observed size
  overflow;
- fixed public error classifications with no provider-controlled message text;
- exact minimum-privilege service verification, including rejection of any
  unexpected function; and
- a Super-Admin-only status endpoint with no token, course projection, or
  portal consumer.

Two independent read-only reviews found no remaining high or medium issue after
the fixes. The focused Moodle suite passes 16 tests. The complete repository
gate then passed TypeScript, 40 test files with 478 tests, production build,
Phase 1 and Phase 2B portable PostgreSQL checks, and the protected portal matrix:

```json
{
  "inProgress": false,
  "interrupted": false,
  "totalChecks": 1509,
  "failedChecks": 0
}
```

Portal evidence:
`output/playwright/moodle-read-foundation-20260712/portal-qa-summary.json`.

Boundary at M1 acceptance: no live Moodle token had been created or used by Nile
Learn, the client was disabled by default, and portal data was unchanged. M2
later exercised the same client from the local command environment only; it did
not enable the Nile Learn runtime.

## Moodle M2 Dedicated Sandbox Evidence

M2 ran only against the approved fake-data practice site. The evidence below
contains Moodle object IDs needed to identify the synthetic fixtures, but no
credential, password, or token value.

### Proven

- The sandbox remained on Moodle `4.5.12+ (Build: 20260708)` with REST enabled.
- The setup created an authorised-users-only custom REST service with ID `2`, a
  dedicated service user with ID `4`, and a system-context read role with ID
  `10`. An expiring token was used only from the local command environment.
- The synthetic dataset contains teacher user ID `5`, student user ID `6`,
  course ID `2`, group and grouping fixtures, and assignment, quiz, URL, Book,
  Page, and Lesson fixtures.
- The live M1 probe returned exactly `31/31` approved service functions: no
  approved function was missing and no unexpected function was exposed by the
  custom service.
- The final live contract validator passed `25` function checks. The remaining
  `6` results were fixture-only gaps: H5P (`3`), SCORM (`2`), and Resource
  (`1`). There was no authentication, permission, transport, provider, or
  response-shape failure among the 25 executed fixture-backed checks.
- Only synthetic identities and course data were used. No real student or staff
  PII, photographs, passports, national IDs, guardian documents, consent,
  addresses, or admissions notes were copied to Moodle.
- No Moodle payload was persisted in Nile Learn or projected into a portal. M3
  projection persistence and all runtime flags remained disabled.

### Blocked Or Not Proven

- The Codex in-app Browser does not support the local file upload needed to
  create H5P, SCORM package, and Resource file fixtures. The three H5P, two
  SCORM, and one Resource validator results therefore prove only that fixture
  coverage is absent; they do not prove those service functions succeed or
  fail against a real fixture.
- Moodle capability inspection surfaced a broader effective capability surface
  than the intended production read contract. Exact containment of the custom
  service to 31 functions is proven, but production minimum privilege for the
  underlying role and account is not. Sandbox service ID `2`, user ID `4`, and
  role ID `10` must not be copied to production without a fresh capability
  audit and denied-operation tests.
- Token rotation, token revocation, and cleanup or disablement of the synthetic
  service objects were not verified by this evidence. The current token state
  is therefore an operational cleanup risk; no future sandbox or production use
  should rely on it without explicit rotation or revocation evidence.
- This is not Phase 6 projection acceptance, production connector readiness,
  portal integration, reconciliation proof, or permission for Moodle writes.
