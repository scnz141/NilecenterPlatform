# Nile Learn Design System

`DESIGN.md` is the permanent UI design contract for Nile Learn. Read it before creating or editing any UI.

The landing page at <https://nile-center-platform.vercel.app/> is the visual source of truth. Do not redesign the landing page unless the task explicitly requires it. Instead, extract its language and carry it into internal portals: warm educational trust, refined SaaS operations, restrained surfaces, clear typography, and role-aware dashboards.

The goal is not to copy Apple, Airbnb, or Cursor directly. Nile Learn should feel like a premium education platform:

- Apple-inspired clarity, calm spacing, refined typography, consistent layout, and accessibility.
- Airbnb-inspired warmth, trust, simple human cards, and surfaces that work before they decorate.
- Cursor-inspired command-center dashboards, polished panels, calm contrast, and workspace-like productivity.

## 1. Product Design Principles

- Design for learning operations first. Every screen must help a student learn, a teacher teach, or an operator make a decision.
- Match the landing page mood: warm off-white canvas, charcoal type, taupe dividers, amber highlights, and deep Nile role tones.
- Make internal portals feel like the same product as the landing page, not a separate default admin template.
- Keep pages quiet and purposeful. Use hierarchy, spacing, alignment, and data density before decoration.
- Prioritize trust. Educational records, certificates, payments, attendance, and Quran progress must look accurate, calm, and audit-ready.
- Every page needs a clear primary job, primary action, secondary actions, and status visibility.
- Use role-specific context without changing the brand. Roles may have accent colors, but the base product remains Nile Learn.
- Avoid prototype-only screens. Even demo data must be arranged like production workflows.
- Do not weaken auth, RBAC, ownership, validation, or backend boundaries for visual polish.

## 2. Visual Design Rules

- Base the visual system on the current landing page and `client/src/index.css` tokens.
- Use a warm educational canvas, not pure white full-page backgrounds.
- Use charcoal as the primary action color. Do not make blue the default primary action.
- Use deep role accents sparingly for orientation, status, charts, and small highlights.
- Prefer restrained borders and soft elevation over heavy shadows.
- Use one strong focal area per screen: header summary, workspace panel, table, player, calendar, or approval queue.
- Keep UI chrome thin. Borders should define structure without boxing every element.
- Use icons from `lucide-react` for actions and navigation.
- Use Arabic calligraphy or Quranic visual references only as subtle brand texture, never as noisy decoration.
- Motion should be functional: page reveals, hover affordance, drawer/modal transitions, progress feedback, and state changes.

## 3. Color/Token Rules

Use existing token names before adding new colors:

- Canvas: `--home-canvas` / `--background` = `#f7f5f0`.
- Surface: `--home-surface` / `--card` = `#fffdf9`.
- Ink: `--home-ink` / `--foreground` = `#1a1a1a`.
- Muted text: `--home-muted` / `--muted-foreground` = `#6a6a6a`.
- Taupe: `--home-taupe` = `#9a8878`.
- Border: `--home-border` / `--border` = `#e8e2d8`.
- Strong border: `--home-border-strong` = `#d4cec6`.
- Sand: `--home-sand` / `--muted` = `#f0ede8`.
- Gold/amber: `--home-gold` / `--accent` = `#c4a35a`.
- Success/Nile green: `--home-green` / `--nc-green` = `#2d5016`.
- Academic blue: `--home-blue` / `--nc-blue` = `#1a3a5c`.
- Operations brown: `--home-brown` = `#5c2d00`.
- Governance purple: `--home-purple` / `--nc-purple` = `#3d1a5c`.
- Branch teal: `--home-teal` = `#1a4a3a`.
- Admin olive: `--home-olive` = `#4a3a1a`.
- Destructive: `--nc-red` / `--destructive` = `#c75b39`.

Rules:

- Do not introduce random hex colors. Add a token only if an existing token cannot express the state.
- Page backgrounds use `--background`; repeated panels use `--card`; inset controls use `--muted`.
- Primary CTA uses `--foreground` background and `--background` or white text.
- Secondary CTA uses transparent or `--card` background with `--border`.
- Use `color-mix()` with `--role-color` for role tints instead of hard-coded pastel variants.
- Status colors must be semantic: green for success/completed, amber for pending/attention, red for destructive/error, blue for informational, purple for governance/review.
- Maintain WCAG-readable contrast. Muted copy cannot carry critical instructions.
- Dark panels are allowed for command centers, previews, media/player states, and high-emphasis summaries, not for every card.

## 4. Typography Rules

- Body font follows the current stack: `-apple-system`, `BlinkMacSystemFont`, `"Segoe UI"`, `"Inter"`, `sans-serif`.
- Landing/editorial display moments may use `"Instrument Serif"`, `Georgia`, serif as the landing page does.
- Internal portal pages should mostly use system sans for clarity and dense scanning.
- Arabic text should use `"Noto Naskh Arabic"`, `"Amiri"`, serif where available, especially for calligraphy, Quran, and Arabic labels.
- Use large editorial type only for public pages, auth gateway moments, or rare portal overview headers.
- Internal page titles should be clear and compact: usually 24-40px depending on page complexity.
- Card and panel headings should be 14-20px, not hero-sized.
- Labels use small uppercase or compact semibold text only when it improves scanning.
- Letter spacing should be `0` for normal headings. Use small positive tracking only for eyebrow labels.
- Keep text concise. Product UI copy should orient, report status, or tell the user what action is available.

## 5. Spacing Rules

- Use generous outer page padding and tighter internal density.
- Desktop portal content should generally use 24-32px page padding.
- Mobile portal content should use 16px page padding.
- Use 8px as the smallest layout rhythm, then 12, 16, 20, 24, 32, 40, 56, 72.
- Dense tables and rosters can use 8-12px cell rhythm.
- Important workflow panels need 16-24px internal padding.
- Public/editorial sections can use 64-96px vertical spacing.
- Do not crowd headings, actions, filters, and tables together. Give each group a readable boundary.
- Do not create large empty dashboard whitespace when a table, queue, or operational state should be visible.

## 6. Layout Rules

- Internal portals are operational workspaces, not landing pages.
- Use the existing platform shell and role-aware layout patterns.
- Each page should have:
  - a compact page header with title, context, and primary action;
  - a status or metric band when useful;
  - the primary workspace area;
  - secondary context, filters, or inspector panels.
- Prefer two-column layouts for workflows: main work area plus right-side context or queue.
- Prefer tables for large operational lists; cards are for repeated objects that need summary/action context.
- Use sticky sidebars, filters, or table headers only when they improve repeated work.
- Keep navigation predictable across roles. Do not invent a new shell for one page.
- Make route context visible: role, branch/scope, selected class/course/student, and current status.
- Use max-widths only where they improve readability. Dashboards and tables should use available width.

## 7. Card Rules

- Cards must have a job: summarize, select, compare, approve, inspect, or act.
- Default internal card radius is 8px. Larger 16-24px rounded panels are reserved for landing/auth/editorial feature blocks already established by the public page.
- Use `--card` background, `--border` border, and light shadow only on hover or elevated overlays.
- Avoid card mosaics where a table, timeline, split layout, or toolbar would be clearer.
- Do not put cards inside cards.
- Do not use many identical cards with weak labels.
- Each card needs a clear title, one useful metric/status/detail, and an action or reason to exist.
- Use role accents on a small icon tile, left border, top hairline, or status chip, not as full-card color flooding.
- Hover states should be subtle: slight lift, border darkening, or icon movement.

## 8. Dashboard Rules

- Dashboards must feel like command centers, not generic KPI grids.
- Start with the most actionable state: today’s classes, pending approvals, attendance risk, payment exceptions, grading queue, certificate status, or system health.
- Use metrics only when they connect to a workflow.
- Every metric must have a label, scope, and freshness cue when relevant.
- Use charts sparingly and label them clearly. Do not show decorative charts.
- Include role-specific quick actions near the context where they matter.
- Use calm dark panels for high-level command summaries or live workspace previews where contrast helps.
- Avoid oversized hero banners inside portals. Use compact work headers instead.
- Dashboards should show empty/loading/error states for each data region, not only the full page.

## 9. Form Rules

- Forms must look trustworthy and easy to complete.
- Group fields by user intent, not database order.
- Use clear labels above fields. Do not rely on placeholders as labels.
- Provide validation feedback near the field and a summary only when useful.
- Required fields should be clear without visual clutter.
- Use disabled and loading states on submit actions.
- Confirm success with the next state: saved, queued, submitted, synced, approved, issued, or pending.
- Use two-column forms on desktop when fields are short and related; use one column on mobile.
- Keep destructive form actions visually separate and confirm them.
- Never ask for or display real secrets in browser-visible UI.

## 10. Table Rules

- Use tables for students, leads, enrollments, payments, attendance rosters, audit logs, reports, and user management.
- Tables need a title, filters/search where useful, row count or scope, and empty state.
- Header text should be compact uppercase or semibold muted text.
- Rows should have clear hover state and stable row height.
- Critical status belongs in chips, not only color.
- Provide row actions as icon buttons or compact text actions with accessible labels.
- Keep numeric columns aligned and easy to scan.
- Avoid horizontal overflow on mobile; use responsive card rows or priority columns when needed.
- Export actions must make the exported scope obvious.
- Audit and security tables must never hide actor, timestamp, action, target, and result when available.

## 11. Empty/Loading/Error State Rules

- Empty states must explain what is absent and what the user can do next.
- Loading states should use skeletons for cards/tables and compact spinners for small controls.
- Error states must be specific: what failed, what remains saved, and what retry action exists.
- Success states should be visible but not noisy.
- Offline or backend-sync-pending states must clearly distinguish local demo save from server persistence.
- Do not leave blank panels, dead buttons, or “coming soon” placeholders on production-like portal pages.
- Use icons sparingly to improve scanning.
- Keep state copy short and operational.

## 12. Student Portal UI Rules

- Student pages must feel supportive, clear, and progress-centered.
- Dashboard priority: next lesson/live session, active course progress, assignments/quizzes due, attendance, teacher feedback, certificates, Quran progress, and support.
- Course pages need a strong learning path: modules, lesson states, resources, assessments, and completion feedback.
- Player UI should feel premium and calm, with classroom-board mode handled responsively.
- Grades and reports must explain status without shame or clutter.
- Attendance must show present/late/absent/excused states clearly.
- Profile/support pages must feel account-safe and editable where allowed.
- Quran progress should respect terminology: memorization, tajweed, recitation, revision, mistake tags, and teacher review.

## 13. Teacher Portal UI Rules

- Teacher pages must optimize repeated classroom work.
- Dashboard priority: today’s classes, pending attendance, materials, grading queue, quizzes, student exceptions, messages, and Quran reviews.
- Class pages need roster, session context, attendance controls, materials, and messaging close together.
- Attendance controls must be fast, stable, and save visibly.
- Grading pages need submission status, rubric/score, feedback, and publish state.
- Materials workflows must show draft/published state and target class/course.
- Teacher reports should summarize workload, student progress, and intervention needs.
- Avoid decorative dashboard cards that slow down classroom operations.

## 14. Registrar Portal UI Rules

- Registrar pages must feel like a clean EMS admissions and enrollment desk.
- Dashboard priority: lead pipeline, applications, placement tests, enrollment status, schedule conflicts, payments, and messages.
- Leads/applications need pipeline stages, ownership, contact status, and conversion action.
- Placement test UI must show requested date, branch, subject, result, recommendation, and enrollment next step.
- Student registration forms must group identity, contact, guardian, branch, program, payment, and class assignment.
- Payments must clearly show invoice status, amount, method, due date, and reconciliation notes.
- Schedules need conflict indicators for room, teacher, branch, and time.

## 15. HOD Portal UI Rules

- HOD pages must feel like academic governance, not generic admin.
- Dashboard priority: departments, programs, curriculum status, Moodle/source mapping, teacher load, assessments, certificate approvals, and reports.
- Curriculum screens need level, module, lesson, outcome, assessment, and publish state.
- Course/source mapping must show where content comes from and whether it is synced, draft, or approved.
- Certificate approval flows need eligibility evidence before action buttons.
- Assessment review must expose attempts, grading state, and manual review queues.
- HOD reports should emphasize academic quality, completion, teacher coverage, and curriculum gaps.

## 16. Branch Admin UI Rules

- Branch admin pages must feel like local operations control.
- Dashboard priority: rooms, today’s schedule, local students, local teachers, attendance, payments, conflicts, and branch messages.
- Room and schedule pages need availability, capacity, conflict, and status at a glance.
- Branch scope must be visually clear so users know which branch they are managing.
- Staff/student lists should expose local assignment and active/inactive state.
- Payment and attendance views must be filtered by branch unless a higher role changes scope.
- Use operational tables and schedule grids more than decorative cards.

## 17. Super Admin UI Rules

- Super admin pages must feel like platform control and audit.
- Dashboard priority: system health, users, roles, permissions, branches, integrations, audit logs, reports, and platform blueprint.
- Access-control pages must show user, role, permission, branch scope, last activity, and risk.
- Permission changes require clear before/after context and confirmation.
- Integration pages must separate browser-public config from server-only secrets.
- Audit logs must be dense, searchable, exportable, and scoped.
- System-health panels should use calm dark or high-contrast treatment only where it improves monitoring.
- Avoid playful visuals in security, roles, permissions, and audit surfaces.

## 18. Mobile Responsive Rules

- Design mobile as a real portal experience, not a squeezed desktop page.
- Use one-column layouts under tablet widths.
- Convert complex tables into priority rows/cards only when horizontal scrolling would break usability.
- Keep tap targets at least 40px high.
- Primary actions should remain reachable, but not fixed over content unless necessary.
- Sidebars become drawers or bottom-aware navigation; do not leave desktop sidebars compressed into unusable columns.
- Long words, emails, IDs, and certificate codes must wrap or truncate safely.
- Player, calendar, roster, and form controls must be tested for overflow.
- Avoid landing-page hero scale inside mobile portal screens.

## 19. Arabic/RTL Rules

- All UI must remain English-first but Arabic/RTL-ready.
- Use logical CSS properties where practical: `margin-inline`, `padding-inline`, `border-inline`, `inset-inline`.
- Do not hard-code left/right alignment when start/end is the correct meaning.
- Arabic content should have appropriate font support and line-height.
- Arabic labels and Quran text need enough vertical room for diacritics.
- Icons that imply direction must mirror in RTL when the direction matters.
- Tables and forms must preserve data meaning in RTL: numbers, dates, codes, and emails should remain readable.
- Do not mix Arabic calligraphy as decoration with operational Arabic labels in a way that reduces legibility.

## 20. Strict Do Not Do This List

- Do not create plain default shadcn dashboards.
- Do not create generic white/gray admin screens disconnected from the landing page.
- Do not use random colors, random spacing, or one-off button styles.
- Do not make every page a card grid.
- Do not put cards inside cards.
- Do not use oversized portal hero sections that hide the actual work.
- Do not copy Apple, Airbnb, Cursor, Linear, or any other brand directly.
- Do not add decorative gradients, blobs, or orbs that are not part of Nile Learn’s current visual language.
- Do not use blue as the default primary action color.
- Do not use pure black everywhere; use charcoal intentionally.
- Do not hide real workflow state behind pretty summaries.
- Do not ship blank placeholders, dead controls, or “coming soon” screens for requested feature slices.
- Do not make mobile an afterthought.
- Do not hard-code real user data, credentials, provider tokens, or private records.
- Do not use `VITE_*` values for server-only credentials.
- Do not weaken RBAC, RLS, validation, or auth boundaries to make a screen easier to demo.

## 21. Component Checklist Every Page Must Use

Before considering a UI page complete, verify:

- Page uses the existing shell, route pattern, and role context.
- Page uses `DESIGN.md` tokens and existing `client/src/index.css` variables.
- Page has a clear title, scope, and primary action where applicable.
- Page has loading, empty, error, disabled, and success states where applicable.
- Page exposes role, branch, ownership, or selected entity context when relevant.
- Page uses appropriate structure: table for large lists, cards for actionable summaries, forms for edits, timeline/calendar for schedule.
- Page uses accessible buttons, labels, focus states, and readable contrast.
- Page uses `lucide-react` icons consistently where icons are useful.
- Page has responsive behavior for desktop, tablet, and mobile.
- Page handles long names, emails, IDs, certificate codes, and Arabic text without overflow.
- Page preserves RBAC and never trusts client-provided identity or scope fields for authorization.
- Page does not introduce unrelated design styles, colors, spacing, or new component patterns.
