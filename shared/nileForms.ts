import { z } from "zod";
import type { NileRequestsState } from "./nileRequests.js";

export const formFieldTypes = [
  "heading",
  "instructions",
  "short_text",
  "long_text",
  "email",
  "phone",
  "number",
  "date",
  "time",
  "single_choice",
  "multiple_choice",
  "yes_no",
  "rating",
  "consent",
  "entity_reference",
] as const;

export type FormFieldType = (typeof formFieldTypes)[number];
export const formLocales = ["en", "ar", "tr"] as const;
export type FormLocale = (typeof formLocales)[number];
export type FormOwnerRole =
  | "registrar"
  | "headofdepartment"
  | "branchadmin"
  | "superadmin";
export type FormRespondentRole = "student" | "teacher" | FormOwnerRole;
export type FormPermission =
  | "forms:read"
  | "forms:write"
  | "forms:publish"
  | "forms:assign"
  | "forms:respond"
  | "form_submissions:read"
  | "form_submissions:review"
  | "form_submissions:export"
  | "form_submissions:sensitive_read";

export type LocalizedText = {
  en: string;
  ar: string;
  tr?: string;
};

export type FormChoice = {
  id: string;
  label: LocalizedText;
};

export type FormFieldValidation = {
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  minSelections?: number;
  maxSelections?: number;
};

export const formValidationMessageKeys = [
  "required",
  "text",
  "min_length",
  "max_length",
  "email",
  "phone",
  "date",
  "time",
  "number",
  "min",
  "max",
  "yes_no",
  "consent",
  "choice",
  "choice_list",
  "min_selections",
  "max_selections",
  "calculation",
] as const;

export type FormValidationMessageKey =
  (typeof formValidationMessageKeys)[number];

export type FormValidationMessage = {
  key: FormValidationMessageKey;
  params: Record<string, string | number>;
};

export type FormDataClass =
  | "standard"
  | "government_id"
  | "payment"
  | "health"
  | "credential"
  | "file"
  | "signature";

export type FormField = {
  id: string;
  type: FormFieldType;
  label: LocalizedText;
  description?: LocalizedText;
  required?: boolean;
  options?: FormChoice[];
  validation?: FormFieldValidation;
  searchable?: boolean;
  reportable?: boolean;
  entityType?:
    | "branch"
    | "department"
    | "course"
    | "class"
    | "user"
    | "attendance_record";
  dataClass?: FormDataClass;
};

export type FormPage = {
  id: string;
  title: LocalizedText;
  description?: LocalizedText;
  fields: FormField[];
};

export const formLogicOperators = [
  "equals",
  "not_equals",
  "in",
  "not_in",
  "empty",
  "not_empty",
  "greater_than",
  "greater_than_or_equal",
  "less_than",
  "less_than_or_equal",
] as const;

export type FormLogicOperator = (typeof formLogicOperators)[number];

export type FormLogicCondition = {
  fieldId: string;
  operator: FormLogicOperator;
  value?: string | number | boolean | string[];
};

export type FormLogicGroup = {
  mode: "all" | "any";
  conditions: FormLogicCondition[];
};

export type FormLogicAction =
  | {
      type: "show" | "hide" | "require" | "optional";
      targetFieldId: string;
    }
  | {
      type: "skip_to_page";
      targetPageId: string;
    };

export type FormLogicRule = {
  id: string;
  order: number;
  when: FormLogicGroup;
  action: FormLogicAction;
};

export const formCalculationOperators = [
  "sum",
  "subtract",
  "multiply",
  "divide",
  "minimum",
  "maximum",
  "average",
] as const;

export type FormCalculationOperator = (typeof formCalculationOperators)[number];

export type FormCalculationOperand =
  | { type: "field"; fieldId: string }
  | { type: "constant"; value: number }
  | { type: "calculation"; calculationId: string };

export type FormCalculation = {
  id: string;
  targetFieldId: string;
  operator: FormCalculationOperator;
  operands: FormCalculationOperand[];
  precision?: number;
};

export type FormVersionContent = {
  contractVersion?: 1 | 2;
  title: LocalizedText;
  description: LocalizedText;
  defaultLanguage: FormLocale;
  languages: FormLocale[];
  submitLabel: LocalizedText;
  confirmationMessage: LocalizedText;
  pages: FormPage[];
  logic: FormLogicRule[];
  calculations?: FormCalculation[];
};

export type FormDefinitionStatus = "draft" | "active" | "retired";
export type FormVersionStatus = "draft" | "published" | "retired";
export type FormPublicationStatus = "scheduled" | "open" | "closed" | "retired";
export type FormSubmissionStatus =
  | "submitted"
  | "under_review"
  | "accepted"
  | "rejected"
  | "promoted"
  | "withdrawn"
  | "quarantined";

export type FormScope = {
  branchId?: string;
  departmentId?: string;
};

export type FormDefinition = FormScope & {
  id: string;
  key: string;
  title: string;
  category:
    | "admissions"
    | "student_support"
    | "attendance"
    | "consent"
    | "branch_operations";
  ownerUserId: string;
  ownerRole: FormOwnerRole;
  status: FormDefinitionStatus;
  currentDraftVersionId?: string;
  currentPublishedVersionId?: string;
  createdAt: string;
  updatedAt: string;
};

export type FormVersion = {
  id: string;
  definitionId: string;
  versionNumber: number;
  status: FormVersionStatus;
  revision: number;
  content: FormVersionContent;
  contentHash: string;
  authoredBy: string;
  publishedBy?: string;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type FormAudience = "public" | "authenticated" | "assigned";

export type FormPublication = {
  id: string;
  definitionId: string;
  versionId: string;
  slug: string;
  audience: FormAudience;
  status: FormPublicationStatus;
  opensAt?: string;
  closesAt?: string;
  allowMultiple: boolean;
  allowDrafts: boolean;
  offlineEligible: boolean;
  createdBy: string;
  createdAt: string;
  retiredAt?: string;
};

export type FormAssignmentTarget =
  | { type: "user"; userId: string }
  | { type: "role"; role: FormRespondentRole }
  | { type: "branch"; branchId: string }
  | { type: "department"; departmentId: string }
  | { type: "course"; courseId: string }
  | { type: "class"; classId: string };

export type FormAssignment = {
  id: string;
  publicationId: string;
  target: FormAssignmentTarget;
  assignedBy: string;
  assignedAt: string;
  expiresAt?: string;
  revokedAt?: string;
};

export type FormManagementOption = {
  id: string;
  label: string;
  context?: string;
};

export type FormManagementOptions = {
  roles: Array<FormManagementOption & { id: FormRespondentRole }>;
  users: FormManagementOption[];
  branches: FormManagementOption[];
  departments: FormManagementOption[];
  courses: FormManagementOption[];
  classes: FormManagementOption[];
};

export type FormDraft = {
  id: string;
  publicationId: string;
  versionId: string;
  assignmentId?: string;
  respondentUserId?: string;
  guestTokenHash?: string;
  encryptedPayload: string;
  revision: number;
  expiresAt: string;
  updatedAt: string;
};

export type FormSubmissionSource = "web" | "offline" | "legacy_import";

export type FormSubmission = FormScope & {
  id: string;
  definitionId: string;
  publicationId: string;
  versionId: string;
  assignmentId?: string;
  respondentUserId?: string;
  respondentRole?: FormRespondentRole;
  source: FormSubmissionSource;
  answers: Record<string, unknown>;
  status: FormSubmissionStatus;
  revision: number;
  clientSubmissionId?: string;
  clientSubmittedAt?: string;
  submittedAt: string;
  updatedAt: string;
  legacySource?: {
    formId: string;
    submissionId: string;
    payloadHash: string;
    importRunId: string;
    reconciliationStatus: "pending" | "matched" | "exception";
  };
};

export type FormReview = {
  id: string;
  submissionId: string;
  reviewerUserId: string;
  decision: "under_review" | "accepted" | "rejected";
  comments?: string;
  expectedSubmissionRevision: number;
  createdAt: string;
};

export type FormPromotion = {
  id: string;
  submissionId: string;
  adapter:
    | "lead.create"
    | "application.create"
    | "placement.create"
    | "support_ticket.create"
    | "attendance_exception.create";
  commandId: string;
  status: "pending" | "succeeded" | "failed";
  resultingEntityType?: string;
  resultingEntityId?: string;
  error?: string;
  idempotencyKey: string;
  createdAt: string;
  completedAt?: string;
};

export type FormAuditEvent = {
  id: string;
  actorUserId: string;
  actorRole: FormRespondentRole | "public";
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type FormOutboxEvent = {
  id: string;
  eventType: "form.submitted" | "form.reviewed" | "form.promoted";
  aggregateId: string;
  idempotencyKey: string;
  payload: Record<string, unknown>;
  createdAt: string;
};

export type FormOfflineDevice = {
  id: string;
  userId: string;
  label: string;
  publicKey: string;
  enrolledAt: string;
  expiresAt: string;
  revokedAt?: string;
};

export type FormSyncReceipt = {
  id: string;
  deviceId: string;
  clientSubmissionId: string;
  submissionId?: string;
  status: "accepted" | "duplicate" | "quarantined" | "rejected";
  reason?: string;
  receivedAt: string;
};

export type FormLegacyFieldMapping = {
  sourceQuestionId: string;
  targetFieldId: string;
};

export type FormLegacyImportRun = {
  id: string;
  provider: "jotform";
  sourceFormId: string;
  sourceFormTitle: string;
  targetPublicationId: string;
  targetVersionId: string;
  mapping: FormLegacyFieldMapping[];
  sourceOffset: number;
  sourceLimit: number;
  previewHash: string;
  status: "previewed" | "imported" | "reconciled" | "failed";
  totalRows: number;
  validRows: number;
  importedRows: number;
  duplicateRows: number;
  exceptionRows: number;
  createdBy: string;
  createdAt: string;
  completedAt?: string;
};

export type FormLegacyImportRecord = {
  id: string;
  runId: string;
  provider: "jotform";
  sourceFormId: string;
  sourceSubmissionId: string;
  payloadHash: string;
  submissionId?: string;
  reconciliationStatus: "pending" | "matched" | "exception";
  errors: string[];
  notes?: string;
  createdAt: string;
  reconciledBy?: string;
  reconciledAt?: string;
};

export type NileFormsState = {
  definitions: FormDefinition[];
  versions: FormVersion[];
  publications: FormPublication[];
  assignments: FormAssignment[];
  drafts: FormDraft[];
  submissions: FormSubmission[];
  reviews: FormReview[];
  promotions: FormPromotion[];
  auditEvents: FormAuditEvent[];
  outboxEvents: FormOutboxEvent[];
  offlineDevices: FormOfflineDevice[];
  syncReceipts: FormSyncReceipt[];
  legacyImportRuns: FormLegacyImportRun[];
  legacyImportRecords: FormLegacyImportRecord[];
  requests: NileRequestsState;
};

const identifierSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z][a-z0-9_:-]*$/i);
const localizedTextSchema = z.object({
  en: z.string().trim().min(1).max(600),
  ar: z.string().trim().min(1).max(600),
  tr: z.string().trim().min(1).max(600).optional(),
});
const optionalLocalizedTextSchema = z.object({
  en: z.string().trim().max(2_000),
  ar: z.string().trim().max(2_000),
  tr: z.string().trim().max(2_000).optional(),
});
const formChoiceSchema = z.object({
  id: identifierSchema,
  label: localizedTextSchema,
});
const fieldValidationSchema = z
  .object({
    minLength: z.number().int().min(0).max(5_000).optional(),
    maxLength: z.number().int().min(1).max(5_000).optional(),
    min: z.number().finite().optional(),
    max: z.number().finite().optional(),
    minSelections: z.number().int().min(0).max(100).optional(),
    maxSelections: z.number().int().min(1).max(100).optional(),
  })
  .superRefine((value, context) => {
    if (
      value.minLength !== undefined &&
      value.maxLength !== undefined &&
      value.minLength > value.maxLength
    ) {
      context.addIssue({
        code: "custom",
        message: "minLength cannot exceed maxLength",
      });
    }
    if (
      value.min !== undefined &&
      value.max !== undefined &&
      value.min > value.max
    ) {
      context.addIssue({ code: "custom", message: "min cannot exceed max" });
    }
    if (
      value.minSelections !== undefined &&
      value.maxSelections !== undefined &&
      value.minSelections > value.maxSelections
    ) {
      context.addIssue({
        code: "custom",
        message: "minSelections cannot exceed maxSelections",
      });
    }
  });
const formFieldSchema = z.object({
  id: identifierSchema,
  type: z.enum(formFieldTypes),
  label: localizedTextSchema,
  description: optionalLocalizedTextSchema.optional(),
  required: z.boolean().optional(),
  options: z.array(formChoiceSchema).max(100).optional(),
  validation: fieldValidationSchema.optional(),
  searchable: z.boolean().optional(),
  reportable: z.boolean().optional(),
  entityType: z
    .enum([
      "branch",
      "department",
      "course",
      "class",
      "user",
      "attendance_record",
    ])
    .optional(),
  dataClass: z
    .enum([
      "standard",
      "government_id",
      "payment",
      "health",
      "credential",
      "file",
      "signature",
    ])
    .optional(),
});
const logicConditionSchema = z.object({
  fieldId: identifierSchema,
  operator: z.enum(formLogicOperators),
  value: z
    .union([z.string(), z.number(), z.boolean(), z.array(z.string())])
    .optional(),
});
const logicActionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.enum(["show", "hide", "require", "optional"]),
    targetFieldId: identifierSchema,
  }),
  z.object({ type: z.literal("skip_to_page"), targetPageId: identifierSchema }),
]);
const logicRuleSchema = z.object({
  id: identifierSchema,
  order: z.number().int().min(0).max(10_000),
  when: z.object({
    mode: z.enum(["all", "any"]),
    conditions: z.array(logicConditionSchema).min(1).max(20),
  }),
  action: logicActionSchema,
});

const calculationOperandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("field"), fieldId: identifierSchema }),
  z.object({ type: z.literal("constant"), value: z.number().finite() }),
  z.object({
    type: z.literal("calculation"),
    calculationId: identifierSchema,
  }),
]);

const calculationSchema = z.object({
  id: identifierSchema,
  targetFieldId: identifierSchema,
  operator: z.enum(formCalculationOperators),
  operands: z.array(calculationOperandSchema).min(1).max(8),
  precision: z.number().int().min(0).max(6).optional(),
});

export const formVersionContentSchema = z.object({
  contractVersion: z.union([z.literal(1), z.literal(2)]).optional(),
  title: localizedTextSchema,
  description: optionalLocalizedTextSchema,
  defaultLanguage: z.enum(formLocales),
  languages: z.array(z.enum(formLocales)).min(1).max(3),
  submitLabel: localizedTextSchema,
  confirmationMessage: optionalLocalizedTextSchema,
  pages: z
    .array(
      z.object({
        id: identifierSchema,
        title: localizedTextSchema,
        description: optionalLocalizedTextSchema.optional(),
        fields: z.array(formFieldSchema).max(100),
      })
    )
    .min(1)
    .max(20),
  logic: z.array(logicRuleSchema).max(200),
  calculations: z.array(calculationSchema).max(50).optional(),
});

export type FormValidationIssue = {
  path: string;
  message: string;
};

const choiceFieldTypes = new Set<FormFieldType>([
  "single_choice",
  "multiple_choice",
]);
const nonAnswerFieldTypes = new Set<FormFieldType>(["heading", "instructions"]);
const valuelessLogicOperators = new Set<FormLogicOperator>([
  "empty",
  "not_empty",
]);
const numericLogicOperators = new Set<FormLogicOperator>([
  "greater_than",
  "greater_than_or_equal",
  "less_than",
  "less_than_or_equal",
]);
const searchableFieldTypes = new Set<FormFieldType>([
  "short_text",
  "email",
  "phone",
  "number",
  "date",
  "time",
  "single_choice",
  "yes_no",
  "rating",
  "entity_reference",
]);

function issue(path: string, message: string): FormValidationIssue {
  return { path, message };
}

function findCycle(graph: Map<string, Set<string>>) {
  const visiting = new Set<string>();
  const visited = new Set<string>();

  const walk = (node: string): boolean => {
    if (visiting.has(node)) return true;
    if (visited.has(node)) return false;
    visiting.add(node);
    for (const next of Array.from(graph.get(node) ?? [])) {
      if (walk(next)) return true;
    }
    visiting.delete(node);
    visited.add(node);
    return false;
  };

  return Array.from(graph.keys()).some(walk);
}

function validateLocalizedText(
  value: LocalizedText | undefined,
  path: string,
  required: boolean,
  issues: FormValidationIssue[]
) {
  if (!value) return;
  const hasContent = [value.en, value.ar, value.tr].some(item => item?.trim());
  if ((required || hasContent) && !value.tr?.trim()) {
    issues.push(
      issue(`${path}.tr`, "Turkish content is required for contract version 2")
    );
  }
}

function validateVersionTwoLocalization(
  content: FormVersionContent,
  issues: FormValidationIssue[]
) {
  const enabled = new Set(content.languages);
  if (
    enabled.size !== formLocales.length ||
    formLocales.some(locale => !enabled.has(locale))
  ) {
    issues.push(
      issue(
        "languages",
        "Contract version 2 requires English, Arabic, and Turkish"
      )
    );
  }
  validateLocalizedText(content.title, "title", true, issues);
  validateLocalizedText(content.description, "description", false, issues);
  validateLocalizedText(content.submitLabel, "submitLabel", true, issues);
  validateLocalizedText(
    content.confirmationMessage,
    "confirmationMessage",
    false,
    issues
  );
  content.pages.forEach((page, pageIndex) => {
    validateLocalizedText(page.title, `pages.${pageIndex}.title`, true, issues);
    validateLocalizedText(
      page.description,
      `pages.${pageIndex}.description`,
      false,
      issues
    );
    page.fields.forEach((field, fieldIndex) => {
      const fieldPath = `pages.${pageIndex}.fields.${fieldIndex}`;
      validateLocalizedText(field.label, `${fieldPath}.label`, true, issues);
      validateLocalizedText(
        field.description,
        `${fieldPath}.description`,
        false,
        issues
      );
      field.options?.forEach((option, optionIndex) =>
        validateLocalizedText(
          option.label,
          `${fieldPath}.options.${optionIndex}.label`,
          true,
          issues
        )
      );
    });
  });
}

export function validateFormVersionContent(input: unknown): {
  ok: boolean;
  content?: FormVersionContent;
  issues: FormValidationIssue[];
} {
  const parsed = formVersionContentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map(item =>
        issue(item.path.join("."), item.message)
      ),
    };
  }

  const content = parsed.data as FormVersionContent;
  const issues: FormValidationIssue[] = [];
  if (!content.languages.includes(content.defaultLanguage)) {
    issues.push(
      issue("defaultLanguage", "The default language must be enabled")
    );
  }
  if (new Set(content.languages).size !== content.languages.length) {
    issues.push(issue("languages", "Languages must be unique"));
  }
  if (content.contractVersion === 2) {
    validateVersionTwoLocalization(content, issues);
  }

  const pageById = new Map<string, FormPage>();
  const pageIndexById = new Map<string, number>();
  const fieldById = new Map<string, FormField>();
  const fieldPageIndex = new Map<string, number>();
  let fieldCount = 0;

  content.pages.forEach((page, pageIndex) => {
    if (pageById.has(page.id)) {
      issues.push(issue(`pages.${pageIndex}.id`, "Page IDs must be unique"));
    }
    pageById.set(page.id, page);
    pageIndexById.set(page.id, pageIndex);
    page.fields.forEach((field, fieldIndex) => {
      fieldCount += 1;
      const path = `pages.${pageIndex}.fields.${fieldIndex}`;
      if (fieldById.has(field.id)) {
        issues.push(issue(`${path}.id`, "Field IDs must be unique"));
      }
      fieldById.set(field.id, field);
      fieldPageIndex.set(field.id, pageIndex);

      const optionIds = new Set(field.options?.map(option => option.id) ?? []);
      if (optionIds.size !== (field.options?.length ?? 0)) {
        issues.push(issue(`${path}.options`, "Choice IDs must be unique"));
      }
      if (choiceFieldTypes.has(field.type) && !field.options?.length) {
        issues.push(issue(`${path}.options`, "Choice fields require options"));
      }
      if (!choiceFieldTypes.has(field.type) && field.options?.length) {
        issues.push(
          issue(`${path}.options`, "This field type cannot have options")
        );
      }
      if (field.type === "entity_reference" && !field.entityType) {
        issues.push(
          issue(
            `${path}.entityType`,
            "Entity references require an entity type"
          )
        );
      }
      if (field.type !== "entity_reference" && field.entityType) {
        issues.push(
          issue(
            `${path}.entityType`,
            "Only entity references may set entityType"
          )
        );
      }
      if (nonAnswerFieldTypes.has(field.type) && field.required) {
        issues.push(
          issue(`${path}.required`, "Display fields cannot be required")
        );
      }
      if (
        (field.searchable || field.reportable) &&
        !searchableFieldTypes.has(field.type)
      ) {
        issues.push(
          issue(
            path,
            "Only bounded scalar fields can be searchable or reportable"
          )
        );
      }
    });
  });

  if (fieldCount > 200) {
    issues.push(
      issue("pages", "A form version may contain at most 200 fields")
    );
  }

  const calculations = content.calculations ?? [];
  const calculationById = new Map<string, FormCalculation>();
  const targetFieldIds = new Set<string>();
  const calculationGraph = new Map<string, Set<string>>();
  calculations.forEach((calculation, calculationIndex) => {
    const path = `calculations.${calculationIndex}`;
    if (calculationById.has(calculation.id)) {
      issues.push(issue(`${path}.id`, "Calculation IDs must be unique"));
    }
    calculationById.set(calculation.id, calculation);
    if (targetFieldIds.has(calculation.targetFieldId)) {
      issues.push(
        issue(
          `${path}.targetFieldId`,
          "A field may be the target of only one calculation"
        )
      );
    }
    targetFieldIds.add(calculation.targetFieldId);
  });
  calculations.forEach((calculation, calculationIndex) => {
    const path = `calculations.${calculationIndex}`;
    const target = fieldById.get(calculation.targetFieldId);
    if (!target || target.type !== "number") {
      issues.push(
        issue(
          `${path}.targetFieldId`,
          "Calculation targets must be number fields"
        )
      );
    }
    const requiredOperandCount =
      calculation.operator === "subtract" || calculation.operator === "divide"
        ? 2
        : calculation.operator === "multiply"
          ? 2
          : 1;
    if (
      (calculation.operator === "subtract" ||
        calculation.operator === "divide") &&
      calculation.operands.length !== requiredOperandCount
    ) {
      issues.push(
        issue(`${path}.operands`, `${calculation.operator} requires 2 operands`)
      );
    } else if (calculation.operands.length < requiredOperandCount) {
      issues.push(
        issue(
          `${path}.operands`,
          `${calculation.operator} requires at least ${requiredOperandCount} operands`
        )
      );
    }
    for (const operand of calculation.operands) {
      if (operand.type === "constant") continue;
      if (operand.type === "field") {
        const source = fieldById.get(operand.fieldId);
        if (!source || !["number", "rating"].includes(source.type)) {
          issues.push(
            issue(
              `${path}.operands`,
              `Unknown numeric source field: ${operand.fieldId}`
            )
          );
        } else if (targetFieldIds.has(operand.fieldId)) {
          issues.push(
            issue(
              `${path}.operands`,
              "Calculated fields must be referenced by calculation ID"
            )
          );
        }
        continue;
      }
      if (!calculationById.has(operand.calculationId)) {
        issues.push(
          issue(
            `${path}.operands`,
            `Unknown calculation: ${operand.calculationId}`
          )
        );
      }
      const dependencies = calculationGraph.get(calculation.id) ?? new Set();
      dependencies.add(operand.calculationId);
      calculationGraph.set(calculation.id, dependencies);
    }
  });
  if (findCycle(calculationGraph)) {
    issues.push(issue("calculations", "Calculations cannot contain cycles"));
  }

  const dependencyGraph = new Map<string, Set<string>>();
  const ruleIds = new Set<string>();
  const ruleOrders = new Set<number>();
  content.logic.forEach((rule, ruleIndex) => {
    const path = `logic.${ruleIndex}`;
    if (ruleIds.has(rule.id)) {
      issues.push(issue(`${path}.id`, "Rule IDs must be unique"));
    }
    ruleIds.add(rule.id);
    if (ruleOrders.has(rule.order)) {
      issues.push(issue(`${path}.order`, "Rule order values must be unique"));
    }
    ruleOrders.add(rule.order);

    for (const condition of rule.when.conditions) {
      const sourceField = fieldById.get(condition.fieldId);
      if (!sourceField || nonAnswerFieldTypes.has(sourceField.type)) {
        issues.push(
          issue(`${path}.when`, `Unknown answer field: ${condition.fieldId}`)
        );
      }
      if (!sourceField || nonAnswerFieldTypes.has(sourceField.type)) continue;

      const allowedOperators: FormLogicOperator[] =
        sourceField.type === "multiple_choice"
          ? ["in", "not_in", "empty", "not_empty"]
          : sourceField.type === "number" || sourceField.type === "rating"
            ? formLogicOperators.filter(
                operator => operator !== "in" && operator !== "not_in"
              )
            : sourceField.type === "single_choice" ||
                sourceField.type === "entity_reference"
              ? ["equals", "not_equals", "in", "not_in", "empty", "not_empty"]
              : ["equals", "not_equals", "empty", "not_empty"];
      if (!allowedOperators.includes(condition.operator)) {
        issues.push(
          issue(
            `${path}.when`,
            `${condition.operator} is not supported for ${sourceField.type}`
          )
        );
        continue;
      }

      if (valuelessLogicOperators.has(condition.operator)) {
        if (condition.value !== undefined) {
          issues.push(
            issue(
              `${path}.when`,
              `${condition.operator} cannot include a comparison value`
            )
          );
        }
        continue;
      }
      if (condition.value === undefined) {
        issues.push(
          issue(
            `${path}.when`,
            `${condition.operator} requires a comparison value`
          )
        );
        continue;
      }

      if (condition.operator === "in" || condition.operator === "not_in") {
        const values = condition.value;
        if (
          !Array.isArray(values) ||
          values.length === 0 ||
          values.some(value => !value.trim())
        ) {
          issues.push(
            issue(
              `${path}.when`,
              `${condition.operator} requires one or more string values`
            )
          );
        } else if (
          sourceField.options?.length &&
          values.some(
            value => !sourceField.options?.some(option => option.id === value)
          )
        ) {
          issues.push(
            issue(`${path}.when`, "Condition contains an unknown option value")
          );
        }
        continue;
      }

      const value = condition.value;
      if (
        numericLogicOperators.has(condition.operator) ||
        sourceField.type === "number" ||
        sourceField.type === "rating"
      ) {
        if (typeof value !== "number" || !Number.isFinite(value)) {
          issues.push(
            issue(`${path}.when`, "Numeric fields require a numeric value")
          );
        }
      } else if (
        sourceField.type === "yes_no" ||
        sourceField.type === "consent"
      ) {
        if (typeof value !== "boolean") {
          issues.push(
            issue(`${path}.when`, "Boolean fields require a boolean value")
          );
        }
      } else if (typeof value !== "string" || !value.trim()) {
        issues.push(
          issue(`${path}.when`, "Text fields require a non-empty string value")
        );
      } else if (
        sourceField.options?.length &&
        !sourceField.options.some(option => option.id === value)
      ) {
        issues.push(
          issue(`${path}.when`, "Condition contains an unknown option value")
        );
      }
    }

    if (rule.action.type === "skip_to_page") {
      const targetIndex = pageIndexById.get(rule.action.targetPageId);
      if (targetIndex === undefined) {
        issues.push(
          issue(
            `${path}.action`,
            `Unknown target page: ${rule.action.targetPageId}`
          )
        );
      } else {
        const sourceIndexes = rule.when.conditions
          .map(condition => fieldPageIndex.get(condition.fieldId))
          .filter((value): value is number => value !== undefined);
        if (sourceIndexes.some(sourceIndex => targetIndex <= sourceIndex)) {
          issues.push(
            issue(
              `${path}.action`,
              "Page skips must move forward and cannot cycle"
            )
          );
        }
      }
      return;
    }

    const targetField = fieldById.get(rule.action.targetFieldId);
    if (!targetField || nonAnswerFieldTypes.has(targetField.type)) {
      issues.push(
        issue(
          `${path}.action`,
          `Unknown answer field: ${rule.action.targetFieldId}`
        )
      );
      return;
    }
    for (const condition of rule.when.conditions) {
      const edges = dependencyGraph.get(condition.fieldId) ?? new Set<string>();
      edges.add(rule.action.targetFieldId);
      dependencyGraph.set(condition.fieldId, edges);
    }
  });

  if (findCycle(dependencyGraph)) {
    issues.push(
      issue("logic", "Conditional field rules cannot contain cycles")
    );
  }

  return { ok: issues.length === 0, content, issues };
}

function isEmpty(value: unknown) {
  return (
    value === undefined ||
    value === null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  );
}

function compareCondition(value: unknown, condition: FormLogicCondition) {
  switch (condition.operator) {
    case "empty":
      return isEmpty(value);
    case "not_empty":
      return !isEmpty(value);
    case "equals":
      return value === condition.value;
    case "not_equals":
      return value !== condition.value;
    case "in": {
      const choices = Array.isArray(condition.value)
        ? condition.value
        : [condition.value];
      return Array.isArray(value)
        ? value.some(item => choices.includes(item as never))
        : choices.includes(value as never);
    }
    case "not_in": {
      const choices = Array.isArray(condition.value)
        ? condition.value
        : [condition.value];
      return Array.isArray(value)
        ? value.every(item => !choices.includes(item as never))
        : !choices.includes(value as never);
    }
    case "greater_than":
      return typeof value === "number" && value > Number(condition.value);
    case "greater_than_or_equal":
      return typeof value === "number" && value >= Number(condition.value);
    case "less_than":
      return typeof value === "number" && value < Number(condition.value);
    case "less_than_or_equal":
      return typeof value === "number" && value <= Number(condition.value);
  }
}

export type FormLogicState = {
  hiddenFieldIds: Set<string>;
  requiredFieldIds: Set<string>;
  reachablePageIds: Set<string>;
  skipToPageId?: string;
};

type EvaluatedRules = Omit<FormLogicState, "reachablePageIds"> & {
  matchedSkipRules: FormLogicRule[];
};

function evaluateRules(
  content: FormVersionContent,
  answers: Record<string, unknown>,
  activeFieldIds?: Set<string>
): EvaluatedRules {
  const fields = content.pages.flatMap(page => page.fields);
  const hiddenFieldIds = new Set(
    content.logic.flatMap(rule =>
      rule.action.type === "show" ? [rule.action.targetFieldId] : []
    )
  );
  const hiddenByMatchedRule = new Set<string>();
  const requiredFieldIds = new Set(
    fields.filter(field => field.required).map(field => field.id)
  );
  const matchedSkipRules: FormLogicRule[] = [];
  let skipToPageId: string | undefined;

  const orderedRules = [...content.logic].sort(
    (left, right) => left.order - right.order || left.id.localeCompare(right.id)
  );
  for (const rule of orderedRules) {
    if (
      activeFieldIds &&
      rule.when.conditions.some(
        condition => !activeFieldIds.has(condition.fieldId)
      )
    ) {
      continue;
    }
    const results = rule.when.conditions.map(condition =>
      compareCondition(
        hiddenFieldIds.has(condition.fieldId)
          ? undefined
          : answers[condition.fieldId],
        condition
      )
    );
    const matched =
      rule.when.mode === "all" ? results.every(Boolean) : results.some(Boolean);
    if (!matched) continue;
    switch (rule.action.type) {
      case "show":
        if (!hiddenByMatchedRule.has(rule.action.targetFieldId)) {
          hiddenFieldIds.delete(rule.action.targetFieldId);
        }
        break;
      case "hide":
        hiddenFieldIds.add(rule.action.targetFieldId);
        hiddenByMatchedRule.add(rule.action.targetFieldId);
        requiredFieldIds.delete(rule.action.targetFieldId);
        break;
      case "require":
        if (!hiddenFieldIds.has(rule.action.targetFieldId)) {
          requiredFieldIds.add(rule.action.targetFieldId);
        }
        break;
      case "optional":
        requiredFieldIds.delete(rule.action.targetFieldId);
        break;
      case "skip_to_page":
        skipToPageId = rule.action.targetPageId;
        matchedSkipRules.push(rule);
        break;
    }
  }

  return {
    hiddenFieldIds,
    requiredFieldIds,
    skipToPageId,
    matchedSkipRules,
  };
}

function deriveReachablePageIds(
  content: FormVersionContent,
  answers: Record<string, unknown>
) {
  const pageIndexById = new Map(
    content.pages.map((page, pageIndex) => [page.id, pageIndex])
  );
  const fieldPageIndex = new Map(
    content.pages.flatMap((page, pageIndex) =>
      page.fields.map(field => [field.id, pageIndex] as const)
    )
  );
  const reachablePageIds = new Set<string>();
  let pageIndex = 0;

  while (pageIndex < content.pages.length) {
    reachablePageIds.add(content.pages[pageIndex].id);
    const activeFieldIds = new Set(
      content.pages.flatMap(page =>
        reachablePageIds.has(page.id) ? page.fields.map(field => field.id) : []
      )
    );
    const reachableAnswers = Object.fromEntries(
      Object.entries(answers).filter(([fieldId]) => activeFieldIds.has(fieldId))
    );
    const evaluated = evaluateRules(content, reachableAnswers, activeFieldIds);
    const skipRule = [...evaluated.matchedSkipRules].reverse().find(rule => {
      const sourcePageIndex = Math.max(
        ...rule.when.conditions.map(
          condition => fieldPageIndex.get(condition.fieldId) ?? -1
        )
      );
      return sourcePageIndex === pageIndex;
    });
    const targetIndex = skipRule
      ? pageIndexById.get(
          skipRule.action.type === "skip_to_page"
            ? skipRule.action.targetPageId
            : ""
        )
      : undefined;

    pageIndex =
      targetIndex !== undefined && targetIndex > pageIndex
        ? targetIndex
        : pageIndex + 1;
  }

  return reachablePageIds;
}

export function evaluateFormLogic(
  content: FormVersionContent,
  answers: Record<string, unknown>
): FormLogicState {
  const reachablePageIds = deriveReachablePageIds(content, answers);
  const activeFieldIds = new Set(
    content.pages.flatMap(page =>
      reachablePageIds.has(page.id) ? page.fields.map(field => field.id) : []
    )
  );
  const reachableAnswers = Object.fromEntries(
    Object.entries(answers).filter(([fieldId]) => activeFieldIds.has(fieldId))
  );
  const { matchedSkipRules: _matchedSkipRules, ...logic } = evaluateRules(
    content,
    reachableAnswers,
    activeFieldIds
  );

  return { ...logic, reachablePageIds };
}

export function getFormCalculationTargetIds(content: FormVersionContent) {
  return new Set((content.calculations ?? []).map(item => item.targetFieldId));
}

export type FormCalculationState = {
  answers: Record<string, unknown>;
  values: Record<string, number>;
  errors: Record<string, "cycle" | "invalid" | "division_by_zero">;
};

export function evaluateFormCalculations(
  content: FormVersionContent,
  input: Record<string, unknown>
): FormCalculationState {
  const calculations = content.calculations ?? [];
  const answers = { ...input };
  const values: Record<string, number> = {};
  const errors: FormCalculationState["errors"] = {};
  const byId = new Map(calculations.map(item => [item.id, item]));
  const visiting = new Set<string>();

  for (const targetId of Array.from(getFormCalculationTargetIds(content))) {
    delete answers[targetId];
  }

  const evaluate = (calculationId: string, depth = 0): number | undefined => {
    if (values[calculationId] !== undefined) return values[calculationId];
    const calculation = byId.get(calculationId);
    if (!calculation || depth > 50) return undefined;
    if (visiting.has(calculationId)) {
      errors[calculation.targetFieldId] = "cycle";
      return undefined;
    }
    visiting.add(calculationId);
    const operands = calculation.operands.map(operand => {
      if (operand.type === "constant") return operand.value;
      if (operand.type === "calculation") {
        return evaluate(operand.calculationId, depth + 1);
      }
      const value = answers[operand.fieldId];
      return typeof value === "number" && Number.isFinite(value)
        ? value
        : undefined;
    });
    visiting.delete(calculationId);
    if (operands.some(value => value === undefined)) {
      errors[calculation.targetFieldId] = "invalid";
      return undefined;
    }
    const numbers = operands as number[];
    let result: number;
    switch (calculation.operator) {
      case "sum":
        result = numbers.reduce((total, value) => total + value, 0);
        break;
      case "subtract":
        result = numbers[0] - numbers[1];
        break;
      case "multiply":
        result = numbers.reduce((total, value) => total * value, 1);
        break;
      case "divide":
        if (numbers[1] === 0) {
          errors[calculation.targetFieldId] = "division_by_zero";
          return undefined;
        }
        result = numbers[0] / numbers[1];
        break;
      case "minimum":
        result = Math.min(...numbers);
        break;
      case "maximum":
        result = Math.max(...numbers);
        break;
      case "average":
        result =
          numbers.reduce((total, value) => total + value, 0) / numbers.length;
        break;
    }
    if (!Number.isFinite(result)) {
      errors[calculation.targetFieldId] = "invalid";
      return undefined;
    }
    const rounded =
      calculation.precision === undefined
        ? result
        : Number(result.toFixed(calculation.precision));
    values[calculationId] = rounded;
    answers[calculation.targetFieldId] = rounded;
    return rounded;
  };

  calculations.forEach(item => evaluate(item.id));
  return { answers, values, errors };
}

function normalizeAnswer(field: FormField, value: unknown) {
  if (isEmpty(value)) return undefined;
  if (field.type === "number" || field.type === "rating") {
    const numberValue = typeof value === "number" ? value : Number(value);
    return Number.isFinite(numberValue) ? numberValue : value;
  }
  if (field.type === "yes_no" || field.type === "consent") {
    if (typeof value === "boolean") return value;
    if (value === "true") return true;
    if (value === "false") return false;
  }
  if (field.type === "multiple_choice") {
    return Array.isArray(value)
      ? value.filter(item => typeof item === "string")
      : value;
  }
  return typeof value === "string" ? value.trim() : value;
}

const validationMessageFactories: Record<
  FormLocale,
  Record<
    FormValidationMessageKey,
    (params: Record<string, string | number>) => string
  >
> = {
  en: {
    required: value => `${value.label} is required`,
    text: value => `${value.label} must be text`,
    min_length: value =>
      `${value.label} must contain at least ${value.min} characters`,
    max_length: value =>
      `${value.label} must contain at most ${value.max} characters`,
    email: value => `${value.label} must be a valid email address`,
    phone: value => `${value.label} must be a valid phone number`,
    date: value => `${value.label} must be a valid YYYY-MM-DD date`,
    time: value => `${value.label} must use 24-hour HH:MM time`,
    number: value => `${value.label} must be a number`,
    min: value => `${value.label} must be at least ${value.min}`,
    max: value => `${value.label} must be at most ${value.max}`,
    yes_no: value => `${value.label} must be yes or no`,
    consent: value => `${value.label} must be accepted`,
    choice: value => `${value.label} contains an unavailable choice`,
    choice_list: value => `${value.label} must be a list of choices`,
    min_selections: value =>
      `${value.label} requires at least ${value.min} choices`,
    max_selections: value =>
      `${value.label} allows at most ${value.max} choices`,
    calculation: value => `${value.label} could not be calculated`,
  },
  ar: {
    required: value => `${value.label} مطلوب`,
    text: value => `${value.label} يجب أن يكون نصاً`,
    min_length: value => `${value.label} يجب ألا يقل عن ${value.min} أحرف`,
    max_length: value => `${value.label} يجب ألا يزيد عن ${value.max} أحرف`,
    email: value => `${value.label} يجب أن يكون بريداً إلكترونياً صالحاً`,
    phone: value => `${value.label} يجب أن يكون رقم هاتف صالحاً`,
    date: value => `${value.label} يجب أن يكون تاريخاً صالحاً بصيغة YYYY-MM-DD`,
    time: value => `${value.label} يجب أن يستخدم صيغة 24 ساعة HH:MM`,
    number: value => `${value.label} يجب أن يكون رقماً`,
    min: value => `${value.label} يجب ألا يقل عن ${value.min}`,
    max: value => `${value.label} يجب ألا يزيد عن ${value.max}`,
    yes_no: value => `${value.label} يجب أن يكون نعم أو لا`,
    consent: value => `${value.label} يجب قبوله`,
    choice: value => `${value.label} يحتوي على اختيار غير متاح`,
    choice_list: value => `${value.label} يجب أن يكون قائمة اختيارات`,
    min_selections: value =>
      `${value.label} يتطلب ${value.min} اختيارات على الأقل`,
    max_selections: value =>
      `${value.label} يسمح بحد أقصى ${value.max} اختيارات`,
    calculation: value => `تعذر حساب ${value.label}`,
  },
  tr: {
    required: value => `${value.label} zorunludur`,
    text: value => `${value.label} metin olmalıdır`,
    min_length: value =>
      `${value.label} en az ${value.min} karakter içermelidir`,
    max_length: value =>
      `${value.label} en fazla ${value.max} karakter içermelidir`,
    email: value => `${value.label} geçerli bir e-posta adresi olmalıdır`,
    phone: value => `${value.label} geçerli bir telefon numarası olmalıdır`,
    date: value =>
      `${value.label} YYYY-MM-DD biçiminde geçerli bir tarih olmalıdır`,
    time: value => `${value.label} 24 saatlik HH:MM biçimini kullanmalıdır`,
    number: value => `${value.label} sayı olmalıdır`,
    min: value => `${value.label} en az ${value.min} olmalıdır`,
    max: value => `${value.label} en fazla ${value.max} olmalıdır`,
    yes_no: value => `${value.label} evet veya hayır olmalıdır`,
    consent: value => `${value.label} kabul edilmelidir`,
    choice: value => `${value.label} kullanılamayan bir seçim içeriyor`,
    choice_list: value => `${value.label} bir seçim listesi olmalıdır`,
    min_selections: value =>
      `${value.label} en az ${value.min} seçim gerektirir`,
    max_selections: value =>
      `${value.label} en fazla ${value.max} seçime izin verir`,
    calculation: value => `${value.label} hesaplanamadı`,
  },
};

export function formatFormValidationMessage(
  message: FormValidationMessage,
  locale: FormLocale
) {
  return validationMessageFactories[locale][message.key](message.params);
}

function validationMessage(
  key: FormValidationMessageKey,
  label: string,
  params: Record<string, string | number> = {}
): FormValidationMessage {
  return { key, params: { label, ...params } };
}

function validateAnswer(field: FormField, value: unknown, locale: FormLocale) {
  const errors: FormValidationMessage[] = [];
  const validation = field.validation ?? {};
  const label = getLocalizedText(field.label, locale);
  const stringValue = typeof value === "string" ? value : undefined;

  if (
    [
      "short_text",
      "long_text",
      "email",
      "phone",
      "date",
      "time",
      "single_choice",
      "entity_reference",
    ].includes(field.type) &&
    stringValue === undefined
  ) {
    errors.push(validationMessage("text", label));
    return errors;
  }
  if (
    stringValue !== undefined &&
    validation.minLength !== undefined &&
    stringValue.length < validation.minLength
  ) {
    errors.push(
      validationMessage("min_length", label, { min: validation.minLength })
    );
  }
  if (
    stringValue !== undefined &&
    validation.maxLength !== undefined &&
    stringValue.length > validation.maxLength
  ) {
    errors.push(
      validationMessage("max_length", label, { max: validation.maxLength })
    );
  }
  if (
    field.type === "email" &&
    stringValue !== undefined &&
    !z.string().email().safeParse(stringValue).success
  ) {
    errors.push(validationMessage("email", label));
  }
  if (
    field.type === "phone" &&
    stringValue !== undefined &&
    !/^\+?[0-9 ()-]{6,30}$/.test(stringValue)
  ) {
    errors.push(validationMessage("phone", label));
  }
  if (field.type === "date" && stringValue !== undefined) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(stringValue);
    const year = Number(match?.[1]);
    const month = Number(match?.[2]);
    const day = Number(match?.[3]);
    const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const daysInMonth = [
      31,
      leapYear ? 29 : 28,
      31,
      30,
      31,
      30,
      31,
      31,
      30,
      31,
      30,
      31,
    ];
    if (
      !match ||
      year < 1 ||
      month < 1 ||
      month > 12 ||
      day < 1 ||
      day > daysInMonth[month - 1]
    ) {
      errors.push(validationMessage("date", label));
    }
  }
  if (
    field.type === "time" &&
    stringValue !== undefined &&
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(stringValue)
  ) {
    errors.push(validationMessage("time", label));
  }
  if (field.type === "number" || field.type === "rating") {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      errors.push(validationMessage("number", label));
    } else {
      if (validation.min !== undefined && value < validation.min) {
        errors.push(validationMessage("min", label, { min: validation.min }));
      }
      if (validation.max !== undefined && value > validation.max) {
        errors.push(validationMessage("max", label, { max: validation.max }));
      }
    }
  }
  if (field.type === "yes_no" && typeof value !== "boolean") {
    errors.push(validationMessage("yes_no", label));
  }
  if (field.type === "consent" && value !== true) {
    errors.push(validationMessage("consent", label));
  }
  if (field.type === "single_choice" && stringValue !== undefined) {
    if (!field.options?.some(option => option.id === stringValue)) {
      errors.push(validationMessage("choice", label));
    }
  }
  if (field.type === "multiple_choice") {
    if (!Array.isArray(value)) {
      errors.push(validationMessage("choice_list", label));
    } else {
      const allowed = new Set(field.options?.map(option => option.id) ?? []);
      if (value.some(item => typeof item !== "string" || !allowed.has(item))) {
        errors.push(validationMessage("choice", label));
      }
      if (
        validation.minSelections !== undefined &&
        value.length < validation.minSelections
      ) {
        errors.push(
          validationMessage("min_selections", label, {
            min: validation.minSelections,
          })
        );
      }
      if (
        validation.maxSelections !== undefined &&
        value.length > validation.maxSelections
      ) {
        errors.push(
          validationMessage("max_selections", label, {
            max: validation.maxSelections,
          })
        );
      }
    }
  }
  return errors;
}

export function normalizeAndValidateFormAnswers(
  content: FormVersionContent,
  input: unknown,
  locale: FormLocale = content.defaultLanguage
): {
  ok: boolean;
  answers: Record<string, unknown>;
  errors: Record<string, string[]>;
  errorDetails: Record<string, FormValidationMessage[]>;
  hiddenFieldIds: string[];
} {
  const rawAnswers =
    input && typeof input === "object" && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {};
  const answerFields = content.pages
    .flatMap(page => page.fields)
    .filter(field => !nonAnswerFieldTypes.has(field.type));
  const calculatedTargetIds = getFormCalculationTargetIds(content);
  const normalizedInput = Object.fromEntries(
    answerFields.flatMap(field => {
      if (calculatedTargetIds.has(field.id)) return [];
      const value = normalizeAnswer(field, rawAnswers[field.id]);
      return value === undefined ? [] : [[field.id, value]];
    })
  );
  const calculationState = evaluateFormCalculations(content, normalizedInput);
  const normalized = calculationState.answers;
  const logic = evaluateFormLogic(content, normalized);
  const reachableFieldIds = new Set(
    content.pages.flatMap(page =>
      logic.reachablePageIds.has(page.id)
        ? page.fields.map(field => field.id)
        : []
    )
  );
  const answers = Object.fromEntries(
    Object.entries(normalized).filter(
      ([fieldId]) =>
        reachableFieldIds.has(fieldId) && !logic.hiddenFieldIds.has(fieldId)
    )
  );
  const errors: Record<string, string[]> = {};
  const errorDetails: Record<string, FormValidationMessage[]> = {};

  for (const field of answerFields) {
    if (
      !reachableFieldIds.has(field.id) ||
      logic.hiddenFieldIds.has(field.id)
    ) {
      continue;
    }
    const value = answers[field.id];
    if (calculationState.errors[field.id]) {
      const details = [
        validationMessage("calculation", getLocalizedText(field.label, locale)),
      ];
      errorDetails[field.id] = details;
      errors[field.id] = details.map(item =>
        formatFormValidationMessage(item, locale)
      );
      continue;
    }
    if (logic.requiredFieldIds.has(field.id) && isEmpty(value)) {
      const details = [
        validationMessage("required", getLocalizedText(field.label, locale)),
      ];
      errorDetails[field.id] = details;
      errors[field.id] = details.map(item =>
        formatFormValidationMessage(item, locale)
      );
      continue;
    }
    if (isEmpty(value)) continue;
    const fieldErrors = validateAnswer(field, value, locale);
    if (fieldErrors.length) {
      errorDetails[field.id] = fieldErrors;
      errors[field.id] = fieldErrors.map(item =>
        formatFormValidationMessage(item, locale)
      );
    }
  }

  return {
    ok: Object.keys(errors).length === 0,
    answers,
    errors,
    errorDetails,
    hiddenFieldIds: Array.from(logic.hiddenFieldIds),
  };
}

const restrictedOfflineClasses = new Set<FormDataClass>([
  "government_id",
  "payment",
  "health",
  "credential",
  "file",
  "signature",
]);

export function getOfflineEligibility(content: FormVersionContent) {
  const restrictedFields = content.pages
    .flatMap(page => page.fields)
    .filter(field =>
      restrictedOfflineClasses.has(field.dataClass ?? "standard")
    )
    .map(field => field.id);
  return {
    eligible: restrictedFields.length === 0,
    restrictedFields,
  };
}

export function getLocalizedText(value: LocalizedText, locale: FormLocale) {
  return value[locale] || value.en;
}
