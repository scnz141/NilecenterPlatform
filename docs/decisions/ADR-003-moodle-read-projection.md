# ADR-003: Moodle Read Projection Before Write Integration

- Status: Superseded for sandbox mutation by ADR-011; retained for projection history
- Date: 2026-07-10

## Context

Legacy EMS stores Moodle identifiers, but observed mappings can be stale or
missing. Course titles are not stable keys, and a visual connection flag does
not prove authentication or synchronization.

## Decision

The first Moodle integration is a server-only, minimum-privilege, read-only
projection. It imports mappings and observed state for users, courses, sections,
activities, enrollments, completion, gradebook data, and attendance activities.

Each run records its cursor, item results, hashes, errors, and reconciliation
cases. Unmatched, ambiguous, stale, or conflicting records require human review.
No Moodle write is enabled by this decision.

ADR-011 now authorizes full synthetic CRUD in the dedicated Moodle sandbox.
This ADR remains the historical contract for the first projection phase and
does not limit the current sandbox campaign.

## Invariants

- Staff credentials and browser automation are never connector mechanisms.
- Repeated imports are idempotent and do not duplicate mappings.
- Nile Learn never edits a Moodle-managed field locally.
- Missing mappings remain visible; they do not fall back to title matching.
- Provider payloads are minimized, access-controlled, and retained by policy.

## Consequences

Controlled enrollment or attendance writes require a later superseding or
follow-on ADR with sandbox proof, outbox processing, rollback, and
reconciliation acceptance.
