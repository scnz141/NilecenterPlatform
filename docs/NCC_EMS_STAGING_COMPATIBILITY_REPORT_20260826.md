# NCC EMS Staging — Live Integration Compatibility Report

**Date:** 2026-08-26 (probes executed 2026-08-25 21:15–21:17 UTC)

**Target:** `https://ncc-ems-staging.enesekremergunesh.com/api` («NCC EMS API» v1.0.0, FastAPI behind nginx, spec at `/api/openapi.json`, 32.2 KB, docs UI at `/api/docs#/`)

**Basis:** live HTTP probes against staging + full OpenAPI read + comparison against `docs/BACKEND_API_ENDPOINT_REQUIREMENTS.md` (14 required endpoint families, delivery priorities P0–P3, frontend integration acceptance).

**Constraint honored:** read-only and negative-auth tests only. No staging credentials exist, so no successful authenticated call or data mutation was attempted. Everything below is verifiable at the URL above.

---

## 1. Verdict

**The staging API is live and real, auth-guarded, and carries a meaningful first-inch of the contract — but it covers only families 1–2 (partially) of 14, and it does not yet meet the repo's Frontend Integration Acceptance criteria for any family. Do not wire frontend routes to it yet; keep the compatibility server (`server/`) as the working surface and feed the correction list in §7 back to the NCC EMS team.**

## 2. What I tested live (all evidence)

| Probe | Request | Result | Finding |
|---|---|---|---|
| Liveness | `GET /api/ping` | **200** `{"pong":true}` 0.17s | Up; no auth needed |
| Liveness | `GET /api/health` | **200** `{"status":"ok"}` 0.19s | Liveness only — no DB/queue/storage readiness (matches our §13 critique) |
| Root | `GET /api/` | **200** `{"service":"backend","status":"ok","message":"NCC EMS API is running"}` | Confirms FastAPI identity behind nginx `/api` prefix |
| OpenAPI | `GET /api/openapi.json` | **200**, OpenAPI 3.1, 25 paths / 28 operations | Full contract inventory (§3) |
| Auth guard | `GET /api/auth/me` (no token) | **401** `{"detail":"Not authenticated"}` + `WWW-Authenticate: Bearer` | Protected ops are actually guarded |
| Auth guard | `GET /api/users` (no token) | **401** same shape | Same |
| Auth guard | `GET /api/custom-fields` (no token) | **401** same shape | Same |
| Auth guard | `GET /api/users/{random-uuid}` (no token) | **401** | Guarded (no existence leak unauth'd) |
| Auth guard | `POST /api/auth/change-password` (GET) | **405** | Method not allowed, as expected |
| Login | `POST /api/auth/login` fake creds | **401** `{"detail":"Invalid email or password"}` | No user enumeration via login |
| Login | `POST /api/auth/login` `{}` | **422** `{"detail":[{type,loc,msg,input}...]}` | Pydantic validation errors under `detail` |
| Login | `POST /api/auth/login` wrong types | **422** same shape | Consistent 422 envelope |
| Refresh | `POST /api/auth/refresh` `{}` | **422** missing `refresh_token` | Field-level validation |
| Refresh | `POST /api/auth/refresh` garbage token | **401** `{"detail":"Not authenticated"}` | 401 on invalid refresh cred |
| Invitation | `POST /api/auth/invitations/validate` fake token | **400** `{"detail":"Invitation is invalid or expired"}` | Deterministic, no enumeration leak |
| Invitation | `POST /api/auth/invitations/accept` `{}` | **422** both fields required | Lifecycle direction exists |
| CORS | `OPTIONS /api/auth/login` `Origin: https://nile-center-platform.vercel.app`, `Access-Control-Request-Headers: content-type,authorization` | **400** `Disallowed CORS origin` | Preflight **rejected** for our production origin |
| CORS | `Origin: nile-center-platform.vercel.app` on `GET /api/ping` | 200 — but **no** `access-control-allow-origin` echo; only `access-control-allow-credentials: true` | Origin not whitelisted; browser cross-origin calls would fail |
| Token shape | `GET /api/auth/me` `Authorization: Bearer abc` | **401** `Not authenticated` | No token-format leak; uniform 401 |

## 3. Their live surface (28 operations, all under `/api`)

**Public (no security):** `GET /`, `GET /ping`, `GET /health`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/invitations/validate`, `POST /auth/invitations/accept`.

**Bearer JWT protected:** `POST /auth/logout`, `POST /auth/logout-all`, `POST /auth/switch-role`, `POST /auth/change-password`, `GET /auth/me`, `GET /auth/sessions`, `DELETE /auth/sessions/{session_id}` · `GET/POST /users`, `GET/PATCH /users/{user_id}`, `POST /users/{user_id}/invite|cancel-invitation|password|disable|enable` · `GET/POST /custom-fields`, `PATCH /custom-fields/{field_id}`, `POST /custom-fields/{field_id}/disable|enable`.

**Security scheme:** `BearerAuth` (http, `bearerFormat: JWT`) — with description "Authorization uses EMS roles, not OAuth2 scopes."

**Their role model (from `User_Role` enum):** `super_admin, branch_admin, hod, registrar, teacher` — privilege ordering defined server-side in `src/modules/auth/roles.py`. Scopes are first-class (`Scope_Response`, `Scope_Write`, `Scope_Kind`) and attached to users/sessions. User status lifecycle: `invited → active → disabled / canceled`, with documented transition rules.

**Their identity/account concepts that overlap with ours:** `assigned_role` vs `active_role` + session-bound scopes (`Me_Response`), session list incl. `is_current`, `last_seen_at`, IP/UA (`Session_Response`), invitation token → validate/accept flow, `moodle_user_id` linkage on users, `custom_fields` per entity (Phase-4-marked in descriptions), `invitation_url` + `generated_password` returned only at creation ("present once and never on later GETs" — good practice).

## 4. Family coverage vs. our 14 required families

Legend per requirements doc: **AVAILABLE** / **INCOMPLETE** / **MISSING** (the doc's section headers already carry the stale state — see §8).

| # | Required family | Live verdict | Evidence |
|---|---|---|---|
| 1 | Auth, invitations, self profile | **INCOMPLETE** | `login/logout/logout-all/refresh/switch-role/change-password/me/sessions`, invitation `validate/accept` all present and tested. **Missing from ours:** session-resolution endpoint with expiry + permissions summary (`Me_Response` has no expiry/permissions), public `password-reset/request|confirm` (only admin `POST /users/{id}/password`), `PATCH /v1/me`, `PATCH /v1/me/preferences`, `GET /v1/me/activity` |
| 2 | Users, roles, permissions, org | **INCOMPLETE** | Users CRUD + `invite/cancel-invitation/password/disable/enable` + sessions list/revoke exist and are guarded. **Missing:** `/roles` summaries, `/permissions` matrix, role-grants resource (scopes are embedded on users instead), branches, departments, programs, levels |
| 3 | Leads, applications, placement, students | **MISSING** | No endpoints at all |
| 4 | Enrollment and class assignment | **MISSING** | No endpoints at all |
| 5 | Offerings, runs, classes, teachers, rosters | **MISSING** | No endpoints at all |
| 6 | Rooms, scheduling, sessions, attendance | **MISSING** | No endpoints at all |
| 7 | Moodle learning projections | **MISSING** | Only `moodle_user_id` linkage + scope fields; no learning/courses/assignments/quizzes/grades/completion/files/launches/commands |
| 8 | Interventions and Quran | **MISSING** | No endpoints at all |
| 9 | Messaging and notifications | **MISSING** | No endpoints at all |
| 10 | Finance | **MISSING** | No endpoints at all |
| 11 | Certificates | **MISSING** | No endpoints at all |
| 12 | Forms and Jotform | **MISSING** | No endpoints at all |
| 13 | Reports, audit, health, integrations | **INCOMPLETE** | Health liveness only (`{"status":"ok"}` — plus `GET /` info root). No readiness detail, no dashboards/reports/audit/integrations-health |
| 14 | Private files | **MISSING** | No endpoints at all |

**Net:** 0 families AVAILABLE, 2 INCOMPLETE (1, 2, 13 shallow), 12 MISSING. Families 3–14 — the institutional loop (admissions → enrollment → class → attendance → finance → certificates) — are entirely absent. Their current scope is essentially "staff identity + RBAC seeds": auth, users, scopes, custom-field definitions.

Compared with the last documented snapshot (`docs/BACKEND_API_ENDPOINT_REQUIREMENTS.md` §"Live Staging API State"), the old unsafe `POST /moodle/config/` plaintext-ws-token endpoint is **gone**, and the surface grew from 1 auth path to 28 guarded operations — so the team is building the right way (auth-first, no secrets in specs), just not the families we need most.

## 5. Contract mismatches (our contract vs. their implementation)

1. **Roles differ.** Theirs: `super_admin, branch_admin, hod, registrar, teacher` — **no `student`**; ours: `superadmin, branchadmin, headofdepartment, registrar, teacher, student`. Even the names diverge. Our student portal and all six-role acceptance criteria (seeds, examples) cannot be satisfied by their staff-only model.
2. **Transport.** Bearer JWT with `refresh_token` rotation in the response body vs. our HttpOnly-cookie `app_session_id` session model (`docs/auth-session-hardening.md`). Our migration table explicitly makes `/api/auth/*` replacement conditional on cookie/session + error parity — that parity does not exist yet. Token-in-body also conflicts with our no-secret-in-browser-traffic posture (their own OpenAPI says "Paste the access JWT…" — a dev-ergonomics choice that is fine for machine clients, but not browser-first).
3. **No list envelope.** Users/custom-fields return bare arrays (filters `assigned_role/status/search/entity_type/is_active` only) — no `{items, nextCursor, total, generatedAt, scope}`. Automated keyword scan of the whole spec: `page/cursor/offset/limit/total` = **0 occurrences**.
4. **Error envelope.** FastAPI default `{detail: string | [{type, loc, msg, input}]}` — not our `{error: {code, message, fieldErrors, correlationId, retryable}}`. `type/loc/msg/input` is decent machine-readable validation detail, but there is no error code vocabulary, no correlationId to tie server logs to browser sessions, no retryable flag.
5. **No mutation safety.** No `Idempotency-Key`, no `expectedVersion`/`If-Match`, no ETags. Scan: `idempot/if-match/etag/expectedVersion` = 0. PATCH /users is last-write-wins with no concurrency guard. Our acceptance criterion #5 (idempotency + concurrency) fails for every write.
6. **No freshness/audit metadata.** `generatedAt`, `asOf`, `freshness`, `sourceUpdatedAt`, `projectedAt`, `allowedActions` = 0 occurrences. Even future families will need these for Moodle projections and reports.
7. **Switch-role semantics differ.** Theirs: session keeps `assigned_role`/`active_role` and scopes, switching among roles the same session may view (our requirement: switch-role must **validate the grant, rotate the session, revoke the old role-bound session**). Their `switch-role` rotation behavior is not documented; their session list implies multiple simultaneous sessions (`logout-all`).
8. **Invitations are admin-only creation.** `POST /users` requires `assigned_role` + `profile` + `provisioning` — no `student`, no self-service registration. Our invitation flow is for all six roles, student self-read profiles, etc.
9. **Versioning/naming.** Ours: versioned `/v1/*` paths. Theirs: unversioned `/auth|users|custom-fields/*` with FastAPI-style `operationId`s (`post_login_auth_login_post`) — no stable, curated operation IDs (our P0 #4 asks for stable operation IDs and tags; tags exist, operation IDs are auto-generated).

## 6. What actually works and matches our direction (give them credit)

- **It's real, guarded, and consistent.** Every protected op returns a uniform 401 with `WWW-Authenticate: Bearer`; login doesn't enumerate users; validation errors are structured.
- **Invitation lifecycle direction matches ours:** validate → accept with password set, deterministic expired/invalid handling (`400` with one message), invitations stored server-side, tokens never in URLs, `invitation_url`/`generated_password` returned exactly once.
- **User lifecycle is careful:** explicit status machine (`invited→active→disabled/canceled`) with valid-transition documentation; disable/enable/password-reset as separate auditable actions — close in spirit to our versioned-transition style.
- **Session awareness exists:** session enumeration, current-session flag, revocation (`logout-all`, `DELETE /auth/sessions/{id}`) — a real step toward our session authority (though cookie-based, not JWT-based).
- **Scopes are server-side and explicit** (`Scope_Response`/`Scope_Write`) — aligns with our "server resolves relationship and scope for every record" rule.
- **No secrets in the spec** — response examples carry no tokens; old plaintext ws_token endpoint is gone.

## 7. Corrections to feed back to the NCC EMS team

Priority-ordered, mapped to our P0–P3:

1. **P0 — Add the `student` role (or define a separate student identity API).** Without it, the student portal, six-role seeds/acceptance, and our role model cannot be tested against staging at all. If EMS intends staff-only, say so explicitly and we keep students on the compatibility server.
2. **P0 — Define the common envelope:** error `{code, message, fieldErrors, correlationId, retryable}`, list `{items, nextCursor, total, generatedAt, scope}`, and `allowedActions` on authoritative reads. Add correlationId to every response (it already returns `cf-ray`, so a server-side correlationId is trivial to add).
3. **P0 — Mutation safety:** accept `Idempotency-Key` on all POSTs; `If-Match`/`expectedVersion` on PATCH; document concurrency behavior.
4. **P0 — Readiness:** `GET /health` should report app/db/queue/storage readiness, not just liveness, since our fallback depends on it.
5. **P1 — Version the API:** put it under `/v1` and curate stable `operationId`s; keep the nginx `/api` prefix.
6. **P1 — Add the auth-session resolution endpoint** returning expiry + permissions summary (our `GET /v1/auth/session` semantics), and public password reset (request/confirm), `PATCH /me`, `/me/preferences`, `/me/activity`.
7. **P1 — Implement the institutional loop next:** leads → applications → placement → students → enrollments → classes → teacher assignment → schedules → attendance (families 3–6), with conflict validation and versioned attendance writes.
8. **P2/P3 — Then:** finance, certificates, messaging, reports/audit, private files, then Moodle projections with `sourceUpdatedAt`/`projectedAt`/`freshness` and command/reconcile flows.
9. **CORS:** when browser wiring is intended, whitelist `https://nile-center-platform.vercel.app` (and any local preview origins) — preflight currently returns **400 Disallowed CORS origin** for our production origin. Note: if the platform proxies `/api` server-side (our current gateway pattern via `api.ts` same-origin), CORS is moot for browsers — decide the transport boundary and document it.

## 8. Doc-drift warning (for the user to decide, not silently fixed)

`docs/BACKEND_API_ENDPOINT_REQUIREMENTS.md`:

- §"Live Staging API State" is **stale** — it describes the old Stackforge API with the unsafe `POST /moodle/config/`; the live surface is the 28-operation spec above.
- Every family section header says `MISSING` while family 1 and 2 have real (partial) coverage — the "Current staging state" lines under §1, §2, and §13 should be updated to match this report.

I did not edit the doc (working tree is already dirty with an unrelated slice). If you approve, I'll update those state lines to match the live surface.

## 9. Recommendation (per repo authority rules, AGENTS.md L70–108)

- **Do not wire any frontend route to this staging API yet.** No family meets all 10 Frontend Integration Acceptance criteria (roles complete, closed error schemas, pagination, idempotency, `allowedActions`, seeds for all six roles, positive examples, contract tests). Families 3–14 are simply absent.
- **Keep `server/` as compatibility evidence** until parity is proven; existing routes stay on compatibility adapters and show unavailable/dev state rather than fabricating writes.
- **Next practical step:** send §7 as a concrete correction list to the EMS team, prioritizing the student role + common envelopes + the families 3–6 loop. Re-probe after they ship, then re-run this matrix.