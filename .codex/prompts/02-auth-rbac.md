# 02 Auth RBAC

## SPEC

Build and harden authentication, role selection, route guards, and RBAC without changing backend/auth boundaries unless explicitly requested.

## PLAN

- Inspect auth routes, session storage, `PlatformShell`, role navigation, and permissions.
- Map role to route roots.

## IMPLEMENT

- Separate student and administration sign-in flows.
- Preserve existing auth/backend behavior.
- Add clear denied/redirect states.

## VERIFY

- Direct-route access for each role.
- Login/logout flow.
- `npm run check`, `npm test -- --run`, `npm run build`.

## REVIEW

- RBAC reviewer.
- Security reviewer.

## FIX

Patch route leaks, role mismatch, and permission gaps.

## DOCUMENT

Document auth assumptions and server-side follow-up work.
