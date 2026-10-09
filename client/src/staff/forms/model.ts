import type {
  FormField,
  FormFieldType,
  FormLocale,
  FormVersionContent,
  LocalizedText,
} from "@shared/nileForms";
import type { Role } from "@/lib/platformData";
import type { StaffLocale } from "../i18n";

/** Question types offered in the builder, grouped as they appear in the menu. */
export const FIELD_GROUPS: Array<{ key: "text" | "choice" | "value" | "layout"; types: FormFieldType[] }> = [
  { key: "text", types: ["short_text", "long_text", "email", "phone"] },
  { key: "choice", types: ["single_choice", "multiple_choice", "yes_no", "consent"] },
  { key: "value", types: ["number", "date", "time", "rating"] },
  { key: "layout", types: ["heading", "instructions"] },
];

export const CHOICE_TYPES = new Set<FormFieldType>(["single_choice", "multiple_choice"]);
export const DISPLAY_TYPES = new Set<FormFieldType>(["heading", "instructions"]);

/** Roles that own forms (Registrar/SSA, HOD, Branch Admin/VM, Super Admin). */
export function canManageForms(role: Role | null | undefined) {
  return role === "registrar" || role === "headofdepartment" || role === "branchadmin" || role === "superadmin";
}

export function uid(prefix: string) {
  const random = globalThis.crypto?.randomUUID?.().replaceAll("-", "").slice(0, 10) ?? Math.random().toString(36).slice(2, 12);
  return `${prefix}_${random}`;
}

/** Stable machine key from a title: "Free trial enquiry" -> "free_trial_enquiry". */
export function toKey(title: string) {
  const key = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
  return key || "form";
}

export function toSlug(title: string) {
  return toKey(title).replaceAll("_", "-").slice(0, 60);
}

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function text(value: LocalizedText | undefined, locale: FormLocale) {
  if (!value) return "";
  return (locale === "ar" ? value.ar : locale === "tr" ? value.tr : value.en) || value.en || value.ar || "";
}

export function newField(type: FormFieldType, labels: { en: string; ar: string }): FormField {
  const field: FormField = {
    id: uid("field"),
    type,
    label: { en: labels.en, ar: labels.ar },
    required: type === "consent",
  };
  if (CHOICE_TYPES.has(type)) {
    field.options = [
      { id: uid("opt"), label: { en: "Option 1", ar: "الخيار 1" } },
      { id: uid("opt"), label: { en: "Option 2", ar: "الخيار 2" } },
    ];
  }
  return field;
}

export function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (to < 0 || to >= items.length || from === to) return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/** Field ids referenced by conditional rules or calculations. */
export function fieldsInUse(content: FormVersionContent): Set<string> {
  const used = new Set<string>();
  for (const rule of content.logic) {
    rule.when.conditions.forEach(condition => used.add(condition.fieldId));
    if ("targetFieldId" in rule.action) used.add(rule.action.targetFieldId);
  }
  for (const calculation of content.calculations ?? []) {
    used.add(calculation.targetFieldId);
    calculation.operands.forEach(operand => operand.type === "field" && used.add(operand.fieldId));
  }
  return used;
}

export type ContentProblem = "problemEmpty" | "problemLabel" | "problemArabic" | "problemOptions";

export function contentProblems(content: FormVersionContent): ContentProblem[] {
  const fields = content.pages.flatMap(page => page.fields);
  const problems = new Set<ContentProblem>();
  if (!fields.some(field => !DISPLAY_TYPES.has(field.type))) problems.add("problemEmpty");
  for (const field of fields) {
    if (!field.label.en.trim()) problems.add("problemLabel");
    if (!field.label.ar.trim()) problems.add("problemArabic");
    if (CHOICE_TYPES.has(field.type) && (field.options?.length ?? 0) < 1) problems.add("problemOptions");
    if (field.options?.some(option => !option.label.en.trim())) problems.add("problemLabel");
    if (field.options?.some(option => !option.label.ar.trim())) problems.add("problemArabic");
  }
  if (!content.title.en.trim()) problems.add("problemLabel");
  if (!content.title.ar.trim()) problems.add("problemArabic");
  return Array.from(problems);
}

/**
 * Forms that offer Turkish need Turkish text everywhere. Until someone
 * translates a label, it carries the English text.
 */
export function withTurkishFallback(content: FormVersionContent): FormVersionContent {
  if (!content.languages.includes("tr")) return content;
  const fill = <T extends LocalizedText | undefined>(value: T): T =>
    value && !value.tr?.trim() && value.en.trim() ? ({ ...value, tr: value.en } as T) : value;
  return {
    ...content,
    title: fill(content.title),
    description: fill(content.description),
    submitLabel: fill(content.submitLabel),
    confirmationMessage: fill(content.confirmationMessage),
    pages: content.pages.map(page => ({
      ...page,
      title: fill(page.title),
      description: fill(page.description),
      fields: page.fields.map(field => ({
        ...field,
        label: fill(field.label),
        description: fill(field.description),
        options: field.options?.map(option => ({ ...option, label: fill(option.label) })),
      })),
    })),
  };
}

/** A readable answer for review screens and exports. */
export function answerText(
  field: FormField,
  value: unknown,
  locale: FormLocale,
  words: { yes: string; no: string; agreed: string }
): string {
  if (value === undefined || value === null || value === "") return "";
  if (Array.isArray(value)) {
    return value
      .map(item => text(field.options?.find(option => option.id === item)?.label, locale) || String(item))
      .join(", ");
  }
  if (field.type === "single_choice") {
    return text(field.options?.find(option => option.id === value)?.label, locale) || String(value);
  }
  if (field.type === "yes_no") return value === true || value === "yes" ? words.yes : words.no;
  if (field.type === "consent") return value === true ? words.agreed : "";
  return String(value);
}

/** Pick likely contact answers by field type, then by label words. */
export function contactFromAnswers(
  fields: FormField[],
  answers: Record<string, unknown>
): { firstName: string; lastName: string; email: string; phone: string } {
  const value = (field?: FormField) => (field ? String(answers[field.id] ?? "").trim() : "");
  const byLabel = (pattern: RegExp) =>
    fields.find(field => field.type === "short_text" && pattern.test(field.label.en) && value(field));
  const email = value(fields.find(field => field.type === "email" && value(field)));
  const phone = value(fields.find(field => field.type === "phone" && value(field)));
  const first = value(byLabel(/first|given/i));
  const last = value(byLabel(/last|family|surname/i));
  if (first || last) return { firstName: first, lastName: last, email, phone };
  const full = value(byLabel(/name/i));
  const [firstName = "", ...rest] = full.split(/\s+/);
  return { firstName, lastName: rest.join(" "), email, phone };
}

/** Choice ids for EMS branches: "br:<uuid>" satisfies the form id rules. */
export const BRANCH_CHOICE_PREFIX = "br:";

export function branchChoices(branches: Array<{ id: string; name: string }>) {
  return branches.map(branch => ({
    id: `${BRANCH_CHOICE_PREFIX}${branch.id}`,
    label: { en: branch.name, ar: branch.name },
  }));
}

/** The EMS branch a response picked, if a branch choice question was answered. */
export function branchFromAnswers(fields: FormField[], answers: Record<string, unknown>) {
  for (const field of fields) {
    const value = answers[field.id];
    if (typeof value === "string" && value.startsWith(BRANCH_CHOICE_PREFIX)) {
      return value.slice(BRANCH_CHOICE_PREFIX.length);
    }
  }
  return null;
}

/**
 * Form content is written in English and Arabic (Turkish optional). Staff
 * using another app language read forms in English.
 */
export function formLocaleFor(locale: StaffLocale): FormLocale {
  return locale === "ar" || locale === "tr" ? locale : "en";
}
