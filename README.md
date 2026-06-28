# Nile Center Learning Platform

Nile Learn is a Vite, React, TypeScript, Tailwind CSS, Radix/shadcn-style learning platform for Nile Center. It includes public course discovery, authentication screens, protected role-based portals, a replaceable local platform store, rich seed data, RBAC helpers, i18n/RTL scaffolding, Moodle/EMS integration placeholders, and an admin blueprint for module ownership.

## Run

```bash
npm run dev
```

Build and type-check:

```bash
npm run check
npm test
npm run build
```

## Environment

Copy `.env.example` to `.env.local` when real services are connected. Keep real tokens and credentials out of the repository.

Required placeholders:

- `VITE_APP_NAME`
- `VITE_DEMO_AUTH_ENABLED`
- `VITE_OAUTH_PORTAL_URL`
- `VITE_APP_ID`
- `VITE_FRONTEND_FORGE_API_KEY`
- `VITE_ANALYTICS_ENDPOINT`
- `VITE_ANALYTICS_WEBSITE_ID`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_PLATFORM_RECORDS_TABLE`
- `SUPABASE_PLATFORM_DEMO_ENTITIES_TABLE`
- `NILE_DEMO_PASSWORD`
- `MOODLE_BASE_URL`
- `MOODLE_SERVICE`
- `MOODLE_TOKEN`
- `EMS_BASE_URL`
- `EMAIL_PROVIDER`
- `WHATSAPP_PROVIDER`
- `MEETING_PROVIDER`
- `PAYMENT_PROVIDER`

## Demo Users

The app uses safe local demo identities only:

- `student.demo@nilelearn.local`
- `teacher.demo@nilelearn.local`
- `registrar.demo@nilelearn.local`
- `hod.demo@nilelearn.local`
- `branch.demo@nilelearn.local`
- `admin.demo@nilelearn.local`

No real passwords, Moodle credentials, EMS credentials, API keys, or private data should be committed.

## Supabase

Supabase is wired as a first-class integration without changing the current demo auth/local store. Browser code reads only:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`, preferred
- `VITE_SUPABASE_ANON_KEY`, legacy fallback

Server-only admin access reads:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`, legacy fallback
- `SUPABASE_PLATFORM_RECORDS_TABLE`
- `SUPABASE_PLATFORM_DEMO_ENTITIES_TABLE`

Never put `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY` in any `VITE_` variable. The admin integration page can run a browser-safe Supabase REST check when `VITE_SUPABASE_URL` and a browser-safe key are configured.

Public and portal submissions write through `/api/platform/records`. The server attempts `SUPABASE_PLATFORM_RECORDS_TABLE` first with the server-only key, then falls back to `.local-data/platform-records.json` if the table or policy is not ready yet.

Apply `supabase/migrations/20260626185139_platform_demo_seed_tables.sql` before remote demo seeding. It creates:

- `platform_records` for server-side public and portal submissions.
- `platform_demo_entities` for a durable JSONB copy of the full demo state from `client/src/lib/domain/seed.ts`.

Seed Supabase Auth users and demo database rows with:

```bash
npm run seed:supabase
```

The seeder creates or updates the six demo Auth users with role claims in `app_metadata`, verifies password sign-in for each role, and upserts the full seed into the server-only demo tables. The default demo password is `demo1234`; override it with `NILE_DEMO_PASSWORD` in `.env.local`.

## Route Groups

Public pages:

- `/`
- `/courses`
- `/courses/:slug`
- `/book-free-trial`
- `/book-placement-test`
- `/faq`
- `/contact`
- `/about`
- `/privacy`
- `/terms`

Auth pages:

- `/auth/login`
- `/auth/forgot-password`
- `/auth/reset-password`
- `/auth/select-role`
- `/auth/logout`

Role portals:

- `/app/student/dashboard`
- `/app/teacher/dashboard`
- `/app/registrar/dashboard`
- `/app/hod/dashboard`
- `/app/branch/dashboard`
- `/app/admin/dashboard`
- `/app/admin/platform-blueprint`

Each role sidebar links to its planned feature pages for courses, classes, assessments, attendance, scheduling, messages, reports, certificates, settings, and Quran-specific workflows where relevant.

## Architecture

- `client/src/lib/platformData.ts`: typed mock data, roles, permissions, dashboards, nav, page configs, and public course data.
- `client/src/lib/domain/types.ts`: platform domain models for identity, academic, learning, EMS, scheduling, assessment, finance, certificates, Quran, communication, integrations, and audit.
- `client/src/lib/domain/seed.ts`: safe local seed data for demo users, branches, departments, programs, courses, classes, leads, placements, enrollments, invoices, certificates, Quran progress, notifications, and audit logs.
- `client/src/lib/domain/store.ts`: localStorage-backed mock service layer. Public forms and portal forms write through this layer, so it can later be replaced by Supabase/Postgres/API calls.
- `client/src/lib/domain/modules.ts`: product module map covering public site, auth/RBAC, admissions/EMS, student learning, teaching, academic management, branch operations, assessment, attendance, scheduling, communication, certificates, finance, reports, Quran, integrations, and system admin.
- `client/src/lib/supabase/client.ts`: browser-safe Supabase REST adapter using only publishable/anon env keys.
- `server/supabase.ts`: server-only Supabase REST adapter for admin/service-key use.
- `client/src/lib/rbac.ts`: role and permission helpers.
- `client/src/lib/auth/session.ts`: demo session storage and role access checks for protected routes.
- `client/src/lib/i18n.ts`: English and Arabic labels plus RTL direction support.
- `client/src/components/platform/PlatformShell.tsx`: role-aware sidebar/header/search/notifications/language shell.
- `client/src/components/platform/ProtectedRoute.tsx`: route guard with clean sign-in/access-denied states.
- `client/src/components/platform/LegacyRouteRedirect.tsx`: redirects older prototype URLs into the maintained `/app/...` portals.
- `client/src/components/platform/FeaturePage.tsx`: reusable feature-page renderer for list, form, calendar, assessment, attendance, certificate, Quran, reports, messages, settings, profile, and support pages.
- `client/src/components/platform/WorkflowExperiences.tsx`: stateful local workflows for learning, assignments, quizzes, attendance, scheduling, certificates, Quran review, messages, payments, admissions, and reports.
- `client/src/pages/public/PublicSitePage.tsx`: public course catalog/detail and booking pages with zod validation.
- `client/src/pages/platform/PlatformBlueprintPage.tsx`: super-admin operating map for modules, entities, owners, integrations, seeded record counts, and remaining backend work.
- `client/src/lib/moodle/*`: safe mock Moodle client, types, and mappers.
- `docs/platform-frontend-roadmap.md`: frontend-only completion plan, including what is done, what remains without backend work, and what is blocked by real integrations.

## Local Workflow Behavior

- Selecting a demo role stores `nilelearn.activeRole` in localStorage.
- Protected `/app/...` routes check the active role before rendering.
- Public trial requests create `Lead` records in the local platform store.
- Public placement requests create `PlacementTestBooking` records.
- Portal create/edit forms validate with zod and add audit records.
- Student learning pages can complete lessons, update enrollment progress, submit assignments, and submit quiz attempts.
- Teacher/branch attendance pages save attendance records and mark class sessions as saved.
- Calendar/schedule pages create events and flag teacher, room, or class conflicts.
- Registrar admissions pages convert leads, record placement results, and create enrollment workflow entries.
- Payment pages record manual payments and update invoice status.
- Certificate pages approve and issue certificates, show printable local previews, verify certificate codes locally, and send student notifications.
- Quran pages update memorization/tajweed progress, tag tajweed issues, show a local waveform review shell, and review recitation submissions.
- Message pages create in-app messages, communication logs, and recipient notifications.
- Report pages chart live local metrics from the platform state, save local browser-session presets, preview rows, and export CSV files.
- Integration pages show provider readiness, required environment variables, Supabase browser checks, local check logs, and disabled sync actions while real sync jobs are not connected.
- Calendar pages support day/week/month views, event creation, local conflict previews, and disabled recurring-rule controls until a server scheduler is connected.
- Global search reads from the platform store across users, teachers, courses, lessons, classes, assignments, quizzes, leads, placements, events, invoices, and certificates.
- Notifications read/write local platform notification state.

## Moodle and EMS

The Moodle and EMS layer is intentionally in mock mode until server-side credentials are configured. `client/src/lib/moodle/client.ts` returns mock data and exposes these functions:

- `getMoodleCourses()`
- `getMoodleCourse(id)`
- `getMoodleUserCourses(userId)`
- `getMoodleGrades(userId)`
- `getMoodleAssignments(courseId)`

Connect real Moodle/EMS calls on the server side so `MOODLE_TOKEN` and external credentials are never bundled into the browser.
