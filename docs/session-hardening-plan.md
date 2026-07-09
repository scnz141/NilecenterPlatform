# Nile Learn Durable Session Hardening Plan

## Purpose

This is the current planning document for durable production sessions in Nile Learn. It does not change runtime authentication, cookies, session storage, Supabase Auth behavior, RBAC, or portal routes.

The existing implementation remains an internal-alpha session model with clean portal QA coverage. Durable production sessions should be implemented only after the normalized identity/profile/scope persistence plan is reviewed and the migration path remains reversible.

## Current State

Current server session code:

- `server/auth.ts` owns sign-in, cookie writing, session lookup, logout, demo reset, and demo password change behavior.
- `server/sessionStore.ts` owns the session-store interface.
- The default session store is in-memory.
- `POST /api/auth/login` can use Supabase password auth when configured, then falls back to demo auth when allowed.
- `attachSession` writes the `nilelearn_session` HttpOnly cookie.
- `getRequestSession` reads the cookie, loads the server session, rejects expired sessions, and deletes expired in-memory rows.
- `endRequestSession` deletes the current server session and clears the cookie.
- Client auth in `client/src/lib/auth/session.ts` stores a browser-local copy of the safe session DTO for UX and route refresh, but it is not the authorization boundary.

Current tests:

- `client/src/lib/auth/server-auth.test.ts` covers demo auth, password reset/change boundaries, session-store injection, cookies, logout, and expiry behavior.
- `client/src/lib/auth/server-state-scoping.test.ts` covers scoped read models by role.
- `client/src/lib/auth/server-platform-state.test.ts` covers server action role/scope gates.

## Current Limitations

- Sessions are lost on process restart.
- Sessions are not shared across multiple server instances.
- Session revocation is local to one process.
- There is no durable `last_seen_at`, `revoked_at`, `revoked_by`, `ip_hash`, or `user_agent_hash`.
- Supabase Auth can authenticate, but durable app identity, role, branch, and department scope tables are not runtime authority yet.
- Current `ServerSession.roles` and `ServerSession.activeRole` are created at sign-in and are not revalidated from normalized profile/scope tables on every sensitive action.
- Client `localStorage` can preserve a stale display copy until `/api/auth/session` refreshes it.

## Target Durable Session Model

Production sessions must be server-authoritative, durable, revocable, and scope-aware.

Target table: `app_sessions`

Recommended fields:

- `id`: server session UUID or opaque public session ID.
- `session_hash`: hash of the cookie value if raw cookie IDs are not stored.
- `user_id`: internal `app_users.id`.
- `auth_user_id`: Supabase `auth.users.id` when provider is Supabase.
- `provider`: `supabase` or controlled `demo`.
- `active_role`: active role selected for this session.
- `roles_snapshot`: role list at sign-in for display and drift detection only.
- `created_at`: session creation time.
- `expires_at`: hard expiry time.
- `last_seen_at`: last accepted session read.
- `revoked_at`: revocation time.
- `revoked_by`: admin/user that revoked the session.
- `ip_hash`: optional non-reversible client IP hash.
- `user_agent_hash`: optional non-reversible user-agent hash.
- `metadata`: server-owned diagnostics JSON.

Required indexes:

- `app_sessions_user_id_idx`
- `app_sessions_auth_user_id_idx`
- `app_sessions_session_hash_idx`
- `app_sessions_expires_at_idx`
- `app_sessions_revoked_at_idx`

Do not store plaintext secrets, service keys, provider tokens, or raw passwords in session rows.

## Cookie Contract

Keep the current cookie behavior stable during rollout:

- Name: `nilelearn_session`
- `HttpOnly`
- `SameSite=Lax`
- `Secure` in production
- `Path=/`
- `Max-Age` no longer than server-side session expiry

Future hardening after stable rollout:

- consider `__Host-` cookie prefix only after deployment/domain constraints are confirmed
- rotate session after sensitive actions
- add idle timeout separate from hard expiry
- add explicit user/admin session revocation UI only after durable storage exists

## Supabase Auth Mapping

Supabase Auth should identify the login user, but Nile Learn authorization must come from server-owned app tables.

Target sign-in flow:

1. Authenticate with Supabase Auth or controlled demo auth.
2. Resolve `auth.users.id` to `app_users.auth_user_id`.
3. Load active roles from `user_roles`.
4. Load branch and department scope from staff/student/profile tables.
5. Confirm the requested role is active and allowed.
6. Create a durable `app_sessions` row.
7. Return the same safe session DTO shape used today.

Rules:

- Do not use `raw_user_meta_data` as authority.
- Supabase `app_metadata` may be used as a sign-in hint only.
- Server-owned `app_users`, `user_roles`, staff scope tables, and student profile tables are the final authority.
- Demo auth remains local/internal only until explicitly retired.

## Role Switching Rules

Current client-side role switching updates the local safe session DTO only when the user already has the role. Production role switching should become server-confirmed.

Target behavior:

- Role switch calls a server endpoint or server action.
- Server checks the current session, active user, and current `user_roles`.
- Server writes a refreshed session or updates `active_role` in the durable session.
- Server returns a safe session DTO.
- If the role was removed or paused, the switch fails and the client clears stale local state.

Sensitive actions must always use the active role and scopes resolved server-side, not browser-local role state.

## LocalStorage Limitations

Allowed:

- cache the safe session DTO for UX while `/api/auth/session` refreshes
- remember UI preferences such as locale/sidebar state
- clear stale session state after server refresh returns null

Not allowed:

- authorize routes or server actions
- determine active role for server permissions
- determine branch or department scope
- store service keys, provider tokens, or secrets
- override server session expiry
- persist production refresh tokens

## Durable Session Adapter Plan

### Phase 0: Current In-Memory Store

Status: current runtime.

- Keep `server/sessionStore.ts`.
- Keep memory store as default.
- Preserve current login/logout/password behavior.
- Keep portal QA clean.

### Phase 1: Non-Default Durable Store Skeleton

No runtime default change.

- Add a durable store implementation behind an explicit server env flag only after the `app_sessions` migration exists.
- Use a repository/API boundary rather than embedding SQL in auth handlers.
- Add fake-adapter tests before real database tests.
- Keep memory store as the fallback.

### Phase 2: Durable Writes

No UX change.

- On sign-in, write a durable session row.
- Store only a safe cookie/session identifier.
- Keep response DTO unchanged.
- Keep logout deleting/revoking through the configured store.

### Phase 3: Durable Reads And Revocation

- `getRequestSession` loads from the configured durable store.
- Missing, expired, or revoked sessions return null.
- `last_seen_at` updates on a bounded interval, not every hot-path read if that becomes expensive.
- Logout revokes or deletes the durable session.

### Phase 4: Server-Side Role/Scope Refresh

Only after normalized identity/scope tables are runtime-ready:

- resolve `active_role` against active `user_roles`
- resolve branch and department scopes from server-owned tables
- deny sensitive actions if role/scope changed since sign-in
- require role re-selection when active role is no longer valid

### Phase 5: Session Management UI

Only after durable sessions are proven:

- optional user page for active sessions
- optional super admin revocation view
- audit admin revocations
- keep this out of normal dashboards unless it is a clear user job

## RLS And Access Plan

If `app_sessions` is exposed through Supabase APIs:

- enable RLS
- allow users to read only their own non-revoked session metadata
- allow users to revoke only their own sessions
- allow super admins to read/revoke sessions for support
- avoid direct browser writes for session creation
- use server-side credentials or an internal repository path for login/session creation

Most session operations should stay server-side and should not require browser access to session tables.

## Tests Needed Before Implementation

Unit tests:

- sign-in writes through the configured session store
- request lookup reads through the configured session store
- logout deletes or revokes through the configured store
- expired durable sessions are rejected
- revoked durable sessions are rejected
- missing durable session rows clear the client session on refresh
- role removed after sign-in blocks sensitive actions
- branch/department scope changes block sensitive actions
- provider-managed sessions cannot use demo password change behavior

API tests:

- `/api/auth/session` returns only safe fields
- `/api/auth/logout` clears the cookie and revokes/deletes the configured session
- protected APIs reject missing, expired, and revoked sessions
- workflow actions ignore spoofed body fields and use session actor/scope

Browser/portal QA:

- login/logout for all six roles
- direct protected-route access after login
- direct protected-route access without login
- stale localStorage session after server logout
- role switch with valid role
- role switch after role removal once role refresh exists

Use Aside by default for manual/browser QA, with Browser plugin and Computer fallback if Aside is unavailable.

## Rollback Plan

- Keep memory store as default until durable session tests and portal QA are green.
- Gate durable session reads/writes behind an explicit server env flag.
- Preserve cookie name and response DTO during rollout.
- If durable storage fails, turn off the env flag and fall back to memory store.
- Do not remove demo auth until production auth, durable sessions, role refresh, and QA are proven.
- Do not remove local safe-session cache until route refresh behavior has a replacement.

## Acceptance Gates

Before any durable session runtime change is accepted:

- `npm run check`
- `npm test -- --run`
- `npm run build`
- focused auth/session tests
- focused RBAC/scope tests
- full portal QA with 0 failures
- manual browser QA for login/logout and protected-route behavior

Current protected baseline remains 1,198 portal QA checks with 0 failures.

## First Safe Implementation Slice

The next code slice should not replace sessions globally.

Recommended first slice:

1. Add a non-default durable session-store interface extension only if the existing `SessionStore` methods are insufficient.
2. Add fake-adapter tests for revocation and lookup behavior.
3. Do not enable durable sessions by default.
4. Do not require Supabase credentials.
5. Do not change login UI or portal routing.
