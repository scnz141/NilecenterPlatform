# Nile Center Redesign Package Adoption Audit

Status: visual review complete; runtime adoption requires one bounded UI slice at a time.

Branch: `codex/ui-v2-redesign`

Source package: `Nile_Center_Complete_Redesign_Package`

## 1. Decision

The supplied package is a useful visual reference, but it is not a safe product
specification and must not replace the repository's route, role, workflow, or
data authorities.

Nile Learn should adopt the package's strongest layout ideas:

- clear page headers and compact action placement;
- disciplined filter rails and readable data tables;
- entity headers with concise facts and task-based tabs;
- focused review, calendar, messaging, form, and learning workspaces;
- calm warm surfaces, strong typography, and restrained role accents;
- visible loading, empty, error, disabled, success, and status states.

Nile Learn must not copy the package's invented routes, permissions, provider
states, uploads, operational claims, or combined workflows. Existing auth,
RBAC, data authority, audit behavior, route ownership, and accepted portal QA
remain unchanged in every UI slice.

## 2. Evidence Reviewed

The review covered every supplied artifact:

- 68 PNG mockups across all six Nile Learn roles;
- 67 mockups at 2560x1440 and one HOD messaging mockup at 1376x768;
- `README.md` and the duplicate complete visual package guide;
- `gap_analysis.json`;
- `page_by_page_redesign_map.csv`;
- the current route freeze, UI authority documents, shell, primitives,
  dashboards, styles, and current Super Admin dashboard at runtime;
- desktop and 390px Codex in-app Browser inspection of the committed branch.

### Supplied Image Inventory

| Role               | Count | Reviewed templates                                                                                                                                                                                                                                                                                               |
| ------------------ | ----: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Student            |    13 | assessment detail and review; assessment management; calendar and scheduling; create or edit form; directory and data grid; entity detail record; error and recovery; learning experience; messaging workspace; profile and settings; progress and outcomes; reports and analytics; requests, forms, and support |
| Teacher            |    12 | assessment detail and review; assessment management; calendar and scheduling; create or edit form; directory and data grid; entity detail record; learning experience; messaging workspace; profile and settings; progress and outcomes; reports and analytics; requests, forms, and support                     |
| Registrar          |     9 | calendar and scheduling; create or edit form; directory and data grid; entity detail record; messaging workspace; payments and finance; profile and settings; reports and analytics; requests, forms, and support                                                                                                |
| Head of Department |    12 | assessment detail and review; assessment management; calendar and scheduling; create or edit form; directory and data grid; guided creation wizard; learning experience; messaging workspace; profile and settings; progress and outcomes; reports and analytics; requests, forms, and support                   |
| Branch Admin       |    10 | calendar and scheduling; create or edit form; directory and data grid; entity detail record; messaging workspace; payments and finance; profile and settings; progress and outcomes; reports and analytics; requests, forms, and support                                                                         |
| Super Admin        |    12 | calendar and scheduling; create or edit form; directory and data grid; entity detail record; governance and system control; guided creation wizard; learning experience; messaging workspace; profile and settings; progress and outcomes; reports and analytics; requests, forms, and support                   |

## 3. Route And Authority Comparison

The package's own gap analysis reports 202 mapped routes, six covered routes,
and 196 missing routes. That count is not the current Nile Learn route
authority.

The protected repository inventory currently contains:

- 286 literal protected client route entries;
- 229 `/app` route patterns;
- additional generated request routes for each authorized role;
- separate route owners for Forms assignment, response, builder, publication,
  review, migration, and offline work.

Comparison of the package CSV against the protected route inventory found:

- 202 unique package route rows;
- 195 rows matching literal protected route patterns;
- six `/requests` rows matching the app's generated request route family;
- one package-only route: `/app/student/billing`;
- 65 real `/app` route patterns not represented by the package map.

The omitted patterns are concentrated in:

- Nile Forms management, builder, publication, assignment, response, review,
  migration, and offline routes;
- Moodle course detail projections;
- Super Admin user access, activity, assignment, and related-record views;
- HOD certificate and course detail routes;
- Branch schedule-session detail;
- Teacher grading, quiz review, and Quran review detail routes.

Therefore, `page_by_page_redesign_map.csv` can help group visual families, but
it cannot define the product route inventory or completion percentage.

## 4. Current Runtime Comparison

The current accepted shell already handles several package weaknesses better:

- global search is an icon-triggered utility instead of a dominant permanent
  field;
- navigation is grouped by workflow and advanced items are collapsible;
- the base system uses 8px operational radii instead of 16px card-heavy
  styling;
- primary actions use the canonical charcoal/foreground token;
- role colors orient the user without recoloring the whole product;
- dashboard values are derived from the scoped store instead of invented
  platform claims;
- the Super Admin dashboard has four metrics, one primary administration map,
  one attention panel, and one activity region;
- the 390px view has no horizontal overflow: document and body scroll width
  were 385px for a 385px content viewport.

The existing shell should be refined only when a concrete usability issue is
proven. It should not be replaced by the mockup shell.

## 5. Visual Pattern Decisions

### Adopt

| Pattern                  | Nile Learn use                                                                                      |
| ------------------------ | --------------------------------------------------------------------------------------------------- |
| Compact page header      | Short title, one sentence, visible scope, and one primary action when authorized.                   |
| Filter rail              | Search plus two to four meaningful filters immediately above a list or table.                       |
| Data table               | Stable columns, readable row height, clear statuses, compact actions, pagination, and export scope. |
| Entity context header    | Record identity, status, key facts, and task-based navigation before detail content.                |
| Review workspace         | Queue plus evidence plus decision controls when simultaneous comparison is essential.               |
| Structured form sections | Fields grouped by user intent with save state, validation, and a clear final action.                |
| Calendar with agenda     | Calendar and selected-day agenda for routes where both are part of the same scheduling job.         |
| Message workspace        | Thread list, active conversation, and optional participant context with responsive collapse.        |
| Learning workspace       | Primary player or lesson content with outline, progress, notes, and resources.                      |
| Report workspace         | Filters, one useful chart or table, explicit scope, and export action.                              |

### Adapt

| Package pattern                | Required adaptation                                                              |
| ------------------------------ | -------------------------------------------------------------------------------- |
| Role-colored primary buttons   | Use charcoal for the primary action and role color for orientation or state.     |
| Permanent wide sidebar         | Keep the current grouped, collapsible shell and mobile drawer behavior.          |
| Status chips on many labels    | Keep chips only for real workflow state, urgency, or scope.                      |
| Three-column layouts           | Use only for review or messaging tasks that require simultaneous comparison.     |
| 16px cards and nested panels   | Use 8px operational surfaces and remove containers that do not have a job.       |
| Desktop action rails           | Convert to a drawer, stacked section, or sticky bottom action on narrow screens. |
| Charts and score summaries     | Render only from real, scoped, explainable data with an empty state.             |
| Portraits and personal details | Use existing fake fixtures only; do not copy package people or PII.              |

### Reject

- a permanent oversized global search field on every route;
- decorative mosque footer blocks that consume navigation space;
- a free-position or generic workflow-canvas interpretation of Nile Forms;
- combining roles, permissions, dangerous controls, and audit history into one
  page;
- invented roles such as Campus Admin, Support Agent, or Auditor;
- student billing, interviews, offers, waitlists, payroll, leave, backups,
  feature flags, maintenance controls, and other unapproved routes;
- upload, download, or drawn-signature UI before approved storage exists;
- meeting, email, Google Forms, WhatsApp, payment-provider, or Moodle actions
  without their approved server adapters;
- `connected`, `synced`, `healthy`, uptime, storage, or delivery claims without
  current server evidence;
- arbitrary role-authorized toggles for self-registration, enrollment, audit
  retention, integrations, or provider behavior;
- fake production metrics, synthetic trends presented as current facts, and
  copied personal data.

## 6. Page-Family Implementation Guidance

| Family                        | Strong package idea                                    | Nile Learn boundary                                                                                    |
| ----------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| Dashboard                     | Clear priorities, compact metrics, visible next action | Keep three to four derived metrics, one work area, and at most one side panel.                         |
| Directory and data grid       | Filter rail, table rhythm, row actions                 | Preserve dedicated list routes, server scope, responsive priority rows, and real pagination behavior.  |
| Entity detail                 | Context header, facts, tabs, activity                  | Keep each detail route focused; never mix creation, permissions, and full audit into the same page.    |
| Create or edit form           | Intent-based sections and save status                  | Preserve validation and command ownership; no autosave claim unless implemented.                       |
| Guided creation wizard        | Visible progress and review step                       | Use only for multi-step creation already supported by the domain workflow.                             |
| Assessment management         | Status filters and grading progress                    | Keep teacher authoring, HOD governance, and student attempts on separate authorized routes.            |
| Assessment review             | Evidence and rubric side by side                       | Preserve immutable submission evidence, grading authority, and conflict handling.                      |
| Calendar and scheduling       | Calendar plus selected-day agenda                      | Keep branch, registrar, teacher, and learner scope distinct; no meeting-provider claims.               |
| Learning experience           | Strong player and lesson outline                       | Use Moodle projections and audited CRUD command authority; do not invent media or downloadable assets. |
| Messaging                     | Strong master-detail composition                       | Preserve participant authorization, mobile thread navigation, and message ownership.                   |
| Profile and settings          | Clear grouped preferences                              | Show only editable fields and real security capabilities. Do not claim 2FA without implementation.     |
| Progress and outcomes         | Clear progress summary                                 | Use scoped, explainable data; avoid synthetic recommendations and decorative analytics.                |
| Reports and analytics         | Filtered chart plus table                              | Preserve exact report scope and export behavior; charts need real source data and empty states.        |
| Payments and finance          | Readable totals and transaction rows                   | Keep current manual-recording boundary; do not imply payment collection.                               |
| Requests, forms, and support  | Queue, status, details, comments                       | Keep Requests, Forms, and Support as separate route jobs and typed workflows.                          |
| Governance and system control | Dense, legible administration table                    | Split users, roles, access rules, settings, activity, and health according to current route ownership. |
| Error and recovery            | Clear failure, saved-state explanation, retry          | Reuse for route-level and panel-level recovery without exposing technical internals.                   |

## 7. Role-Specific Findings

### Student

The learning, progress, assignment, calendar, support, and recovery references
are strong. Student pages should remain supportive and progress-centered. Do
not add billing, staff-style directories, unrestricted forms, file uploads, or
provider controls.

### Teacher

The class, assessment, grading, calendar, and message patterns suit repeated
teaching work. Do not add class-creation authority, general administration,
unapproved uploads, or new assessment engines.

### Registrar

The list, record, payment, schedule, and form patterns fit admissions and
enrollment operations. Do not add interviews, offers, waitlists, financial
holds, or document storage without the corresponding domain slice.

### Head Of Department

The review, curriculum, course, report, and assessment references are useful.
The supplied navigation is too broad and sometimes assigns Super Admin or
teacher work to HOD. Keep department and branch scope visible and fail closed.

### Branch Admin

The operations tables, schedules, payments, and branch reports are useful.
Do not add payroll, leave, substitutions, global student directories, or
cross-branch controls.

### Super Admin

The dense governance tables are visually strong, but the example combines too
many jobs and invents roles and dangerous toggles. Keep Users, Roles, Access
rules, Activity, Connections, Health, and Settings on their existing routes.

## 8. Responsive And Accessibility Contract

Every adopted family must be reviewed at 390, 768, 1024, 1440, 1920, 2560,
and 3840 pixels.

- No page may create document-level horizontal overflow.
- Sidebar navigation becomes the existing accessible drawer below its current
  breakpoint; it must not become a compressed unreadable rail.
- Filters wrap or move into a controlled filter drawer without hiding active
  state.
- Tables keep priority columns and transform secondary fields into labelled
  row details on mobile.
- Review and messaging workspaces show one primary pane at a time on mobile
  with an explicit back path.
- Form fields become one column; final actions remain visible without covering
  validation or content.
- Tabs may scroll horizontally inside their own control, never at page level.
- Arabic uses RTL layout and correct reading order; English and Turkish remain
  LTR.
- Keyboard focus, accessible names, touch targets, reduced motion, contrast,
  loading, empty, error, disabled, success, denied, and offline states remain
  part of acceptance.
- Font sizes do not scale directly with viewport width and labels must fit
  their controls at every supported locale.

The supplied package contains no actual mobile mockups. Its CSV mobile notes
are design intentions, not tested responsive evidence.

## 9. Recommended UI-Only Rollout

The current shell and Phase 12 route baseline stay protected. Each item below
requires a separate bounded prompt and must finish before the next begins.

1. **Admin directory reference:** `/app/admin/users` and its existing user
   detail route family. Adopt the package's filter rail, table rhythm, entity
   header, and responsive row transformation without changing user commands or
   access authority.
2. **Shared list and detail primitives:** extract only proven repetition from
   the accepted admin reference, then apply route by route to HOD, Registrar,
   and Branch directories.
3. **Assessment workspaces:** teacher management and grading first, then HOD
   review, then student response and review. Preserve each role's separate job.
4. **Scheduling family:** branch, registrar, teacher, HOD, and student routes
   using the existing event authority and no external meeting provider.
5. **Messaging family:** one responsive master-detail pattern shared across
   roles while preserving participant authorization.
6. **Forms family:** assigned, manage, builder, publish, assignment, review,
   migration, and offline routes remain distinct. The package contributes only
   visual structure, not workflow authority.
7. **Reports and progress:** introduce charts only where current scoped data
   supports the displayed question and an honest empty state.
8. **Final role QA:** all six roles, all supported locales, all required
   widths, and the unfiltered protected portal gate.

The shell is not the first rewrite target. Runtime inspection showed it is
already more compliant than the supplied shell. Shared shell changes should be
made only for a reproduced usability or accessibility defect.

## 10. Slice Acceptance

Every runtime UI slice must:

1. name the exact routes and route owners;
2. state the page job, authorized actions, scope, data source, and all relevant
   states before editing;
3. preserve route paths, server actions, persistence, auth, RBAC, audit,
   Moodle projection/CRUD boundaries, and Nile Forms authority;
4. use existing shell, primitives, tokens, icons, and layout classes before
   adding abstractions;
5. update focused tests only when structure or intentional behavior requires
   it;
6. pass `npm run check`, `npm test -- --run`, `npm run build`, the relevant
   focused portal workflow, and the unfiltered `scripts/verify.sh` gate;
7. pass Codex in-app Browser review at the required widths, including Arabic
   RTL and all states relevant to the route family;
8. record exact changed files, commands, screenshots, and remaining risks.

## 11. Branch Boundary

`codex/ui-v2-redesign` is UI-only.

Allowed changes:

- client-side presentation components and styles;
- accessibility and responsive behavior;
- UI copy that does not change product meaning;
- visual test selectors and focused UI tests when required;
- UI authority and adoption documentation.

Not allowed on this branch:

- database migrations or Supabase policy changes;
- server routes, commands, provider clients, or persistence changes;
- auth, session, permission, role, or scope changes;
- new product workflows or route families;
- production integrations, storage, payments, messaging delivery, or Moodle
  writes;
- fake connected, synced, healthy, delivered, or production-ready states.
