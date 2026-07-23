# ADR-011: Full Moodle Sandbox CRUD Authorization

- Status: Accepted
- Date: 2026-07-23
- Supersedes: earlier sandbox read-only and bounded-write restrictions

## Context

The dedicated Moodle practice environment is a synthetic sandbox with approved
read and write access. Earlier phases deliberately limited mutations while the
provider contract, cleanup discipline, identity mappings, and authority model
were being established. The product owner has now explicitly authorized full
CRUD testing in that sandbox.

## Decision

The Moodle sandbox may be used for complete synthetic create, read, update,
archive, restore, and delete lifecycle testing for every Moodle-owned learning
family:

- users, enrolments, roles, groups, and group memberships;
- course templates, delivery courses, sections, ordering, and visibility;
- pages, books, URLs, resources, files, images, audio, and video;
- assignments, submissions, grading, feedback, and completion;
- quizzes, question banks, attempts, results, and grade outcomes;
- Lesson, H5P, SCORM, and supported plugin-specific activities;
- calendar and Moodle-native learning notifications where required by the
  learning workflow.

Delete is permitted only for synthetic records created by the active test run.
Records with attempts, submissions, grades, or completion history are hidden,
archived, or restored instead of destructively deleted when Moodle requires
history preservation.

Nile Learn remains authoritative for admissions, institutional profiles,
programs and levels, class allocation, schedules, rooms, attendance, finance,
communications, certificates, RBAC, audit, mappings, commands, and
reconciliation evidence.

## Execution Boundary

- Use marker-bound synthetic data only; never copy real student or staff PII.
- Use dedicated server-only service identities and exact function allowlists.
- Verify the mapped actor's Moodle capability in the target context.
- Reconcile unknown outcomes before retrying.
- Prove idempotent replay, read-back, ordered cleanup, repeated cleanup, and
  credential teardown.
- Never expose provider credentials or call Moodle directly from a browser.
- Store only redacted evidence and provider-neutral mappings.

Full sandbox CRUD authorization does not by itself activate production portal
writes. Portal activation still requires the reviewed `local_nilelearn` plugin,
durable command worker, audit/outbox transaction, reconciliation, RBAC, and
accepted sandbox lifecycle evidence for the operation family.

## Rollback

Disable the sandbox service, stop workers, revoke the temporary token, archive
or delete marker-bound fixtures in dependency order, and preserve redacted
evidence for unresolved provider outcomes.
