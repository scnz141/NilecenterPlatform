# 20 Nile Forms Typed Requests

## SPEC

Implement only Phase 14B approved by the current checkpoint in
`docs/NILE_LEARN_MASTER_PLAN.md`.

This slice adds one typed Requests module for branch incidents and maintenance
requests created from an exact reviewed Nile Forms submission. It is not a
generic workflow engine and does not add Approvals, Appointments, Surveys, or
Applications.

## AUTHORITY

- The authenticated server session is the actor authority. Never accept actor,
  requester, role, branch, department, permission, or scope from the client.
- A request may be created only from one eligible reviewed submission and one
  registered request processing profile. The submission and published version
  remain immutable evidence.
- Requesters may read their own requests. Assigned staff may read and act on
  requests inside their effective scope. Branch Admin is branch limited; HOD is
  department and branch limited; Super Admin requires explicit global scope.
- Cross-scope, missing, revoked, expired, terminal, stale, malformed, or
  replay-conflicting commands return a typed denial and write nothing.

## DOMAIN

- Use a closed request aggregate with request number, requester, source
  submission, branch, optional department, category, priority, status,
  assignee, due date, comments, activity, resolution, version, and timestamps.
- Use closed request statuses and transitions. Terminal requests cannot be
  reopened or mutated unless a separately approved correction model exists.
- Reassignment history is immutable and records previous assignee, next
  assignee, actor, reason, and time.
- Comments and activity append immutable records. Editing or deleting history
  is out of scope.
- Form answers never become mutable request state and request mutations never
  update form answers.

## COMMANDS

- Register typed commands for create-from-reviewed-submission, assign,
  reprioritize, start, comment, resolve, and cancel.
- Every command uses an idempotency key and expected request version.
- Successful commands update the aggregate and write scoped audit evidence in
  one application transaction. Bounded in-app notifications may be created
  only for affected users.
- Replayed commands return the original result. The same key with different
  input returns conflict and writes nothing.

## UI

- Keep one page equal to one main job:
  - scoped request list;
  - one request detail and activity timeline;
  - create-from-submission confirmation.
- Do not put review, form building, request processing, and reports on one
  screen.
- Include loading, empty, denied, invalid, stale, conflict, saving, success,
  and terminal states.
- Preserve English, Arabic RTL, Turkish LTR, accessibility, and mobile through
  ultrawide responsiveness.

## RUNTIME

- Memory remains the runtime default in this slice.
- Do not enable normalized Forms persistence, route cutover, or provider flags.
- Do not apply SQL to a linked, shared, or remote Supabase project.
- Do not call Moodle, the legacy EMS, Jotform, email, SMS, WhatsApp, payment,
  storage, PDF, signature, or webhook providers.

## VERIFY

Add focused tests for:

- exact reviewed-submission lineage and one-to-one request creation;
- every allowed and denied state transition;
- requester, assignee, branch, department, and global scope;
- idempotent replay, conflicting replay, optimistic conflict, and terminal
  denial;
- immutable comments, activity, and reassignment history;
- atomic request/audit behavior and no-write denials;
- EN/AR/TR list, detail, and confirmation routes;
- responsive, accessible, empty, denied, conflict, and terminal UI states.

Run focused tests first, then `npm run check`, `npm test -- --run`,
`npm run build`, and the unfiltered `scripts/verify.sh`. Preserve the protected
1,634/0 portal baseline.

## EXCLUSIONS

Phase 14B must not add Approvals, Appointments, Surveys, Applications, uploads,
signatures, PDFs, provider notifications, webhooks, payments, external
delivery, migration cutover, generic workflow state, or Moodle/EMS writeback.
