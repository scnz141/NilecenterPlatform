# ADR-008: Moodle Synthetic Sandbox Write Proof

## Status

Accepted for the dedicated practice sandbox only on 2026-07-13.

## Context

This ADR records the historical first bounded write proof. ADR-011 now
authorizes full synthetic CRUD in the dedicated sandbox. Before Nile
Learn can design Phase 10 user provisioning or enrolment synchronization, the
team needs repeatable evidence for Moodle mutation contracts, unknown outcomes,
replay, reconciliation, and cleanup. Testing those concerns with real students,
the production Moodle site, the broad mobile service, or the M2 read token would
break the established authority and privacy boundary.

The product owner explicitly approved reversible read and write testing against
`moodle-no-data.enesekremergunesh.com`. This approval does not change production
authority or activate a Nile Learn runtime integration.

## Decision

Create a separate **M2B synthetic sandbox write proof** with all of these
constraints:

- CLI/local-command execution only; no HTTP route, portal action, scheduler,
  database persistence, outbox worker, or runtime cutover.
- A dedicated authorised-users-only custom service, non-interactive service
  user, expiring token, exact sandbox host, and exact function allowlist.
- The M2 read service, token, function list, fixtures, and evidence remain
  separate and unchanged.
- Every created identity and group carries one generated marker matching
  `NILE-M2B-YYYYMMDDTHHMMSSZ-8hex` and uses reserved fake data only.
- The write proof may create, update, and delete one synthetic user; manually
  enrol and unenrol that user in the existing synthetic course; create and
  delete one synthetic Moodle group; and add and remove that user from the
  group.
- Read-after-write reconciliation is mandatory before retry, replay, cleanup,
  or adoption of a previously created synthetic record.
- Cleanup runs in dependency order and refuses to mutate any record whose exact
  marker cannot be verified. Course-scoped state uses the separate read
  service; the not-yet-enrolled user uses the write service's marker-only
  reconciliation read.
- Evidence is redacted and may contain only function names, timestamps,
  operation keys, synthetic external IDs, canonical hashes, outcomes, and
  cleanup state.

The exact write-service function surface is:

- `core_webservice_get_site_info`
- `core_user_get_users` (restricted by the client to the exact run marker;
  the returned marker and deterministic fake username must both match for
  unknown-outcome reconciliation)
- `core_user_create_users`
- `core_user_update_users`
- `core_user_delete_users`
- `enrol_manual_enrol_users`
- `enrol_manual_unenrol_users`
- `core_group_create_groups`
- `core_group_delete_groups`
- `core_group_add_group_members`
- `core_group_delete_group_members`

The validator creates a fresh canonical `NILE-M2B-*` run marker by default for
one-process execution. When cross-process recovery may be required, an operator
must set `MOODLE_SANDBOX_WRITE_RUN_MARKER` before the first invocation and reuse
that exact marker after interruption. This optional recovery input is validated
before any network call and derives the same fake username, email, group name,
and reconciliation keys. A marker generated inside an interrupted process is
not recoverable from the redacted result. The marker is not a credential and
must never identify a real person.

Course creation, course deletion, activity/content writes, grades, attempts,
submissions, messages, attendance, calendars, role administration, token
administration, file transfer, and media remain denied.

## Data Boundary

Moodle receives only the minimum synthetic learning identity needed for this
proof. Nile Learn student photographs, passports, national IDs, guardian data,
consent evidence, addresses, admissions notes, finance data, medical data, and
arbitrary custom fields must never be sent.

Production Phase 10 continues to require normalized identity/course-run
mappings, durable sessions, transactional command/audit/outbox evidence,
idempotent workers, reconciliation approval, and a separate production threat
review. This ADR proves provider behavior only; it does not approve production
writes or make snapshot state an integration authority.

## Failure And Cleanup Rules

- Stop before mutation if either service exposes a missing or unexpected
  function, tokens/services overlap, the hostname differs, the synthetic
  acknowledgement is absent, the course/role mapping is invalid, or a marker is
  ambiguous.
- After a timeout or unknown outcome, perform read reconciliation before any
  retry. Exact match means success, absence permits one retry, and conflicting
  matches stop the run.
- Remove group membership, delete the synthetic group, unenrol the synthetic
  user, and delete the synthetic user. Moodle user deletion leaves a provider
  tombstone and is therefore cleanup, not transactional rollback.
- A run is not accepted until the active marker is absent from user, enrolment,
  group, and membership reads and the original M2 read result is unchanged.
- Token revocation and service/user disablement are operator-controlled closure
  steps and require separate evidence; the validator never requests an
  administrator credential.

## Consequences

- ADR-003 remains the production read-projection decision.
- M2B can reveal Moodle write semantics without widening Nile Learn runtime
  authority.
- Group synchronization and destructive unenrol/delete behavior remain
  sandbox evidence only; production may choose suspend/disable semantics.
- The proof can be discarded without a Nile Learn database rollback because it
  writes no Nile Learn persistence.
