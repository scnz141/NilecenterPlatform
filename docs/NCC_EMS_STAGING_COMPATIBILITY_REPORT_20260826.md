# NCC EMS Staging — Live Integration Compatibility Report

**Revalidated:** 2026-09-10

**Targets:**

- Current working environment: `https://ncc-ems-staging.enesekremergunesh.com/api`
- Separate unaccepted environment: `https://ems-staging.nilecenter.site/api`
- Staff workflow guide: `FRONTEND_API.md`
- Frontend parity authority: `docs/BACKEND_API_ENDPOINT_REQUIREMENTS.md`

## 1. Verdict

The NCC EMS API is now a substantial staff backend and ADR-012 designates it as
the target production authority for staff sessions and Nile-owned operational
records. It is ready for a bounded same-origin transport and staff-session
foundation, but **no complete portal is ready for broad cutover**.

The current contract is staff-only, omits required Nile Learn families, and
does not yet satisfy mutation acceptance for idempotency, concurrency,
`allowedActions`, stable errors/correlation, or bounded pagination. Student is a
hard blocker because the API defines no Student identity or own-scope surface.

## 2. Live Evidence

Read-only probes and OpenAPI inspection established:

| Evidence                         | Old working domain                                                 | New domain                |
| -------------------------------- | ------------------------------------------------------------------ | ------------------------- |
| OpenAPI title/version            | `NCC EMS API` `1.0.0`                                              | Same                      |
| Contract size                    | 92 paths, 116 operations, 117 schemas                              | Same                      |
| OpenAPI SHA-256                  | `00d752f67088976b607a1bf9efb41fa25ef930442c8c241bbc72a1182bcbab33` | Same                      |
| `GET /health`                    | `200 {"status":"ok"}`                                              | Same                      |
| Deployed frontend CORS preflight | `200`, origin allowed                                              | `400`, origin not allowed |
| Supplied staff fixture           | Authenticated Super Admin acceptance passed                        | Login remains `401`       |

Credential-bearing calls were explicitly authorized on 2026-09-10. Credentials
and tokens remained ephemeral, were never printed or written to the repository,
and each NCC session created by the audit was remotely logged out. They must
still be rotated before deployed use because they were previously pasted into
chat.

Identical OpenAPI documents prove code-contract parity only. They do not prove
database migrations, seeds, users, provider configuration, or runtime parity.
The old domain is therefore the current environment-variable-controlled staging
target; the new domain requires independent acceptance.

### 2.1 Authenticated Super Admin acceptance

The working old-domain fixture passed:

- login `200` with the documented token/user keys;
- `/auth/me` `200` with `super_admin`, session, workspace, and scope fields;
- refresh `200`, old-refresh replay `401`, and `/auth/me` with the replacement
  access token `200`;
- logout `204` and post-logout `/auth/me` `401`;
- expected active-role denial: Super Admin calling Teacher-only
  `/teacher/workspace` received `403`;
- the same login on the new domain received `401`.

Safe Super Admin reads returned `200` for sessions, users, branches,
departments, courses, classes, students, leads, placement tests, rooms,
notifications/count, audit, system health, Moodle site/catalog/category
responses, custom fields, and available organization detail records. The
fixture currently contains two staff users, one branch, and one department, but
zero courses, classes, students, leads, placement tests, rooms, and custom
fields. Nested class, enrollment, roster, attendance, grade, student-learning,
and schedule reads therefore remain untestable without synthetic operational
fixtures.

### 2.2 Moodle sandbox and NCC connector acceptance

Direct Moodle evidence established:

- Moodle `4.5.12+` build `20260708` is reachable;
- service token site-info succeeds and identifies service user ID 34 with
  username `web_service_ems`;
- Attendance `mod_attendance` version `2024082403` is installed and enabled;
- REST reads for courses, categories, and the exact service user succeed;
- the `Ems Web Service` manifest exposes 25 functions, including course,
  content, completion, user, enrollment, group, grade, and
  `mod_attendance_get_session(s)` reads.

The NCC connector is not currently operational. `/moodle/site` reports the
correct HTTPS host and a configured token, but two server-side connection tests
recorded `reachable: false`; catalog/category responses contain `Moodle could
not be reached`; Moodle user search returns `400` with the same message; and
system health is `degraded` with only Moodle in error. The same token and site
succeed directly with both server and browser-like user agents. NCC confirms
only that a token is present, not that the stored value matches. The remaining
failure boundary is NCC staging egress, DNS/TLS, stored-secret retrieval, HTTP
client behavior, or response parsing—not Moodle availability, the supplied
token, plugin, REST protocol, or Cloudflare user-agent handling.

The Moodle security posture is not acceptable for production:

- `Ems Web Service` is configured for **All users**, not Authorised users only;
- the service user appears on the service-user page, but that restriction is not
  enforced while the service remains All users;
- the system role displayed as `Web Services` has 581 capabilities set to
  Allow, including user/course deletion, role assignment, broad enrollment
  administration, site-administration visibility, and Attendance mutation,
  import, and export;
- the 25-function service allowlist limits current transport calls, but the role
  remains far broader than that allowlist and would make accidental service
  expansion dangerous.

## 3. Current Surface

The OpenAPI defines 109 bearer-protected operations and seven intentionally
public operations. Endpoint tags and operation counts are:

| Tag             | Operations | Tag              | Operations |
| --------------- | ---------: | ---------------- | ---------: |
| auth            |         13 | users            |         11 |
| branches        |          6 | departments      |          6 |
| courses         |          8 | classes          |         16 |
| students        |         10 | leads            |          5 |
| placement-tests |          6 | rooms            |          6 |
| sessions        |          4 | teacher          |          1 |
| moodle          |         10 | notifications    |          4 |
| custom-fields   |          5 | audit            |          1 |
| system          |          1 | default/liveness |          3 |

The protected surface includes:

- staff login, token rotation, logout, session revocation, invitation accept,
  self profile, active-role switching, and branch workspace switching;
- staff users, branch and department catalogs, and staff custom fields;
- Moodle site status/configuration/test and course/category/user/group pickers;
- Moodle-linked course overlays, classes, current teacher assignment, groups,
  rosters, enroll/withdraw, rooms, recurring schedule fields, and generated
  sessions;
- students, leads, direct lead conversion, and placement tests;
- scoped read-only Moodle attendance, grades, and per-student learning state;
- Teacher workspace, own notifications, scoped audit events, and operator
  health.

## 4. Portal And Family Compatibility

| Family              | Status       | Present                                                                       | Blocking gaps                                                                                                                  |
| ------------------- | ------------ | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Auth/RBAC           | `INCOMPLETE` | Complete staff token lifecycle and workspace basics                           | Student, explicit grants/permission summary, password recovery, accepted HttpOnly BFF session design                           |
| Users/organization  | `INCOMPLETE` | Users, branches, departments, custom fields                                   | Roles/access rules, programs, levels, allowed actions, pagination/versioning                                                   |
| Admissions          | `INCOMPLETE` | Leads, students, placement, direct conversion                                 | Applications, guardians as relationships, documents, reconciliation                                                            |
| Enrollment/delivery | `INCOMPLETE` | Course overlays, classes, rosters, enroll/withdraw, rooms, sessions           | Offerings/runs, full enrollment state machine, assignment history, substitutes, conflicts                                      |
| Attendance          | `INCOMPLETE` | Moodle read-only sessions and marks                                           | NCC-authoritative write/correction/exception history and cross-portal read-back                                                |
| Moodle learning     | `INCOMPLETE` | Config and documented pickers/binds/reads; direct Moodle service proof passes | NCC connector reachability, least privilege, isolated delivery courses, projections, commands, launches, files, reconciliation |
| Notifications       | `INCOMPLETE` | Own inbox/read state                                                          | Conversations, messages, recipients, attachments                                                                               |
| Audit/health        | `INCOMPLETE` | Scoped events and current operator snapshot                                   | Stable audit payload, correlation, reports, exports, readiness history                                                         |
| Finance             | `MISSING`    | —                                                                             | Invoices, payments, balances, reports                                                                                          |
| Certificates        | `MISSING`    | —                                                                             | Eligibility, approval, issue/revoke, verification/artifacts                                                                    |
| Quran/support       | `MISSING`    | —                                                                             | Plans, recitations, reviews, interventions, support cases                                                                      |
| Forms/files/public  | `MISSING`    | —                                                                             | Forms, private files, public catalog/intake/verification                                                                       |
| Student portal      | `MISSING`    | Staff may administer Student records                                          | Student login and every own-scope portal operation                                                                             |

### Portal summary

- **Super Admin:** useful organization, people, Moodle status, audit, and health
  reads exist. Roles/access rules, programs/levels, settings, reports, and
  reconciliation remain incomplete.
- **Registrar:** much of lead/student/placement/class setup exists, but the
  application and complete enrollment/payment/message/report lifecycle does
  not.
- **Branch Admin:** scoped people/class/room/session operations exist; attendance
  writes, conflict review, finance, reports, and messaging do not.
- **HOD:** scoped class/course/roster reads exist; academic governance,
  curriculum, programs/levels, moderation, certificates, and reports do not.
- **Teacher:** assigned classes/upcoming sessions, rosters, and read-only
  learning data exist; Nile attendance writes, availability, interventions,
  communication, and Moodle authoring/grading commands do not.
- **Student:** no direct contract exists.

## 5. Contract Findings

What is strong:

- Every non-public operation declares `BearerAuth`.
- Login does not need a browser-provided authoritative role.
- Active role, assigned role, workspace, and scopes are server-returned.
- The old unsafe Moodle config route has been replaced by Super-Admin-only
  redacted status; responses do not include the Moodle service token.
- User, branch, class, student, lead, placement, and session lifecycles use
  explicit status endpoints and scoped 401/403/404 behavior.
- One-time invitation and generated-password fields are documented as
  response-only and transient.

Blocking production gaps found by scanning the full OpenAPI:

- `Idempotency-Key`: 0 occurrences.
- `If-Match`, ETag, or expected-version input: 0 occurrences.
- `allowedActions`: 0 occurrences.
- correlation ID: 0 occurrences.
- cursor/next-cursor: 0 occurrences.
- freshness contract: 0 occurrences.
- Twenty 200-response collections are bare arrays.
- Errors remain FastAPI `{detail: string | validation[]}` without stable domain
  codes or retryability.
- The role enum contains five staff roles only:
  `super_admin`, `branch_admin`, `hod`, `registrar`, `teacher`.

## 6. Authority Conflicts To Correct

### Attendance

`FRONTEND_API.md` currently says Teachers write attendance in Moodle and EMS
only reads it. ADR-010 and ADR-012 keep operational attendance in the NCC
backend because it belongs to the timetable, exception, reporting, certificate,
and audit lifecycle. Moodle may receive or expose a projection; it must not be a
second writable authority.

### Moodle class isolation

The current API links one EMS course to one existing Moodle course and maps Nile
classes to groups in that shared course. Nile Learn requires one isolated Moodle
delivery course per class, cloned from an approved versioned template. This
prevents cross-class content, roster, teacher, grade, and file leakage. Groups
may still exist inside one delivery course but are not the primary class
boundary.

### Staff roles and Student

A fixed assigned-role hierarchy is not enough for the final permission model.
NCC must expose effective grants, permission summary, permitted role switches,
and current scope. Student requires its own server-authoritative session and
own-scope API before cutover.

## 7. Frontend Transport Decision

Do not store NCC access or refresh tokens in JavaScript-accessible storage and
do not call Moodle directly from the browser.

The existing Express/Vercel API remains a thin same-origin BFF that:

1. exchanges credentials with NCC;
2. rotates/revokes NCC tokens;
3. exposes Secure, HttpOnly, SameSite session cookies;
4. maps role names and snake_case DTOs into closed frontend contracts;
5. preserves 401/403/404/409/422 meaning;
6. applies family-level cutover flags and fail-closed rollback;
7. stores no competing operational business state.

The initial uncommitted `emsStaging` probe used a process-memory token map,
did not remotely revoke on unlink, could report stale link status, and exposed
three open-ended list proxies. The transport foundation replaces that design
with a sealed session cookie, verified status, remote logout, and no portal data
proxy. Credential entry belongs in real staff sign-in, not System Health.

The local staff-auth foundation now uses that BFF behind a disabled rollback
flag. Administration login derives NCC authority without a browser role claim;
session resolution, role/workspace changes, and remote logout update the sealed
cookie; Student remains on compatibility auth; and every NCC-session operational
mutation fails closed. Live acceptance still requires rotated credentials and
staff-role fixtures.

## 8. Backend-Team Delivery Order

Immediate acceptance blockers:

1. Diagnose NCC staging outbound DNS/TLS/network handling, stored-token
   retrieval, HTTP client behavior, and response parsing for the exact Moodle
   host. Log a server-side correlation ID and safe failure category; do not
   return a raw exception or token.
2. Change `Ems Web Service` to Authorised users only and retain only service user
   ID 34.
3. Replace the 581-Allow `Web Services` role with a reviewed least-privilege role
   containing only capabilities required by the 25-function manifest; explicitly
   deny deletion, role assignment, unrelated enrollment plugins, and Attendance
   mutations not used by the current read-only contract.
4. Rotate the pasted EMS password and Moodle token, update protected server
   secret storage, rerun site-info, and prove retired-secret rejection.
5. Seed synthetic Teacher, Registrar, HOD, Branch Admin, course, class, student,
   enrollment, room, session, Attendance, and grade fixtures so positive and
   cross-scope reads can be accepted.

Then continue the product contract:

1. **P0:** Student contract, explicit grants/permissions, secure browser-session
   mode, idempotency, versioning, error/correlation envelope, allowed actions,
   pagination, and six-role positive/negative fixtures.
2. **P1:** applications, programs/levels/offerings, complete enrollment,
   teacher assignment history, schedule conflicts/availability, and NCC-owned
   attendance writes.
3. **P2:** messages, finance, certificates, reports, support/Quran, Forms,
   public APIs, and private files.
4. **P3:** exact Moodle mappings, isolated delivery-course cloning, role-scoped
   projections, commands, launches, files, attempts, reconciliation, and
   cleanup evidence.

## 9. Cutover Gate

An endpoint family may replace compatibility behavior only when it:

1. appears in the accepted staging OpenAPI;
2. documents authentication, role, relationship, and scope behavior;
3. has closed request, success, and error schemas;
4. has bounded filtering/pagination where data grows;
5. proves idempotency and concurrency for writes;
6. returns allowed actions and authority timestamps;
7. has positive plus forbidden-scope examples and synthetic fixtures;
8. passes BFF contract tests, direct API denial tests, and focused portal QA;
9. exposes no NCC or Moodle secret to browser JavaScript; and
10. preserves the complete 1,667/0 protected portal baseline.

Until then, the affected route remains on an explicitly non-production
compatibility adapter or renders an honest unavailable state. It must never
fabricate a successful NCC write.
