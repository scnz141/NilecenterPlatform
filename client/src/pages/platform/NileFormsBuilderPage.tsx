import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Braces,
  Calculator,
  ChevronDown,
  ChevronRight,
  Eye,
  FilePlus2,
  Languages,
  ListPlus,
  Plus,
  Save,
  Send,
  Settings2,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { Link } from "wouter";

import NileFormRenderer from "@/components/forms/NileFormRenderer";
import PlatformShell from "@/components/platform/PlatformShell";
import {
  createFormDraftVersionRequest,
  fetchFormDefinition,
  updateFormDraftVersionRequest,
} from "@/lib/forms/api";
import {
  conditionOperatorsForField,
  conditionUsesNumericInput,
  conditionValueAsText,
  conditionValueFromInput,
  defaultConditionValue,
  defaultLogicConditionForField,
} from "@/lib/forms/logicEditor";
import { formsRoute } from "@/lib/forms/routes";
import type { Role } from "@/lib/platformData";
import {
  formCalculationOperators,
  formFieldTypes,
  validateFormVersionContent,
  type FormCalculation,
  type FormCalculationOperand,
  type FormField,
  type FormFieldType,
  type FormLogicCondition,
  type FormLogicOperator,
  type FormLogicRule,
  type FormLocale,
  type FormPage,
  type FormVersion,
  type FormVersionContent,
} from "@shared/nileForms";
import type {
  FormDefinitionBundle,
  FormResponderBundle,
} from "../../../../server/nileFormsService";

type InspectorTab =
  | "field"
  | "logic"
  | "calculations"
  | "language"
  | "validation";

const fieldTypeLabels: Record<FormFieldType, string> = {
  heading: "Heading",
  instructions: "Instructions",
  short_text: "Short text",
  long_text: "Long text",
  email: "Email",
  phone: "Phone",
  number: "Number",
  date: "Date",
  time: "Time",
  single_choice: "Single choice",
  multiple_choice: "Multiple choice",
  yes_no: "Yes / No",
  rating: "Rating",
  consent: "Consent",
  entity_reference: "Entity reference",
};

const formLocaleNames: Record<FormLocale, string> = {
  en: "English",
  ar: "Arabic",
  tr: "Turkish",
};

function createKey(prefix: string) {
  const random =
    globalThis.crypto?.randomUUID?.().replaceAll("-", "") ??
    `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 9)}`;
  return `${prefix}_${random}`;
}

function LogicConditionValue({
  field,
  condition,
  onChange,
}: {
  field: FormField | undefined;
  condition: FormLogicCondition;
  onChange(value: FormLogicCondition["value"]): void;
}) {
  if (["empty", "not_empty"].includes(condition.operator)) return null;
  const options = field?.options ?? [];

  if (
    options.length &&
    (condition.operator === "in" || condition.operator === "not_in")
  ) {
    return (
      <select
        multiple
        aria-label="Condition values"
        value={Array.isArray(condition.value) ? condition.value : []}
        onChange={event =>
          onChange(
            conditionValueFromInput(
              field,
              condition.operator,
              Array.from(
                event.currentTarget.selectedOptions,
                option => option.value
              )
            )
          )
        }
      >
        {options.map(option => (
          <option key={option.id} value={option.id}>
            {option.label.en}
          </option>
        ))}
      </select>
    );
  }

  if (options.length) {
    return (
      <select
        aria-label="Condition value"
        value={conditionValueAsText(condition.value)}
        onChange={event =>
          onChange(
            conditionValueFromInput(
              field,
              condition.operator,
              event.target.value
            )
          )
        }
      >
        {options.map(option => (
          <option key={option.id} value={option.id}>
            {option.label.en}
          </option>
        ))}
      </select>
    );
  }

  if (field?.type === "yes_no" || field?.type === "consent") {
    return (
      <select
        aria-label="Condition value"
        value={condition.value === false ? "false" : "true"}
        onChange={event =>
          onChange(
            conditionValueFromInput(
              field,
              condition.operator,
              event.target.value
            )
          )
        }
      >
        <option value="true">Yes</option>
        <option value="false">No</option>
      </select>
    );
  }

  return (
    <input
      type={
        conditionUsesNumericInput(field, condition.operator) ? "number" : "text"
      }
      step="any"
      aria-label={
        condition.operator === "in" || condition.operator === "not_in"
          ? "Condition values, comma separated"
          : "Condition value"
      }
      value={conditionValueAsText(condition.value)}
      onChange={event =>
        onChange(
          conditionValueFromInput(field, condition.operator, event.target.value)
        )
      }
    />
  );
}

function CalculationOperandEditor({
  calculationId,
  operand,
  fields,
  calculations,
  onChange,
  onRemove,
}: {
  calculationId: string;
  operand: FormCalculationOperand;
  fields: FormField[];
  calculations: FormCalculation[];
  onChange(value: FormCalculationOperand): void;
  onRemove(): void;
}) {
  const dependencyOptions = calculations.filter(
    item => item.id !== calculationId
  );
  const changeType = (type: FormCalculationOperand["type"]) => {
    if (type === "constant") {
      onChange({ type: "constant", value: 0 });
      return;
    }
    if (type === "calculation") {
      onChange({
        type: "calculation",
        calculationId: dependencyOptions[0]?.id ?? "",
      });
      return;
    }
    onChange({ type: "field", fieldId: fields[0]?.id ?? "" });
  };

  return (
    <div className="nile-form-rule-condition nile-form-calculation-operand">
      <select
        aria-label="Operand type"
        value={operand.type}
        onChange={event =>
          changeType(event.target.value as FormCalculationOperand["type"])
        }
      >
        <option value="field">Field</option>
        <option value="constant">Number</option>
        <option value="calculation" disabled={!dependencyOptions.length}>
          Calculation
        </option>
      </select>
      {operand.type === "field" ? (
        <select
          aria-label="Source field"
          value={operand.fieldId}
          onChange={event =>
            onChange({ type: "field", fieldId: event.target.value })
          }
        >
          {fields.map(field => (
            <option key={field.id} value={field.id}>
              {field.label.en}
            </option>
          ))}
        </select>
      ) : operand.type === "calculation" ? (
        <select
          aria-label="Source calculation"
          value={operand.calculationId}
          onChange={event =>
            onChange({
              type: "calculation",
              calculationId: event.target.value,
            })
          }
        >
          {dependencyOptions.map(item => (
            <option key={item.id} value={item.id}>
              {item.id}
            </option>
          ))}
        </select>
      ) : (
        <input
          aria-label="Constant value"
          type="number"
          step="any"
          value={operand.value}
          onChange={event =>
            onChange({ type: "constant", value: Number(event.target.value) })
          }
        />
      )}
      <button
        type="button"
        title="Remove operand"
        aria-label="Remove operand"
        onClick={onRemove}
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
}

function newField(type: FormFieldType): FormField {
  const label = fieldTypeLabels[type];
  const choiceOptions =
    type === "single_choice" || type === "multiple_choice"
      ? [
          {
            id: "option_1",
            label: { en: "Option 1", ar: "الخيار 1", tr: "Seçenek 1" },
          },
          {
            id: "option_2",
            label: { en: "Option 2", ar: "الخيار 2", tr: "Seçenek 2" },
          },
        ]
      : undefined;
  return {
    id: createKey("field"),
    type,
    label: { en: label, ar: label, tr: label },
    description: { en: "", ar: "", tr: "" },
    required: type === "consent",
    options: choiceOptions,
    validation:
      type === "rating"
        ? { min: 1, max: 5 }
        : type === "long_text"
          ? { maxLength: 3000 }
          : undefined,
    dataClass: "standard",
    entityType: type === "entity_reference" ? "branch" : undefined,
  };
}

function moveItem<T>(items: T[], index: number, direction: -1 | 1) {
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= items.length) return items;
  const next = [...items];
  [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
  return next;
}

function BuilderFieldPreview({ field }: { field: FormField }) {
  if (field.type === "heading" || field.type === "instructions") {
    return field.description?.en ? (
      <p className="nile-form-builder-content-preview">
        {field.description.en}
      </p>
    ) : null;
  }

  if (
    field.type === "single_choice" ||
    field.type === "multiple_choice" ||
    field.type === "entity_reference"
  ) {
    return (
      <div
        className="nile-form-builder-control-preview is-select"
        aria-hidden="true"
      >
        <span>
          {field.options?.[0]?.label.en ??
            (field.type === "entity_reference"
              ? "Select a scoped record"
              : "Choose an option")}
        </span>
        <ChevronDown size={14} />
      </div>
    );
  }

  if (field.type === "yes_no") {
    return (
      <div className="nile-form-builder-segment-preview" aria-hidden="true">
        <span>Yes</span>
        <span>No</span>
      </div>
    );
  }

  if (field.type === "rating") {
    return (
      <div className="nile-form-builder-rating-preview" aria-hidden="true">
        {Array.from(
          { length: Math.min(5, field.validation?.max ?? 5) },
          (_, index) => (
            <span key={index}>{index + 1}</span>
          )
        )}
      </div>
    );
  }

  if (field.type === "consent") {
    return (
      <div className="nile-form-builder-consent-preview" aria-hidden="true">
        <span />
        <small>Respondent acknowledgment</small>
      </div>
    );
  }

  const placeholder =
    field.type === "long_text"
      ? "Long answer"
      : field.type === "date"
        ? "YYYY-MM-DD"
        : field.type === "time"
          ? "HH:MM"
          : field.type === "email"
            ? "name@example.com"
            : field.type === "phone"
              ? "+20 10 0000 0000"
              : field.type === "number"
                ? "0"
                : "Short answer";

  return (
    <div
      className={`nile-form-builder-control-preview ${field.type === "long_text" ? "is-textarea" : ""}`}
      aria-hidden="true"
    >
      <span>{placeholder}</span>
    </div>
  );
}

export default function NileFormsBuilderPage({
  role,
  formId,
}: {
  role: Role;
  formId: string;
}) {
  const [bundle, setBundle] = useState<FormDefinitionBundle | null>(null);
  const [version, setVersion] = useState<FormVersion | null>(null);
  const [content, setContent] = useState<FormVersionContent | null>(null);
  const [pageId, setPageId] = useState("");
  const [fieldId, setFieldId] = useState("");
  const [addType, setAddType] = useState<FormFieldType>("short_text");
  const [tab, setTab] = useState<InspectorTab>("field");
  const [preview, setPreview] = useState(false);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setStatus("loading");
      setMessage("");
      const response = await fetchFormDefinition(formId);
      if (cancelled) return;
      if (!response.ok || !response.data) {
        setStatus("error");
        setMessage(response.error ?? "The form could not be loaded.");
        return;
      }
      let draft = response.data.versions.find(item => item.status === "draft");
      if (!draft) {
        const created = await createFormDraftVersionRequest(formId);
        if (cancelled) return;
        if (!created.ok || !created.data) {
          setStatus("error");
          setMessage(created.error ?? "A draft version could not be created.");
          return;
        }
        draft = created.data;
      }
      setBundle(response.data);
      setVersion(draft);
      setContent(structuredClone(draft.content));
      setPageId(draft.content.pages[0]?.id ?? "");
      setFieldId(draft.content.pages[0]?.fields[0]?.id ?? "");
      setStatus("ready");
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [formId]);

  const currentPageIndex =
    content?.pages.findIndex(page => page.id === pageId) ?? -1;
  const currentPage =
    content && currentPageIndex >= 0
      ? content.pages[currentPageIndex]
      : undefined;
  const selectedField = currentPage?.fields.find(field => field.id === fieldId);
  const validation = useMemo(
    () => (content ? validateFormVersionContent(content) : null),
    [content]
  );
  const answerFields =
    content?.pages
      .flatMap(page => page.fields)
      .filter(field => !["heading", "instructions"].includes(field.type)) ?? [];
  const numberFields = answerFields.filter(field =>
    ["number", "rating"].includes(field.type)
  );
  const calculationTargetIds = new Set(
    (content?.calculations ?? []).map(item => item.targetFieldId)
  );
  const calculationSourceFields = numberFields.filter(
    field => !calculationTargetIds.has(field.id)
  );

  const updateContent = (update: (draft: FormVersionContent) => void) => {
    if (!content) return;
    const next = structuredClone(content);
    update(next);
    setContent(next);
    setMessage("");
  };

  const updatePage = (update: (page: FormPage) => void) => {
    updateContent(draft => {
      const page = draft.pages.find(item => item.id === pageId);
      if (page) update(page);
    });
  };

  const updateField = (update: (field: FormField) => void) => {
    updatePage(page => {
      const field = page.fields.find(item => item.id === fieldId);
      if (field) update(field);
    });
  };

  const addField = () => {
    const field = newField(addType);
    updatePage(page => page.fields.push(field));
    setFieldId(field.id);
    setTab("field");
  };

  const removeField = (id: string) => {
    updateContent(draft => {
      const page = draft.pages.find(item => item.id === pageId);
      if (page) page.fields = page.fields.filter(field => field.id !== id);
      draft.logic = draft.logic.filter(
        rule =>
          !rule.when.conditions.some(condition => condition.fieldId === id) &&
          (rule.action.type === "skip_to_page" ||
            rule.action.targetFieldId !== id)
      );
      const removedCalculationIds = new Set(
        (draft.calculations ?? [])
          .filter(
            calculation =>
              calculation.targetFieldId === id ||
              calculation.operands.some(
                operand => operand.type === "field" && operand.fieldId === id
              )
          )
          .map(calculation => calculation.id)
      );
      let changed = true;
      while (changed) {
        changed = false;
        for (const calculation of draft.calculations ?? []) {
          if (
            !removedCalculationIds.has(calculation.id) &&
            calculation.operands.some(
              operand =>
                operand.type === "calculation" &&
                removedCalculationIds.has(operand.calculationId)
            )
          ) {
            removedCalculationIds.add(calculation.id);
            changed = true;
          }
        }
      }
      draft.calculations = (draft.calculations ?? []).filter(
        calculation => !removedCalculationIds.has(calculation.id)
      );
    });
    setFieldId(currentPage?.fields.find(field => field.id !== id)?.id ?? "");
  };

  const addPage = () => {
    if (!content) return;
    const page: FormPage = {
      id: createKey("page"),
      title: {
        en: `Page ${content.pages.length + 1}`,
        ar: `الصفحة ${content.pages.length + 1}`,
        tr: `Sayfa ${content.pages.length + 1}`,
      },
      fields: [],
    };
    updateContent(draft => draft.pages.push(page));
    setPageId(page.id);
    setFieldId("");
  };

  const addRule = () => {
    if (answerFields.length < 1) {
      setMessage("Add an answer field before creating logic.");
      return;
    }
    const source = answerFields[0];
    const target = answerFields[1] ?? answerFields[0];
    const condition = defaultLogicConditionForField(source);
    const rule: FormLogicRule = {
      id: createKey("rule"),
      order:
        Math.max(0, ...(content?.logic.map(item => item.order) ?? [])) + 10,
      when: {
        mode: "all",
        conditions: [condition],
      },
      action: { type: "show", targetFieldId: target.id },
    };
    updateContent(draft => draft.logic.push(rule));
    setTab("logic");
  };

  const addCalculation = () => {
    const numericFields = answerFields.filter(field =>
      ["number", "rating"].includes(field.type)
    );
    const usedTargets = new Set(
      (content?.calculations ?? []).map(item => item.targetFieldId)
    );
    const target = numericFields.find(
      field => field.type === "number" && !usedTargets.has(field.id)
    );
    const source = numericFields.find(field => field.id !== target?.id);
    if (!target || !source) {
      setMessage(
        "Add one unused number target and one numeric source before creating a calculation."
      );
      return;
    }
    const calculation: FormCalculation = {
      id: createKey("calculation"),
      targetFieldId: target.id,
      operator: "sum",
      operands: [{ type: "field", fieldId: source.id }],
      precision: 2,
    };
    updateContent(draft => {
      draft.calculations = [...(draft.calculations ?? []), calculation];
    });
    setTab("calculations");
  };

  const save = async () => {
    if (!version || !content) return;
    if (!validation?.ok) {
      setTab("validation");
      setMessage("Resolve validation issues before saving.");
      return;
    }
    setSaving(true);
    setMessage("");
    const response = await updateFormDraftVersionRequest(formId, version.id, {
      expectedRevision: version.revision,
      content,
    });
    setSaving(false);
    if (!response.ok || !response.data) {
      setMessage(response.error ?? "The draft could not be saved.");
      return;
    }
    setVersion(response.data);
    setMessage("Draft saved.");
  };

  if (status !== "ready" || !bundle || !version || !content || !currentPage) {
    return (
      <PlatformShell role={role} title="Form builder">
        <div className="nile-forms-page">
          <section
            className="nile-forms-state"
            role={status === "error" ? "alert" : undefined}
          >
            {status === "loading" ? (
              <span className="nile-forms-spinner" />
            ) : (
              <TriangleAlert size={24} />
            )}
            <strong>
              {status === "loading" ? "Loading builder" : "Builder unavailable"}
            </strong>
            {message ? <p>{message}</p> : null}
            {status === "error" ? (
              <>
                <p>
                  This form belongs to another owner or scope. Return to the
                  forms available to your active role.
                </p>
                <Link
                  href={formsRoute(role, "/manage")}
                  className="platform-secondary-button"
                >
                  <ArrowLeft size={15} /> Manage forms
                </Link>
              </>
            ) : null}
          </section>
        </div>
      </PlatformShell>
    );
  }

  const previewBundle: FormResponderBundle = {
    definition: bundle.definition,
    version: { ...version, content },
    publication: bundle.publications[0] ?? {
      id: "preview_publication",
      definitionId: bundle.definition.id,
      versionId: version.id,
      slug: "preview",
      audience: "authenticated",
      status: "open",
      allowMultiple: true,
      allowDrafts: false,
      offlineEligible: false,
      createdBy: bundle.definition.ownerUserId,
      createdAt: version.createdAt,
    },
    previousSubmissions: [],
    entityOptions: {},
  };

  return (
    <PlatformShell role={role} title="Form builder">
      <div className="nile-form-builder-page">
        <header className="nile-form-builder-toolbar">
          <div className="nile-form-builder-title">
            <Link
              href={formsRoute(role, "/manage")}
              className="nile-forms-icon-link"
              title="Back"
              aria-label="Back to forms"
            >
              <ArrowLeft size={17} />
            </Link>
            <div>
              <span>{bundle.definition.key}</span>
              <h1>{content.title.en}</h1>
            </div>
            <span className="nile-form-status is-draft">
              Draft v{version.versionNumber}
            </span>
          </div>
          <div className="nile-form-builder-actions">
            {message ? (
              <span className="nile-form-builder-message" role="status">
                {message}
              </span>
            ) : null}
            <button
              type="button"
              className={`platform-secondary-button ${preview ? "is-active" : ""}`}
              onClick={() => setPreview(value => !value)}
            >
              <Eye size={16} /> <span>{preview ? "Edit" : "Preview"}</span>
            </button>
            <button
              type="button"
              className="platform-primary-button"
              disabled={saving}
              onClick={save}
            >
              <Save size={16} /> <span>{saving ? "Saving" : "Save"}</span>
            </button>
            <Link
              href={formsRoute(role, `/manage/${formId}/publish`)}
              className="platform-secondary-button"
            >
              <Send size={16} /> <span>Publish</span>
            </Link>
          </div>
        </header>

        {preview ? (
          <section className="nile-form-builder-preview">
            <NileFormRenderer bundle={previewBundle} mode="preview" />
          </section>
        ) : (
          <section className="nile-form-builder-grid">
            <aside className="nile-form-page-rail" aria-label="Form pages">
              <header>
                <span>Pages</span>
                <button
                  type="button"
                  onClick={addPage}
                  title="Add page"
                  aria-label="Add page"
                >
                  <FilePlus2 size={16} />
                </button>
              </header>
              <ol>
                {content.pages.map((page, index) => (
                  <li key={page.id}>
                    <button
                      type="button"
                      className={page.id === pageId ? "is-active" : ""}
                      onClick={() => {
                        setPageId(page.id);
                        setFieldId(page.fields[0]?.id ?? "");
                      }}
                    >
                      <span>{index + 1}</span>
                      <strong>{page.title.en}</strong>
                      <small>{page.fields.length} fields</small>
                      <ChevronRight size={14} />
                    </button>
                  </li>
                ))}
              </ol>
            </aside>

            <section className="nile-form-canvas" aria-label="Form page editor">
              <div className="nile-form-canvas-document">
                <header className="nile-form-canvas-title">
                  <span className="nile-form-canvas-kicker">
                    Page {currentPageIndex + 1}
                  </span>
                  <label>
                    <span className="sr-only">Page title</span>
                    <input
                      value={currentPage.title.en}
                      onChange={event =>
                        updatePage(page => {
                          page.title.en = event.target.value;
                        })
                      }
                    />
                  </label>
                  <label>
                    <span className="sr-only">Page description</span>
                    <input
                      value={currentPage.description?.en ?? ""}
                      placeholder="Optional page description"
                      onChange={event =>
                        updatePage(page => {
                          page.description = page.description ?? {
                            en: "",
                            ar: "",
                            tr: "",
                          };
                          page.description.en = event.target.value;
                        })
                      }
                    />
                  </label>
                </header>

                <div className="nile-form-builder-fields">
                  {currentPage.fields.map((field, index) => (
                    <article
                      key={field.id}
                      className={`nile-form-builder-field ${field.id === fieldId ? "is-selected" : ""}`}
                      onClick={() => {
                        setFieldId(field.id);
                        setTab("field");
                      }}
                    >
                      <div className="nile-form-builder-field-head">
                        <button
                          type="button"
                          className="nile-form-builder-select"
                          aria-pressed={field.id === fieldId}
                          aria-label={`Edit ${field.label.en}`}
                          onClick={() => {
                            setFieldId(field.id);
                            setTab("field");
                          }}
                        >
                          <span className="nile-form-builder-field-copy">
                            <span>{fieldTypeLabels[field.type]}</span>
                            <strong>{field.label.en}</strong>
                            {field.description?.en ? (
                              <p>{field.description.en}</p>
                            ) : null}
                            {field.required ? <small>Required</small> : null}
                          </span>
                        </button>
                        <div className="nile-form-builder-field-actions">
                          <button
                            type="button"
                            disabled={index === 0}
                            onClick={event => {
                              event.stopPropagation();
                              updatePage(page => {
                                page.fields = moveItem(page.fields, index, -1);
                              });
                            }}
                            title="Move up"
                            aria-label={`Move ${field.label.en} up`}
                          >
                            <ArrowUp size={15} />
                          </button>
                          <button
                            type="button"
                            disabled={index === currentPage.fields.length - 1}
                            onClick={event => {
                              event.stopPropagation();
                              updatePage(page => {
                                page.fields = moveItem(page.fields, index, 1);
                              });
                            }}
                            title="Move down"
                            aria-label={`Move ${field.label.en} down`}
                          >
                            <ArrowDown size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={event => {
                              event.stopPropagation();
                              removeField(field.id);
                            }}
                            title="Delete field"
                            aria-label={`Delete ${field.label.en}`}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                      <BuilderFieldPreview field={field} />
                    </article>
                  ))}
                  {!currentPage.fields.length ? (
                    <div className="nile-form-builder-empty">
                      <ListPlus size={22} />
                      <strong>Add the first field</strong>
                    </div>
                  ) : null}
                </div>

                <footer className="nile-form-add-field">
                  <select
                    value={addType}
                    onChange={event =>
                      setAddType(event.target.value as FormFieldType)
                    }
                  >
                    {formFieldTypes.map(type => (
                      <option key={type} value={type}>
                        {fieldTypeLabels[type]}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="platform-secondary-button"
                    onClick={addField}
                  >
                    <Plus size={15} /> Add field
                  </button>
                </footer>
              </div>
            </section>

            <aside className="nile-form-inspector">
              <nav
                className="nile-form-inspector-tabs"
                aria-label="Builder settings"
              >
                {[
                  { id: "field" as const, label: "Field", icon: Settings2 },
                  { id: "logic" as const, label: "Rules", icon: Braces },
                  {
                    id: "calculations" as const,
                    label: "Calculate",
                    icon: Calculator,
                  },
                  {
                    id: "language" as const,
                    label: "Language",
                    icon: Languages,
                  },
                  {
                    id: "validation" as const,
                    label: "Check",
                    icon: TriangleAlert,
                  },
                ].map(item => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`nile-form-inspector-tab ${tab === item.id ? "is-active" : ""}`}
                      aria-pressed={tab === item.id}
                      onClick={() => setTab(item.id)}
                    >
                      <Icon size={15} /> {item.label}
                    </button>
                  );
                })}
              </nav>

              <div className="nile-form-inspector-body">
                {tab === "field" ? (
                  selectedField ? (
                    <div className="nile-form-inspector-section">
                      <header>
                        <span>{fieldTypeLabels[selectedField.type]}</span>
                        <strong>Field settings</strong>
                      </header>
                      <label>
                        English label
                        <input
                          value={selectedField.label.en}
                          onChange={event =>
                            updateField(field => {
                              field.label.en = event.target.value;
                            })
                          }
                        />
                      </label>
                      <label dir="rtl">
                        التسمية العربية
                        <input
                          value={selectedField.label.ar}
                          onChange={event =>
                            updateField(field => {
                              field.label.ar = event.target.value;
                            })
                          }
                        />
                      </label>
                      <label>
                        Turkish label
                        <input
                          value={selectedField.label.tr ?? ""}
                          onChange={event =>
                            updateField(field => {
                              field.label.tr = event.target.value;
                            })
                          }
                        />
                      </label>
                      <label>
                        English help text
                        <textarea
                          rows={3}
                          value={selectedField.description?.en ?? ""}
                          onChange={event =>
                            updateField(field => {
                              field.description = field.description ?? {
                                en: "",
                                ar: "",
                                tr: "",
                              };
                              field.description.en = event.target.value;
                            })
                          }
                        />
                      </label>
                      <label dir="rtl">
                        النص المساعد بالعربية
                        <textarea
                          rows={3}
                          value={selectedField.description?.ar ?? ""}
                          onChange={event =>
                            updateField(field => {
                              field.description = field.description ?? {
                                en: "",
                                ar: "",
                                tr: "",
                              };
                              field.description.ar = event.target.value;
                            })
                          }
                        />
                      </label>
                      <label>
                        Turkish help text
                        <textarea
                          rows={3}
                          value={selectedField.description?.tr ?? ""}
                          onChange={event =>
                            updateField(field => {
                              field.description = field.description ?? {
                                en: "",
                                ar: "",
                                tr: "",
                              };
                              field.description.tr = event.target.value;
                            })
                          }
                        />
                      </label>
                      {!["heading", "instructions"].includes(
                        selectedField.type
                      ) ? (
                        <div className="nile-form-toggle-list">
                          <label>
                            <input
                              type="checkbox"
                              checked={Boolean(selectedField.required)}
                              onChange={event =>
                                updateField(field => {
                                  field.required = event.target.checked;
                                })
                              }
                            />{" "}
                            Required
                          </label>
                          <label>
                            <input
                              type="checkbox"
                              checked={Boolean(selectedField.searchable)}
                              onChange={event =>
                                updateField(field => {
                                  field.searchable = event.target.checked;
                                })
                              }
                            />{" "}
                            Searchable
                          </label>
                          <label>
                            <input
                              type="checkbox"
                              checked={Boolean(selectedField.reportable)}
                              onChange={event =>
                                updateField(field => {
                                  field.reportable = event.target.checked;
                                })
                              }
                            />{" "}
                            Reportable
                          </label>
                        </div>
                      ) : null}
                      {selectedField.type === "entity_reference" ? (
                        <label>
                          Entity
                          <select
                            value={selectedField.entityType}
                            onChange={event =>
                              updateField(field => {
                                field.entityType = event.target
                                  .value as NonNullable<
                                  FormField["entityType"]
                                >;
                              })
                            }
                          >
                            <option value="branch">Branch</option>
                            <option value="department">Department</option>
                            <option value="course">Course</option>
                            <option value="class">Class</option>
                            <option value="attendance_record">
                              Attendance record
                            </option>
                          </select>
                        </label>
                      ) : null}
                      {selectedField.options ? (
                        <div className="nile-form-option-editor">
                          <strong>Options</strong>
                          {selectedField.options.map((option, index) => (
                            <div key={option.id}>
                              <input
                                aria-label={`Option ${index + 1} English`}
                                value={option.label.en}
                                onChange={event =>
                                  updateField(field => {
                                    if (field.options)
                                      field.options[index].label.en =
                                        event.target.value;
                                  })
                                }
                              />
                              <input
                                aria-label={`Option ${index + 1} Arabic`}
                                dir="rtl"
                                value={option.label.ar}
                                onChange={event =>
                                  updateField(field => {
                                    if (field.options)
                                      field.options[index].label.ar =
                                        event.target.value;
                                  })
                                }
                              />
                              <input
                                aria-label={`Option ${index + 1} Turkish`}
                                value={option.label.tr ?? ""}
                                onChange={event =>
                                  updateField(field => {
                                    if (field.options)
                                      field.options[index].label.tr =
                                        event.target.value;
                                  })
                                }
                              />
                              <button
                                type="button"
                                title="Delete option"
                                aria-label={`Delete option ${index + 1}`}
                                onClick={() =>
                                  updateField(field => {
                                    field.options = field.options?.filter(
                                      item => item.id !== option.id
                                    );
                                  })
                                }
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          ))}
                          <button
                            type="button"
                            className="platform-secondary-button"
                            onClick={() =>
                              updateField(field => {
                                field.options = [
                                  ...(field.options ?? []),
                                  {
                                    id: createKey("option"),
                                    label: {
                                      en: `Option ${(field.options?.length ?? 0) + 1}`,
                                      ar: `الخيار ${(field.options?.length ?? 0) + 1}`,
                                      tr: `Seçenek ${(field.options?.length ?? 0) + 1}`,
                                    },
                                  },
                                ];
                              })
                            }
                          >
                            <Plus size={14} /> Add option
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="nile-form-inspector-empty">
                      Select a field to edit its settings.
                    </div>
                  )
                ) : null}

                {tab === "logic" ? (
                  <div className="nile-form-inspector-section">
                    <header>
                      <span>Deterministic</span>
                      <strong>Conditional rules</strong>
                    </header>
                    {content.logic.map((rule, ruleIndex) => (
                      <section key={rule.id} className="nile-form-rule-editor">
                        <header>
                          <strong>Rule {ruleIndex + 1}</strong>
                          <button
                            type="button"
                            title="Delete rule"
                            aria-label={`Delete rule ${ruleIndex + 1}`}
                            onClick={() =>
                              updateContent(draft => {
                                draft.logic = draft.logic.filter(
                                  item => item.id !== rule.id
                                );
                              })
                            }
                          >
                            <Trash2 size={14} />
                          </button>
                        </header>
                        <label>
                          Match
                          <select
                            value={rule.when.mode}
                            onChange={event =>
                              updateContent(draft => {
                                const item = draft.logic.find(
                                  value => value.id === rule.id
                                );
                                if (item)
                                  item.when.mode = event.target.value as
                                    | "all"
                                    | "any";
                              })
                            }
                          >
                            <option value="all">All conditions</option>
                            <option value="any">Any condition</option>
                          </select>
                        </label>
                        {rule.when.conditions.map(
                          (condition, conditionIndex) => {
                            const conditionField = answerFields.find(
                              field => field.id === condition.fieldId
                            );
                            const conditionOperators =
                              conditionOperatorsForField(conditionField);
                            return (
                              <div
                                key={`${rule.id}-${conditionIndex}`}
                                className="nile-form-rule-condition"
                              >
                                <select
                                  aria-label="Condition field"
                                  value={condition.fieldId}
                                  onChange={event =>
                                    updateContent(draft => {
                                      const item = draft.logic.find(
                                        value => value.id === rule.id
                                      );
                                      const nextField = answerFields.find(
                                        field => field.id === event.target.value
                                      );
                                      if (item && nextField) {
                                        const nextOperator =
                                          conditionOperatorsForField(
                                            nextField
                                          )[0];
                                        const nextCondition =
                                          item.when.conditions[conditionIndex];
                                        nextCondition.fieldId = nextField.id;
                                        nextCondition.operator = nextOperator;
                                        nextCondition.value =
                                          defaultConditionValue(
                                            nextField,
                                            nextOperator
                                          );
                                      }
                                    })
                                  }
                                >
                                  {answerFields.map(field => (
                                    <option key={field.id} value={field.id}>
                                      {field.label.en}
                                    </option>
                                  ))}
                                </select>
                                <select
                                  aria-label="Condition operator"
                                  value={condition.operator}
                                  onChange={event =>
                                    updateContent(draft => {
                                      const item = draft.logic.find(
                                        value => value.id === rule.id
                                      );
                                      if (item) {
                                        const nextOperator = event.target
                                          .value as FormLogicOperator;
                                        const nextCondition =
                                          item.when.conditions[conditionIndex];
                                        nextCondition.operator = nextOperator;
                                        nextCondition.value =
                                          defaultConditionValue(
                                            conditionField,
                                            nextOperator
                                          );
                                      }
                                    })
                                  }
                                >
                                  {conditionOperators.map(operator => (
                                    <option key={operator} value={operator}>
                                      {operator.replaceAll("_", " ")}
                                    </option>
                                  ))}
                                </select>
                                <LogicConditionValue
                                  field={conditionField}
                                  condition={condition}
                                  onChange={value =>
                                    updateContent(draft => {
                                      const item = draft.logic.find(
                                        candidate => candidate.id === rule.id
                                      );
                                      if (item) {
                                        item.when.conditions[
                                          conditionIndex
                                        ].value = value;
                                      }
                                    })
                                  }
                                />
                                <button
                                  type="button"
                                  title="Remove condition"
                                  aria-label="Remove condition"
                                  disabled={rule.when.conditions.length === 1}
                                  onClick={() =>
                                    updateContent(draft => {
                                      const item = draft.logic.find(
                                        value => value.id === rule.id
                                      );
                                      if (item)
                                        item.when.conditions.splice(
                                          conditionIndex,
                                          1
                                        );
                                    })
                                  }
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            );
                          }
                        )}
                        <button
                          type="button"
                          className="nile-form-text-button"
                          onClick={() =>
                            updateContent(draft => {
                              const item = draft.logic.find(
                                value => value.id === rule.id
                              );
                              if (item && answerFields[0])
                                item.when.conditions.push({
                                  fieldId: answerFields[0].id,
                                  operator: "not_empty",
                                });
                            })
                          }
                        >
                          <Plus size={13} /> Condition
                        </button>
                        <label>
                          Action
                          <select
                            value={rule.action.type}
                            onChange={event =>
                              updateContent(draft => {
                                const item = draft.logic.find(
                                  value => value.id === rule.id
                                );
                                if (!item) return;
                                const type = event.target.value;
                                if (type === "skip_to_page")
                                  item.action = {
                                    type,
                                    targetPageId:
                                      content.pages[
                                        Math.min(1, content.pages.length - 1)
                                      ].id,
                                  };
                                else
                                  item.action = {
                                    type: type as
                                      | "show"
                                      | "hide"
                                      | "require"
                                      | "optional",
                                    targetFieldId: answerFields[0]?.id ?? "",
                                  };
                              })
                            }
                          >
                            <option value="show">Show field</option>
                            <option value="hide">Hide field</option>
                            <option value="require">Require field</option>
                            <option value="optional">Make optional</option>
                            <option value="skip_to_page">Skip to page</option>
                          </select>
                        </label>
                        {rule.action.type === "skip_to_page" ? (
                          <label>
                            Target page
                            <select
                              value={rule.action.targetPageId}
                              onChange={event =>
                                updateContent(draft => {
                                  const item = draft.logic.find(
                                    value => value.id === rule.id
                                  );
                                  if (item?.action.type === "skip_to_page")
                                    item.action.targetPageId =
                                      event.target.value;
                                })
                              }
                            >
                              {content.pages.map(page => (
                                <option key={page.id} value={page.id}>
                                  {page.title.en}
                                </option>
                              ))}
                            </select>
                          </label>
                        ) : (
                          <label>
                            Target field
                            <select
                              value={rule.action.targetFieldId}
                              onChange={event =>
                                updateContent(draft => {
                                  const item = draft.logic.find(
                                    value => value.id === rule.id
                                  );
                                  if (
                                    item &&
                                    item.action.type !== "skip_to_page"
                                  )
                                    item.action.targetFieldId =
                                      event.target.value;
                                })
                              }
                            >
                              {answerFields.map(field => (
                                <option key={field.id} value={field.id}>
                                  {field.label.en}
                                </option>
                              ))}
                            </select>
                          </label>
                        )}
                      </section>
                    ))}
                    <button
                      type="button"
                      className="platform-secondary-button"
                      onClick={addRule}
                    >
                      <Plus size={14} /> Add rule
                    </button>
                  </div>
                ) : null}

                {tab === "calculations" ? (
                  <div className="nile-form-inspector-section">
                    <header>
                      <span>Server evaluated</span>
                      <strong>Calculations</strong>
                    </header>
                    {(content.calculations ?? []).map(
                      (calculation, calculationIndex) => {
                        const targetOptions = numberFields.filter(
                          field =>
                            field.type === "number" &&
                            (field.id === calculation.targetFieldId ||
                              !calculationTargetIds.has(field.id))
                        );
                        return (
                          <section
                            key={calculation.id}
                            className="nile-form-rule-editor nile-form-calculation-editor"
                          >
                            <header>
                              <strong>
                                Calculation {calculationIndex + 1}
                              </strong>
                              <button
                                type="button"
                                title="Delete calculation"
                                aria-label={`Delete calculation ${calculationIndex + 1}`}
                                onClick={() =>
                                  updateContent(draft => {
                                    draft.calculations = (
                                      draft.calculations ?? []
                                    ).filter(
                                      item => item.id !== calculation.id
                                    );
                                  })
                                }
                              >
                                <Trash2 size={14} />
                              </button>
                            </header>
                            <label>
                              Result field
                              <select
                                value={calculation.targetFieldId}
                                onChange={event =>
                                  updateContent(draft => {
                                    const item = draft.calculations?.find(
                                      value => value.id === calculation.id
                                    );
                                    if (item)
                                      item.targetFieldId = event.target.value;
                                  })
                                }
                              >
                                {targetOptions.map(field => (
                                  <option key={field.id} value={field.id}>
                                    {field.label.en}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label>
                              Operation
                              <select
                                value={calculation.operator}
                                onChange={event =>
                                  updateContent(draft => {
                                    const item = draft.calculations?.find(
                                      value => value.id === calculation.id
                                    );
                                    if (!item) return;
                                    item.operator = event.target
                                      .value as FormCalculation["operator"];
                                    const minimum = [
                                      "subtract",
                                      "multiply",
                                      "divide",
                                    ].includes(item.operator)
                                      ? 2
                                      : 1;
                                    while (item.operands.length < minimum) {
                                      item.operands.push({
                                        type: "constant",
                                        value:
                                          item.operator === "multiply" ? 1 : 0,
                                      });
                                    }
                                    if (
                                      ["subtract", "divide"].includes(
                                        item.operator
                                      )
                                    ) {
                                      item.operands = item.operands.slice(0, 2);
                                    }
                                  })
                                }
                              >
                                {formCalculationOperators.map(operator => (
                                  <option key={operator} value={operator}>
                                    {operator}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label>
                              Decimal places
                              <input
                                type="number"
                                min={0}
                                max={8}
                                value={calculation.precision ?? ""}
                                onChange={event =>
                                  updateContent(draft => {
                                    const item = draft.calculations?.find(
                                      value => value.id === calculation.id
                                    );
                                    if (item)
                                      item.precision = event.target.value
                                        ? Number(event.target.value)
                                        : undefined;
                                  })
                                }
                              />
                            </label>
                            <strong>Inputs</strong>
                            {calculation.operands.map(
                              (operand, operandIndex) => (
                                <CalculationOperandEditor
                                  key={`${calculation.id}-${operandIndex}`}
                                  calculationId={calculation.id}
                                  operand={operand}
                                  fields={calculationSourceFields}
                                  calculations={content.calculations ?? []}
                                  onChange={next =>
                                    updateContent(draft => {
                                      const item = draft.calculations?.find(
                                        value => value.id === calculation.id
                                      );
                                      if (item)
                                        item.operands[operandIndex] = next;
                                    })
                                  }
                                  onRemove={() =>
                                    updateContent(draft => {
                                      const item = draft.calculations?.find(
                                        value => value.id === calculation.id
                                      );
                                      if (item)
                                        item.operands.splice(operandIndex, 1);
                                    })
                                  }
                                />
                              )
                            )}
                            <button
                              type="button"
                              className="nile-form-text-button"
                              disabled={
                                calculation.operands.length >= 10 ||
                                ["subtract", "divide"].includes(
                                  calculation.operator
                                )
                              }
                              onClick={() =>
                                updateContent(draft => {
                                  const item = draft.calculations?.find(
                                    value => value.id === calculation.id
                                  );
                                  if (item)
                                    item.operands.push({
                                      type: "constant",
                                      value: 0,
                                    });
                                })
                              }
                            >
                              <Plus size={13} /> Input
                            </button>
                          </section>
                        );
                      }
                    )}
                    {!(content.calculations ?? []).length ? (
                      <p className="nile-form-inspector-empty">
                        Calculations derive a number field from numeric inputs.
                        Respondents cannot overwrite the result.
                      </p>
                    ) : null}
                    <button
                      type="button"
                      className="platform-secondary-button"
                      onClick={addCalculation}
                    >
                      <Plus size={14} /> Add calculation
                    </button>
                  </div>
                ) : null}

                {tab === "language" ? (
                  <div className="nile-form-inspector-section">
                    <header>
                      <span>English / Arabic / Turkish</span>
                      <strong>Form content</strong>
                    </header>
                    {content.languages.map(language => (
                      <section
                        key={language}
                        className="nile-form-language-editor"
                        dir={language === "ar" ? "rtl" : "ltr"}
                      >
                        <strong>
                          {language === "en"
                            ? "English"
                            : language === "ar"
                              ? "العربية"
                              : "Türkçe"}
                        </strong>
                        <label>
                          Title
                          <input
                            aria-label={`${formLocaleNames[language]} title`}
                            value={content.title[language] ?? ""}
                            onChange={event =>
                              updateContent(draft => {
                                draft.title[language] = event.target.value;
                              })
                            }
                          />
                        </label>
                        <label>
                          Description
                          <textarea
                            aria-label={`${formLocaleNames[language]} description`}
                            rows={3}
                            value={content.description[language] ?? ""}
                            onChange={event =>
                              updateContent(draft => {
                                draft.description[language] =
                                  event.target.value;
                              })
                            }
                          />
                        </label>
                        <label>
                          Submit label
                          <input
                            aria-label={`${formLocaleNames[language]} submit label`}
                            value={content.submitLabel[language] ?? ""}
                            onChange={event =>
                              updateContent(draft => {
                                draft.submitLabel[language] =
                                  event.target.value;
                              })
                            }
                          />
                        </label>
                        <label>
                          Confirmation
                          <textarea
                            aria-label={`${formLocaleNames[language]} confirmation message`}
                            rows={3}
                            value={content.confirmationMessage[language] ?? ""}
                            onChange={event =>
                              updateContent(draft => {
                                draft.confirmationMessage[language] =
                                  event.target.value;
                              })
                            }
                          />
                        </label>
                        <label>
                          Current page title
                          <input
                            aria-label={`${formLocaleNames[language]} current page title`}
                            value={currentPage.title[language] ?? ""}
                            onChange={event =>
                              updatePage(page => {
                                page.title[language] = event.target.value;
                              })
                            }
                          />
                        </label>
                        <label>
                          Current page description
                          <textarea
                            aria-label={`${formLocaleNames[language]} current page description`}
                            rows={2}
                            value={currentPage.description?.[language] ?? ""}
                            onChange={event =>
                              updatePage(page => {
                                page.description = page.description ?? {
                                  en: "",
                                  ar: "",
                                  tr: "",
                                };
                                page.description[language] = event.target.value;
                              })
                            }
                          />
                        </label>
                      </section>
                    ))}
                  </div>
                ) : null}

                {tab === "validation" ? (
                  <div className="nile-form-inspector-section">
                    <header>
                      <span>Publish gate</span>
                      <strong>Validation</strong>
                    </header>
                    {validation?.ok ? (
                      <div className="nile-form-validation-ok">
                        <CheckCircleIcon /> <strong>Ready to save</strong>
                        <p>
                          Schema, translations, field references, and logic
                          pass.
                        </p>
                      </div>
                    ) : (
                      <ul className="nile-form-validation-list">
                        {validation?.issues.map((issue, index) => (
                          <li key={`${issue.path}-${index}`}>
                            <TriangleAlert size={14} />
                            <span>
                              <strong>{issue.path || "Form"}</strong>
                              {issue.message}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : null}
              </div>
            </aside>
          </section>
        )}
      </div>
    </PlatformShell>
  );
}

function CheckCircleIcon() {
  return <span aria-hidden="true">✓</span>;
}
