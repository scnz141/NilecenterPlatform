# 19 Nile Forms Structured Content And Localization

## SPEC

Implement only Phase 14A approved by the current checkpoint in
`docs/NILE_LEARN_MASTER_PLAN.md`.

This slice strengthens the existing Nile Forms definition, immutable version,
builder, renderer, validation, deterministic calculation, and reusable-template
lifecycle. It does not create a generic workflow engine or a new operational
module.

## AUTHORITY

- Existing Nile Forms permissions, authenticated session authority, branch and
  department scope, assignment ownership, audit, and repository gates remain
  authoritative.
- Builder changes create or update drafts only. Published versions remain
  immutable.
- Validation and calculations are definition behavior, not authorization.
  They cannot create or modify users, admissions, enrollments, attendance,
  payments, certificates, learning records, or provider state.
- Template instantiation creates an independent draft. It never mutates the
  source template, another definition, or a published version.
- Normalized persistence remains disabled by default. Memory remains the
  runtime authority until a separate activation checkpoint.

## STRUCTURED CONTENT

- Define one closed, versioned contract for the field kinds already approved
  for Nile Forms. Unknown or unsupported kinds fail closed.
- Require complete `en | ar | tr` labels, descriptions, option values, help
  text, and parameterized validation messages where the content applies.
- Arabic renders RTL. English and Turkish render LTR. Changing locale must not
  change field identifiers, option identifiers, calculation inputs, or saved
  answers.
- Validation rules use a closed operator catalog, bounded parameters, stable
  message keys, and deterministic ordering. Client validation improves UX;
  server validation remains authoritative.
- Calculations use a closed expression model with bounded depth and operation
  count. They may derive display or submitted values only. Reject cycles,
  unknown references, non-finite results, unsafe coercions, and executable
  strings.
- Published versions pin the exact field, localization, validation, option,
  and calculation contract used for every draft and submission.
- Reusable templates are versioned inputs with stable IDs. Instantiation must
  deep-copy content and preserve independent draft history.

## UI

- Keep one builder route and one rendering job; do not create a card wall.
- The builder must expose field structure, localization completeness,
  validation, and calculation state without mixing review or submission work.
- Provide loading, empty, invalid, disabled, saving, saved, and conflict states.
- Verify English, Arabic RTL, and Turkish LTR at mobile, laptop, and desktop
  widths with no horizontal overflow.
- Follow `DESIGN.md`, `docs/DESIGN_V2.md`, `docs/SIMPLE_UI.md`, and
  `docs/UI_INFORMATION_ARCHITECTURE.md`.

## DATABASE AND RUNTIME

- Prefer shared schema contracts and repository-compatible payloads. Any SQL
  is additive, manual, local-only, forced-RLS, service-only, and outside
  pushable migration history.
- Preserve the Phase 13F1 RPC catalog, memory default, local-target guards,
  rollback posture, and fail-closed production behavior.
- Do not enable `NILE_FORMS_NORMALIZED_PERSISTENCE_ENABLED` or
  `VITE_NILE_FORMS_CUTOVER_ENABLED`.
- Do not apply SQL to a linked, shared, or remote Supabase project.

## VERIFY

Add focused tests for:

- closed field and operator catalogs;
- `en | ar | tr` completeness and direction;
- stable IDs across locale changes;
- client/server validation parity;
- deterministic calculations and cycle/complexity denial;
- immutable published versions;
- template deep-copy independence;
- scoped builder authority and denial;
- responsive and accessible builder/renderer states.

Run focused tests first, then `npm run check`, `npm test -- --run`,
`npm run build`, and the unfiltered `scripts/verify.sh`. Preserve the protected
1,634/0 portal baseline.

## EXCLUSIONS

Phase 14A must not add Requests, Approvals, Appointments, Surveys, uploads,
signatures, PDFs, provider notifications, webhooks, payments, external
delivery, migration cutover, or generic workflow state.

## STATUS

Accepted locally on 2026-07-18. Evidence is recorded in
`docs/qa-attestations/nile-forms-phase14a-structured-content-20260718.json`.
This prompt remains the acceptance contract for Phase 14A; new implementation
must follow the current checkpoint in `docs/NILE_LEARN_MASTER_PLAN.md`.
