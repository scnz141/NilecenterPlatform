# Supabase Demo QA Report

Date: 2026-07-05

## Supabase connection status

- Status: connected with environment variables.
- Project ref: `lkvyhevoommqnpwwmqgp`.
- Required env variables are documented in `.env.example`:
  - `SUPABASE_URL`
  - `SUPABASE_PUBLISHABLE_KEY` or publishable/anon alias
  - `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY`
  - `SUPABASE_DEMO_PASSWORD`
- Hosted REST table reachability:
  - `platform_demo_entities`: reachable.
  - `platform_records`: reachable.
  - `platform_state_snapshots`: reachable.
  - `platform_events`: reachable.
- Supabase connector status:
  - The Codex Supabase connector is installed and can list projects.
  - The connected Supabase account currently lists only `myrentalfind Project` and `my rentalfind dev`.
  - The connector does not currently have access to the Nile Learn project ref `lkvyhevoommqnpwwmqgp`.
  - Read-only connector calls to list migrations and query Nile Learn tables returned `MCP error -32600: You do not have permission to perform this action`.
- Local Supabase CLI status was not usable in this environment because Docker is not running.

## Migrations and storage model

- Existing migrations define the current Supabase testing surface:
  - `supabase/migrations/20260626185139_platform_demo_seed_tables.sql`
  - `supabase/migrations/20260627110345_platform_state_snapshots.sql`
- Tables use RLS with service-role access for server-side seed/admin operations.
- Current persistence is intentionally still a testing/demo model:
  - flattened demo entities in `platform_demo_entities`
  - operational records in `platform_records`
  - full platform snapshot in `platform_state_snapshots`
  - audit/event rows in `platform_events`
- This is not yet a normalized production schema.

## Seed result

`npm run seed:supabase` completed successfully.

- Auth users created: 0.
- Auth users updated: 24.
- Auth users verified: 24.
- Auth failures: 0.
- `platform_demo_entities`: 281 attempted, 281 upserted.
- `platform_records`: 7 attempted, 7 upserted.
- `platform_state_snapshots`: 1 attempted, 1 upserted.
- `platform_events`: 1 attempted, 1 upserted.

## Seed data counts

| Entity                 | Count |
| ---------------------- | ----: |
| Users                  |    18 |
| Branches               |     4 |
| Departments            |     6 |
| Programs               |     5 |
| Levels                 |     4 |
| Courses                |     4 |
| Modules                |     9 |
| Lessons                |    12 |
| Resources              |    12 |
| Course runs            |     6 |
| Class groups           |     6 |
| Students               |     6 |
| Teachers               |     3 |
| Staff profiles         |    12 |
| Enrollments            |     7 |
| Assignments            |     4 |
| Assignment submissions |     4 |
| Quizzes                |     4 |
| Quiz attempts          |     4 |
| Grades                 |     4 |
| Events                 |     7 |
| Class sessions         |     4 |
| Rooms                  |     5 |
| Attendance records     |     7 |
| Leads                  |     4 |
| Applications           |     4 |
| Placement tests        |     4 |
| Placement results      |     3 |
| Invoices               |     6 |
| Payments               |     4 |
| Certificates           |     5 |
| Quran progress records |     3 |
| Recitation submissions |     3 |
| Messages               |     4 |
| Notifications          |     4 |
| Audit logs             |     6 |
| Integrations           |     8 |

## Demo accounts

Seeded demo accounts use fake `.local` and `.test` emails only. The password is controlled by `SUPABASE_DEMO_PASSWORD` and is not stored in the repository.

| Role         | Primary account                  | Short login |
| ------------ | -------------------------------- | ----------- |
| Student      | `student.demo@nilelearn.local`   | `s@nl.test` |
| Teacher      | `teacher.demo@nilelearn.local`   | `t@nl.test` |
| Registrar    | `registrar.demo@nilelearn.local` | `r@nl.test` |
| HOD          | `hod.demo@nilelearn.local`       | `h@nl.test` |
| Branch admin | `branch.demo@nilelearn.local`    | `b@nl.test` |
| Super admin  | `admin.demo@nilelearn.local`     | `a@nl.test` |

Additional scoped accounts were seeded for Cairo, Alexandria, Quran, operations, paused, ready-to-enroll, and completed demo states.

## UI workflow QA

Full portal QA passed:

- Total checks: 921.
- Failed checks: 0.
- Artifact: `output/playwright/portal-qa-summary.json`.
- Final browser console-error check: passed.
- Workflow/API action errors: none remaining in the passing browser suite.

Manual Browser plugin checks were also run against the local production server at `http://127.0.0.1:3001`:

| Area         | Result | Manual evidence                                                                                                                                                                              |
| ------------ | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Student      | Pass   | Signed in as Student through the visible student login form and reached `/app/student/dashboard` with `Student Demo`, `My Learning Dashboard`, course, assignment, and quiz content visible. |
| Teacher      | Pass   | Signed in as Teacher through the visible staff login form, opened the attendance workflow, changed Cairo Student Demo to `Late`, saved, and saw `Attendance saved` plus the audit text.      |
| Registrar    | Pass   | Signed in as Registrar, opened `/app/registrar/leads`, created `Browser Manual Lead 1783240564958`, and confirmed it appeared in the lead list with success feedback.                        |
| HOD          | Pass   | Signed in as Head of Dept and reached `/app/hod/dashboard` with HOD identity and academic dashboard content visible.                                                                         |
| Branch admin | Pass   | Signed in as Branch Admin and reached `/app/branch/dashboard` with branch operations, rooms/schedule links, needs-attention items, payments, and attendance summaries visible.               |
| Super admin  | Pass   | Signed in as Super Admin, opened `/app/admin/users`, verified the simplified users table, created `Browser Manual Teacher`, landed on its detail page, and verified Access/Activity tabs.    |

Computer Use checks:

- Opened Comet in a new tab and navigated to `http://127.0.0.1:3001/app/admin/users/usr_teacher_mr7jo1gd_twql6`.
- Verified a separate browser without the authenticated Browser-plugin session shows the protected-route guard: `Sign in required`.
- Chrome app-state capture timed out, so Comet was used as the Computer Use fallback.

Role workflow results:

| Role         | Result | Coverage                                                                                                                                       |
| ------------ | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Super admin  | Pass   | dashboard routes, user creation, teacher assignment, roles/access governance, reports, integrations placeholder, health/settings audit actions |
| Registrar    | Pass   | leads, applications, placement booking/results, direct student creation, enrollment activation, invoice/payment settlement, partial payment    |
| Teacher      | Pass   | assigned routes, attendance, materials, class reminders, grading, quiz review, Quran recitation review, messaging                              |
| Student      | Pass   | learning progress, assignment submission, quiz attempt, grades, attendance/certificates access limits, Quran submission, messages, reports     |
| HOD          | Pass   | curriculum, course catalog, assessments, assignment grading, certificate approval/issue/rejection, department messaging/reports                |
| Branch admin | Pass   | scoped dashboard, attendance, schedule, room create/update, branch messages, branch payments, scoped reports                                   |

Cross-role coverage passed through the route matrix and deep workflows:

- Student routes do not expose staff mutation controls.
- Teacher workflows operate on assigned class/student data.
- Registrar workflows remain branch/scope aware.
- Branch admin workflows use branch-scoped records.
- HOD workflows use academic department/scope records.
- Super admin workflows can access global admin operations.
- Sensitive workflow actions create audit/event records.

## Console, network, and artifacts

- Browser console error check passed in `scripts/verify.sh`.
- No failed workflow API actions remain in `output/playwright/portal-qa-summary.json`.
- Supabase REST reachability was verified for `platform_demo_entities`, `platform_records`, `platform_state_snapshots`, and `platform_events`.
- Playwright artifact: `output/playwright/portal-qa-summary.json`.
- Existing screenshot artifacts are under `output/playwright/`; no new workflow-specific screenshots were required after the final green run.

## Bugs found and fixed during QA

- Expanded demo seed initially disturbed existing fixture assumptions in tests. Fixed by preserving baseline IDs, ordering, and scope-sensitive records while adding richer demo data around them.
- Registrar finance workflow QA compared global paid-payment counts against a scoped server response. Fixed the assertion to compare the selected invoice paid count.
- Quran review workflow QA kept a stale DOM reference after React refreshed the review card. Fixed the selector to re-query the live review card before each action.

## Commands run

```bash
supabase status
node --import tsx <inline Supabase REST reachability check>
node --import tsx <inline seed count check>
SUPABASE_DEMO_PASSWORD=<provided in shell> npm run seed:supabase
npm run check
npm test -- --run
npm run build
node --check scripts/seed-supabase-demo.ts
node --check scripts/qa-portals-cli.mjs
npx --no-install prettier --check docs/supabase-demo-qa-report.md
QA_BASE_URL=http://127.0.0.1:3001 QA_ONLY_WORKFLOWS="teacher Quran review workflow updates progress and approves recitation" npm run qa:portals
scripts/verify.sh
PORT=3001 NODE_ENV=production NILE_PLATFORM_STATE_LOCAL_ONLY=1 node dist-server/index.js
npx --no-install prettier --write docs/supabase-demo-qa-report.md
npx --no-install prettier --check docs/supabase-demo-qa-report.md
```

Manual verification tools used:

- Browser plugin: visible role login and workflow checks.
- Computer Use plugin: external Comet tab protected-route guard check.
- Supabase plugin: `_list_projects` succeeded; `_list_migrations` and `_execute_sql` against the Nile Learn project were denied by connector permissions.

## Validation result

- `npm run check`: pass.
- `npm test -- --run`: pass, 142 tests.
- `npm run build`: pass, with the existing large-chunk Vite warning.
- `scripts/verify.sh`: pass.
- Portal QA: pass, 921 checks, 0 failures.
- Supabase seed: pass.

## Remaining limitations

- No real production data was used.
- Moodle, EMS, payment gateway, WhatsApp/email, meeting provider, and media storage remain placeholders by design.
- The Supabase test model is snapshot/record based and not yet the final normalized production schema.
- The hosted Supabase tables are reachable, but local Supabase CLI/Docker workflows were not available because Docker is not running.
- Seed upserts do not delete historical `platform_events`, so table row counts can include previous QA-generated activity.

## Next fixes needed

- Design and migrate the normalized production Supabase/Postgres schema when production persistence is approved.
- Run local Supabase CLI migration verification after Docker is available.
- Add real provider integrations only when Moodle, EMS, payments, messaging, meetings, and media storage are explicitly in scope.
