# ADR-012: NCC EMS Primary Backend And Session Authority

- Status: Accepted
- Date: 2026-09-09
- Supersedes: ADR-001 where local Nile/Supabase persistence is named as the production operational store; ADR-002 where Supabase Auth and Nile-owned session tables are named as production identity/session authority
- Preserves: ADR-004 for the distinct legacy EMS migration source; ADR-005 atomic audit requirements; ADR-010 and ADR-011 Moodle authority and sandbox rules

## Context

Nile Learn is delivered by separate frontend and backend teams. The external NCC
EMS team now owns the target staff and operational backend documented by its
staging OpenAPI contract. Supabase and the repository's compatibility snapshot
were foundation and test implementations; running them as a second production
business backend would create duplicate authority, divergent workflows, and
unsafe reconciliation.

The current NCC EMS contract provides staff authentication and a substantial
operational surface, but it remains incomplete for the six-role Nile Learn
product. It has no student session contract, and several workflow families do
not yet meet Nile Learn's idempotency, concurrency, scope, audit, pagination,
and response-authority requirements.

## Decision

The NCC EMS service is the target production authority for staff identity,
sessions, role and scope decisions, organization, admissions, students,
enrollments, course delivery, classes, schedules, attendance, finance,
certificates, communication, audit, and other Nile-owned operational records.
The NCC contract must be extended to support Student before the Student portal
can cut over.

The Express/Vercel API in this repository remains a thin same-origin
backend-for-frontend. It may translate DTOs, protect browser sessions, rotate
NCC tokens, enforce first-party request checks, and aggregate already-authorized
read models. It must not become a second writable operational backend.

Browser JavaScript never stores NCC access or refresh tokens. The
backend-for-frontend exchanges credentials and maintains a Secure, HttpOnly,
SameSite session boundary that works across serverless instances. Process-memory
token storage is diagnostic-only and is not a production session design.

Portal families cut over independently after their NCC endpoint family passes
the frontend acceptance contract. Until then, compatibility behavior remains
explicitly non-production and may not be merged into accepted NCC results.

NCC EMS is also the production server mediator for Moodle. Moodle remains the
sole writable authority for learning content and outcomes under ADR-010. NCC
EMS remains authoritative for operational attendance. Each Nile class maps to
one isolated Moodle delivery course cloned from an approved template; a shared
Moodle course group is not the primary class-isolation boundary.

The old working NCC domain is the current switchable staging target. The new
domain is a separate, unaccepted environment until its database fixtures,
authentication, proxy/CORS behavior, and contract parity pass the same gate.
Neither domain is hard-coded into browser code.

## Invariants

- One operational field has one writable production authority: NCC EMS for
  Nile-owned records or Moodle for Moodle-owned learning records.
- The authenticated NCC session supplies actor, active role, permissions,
  branch, department, class relationship, and ownership.
- Browser payloads do not assert actor, role, permission, branch, department,
  ownership, provider credentials, or token expiry.
- Student routes do not cut over until NCC provides own-scope session and data
  contracts plus cross-student denial evidence.
- Mutating endpoint families require idempotency and version/concurrency
  behavior before frontend activation.
- A route never reports a compatibility/demo success as an NCC success.
- A visual connected, synchronized, or healthy state requires current
  server-verified evidence.
- Moodle credentials remain server-only and a human Moodle administrator is
  never the production connector.
- No Supabase or compatibility runtime is removed until the corresponding NCC
  family passes focused and full regression gates and retains a rollback path.

## Consequences

- The master plan, backend requirements, runtime profiles, and auth adapters
  must be migrated from Supabase-production assumptions to NCC authority.
- Existing normalized Supabase packages remain test and compatibility evidence;
  they are not promoted as the production business store.
- Staff login no longer treats a role selected in the browser as authority.
- NCC role names and snake_case DTOs are translated only at the transport
  boundary; internal route names remain stable.
- Missing NCC families require backend-team work rather than reduced frontend
  behavior or fabricated local writes.
- Existing direct Moodle adapters remain compatibility and contract evidence
  until NCC reaches equivalent projection, command, file, launch, and
  reconciliation parity.

## Migration And Rollback

Cut over one endpoint family behind an explicit server-side flag. For each
family, prove allowed and denied scope, refresh/revocation, replay, conflict,
outage, audit, UI state, focused QA, and the complete protected portal gate.
Rollback disables only that family flag and restores the prior adapter without
deleting NCC, Supabase, compatibility, mapping, or audit evidence.

Production activation, remote data mutation, credential retirement, and removal
of compatibility storage require separate approved slices. Previously exposed
staging and Moodle credentials must be rotated before live mutation or deployed
use.
