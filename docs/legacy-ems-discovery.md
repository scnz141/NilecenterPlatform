# Legacy EMS Discovery Baseline

## Purpose

This document records the read-only evidence gathered from the legacy Nile EMS
and Moodle. It is a functional reference only. The new Nile Learn portal must
preserve valid school workflows, but must not copy legacy UI, security
weaknesses, invalid data states, or integration assumptions.

This is a discovery artifact. It does not authorize a production sync, data
migration, schema change, or live provider connection.

## Evidence Collected

- Logged into the supplied test accounts without creating, editing, deleting,
  or submitting any record.
- Verified Registrar, Teacher, HOD, Supervisor-routed, and Branch Administrator
  navigation and representative read-only workflow surfaces.
- Verified a Moodle teacher account, course workspace, course sections,
  activities, participants, grades, and attendance-related identifiers.
- Inspected the public Angular route configuration and loaded role modules.
- Inspected the current Nile Learn routes, domain model, server action gates,
  persistence adapter, Moodle boundary, and integration UI.

## Legacy Role And Feature Map

| Legacy area     | Confirmed workflows                                                                                                    | New portal owner                                    |
| --------------- | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Registrar       | Student list/search/detail, direct student registration, pending-course queue, daily payments, messages                | Registrar                                           |
| Teacher         | Schedule, exams, attendance, classes, grades, notes, messages                                                          | Teacher                                             |
| Supervisor      | Attendance overview by branch, today's classes, user detail, messages                                                  | HOD or Branch Admin permissions                     |
| Guidance        | Applications, guidance groups, student records, registration reports                                                   | Registrar with guidance permissions                 |
| Accountant      | Accounting entries, categories, fees, debts, payments, wages, reports, archive                                         | Registrar, Branch Admin, or Super Admin permissions |
| Branch admin    | Local home, files, messages, branch operations module                                                                  | Branch Admin                                        |
| Department head | Department-head workspace module                                                                                       | HOD                                                 |
| Admin           | Users, students, courses, classes, classrooms, branches, accounting, files, logs, reports, and Moodle category mapping | Super Admin with delegated permissions              |

The legacy route roots are `admin`, `registrar`, `teacher`, `supervisor`,
`headofdepartment`, `branchadmin`, `guidance`, `accountant`, plus shared and
session routes. This confirms the replacement needs more than a student LMS:
it is an LMS, admissions desk, school operations system, and finance-adjacent
EMS.

Supervisor, Guidance, and Accountant are legacy capability bundles, not target
Nile Learn roles. No observed legacy label is sufficient evidence for a new
role. Super Admin behavior must be designed from global authority requirements,
not guessed from a Supervisor session.

## Role-Specific Evidence

### Teacher

The Teacher workspace exposes schedule, classes, attendance, exams, grades,
notes, and messages. These are class-scoped operations. The replacement must
derive teacher access through effective-dated class assignments and class
membership, never through a broad directory role alone.

### HOD

The HOD route exposes academic and department-level oversight rather than
global administration. The replacement must scope HOD reads and approvals by
department and allowed branches, with separate audit evidence for approvals
and rejections.

### Branch Administrator And Supervisor

Branch administration and Supervisor views expose local classes, attendance,
users, messages, and branch operations. The legacy route behavior is not a
safe authorization model. Nile Learn must implement these as explicit branch
permissions and deny cross-branch access at the server and RLS layers.

## Registrar Workflow Observed

The legacy registrar uses a single direct-registration flow with these groups:

1. Photo capture or file selection.
2. Identity and admissions: name, Arabic name, birth date, gender, geography,
   guidance group, passport or ID, area, reason, starting and target level,
   method, branch, acquisition source, residence data, and status.
3. Personal and contact information: regional phone numbers, WhatsApp, email,
   preferred language, district, address, travel date, marital status, and
   comments.
4. Family and guardian information.
5. Education information.
6. Payment: fee, currency, discount, due date, method, paid amount, and
   description.

The separate pending-course flow records a student, target course, available
after date, available weekdays, free time range, and notes. It is therefore
not merely a waiting list: it is the intake-to-class-placement queue.

The modern replacement must keep this information model but split it into a
clear wizard and lifecycle:

`lead -> application -> placement -> student profile -> enrollment workflow ->
class assignment -> active enrollment`.

The registrar must be able to save a valid incomplete draft. Required data
must be enforced only at the state transition that needs it, such as creating
an account, booking placement, assigning a class, or recording a payment.

## Academic, Schedule, And Moodle Evidence

The legacy system ties school operations to branch, course category, course,
class, teacher, room, date, weekday availability, start/end time, attendance,
and payment state. Its class tooling includes class hours, room and teacher
availability checks, temporary instructor assignment, notes, student roster
changes, archive/restore, timetable printing, and attendance scheduling.

The admin course list exposes both `Moodle Code` and `Moodle Id`, and the
legacy app has a top-level Moodle category mapping screen. New Nile Learn must
retain external IDs and mapping history; a course title alone is not a safe
sync key.

The verified Moodle course contract includes user ID, course ID, short name,
start/end dates, enrollment, sections, pages, video resources, quizzes,
gradebook data, completion, attendance activity IDs, and attendance sessions.
These identifiers belong in provider-neutral external mapping records.

One EMS-linked Moodle course resolved correctly while another observed mapping
did not resolve to an available Moodle course. This is direct evidence that a
connector needs stale/missing mapping states and a reconciliation queue; it
must not assume every stored external ID is valid.

The current Nile Learn Moodle client is a deliberate mock. Its Integration
screen can record a status but does not execute a live connector, and the
Moodle source page renders local mapped records. A visual `connected` state
must never be treated as proof of a working sync.

## Defects That Must Not Be Copied

1. **Cross-role route ambiguity.** A supervisor/HOD-routed legacy session can
   reach some other role paths in the browser, while later server calls reject
   certain actions. The result is blank or unauthorized screens instead of a
   clean access decision.
2. **Loading failure.** The legacy dashboard exposed a persistent loading
   overlay with a browser error originating in the legacy sodium bundle.
3. **Unsafe account creation UX.** The registrar registration form visibly
   pre-populates an account password. New Nile Learn must never display,
   generate in the browser, or retain a student password in a staff form.
4. **Invalid/incomplete queue records.** The pending-course queue contains
   entries with missing relationships and default-like dates. New workflows
   need explicit `draft`, `needs_information`, `ready_for_placement`, and
   `ready_for_enrollment` states, with validation rules at each transition.
5. **Mixed concerns.** The legacy registration screen combines identity,
   enrollment, guardian data, residence data, payment, account creation, and
   scheduling. This is hard to validate, recover, audit, or use on mobile.
6. **Unclear integration authority.** Moodle identifiers are present, but the
   legacy UI does not establish which system owns updates, conflict resolution,
   retry behavior, or audit evidence.

## Current Nile Learn Assessment

The new portal already contains broad route coverage and useful server-side
scope checks. It has routes and models for the six target roles, admissions,
learning, attendance, assessments, finance, certificates, Quran progress,
messages, settings, reports, audit, and integrations.

It is not yet a production EMS or a live integration platform because:

- `PlatformRepository` persists one denormalized `PlatformState` snapshot and
  falls back to local storage when Supabase access fails.
- Server sessions are not yet durable production authority.
- The observed build used Moodle/EMS placeholder boundaries. ADR-011 now
  authorizes full synthetic Moodle sandbox CRUD; EMS remains a finite migration
  source.
- The integration UI can set a connection status without proving a remote
  authentication, capability check, import, reconciliation, or writeback.
- The current Moodle source UI reads local state and includes demo-specific
  assumptions that a real connector must remove.

The immediate goal is therefore not a large UI rewrite. It is to make the
domain, ownership, and integration boundaries authoritative before adding more
screens.

## Replacement Architecture

### 1. Canonical Nile Learn Data

Nile Learn owns identities, roles, branch/department scopes, admissions
workflow state, enrollment, course delivery, classes, schedules, attendance,
Nile-native assessments and grades, invoices, certificates, messages, audit
logs, and portal behavior. Moodle initially owns Moodle-managed course content,
activities, completion, attempts, grades, and feedback. Browser state is never
authority.

### 2. External Reference Layer

Add provider-neutral external mapping records rather than putting one Moodle
or EMS ID directly on every domain table:

`external_records(id, provider, entity_type, internal_id, external_id,
external_parent_id, source_version, source_hash, sync_state, last_seen_at,
last_synced_at, last_error, metadata)`.

This supports Moodle course/module/activity IDs, old EMS student/course/class
IDs, imports, reconciliation, retries, and a future provider replacement.

### 3. Sync Is A Job, Not A Page Action

Every connector needs server-only credentials, an explicit read/write scope,
idempotency keys, rate limits, a cursor or watermark, durable run records,
retry classification, dead-letter handling, reconciliation reports, and audit
events. Admin UI should show observed state from those runs, never allow a
manual status selector to claim a live connection exists.

### 4. Provider Dependency Model

This is a dependency record, not a rollout order. Phase ordering and approval
live only in `docs/NILE_LEARN_MASTER_PLAN.md`.

- Normalized Nile Learn identity and workflow authority must exist before any
  provider projection or migration.
- Moodle began with a projection-only phase. ADR-011 now authorizes full
  synthetic sandbox CRUD through dedicated server-only service identities.
- Legacy EMS uses a finite migration reader, never recurring synchronization or
  writeback.
- External references and reconciliation evidence precede any accepted import.
- Counts, relationships, balances, and sampled records require human approval.
- EMS access is retired after cutover. Moodle sandbox CRUD is approved;
  production portal activation remains separately gated with explicit field
  authority.

### 5. UI Direction

The new portal follows `DESIGN.md`, `docs/DESIGN_V2.md`, and
`docs/SIMPLE_UI.md`: one page, one main job. The legacy giant registration
form becomes a responsive intake wizard. Full tables become role-scoped list
pages. Detail, create, audit, and settings remain separate. Integrations are
operational status pages with run history, error state, retry guidance, and
human approval gates.

## Remaining Discovery Inputs

The read-only role audit is sufficient to design the target role model. Useful
additional evidence, when available, is limited to:

- a dedicated single-branch administrator account to prove isolation;
- a direct Super Admin account to compare global legacy coverage without
  inferring it from Supervisor;
- an official API, database export, or approved service account for repeatable
  provider discovery.

Before live integration work begins, provide:

- the old EMS API/documentation or an approved immutable export;
- Moodle service-account documentation and a dedicated server-only token with
  the minimum required functions;
- a dev/test Supabase project and a written source-of-truth decision for each
  entity family;
- an approved data-retention and migration policy for identity, guardian,
  residence, payment, and academic records.

## Modernization Sequence Authority

The current checkpoint and only approved next slice live in
`docs/NILE_LEARN_MASTER_PLAN.md` under **Current Modernization Checkpoint**.
This discovery record does not define implementation order.

Legacy-specific guardrails remain unchanged: no live EMS or Moodle connection,
credential-based integration, writeback, or UI-wide redesign may begin without
the provider-specific phase, immutable source evidence, reconciliation design,
rollback, denial, build, and workflow evidence.
