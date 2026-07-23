# Beta Readiness Audit

## Status

Nile Learn is beta-ready for the current internal-alpha definition.

This does not mean production cutover is complete. Full synthetic Moodle
sandbox CRUD is approved by ADR-011, while production persistence, durable
sessions, normalized Supabase tables, RLS rollout, media storage, production
Moodle activation, and EMS/payment/email/WhatsApp/meeting connections remain
hardening work.

## Evidence Snapshot

- Validation command: `QA_OUTPUT_DIR=output/playwright/beta-goal-20260709-verify scripts/verify.sh`
- Portal QA artifact: `output/playwright/beta-goal-20260709-verify/portal-qa-summary.json`
- Portal QA result: 1,205 checks, 0 failures
- Checked at: `2026-07-09T09:38:47.361Z`
- Unit tests in that run: 168 passed
- Build in that run: passed

## Requirement Audit

| Requirement                                                                                                              | Status                                | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Full portal QA is clean.                                                                                                 | Proven                                | `docs/qa-baseline.md` records the fresh 1,205/0 baseline. The QA artifact reports `failedChecks: 0` and `inProgress: false`.                                                                                                                                                                                                                                                                                                                                                                             |
| Core role workflows work through the browser.                                                                            | Proven                                | Portal QA deep workflows cover student learning, submissions, quizzes, attendance, messages, reports, teacher attendance/materials/grading/quiz review/Quran review, registrar leads/applications/placement/payments/enrollment activation, HOD curriculum/assessment/certificates/reports, branch attendance/schedule/rooms/payments/reports, and super admin users/roles/permissions/branches/settings/integrations/system health.                                                                     |
| Simple UI route separation is clear.                                                                                     | Proven                                | `client/src/App.tsx` has dedicated route owners for admin users, roles, permissions, branches, schedule, reports, courses, registrar admissions/students/payments/enrollments/classes/schedule, HOD workflows, branch operations, messages, and profiles. `docs/qa-baseline.md` documents the route split.                                                                                                                                                                                               |
| Users, roles, permissions, branches, courses, schedules, reports, students, teachers, and admissions are understandable. | Proven for beta                       | `docs/internal-admin-workflows.md` maps roles, account creation, required fields, scopes, permissions, routes, actions, audit logs, student lifecycle, teacher lifecycle, registrar lifecycle, HOD lifecycle, branch admin lifecycle, and super admin lifecycle.                                                                                                                                                                                                                                         |
| Server action gates and audit logs remain intact.                                                                        | Proven                                | `server/platformState.ts` derives the actor from the authenticated session, checks role permissions, enforces ownership/scope, applies mutations, records audit/event evidence, and returns session-scoped state. `client/src/lib/auth/server-platform-state.test.ts`, `server-state-scoping.test.ts`, and `server-platform-repository.test.ts` cover spoofing, staff/user gates, profile self-scope, teacher/student scope, attendance, grading, reports, branch/HOD/registrar scoping, and audit rows. |
| External integrations remain phase-gated.                                                                                | Proven                                | ADR-011 permits full synthetic Moodle sandbox CRUD. Production Moodle, EMS, payments, email/SMS/WhatsApp, meeting, and media activation remain governed by `AGENTS.md` and the master plan.                                                                                                                                                                                                                                                                                                              |
| Persistence architecture is planned or partially abstracted, but not necessarily fully production-live.                  | Proven                                | `server/platformRepository.ts` provides the current repository boundary with snapshot read/write/event methods, local fallback, optional Supabase snapshot/event writes, and test injection. `docs/production-persistence-plan.md` documents the phased normalized Supabase/RLS migration plan.                                                                                                                                                                                                          |
| No real secrets or unsafe provider code exist.                                                                           | Proven for tracked source/docs/config | `.env.example` uses placeholders, local env files are ignored, browser Supabase config uses only `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and `VITE_SUPABASE_ANON_KEY`, and server-only keys stay in server code. The latest tracked/untracked source scan found 0 real secret-pattern findings outside generated output/local data.                                                                                                                                                        |

## Current Non-Blocking Production Gaps

- The repository still uses a denormalized `PlatformState` snapshot as the default state model.
- Supabase persistence is snapshot/event based, not normalized production authority.
- Sessions are still in memory through `server/sessionStore.ts`.
- RLS tables and policies remain draft/planned work.
- External providers are placeholders and must not be treated as live integrations.
- Media, audio, video, documents, meeting links, and real provider delivery are not production storage/delivery flows yet.
- The worktree contains broad uncommitted implementation changes from the stabilization phase; do not tag or release without deciding whether to commit that whole baseline.

## Guardrail For Next Work

The beta baseline must remain protected. Future changes that touch routes, workflows, domain actions, RBAC, server action gates, persistence, or portal UI must rerun validation and preserve the 1,205/0 portal QA result.
