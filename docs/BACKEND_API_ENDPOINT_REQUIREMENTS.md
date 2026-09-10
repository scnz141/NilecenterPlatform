# Nile Learn Backend API Endpoint Requirements

## Purpose

This document is the handoff contract between the Nile Learn frontend team and
the external NCC EMS backend team. It is based on the current frontend code,
not the legacy portal narrative.

For the shorter feature-by-feature implementation sequence, use
`docs/BACKEND_IMPLEMENTATION_FLOWS.md`.

Sources inspected initially on 2026-08-04 and revalidated against the live NCC
contract on 2026-09-09:

- `client/src/App.tsx`;
- `client/src/lib/platformData.ts`;
- `client/src/lib/domain/modules.ts`;
- `client/src/lib/domain/types.ts`;
- `client/src/lib/domain/actions.ts`;
- `client/src/lib/backend/api.ts`;
- `server/routes.ts` and the integration route modules;
- `docs/integration-feature-freeze.json`;
- the live staging OpenAPI document at
  `https://ncc-ems-staging.enesekremergunesh.com/api/openapi.json`.

The code-grounded frontend surface currently contains:

- 208 unique literal route declarations in `client/src/App.tsx` (generated
  route families add runtime routes beyond this literal count);
- 51 exported action-input types in `client/src/lib/domain/actions.ts`;
- 20 unique client transport path templates in
  `client/src/lib/backend/api.ts`;
- 18 platform module identifiers in `client/src/lib/domain/types.ts`;
- six protected roles;
- the Moodle projection and command operations listed in
  `docs/integration-feature-freeze.json`.

These are source inventory counts, not backend coverage claims. The route and
action declarations describe the compatibility frontend surface; they do not
prove that a durable backend endpoint exists or that a local action is safe to
promote.

This document defines endpoints the frontend needs. It does not claim that a
proposed endpoint already exists.

## Status Legend

| Status       | Meaning                                                                              |
| ------------ | ------------------------------------------------------------------------------------ |
| `AVAILABLE`  | Present in the live staging OpenAPI and returned a successful read response.         |
| `INCOMPLETE` | Present, but missing schema, security, or working behavior required by the frontend. |
| `MISSING`    | Required by current frontend behavior but absent from the staging OpenAPI.           |
| `DEFERRED`   | Intentionally outside the first backend integration release.                         |

## Live Staging API State

The 2026-09-09 OpenAPI title is `NCC EMS API`, version `1.0.0`. Both supplied
domains publish the same 92 paths, 116 operations, 117 schemas, and document
hash. Their databases and environment configuration are not equivalent: the old
domain is the current working authentication target, while the new domain has
no accepted role fixtures and rejects the deployed frontend CORS origin.

The contract defines 109 bearer-protected operations and seven intentionally
public operations: liveness, login, refresh, and invitation validation/accept.
The old domain now accepts the deployed frontend origin, but Nile Learn still
uses a same-origin BFF so CORS is not the authorization or token-storage
boundary.

| Endpoint family                                                        | Observed live surface                                                                                            | Frontend assessment                                                                                                                                                        |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth and sessions                                                      | Login, refresh, logout, logout-all, me, workspace/role switch, password change, invitations, session list/revoke | `INCOMPLETE`; the local HttpOnly BFF is accepted, but live role fixtures/acceptance, Student, password recovery, and explicit grant/permission summary are missing.        |
| Users and organization                                                 | Staff users, branches, departments, custom fields                                                                | `INCOMPLETE`; no role/access-rule resource, programs, levels, pagination, allowed actions, or version preconditions.                                                       |
| Admissions                                                             | Leads, students, placement tests, direct lead-to-student conversion                                              | `INCOMPLETE`; no application entity, guardian relationship resource, document flow, or complete conversion evidence.                                                       |
| Delivery                                                               | Moodle-linked course overlays, classes, rosters, enroll/withdraw, rooms, generated sessions                      | `INCOMPLETE`; no offering/run separation, assignment history, full enrollment lifecycle, calendar/conflict API, or concurrency contract.                                   |
| Learning and Moodle                                                    | Redacted site config/test, pickers, person/group bind, attendance/grade/learning reads                           | `INCOMPLETE`; current attendance and shared-course group authority conflicts with ADR-010/ADR-012, and full projections/commands/launches/files/reconciliation are absent. |
| Notifications, audit, health                                           | Own notifications, scoped audit events, operator health                                                          | `INCOMPLETE`; no messages, reports, stable audit payload contract, readiness history, or correlation envelope.                                                             |
| Finance, certificates, Forms, Quran/support, public API, private files | No matching operations                                                                                           | `MISSING`.                                                                                                                                                                 |

The OpenAPI correctly declares `BearerAuth`, protects staff operations, removes
the old unsafe `/moodle/config/` shape, and never returns the Moodle token from
site-status reads. It still has no `Idempotency-Key`, `If-Match`/expected
version, `allowedActions`, correlation ID, cursor pagination, or freshness
contract. Twenty successful collection responses are bare arrays.

### Immediate Backend Corrections

1. Add Student identity and own-scope APIs or explicitly version a separate
   Student service contract.
2. Add explicit role grants, permission summaries, allowed role switches, and
   positive/forbidden fixtures for all six Nile roles.
3. Add idempotency, version/concurrency preconditions, stable error codes,
   correlation IDs, `allowedActions`, bounded pagination, and authority/freshness
   metadata.
4. Align course-run, class isolation, teacher assignment, enrollment, schedule,
   and attendance authority with ADR-010 and ADR-012.
5. Complete applications and the lead-to-active-enrollment institutional loop
   before portal cutover.
6. Repair NCC staging Moodle reachability. The supplied URL/token pass direct
   Moodle REST calls, while NCC confirms only that a stored token exists. Check
   egress, DNS/TLS, stored-secret retrieval, HTTP handling, and parsing; expose
   only a correlation ID and safe failure category.
7. Restrict `Ems Web Service` to the dedicated authorized user and replace the
   581-Allow Moodle role with an exact least-privilege capability set matching
   the 25 service functions.
8. Keep Moodle configuration Super-Admin-only and server-secret-backed; add the
   approved projection, command, launch, file, and reconciliation contract.
9. Make `/health` distinguish liveness from readiness and preserve redacted
   dependency evidence.
10. Seed and accept the new domain independently before changing the configured
    staging target.

## Contract Required By Every Endpoint

### Authentication And Scope

- The authenticated server session determines user, active role, permissions,
  branch scope, department scope, class relationship, and record ownership.
- The browser must not submit `actorId`, authoritative role, permission list,
  branch scope, or department scope.
- Protected operations must declare their security requirement in OpenAPI.
- `student`, `teacher`, `registrar`, `headofdepartment`, `branchadmin`, and
  `superadmin` are the only portal roles.

### Read DTOs

Entity responses should include:

```json
{
  "id": "stable-id",
  "version": 3,
  "status": "active",
  "allowedActions": ["view", "edit"],
  "createdAt": "ISO-8601",
  "updatedAt": "ISO-8601"
}
```

Collection responses require cursor pagination and server-side filtering:

```json
{
  "items": [],
  "nextCursor": null,
  "total": 0,
  "generatedAt": "ISO-8601",
  "scope": { "role": "registrar", "branchIds": [] }
}
```

Required pagination rules:

- Accept a bounded `limit` with a documented default and maximum.
- Treat `nextCursor` as opaque, short-lived, scope-bound, and filter-bound.
- Return stable ordering, normally `updatedAt DESC, id DESC`, so records are
  not duplicated or skipped while a list changes.
- Return `hasMore` when the backend cannot calculate a trustworthy `total`.
- Apply search, status, branch, department, date, and relationship filters on
  the server. Do not send an unbounded dataset for the browser to filter.

### Code-Grounded DTO Requirements

The names below follow the current TypeScript domain types. The backend may
choose different wire names, but it must preserve the relationships and
nullability. IDs are opaque strings; the frontend must not derive authorization
from them.

| DTO                | Minimum authoritative fields                                                                                                                                                                                                                                                |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User/session       | `id`, `email`, display name, status, active role grant, all granted roles, branch IDs, department IDs, permissions summary, provider, session expiry, version.                                                                                                              |
| Student profile    | user ID, lifecycle status, branch, entry source, preferred language, timezone, minor/adult state, guardian references when minor, current level, active enrollment IDs, and allowed actions.                                                                                |
| Staff profile      | user ID, role, branch IDs, department IDs, permission scope, title, subjects, teaching levels, availability status, operational scope, status, and assigned class IDs where applicable.                                                                                     |
| Course/run/class   | course/program/level references, branch, term, dates, capacity, room, timezone, schedule or generated session references, teacher assignment history, roster counts, status, version, and conflict state. A class must not embed an unverified direct teacher relationship. |
| Enrollment         | student, course run, level, class membership, lifecycle status, source, activation dates, and authoritative progress/attendance/grade projection references. Teacher access is derived from the active class membership.                                                    |
| Session/attendance | class and calendar references, UTC start/end, IANA timezone, session status, attendance version, actor and timestamp, per-student status (`present`, `late`, `absent`, `excused`), notes, and correction history.                                                           |
| Moodle projection  | Nile mapping ID, provider object ID, provider type, source timestamps, visibility/availability, content/file metadata where applicable, projection state, freshness, and reconciliation state. Never return provider credentials.                                           |
| Message/file       | participant or owner references resolved by the server, body/subject, read state, attachment metadata, storage object ID, checksum/MIME/size, and archive state. Do not return private storage paths or unsigned provider URLs.                                             |
| Certificate/report | scope, source versions, `generatedAt`, `asOf`, freshness, unavailable reason, allowed actions, and audit/artifact references. Reports must expose metric definition identifiers rather than browser-calculated totals.                                                      |

Responses must distinguish an omitted field from an explicit `null` where that
changes workflow meaning. Closed enums must be documented in OpenAPI; unknown
future enum values must produce a safe `unavailable` state rather than being
silently interpreted as active or complete.

### Mutations

- Require `Idempotency-Key` for create and transition operations.
- Require `If-Match` or `expectedVersion` for updates.
- Return entity ID, new version, command status, audit ID, generated events,
  and current `allowedActions`.
- Do not report success until the authoritative transaction commits.

### Errors

Use one documented envelope:

```json
{
  "error": {
    "code": "CLASS_CAPACITY_EXCEEDED",
    "message": "The class has reached capacity.",
    "fieldErrors": {},
    "correlationId": "request-id",
    "retryable": false
  }
}
```

Required HTTP meaning:

- `400`: malformed request;
- `401`: no valid session;
- `403`: authenticated but outside role/scope;
- `404`: unavailable or hidden record;
- `409`: replay, state, version, or scheduling conflict;
- `422`: business validation;
- `429`: rate limited;
- `503`: dependency unavailable.

Only `401` should initiate sign-in. Other errors must preserve the current
frontend route and form state.

### Freshness, Audit, And Correlation

Every response that represents an operational record or projection must make
its authority visible:

```json
{
  "freshness": {
    "source": "nile_learn",
    "sourceUpdatedAt": "ISO-8601",
    "projectedAt": "ISO-8601",
    "state": "fresh",
    "staleAfterSeconds": 900
  },
  "audit": {
    "lastAuditId": "audit-id"
  },
  "correlationId": "request-id"
}
```

Use `state` values `fresh`, `stale`, `unavailable`, `conflicted`, or
`not_applicable`. A stale or unavailable response is valid data about system
state; it is not permission to substitute seeded or browser-local data.
Mutations must return a correlation ID, audit ID, command ID when asynchronous,
and outbox event IDs when a downstream delivery is required. Audit records must
identify the authenticated actor, selected role grant, effective scope,
entity, action, before/after version, outcome, and request correlation ID.

### Frontend Transport Boundary

The current frontend uses a same-origin compatibility gateway in
`client/src/lib/backend/api.ts`. Its observed transport families are:

| Current frontend path family                                                  | Role in the current code                                                         | Required migration behavior                                                                                          |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `/api/auth/*`                                                                 | Login, session, role switch, logout, password and invitation flows.              | Replace with the external session contract only after cookie/session and error parity is proven.                     |
| `/api/platform/state`, `/api/platform/state/actions`, `/api/platform/records` | Compatibility snapshot reads and workflow actions.                               | Keep as an adapter during migration; do not treat it as the production data model.                                   |
| `/api/platform/commands`                                                      | Typed command boundary used by normalized work.                                  | Migrate family by family to the external API with the same idempotency, version, audit, and scope semantics.         |
| `/api/integrations/moodle/*`                                                  | Server-mediated Moodle capabilities, projections, commands, launches, and files. | Keep server-only and phase-gated; never replace with browser-to-Moodle calls.                                        |
| `/api/integrations/health` and provider status paths                          | Server-derived integration evidence.                                             | Preserve `verified`, `configured`, `unavailable`, and `deferred` states; never infer connected state in the browser. |
| `/api/certificates/verify`                                                    | Public certificate verification.                                                 | Preserve a limited public response and move artifact delivery behind signed authorization.                           |

This table is an adapter map, not a request for the NCC backend team to copy
the compatibility route names. The external team should implement the
versioned endpoint families below, while the frontend team owns the adapter
that translates them into the existing client DTOs. Browser requests must not
carry actor, role, branch, department, permission, Moodle, or provider-secret
claims.

## Required Endpoint Families

The paths below are the requested v1 contract. Equivalent REST paths are
acceptable only when the backend OpenAPI preserves the same operations and
relationships.

### Role And Feature Coverage Matrix

The six roles below are the complete protected-role set in the current
frontend. A role appearing in a read column does not imply global visibility;
the server must resolve the relationship and scope for every record.

| Role               | Effective scope                                                                                                                  | Required reads                                                                                                                                                                                | Required mutations / approvals                                                                                                                                                                                                           |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `student`          | Own user, active enrollments/classes, assigned Moodle delivery courses, and configured support/guardian relationships.           | Own profile, courses/content projection, completion, released grades/feedback, attendance, schedule, messages, certificates, finance summary, reports, Quran progress, and support cases.     | Update safe profile/preferences, submit learning metadata owned by the student, submit attendance exceptions, send scoped messages, create support cases, and submit Quran recitations.                                                  |
| `teacher`          | Assigned classes and active class memberships; own profile/availability; department/branch context supplied by the active grant. | Assigned class/session/roster, scoped student operational detail, attendance, schedules, Moodle content/outcomes, grading queue, interventions, Quran review, messages, and teaching reports. | Update own availability, create/reschedule permitted class sessions, save attendance for assigned sessions, create operational interventions, send scoped messages, and issue exact-scope Moodle commands or launches where granted.     |
| `registrar`        | Assigned admissions/branch scope; never unrelated branches or academic content.                                                  | Leads, applications, placement, students, guardians, enrollments, classes, schedules, invoices/payment records, messages, forms, and admissions/finance reports.                              | Create/correct/convert admissions records, book and record placement, create/activate/transfer/pause/resume/cancel enrollments, manage roster assignment within scope, record internal payments, review forms, and send scoped messages. |
| `headofdepartment` | Assigned department and branch scope; global access only through an explicit Super-Admin grant.                                  | Department programs/levels/courses, curriculum status, teachers, classes, Moodle projections/outcomes, assessments, certificates, schedules, messages, and academic reports.                  | Govern catalog and course runs, assign/oversee teachers, moderate academic outcomes, approve/reject certificates, resolve permitted academic conflicts, create approved Moodle commands, and send scoped messages.                       |
| `branchadmin`      | Assigned branch scope only.                                                                                                      | Branch users, teachers, students, classes, rooms, schedules, sessions, attendance exceptions, finance overview, messages, and branch reports.                                                 | Manage rooms and branch operations, create/update branch classes and schedules, resolve branch conflicts with reasons, review attendance exceptions, manage permitted roster/operational changes, and send branch-scoped messages.       |
| `superadmin`       | Global organization scope, subject to active role grant and audit policy.                                                        | All internal users, role grants, permissions, organization, every operational family, integration health, commands, reconciliation, audit, and system reports.                                | Invite/suspend users, manage grants/scopes/permissions, manage branches/departments/catalog metadata, perform global operational corrections, reconcile providers, and execute explicitly permitted Moodle/storage/report commands.      |

Feature-family coverage derived from `PlatformModuleId`, `platformModules`,
`App.tsx`, and the integration ownership matrix is below. The “required API
section” points to the contract later in this document; `compatibility` means
the current client can render or mutate through local compatibility state but
the external backend contract is not yet present.

| Current feature family          | Frontend evidence / route root                                                           | Authority and required API section                                                         |
| ------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Public site and catalog         | Public routes in `App.tsx`, `/courses`, `/book-placement-test`, `/apply`                 | Public catalog/intake; sections 3 and 12.                                                  |
| Auth and RBAC                   | `/auth/*`, protected route guards, `api.ts` auth calls                                   | Nile Learn identity/session authority; section 1.                                          |
| Admissions and EMS              | `/app/registrar/leads`, `/applications`, `/placement-tests`, `/students`, `/enrollments` | Nile Learn admissions authority; sections 3 and 4.                                         |
| Student learning shell          | `/app/student/courses`, `/assignments`, `/quizzes`, `/grades`, `/calendar`               | Moodle projection for learning records, Nile Learn for operational context; section 7.     |
| Teaching workspace              | `/app/teacher/classes`, `/attendance`, `/grading`, `/quizzes`, `/reports`                | Nile Learn class/attendance scope plus Moodle learning authority; sections 5, 6, and 7.    |
| Academic management             | `/app/hod/courses`, `/curriculum`, `/assessments`, `/certificates`                       | HOD-scoped Nile governance and Moodle projection/command boundary; sections 5, 7, and 11.  |
| Branch operations               | `/app/branch/classes`, `/rooms`, `/schedule`, `/attendance`, `/payments`                 | Nile Learn branch authority; sections 4, 5, 6, and 10.                                     |
| Assessment                      | Student/teacher/HOD assignment and quiz routes                                           | Moodle definitions, attempts, submissions, grades, and feedback; section 7.                |
| Attendance                      | Student history, teacher class attendance, branch attendance                             | Nile Learn session attendance; section 6.                                                  |
| Scheduling                      | Student/teacher calendars, registrar/branch/HOD/admin schedule routes                    | Nile Learn rooms, sessions, conflicts, and timezone rules; section 6.                      |
| Communication                   | `/app/*/messages` and notification actions                                               | Nile Learn conversations and notification state; section 9.                                |
| Certificates                    | Student/HOD/admin certificate routes and public verification                             | Nile Learn eligibility, approval, artifacts, and verification; section 11.                 |
| Finance                         | Registrar/branch payment routes and finance reports                                      | Nile Learn internal invoice and ledger authority; section 10.                              |
| Reports and audit               | Every portal has scoped reports; admin has audit/system health                           | Server-derived read models and immutable audit; section 13.                                |
| Quran specialization            | Student progress and teacher review routes                                               | Nile Learn progress/review metadata with scoped media; section 8 and section 14.           |
| Integrations                    | Admin integration health, Moodle source, command routes                                  | Server-only provider evidence and phase-gated commands; sections 7 and 13.                 |
| Forms and finite Jotform import | `/app/*/forms`, form builder/review/offline/migration routes                             | Nile Forms is internal authority; Jotform is finite import only; section 12.               |
| Student support/interventions   | Student support and teacher intervention routes                                          | Nile Learn scoped case records; section 8 and section 13.                                  |
| Private files                   | Student documents, message attachments, certificate downloads, Moodle file proxy         | Supabase Storage for Nile-owned files; Moodle remains source for Moodle media; section 14. |

The frontend may keep compatibility screens for families marked `MISSING`, but
must label unavailable or development state and must not fabricate a successful
write when the required external endpoint is absent.

### 1. Authentication, Invitations, And Self Profile

**Current staging state: `INCOMPLETE`; the staff-only NCC auth/session surface
and local same-origin HttpOnly BFF are present, but live staff-role acceptance,
Student, password recovery, and explicit permissions are missing.**

| Method and path                        | Required behavior                                                              | Roles               |
| -------------------------------------- | ------------------------------------------------------------------------------ | ------------------- |
| `POST /v1/auth/login`                  | Authenticate and create the application session.                               | Public              |
| `GET /v1/auth/session`                 | Resolve identity, roles, active role, scopes, expiry, and permissions summary. | All signed-in users |
| `POST /v1/auth/switch-role`            | Validate grant, rotate session, revoke old role-bound session.                 | Multi-role users    |
| `POST /v1/auth/logout`                 | Revoke current session.                                                        | All signed-in users |
| `POST /v1/auth/password-reset/request` | Queue scoped recovery without account enumeration.                             | Public              |
| `POST /v1/auth/password-reset/confirm` | Validate token and set password.                                               | Public token holder |
| `POST /v1/auth/password-change`        | Verify current password and rotate sessions as required.                       | All signed-in users |
| `POST /v1/invitations/accept`          | Verify invitation, establish password and activate account.                    | Public token holder |
| `GET /v1/me`                           | Return safe personal and role-context profile data.                            | All signed-in users |
| `PATCH /v1/me`                         | Update safe personal/contact fields only.                                      | All signed-in users |
| `PATCH /v1/me/preferences`             | Locale, timezone, and notification preferences.                                | All signed-in users |
| `GET /v1/me/activity`                  | Current user's scoped account/audit activity.                                  | All signed-in users |

### 2. Users, Roles, Permissions, And Organization

**Current staging state: `INCOMPLETE`; users, branches, departments, and custom
fields are present, while explicit grants/access rules, programs, and levels are
missing.**

| Resource or operation                   | Required methods                                                                                 | Roles                                 |
| --------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------- |
| `/v1/admin/invitations`                 | `GET`, `POST`, resend and revoke transitions                                                     | Super Admin                           |
| `/v1/admin/users` and `/{userId}`       | list, create invitation-backed account, view, update safe identity, suspend, reactivate, archive | Super Admin                           |
| `/v1/admin/users/{userId}/role-grants`  | list, grant, change scope, revoke                                                                | Super Admin                           |
| `/v1/admin/users/{userId}/sessions`     | list and revoke                                                                                  | Super Admin                           |
| `/v1/admin/roles`                       | role summaries and counts                                                                        | Super Admin                           |
| `/v1/admin/permissions`                 | matrix read and versioned update                                                                 | Super Admin                           |
| `/v1/branches` and `/{branchId}`        | list, create, view, update, activate, pause, archive                                             | Super Admin; scoped Branch Admin read |
| `/v1/departments` and `/{departmentId}` | list, create, view, update, assign HOD, archive                                                  | Super Admin; scoped HOD read          |
| `/v1/programs` and `/v1/levels`         | catalog metadata CRUD and status history                                                         | Super Admin/HOD by permission         |

Role-specific staff profile DTOs must expose branch, department, subjects,
levels, availability state, operational scope, and permission summary without
allowing self-profile calls to change protected scope.

### 3. Leads, Applications, Placement, And Students

**Current staging state: `INCOMPLETE`; leads, direct conversion, students, and
placement tests are present, while applications, guardian resources, documents,
and reconciliation are missing.**

| Method and path                                            | Required behavior                                          | Roles                                               |
| ---------------------------------------------------------- | ---------------------------------------------------------- | --------------------------------------------------- |
| `GET/POST /v1/leads`                                       | Scoped pipeline list and lead creation.                    | Registrar, Super Admin                              |
| `GET/PATCH /v1/leads/{leadId}`                             | Detail, correction, notes, communication history.          | Registrar, Super Admin                              |
| `POST /v1/leads/{leadId}/convert`                          | Idempotently create/link application or student candidate. | Registrar, Super Admin                              |
| `GET/POST /v1/applications`                                | Scoped list and direct application creation.               | Registrar, Super Admin                              |
| `GET/PATCH /v1/applications/{applicationId}`               | Detail and permitted correction.                           | Registrar, Super Admin                              |
| `POST /v1/applications/{applicationId}/placement-bookings` | Book placement with conflict validation.                   | Registrar, Super Admin                              |
| `POST /v1/placement-bookings/{bookingId}/result`           | Record score, decision, level, actor, and history.         | Registrar, HOD where approved                       |
| `POST /v1/applications/{applicationId}/convert`            | Create the student profile without duplicate identities.   | Registrar, Super Admin                              |
| `GET/POST /v1/students`                                    | Scoped list and approved direct creation.                  | Registrar, Super Admin; scoped HOD/Branch read      |
| `GET/PATCH /v1/students/{studentId}`                       | Detail and correction with lifecycle timeline.             | Scoped roles; student self-read                     |
| `/v1/students/{studentId}/guardians`                       | guardian list/create/update/link/unlink                    | Registrar, Super Admin; student self-read           |
| `/v1/students/{studentId}/documents`                       | metadata, upload initiation, approval, download, archive   | Registrar/Super Admin; owner-limited student access |
| `POST /v1/students/{studentId}/merge-review`               | Human-approved duplicate reconciliation.                   | Super Admin or authorized Registrar                 |

Student detail must project placement, level, enrollments, classes, teachers,
attendance, finance summary, certificates, communications, documents, and
audit timeline through scoped read models.

### 4. Enrollment And Class Assignment

**Current staging state: `INCOMPLETE`; class enrol and withdraw operations are
present, but the draft/activate/transfer/pause/resume/cancel/complete lifecycle
and membership history are missing.**

| Method and path                      | Required behavior                                                      | Roles                           |
| ------------------------------------ | ---------------------------------------------------------------------- | ------------------------------- |
| `GET/POST /v1/enrollments`           | Scoped list and draft enrollment creation.                             | Registrar, Super Admin          |
| `GET /v1/enrollments/{enrollmentId}` | Enrollment, transitions, offering, run, class, and teacher projection. | Scoped staff and owning student |
| `POST /v1/enrollments/{id}/activate` | Validate level, run, capacity, class and account activation.           | Registrar, Super Admin          |
| `POST /v1/enrollments/{id}/transfer` | End old membership and create the new membership atomically.           | Registrar, Super Admin          |
| `POST /v1/enrollments/{id}/pause`    | Pause access with reason/effective date.                               | Registrar, Super Admin          |
| `POST /v1/enrollments/{id}/resume`   | Revalidate dates, class and capacity.                                  | Registrar, Super Admin          |
| `POST /v1/enrollments/{id}/cancel`   | Preserve history and cancel future access.                             | Registrar, Super Admin          |
| `POST /v1/enrollments/{id}/complete` | Complete after authoritative eligibility checks.                       | Registrar/HOD by permission     |

Teacher relationship must be derived from active class assignment. The API
must not accept a random direct teacher ID as the primary student relationship.

### 5. Offerings, Runs, Classes, Teachers, And Rosters

**Current staging state: `INCOMPLETE`; course overlays, classes, current teacher
IDs, and rosters are present, but offerings/runs, assignment history,
substitutes, and the isolated Moodle delivery-course model are missing.**

| Resource or operation                        | Required methods and transitions                                         | Roles                                         |
| -------------------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------- |
| `/v1/course-offerings`                       | list, create, view, update, activate, archive                            | HOD/Super Admin                               |
| `/v1/course-runs`                            | list, create, view, update, open, close, archive                         | HOD/Super Admin; scoped Branch read           |
| `/v1/classes` and `/{classId}`               | list, create, view, update, activate, pause, complete, archive           | HOD/Branch/Super Admin by scope               |
| `/v1/classes/{classId}/teacher-assignments`  | assign, replace, substitute, end assignment; effective dates and history | HOD/Branch/Super Admin by scope               |
| `/v1/classes/{classId}/memberships`          | roster read and validated add/end/transfer                               | Registrar/Branch/Super Admin                  |
| `/v1/classes/{classId}/students/{studentId}` | scoped longitudinal operational read model                               | Assigned Teacher, HOD, Branch, Super Admin    |
| `/v1/teachers` and `/{teacherId}`            | scoped directory, profile, classes, workload and status                  | HOD/Branch/Super Admin                        |
| `/v1/teachers/{teacherId}/availability`      | recurring availability and dated exceptions                              | Teacher self; authorized HOD/Branch oversight |

### 6. Rooms, Scheduling, Sessions, And Attendance

**Current staging state: `INCOMPLETE`; rooms, recurring class schedule fields,
generated sessions, and Moodle attendance reads are present, while branch
calendar, conflict/override evidence, teacher availability, and NCC-authoritative
attendance writes are missing.**

| Resource or operation                 | Required methods and transitions                | Roles                                            |
| ------------------------------------- | ----------------------------------------------- | ------------------------------------------------ |
| `/v1/rooms` and `/{roomId}`           | list, create, update, status, capacity, archive | Branch/Super Admin                               |
| `/v1/schedules`                       | scoped calendar query and event creation        | Student/Teacher read; staff writes by scope      |
| `/v1/schedule/conflicts`              | preview, list, resolve, override with reason    | Branch/HOD/Super Admin by scope                  |
| `/v1/classes/{classId}/sessions`      | list, create, reschedule, cancel                | Assigned Teacher and authorized operations roles |
| `/v1/sessions/{sessionId}/attendance` | roster and versioned attendance read/save       | Assigned Teacher; Branch oversight               |
| `/v1/attendance/exceptions`           | owner submission, scoped review, status history | Student submit; Branch/authorized staff review   |

Conflict responses must be deterministic across preview and save. Validate
teacher, learner, room, capacity, branch, run dates, holidays, availability,
timezone, and overlapping sessions server-side.

### 7. Moodle-Owned Learning Projections

**Current staging state: `INCOMPLETE`; redacted Moodle site status/test,
pickers, mappings, and bounded attendance/grade/learning reads are present, but
the approved isolated-course projections, commands, launches, files, and
reconciliation contract is missing.**

| Method and path                                        | Required behavior                                                      | Roles                                                 |
| ------------------------------------------------------ | ---------------------------------------------------------------------- | ----------------------------------------------------- |
| `GET /v1/learning/courses`                             | Mapped Moodle delivery courses for the current actor.                  | Student/Teacher; scoped governance                    |
| `GET /v1/learning/courses/{courseId}`                  | Course summary, sections, freshness and mapping state.                 | Relationship-scoped roles                             |
| `GET /v1/learning/courses/{courseId}/content`          | Sections, modules, page/book/URL/file/media metadata and availability. | Relationship-scoped roles                             |
| `GET /v1/learning/assignments` and `/{id}`             | Definition, due state and current actor result.                        | Student/Teacher/HOD by relationship                   |
| `GET /v1/learning/quizzes` and `/{id}`                 | Quiz summary, attempts and review state.                               | Student/Teacher/HOD by relationship                   |
| `GET /v1/learning/grades`                              | Released outcomes and feedback only.                                   | Student self; assigned Teacher; governance aggregates |
| `GET /v1/learning/completion`                          | Actor/course completion with source timestamp.                         | Scoped roles                                          |
| `GET /v1/learning/files/{fileId}`                      | Authorized proxy with range support and no Moodle token exposure.      | Current course relationship                           |
| `POST /v1/learning/launches`                           | Short-lived launch for native Moodle activity.                         | Capability and relationship scoped                    |
| `/v1/integrations/moodle/commands`                     | queue, status and allowed command creation                             | Teacher/HOD/Super Admin by exact permission           |
| `POST /v1/integrations/moodle/commands/{id}/reconcile` | Explicit reconciliation, fully audited.                                | Super Admin                                           |
| `GET/PATCH /v1/integrations/moodle/config`             | Redacted configuration and safe update.                                | Super Admin only                                      |

Every projection must include `sourceUpdatedAt`, `projectedAt`, `freshness`,
mapping status, and an unavailable reason. Moodle tokens and raw `pluginfile`
URLs must never reach the browser.

The current compatibility `actions.ts` contains native-looking lesson,
assignment, quiz, question, submission, and grade actions so seeded portal
workflows can be exercised. Those actions are not the production authority and
must not be translated into Nile-owned learning tables by the NCC backend.
When a backend operation changes Moodle-owned content or outcomes, it must be
one of:

1. a server-authorized Moodle command with an exact operation allowlist,
   idempotency key, mapping, audit/outbox evidence, provider read-back, and
   reconciliation state; or
2. a short-lived, single-use native Moodle launch for complex authoring or
   learner attempt flows.

Nile Learn remains authoritative for admissions, enrollments, class/group
membership, teacher allocation, schedules, rooms, attendance, finance,
messages, certificates, RBAC, audit, and private operational files. A Moodle
projection must never be treated as a successful Nile mutation, and a stale
Moodle result must block dependent certificate/report decisions rather than
being replaced with a local default.

### 8. Teacher Interventions And Quran Operations

**Current staging state: `MISSING`**

- `GET/POST /v1/student-interventions` and
  `POST /v1/student-interventions/{id}/resolve` for assigned-class teacher
  support records and student-visible shared notes.
- `GET /v1/quran/progress` and `PATCH /v1/quran/progress/{studentId}` for the
  owning student and assigned teacher relationship.
- `POST /v1/quran/recitations` for student submission metadata.
- `GET /v1/quran/recitations/review` and
  `POST /v1/quran/recitations/{id}/review` for assigned teachers and HOD
  oversight.

### 9. Messaging, Notifications, And Attachments

**Current staging state: `INCOMPLETE`; own-inbox notifications and read state
are present, while conversations, messages, recipient scope, and attachments are
missing.**

| Method and path                        | Required behavior                                                        |
| -------------------------------------- | ------------------------------------------------------------------------ |
| `GET /v1/message-directory`            | Return visible recipients and separate `canMessage` with denial reason.  |
| `GET/POST /v1/conversations`           | Scoped conversation list and idempotent conversation creation.           |
| `GET /v1/conversations/{id}/messages`  | Cursor-paginated messages visible to the participant.                    |
| `POST /v1/conversations/{id}/messages` | Send message and attachment references after recipient-scope validation. |
| `POST /v1/messages/{id}/read`          | Record participant read state.                                           |
| `POST /v1/conversations/{id}/archive`  | Archive for actor without destroying institutional history.              |
| `GET /v1/notifications`                | Current user's notifications.                                            |
| `POST /v1/notifications/{id}/read`     | Record read state.                                                       |

Super Admin may message active users globally. Teachers may send only to
assigned students and approved staff contacts. Registrar, HOD, Branch Admin,
and Student recipient scope must be derived server-side.

### 10. Finance

**Current staging state: `MISSING`**

- `GET/POST /v1/invoices` and `GET /v1/invoices/{invoiceId}`;
- `POST /v1/invoices/{invoiceId}/payments`;
- `POST /v1/payments/{paymentId}/reverse`;
- `POST /v1/invoices/{invoiceId}/adjustments`;
- `GET /v1/students/{studentId}/finance-summary`;
- `GET /v1/finance/aging` and `GET /v1/finance/collections`.

Records require immutable journal evidence, currency, allocations, balances,
reversal history and role/branch-scoped visibility. No payment gateway is
required in the current frontend contract.

### 11. Certificates

**Current staging state: `MISSING`**

- `GET /v1/certificates` and `GET /v1/certificates/{certificateId}`;
- `POST /v1/certificates/{id}/approve`;
- `POST /v1/certificates/{id}/reject`;
- `POST /v1/certificates/{id}/issue`;
- `POST /v1/certificates/{id}/revoke`;
- `POST /v1/certificates/{id}/reissue`;
- `GET /v1/certificates/{id}/download` for short-lived authorized access;
- `GET /v1/public/certificates/verify?code=` for limited public verification.

Eligibility must fail closed when required Moodle outcomes are stale or
unresolved. Issued revisions are immutable.

### 12. Nile Forms And Finite Jotform Import

**Current staging state: `MISSING`**

Required route families:

- public form publication retrieval and submission;
- current-user assigned forms and response detail;
- staff form list, create, builder update, publish, close and archive;
- publication assignment and revocation;
- submission review and typed request creation;
- offline bundle issue, sync and replay receipt;
- Super-Admin-only Jotform inventory, field mapping, dry run, import,
  reconciliation and key-retirement evidence.

Jotform is a finite import source, not a recurring writable authority.

### 13. Reports, Audit, Health, And Integration Operations

**Current staging state: `INCOMPLETE`; scoped audit events and operator health
are present, while operational reports, stable audit DTOs, correlation,
integration history, and exports are missing.**

| Endpoint family               | Required reports or behavior                                                |
| ----------------------------- | --------------------------------------------------------------------------- |
| `/v1/dashboards/{role}`       | Role-scoped current metrics and next actions.                               |
| `/v1/reports/admissions`      | Funnel and conversion definitions.                                          |
| `/v1/reports/enrollment`      | Active, paused, completed and capacity.                                     |
| `/v1/reports/attendance`      | Sessions saved/missing and status totals.                                   |
| `/v1/reports/classes`         | Capacity, schedule and delivery health.                                     |
| `/v1/reports/teachers`        | Workload and approved metric definitions.                                   |
| `/v1/reports/finance`         | Aging, collections and balances.                                            |
| `/v1/reports/certificates`    | Eligibility, approval, issue and revocation.                                |
| `/v1/reports/{report}/export` | Scoped streamed CSV and approved PDF exports.                               |
| `/v1/report-presets`          | User-owned saved filters.                                                   |
| `/v1/audit-logs`              | Immutable scoped audit search and export.                                   |
| `/v1/integrations/health`     | Dependency readiness, queue depth, last success/failure and stale mappings. |
| `/v1/system/health`           | Application, database, queue and storage readiness.                         |

Report responses require `generatedAt`, `asOf`, scope, source versions,
freshness and unavailable reasons. The browser must not calculate
authoritative institutional totals from downloaded records.

### 14. Private Files

**Current staging state: `MISSING`**

- `POST /v1/files/uploads` creates a scoped, short-lived upload intent;
- `POST /v1/files/uploads/{uploadId}/complete` verifies size, MIME, magic bytes
  and checksum;
- `GET /v1/files/{fileId}/download` returns a short-lived authorized download;
- `POST /v1/files/{fileId}/archive` preserves audit evidence.

Private identity documents, message attachments and certificate artifacts must
never use public URLs.

## Backend Delivery Priority

### P0: Contract And Security

1. Authentication scheme and current-session endpoint.
2. Common DTO, errors, pagination, idempotency and versioning.
3. Redacted Moodle configuration and dependency readiness.
4. OpenAPI operation tags and stable operation IDs.

### P1: First End-To-End Institutional Loop

1. User invitation and account activation.
2. Registrar lead/application/placement/student conversion.
3. Enrollment, class, teacher assignment and session schedule.
4. Student, Teacher, HOD and Branch scoped read projections.
5. Attendance write and cross-portal read-back.

### P2: Daily Operations

Messaging, notifications, interventions, rooms, conflict resolution, finance,
certificates, reports and private files.

### P3: Provider Integration

Moodle projections, authorized files, native launches, command status and
reconciliation. Nile Forms and the finite Jotform import follow their accepted
authority boundaries.

## Frontend Integration Acceptance

An endpoint family is ready for frontend wiring only when:

1. it appears in the staging OpenAPI;
2. authentication and role/scope behavior are documented;
3. request, success and error schemas are closed and generated consistently;
4. list filters and pagination are documented;
5. mutations support idempotency and concurrency;
6. `allowedActions` is returned by authoritative reads;
7. positive and forbidden-scope examples are available;
8. staging seed records exist for all six roles;
9. contract tests and browser acceptance pass;
10. no secret is exposed in OpenAPI examples, responses or browser traffic.

Until those conditions pass, the corresponding frontend route remains on its
current compatibility adapter and must show unavailable or development state
rather than fabricated production success.
