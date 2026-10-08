# ADR-013: Unified Staff App On The NCC Interaction Model

- Status: Accepted
- Date: 2026-10-06
- Supersedes: none; extends ADR-012
- Preserves: ADR-012 backend authority and session boundary; all legacy role
  portals remain working until each functional family is replaced and accepted

## Context

The external NCC EMS team ships its own staff frontend against the same
staging contract Nile Learn now targets under ADR-012. That frontend uses one
unified staff application: a single shell with role-filtered navigation, a
branch workspace gate for branch-scoped roles, a role-view switch for
management roles, and session-scope editing. Nile Learn instead maintains six
separate legacy role portals whose navigation, density, and interaction models
diverge from the backend team's model. Maintaining both models doubles review
surface and hides the provider's own role and scope semantics.

The live NCC contract also now defines seven staff roles — `super_admin`,
`branch_admin`, `vice_manager`, `hod`, `registrar`, `ssa`, `teacher` — while
the Nile Learn portals and session envelope only knew the older five-role
mapping.

## Decision

Build one unified staff application under `/app/...`, following the NCC
frontend's interaction model: grouped, role-filtered navigation; a workspace
gate for `branch_admin`, `vice_manager`, `registrar`, and `ssa`; a role-view
control for `super_admin`, `branch_admin`, `vice_manager`, and `hod` that may
only act as strictly lower-privileged roles; and session-scope editing backed
by the provider's `/auth/session-scopes` endpoints.

The seven EMS role strings are the transport authority. The session envelope
carries a normalized `ncc` block with `assignedRole`, `activeRole`,
`workspaceBranchId`, `workspaceAccess`, and `effectiveScopes`. Legacy local
roles still drive only the compatibility portals; `vice_manager` maps to
`branchadmin` and `ssa` maps to `registrar` for those portals alone.

Browser code talks only to same-origin `/api/ncc/...` BFF routes. The sealed
HttpOnly session cookie remains the only credential boundary; NCC tokens never
enter JavaScript-accessible storage. Data caching keys every list/detail query
by active role plus workspace branch so a role or workspace switch can never
reuse another view's data.

Each functional family (admissions, delivery, organisation, settings) replaces
its legacy portal routes only after that family is implemented in the unified
app and passes browser acceptance. Until then, every legacy portal, the
student portal, and all compatibility providers keep working unchanged.

## Consequences

- New shared staff primitives, navigation, session, and styling live under
  `client/src/staff/`; their visual tokens are scoped to a `.staff-app` root
  and do not modify the existing global stylesheet.
- The unified app adds `/app/notifications` and `/app/profile` first; further
  families follow the phase plan under the same `/app` prefix.
- The legacy `PlatformShell` links into the new app only for NCC sessions.
- New BFF routes cover role switching, session scopes and scope options,
  active-session listing and revocation, logout-all, and notification
  deletion; all follow the existing flag, sealed-cookie, no-store, and
  status-passthrough conventions.
