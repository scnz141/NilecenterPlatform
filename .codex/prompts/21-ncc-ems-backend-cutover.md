# 21 NCC EMS Backend Cutover

## SPEC

Migrate one approved Nile Learn endpoint or portal workflow family to the
external NCC EMS backend under ADR-012 without creating a competing local
production backend, exposing NCC or Moodle credentials, weakening role/scope
authority, or merging compatibility data into accepted NCC results.

Read the current slice from `docs/NILE_LEARN_MASTER_PLAN.md` under **Current
Modernization Checkpoint**. The complete roadmap does not authorize a broad
all-portal switch. Student, provider writes, remote mutations, runtime-default
changes, and compatibility removal require their own explicit checkpoint gate.

## PLAN

- Name the endpoint family, role, route owner, source of truth, and exact NCC
  methods and DTOs.
- Define session, role grant, permission, workspace, branch, department, class,
  and ownership behavior.
- Record required idempotency, version/concurrency, allowed actions, audit,
  correlation, pagination, and freshness behavior.
- Identify loading, empty, unavailable, denied, conflict, disabled, saving,
  success, expiry, refresh, and retry states.
- Define the family flag, compatibility fallback prohibition, rollback, exact
  write set, focused tests, portal QA workflow, and backend prerequisites.
- Stop if the NCC contract, accepted synthetic fixture, or source authority is
  incomplete.

## IMPLEMENT

- Keep the Express/Vercel layer a thin same-origin BFF. It may protect sessions,
  rotate/revoke NCC tokens, translate closed DTOs, and aggregate
  already-authorized reads; it may not persist competing operational records.
- Keep NCC access and refresh tokens out of JavaScript-accessible storage. Use
  the approved Secure, HttpOnly, SameSite session boundary and prove it across
  serverless instances.
- Derive active role, permissions, branch/workspace, department, class
  relationship, and ownership from the authenticated NCC session.
- Translate NCC role names and snake_case DTOs only at the transport boundary.
- Preserve 401, 403, 404, 409, 422, 429, and 503 meaning. Only a failed refresh
  after 401 may return the user to sign-in.
- Require idempotency and expected-version behavior before enabling a mutation.
- Keep endpoint families behind independent server-side cutover flags.
- Render NCC data or an honest unavailable state. Never merge demo, snapshot,
  Supabase, or stale cross-scope data into an accepted NCC result.
- Keep Moodle server-mediated and preserve ADR-010 authority: NCC owns
  operational attendance; Moodle owns learning content and outcomes; one Nile
  class maps to one isolated Moodle delivery course.
- Do not hard-code either NCC domain. Use the old working domain only through
  server configuration until the new environment independently passes its gate.

## VERIFY

Run the smallest affected tests first, then:

- contract parsing and malformed-payload tests;
- allowed-role and every relevant cross-role/cross-scope denial;
- refresh rotation, expiry, revocation, remote logout, timeout, and outage;
- idempotent replay, payload/version conflict, and partial-failure behavior for
  every enabled mutation;
- cache isolation after active-role or workspace changes;
- secret-redaction and browser-storage assertions;
- `npm run check`;
- `npm test -- --run`;
- `npm run build`;
- the focused portal workflow;
- unfiltered `scripts/verify.sh` when route, auth, RBAC, workflow, persistence,
  or portal behavior changes.

Preserve the accepted 1,667-check, 0-failure portal baseline unless an explicit
QA-scope decision establishes a replacement.

## REVIEW

- RBAC/security: session tokens, role grants, workspace, scope, direct-route
  access, first-party request checks, errors, and secret handling.
- Data/integration: source ownership, DTO closure, idempotency, versioning,
  audit, correlation, provider mappings, and rollback.
- QA/UI where a page changes: all operational states, responsive/RTL,
  accessibility, cache isolation, and no false success/connected state.

## FIX

Fix only validated findings inside the approved endpoint family. Rerun the
failing focused check before the integrated gates. Do not weaken NCC scope,
Moodle authority, validation, audit, or portal QA to make a route pass.

## DOCUMENT

- Update the master checkpoint only after the current family passes its gate.
- Update `docs/BACKEND_API_ENDPOINT_REQUIREMENTS.md` when live parity changes.
- Update the integration ownership/freeze records when a route receives one new
  accepted owner.
- Record redacted evidence only; never include credentials, tokens, personal
  data, or raw provider errors.

## RETURN

Report the endpoint family, authority, files changed, exact commands/results,
role/scope evidence, portal QA artifact and final count, rollback flag, backend
prerequisites, and whether the family is complete, partial, or blocked.
