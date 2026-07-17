# QA Baseline

Nile Learn is currently in internal alpha stabilization. The protected portal QA baseline is:

- Portal QA: 1,634 checks, 0 failures.
- Checked at: `2026-07-17T21:30:16.353Z`.
- Validation command: `QA_OUTPUT_DIR=output/playwright/phase6i-staging-promotion-acceptance-20260717 scripts/verify.sh`.
- QA summary artifact:
  `output/playwright/phase6i-staging-promotion-acceptance-20260717/portal-qa-summary.json`.

`docs/NILE_LEARN_MASTER_PLAN.md` defines the next architecture phases, and
`docs/MODERNIZATION_EXECUTION_CONTRACT.md` defines how this baseline is
protected during each slice.

## Latest Preservation Evidence

The Phase 6I staging-promotion slice changes no portal route or portal behavior.
It promotes the nine accepted read-only projection packages only to the pinned
isolated fake-data staging project and proves their combined database boundary:

- Checked at: `2026-07-17T21:30:16.353Z`.
- QA summary artifact:
  `output/playwright/phase6i-staging-promotion-acceptance-20260717/portal-qa-summary.json`.
- Artifact SHA-256:
  `c6fb6089fd8c2723bcd3c6f18b368e12caea58e73f779534a228b7f4f88342f6`.
- Result: 1,634 checks, 0 failures in 625,986 ms.
- Supporting validation: 829 unit tests pass across 58 files; TypeScript, the
  production build, focused Phase 6 gates, and `git diff --check` pass.
- The isolated staging lifecycle passed two applications, two deterministic
  seed and semantic assertion passes, rollback/reapply, 18 service-role RPC
  checks, and 8 browser-role denials.
- All 16 projection tables have forced RLS, browser table/routine grants remain
  zero, and 32 bounded routines remain service-role-only.
- Production was not targeted. No live Moodle provider call or Moodle write
  occurred. The normalized projection repository remains disabled, and the SQL
  remains outside migration history.
- Redacted staging acceptance is recorded in
  `docs/qa-attestations/integration-phase6i-staging-promotion-20260717.json`.

The Phase 6H4 evidence below remains historical evidence for the preceding
accepted slice.

The Phase 6H4 activity-outcome observation slice adds one server-only GET route
and no portal route or portal check. It exposes bounded completion and released
score summaries for lesson, H5P, and SCORM activities through current normalized
relationships:

- Checked at: `2026-07-17T15:24:57.253Z`.
- QA summary artifact:
  `output/playwright/phase6h4-activity-outcomes-acceptance-20260717/portal-qa-summary.json`.
- Artifact SHA-256:
  `02d7b26dbbf4408c5c4c4be3ae225436bf27b81e503bd9438e61efca7b9060aa`.
- Result: 1,634 checks, 0 failures in 576,402 ms.
- Supporting validation: 829 unit tests pass across 58 files; TypeScript, the
  production build, and `git diff --check` pass.
- The portable PostgreSQL lifecycle passed two applications, two semantic
  assertion passes, rollback/reapply, 22 browser-role denials, and 16 bounded
  service-role calls without a remote request.
- Students receive only their own outcome, teachers only exact assigned-class
  learner outcomes, and HOD/Super Admin aggregate counts. Registrar and Branch
  Admin are denied.
- Unreleased scores and stale results fail closed. Raw tracks, interactions,
  questions, answers, files, comments, grader identity, contact data, and raw
  Moodle identifiers remain excluded.
- Focused validation was run sequentially without parallel workers to reduce
  local machine load; it preserved the same contracts, portable SQL lifecycle,
  TypeScript, focused tests, and build checks.
- The SQL is manual and unapplied, normalized runtime remains disabled, and no
  remote database, live Moodle provider, Moodle write, or portal behavior
  change occurred.

The Phase 6H3 evidence below remains historical evidence for the preceding
accepted slice.

The Phase 6H3 grade-outcome observation slice adds one server-only GET route
and no portal route or portal check. It exposes bounded gradebook and released
feedback summaries through current normalized relationships:

- Checked at: `2026-07-17T14:13:29Z`.
- QA summary artifact:
  `output/playwright/phase6h3-grade-outcomes-acceptance-20260717/portal-qa-summary.json`.
- Artifact SHA-256:
  `1803e8f9fbb634daae04b843c117dffcea6b8cd964de2d4d84d8b5bb01cc3487`.
- Result: 1,634 checks, 0 failures in 576,782 ms.
- Supporting validation: 822 unit tests pass across 58 files; TypeScript, the
  production build, and `git diff --check` pass.
- The portable PostgreSQL lifecycle passed two applications, two semantic
  assertion passes, rollback/reapply, 22 browser-role denials, and 16 bounded
  service-role calls without a remote request.
- Students receive only their own explicitly released outcome, teachers only
  exact assigned-class learner outcomes, and HOD/Super Admin aggregate counts.
  Registrar and Branch Admin are denied.
- Unreleased learner outcomes, unreleased feedback, unsafe feedback, and stale
  results fail closed. Questions, answers, files, comments, grader identity,
  contact data, and raw Moodle identifiers remain excluded.
- Focused validation was run sequentially without parallel workers to reduce
  local machine load; it preserved the same contracts, portable SQL lifecycle,
  TypeScript, focused tests, and build checks.
- The SQL is manual and unapplied, normalized runtime remains disabled, and no
  remote database, live Moodle provider, Moodle write, or portal behavior
  change occurred.

The Phase 6H2 evidence below remains historical evidence for the preceding
accepted slice.

The Phase 6H2 quiz-attempt observation slice adds one server-only GET route and
no portal route or portal check. It exposes bounded quiz-attempt summary state
through current normalized relationships:

- Checked at: `2026-07-17T12:46:17.298Z`.
- QA summary artifact:
  `output/playwright/phase6h2-quiz-attempts-acceptance-20260717/portal-qa-summary.json`.
- Artifact SHA-256:
  `0320742824f6d36734fa226cbae148105a6f6cd37e7b8651452f976796f561aa`.
- Result: 1,634 checks, 0 failures in 576,871 ms.
- Supporting validation: 815 unit tests pass across 58 files; TypeScript, the
  production build, and `git diff --check` pass.
- The portable PostgreSQL lifecycle passed two applications, two semantic
  assertion passes, rollback/reapply, 22 browser-role denials, and 16 bounded
  service-role calls without a remote request.
- Students receive only their own attempt, teachers only exact assigned-class
  learners, and HOD/Super Admin aggregate counts. Registrar and Branch Admin
  are denied.
- Preview attempts and stale results fail closed. Question text, answers,
  feedback, files, comments, contact data, and raw Moodle identifiers remain
  excluded.
- `npm run verify:phase6h2-fast` preserves eight contract gates and seven
  focused implementation gates and completes in about 3.8 seconds on a warm
  workspace.
- The SQL is manual and unapplied, normalized runtime remains disabled, and no
  remote database, live Moodle provider, Moodle write, or portal behavior
  change occurred.

The Phase 6H1 evidence below remains historical evidence for the preceding
accepted slice.

The Phase 6H1 assignment-result observation slice adds one server-only GET
route and no portal route or portal check. It exposes only bounded assignment
submission and grade-result state through current normalized relationships:

- Checked at: `2026-07-17T10:56:00Z`.
- QA summary artifact:
  `output/playwright/phase6h1-assignment-results-acceptance-20260717/portal-qa-summary.json`.
- Artifact SHA-256:
  `a3a2d5e578b814c02b2f3e01f56966fa6073062a29a800c2ca6b631716d19683`.
- Result: 1,634 checks, 0 failures in 579,569 ms.
- Supporting validation: 809 unit tests pass across 58 files; TypeScript, the
  production build, and `git diff --check` pass.
- The portable PostgreSQL lifecycle passed two applications, two semantic
  assertion passes, rollback/reapply, 22 browser-role denials, and 16 bounded
  service-role calls without a remote request.
- Students receive only their own result, teachers only exact assigned-class
  learners, and HOD/Super Admin aggregate counts. Registrar and Branch Admin
  are denied.
- Stale results fail closed. Files, answers, comments, feedback, grader
  identity, contact data, and raw Moodle identifiers remain excluded.
- `npm run verify:phase6h1-fast` preserves seven contract gates and six focused
  implementation gates and completes in about 3.8 seconds on a warm workspace.
- The SQL is manual and unapplied, normalized runtime remains disabled, and no
  remote database, live Moodle provider, Moodle write, or portal behavior
  change occurred.

The Phase 6G evidence below remains historical evidence for the preceding
accepted slice.

The Phase 6G assessment-status observation slice adds one server-only GET route
and no portal route or portal check. It exposes only assignment and quiz
definitions plus bounded schedule state for an exact authorized class:

- Checked at: `2026-07-17T09:39:52Z`.
- QA summary artifact:
  `output/playwright/phase6g-assessment-status-acceptance-20260717/portal-qa-summary.json`.
- Artifact SHA-256:
  `b73f22c8efc95cf57dda64f9bece4e1b0d9f382a199593b98ce01ea610cfd08c`.
- Result: 1,634 checks, 0 failures in 584,906 ms.
- Supporting validation: 783 unit tests pass across 58 files; TypeScript, the
  production build, and `git diff --check` pass.
- The portable PostgreSQL lifecycle passed two applications, two semantic
  assertion passes, rollback/reapply, 22 browser-role denials, and 14 bounded
  service-role calls without a remote request.
- Students are limited to their own exact class enrollment, teachers to a
  currently assigned class, HOD to department scope, and Super Admin to global
  scope. Registrar and Branch Admin are denied.
- Submissions, attempts, answers, grades, scores, feedback, completion, contact
  data, and raw Moodle identifiers remain outside this route.
- `npm run verify:phase6g-fast` preserves six contract gates and five focused
  implementation gates and completes in about 2.9 seconds on a warm workspace.
- The SQL is manual and unapplied, normalized runtime remains disabled, and no
  remote database, live Moodle provider, Moodle write, or portal behavior
  change occurred.

The Phase 6F evidence below remains historical evidence for the preceding
accepted slice.

The Phase 6F enrollment/group observation slice adds one server-only GET route
and no portal route or portal check. It establishes the bounded read-only
relationship projection needed before any enrollment, roster, completion, or
outcome portal wiring:

- Checked at: `2026-07-17T06:54:31.551Z`.
- QA summary artifact:
  `output/playwright/phase6f-enrollment-group-acceptance-20260717/portal-qa-summary.json`.
- Artifact SHA-256:
  `6838cef5036ec614197f584fb482ca20bfff04722755960d9b50a1a113cc99d1`.
- Result: 1,634 checks, 0 failures in 578,246 ms.
- Supporting validation: 772 unit tests pass across 58 files; TypeScript, the
  production build, and `git diff --check` pass.
- The portable PostgreSQL lifecycle passed two applications, two semantic
  assertion passes, rollback/reapply, 14 browser-role denials, and 8 bounded
  service-role calls without a remote request.
- Teachers receive only exact currently assigned class person-level IDs. HOD
  and Super Admin receive aggregate counts only. Student, Registrar, and Branch
  Admin are denied.
- `npm run verify:phase6f-fast` preserves five contract gates and four focused
  implementation gates and completes in about 3.4 seconds on a warm workspace.
- The SQL is manual and unapplied, normalized runtime remains disabled, and no
  remote database, live Moodle provider, Moodle write, or portal behavior
  change occurred.

The Phase 6E user-mapping evidence below remains historical evidence for the
preceding accepted slice.

The Phase 6E exact user-mapping authority slice adds no route or portal check.
It preserves the current scope while proving the server-only prerequisite for
future enrollment, roster, completion, and outcome projections:

- Checked at: `2026-07-17T05:45:31Z`.
- QA summary artifact:
  `output/playwright/phase6e-user-mapping-acceptance-20260717/portal-qa-summary.json`.
- Artifact SHA-256:
  `8101d6e97fc4843b710e7e5945c03a30568358c40b88b3f9815de441a6d5d63e`.
- Result: 1,634 checks, 0 failures in 578,448 ms.
- Supporting validation: 763 unit tests pass across 58 files; TypeScript and the
  production build pass.
- The portable PostgreSQL lifecycle passed two applications, two semantic
  assertion passes, rollback/reapply, 8 browser-role denials, and 8 bounded
  service-role calls.
- `npm run verify:phase6e-fast` is the focused inner loop and completes in about
  2 seconds on a warm workspace.
- The SQL is manual and unapplied, runtime remains disabled, and no remote
  database, Docker stack, provider request, Moodle write, or portal behavior
  change occurred.

The Phase 6D course-content evidence below remains historical evidence for the
preceding accepted slice.

The Phase 6D course-content detail slice intentionally adds four protected
routes across desktop and mobile plus one complete server-boundary workflow.
The current evidence is:

- Checked at: `2026-07-17T04:27:48Z`.
- QA summary artifact:
  `output/playwright/integration-phase6d-final-20260717/portal-qa-summary.json`.
- Artifact SHA-256:
  `ad31884c3e3cc9edf5e34522a9f3d55f6604190c4a9efbb8cd11f8fc5494a722`.
- Result: 1,634 checks, 0 failures in 578,333 ms.
- Supporting validation: 758 unit tests pass across 58 files; TypeScript and the
  production build pass.
- Focused browser evidence: 6 checks, 0 failures at
  `output/playwright/integration-phase6c-focused-20260717-r2/portal-qa-summary.json`.
- `npm run verify:phase6c-fast` is the focused inner loop and completes in about
  3 seconds on a warm workspace. It preserves both portable PostgreSQL gates,
  TypeScript, the Phase 6 contracts, and the focused projection test suites.
- No remote database, Docker stack, live Moodle provider, or Moodle write was
  used. Phase 6A/6B SQL remains manual and unapplied.

The Phase 6C catalog evidence below remains historical evidence for the
preceding accepted slice.

The Phase 6C catalog portal wiring intentionally adds four checks to the
accepted scope: server-derived catalog settlement plus unexpected browser
console error detection in focused and complete runs. The current evidence is:

- Checked at: `2026-07-17T03:21:24.316Z`.
- QA summary artifact:
  `output/playwright/integration-phase6c-final-20260717/portal-qa-summary.json`.
- Artifact SHA-256:
  `4f3cd344bbe01e7a9517ebea53289af005815e8166fbd74746f99c39947c7e6c`.
- Result: 1,602 checks, 0 failures in 573,395 ms.
- Supporting validation: 715 unit tests pass across 58 files; TypeScript and the
  production build pass.
- Focused browser evidence: 6 checks, 0 failures at
  `output/playwright/integration-phase6c-focused-review2-20260717/portal-qa-summary.json`.
- The portal reads only the same-origin Nile Learn projection API, validates the
  complete DTO, and provides explicit loading, empty, unavailable, stale,
  partial, and retry states. It has no local-state authority fallback, direct
  browser Moodle request, or write action.
- Phase 6A and 6B SQL remains manual and unapplied; normalized runtime remains
  disabled. No remote database, Docker stack, live Moodle provider, or provider
  credential was used in this slice.

The Phase 6B observation and fast-runner evidence below remains the previous
accepted baseline and records the optimization work that this slice preserves.

The Phase 6B observation and fast-runner slice preserved the complete route,
workflow, denial, accessibility, responsive, and console matrix:

- Checked at: `2026-07-17T01:58:41.068Z`.
- QA summary artifact:
  `output/playwright/integration-phase6b-fast-final-20260717/portal-qa-summary.json`.
- Artifact SHA-256:
  `d90e32ab7cf4d145269ba2081513f82999f445d752b37176775b005227c43689`.
- Result: 1,598 checks, 0 failures in 568,367 ms.
- Supporting validation: all static and portable PostgreSQL, session, and Nile
  Forms gates passed; 700 unit tests passed across 56 files; TypeScript and the
  production build passed in the same `scripts/verify.sh` run.
- The Phase 6A and 6B packages add server-only normalized authority, exact
  Moodle course mappings, immutable bounded observations, deterministic
  freshness, and retained sanitized projection contracts. Their reviewed SQL
  remains unapplied and the runtime flag remains disabled.
  Approved staging promotion, live provider proof, remaining projection
  families, and portal UI wiring are still pending; production and portal Moodle
  writes remain disabled.

The accepted runner optimization preserves the exact 1,598-check contract,
uses deterministic hard navigation between stateful workflows, batches route
matrices in groups of 12, and settles each route across two animation frames.
Compared with the previous 619,718 ms acceptance run, this run completed 8.3%
faster. Use `npm run verify:phase6b-fast` for the focused Phase 6B loop,
`npm run verify:integration-fast` for the complete implementation loop, and
`QA_ONLY_WORKFLOWS="<exact workflow>" npm run verify:focused-fast` for one
changed browser workflow. Only unfiltered `scripts/verify.sh` certifies this
baseline.

The Phase 6B inner loop completes in about 3 seconds on this workspace and the
complete integration loop in about 6 seconds. Both run independent checks in
parallel, enforce a bounded per-command timeout, and terminate active child
process groups on interruption. The focused loop now covers normalized-session
separation, retained-payload sanitizer equivalence, projection hash and
retention validation, partial catalog availability, mapping scope drift, and
current-authority denial without contacting Moodle or a remote database.

This is the current protected baseline. The previous 1,509/0 evidence remains
below as historical acceptance for the earlier route matrix.

## Moodle M2B Preservation Evidence

The synthetic Moodle sandbox write proof did not replace the accepted
single-run `1,598/0` baseline. After all non-browser verification gates passed,
an external process `SIGTERM` interrupted the first browser run and the QA
runner correctly recorded the interruption as a failure. The same complete
coverage was then partitioned with the runner's existing role filter across
isolated servers and data directories:

- Public Nile Forms and role denials: 20 checks, 0 failures.
- Student: 363 checks, 0 failures.
- Teacher: 349 checks, 0 failures.
- Registrar and HOD: 591 checks, 0 failures.
- Branch Admin and Super Admin: 696 checks, 0 failures.

The 2,019 executed checks include repeated common public, authentication, and
shell assertions in each shard. The evidence therefore preserves, but does not
renumber, the official baseline. Exact artifacts and provider cleanup evidence
are recorded in `docs/moodle-m2b-write-proof-evidence-20260713.md`.

## Moodle M2C-R Historical Partial Evidence

The partial M2C-R provider-contract run did not change the accepted application
baseline. After sandbox cleanup and credential teardown, the full repository
gate completed in one run:

- QA summary artifact:
  `output/playwright/moodle-m2c-read-partial-20260713/portal-qa-summary.json`.
- Portal QA: 1,598 checks, 0 failures.
- Supporting validation: all static and portable PostgreSQL, session, and Nile
  Forms gates passed; 572 unit tests passed across 50 files; TypeScript and the
  production build passed.

That provider result remained partial at 26/31 because H5P and SCORM fixtures
were not available at that time. The historical boundary and stop decision are
recorded in `docs/moodle-m2c-read-closure-evidence-20260713.md`.

## Previous 1,509 Preservation Evidence

The previous accepted count was expanded after Nile Forms online, registered promotion,
offline, and finite-migration routes were verified with the existing academic,
delivery, attendance, linked-admissions, and assignment-publication regression
suite:

- Checked at: `2026-07-12T11:58:47Z`.
- Validation command:
  `QA_OUTPUT_DIR=output/playwright/moodle-read-foundation-20260712 QA_PORT=3052 QA_SESSION=moodle-read-foundation-20260712 scripts/verify.sh`.
- QA summary artifact:
  `output/playwright/moodle-read-foundation-20260712/portal-qa-summary.json`.
- Result: 1,509 checks, 0 failures.
- Supporting validation: TypeScript passed, 478 unit tests passed across 40
  files, and the
  production build passed. The repository verification gate is recorded
  separately after this evidence update.

The previously accepted frozen run recorded an identical source fingerprint
before and after its complete browser matrix. The HOD certificate workflow also
passed its focused `6/6` rerun before that matrix completed, so the prior
same-route transient `Not Found` miss is not recorded as a product failure.

The expanded checks verify that Student management/review access is denied,
Registrar cannot manage a global Super Admin form, denied builder/publish URLs
render an actionable scoped state, and Super Admin can assign then revoke one
authorized publication recipient through the browser UI. A route-matrix chunk
may retry once after a missing-shell crash; the retry repeats every assertion,
retains diagnostics, and does not convert a persistent failure into a pass.

This evidence proves regression preservation for exact enrollment assignment,
active delivery gates, registrar branch scope, attendance session state,
branch-scoped class creation and updates, HOD-scoped course-run creation,
room/capacity/schedule constraints, enrollment transfer and status transitions,
atomic roster membership, class-session rescheduling and cancellation,
attendance-history locks, learner notifications, and scoped audit projection in
the compatibility state. It also proves exact attendance-exception submission,
branch-scoped approval/rejection, atomic excused-status and attendance-rate
updates, and role-scoped exception/audit projections. It does not prove a
production durable-session activation, remote Supabase promotion, or normalized
workflow persistence. Assignment creation now produces an exact course-run
draft; assigned Teacher and scoped HOD or Super Admin actions can edit and
publish it, only published or completed rows reach Student projections, terminal
and submission guards preserve history, and publish/cancel/close transitions
write learner notifications and scoped audit evidence. It does not prove a
Moodle assignment sync or production normalized assignment persistence.
Quiz creation now produces an exact course-run draft; question-set, future
delivery-window, and active-class checks guard publication; student attempts
are denied before publication; and cancellation or editing is locked after an
attempt. Closed quizzes retain attempts and grades, while the Student view is
read-only. This does not prove a Moodle quiz sync or production normalized quiz
persistence.

Assignment and manual-quiz reviews now finalize exact pending submissions and
attempts once. Missing, malformed, out-of-scope, and already-finalized reviews
are rejected before mutation. A successful review preserves the result,
gradebook entry, learner notification, and scoped audit evidence; a manual quiz
submission also alerts the assigned Teacher. Regrade and appeal history remain
outside this baseline until a separate authority model is approved.

## What This Baseline Proves

- The accepted route matrix and portal workflows completed without a recorded
  failure in the controlled alpha fixture.
- The current portal run completed at 1,598/0. TypeScript, 528 unit tests, and
  the production build passed as separate supporting gates.
- The previous frozen portal run completed at 1,509/0 and remains historical
  evidence for its earlier source fingerprint.
- The tested role routes, actions, labels, and responsive assertions matched the
  current product contract.

## What This Baseline Does Not Prove

- Production-scale correctness or real legacy EMS parity.
- A live Moodle data projection, provider reconciliation, or production token.
- A completed legacy EMS migration, cutover, or balance reconciliation.
- Durable sessions across instances and deployments.
- Normalized Postgres authority, RLS coverage, concurrent-write safety, or
  transaction rollback.
- Atomic domain, audit, and outbox persistence.
- Delivery through payment, email/SMS/WhatsApp, meeting, or media providers.
- Security of credentials that were exposed outside the repository.

These require separate phase-specific evidence. A green portal run must never
be used to claim that an unimplemented provider or persistence boundary works.

Admin governance is now separated across focused Simple UI routes:

- `/app/admin/roles` for role overview and role summaries.
- `/app/admin/permissions` for access rules and permission editing.
- `/app/admin/branches` for branch management.

Admin reports are now separated across focused report routes:

- `/app/admin/reports` for report overview.
- `/app/admin/reports/attendance` for attendance records.
- `/app/admin/reports/finance` for payment and invoice rows.
- `/app/admin/reports/certificates` for certificate status rows.
- `/app/admin/reports/admissions` for leads, applications, and placement rows.
- `/app/admin/reports/classes` for class-group rows.
- `/app/admin/reports/saved-views` for saved report filters.

The generic `FeaturePage` fallback route table has been reduced so routes already owned by Simple UI pages or dedicated workflow pages do not keep duplicate fallback entries.

Admin courses now follows the Simple UI split:

- `/app/admin/courses` for the course catalog and status workflow.
- `/app/admin/courses/:courseId` for one course record and its relationships.
- `/app/admin/courses/programs`, `/levels`, `/curriculum`, `/teachers`, and `/resources` for their focused course-governance lists.

Admin activity now follows the Simple UI split:

- `/app/admin/audit-logs` for search, action filtering, latest activity context, and audit CSV export.

Admin health now follows the Simple UI split:

- `/app/admin/system-health` for readiness checks, system signals, and the audited health-check action.

Admin settings and connections now follow the Simple UI split:

- `/app/admin/settings` for global platform configuration, retention, language, and audited settings saves.
- `/app/admin/integrations` for connection status review, local provider checks, and integration audit rows. Live providers remain placeholders.

Registrar students now follows the Simple UI split:

- `/app/registrar/students` for direct student creation and student records.
- `/app/registrar/students/:studentId` for one student lifecycle record, status, placement, enrollment, and audit context.

Registrar admissions now follows the Simple UI split:

- `/app/registrar/leads` and `/app/registrar/leads/:leadId` for enquiry intake and lead conversion.
- `/app/registrar/applications` and `/app/registrar/applications/:applicationId` for application intake and enrollment handoff preparation.
- `/app/registrar/placement-tests` and `/app/registrar/placement-tests/:bookingId` for placement booking and result recording.

Registrar payments now follows the Simple UI split:

- `/app/registrar/payments` for invoice search, balance review, and receipt recording.

Registrar enrollments now follows the Simple UI split:

- `/app/registrar/enrollments` for assignment handoff, course run selection, class selection, and portal activation.

Registrar schedule now follows the Simple UI split:

- `/app/registrar/schedule` for placement, trial, and admissions event booking.

Registrar classes now follows the Simple UI split:

- `/app/registrar/classes` for class capacity, branch-scoped assignment visibility, and enrollment readiness.

Branch rooms now follows the Simple UI split:

- `/app/branch/rooms` for branch-scoped room readiness, room status updates, and room creation.

Branch payments now follows the Simple UI split:

- `/app/branch/payments` for branch-scoped invoice review, balance status, and internal payment recording.

Branch reports now follows the Simple UI split:

- `/app/branch/reports` for branch-scoped attendance, finance, enrollment rows, saved views, and CSV export.

Branch schedule now follows the Simple UI split:

- `/app/branch/schedule` for branch-scoped event booking, room/class selection, schedule review, and class-session creation.

Branch attendance now follows the Simple UI split:

- `/app/branch/attendance` for branch-scoped roster attendance, session filters, status marking, notes, and save state.

HOD reports now use a dedicated route owner:

- `/app/hod/reports` for department-scoped academic reports, saved report views, and CSV export.

HOD workflow routes now use a dedicated route owner:

- `/app/hod/courses` for department-scoped course status review.
- `/app/hod/curriculum` for module creation and curriculum review.
- `/app/hod/schedule` for academic schedule review.
- `/app/hod/assessments` for department-scoped assessment creation, grading, and review.
- `/app/hod/certificates` for certificate approval, rejection, issue checks, and verification context.

Teacher assignment routes now use a dedicated route owner:

- `/app/teacher/assignments` for the assignment list.
- `/app/teacher/assignments/new` for one assignment create flow.
- `/app/teacher/assignments/:assignmentId` for one assignment record and submission review context.

Student assessment detail routes now use a dedicated route owner:

- `/app/student/assignments/:assignmentId` for one assignment submission.
- `/app/student/quizzes/:quizId` for one quiz attempt.

This baseline must remain clean for future changes. If a task changes UI, workflows, routes, RBAC, domain actions, or server action gates, run validation and confirm the portal QA result before reporting completion.

## Required Discipline

- Keep each change small and scoped.
- Do not change unrelated routes, tests, or business logic.
- Preserve RBAC and server-side action gates.
- Preserve audit logging for workflow mutations.
- Update tests or portal QA only when product behavior intentionally changes.
- Do not integrate external systems until internal workflows and data architecture are stable.

## Reporting

Every implementation report must include:

- exact files changed
- exact commands run
- validation result
- whether portal QA remains clean
