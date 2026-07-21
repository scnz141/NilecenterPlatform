import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function requireText(source, expected, label) {
  if (!source.includes(expected)) {
    throw new Error(`${label} is missing: ${expected}`);
  }
}

function requirePattern(source, pattern, label) {
  if (!pattern.test(source)) {
    throw new Error(`${label} does not match ${pattern}`);
  }
}

function rejectText(source, rejected, label) {
  if (source.includes(rejected)) {
    throw new Error(`${label} contains prohibited text: ${rejected}`);
  }
}

const adrPath = "docs/decisions/ADR-007-nile-forms-processing-boundary.md";
const promptPath = ".codex/prompts/18-nile-forms-production-core.md";
const structuredPromptPath =
  ".codex/prompts/19-nile-forms-structured-content.md";
const nextPromptPath = ".codex/prompts/20-nile-forms-requests.md";
const adr = read(adrPath);
const prompt = read(promptPath);
const structuredPrompt = read(structuredPromptPath);
const nextPrompt = read(nextPromptPath);
const masterPlan = read("docs/NILE_LEARN_MASTER_PLAN.md");
const decisionIndex = read("docs/decisions/README.md");
const legacyPrompt = read(".codex/prompts/17-nile-forms.md");
const envExample = read(".env.example");
const cutover = read("client/src/lib/forms/cutover.ts");
const service = read("server/nileFormsService.ts");
const verify = read("scripts/verify.sh");
const migrations = fs.readdirSync(path.join(root, "supabase", "migrations"));
const informationArchitecture = read("docs/UI_INFORMATION_ARCHITECTURE.md");
const appRoutes = read("client/src/App.tsx");
const builderPage = read("client/src/pages/platform/NileFormsBuilderPage.tsx");
const managePage = read("client/src/pages/platform/NileFormsManagePage.tsx");
const publishPage = read("client/src/pages/platform/NileFormsPublishPage.tsx");
const renderer = read("client/src/components/forms/NileFormRenderer.tsx");
const formsCss = read("client/src/styles/nile-forms.css");
const rbac = read("client/src/lib/rbac.ts");

requireText(adr, "- Status: Accepted", "ADR-007 status");
for (const kind of [
  "evidence",
  "request",
  "sequential_approval",
  "booking",
  "survey",
  "application",
]) {
  requireText(adr, `\`${kind}\``, `ADR-007 processing kind ${kind}`);
}
requireText(
  adr,
  "never become mutable workflow state",
  "ADR-007 evidence boundary"
);
requireText(
  adr,
  "returns `403` and\n  writes no submission, quarantine row, command evidence, audit, or outbox",
  "ADR-007 denial boundary"
);
requireText(
  adr,
  "a server-issued bundle proves that capture was authorized before\n  its assignment or version changed",
  "ADR-007 offline quarantine boundary"
);
requireText(
  adr,
  "`form_submissions:sensitive_read`",
  "ADR-007 sensitive permission"
);
requireText(
  adr,
  "locks session, role-grant, permission, scope,\n  assignment, and target rows",
  "ADR-007 revocation race boundary"
);
requireText(
  adr,
  "one-to-one public command record",
  "ADR-007 public evidence relation"
);
requireText(
  adr,
  "dedicated Forms execution principal",
  "ADR-007 execution principal"
);
requireText(
  adr,
  "extends `FormLocale` to `en | ar | tr`",
  "ADR-007 Turkish locale gate"
);
requireText(
  adr,
  "an empty or non-overlapping session/profile intersection\n  returns `403`",
  "ADR-007 empty-scope boundary"
);
requireText(
  adr,
  "replacement version may retain the same slug only in one atomic",
  "ADR-007 stable slug boundary"
);
requireText(
  adr,
  "same-slug replacements must open immediately",
  "ADR-007 replacement scheduling boundary"
);
requireText(
  adr,
  "Condition operators and values must match their source field type",
  "ADR-007 typed condition boundary"
);
requireText(
  adr,
  "Retired or closed publications accept no new assignments",
  "ADR-007 assignment availability boundary"
);
requireText(
  adr,
  "A failed promotion replays for the same idempotency key",
  "ADR-007 promotion retry boundary"
);
requireText(
  adr,
  "Existing Registrar admissions lead command",
  "ADR-007 canonical lead owner"
);
requireText(
  decisionIndex,
  "ADR-007-nile-forms-processing-boundary.md",
  "decision index"
);
requireText(legacyPrompt, "`ADR-007`", "Nile Forms collection prompt");

requireText(
  masterPlan,
  "**Phase 13F1: normalized repository contract foundation** is accepted locally:",
  "accepted Forms repository checkpoint"
);
requireText(
  masterPlan,
  "**Phase 14A: structured content and localization parity** is accepted locally:",
  "accepted structured content checkpoint"
);
requireText(
  masterPlan,
  "Phase 14B are accepted local foundations. No further Nile Forms workflow",
  "current Forms checkpoint"
);
requireText(
  masterPlan,
  "Phase 13F1 must not add fields, processing profiles, requests, approvals,",
  "Phase 13F1 expansion boundary"
);
requireText(
  prompt,
  "It does not add fields, processing profiles, requests,",
  "production-core prompt scope"
);
requireText(
  prompt,
  "Do not apply SQL to a linked, shared, or remote Supabase project",
  "production-core remote boundary"
);
requireText(
  prompt,
  "Memory remains the default until an explicit later activation checkpoint",
  "production-core runtime boundary"
);
requireText(
  prompt,
  "They never fabricate an app user,\n  session, or role grant",
  "production-core public principal boundary"
);
requireText(
  prompt,
  "forms_promotion_persistence_inactive",
  "production-core promotion boundary"
);
requireText(
  prompt,
  "revoke-versus-command races",
  "production-core revocation race test"
);
requireText(
  prompt,
  "`role_grant_permissions`",
  "production-core grant-level permissions"
);
requireText(
  prompt,
  "one centralized answer projector",
  "production-core centralized redaction"
);
requireText(
  prompt,
  "dedicated `nile_forms_executor` principal",
  "production-core RPC-only principal"
);
requireText(
  prompt,
  "exact allowed Origin/Host match",
  "production-core CSRF boundary"
);
requireText(
  prompt,
  "outside pushable migration\n  history",
  "production-core local migration boundary"
);
requireText(
  prompt,
  "Only successful submission and review commands create `form.submitted` and\n  `form.reviewed` outbox events",
  "production-core outbox boundary"
);
requireText(
  prompt,
  "The batch-sync envelope, replayed items, rejected\n  items, and quarantined items create no outbox event",
  "production-core offline outbox boundary"
);
requireText(
  prompt,
  "rollback removes only Phase 13F1 objects and preserves every Phase 13A-E",
  "production-core rollback boundary"
);
requireText(
  masterPlan,
  "The separately approved Moodle workstream may proceed only with disjoint write",
  "parallel workstream boundary"
);
requireText(
  structuredPrompt,
  "Implement only Phase 14A approved by the current checkpoint",
  "Phase 14A prompt scope"
);
requireText(
  structuredPrompt,
  "complete `en | ar | tr` labels",
  "Phase 14A localization contract"
);
requireText(structuredPrompt, "Reject cycles,", "Phase 14A calculation safety");
requireText(
  structuredPrompt,
  "Template instantiation creates an independent draft",
  "Phase 14A template immutability"
);
requireText(
  structuredPrompt,
  "Do not apply SQL to a linked, shared, or remote Supabase project",
  "Phase 14A remote boundary"
);
requireText(
  structuredPrompt,
  "Phase 14A must not add Requests, Approvals, Appointments, Surveys",
  "Phase 14A expansion boundary"
);
requireText(
  nextPrompt,
  "Implement only Phase 14B approved by the current checkpoint",
  "Phase 14B prompt scope"
);
requireText(
  nextPrompt,
  "one typed Requests module",
  "Phase 14B typed module boundary"
);
requireText(
  nextPrompt,
  "Form answers never become mutable request state",
  "Phase 14B immutable evidence boundary"
);
requireText(
  nextPrompt,
  "Memory remains the runtime default in this slice",
  "Phase 14B runtime boundary"
);
requireText(
  nextPrompt,
  "Phase 14B must not add Approvals, Appointments, Surveys, Applications",
  "Phase 14B expansion boundary"
);

const phase14Start = masterPlan.indexOf(
  "### Phase 14: Nile Forms Processing And Typed Operations"
);
const phase14End = masterPlan.indexOf("## Testing Strategy", phase14Start);
const phase14 = masterPlan.slice(phase14Start, phase14End);
rejectText(
  phase14,
  "Normalized Nile Forms repository and atomic command/audit/outbox persistence.",
  "Phase 14 duplicate repository ownership"
);

requirePattern(
  envExample,
  /^NILE_FORMS_COMPATIBILITY_ENABLED="0"$/m,
  "Nile Forms compatibility default"
);
requirePattern(
  envExample,
  /^VITE_NILE_FORMS_CUTOVER_ENABLED="0"$/m,
  "Nile Forms cutover default"
);
requirePattern(
  envExample,
  /^NILE_FORMS_NORMALIZED_PERSISTENCE_ENABLED="0"$/m,
  "Nile Forms normalized persistence default"
);
requireText(
  cutover,
  'import.meta.env.VITE_NILE_FORMS_CUTOVER_ENABLED === "1"',
  "client cutover opt-in"
);
requireText(
  service,
  '"normalized_persistence_inactive"',
  "normalized-session fail-closed behavior"
);
requireText(
  service,
  '"session_scope_denied"',
  "empty-scope fail-closed behavior"
);
requireText(
  service,
  "replacedPublicationIds",
  "stable publication replacement"
);
requireText(service, "carriedAssignments", "replacement assignment carry");
requireText(
  service,
  '"replacement_schedule_invalid"',
  "future stable-slug replacement denial"
);
requireText(
  service,
  '"publication_unavailable"',
  "closed publication assignment denial"
);
requireText(
  read("client/src/lib/forms/server-nile-forms-service.test.ts"),
  'it("never invokes compatibility promotion for a normalized session"',
  "normalized promotion executor sentinel"
);
requireText(
  read("client/src/lib/forms/server-nile-forms-service.test.ts"),
  'it("fails closed when session scope no longer overlaps the staff profile"',
  "empty-scope regression test"
);
requireText(
  read("client/src/lib/forms/server-nile-forms-service.test.ts"),
  'it("carries active assignments when an assigned publication keeps its slug"',
  "stable slug assignment test"
);
requireText(
  read("client/src/lib/forms/logicEditor.test.ts"),
  'describe("Nile Forms typed logic editor"',
  "typed condition editor tests"
);
requireText(
  read("client/src/lib/forms/logicEditor.test.ts"),
  'conditionValueFromInput(consentField, "equals", "true")',
  "Boolean consent condition regression"
);
requireText(
  read("client/src/lib/forms/logicEditor.test.ts"),
  "defaultLogicConditionForField",
  "typed new-rule regression"
);
requireText(
  read("client/src/lib/forms/server-nile-forms-service.test.ts"),
  'it("rejects new assignments for retired or expired publications',
  "publication assignment availability regression"
);
requireText(
  read("client/src/lib/forms/server-nile-forms-service.test.ts"),
  'it("replays a failed promotion attempt and retries only with a new command key',
  "promotion retry regression"
);
requireText(
  read("client/src/pages/platform/NileFormsReviewDetailPage.tsx"),
  "Retry promotion",
  "promotion retry UI"
);
if (migrations.some(file => /phase13f1|forms_production_core/i.test(file))) {
  throw new Error(
    "Phase 13F1 SQL must remain outside pushable migration history"
  );
}

for (const route of [
  "/forms/manage/new",
  "/forms/manage/:formId/publications",
  "/forms/manage/:formId/publications/:publicationId/assignments",
  "/requests/:requestId",
  "/approvals/:approvalId",
  "/appointments/:bookingId",
  "/surveys/results/:surveyId",
  "/forms/manage/:formId/processing",
]) {
  requireText(
    informationArchitecture,
    route,
    `Nile Forms route ownership ${route}`
  );
}
for (const component of [
  "NileFormsCreatePage",
  "NileFormsPublicationsPage",
  "NileFormsAssignmentsPage",
]) {
  requireText(appRoutes, component, `Nile Forms route component ${component}`);
}
requireText(
  rbac,
  'pageId === "form-assignments"',
  "assignment route permission owner"
);
requireText(rbac, 'return "forms:assign"', "assignment route permission");
requireText(
  builderPage,
  'className="nile-form-builder-select"',
  "builder keyboard selection control"
);
requireText(
  builderPage,
  "aria-pressed={field.id === fieldId}",
  "builder selection state"
);
requireText(
  renderer,
  '"aria-labelledby": labelId',
  "grouped response accessible label"
);
requireText(
  renderer,
  '"aria-required": required',
  "grouped response required state"
);
rejectText(
  managePage,
  "nile-forms-modal-backdrop",
  "manage list/create separation"
);
rejectText(
  publishPage,
  "NileFormsAssignmentManager",
  "publish/assignment separation"
);
requireText(
  formsCss,
  ".platform-content:has(.nile-form-builder-page)",
  "builder ultrawide workspace"
);
requirePattern(
  formsCss,
  /\.nile-forms-subnav a \{[\s\S]*?min-height: 40px;/,
  "Forms subnavigation touch target"
);
for (const [pattern, label] of [
  [
    /\.nile-form-language button,[\s\S]*?height: 40px;/,
    "renderer choice touch target",
  ],
  [
    /\.nile-form-canvas-title input \{[\s\S]*?min-height: 40px;/,
    "builder title touch target",
  ],
  [
    /\.nile-form-add-field select \{[\s\S]*?min-height: 40px;/,
    "builder add-field touch target",
  ],
  [
    /\.nile-form-toggle-list label \{[\s\S]*?min-height: 40px;/,
    "builder toggle touch target",
  ],
  [
    /\.nile-migration-tabs button \{[\s\S]*?min-height: 40px;/,
    "migration tab touch target",
  ],
  [
    /\.nile-migration-inspection-heading input \{[\s\S]*?min-height: 40px;/,
    "migration pagination touch target",
  ],
  [
    /\.nile-migration-mapping-list select \{[\s\S]*?min-height: 40px;/,
    "migration mapping touch target",
  ],
  [
    /\.nile-offline-view-tabs button \{[\s\S]*?min-height: 40px;/,
    "offline tab touch target",
  ],
  [
    /\.nile-offline-reset-button \{[\s\S]*?min-height: 40px;/,
    "offline reset touch target",
  ],
  [
    /\.nile-offline-reset-zone \.platform-danger-button \{[\s\S]*?min-height: 40px;/,
    "offline confirmation touch target",
  ],
  [
    /\.nile-public-form-brand,[\s\S]*?min-height: 40px;/,
    "public header link touch target",
  ],
  [
    /\.nile-public-form-back \{[\s\S]*?min-width: 40px;/,
    "public back-link touch target",
  ],
]) {
  requirePattern(formsCss, pattern, label);
}

for (const registeredPath of [
  adrPath,
  promptPath,
  structuredPromptPath,
  nextPromptPath,
  "scripts/validate-nile-forms-program-contract.mjs",
]) {
  requireText(
    verify,
    registeredPath,
    `verification registration ${registeredPath}`
  );
}

console.log(
  JSON.stringify({
    ok: true,
    authority: ["ADR-006", "ADR-007"],
    acceptedRepositorySlice:
      "Phase 13F1 normalized repository contract foundation",
    acceptedStructuredSlice:
      "Phase 14A structured content and localization parity",
    nextSlice: "Phase 14B typed Requests",
    processingKinds: 6,
    compatibilityDefault: "disabled",
    cutoverDefault: "disabled",
    remoteMigrationApproved: false,
  })
);
