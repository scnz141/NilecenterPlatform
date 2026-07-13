import type {
  FormDataClass,
  FormSubmission,
  FormVersionContent,
} from "../shared/nileForms.js";

export type NileFormsAnswerProjectionMode =
  | "projection"
  | "export"
  | "index"
  | "audit"
  | "outbox"
  | "log";

const sensitiveDataClasses = new Set<FormDataClass>([
  "government_id",
  "payment",
  "health",
  "credential",
  "file",
  "signature",
]);

function isSensitive(dataClass: FormDataClass | undefined) {
  return sensitiveDataClasses.has(dataClass ?? "standard");
}

function fieldAllowed(
  field: FormVersionContent["pages"][number]["fields"][number],
  mode: NileFormsAnswerProjectionMode,
  canReadSensitive: boolean
) {
  if (isSensitive(field.dataClass)) {
    if (["index", "audit", "outbox", "log"].includes(mode)) return false;
    if (!canReadSensitive) return false;
  }
  if (mode === "export") return field.reportable === true;
  if (mode === "index") return field.searchable === true;
  return true;
}

export function projectableNileFormFieldIds(
  content: FormVersionContent,
  mode: NileFormsAnswerProjectionMode,
  canReadSensitive: boolean
) {
  return content.pages.flatMap(page =>
    page.fields
      .filter(field => fieldAllowed(field, mode, canReadSensitive))
      .map(field => field.id)
  );
}

export function projectNileFormAnswers(
  content: FormVersionContent,
  answers: Record<string, unknown>,
  options: {
    mode: NileFormsAnswerProjectionMode;
    canReadSensitive: boolean;
  }
) {
  const allowed = new Set(
    projectableNileFormFieldIds(content, options.mode, options.canReadSensitive)
  );
  return Object.fromEntries(
    Object.entries(answers)
      .filter(([fieldId]) => allowed.has(fieldId))
      .map(([fieldId, value]) => [fieldId, structuredClone(value)])
  );
}

export function projectNileFormSubmission(
  submission: FormSubmission,
  content: FormVersionContent,
  canReadSensitive: boolean
) {
  return {
    ...structuredClone(submission),
    answers: projectNileFormAnswers(content, submission.answers, {
      mode: "projection",
      canReadSensitive,
    }),
  };
}

export function isSensitiveNileFormDataClass(
  dataClass: FormDataClass | undefined
) {
  return isSensitive(dataClass);
}
