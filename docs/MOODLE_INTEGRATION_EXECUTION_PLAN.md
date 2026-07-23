# Nile Learn Moodle Integration Execution Plan

## Goal

Integrate Moodle as the server-only writable authority for Moodle-managed
learning content and outcomes while Nile Learn remains the
authority for identity grants, organization, admissions, enrolments, class
delivery, schedules, attendance, finance, certificates, communication, and
audit. Preserve exact external IDs and reconciliation evidence while exposing
full CRUD through typed commands or authenticated native Moodle launches,
without dual ownership.

ADR-003 governs the historical first projection phase. ADR-010 establishes
Moodle-owned learning authority, and ADR-011 authorizes full synthetic CRUD in
the dedicated sandbox. The earlier bounded synthetic proofs accepted by
`docs/decisions/ADR-008-moodle-synthetic-sandbox-write-proof.md`, followed by
the isolated M2C provider-contract campaign accepted by
`docs/decisions/ADR-009-moodle-comprehensive-sandbox-contract-campaign.md`.
remain historical evidence. Production activation still follows
`docs/NILE_LEARN_MASTER_PLAN.md`.

## Current Sandbox CRUD Order

The dedicated sandbox is fully writable for marker-bound synthetic data. The
campaign must test complete create, read, update, archive/restore, and safe
delete lifecycles for Moodle-owned users, enrolments, groups, delivery courses,
sections, content, files, assignments, submissions, quizzes, questions,
attempts, grades, feedback, completion, and supported activities.

Each operation requires an exact service-function or `local_nilelearn`
allowlist, a mapped synthetic actor, idempotency, read-back verification,
unknown-outcome reconciliation, ordered cleanup, repeated cleanup, and token
teardown. Records with learner history are archived rather than destructively
deleted. No real PII may enter the sandbox.

## Verified Sandbox Contract

The approved practice site runs Moodle 4.5.12+ with REST enabled and no
Attendance activity plugin. M0 found an empty site with only the built-in
mobile service. M2 then added custom authorised-users-only service ID `2`,
dedicated service user ID `4`, system-context role ID `10`, and a synthetic
course dataset. The built-in mobile service still exposes a broad 437-function
surface and is not an acceptable production integration boundary.

The custom service exposes exactly the 31 functions in this plan, but Moodle
capability inspection surfaced broader effective capabilities than the intended
production read contract. Exact service-function containment is therefore
proven; production minimum privilege is not. The sandbox role and service must
not be promoted or copied to production without a fresh capability audit,
normal-login denial proof, and denied-operation tests.

The administrator credential supplied for discovery must never be stored or
used by the Nile Learn runtime. The M2 service token was used only from the local
command environment and is intentionally omitted from all evidence. Rotation,
revocation, and synthetic-object cleanup still require verified closure.

## Authority Boundary

| Family                                                            | Initial authority                  | Nile Learn behavior                                         |
| ----------------------------------------------------------------- | ---------------------------------- | ----------------------------------------------------------- |
| Moodle course IDs, sections, modules, and Moodle-managed content  | Moodle                             | Scoped projection and full audited CRUD commands            |
| Moodle enrolment observation                                      | Moodle                             | Reconciliation signal, never automatic Nile role authority  |
| Moodle completion, attempts, grades, and feedback                 | Moodle                             | Scoped projections, commands, and native Moodle interaction |
| Nile course offering, class group, teacher assignment, and roster | Nile Learn                         | Canonical                                                   |
| Attendance                                                        | Nile Learn                         | Canonical; the sandbox has no Attendance plugin             |
| Files and media                                                   | Future approved storage/Moodle URL | Metadata only in this phase                                 |

No field may have two writable authorities. A missing external mapping remains
unmatched; titles and names are never matching keys.

## Historical Initial Read Function Allowlist

The first custom service may contain only functions required by an accepted
projection. Start with:

- `core_webservice_get_site_info`
- `core_course_get_categories`
- `core_course_get_courses_by_field`
- `core_course_get_contents`
- `core_course_get_course_module`
- `core_enrol_get_enrolled_users`
- `core_enrol_get_users_courses`
- `core_user_get_users_by_field`
- `core_group_get_course_groups`
- `core_group_get_course_groupings`
- `core_group_get_course_user_groups`
- `core_completion_get_activities_completion_status`
- `core_completion_get_course_completion_status`
- `gradereport_user_get_grade_items`
- `mod_assign_get_assignments`
- `mod_assign_get_submissions`
- `mod_assign_get_grades`
- `mod_quiz_get_quizzes_by_courses`
- `mod_quiz_get_user_attempts`
- `mod_quiz_get_attempt_review`
- `mod_h5pactivity_get_h5pactivities_by_courses`
- `mod_h5pactivity_get_attempts`
- `mod_h5pactivity_get_results`
- `mod_scorm_get_scorms_by_courses`
- `mod_scorm_get_scorm_sco_tracks`
- `mod_lesson_get_lessons_by_courses`
- `mod_lesson_get_user_grade`
- `mod_book_get_books_by_courses`
- `mod_page_get_pages_by_courses`
- `mod_resource_get_resources_by_courses`
- `mod_url_get_urls_by_courses`

Calendar, Moodle messaging, BigBlueButton, user creation, course creation,
enrolment mutation, grade mutation, quiz attempts, assignment submission, and
all other write-capable functions stayed outside that historical initial
service. ADR-011 now permits them in separate exact sandbox CRUD services or
the reviewed plugin manifest.

The service role must be reviewed against the capability list Moodle displays
for every function. If a function requires a write-level capability merely to
expose hidden data, omit hidden data rather than granting broad write authority.

## Delivery Slices

### M0 - Capability Discovery

Status: complete.

- Verify Moodle version, protocols, feature flags, plugins, service inventory,
  and API function surface.
- Record missing plugins and empty-data constraints.
- Make no Moodle changes.

### M1 - Server Read Client And Safe Probe

Status: accepted as a disabled local foundation on 2026-07-12.

- Add a strict server-only REST client with HTTPS validation, timeout, error
  classification, JSON validation, and the allowlist above.
- Require `MOODLE_READ_ONLY_ENABLED=1`, `MOODLE_BASE_URL`,
  `MOODLE_SERVICE`, `MOODLE_TOKEN`, and an exact `MOODLE_ALLOWED_HOSTS`
  allowlist.
- Expose only a Super-Admin status/capability probe.
- Report `ready` only when the token exposes exactly the approved read
  functions, with no missing or unexpected function.
- Return no token, password, debug trace, or private provider payload.
- Keep the feature disabled by default and preserve all current portal data.
- Prove behavior with deterministic mocked provider fixtures.

Acceptance evidence: 16 focused Moodle tests, two independent boundary reviews
with no remaining high or medium finding, and the protected 1,509/0 portal
matrix in
`output/playwright/moodle-read-foundation-20260712/portal-qa-summary.json`.
No live service token or projection was used for that M1 acceptance.

### M2 - Dedicated Sandbox Service And Test Dataset

Status: partially evidenced on the dedicated practice sandbox on 2026-07-12.
The exact service-function boundary and all available fixture-backed reads are
proven. Full fixture closure, production minimum privilege, token lifecycle, and
cleanup are not proven. This remains sandbox evidence and does not include
production Moodle, real student data, or Nile Learn runtime enablement.

Proven sandbox setup and fixtures:

- Moodle `4.5.12+ (Build: 20260708)` with the installed Web services
  authentication method and REST enabled;
- authorised-users-only custom service ID `2`, dedicated service user ID `4`,
  and system-context read role ID `10`;
- synthetic teacher user ID `5`, student user ID `6`, course ID `2`, and group
  plus grouping fixtures; and
- assignment, quiz, URL, Book, Page, and Lesson fixtures. Attendance was not
  installed and BigBlueButton was not enabled.

The live M1 probe returned exactly `31/31` approved functions, with no missing
or unexpected function. This proves the custom service allowlist, not the full
effective capability set of the underlying account or role.

The final live validator result is intentionally recorded as partial rather
than green:

| Result           | Count | Scope                                                               |
| ---------------- | ----: | ------------------------------------------------------------------- |
| Passed           |    25 | Available synthetic fixtures returned valid live contract responses |
| Fixture-only gap |     3 | H5P activity, attempts, and results                                 |
| Fixture-only gap |     2 | SCORM activity and SCO tracks                                       |
| Fixture-only gap |     1 | Resource file activity                                              |

The six gaps are not service-function failures. The Codex in-app Browser cannot
upload the local H5P, SCORM package, and Resource files needed to create those
fixtures, so the validator could not execute those contracts against real
fixture IDs.

Only synthetic identities and course content were created. No real student or
staff PII or Nile Learn admissions data was copied. No Moodle response was
persisted to Nile Learn or projected into any portal, and no runtime flag was
enabled.

Remaining M2 closure risks:

- capability review exposed broader effective permissions than the intended
  production read boundary, so role ID `10` is sandbox evidence rather than a
  production role template;
- the H5P, SCORM, and Resource contracts still need approved upload-capable
  fixture creation and a new full validator run;
- token rotation or revocation and cleanup or disablement of service ID `2`,
  service user ID `4`, role ID `10`, and the synthetic dataset remain
  unverified; and
- the current token state must not be assumed from this run. Future use requires
  explicit rotation or revocation evidence.

Student photographs, passports, national IDs, guardian documents, consent
evidence, addresses, and admissions notes remain Nile Learn data and must not
be copied into Moodle. Moodle receives only the minimum learning identity and
course enrolment mapping after Nile Learn activation.

### M2B - Synthetic Sandbox Write Proof

Status: accepted as dedicated-practice-sandbox evidence on 2026-07-13. The
redacted execution and teardown record is
`docs/moodle-m2b-write-proof-evidence-20260713.md`. This is not production
integration acceptance.

- Keep M2 read credentials and service unchanged.
- Create a separate disabled-by-default server client and an
  authorised-users-only write service exposing exactly the eleven functions in
  ADR-008.
- Require the approved hostname, a separate token and service name, an exact
  synthetic acknowledgement, the existing synthetic course ID, and a reviewed
  Moodle learner role ID.
- Generate a fresh canonical `NILE-M2B-*` marker by default for a one-process
  run. If cross-process recovery is required, set
  `MOODLE_SANDBOX_WRITE_RUN_MARKER` before the first invocation and reuse only
  that same canonical marker after interruption so the next process can
  reconcile the same fake user and group keys before retrying or cleaning up.
- Create or reconcile one marker-bound fake user, update one harmless display
  field, manually enrol the user, create one marker-bound group, and add the
  user to that group.
- Rerun the same operation keys and prove no duplicate active user, enrolment,
  group, or membership is created.
- Verify course-scoped transitions through the separate M2 read service. Use
  the write service's marker-only user lookup solely while the synthetic user
  is not yet visible to the course-scoped read credential.
- Remove membership, delete the group, unenrol the user, delete the user, and
  prove the active marker is absent. Record Moodle's expected deleted-user
  tombstone as provider behavior rather than claiming transactional rollback.
- Store only redacted local evidence. Never store tokens, passwords, raw
  provider payloads, or provider-controlled errors.

M2B excludes course/content/activity creation, files, grades, attempts,
submissions, messaging, attendance, calendars, role or token administration,
production runtime wiring, normalized persistence, and real user data.

### M2C - Comprehensive Synthetic Provider Contracts

Status: approved and in progress on the dedicated practice sandbox. This is not
production integration acceptance.

M2C-R reached a sanitized partial result of 26 passing reads and five
fixture-only H5P/SCORM gaps on 2026-07-13. The resumed 2026-07-16 run used an
administrator-private, temporary WebDAV fixture path, passed all 31 approved
reads twice with identical fingerprints, removed every disposable remote and
local artifact, revoked temporary capabilities, and proved retired-token
rejection. M2C-R is accepted. The closure proof is
`docs/moodle-m2c-read-closure-evidence-20260716.md`. The ownership matrix is
accepted, and ADR-011 now authorizes all remaining synthetic CRUD lanes.

The 2026-07-16 closure validator requires a separate disposable interaction
learner for H5P and SCORM evidence. It accepts H5P results only when an attempt
contains at least one nested interaction result, and it accepts SCORM tracks
only when at least one supported status, score, or time metric is present.
Every successful function is hashed from its sanitized provider-neutral model;
the validator emits stable function, family, and combined fingerprints for the
required two-pass comparison. All fixture environment names are documented as
empty local-command placeholders in `.env.example`.

Run M2C in serial, isolated lanes:

1. **M2C-R read closure**: add sanitized typed models for Resource, SCORM, and
   H5P, create disposable fixtures, and make every one of the 31 approved read
   functions pass the same parser, privacy, boundedness, and fixture contract.
2. **M2C-C content fixtures**: prove disposable course and content fixture
   create/read/update/remove behavior without making an administrator token a
   connector credential.
3. **M2C-L learner interactions**: use separate synthetic learner services for
   assignment submission, quiz attempt, Lesson attempt, SCORM tracking, H5P
   attempt where supported, and manual completion.
4. **M2C-O outcomes**: use a separate synthetic teacher/outcome service for
   assignment grading, feedback, gradebook, completion, and report inputs.
5. **M2C-P operations evidence**: test only bounded synthetic Moodle messaging
   and calendar behavior whose durable side effects and cleanup can be recorded
   honestly.
6. **M2C-D authority denials**: prove that attendance, certificates, Nile
   messages, Nile schedules, private student documents, and portal actions do
   not gain Moodle write authority.

Each lane has an exact service-function allowlist, separate expiring token,
synthetic persona, marker-bound fixture set, before-state hashes, two-pass
ensure or replay evidence where safe, timeout reconciliation, ordered cleanup,
after-state hashes, repeated cleanup, and final invalid-token proof. Store no
credentials or raw provider payloads. Preserve semantic ordering in hashes and
record per-family hashes plus one combined root.

M2C must not activate provider persistence, portal projections, direct portal
writes, a runtime flag, or remote Supabase behavior. Quiz, Lesson, SCORM, H5P,
grade history, completion events, messages, and notifications can leave durable
provider history; use disposable fixtures and report restoration separately
from deletion.

### M3 - Provider-Neutral Projection And Command Persistence

The normalized foundation and Phase 6K command contract exist as manual,
runtime-disabled packages. Promote them only through their accepted database
gates.

- Use `integration_connections`, `external_records`, `sync_cursors`,
  `sync_runs`, `sync_run_items`, and `reconciliation_cases`.
- Store source IDs, parent IDs, versions, timestamps, hashes, status, and errors.
- Prove repeated reads are idempotent and stale/missing mappings are visible.
- Never store the Moodle token or complete raw user payload in these tables.

### M4 - Role-Scoped Read Models

- Super Admin: connection health, run history, mappings, and reconciliation.
- HOD: department course/content/outcome projection after internal mapping.
- Teacher: only mapped assigned classes and enrolled learners.
- Student: only own mapped enrolments, content, completion, grades, and feedback.
- Registrar and Branch Admin: mapping/reconciliation status only where their
  internal scope requires it; no Moodle role authority.

### M5 - Scheduling, Replay, And Operations

- Add bounded background reads, cursor checkpoints, retries, rate limits,
  observability, cancellation, and replay.
- Require source-hash idempotency and item-level reconciliation.
- Preserve audit evidence for operator actions and mapping decisions.

### M6 - Full Sandbox CRUD And Controlled Runtime Activation

Full synthetic sandbox CRUD is approved by ADR-011. Implement and test every
Moodle-owned operation family through exact services or `local_nilelearn`,
including replay, read-back, reconciliation, archive/restore, safe deletion,
and cleanup. Production portal activation remains gated by normalized mappings,
transactional outbox processing, durable idempotency, actor capability checks,
operation-family acceptance, and threat review. Attendance remains in Nile
Learn and is not transferred to Moodle authority.

## Tests And Gates

Every slice must include:

- client parsing and provider error tests;
- URL/SSRF, timeout, redaction, and allowlist tests;
- route authentication and Super-Admin denial tests;
- fixture contract tests for every accepted function;
- idempotency and reconciliation tests once persistence begins;
- `npm run check`, `npm test -- --run`, and `npm run build`;
- `scripts/verify.sh` whenever portal behavior or shared runtime behavior changes;
- the protected 1,598/0 portal QA baseline.

## Stop Conditions

Stop rather than widening access when:

- a required function is missing or requires capability outside its reviewed
  CRUD operation manifest;
- the service account can use normal administrator login;
- a token would be browser-visible;
- a course/user mapping is ambiguous;
- a provider field would gain two writable authorities;
- normalized persistence or role scope is unavailable;
- the source site returns personal data outside the requested scope;
- a live call would require the supplied administrator password.
