# Nile Learn Full UI Test Matrix

Date: 2026-07-06

This matrix defines the full UI test surface for Nile Learn across Browser automation, Computer Use verification, and manual review. It is based on the current routes in `client/src/App.tsx` and the current browser QA runner in `scripts/qa-portals-cli.mjs`.

## Test Goals

- Verify every public, auth, and protected portal page renders without route errors.
- Verify each role can complete its main school-management workflows end to end.
- Verify each role is blocked from actions outside its scope.
- Verify desktop and mobile layouts do not overflow and remain usable.
- Verify every page answers the manager test in 5 seconds: where am I, what is this page for, what should I do next.
- Verify the UI stays simple: no generic card walls, no noisy admin overload, no hidden critical action.

## Global UI Checks For Every Page

Every page in this file must pass these checks:

| Area          | Required checks                                                                                                         |
| ------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Route         | Correct URL loads, no blank page, no not-found page unless expected, no error boundary.                                 |
| Auth          | Protected pages require login, correct role can enter, wrong role is denied or redirected.                              |
| Header        | Page title is visible, current role/account is clear, search/notifications/language/user controls do not crowd content. |
| Sidebar       | Active item is clear, navigation labels are human, collapse/expand works if supported, mobile menu works.               |
| Main job      | Page purpose is obvious within 5 seconds, one primary action is clear, no unrelated workflow clutter.                   |
| Content       | Primary data renders, empty/loading/error states exist where relevant, no debug/system data on normal pages.            |
| Forms         | Labels are clear, validation works, submit disabled/loading/success/error states are visible.                           |
| Tables/lists  | Search/filter works, rows are readable, row action is clear, empty state works.                                         |
| Responsive    | Test at desktop `1440x900`, tablet `768x1024`, and mobile `390x844`; no horizontal overflow.                            |
| Accessibility | Interactive controls have accessible names, focus moves logically, keyboard tab order works.                            |
| Console       | No browser console errors, no failed workflow API actions.                                                              |

## Browser And Computer Verification Modes

| Mode                 | What it proves                                                                                                               | Required use                                                                                                     |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Browser plugin       | Fast browser route/workflow verification with DOM assertions, screenshots, console capture, desktop/mobile resizing.         | Run for full automated route matrix and workflow suite.                                                          |
| Computer Use         | Real external browser/app-state sanity check, visual guard check, protected-route behavior outside the test browser session. | Run after Browser suite for at least auth guard, one logged-out protected route, and one visual page spot-check. |
| Manual visual review | Human judgment for design quality, density, hierarchy, language, and "5 second manager" rule.                                | Required after major UI changes and before calling UI V2 complete.                                               |

## Public Website Pages

These public routes are now included in `npm run qa:portals` for render, control labeling, meaningful interaction count, and horizontal overflow checks. Form submission depth is still tracked in the remaining gaps section.

| Page                     | Route                       | Required UI tests                                                                                              |
| ------------------------ | --------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Landing page             | `/`                         | Hero visible, first viewport brand signal, primary CTAs, course preview, responsive layout, no console errors. |
| Legacy login alias       | `/login`                    | Shows login experience or redirects consistently to auth route.                                                |
| Course catalog           | `/courses`                  | Catalog filters/cards render, course links work, mobile cards readable.                                        |
| Arabic catalog           | `/courses/arabic`           | Arabic course category renders relevant content and CTA.                                                       |
| Quran catalog            | `/courses/quran`            | Quran course category renders relevant content and CTA.                                                        |
| Islamic studies catalog  | `/courses/islamic-studies`  | Category page renders relevant content and CTA.                                                                |
| Turkish catalog          | `/courses/turkish`          | Category page renders relevant content and CTA.                                                                |
| English catalog          | `/courses/english`          | Category page renders relevant content and CTA.                                                                |
| Teacher training catalog | `/courses/teacher-training` | Category page renders relevant content and CTA.                                                                |
| Kids catalog             | `/courses/kids`             | Category page renders relevant content and CTA.                                                                |
| Enterprise catalog       | `/courses/enterprise`       | Category page renders relevant content and CTA.                                                                |
| Course detail            | `/courses/:slug`            | Detail hero, curriculum/level info, CTA, invalid slug state.                                                   |
| Book free trial          | `/book-free-trial`          | Form validation, successful local/demo submission, error state, mobile form layout.                            |
| Book placement test      | `/book-placement-test`      | Form validation, placement request success state, mobile form layout.                                          |
| Verify certificate       | `/verify-certificate`       | Valid/invalid certificate lookup states, empty state, no private data leakage.                                 |
| FAQ                      | `/faq`                      | Questions expand/collapse, readable mobile layout.                                                             |
| Contact                  | `/contact`                  | Contact form validation, success/error state, contact details.                                                 |
| About                    | `/about`                    | Content hierarchy, responsive sections.                                                                        |
| Privacy                  | `/privacy`                  | Legal text readable, no overflow.                                                                              |
| Terms                    | `/terms`                    | Legal text readable, no overflow.                                                                              |
| Not found                | `/404` and unknown route    | Clear not-found state, recovery links.                                                                         |

## Auth And Session Pages

| Page            | Route                          | Required UI tests                                                                        |
| --------------- | ------------------------------ | ---------------------------------------------------------------------------------------- |
| Portal chooser  | `/auth/login`                  | Student/admin entry points visible, language selector works, no crowded layout.          |
| Student sign in | `/auth/student-login`          | Demo login, password validation, forgot link, successful redirect to student dashboard.  |
| Staff sign in   | `/auth/administration-login`   | Role buttons switch email/role, successful login for teacher/registrar/HOD/branch/admin. |
| Admin alias     | `/auth/admin-login`            | Same behavior as staff sign in.                                                          |
| Forgot password | `/auth/forgot-password`        | Email validation, submitted state, return link.                                          |
| Reset password  | `/auth/reset-password`         | Password validation, confirmation behavior, success/error state.                         |
| Select role     | `/auth/select-role` and `/app` | Role selection or sign-in-required state works without broken session.                   |
| Logout          | `/auth/logout`                 | Clears session and redirects/lands on expected auth state.                               |
| Protected guard | Any `/app/*` without session   | Shows sign-in required and does not show protected sidebar/header content.               |

## Student Portal Pages

| Page              | Route                                            | Required UI tests                                                  |
| ----------------- | ------------------------------------------------ | ------------------------------------------------------------------ |
| Dashboard         | `/app/student/dashboard`                         | Next class, progress, assignments, messages; no staff actions.     |
| Course list       | `/app/student/courses`                           | Courses render, search/filter if present, open course detail.      |
| Course detail     | `/app/student/courses/:courseId`                 | Lessons/resources/progress render, continue learning action.       |
| Lesson player     | `/app/student/courses/:courseId/learn/:lessonId` | Mark complete, progress persists, next action clear.               |
| Live class        | `/app/student/courses/:courseId/live`            | Session info, join placeholder, schedule state.                    |
| Assignments list  | `/app/student/assignments`                       | Due items, status, open assignment.                                |
| Assignment detail | `/app/student/assignments/:assignmentId`         | Submit response, validation, success state.                        |
| Quizzes list      | `/app/student/quizzes`                           | Quiz list, status, open quiz.                                      |
| Quiz detail       | `/app/student/quizzes/:quizId`                   | Answer questions, submit attempt, pending/score state.             |
| Grades            | `/app/student/grades`                            | Returned feedback visible, no staff grading controls.              |
| Attendance        | `/app/student/attendance`                        | Student attendance read-only, request review action if available.  |
| Calendar          | `/app/student/calendar`                          | Events render, filters/mobile layout.                              |
| Messages          | `/app/student/messages`                          | Send message to allowed recipient, no self-recipient leakage.      |
| Certificates      | `/app/student/certificates`                      | Wallet/status, no approve/issue controls.                          |
| Reports           | `/app/student/reports`                           | Personal report rows only, no platform/global selector.            |
| Support           | `/app/student/support`                           | Support/contact action, form states.                               |
| Profile           | `/app/student/profile`                           | Profile data, edit/save if supported, password/session boundaries. |
| Quran progress    | `/app/student/quran-progress`                    | Submit recitation, progress records, no teacher review controls.   |
| Moodle            | `/app/student/moodle-source`                     | Scoped projection states; CRUD remains role- and activation-gated. |

## Teacher Portal Pages

| Page              | Route                                      | Required UI tests                                                   |
| ----------------- | ------------------------------------------ | ------------------------------------------------------------------- |
| Dashboard         | `/app/teacher/dashboard`                   | Today classes, attendance, grading, students needing attention.     |
| Classes           | `/app/teacher/classes`                     | Assigned classes only, open class detail.                           |
| Class detail      | `/app/teacher/classes/:classId`            | Roster summary, send reminder, scoped student message audit.        |
| Sessions          | `/app/teacher/classes/:classId/sessions`   | Create/view session, live class state.                              |
| Attendance        | `/app/teacher/classes/:classId/attendance` | Mark status, add note, save, audit/persistence.                     |
| Students          | `/app/teacher/classes/:classId/students`   | Assigned student roster only, no unrelated class access.            |
| Materials         | `/app/teacher/classes/:classId/materials`  | Publish resource, material appears, audit/persistence.              |
| Assignment detail | `/app/teacher/assignments/:assignmentId`   | Review assignment details and linked submissions.                   |
| Assignments       | `/app/teacher/assignments`                 | Assignment queue, filters, open detail.                             |
| Grading           | `/app/teacher/grading`                     | Grade assignment, review quiz attempt, feedback visible to student. |
| Quizzes           | `/app/teacher/quizzes`                     | Quiz queue/question links, no layout crowding.                      |
| Question bank     | `/app/teacher/question-bank`               | Questions render, create/edit if supported.                         |
| Calendar          | `/app/teacher/calendar`                    | Create assigned live class session, scope/audit.                    |
| Messages          | `/app/teacher/messages`                    | Send message, communication log created.                            |
| Reports           | `/app/teacher/reports`                     | Teacher-scoped rows only.                                           |
| Profile           | `/app/teacher/profile`                     | Account/teaching profile data.                                      |
| Quran review      | `/app/teacher/quran-review`                | Review recitation, update Quran progress, approve.                  |
| Moodle            | `/app/teacher/moodle-source`               | Scoped projection plus approved command/launch states.              |

## Registrar Portal Pages

| Page               | Route                                        | Required UI tests                                         |
| ------------------ | -------------------------------------------- | --------------------------------------------------------- |
| Dashboard          | `/app/registrar/dashboard`                   | Leads, placement, ready-to-enroll, payments.              |
| Leads              | `/app/registrar/leads`                       | Create lead, convert lead, search/filter, empty state.    |
| Lead detail        | `/app/registrar/leads/:leadId`               | Lead summary, lifecycle action, activity state.           |
| Applications       | `/app/registrar/applications`                | Create application file, branch scope, open detail.       |
| Application detail | `/app/registrar/applications/:applicationId` | Application status and linked lead/student data.          |
| Students           | `/app/registrar/students`                    | Direct student creation, enrollment/invoice side effects. |
| Student detail     | `/app/registrar/students/:studentId`         | Student lifecycle, course/class/payment summary.          |
| Placement tests    | `/app/registrar/placement-tests`             | Book placement, scope, result state.                      |
| Placement detail   | `/app/registrar/placement-tests/:bookingId`  | Record result, ready-to-enroll workflow state.            |
| Enrollments        | `/app/registrar/enrollments`                 | Activate enrollment, assign class, invoice created.       |
| Classes            | `/app/registrar/classes`                     | Class list, capacity/schedule data.                       |
| Schedule           | `/app/registrar/schedule`                    | Create placement calendar event.                          |
| Payments           | `/app/registrar/payments`                    | Settle invoice, record partial payment, balance math.     |
| Messages           | `/app/registrar/messages`                    | Send/log internal message.                                |
| Reports            | `/app/registrar/reports`                     | Registrar-scoped reports and export if supported.         |
| Settings           | `/app/registrar/settings`                    | Registrar settings only, no unrelated admin controls.     |

## HOD Portal Pages

| Page         | Route                    | Required UI tests                                                       |
| ------------ | ------------------------ | ----------------------------------------------------------------------- |
| Dashboard    | `/app/hod/dashboard`     | Academic health, curriculum, teachers, certificate approvals.           |
| Departments  | `/app/hod/departments`   | Department data and scope.                                              |
| Programs     | `/app/hod/programs`      | Program list/status.                                                    |
| Courses      | `/app/hod/courses`       | Update scoped course status.                                            |
| Moodle       | `/app/hod/moodle-source` | Template mappings, projection, CRUD command, and reconciliation states. |
| Levels       | `/app/hod/levels`        | Level data and curriculum relation.                                     |
| Curriculum   | `/app/hod/curriculum`    | Create module, persist/audit.                                           |
| Teachers     | `/app/hod/teachers`      | Teacher performance/scope.                                              |
| Classes      | `/app/hod/classes`       | Department classes only.                                                |
| Schedule     | `/app/hod/schedule`      | Academic schedule state.                                                |
| Assessments  | `/app/hod/assessments`   | Create assessment, grade department submission.                         |
| Certificates | `/app/hod/certificates`  | Block issue before approval, approve/issue, reject with reason.         |
| Reports      | `/app/hod/reports`       | Academic reports only, finance excluded, save preset.                   |
| Messages     | `/app/hod/messages`      | Department-scoped message and audit.                                    |

## Branch Admin Portal Pages

| Page       | Route                    | Required UI tests                                                |
| ---------- | ------------------------ | ---------------------------------------------------------------- |
| Dashboard  | `/app/branch/dashboard`  | Branch operations, rooms, attendance, payments, needs attention. |
| Students   | `/app/branch/students`   | Branch students only, no cross-branch data.                      |
| Teachers   | `/app/branch/teachers`   | Branch teachers only.                                            |
| Classes    | `/app/branch/classes`    | Branch classes and capacity.                                     |
| Rooms      | `/app/branch/rooms`      | Update room status, create branch-scoped room.                   |
| Schedule   | `/app/branch/schedule`   | Create calendar event, room/class conflict state.                |
| Attendance | `/app/branch/attendance` | Save branch-scoped attendance status.                            |
| Payments   | `/app/branch/payments`   | Record branch invoice payment and audit.                         |
| Reports    | `/app/branch/reports`    | Scoped report workspace, no audit/global leakage.                |
| Messages   | `/app/branch/messages`   | Branch-scoped message and audit.                                 |
| Settings   | `/app/branch/settings`   | Branch settings only.                                            |

## Super Admin Portal Pages

| Page               | Route                           | Required UI tests                                                            |
| ------------------ | ------------------------------- | ---------------------------------------------------------------------------- |
| Dashboard          | `/app/admin/dashboard`          | Command center, max 4 KPIs, admin work map, needs attention.                 |
| Platform blueprint | `/app/admin/platform-blueprint` | Blueprint content, no broken links, responsive layout.                       |
| Users              | `/app/admin/users`              | Search/filter, open user detail, no create form always visible.              |
| Create user        | `/app/admin/users/new`          | Step role, basic info, scope/profile, review/create, success redirect.       |
| User detail        | `/app/admin/users/:userId`      | Overview, Access, Activity, Related records tabs, advanced access collapsed. |
| Roles & access     | `/app/admin/roles`              | Human labels, permission update, audit, no overwhelming matrix above fold.   |
| Access rules       | `/app/admin/permissions`        | Advanced access rules only, clear language.                                  |
| Branches           | `/app/admin/branches`           | Branch status update and audit.                                              |
| Departments        | `/app/admin/departments`        | Department list/status.                                                      |
| Programs           | `/app/admin/programs`           | Program list/status.                                                         |
| Courses            | `/app/admin/courses`            | Admin course status governance.                                              |
| Certificates       | `/app/admin/certificates`       | Certificate governance view, no HOD-only confusion.                          |
| Schedule           | `/app/admin/schedule`           | Platform schedule view.                                                      |
| Moodle             | `/app/admin/moodle-source`      | Capability, mapping, command, failure, and reconciliation states.            |
| Settings           | `/app/admin/settings`           | Save platform configuration audit.                                           |
| Connections        | `/app/admin/integrations`       | Check placeholder provider, logs result, no real external calls.             |
| Activity log       | `/app/admin/audit-logs`         | Activity rows, filters, no private secret leakage.                           |
| Reports            | `/app/admin/reports`            | Change report type, save preset.                                             |
| Health             | `/app/admin/system-health`      | Record health audit, technical data kept secondary.                          |

## Deep Workflow Suite Required

The full suite must include these end-to-end workflows:

| Role         | Workflow                                                                                                                                                                                                                                  |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Student      | Shell search, branch selector, notifications, lesson completion, assignment submission, quiz attempt, assignment detail submission, quiz detail submission, attendance/certificate read-only access, Quran recitation, messages, reports. |
| Teacher      | Attendance save, material publishing, class reminder message, assignment grading, quiz review, calendar session creation, Quran review, messaging.                                                                                        |
| Registrar    | Lead intake, application creation, invoice settlement, partial payment, lead conversion, placement result, placement booking, direct student creation, enrollment activation.                                                             |
| HOD          | Curriculum module creation, course status update, assessment creation, assignment grading, certificate issue guard, certificate approval/issue, certificate rejection, messaging, reports.                                                |
| Branch admin | Dashboard scope, attendance save, schedule event creation, room status update, room creation, payment recording, messaging, reports.                                                                                                      |
| Super admin  | Staff account creation, teacher assignment, roles/access governance, branch status update, report preset, integrations placeholder check, health audit, settings audit, academic governance.                                              |

## Current Automated Coverage

Current command:

```bash
QA_BASE_URL=http://127.0.0.1:3001 QA_SUITE_TIMEOUT_MS=2700000 QA_COMMAND_TIMEOUT_MS=90000 QA_ROUTE_MATRIX_ROUTE_TIMEOUT_MS=7000 QA_WORKFLOW_READY_TIMEOUT_MS=8000 QA_WORKFLOW_ACTION_TIMEOUT_MS=12000 QA_LOGIN_TIMEOUT_MS=30000 npm run qa:portals
```

Current known passing artifact:

- `output/playwright/portal-qa-summary.json`
- `1085` checks
- `0` failures
- `54` deep workflows

This passing run covers:

- public route matrix
- auth route matrix, including `/login` and `/auth/admin-login`
- desktop portal route matrix for student, teacher, registrar, HOD, branch admin, and super admin
- mobile portal route matrix for student, teacher, registrar, HOD, branch admin, and super admin
- Super Admin route additions: `/app/admin/certificates`, `/app/admin/schedule`, and `/app/admin/users/new`
- deep role workflows for student, teacher, registrar, HOD, branch admin, and super admin

Clean standalone QA should reset local state before the run:

```bash
rm -f .local-data/platform-state.json
```

`scripts/verify.sh` already performs this reset when portal QA is run through the verification script with `QA_RESET_LOCAL_STATE=1`.

The deep workflow runner also uses a QA-only server reset endpoint before each workflow. The endpoint is available only when the server runs with `NILE_PLATFORM_STATE_LOCAL_ONLY=1` or `QA_PLATFORM_STATE_LOCAL_ONLY=1` and the request includes the QA reset header.

## Current Direct Browser And Computer Evidence

Fresh Browser verification on 2026-07-06 against `http://127.0.0.1:3001`:

- `/courses` rendered the public course catalog with heading `Find the right Nile Center pathway.`, 30 visible controls, no horizontal overflow, and no error boundary.
- `/app/admin/users` without a session rendered `Sign in required`, showed sign-in actions, did not expose the protected app shell, had no horizontal overflow, and had no error boundary.
- `/auth/administration-login` was used to sign in as the local demo Super Admin through the visible login UI.
- `/app/admin/dashboard` rendered `Platform Command Center` with app shell, sidebar, header/user context, primary content, no horizontal overflow, and no console errors.

Current Computer Use status on 2026-07-06:

- Attempted to attach Computer Use to Google Chrome, Comet, and Safari after opening the local protected route.
- Computer Use returned `timeoutReached`, `cgWindowNotFound`, or `remoteConnection`, so the direct Computer Use visual confirmation is blocked by local app attachment rather than by the Nile Learn UI.
- Retried with a separate isolated Chrome profile opened directly to `http://127.0.0.1:3001/app/admin/users`; macOS/Chrome reported the active tab URL correctly, but Computer Use still returned `timeoutReached`.
- Retried baseline attachment against Finder and Safari; Computer Use returned `cgWindowNotFound`, confirming the current blocker is app-window attachment, not a Nile Learn route failure.
- Retried a third pass by opening TextEdit and Calculator as simple baseline apps; Computer Use returned `cgWindowNotFound` for both. A final isolated Chrome window again loaded `http://127.0.0.1:3001/app/admin/users`, confirmed by macOS/Chrome, but Computer Use still returned `timeoutReached`.
- Keep this as an open verification item until Computer Use can read one external-browser window and confirm protected-route guard plus one public visual page.

## Current Automation Gaps To Close

| Gap                                                                 | Needed test                                                                                                                                    |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Public forms need stronger submit assertions.                       | Add trial, placement, contact, certificate verify success/error UI tests.                                                                      |
| Computer Use is currently a sanity layer, not the full route suite. | Keep using it for external-browser guard and visual checks; add authenticated visual pass after Browser login if session sharing is available. |
| Visual quality is only partially automated.                         | Add screenshot review checklist for density, hierarchy, sidebar/header, responsive text fit, and Simple UI compliance.                         |
| Full QA depends on a clean local state snapshot.                    | Reset `.local-data/platform-state.json` before standalone QA and keep the QA-only workflow reset endpoint enabled through local-only mode.     |

## Required Full Test Command Set

Run these before claiming "full UI tested":

```bash
npm run build
rm -f .local-data/platform-state.json
PORT=3001 NODE_ENV=production NILE_PLATFORM_STATE_LOCAL_ONLY=1 node dist-server/index.js
QA_BASE_URL=http://127.0.0.1:3001 QA_SUITE_TIMEOUT_MS=2700000 QA_COMMAND_TIMEOUT_MS=90000 QA_ROUTE_MATRIX_ROUTE_TIMEOUT_MS=7000 QA_WORKFLOW_READY_TIMEOUT_MS=8000 QA_WORKFLOW_ACTION_TIMEOUT_MS=12000 QA_LOGIN_TIMEOUT_MS=30000 npm run qa:portals
npm run check
```

Then verify with Browser and Computer:

```text
Browser:
- Open /auth/login.
- Verify auth chooser visually.
- Run at least one visible login for student and one staff role.
- Open one route per role from the route matrix.
- Capture console errors and screenshots for any suspected layout issue.

Computer:
- Open a separate external browser tab.
- Navigate to a protected /app route without session and confirm Sign in required.
- Navigate to public landing page and confirm visible layout/brand.
- If authenticated state is available in that browser, verify one dashboard and sidebar/header visually.
```

## Completion Rule

Full UI testing is complete only when:

- All route matrix checks pass on desktop and mobile.
- All deep workflow checks pass.
- Public website matrix passes.
- Auth aliases and protected guards pass.
- Browser console errors are zero.
- Computer Use confirms protected-route guard and at least one external-browser visual page.
- Remaining gaps are either fixed or explicitly documented with owner and next command.
