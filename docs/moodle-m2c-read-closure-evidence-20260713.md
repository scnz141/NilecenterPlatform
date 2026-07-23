# Moodle M2C-R Read-Closure Evidence

Historical evidence note: ADR-011 now authorizes full synthetic Moodle sandbox
CRUD. This file remains an immutable account of the earlier read-closure run.

## Decision Boundary

This record covers only the M2C-R read-contract lane on the dedicated practice
sandbox at `moodle-no-data.enesekremergunesh.com`. It does not enable a Nile
Learn runtime route, provider persistence, portal projection, Moodle write,
Supabase change, or production credential.

ADR-009 and `docs/MOODLE_INTEGRATION_EXECUTION_PLAN.md` remain authoritative.
M2C-R is **partial**, not accepted closure, because five fixture-backed
contracts could not be executed.

## Read-Service Boundary

- The disposable service was authorised-users-only and exposed exactly the 31
  approved read functions, with no missing or unexpected functions.
- The service user was temporarily enrolled in synthetic course ID `2` with a
  read-only course role because Moodle otherwise rejected course-scoped
  assignment reads.
- Every live response was routed through its bounded provider-neutral parser
  and forbidden-key scan.
- No raw Moodle payload, credential, token, password, or real identity was
  persisted to Nile Learn or this repository.

## Partial Run

The final sanitized validator result contained 31 rows:

| Result           | Count | Scope                                                                 |
| ---------------- | ----: | --------------------------------------------------------------------- |
| Passed           |    26 | All available fixtures parsed and passed the privacy/boundedness gate |
| Fixture-only gap |     3 | H5P activity, attempts, and results                                   |
| Fixture-only gap |     2 | SCORM activity and SCO tracks                                         |

The disposable Resource fixture closed the earlier Resource gap. The run also
exposed one real Moodle 4.5 response-shape mismatch: quiz-review grades can be
numeric and question blocking is reported as `blockedbyprevious`. The parser
now accepts a finite numeric or sanitized string grade and maps the current
blocking field while retaining the legacy fallback. Focused tests cover that
provider-shaped response.

The remaining five rows are not service-function or parser failures. Moodle's
configured file picker exposes Content bank, Server files, Recent files,
Upload a file, Private files, and Wikimedia, but no URL-downloader repository.
The mandated Codex in-app Browser exposes the file input but does not provide a
file-upload operation. Therefore the approved synthetic SCORM ZIP and H5P
package could not be attached without changing browser policy or adding a new
provider write surface.

## Cleanup And Credential Teardown

- The temporary read-service course enrolment was removed; the synthetic
  course returned to two participants.
- The disposable Resource activity (course-module ID `8`) was deleted and a
  follow-up `core_course_get_contents` read returned no matching module.
- The disposable read-closure service was deleted. Moodle states that deleting
  a service also deletes its authorised-user, function, and token records.
- The permanent `Nile Learn Read Projection (Sandbox)` service remained.
- A final validator call with the retired token exited non-zero, classified
  `core_webservice_get_site_info` as `authentication`, and marked every later
  function `not_run_after_probe`.
- The temporary local token and teardown-result files were removed.

The older M2 service, user, role, token-lifecycle risk, and synthetic dataset
remain separate historical M2 concerns. This M2C-R cleanup does not claim to
remove or close them.

## Local Regression Evidence

- The focused Moodle client, parser, route, M2B workflow, and validator suites
  passed 73/73 tests across seven files.
- The complete unit suite passed 572/572 tests across 50 files.
- TypeScript and the production build passed.
- Every static and portable PostgreSQL, durable-session, and Nile Forms gate in
  `scripts/verify.sh` passed.
- The complete protected portal QA matrix passed 1,598/1,598 checks with zero
  failures. Its summary is
  `output/playwright/moodle-m2c-read-partial-20260713/portal-qa-summary.json`.

This regression evidence preserves the accepted application baseline. It does
not convert the partial 26/31 provider run into accepted M2C-R closure.

## Stop Decision

M2C-C, M2C-L, M2C-O, M2C-P, and M2C-D were not started. The master-plan gate
requires M2C-R to reach 31/31 and record credential teardown before broader
content, learner, outcome, messaging, calendar, or denial lanes begin.

To resume M2C-R, provide one approved upload-capable fixture path in the
mandated browser surface, then create fake-only SCORM and H5P fixtures, rerun
all 31 reads, remove those fixtures, repeat cleanup, revoke the lane credential,
and record the final invalid-token proof.
