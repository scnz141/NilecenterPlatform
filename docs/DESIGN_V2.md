# Nile Learn UI V2 Design System

`docs/DESIGN_V2.md` is the strict internal portal design contract for Nile Learn UI V2. Read it after `DESIGN.md` and before creating or editing any internal portal UI.

The landing page at <https://nile-center-platform.vercel.app/> remains the visual source of truth. Do not redesign the landing page unless the task explicitly requires it. UI V2 extracts that premium Nile Learn language and applies it to the app shell, dashboards, lists, forms, and role workspaces.

## 1. Scope And Precedence

UI V2 applies to:

- internal portal shell, sidebar, top header, role switcher, and navigation;
- student, teacher, registrar, HOD, branch admin, and super admin dashboards;
- internal lists, tables, forms, queues, cards, detail pages, and workflow pages;
- empty, loading, error, success, and responsive states.

UI V2 does not mean:

- redesigning the public landing page;
- rebuilding all portal pages in one pass;
- changing auth, RBAC, backend behavior, data models, or route permissions for visual polish;
- adding external integrations that are intentionally out of scope.

Rule hierarchy:

1. `AGENTS.md`, `CLAUDE.md`, RBAC, security, and backend correctness always win.
2. `DESIGN.md` defines the Nile Learn brand language, tokens, and landing-page visual foundation.
3. `docs/DESIGN_V2.md` defines the stricter internal portal reset: shell, hierarchy, density, dashboard limits, copy limits, and rollout order.
4. Existing app behavior should be preserved unless the task explicitly changes behavior.

## 2. UI V2 Goal

Replace the current generic AI-generated admin look with a simple, clean, premium educational SaaS interface.

The internal app should feel:

- calm;
- premium;
- trustworthy;
- human;
- easy to scan;
- operationally useful;
- educational rather than corporate-generic;
- polished without being overdecorated.

The UI must not feel like:

- a default shadcn dashboard;
- a beige admin template;
- a wall of similar cards;
- a system dump;
- a debug console;
- an AI-generated mockup with too many labels and weak hierarchy.

Approved UI V2 page pattern:

1. Clear page title.
2. One short subtitle.
3. One primary action.
4. Three to four useful metrics only when they support the page job.
5. One primary work area.
6. One secondary side panel when useful.
7. Calm spacing and clear hierarchy.

This pattern is mandatory for dashboards and should guide lists, workspaces, forms, reports, and settings pages. Do not return to the old pattern of a header, five stat cards, a huge card grid, long text, a side panel, and badges everywhere.

## 3. Core Product Principles

1. Less text.
2. Fewer cards.
3. Stronger hierarchy.
4. Cleaner sidebar.
5. Cleaner top header.
6. More whitespace.
7. Better grouping.
8. One clear primary action per page.
9. Dashboards show work that matters, not debug data.
10. Internal pages should feel like a premium learning platform, not a system dump.

Every screen should answer:

- What role am I in?
- What needs attention now?
- What is the main action?
- What is the current scope: student, class, course, branch, program, or system?
- What can wait for a detail page?

## 4. Problems UI V2 Must Remove

Remove these patterns instead of polishing around them:

- noisy visible grid backgrounds behind dense operational screens;
- too many beige or white cards with the same weight;
- repeated generic metric cards that do not lead to a workflow;
- dashboards overloaded with technical text, debug values, or internal object names;
- weak page headers with no clear action or page purpose;
- top headers where search dominates pages that do not need global search;
- sidebars that are half-expanded, awkwardly collapsed, or visually unfinished;
- many badges used as decoration rather than real status;
- long descriptions on dashboard cards;
- generic feature pages that generate the same layout for unrelated workflows.

Current architecture causing the old look:

- `PlatformShell` and its CSS previously allowed a mixed collapsed/expanded sidebar behavior and a visually busy top bar.
- Global search was visually centered on every portal page, even when page-level work mattered more.
- Broad background gradients, decorative grid textures, and repeated card shadows competed with dense operational content.
- The historical `FeaturePage` fallback created the same header, metric grid, generic action buttons, and generated work areas for many unrelated routes. Current route work should continue using dedicated page owners instead.
- `StatCard`, generic metric grids, and repeated panel classes make dashboards feel like interchangeable card walls.
- Role dashboards and legacy generated pages showed too many same-weight sections above the fold.

These are architectural issues. UI V2 must replace the layout pattern before polishing colors, shadows, or icon choices.

UI V2 should replace architecture that creates these outcomes. Do not only change colors, borders, or shadows if the underlying layout still produces card walls and text noise.

## 5. Visual Language

Use the Nile Learn language from `DESIGN.md`:

- warm off-white canvas;
- charcoal type;
- taupe and sand dividers;
- restrained amber and deep role accents;
- soft surfaces;
- refined spacing;
- premium educational calm.

V2 refinements:

- Use fewer visual containers.
- Give primary work areas more visual weight than secondary panels.
- Reserve dark or high-contrast panels for command summaries, media/player states, or admin health views.
- Use role color as an accent, not a full-page theme.
- Avoid one-note beige layouts. Warmth should come from subtle canvas and human spacing, not from making every component tan.
- Keep decoration quiet. Content and workflow hierarchy should carry the interface.

## 6. Color And Token Rules

Use existing tokens from `DESIGN.md` and `client/src/index.css` before adding any new token.

Primary color rules:

- Primary action: charcoal or the established Nile foreground token.
- Secondary action: card/surface with a subtle border.
- Accent: amber or role color, used sparingly.
- Destructive: semantic red only for destructive or error states.
- Success: semantic green only for success/completed states.
- Information: blue only when it means information, not as the default CTA.

Surface rules:

- App canvas uses the warm neutral background.
- Main panels use the card/surface token.
- Inset controls use muted/sand surfaces.
- Borders should be subtle and consistent.
- Shadows should be rare and soft.

Do not:

- introduce random hex colors;
- create new pastel variants for one page;
- make every role page a different color system;
- use gradients, blobs, or decorative color fields that are not part of the Nile Learn language;
- rely on color alone for status.

## 7. Background Rules

The background must support work, not compete with it.

Rules:

- Remove or greatly reduce the visible grid background on internal pages.
- Use a soft neutral canvas as the default portal background.
- If a grid texture remains, it must be extremely subtle and never visible inside dense table/form work areas.
- Cards and panels should sit on a calm surface with clear but light separation.
- Do not put noisy textures behind tables, forms, attendance rosters, grading queues, or admissions pipelines.

Acceptable background hierarchy:

1. Warm app canvas.
2. Slightly raised main panel.
3. Muted inset controls.
4. Focused accent only where a workflow needs emphasis.

## 8. Typography And Copy Rules

Typography must make the page faster to understand.

Page title:

- 2 to 6 words.
- Strong and clear.
- Usually 24 to 32px on internal pages.
- Never hero-sized on dense portal screens.

Page subtitle:

- One short sentence only.
- No marketing paragraphs.
- No explaining the whole feature.
- Prefer current scope and purpose.

Card titles:

- Short and specific.
- Prefer user-facing workflow terms over technical model names.
- Avoid all caps except small eyebrow labels.

Card descriptions:

- Maximum 1 to 2 short lines.
- No long paragraphs on dashboards.
- No implementation/debug details unless the page is specifically system health, audit, or integration configuration.

Badges:

- Use badges for status, role, scope, or priority only.
- Do not use badges as decoration.
- Do not stack many badges in every card.

Tone:

- Calm and operational.
- Human but not chatty.
- Direct about next actions.
- Avoid generic filler such as "manage all your data in one place."

## 9. Spacing And Density Rules

Use whitespace to create hierarchy, not emptiness.

Rules:

- Desktop page padding: usually 24 to 32px.
- Mobile page padding: usually 16px.
- Use the existing 8px rhythm: 8, 12, 16, 20, 24, 32, 40, 56.
- Dense tables and rosters may use tighter 8 to 12px internal rhythm.
- Dashboard sections need clear separation, but avoid huge blank spaces above real work.
- Keep toolbars, filters, table headers, and actions visually grouped.

Do not:

- crowd headings, metrics, filters, and tables into one visual block;
- make all cards the same padding and importance;
- use oversized portal hero spacing that hides the work below;
- create long scrolling card grids when a table, queue, or split workspace would be clearer.

## 10. App Shell Rules

The shell must feel stable, premium, and easy to navigate.

### Sidebar

The sidebar must be either fully expanded or fully collapsed. Do not use an awkward mixed state.

Expanded sidebar:

- Target width around 260px.
- Show section labels, item labels, and concise status where useful.
- Group nav items by role workflow.
- Keep primary items visible and secondary items grouped.

Collapsed sidebar:

- Target width around 72px.
- Show clear icons with tooltips.
- Keep active state visible.
- Do not show truncated labels.
- Use an explicit toggle for expand/collapse. The state may persist, but it must never depend on hover-only expansion.

Navigation grouping:

- Group by work, not database modules.
- Student: learn, assignments, progress, messages, account.
- Teacher: today, classes, attendance, grading, content, communication.
- Registrar: admissions, placement, enrollment, schedule, payments, communication.
- HOD: academic health, curriculum, teachers, assessments, certificates, reports.
- Branch admin: today, schedule, rooms, attendance, payments, branch operations.
- Super admin: platform, users, access, integrations, audit, reports.

Visibility:

- Do not show too many nav items at once.
- Put secondary/admin items under grouped sections or "More".
- Avoid long nav labels.
- Use badges only for true counts or urgent states.

Active item:

- Clear but subtle.
- Use role accent, foreground contrast, or a small marker.
- Do not use loud full-width color blocks for every selected state.

### Top Header

The top header should be stable, balanced, and simple.

Rules:

- Search should not dominate every page unless the page genuinely benefits from global search.
- Page-level actions belong near the page header, not scattered across the top bar.
- User menu should be clean and predictable.
- Notification and language controls should be compact.
- The header should show scope only when useful: role, branch, class, course, or selected workspace.
- Avoid duplicate title information between the top header and page header.

Preferred top-header contents:

- compact role/scope indicator;
- optional search, only where useful;
- compact notification control;
- language switcher;
- user menu.

## 11. Page Layout System

Every internal page should be composed from predictable layout parts.

Required page structure:

1. `PageFrame`: consistent page width, padding, and responsive behavior.
2. `PageHeader` or `PageHero`: title, one short subtitle, scope, and one primary action when applicable.
3. `WorkSummary`: optional primary summary or current work state.
4. `MetricStrip`: optional, maximum 4 KPI cards.
5. `PrimaryWorkspace`: the main table, queue, form, calendar, lesson, roster, or approval flow.
6. `SecondaryPanel`: optional side context, reminders, filters, or next steps.
7. State regions: loading, empty, error, disabled, and success states where relevant.

Common page shapes:

- Dashboard: page header, compact metrics, one work summary, one primary task panel, one secondary side panel.
- List/table page: page header, compact toolbar, `DataTableCard`, pagination or short summary, empty/error states.
- Form page: page header, `FormSection` groups, sticky or final action row, success/error state.
- Detail page: identity header, main details, related activity, right-side context or actions.
- Workflow page: current item, step/status, primary controls, supporting queue or history.

Do not create a new one-off page layout unless the workflow clearly requires it.

## 12. Dashboard Rules

Dashboards are command centers, not generic KPI grids.

Required dashboard composition:

- Maximum 4 main KPI cards at the top.
- One strong hero or work summary card.
- One primary task panel.
- One secondary side panel.
- No more than 3 main content sections above the fold.
- One clear primary action.
- Role-specific personality and priorities.

Dashboard content must focus on:

- what is due now;
- what needs review;
- what is blocked;
- what has changed;
- what the user should do next.

Dashboards must not focus on:

- raw debug data;
- object counts with no action;
- repeated cards that all look the same;
- long feature explanations;
- every possible module at once;
- system metrics outside admin/system-health pages.

Use progressive disclosure:

- Show summaries on dashboards.
- Put details in detail pages, lists, drawers, or drill-down views.
- Let dashboard actions open the relevant workflow.

## 13. Role Dashboard Rules

### Student

Prioritize:

- next lesson or live class;
- continue learning;
- course progress;
- assignments due;
- teacher feedback;
- attendance status;
- Quran progress when relevant.

Avoid:

- system metrics;
- admin-style status grids;
- long text explaining every course feature.

### Teacher

Prioritize:

- today's classes;
- attendance to mark;
- grading queue;
- students needing attention;
- materials to publish;
- Quran review queue when relevant.

Avoid:

- decorative class cards with no action;
- burying attendance and grading below generic analytics.

### Registrar

Prioritize:

- admissions pipeline;
- placement queue;
- ready-to-enroll students;
- payments pending;
- schedule or class assignment blockers;
- messages requiring follow-up.

Avoid:

- debug enrollment state;
- long CRM-style explanations;
- showing every possible EMS object on the dashboard.

### HOD

Prioritize:

- academic health;
- teacher performance;
- curriculum coverage;
- assessment quality;
- certificate approvals;
- course/source mapping exceptions.

Avoid:

- generic admin cards;
- hiding approval evidence behind summary metrics.

### Branch Admin

Prioritize:

- classes today;
- room or schedule conflicts;
- attendance exceptions;
- payment exceptions;
- local staff/student operations;
- branch messages.

Avoid:

- global platform data unless scope is clear;
- decorative cards instead of schedule/operations views.

### Super Admin

Prioritize:

- platform health;
- users and roles;
- audit highlights;
- integration status;
- branch or permission risks;
- system exceptions.

Rules:

- Keep technical data secondary.
- Use system-health detail pages for deep metrics.
- Do not make the main dashboard a log viewer.

## 14. Card Rules

Cards must have a clear job.

Allowed card purposes:

- summarize;
- select;
- compare;
- approve;
- inspect;
- act;
- show a short queue item;
- show a compact metric tied to a workflow.

V2 card hierarchy:

- Primary work summary card: strongest card on the page.
- KPI card: compact, limited to a metric, label, and short context.
- Task card: shows one actionable item or queue item.
- Side card: secondary context, reminders, or status.
- Empty/error card: clear state and next action.

Rules:

- Fewer card styles.
- Fewer total cards.
- Avoid card walls.
- Use soft radius and subtle border.
- Important cards should be visually different from secondary cards.
- Do not put cards inside cards.
- Do not repeat decorative corner curves on every card if it adds noise.
- Do not make every card include an icon, badge, title, paragraph, metric, and button.
- No dashboard card should contain more than 2 short text lines unless it is a content list.

## 15. Table Rules

Tables must be calm, readable, and scoped.

Rules:

- Every table must be inside a `DataTableCard`.
- Put filters in a compact toolbar.
- Show row count or scope where useful.
- Do not show too many columns.
- Use priority columns on mobile.
- Keep row actions compact.
- Use chips for critical status, but do not badge every value.
- On dashboard pages, prefer short lists over full tables.
- Put full tables on list/workflow pages.

Dashboard lists:

- 3 to 6 rows by default.
- Clear empty state.
- Link to the full list.
- Show the next action for each row where useful.

## 16. Form Rules

Forms must feel calm, trustworthy, and easy to finish.

Rules:

- Every form must use `FormSection` or an equivalent section/card layout.
- Group fields by intent, not database order.
- Use labels above fields.
- Use helper text only where necessary.
- Keep one clear primary submit action.
- Put destructive actions away from primary save actions.
- Use validation near the field.
- Use success state after save.
- Use loading and disabled states during submit.
- Do not overload forms with repeated labels, explanatory paragraphs, or debug metadata.

Preferred form grouping:

- identity;
- contact;
- academic scope;
- schedule;
- payment;
- permissions;
- notes or audit context.

## 17. Empty, Loading, Error, And Success States

Every data region needs an appropriate state when relevant.

Loading:

- Use skeletons for cards, tables, rosters, and panels.
- Use compact spinners only for buttons or small inline actions.

Empty:

- Say what is missing.
- Say what the user can do next.
- Keep copy short.
- Offer one relevant action where possible.

Error:

- Say what failed.
- Preserve the user's context.
- Offer retry or recovery.
- Do not show raw stack traces in UI.

Success:

- Confirm the saved state.
- Move the user toward the next useful step.
- Avoid loud celebration for routine admin work.

## 18. Mobile Responsive Rules

Mobile must be a real portal experience.

Rules:

- Use one-column layouts under tablet widths.
- Sidebar becomes a drawer or mobile navigation pattern.
- Do not squeeze desktop sidebar into a narrow mixed state.
- Keep tap targets at least 40px high.
- Keep primary actions reachable without covering content.
- Convert wide tables into priority rows/cards when needed.
- Long names, emails, IDs, certificate codes, and Arabic text must wrap or truncate safely.
- Avoid portal hero scale on mobile.
- Test overflow for rosters, schedules, forms, dashboards, and action bars.

## 19. Arabic And RTL Rules

UI V2 must remain English-first and Arabic/RTL-ready.

Rules:

- Use logical CSS direction where practical.
- Avoid hard-coded left/right when start/end is correct.
- Directional icons must mirror when meaning changes.
- Arabic labels and Quran text need enough line height for diacritics.
- Keep numbers, dates, emails, codes, and IDs readable in RTL.
- Do not use Arabic calligraphy as operational UI text decoration.

## 20. Strict Limits

These limits are mandatory for UI V2:

- No page should start with more than 4 KPI cards.
- No dashboard card should contain more than 2 short text lines unless it is a content list.
- No dashboard should show more than 3 main content sections above the fold.
- No random badges.
- No repeated generic card grids.
- No oversized debug metrics.
- No "everything everywhere" layouts.
- No noisy grid background on dense internal pages.
- No default shadcn dashboard look.
- No generic beige admin template feeling.
- No mixed expanded/collapsed sidebar state.
- No global search dominating pages where it is not useful.
- No debug/system data outside admin, audit, integration, or system-health contexts.
- No route-wide UI V2 rollout before one reference dashboard has been visually reviewed.

## 21. Components To Replace Instead Of Patch

Replace shared UI architecture when it forces generic output.

Replace or heavily redesign components that:

- generate repeated generic card grids for unrelated routes;
- show long descriptions on every internal dashboard card;
- treat every module as the same visual weight;
- expose debug or technical values as primary content;
- create a noisy shell background behind all pages;
- make sidebar navigation visually unfinished or hard to scan;
- make search, user controls, and page actions fight for top-header attention.

Do not patch these issues with only:

- new shadows;
- border color changes;
- random accent colors;
- more badges;
- more icons;
- decorative gradients;
- larger hero copy.

UI V2 requires replacing the structure when the structure is the problem.

## 22. Controlled Implementation Order

Do not apply UI V2 to all pages at once.

Build and review in this order:

1. App shell.
2. Sidebar.
3. Top header.
4. One reference dashboard.
5. Visual review across desktop and mobile.
6. One component family at a time: dashboard cards, tables, forms, empty states.
7. Route-by-route portal rollout.

Reference dashboard rule:

- Pick one dashboard as the standard before applying V2 elsewhere.
- The current approved reference is the Super Admin dashboard because it exercises shell navigation, access governance, audit, integrations, and system status without changing workflows.
- The reference dashboard must include a page header, KPI strip, primary work area, secondary panel, lower summary area where useful, responsive state, loading state, empty state, and error state.
- Do not migrate other dashboards or route families until the shell and Super Admin reference are visually reviewed.

## 23. Page Acceptance Checklist

Before a UI V2 page is considered complete, verify:

- The page follows `DESIGN.md` and `docs/DESIGN_V2.md`.
- The page has a designed `PageHeader` or `PageHero`.
- The page has one clear primary action when action is appropriate.
- The dashboard starts with no more than 4 KPI cards.
- The dashboard has no more than 3 major sections above the fold.
- The page uses fewer, more purposeful cards.
- Every table is inside a `DataTableCard`.
- Every form uses `FormSection` or equivalent section/card layout.
- The sidebar state is clean: expanded or collapsed, never awkwardly mixed.
- The top header is balanced and does not duplicate page content.
- Search is present only where useful.
- The background is calm and does not compete with content.
- Copy is short and user-facing.
- Badges are meaningful and not decorative.
- Technical/debug data is hidden unless the page is admin, audit, integration, or system health.
- Loading, empty, error, disabled, and success states exist where relevant.
- Desktop, tablet, mobile, and RTL behavior are considered.
- RBAC, auth, route behavior, and backend boundaries are preserved.
