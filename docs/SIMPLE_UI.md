# Nile Learn Simple Management UI Guide

`docs/SIMPLE_UI.md` is the strict simplicity contract for Nile Learn internal UI. Read it before creating or editing any app shell, portal, dashboard, list, detail, form, settings, or report UI.

Nile Learn is a simple school management and learning platform. It must be easy for management, teachers, registrars, students, and branch staff to use without training.

The product should feel like:

- a simple school operating system;
- a modern student, teacher, and admin portal;
- a calm CRM-style workspace;
- a clear education platform.

The product must not feel like:

- a developer dashboard;
- a database admin panel;
- an ERP control room;
- an analytics wall;
- an AI-generated card wall;
- complex enterprise software.

## 1. Core Rule

One page = one main job.

Every page must answer in five seconds:

1. Where am I?
2. What is this page for?
3. What should I do next?

A page is not acceptable if a school manager needs more than five seconds to answer those three questions.

The page should also make clear:

- where the main work is;
- what can wait for another page.

If a non-technical school manager cannot understand the page in five seconds, simplify it before adding polish.

## 2. Strict Product Rules

- Do not show everything on one page.
- Do not mix list, detail, create form, audit log, permissions, and settings on the same screen.
- Do not use three-column control-center layouts unless the workflow truly needs it.
- Do not put create forms inside crowded side panels.
- Do not show audit logs on every page.
- Do not show technical or debug metrics on normal dashboards.
- Do not create huge card grids.
- Do not use more than four KPI cards on a dashboard.
- Do not make sidebar navigation too long.
- Do not use all-caps labels everywhere.
- Do not overload pages with badges.
- Do not make users learn the UI before doing their job.

## 3. Forbidden User-Facing Terms

Avoid technical words in normal school-facing UI:

| Technical term        | Use instead      |
| --------------------- | ---------------- |
| RBAC                  | Roles and access |
| Permission Matrix     | Access rules     |
| Audit Trail           | Activity         |
| Integration Readiness | Connections      |
| Moodle Source         | Moodle           |
| Platform State        | System data      |
| Mock Mode             | Test mode        |
| Server-only           | Protected        |
| Local Records         | Records          |
| System Health         | Health           |
| Governance View       | Admin view       |
| Branch Scope          | Branch access    |
| Permission Scope      | Access level     |
| Integrations          | Connections      |
| Permissions           | Access rules     |

Technical terms may appear only on advanced admin, activity, connection, or system-health pages where they are necessary for the job.

## 4. Preferred Page Types

Use explicit page types instead of one generic layout for everything.

### DashboardPage

Purpose: show today's important work for one role.

Required structure:

- clear page title;
- one short description;
- one clear primary action;
- three to four simple metrics when useful;
- one main work queue or work summary;
- one small side panel for upcoming items, needs attention, or messages.

Do not use dashboards for system dumps, debug metrics, or large analytics walls.

### ListPage

Purpose: find records and move into detail.

Required structure:

- title;
- short description;
- one primary create button;
- search;
- two to four filters maximum;
- clean table or list;
- row actions;
- empty state;
- row click or action navigates to a detail page.

Do not put create forms, detail editors, audit logs, or permission matrices inside list pages.

### DetailPage

Purpose: understand and manage one record.

Required structure:

- record header;
- status;
- important summary;
- tabs or sections for related information;
- one primary action;
- right-side action panel only if it helps the job.

Do not turn detail pages into card walls. Related information should be grouped by user task, not database model.

### CreateFlowPage

Purpose: create one record through a simple flow.

Required structure:

- simple step-by-step form;
- basic information;
- role, scope, assignment, or placement step when relevant;
- review step;
- final create action;
- clear success and error states.

Do not put create flows inside crowded side panels, list pages, or dashboard cards.

### SettingsPage

Purpose: manage configuration.

Required structure:

- grouped settings sections;
- clear save button;
- clear unsaved, saved, loading, and error states;
- no unrelated dashboards.

Settings pages should not contain normal operational work queues.

### ReportPage

Purpose: inspect data and export it.

Required structure:

- filters;
- chart or table;
- export action;
- empty, loading, and error states;
- no operational forms.

Reports should help users understand a school question, not expose internal system structure.

## 5. Navigation Rules

- Keep the sidebar simple.
- Use grouped sections.
- Do not show every possible route at the same level.
- Put advanced admin features under "Advanced" or "System".
- Keep student, teacher, registrar, HOD, branch admin, and super admin navigation role-specific.
- Prefer task names over system names.
- Hide rare or dangerous tasks behind clear secondary navigation.
- Avoid long nav groups that require training to understand.

Preferred navigation names:

- People
- Students
- Teachers
- Classes
- Courses
- Admissions
- Payments
- Reports
- Settings
- Advanced
- Activity log
- Connections
- Roles and access
- Access rules

## 6. Visual Rules

- Use a neutral white or gray background for work areas.
- Remove noisy grid backgrounds from internal work screens.
- Reduce beige and brown overuse.
- Use one primary brand color for main actions.
- Use role color only for subtle orientation and status.
- Use clear spacing before adding borders.
- Use fewer borders and fewer cards.
- Use larger whitespace around primary work.
- Use readable font sizes.
- Use clear table rows.
- Use simple forms with direct labels.
- Use calm status badges only when status matters.
- Avoid ornamental panels that do not help the user decide or act.

## 7. Dashboard Content Rules

Dashboards must be role-specific and task-focused.

Student dashboard should focus on:

- next class;
- continue learning;
- assignments due;
- progress;
- messages.

Teacher dashboard should focus on:

- today's classes;
- attendance pending;
- grading queue;
- students needing help;
- messages.

Registrar dashboard should focus on:

- new leads;
- placement tests;
- ready to enroll;
- payment follow-ups;
- recent student activity.

HOD dashboard should focus on:

- courses needing review;
- teacher performance;
- certificate approvals;
- assessment issues.

Branch admin dashboard should focus on:

- classes today;
- rooms;
- attendance exceptions;
- schedule issues.

Super admin dashboard should focus on:

- users needing action;
- health summary;
- recent activity;
- connections status.

Keep technical details hidden in advanced pages.

## 8. List, Detail, Create Separation

Users, students, teachers, courses, classes, payments, admissions, and reports should follow a clear split:

- List page: find records.
- Detail page: understand and manage one record.
- Create page: create one record.
- Activity page or tab: review history.
- Settings page: configure behavior.
- Access page: manage roles and access.

Do not combine these jobs because it creates the "everything everywhere" feeling.

## 9. Tables

- Tables must be readable before they are decorative.
- Put search and filters in a compact toolbar.
- Show only columns needed for the page job.
- Use row actions for common tasks.
- Use detail pages for deep information.
- Use empty states that explain the next action.
- Avoid dashboards that contain full management tables unless that table is the main job.

## 10. Forms

- Forms must be calm and easy to complete.
- Group fields by user intent.
- Use labels above fields.
- Use helper text only when needed.
- Keep validation near the field.
- Use one clear submit action.
- Put destructive actions away from primary actions.
- Avoid long technical labels.

## 11. Empty, Loading, And Error States

- Empty states should explain what is missing and what the user can do next.
- Loading states should preserve layout and avoid page jumps.
- Error states should say what failed and how to retry.
- Success states should confirm the completed school action.
- Do not use generic "no data" copy on user-facing pages.

## 12. Sidebar And Header

Sidebar:

- should be simple and grouped;
- should support clear expanded and collapsed states;
- should not show every route at once;
- should make the active page obvious without heavy styling;
- should move advanced admin items under advanced groups.

Top header:

- should be stable and uncluttered;
- should not make global search dominate every page;
- should keep language, notifications, and user menu compact;
- should show scope only when it helps the user work.

## 13. Acceptance Checklist

Before finishing any UI page, check:

- Does the page have one main job?
- Can a non-technical school manager understand it in five seconds?
- Is there one primary action?
- Are list, detail, create, audit, permissions, and settings separated?
- Are there four or fewer KPI cards?
- Are there fewer cards than the old version?
- Is the page free of debug/system terms?
- Is the sidebar simple for this role?
- Is the top header calm?
- Are empty, loading, and error states included where relevant?
- Does the page feel like a school management workspace, not a developer dashboard?
